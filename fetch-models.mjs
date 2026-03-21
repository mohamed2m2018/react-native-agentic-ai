async function fetchModels() {
  const url = 'https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}';
  const response = await fetch(url);
  const data = await response.json();
  
  if (data.models) {
    const names = data.models.map(m => m.name);
    console.log('Available Models (Raw REST):');
    console.log(names.filter(n => n.includes('gemini')).join('\n'));
  } else {
    console.log(data);
  }
}

fetchModels();
