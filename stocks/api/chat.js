// stocks/api/chat.js
export default async function handler(req, res) {
  // --- CORS ---
  res.setHeader("Access-Control-Allow-Origin", "*"); // 需要的话改成你的域名
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-proxy-key");
  if (req.method === "OPTIONS") return res.status(200).end();

  // 健康检查（GET）
  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      note: "Use POST with {model,messages} for chat completions.",
      hasOpenAIKey: !!process.env.OPENAI_API_KEY,
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
      return res.status(500).json({ error: "OPENAI_API_KEY is not set" });
    }

    // 兼容某些场景 req.body 为空：手动解析
    let body = req.body;
    if (!body) {
      const raw = await new Promise((resolve) => {
        let acc = "";
        req.on("data", (c) => (acc += c));
        req.on("end", () => resolve(acc));
      });
      try {
        body = raw ? JSON.parse(raw) : {};
      } catch {
        return res.status(400).json({ error: "Invalid JSON body" });
      }
    }

    // 可选：简单鉴权（若在 Vercel 里设置 PROXY_ACCESS_KEY）
    const REQUIRED_KEY = process.env.PROXY_ACCESS_KEY;
    if (REQUIRED_KEY) {
      const clientKey = req.headers["x-proxy-key"];
      if (clientKey !== REQUIRED_KEY) {
        return res.status(401).json({ error: "Unauthorized (bad x-proxy-key)" });
      }
    }

    const {
      model = "gpt-4o-mini",
      messages,
      temperature = 0.7,
      ...rest
    } = body || {};

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Missing 'messages' array in request body" });
    }

    // --- 转发到 OpenAI ---
    const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({ model, messages, temperature, ...rest }),
    });

    const text = await upstream.text();
    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { raw: text };
    }

    if (!upstream.ok) {
      // 把上游错误透出，便于在 Network / Logs 中定位
      console.error("OpenAI upstream error:", upstream.status, payload);
      return res.status(upstream.status).json({
        error: "Upstream OpenAI error",
        status: upstream.status,
        payload,
      });
    }

    return res.status(200).json(payload);
  } catch (err) {
    console.error("Proxy error:", err);
    return res.status(500).json({
      error: "Proxy error",
      message: err?.message || String(err),
    });
  }
}
