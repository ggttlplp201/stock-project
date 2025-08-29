// stocks/api/chat.js
export default async function handler(req, res) {
  // --- CORS ---
  res.setHeader("Access-Control-Allow-Origin", "*"); // 线上可改成你的域名
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-proxy-key");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
      // 这是最常见原因：环境变量没配或没重新部署
      return res.status(500).json({ error: "OPENAI_API_KEY is not set" });
    }

    
    // 兼容某些情况下 req.body 为 undefined：手动解析
    const body =
      req.body ??
      await new Promise((resolve) => {
        let data = "";
        req.on("data", (chunk) => (data += chunk));
        req.on("end", () => {
          try { resolve(JSON.parse(data || "{}")); }
          catch { resolve({}); }
        });
      });

    const {
      model = "gpt-4o-mini",
      messages = [],
      temperature = 0.7,
      ...rest
    } = body || {};

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Missing 'messages' in request body" });
    }

    // 可选：简单鉴权（如果你在 Vercel 里设置了 PROXY_ACCESS_KEY）
    const REQUIRED_KEY = process.env.PROXY_ACCESS_KEY;
    if (REQUIRED_KEY) {
      const clientKey = req.headers["x-proxy-key"];
      if (clientKey !== REQUIRED_KEY) {
        return res.status(401).json({ error: "Unauthorized (bad x-proxy-key)" });
      }
    }

    // 转发到 OpenAI
    const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({ model, messages, temperature, ...rest }),
    });

    // 如果上游失败，把错误透出，便于排查
    const text = await upstream.text();
    let payload;
    try { payload = JSON.parse(text); } catch { payload = { raw: text }; }

    if (!upstream.ok) {
      return res.status(upstream.status).json({
        error: "Upstream OpenAI error",
        status: upstream.status,
        payload,
      });
    }

    // 正常返回
    return res.status(200).json(payload);
  } catch (err) {
    // 兜底错误，确保你能在日志/响应里看到堆栈
    return res.status(500).json({
      error: "Proxy error",
      message: err?.message || String(err),
    });
  }
}
