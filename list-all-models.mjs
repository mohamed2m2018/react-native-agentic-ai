import { GoogleGenAI } from '@google/genai';

async function listModels() {
  try {
    const ai = new GoogleGenAI({ apiKey: '${process.env.GEMINI_API_KEY}' });
    const response = await ai.models.list();
    const models = Array.from(response);
    
    console.log('--- All Available Models ---');
    models.forEach(m => {
      console.log(`- ${m.name}`);
    });

  } catch (error) {
    console.error(error.message);
  }
}

listModels();
