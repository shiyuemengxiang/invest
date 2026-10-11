// api/ai.ts
export const config = {
    runtime: 'edge', // 使用 Edge Runtime 获得更快的响应速度
  };
  
  export default async function handler(request: Request) {
    if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
    }
  
    try {
      const { prompt } = await request.json();
      const apiKey = process.env.API_KEY; // 从 Vercel 环境变量读取
  
      if (!apiKey) {
          return new Response(JSON.stringify({ error: 'Server configuration error: API Key missing' }), { status: 500 });
      }
  
      if (!prompt) {
          return new Response(JSON.stringify({ error: 'Prompt is required' }), { status: 400 });
      }
  
      // Vercel 服务器直接向 Google 发起请求 (服务器之间无墙)
      const googleUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
      
      const googleRes = await fetch(googleUrl, {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
          },
          body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }]
          })
      });
  
      if (!googleRes.ok) {
          const errText = await googleRes.text();
          return new Response(JSON.stringify({ error: `Google API Error: ${googleRes.status}`, details: errText }), { status: googleRes.status });
      }
  
      const data = await googleRes.json();
      return new Response(JSON.stringify(data), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
      });
  
    } catch (error: any) {
      console.error("AI Proxy Error:", error);
      return new Response(JSON.stringify({ error: 'Internal Server Error', details: error.message }), { status: 500 });
    }
  }