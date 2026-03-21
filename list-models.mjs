import { GoogleGenAI } from '@google/genai';

async function listModels() {
  try {
    const ai = new GoogleGenAI({ apiKey: '${process.env.GEMINI_API_KEY}' });
    console.log('Fetching available models...');

    const response = await ai.models.list();
    const models = Array.from(response);
    
    // Filter out old/vision models just to keep output clean, focusing on gemini-2
    const gemini2Models = models.filter(m => m.name.includes('gemini-2'));
    
    console.log('\n--- Gemini 2 Models Available ---');
    gemini2Models.forEach(m => {
      console.log(`- ${m.name} (Supported methods: ${m.supportedGenerationMethods?.join(', ')})`);
    });

    // Also list gemini-1.5 if gemini-2 is empty
    if (gemini2Models.length === 0) {
      console.log('\n--- No Gemini 2.0 models found. Listing Gemini 1.5 Models ---');
      const gemini15Models = models.filter(m => m.name.includes('gemini-1.5'));
      gemini15Models.forEach(m => {
        console.log(`- ${m.name} (Supported methods: ${m.supportedGenerationMethods?.join(', ')})`);
      });
    }

  } catch (error) {
    console.error('❌ Failed to list models:');
    console.error(error.message);
  }
}

listModels();
