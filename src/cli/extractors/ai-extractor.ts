/**
 * AI-powered content extractor.
 * Sends trimmed screen source code to an LLM and gets back:
 * 1. A natural language description of the screen
 * 2. Navigation destinations (screens this screen links to)
 *
 * Uses structured JSON output (responseSchema) for reliable parsing.
 */

export interface AIExtractorConfig {
  provider: 'gemini' | 'openai';
  apiKey: string;
}

export interface AIExtractedContent {
  description: string;
  navigationLinks: string[];
}

// ─── Source Code Trimming ──────────────────────────────────────

const MAX_LINES = 200;

/**
 * Strip noise from source code before sending to the LLM:
 * 1. Remove import statements (keep module paths in a compact header)
 * 2. Remove StyleSheet.create blocks and inline style objects
 * 3. Remove PropTypes declarations
 * 4. If still > MAX_LINES, extract just the JSX return() block
 * 5. Cap at MAX_LINES
 */
export function trimSourceForAI(sourceCode: string): string {
  const lines = sourceCode.split('\n');
  const importPaths: string[] = [];
  const filtered: string[] = [];

  let insideStyleSheet = false;
  let braceDepth = 0;

  for (const line of lines) {
    const trimmed = line.trim();

    // Collect import paths compactly, skip the full import line
    if (trimmed.startsWith('import ')) {
      const fromMatch = trimmed.match(/from\s+['"]([^'"]+)['"]/);
      if (fromMatch) importPaths.push(fromMatch[1]);
      continue;
    }

    // Skip require statements
    if (trimmed.startsWith('const ') && trimmed.includes('require(')) continue;

    // Detect StyleSheet.create / styles = { start
    if (!insideStyleSheet && (
      trimmed.includes('StyleSheet.create(') ||
      /^(const|let|var)\s+styles\s*=\s*\{/.test(trimmed) ||
      trimmed.startsWith('export default StyleSheet')
    )) {
      insideStyleSheet = true;
      braceDepth = 0;
    }

    // Track brace depth inside style blocks
    if (insideStyleSheet) {
      for (const ch of line) {
        if (ch === '{' || ch === '(') braceDepth++;
        if (ch === '}' || ch === ')') braceDepth--;
      }
      if (braceDepth <= 0) {
        insideStyleSheet = false;
        braceDepth = 0;
      }
      continue;
    }

    // Skip PropTypes
    if (trimmed.includes('.propTypes') || trimmed.includes('.defaultProps')) continue;

    // Skip empty lines in sequence (max 1 blank)
    if (trimmed === '' && filtered.length > 0 && filtered[filtered.length - 1].trim() === '') continue;

    filtered.push(line);
  }

  // Build compact header
  const header = importPaths.length > 0
    ? `// Dependencies: ${importPaths.join(', ')}\n`
    : '';

  // If still too long, extract just the JSX return block
  if (filtered.length > MAX_LINES) {
    const jsxBlock = extractReturnBlock(filtered);
    if (jsxBlock) {
      return header + jsxBlock;
    }
  }

  return header + filtered.slice(0, MAX_LINES).join('\n');
}

/**
 * Extract the JSX return(...) block from filtered lines.
 * This contains all interactive elements — the most valuable context for the AI.
 */
function extractReturnBlock(lines: string[]): string | null {
  let returnStart = -1;
  let depth = 0;
  const result: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (returnStart === -1 && /^return\s*[\(]/.test(trimmed)) {
      returnStart = i;
    }
    if (returnStart !== -1) {
      result.push(lines[i]);
      for (const ch of lines[i]) {
        if (ch === '(' || ch === '{') depth++;
        if (ch === ')' || ch === '}') depth--;
      }
      if (depth <= 0 && result.length > 1) {
        return result.join('\n');
      }
    }
  }
  return null;
}

// ─── Robust JSON extraction ──────────────────────────────────

function extractJSON(raw: string): any | null {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch {}
  // Strip markdown fencing
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    try { return JSON.parse(fenceMatch[1].trim()); } catch {}
  }
  // Find first { and last }
  const firstBrace = raw.indexOf('{');
  const lastBrace = raw.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try { return JSON.parse(raw.substring(firstBrace, lastBrace + 1)); } catch {}
  }
  return null;
}

