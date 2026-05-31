/**
 * AI-powered content extractor.
 * Sends screen source code to an LLM and gets back:
 * 1. A natural language description of the screen
 * 2. Navigation destinations (screens this screen links to)
 */

export interface AIExtractorConfig {
  provider: 'gemini' | 'openai';
  apiKey: string;
}

export interface AIExtractedContent {
  description: string;
  navigationLinks: string[];
}

/**
 * Use an LLM to generate a description + navigation links from source code.
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
 */
export async function extractFullContentWithAI(
  sourceCode: string,
  routeName: string,
  config: AIExtractorConfig
): Promise<AIExtractedContent> {
  const prompt = `You are analyzing a React Native screen component's source code.

Route name: "${routeName}"

Source code:
\`\`\`tsx
${sourceCode}
\`\`\`

Respond in EXACTLY this format (two lines, nothing else):
DESCRIPTION: [One concise sentence listing interactive elements: buttons, toggles/switches, text inputs, links]
NAVIGATES_TO: [Comma-separated list of route paths/screen names this screen navigates to, or NONE]

For NAVIGATES_TO, extract every destination from:
- <Link href="..."> or href={...} props
- router.push/navigate/replace calls
- navigation.navigate/push calls
- <Redirect href="..."> components
Use the route path (e.g. "/item-reviews/[id]") not the display text.`;

  let rawResponse: string;
  if (config.provider === 'gemini') {
    rawResponse = await callGemini(prompt, config.apiKey);
  } else {
    rawResponse = await callOpenAI(prompt, config.apiKey);
  }

  return parseAIResponse(rawResponse);
}

function parseAIResponse(raw: string): AIExtractedContent {
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
  let description = 'Screen content';
  const navigationLinks: string[] = [];

  for (const line of lines) {
    if (line.startsWith('DESCRIPTION:')) {
      description = line.replace('DESCRIPTION:', '').trim();
    }
    if (line.startsWith('NAVIGATES_TO:')) {
      const targets = line.replace('NAVIGATES_TO:', '').trim();
      if (targets && targets.toUpperCase() !== 'NONE') {
        for (const target of targets.split(',')) {
          const cleaned = target.trim().replace(/^['"`]|['"`]$/g, '');
          if (cleaned) navigationLinks.push(cleaned);
        }
      }
    }
  }

  return { description, navigationLinks };
}

async function callGemini(prompt: string, apiKey: string): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 150 },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 'Screen content';
}

async function callOpenAI(prompt: string, apiKey: string): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 150,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || 'Screen content';
}
