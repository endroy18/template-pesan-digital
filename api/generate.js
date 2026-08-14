// Vercel Serverless Function: proxy panggilan ke Gemini (Interactions API)
// agar API key tidak pernah dikirim ke browser. Key dibaca dari env var GEMINI_API_KEY.

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/interactions";

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { prompt } = req.body || {};
  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ error: "Field 'prompt' wajib diisi" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "GEMINI_API_KEY belum diatur di environment" });
  }

  const model = process.env.GEMINI_MODEL || "gemini-3.6-flash";

  let upstream;
  try {
    upstream = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        model,
        input: prompt,
        // thinking_level rendah = lebih cepat & hemat untuk tugas sederhana.
        generation_config: { thinking_level: "low" },
      }),
    });
  } catch (e) {
    return res.status(502).json({ error: "Gagal menghubungi Gemini: " + e.message });
  }

  let json;
  try {
    json = await upstream.json();
  } catch (e) {
    return res.status(502).json({ error: "Respons tidak valid dari Gemini" });
  }

  if (!upstream.ok) {
    const msg = json && json.error && json.error.message ? json.error.message : "HTTP " + upstream.status;
    return res.status(upstream.status).json({ error: msg });
  }

  // Ekstrak teks dari steps timeline (langkah model_output -> content bertipe text).
  const text = (json.steps || [])
    .filter((s) => s.type === "model_output")
    .flatMap((s) => s.content || [])
    .filter((c) => c.type === "text")
    .map((c) => c.text || "")
    .join("")
    .trim();

  if (!text) {
    return res.status(502).json({ error: "Respons AI kosong" });
  }

  res.status(200).json({ text });
};