// ─── Main extraction ──────────────────────────────────────────

/**
 * Use an LLM to generate a description from source code (simple return).
 */
export async function extractContentWithAI(
  sourceCode: string,
  routeName: string,
  config: AIExtractorConfig
): Promise<string> {
  const result = await extractFullContentWithAI(sourceCode, routeName, config);
  return result.description;
}

/**
 * Full extraction: description + navigation links.
 * Pre-context from AST is optional but improves quality.
 */
export async function extractFullContentWithAI(
  sourceCode: string,
  routeName: string,
  config: AIExtractorConfig,
  astDescription?: string
): Promise<AIExtractedContent> {
  const trimmedSource = trimSourceForAI(sourceCode);

  const astContext = astDescription && astDescription !== 'Screen content'
    ? `\nAST-detected elements: ${astDescription}\n`
    : '';

  const prompt = `Analyze this React Native screen component and produce a structured summary.

Route name: "${routeName}"
${astContext}
Source code (trimmed):
\`\`\`tsx
${trimmedSource}
\`\`\`

Write "description" as a single sentence in this exact pattern:
"<Purpose> screen with <comma-separated interactive elements>."

Example: "User login screen with email and password text inputs, forgot-password link, social login buttons, and language toggle."

List "navigatesTo" as an array of screen/route names extracted from navigation.navigate(), router.push(), <Link>, or <Redirect> components. Use the route string, not display text.`;

  if (config.provider === 'gemini') {
    return callGeminiStructured(prompt, config.apiKey);
  }
  return callOpenAIStructured(prompt, config.apiKey);
}

// ─── Gemini (structured JSON output) ──────────────────────────

const GEMINI_SCHEMA = {
  type: 'object',
  properties: {
    description: {
      type: 'string',
      description: 'One sentence: purpose + interactive elements',
    },
    navigatesTo: {
      type: 'array',
      items: { type: 'string' },
      description: 'Route names this screen navigates to',
    },
  },
  required: ['description', 'navigatesTo'],
};

async function callGeminiStructured(prompt: string, apiKey: string): Promise<AIExtractedContent> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 300,
          responseMimeType: 'application/json',
          responseSchema: GEMINI_SCHEMA,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gemini API error: ${response.status} ${text.substring(0, 200)}`);
  }

  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!rawText) return { description: 'Screen content', navigationLinks: [] };

  const parsed = extractJSON(rawText);
  if (parsed && parsed.description) {
    return {
      description: parsed.description,
      navigationLinks: Array.isArray(parsed.navigatesTo) ? parsed.navigatesTo : [],
    };
  }
  return { description: rawText.substring(0, 200), navigationLinks: [] };
}

// ─── OpenAI (structured JSON output) ──────────────────────────

const OPENAI_SCHEMA = {
  name: 'screen_summary',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      description: { type: 'string' },
      navigatesTo: { type: 'array', items: { type: 'string' } },
    },
    required: ['description', 'navigatesTo'],
    additionalProperties: false,
  },
};

async function callOpenAIStructured(prompt: string, apiKey: string): Promise<AIExtractedContent> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1024,
      response_format: { type: 'json_schema', json_schema: OPENAI_SCHEMA },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI API error: ${response.status} ${text.substring(0, 200)}`);
  }

  const data = await response.json();
  const rawText = data.choices?.[0]?.message?.content?.trim();
  if (!rawText) return { description: 'Screen content', navigationLinks: [] };

  const parsed = extractJSON(rawText);
  if (parsed && parsed.description) {
    return {
      description: parsed.description,
      navigationLinks: Array.isArray(parsed.navigatesTo) ? parsed.navigatesTo : [],
    };
  }
  return { description: rawText.substring(0, 200), navigationLinks: [] };
}
