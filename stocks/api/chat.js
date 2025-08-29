// stocks/api/chat.js  —— 转发到 OpenAI，并把错误透出
export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-proxy-key");
  if (req.method === "OPTIONS") return res.status(200).end();

  // 健康检查（GET 可用，但不会影响 POST）
  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      note: "Use POST with {model,messages} for chat completions.",
      hasOpenAIKey: !!process.env.OPENAI_API_KEY
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

    // 兼容某些场景 body 为空：手动解析
    const body =
      req.body ??
      await new Promise((resolve) => {
        let raw = "";
        req.on("data", (c) => (raw += c));
        req.on("end", () => {
          try { resolve(JSON.parse(raw || "{}")); }
          catch { resolve({}); }
        });
      });

    const { model = "gpt-4o-mini", messages, temperature = 0.7, ...rest } = body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Missing 'messages' array in request body" });
    }

    // 可选：如果你在 Vercel 配了 PROXY_ACCESS_KEY，就校验一下
    const REQUIRED_KEY = process.env.PROXY_ACCESS_KEY;
    if (REQUIRED_KEY) {
      const clientKey = req.headers["x-proxy-key"];
      if (clientKey !== REQUIRED_KEY) {
        return res.status(401).json({ error: "Unauthorized (bad x-proxy-key)" });
      }
    }

    // 转发给 OpenAI
    const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({ model, messages, temperature, ...rest }),
    });

    const upstreamText = await upstream.text();
    let payload;
    try { payload = JSON.parse(upstreamText); } catch { payload = { raw: upstreamText }; }

    if (!upstream.ok) {
      return res.status(upstream.status).json({
        error: "Upstream OpenAI error",
        status: upstream.status,
        payload
      });
    }

    return res.status(200).json(payload);
  } catch (err) {
    return res.status(500).json({
      error: "Proxy error",
      message: err?.message || String(err)
    });
  }
}
