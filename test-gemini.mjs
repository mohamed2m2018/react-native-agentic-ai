import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ||  });

async function run() {
  // 1. Create a chat session with an actual system instruction / tool so that the model can call tools
  const chat = ai.chats.create({ 
    model: 'gemini-2.5-flash',
    config: {
      tools: [{ functionDeclarations: [{ name: 'addToCart', description: 'Add item', parameters: { type: 'object', properties: { item: { type: 'string' } } } }] }]
    }
  });
  
  // 2. We make a real request first, telling it to call the function
  console.log("Asking model to call function...");
  const response = await chat.sendMessage("Please add a burger to my cart using the addToCart tool.");
  console.log("Model called:", JSON.stringify(response.functionCalls));
  
  if (response.functionCalls && response.functionCalls.length > 0) {
    const call = response.functionCalls[0];
    
    // 3. Now send the function response using the working SendMessageParameters wrapper
    const payload = {
      message: [{
        functionResponse: {
          id: call.id,
          name: call.name,
          response: { success: true }
        }
      }]
    };
    
    try {
      console.log("\nSending Function Response:", JSON.stringify(payload));
      const finalRes = await chat.sendMessage(payload);
      console.log("SUCCESS! Model replied:", finalRes.text);
    } catch(e) {
      console.log("ERROR ->", e.message);
    }
  }
}

run();
