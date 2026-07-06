// Fonction serverless Vercel : proxy vers OpenRouter.
// La clé reste côté serveur (variable d'environnement OPENROUTER_API_KEY,
// à définir dans Vercel → Settings → Environment Variables — SANS préfixe VITE_).
// Le front appelle POST /api/chat ; la clé n'apparaît jamais dans le bundle.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    return res.status(500).json({
      error: "OPENROUTER_API_KEY non configurée dans les variables d'environnement Vercel.",
    });
  }

  const { model, messages, temperature, max_tokens } = req.body || {};
  if (!model || !Array.isArray(messages)) {
    return res.status(400).json({ error: "Requête invalide." });
  }

  // Garde-fou : le site étant public, on n'autorise que les modèles gratuits
  // (mettez ALLOW_PAID_MODELS=1 dans Vercel pour lever cette restriction).
  if (!model.endsWith(":free") && model !== "openrouter/free" && !process.env.ALLOW_PAID_MODELS) {
    return res.status(400).json({ error: "Seuls les modèles gratuits (:free) sont autorisés." });
  }

  // ---------- Log de l'appel sortant ----------
  const startedAt = Date.now();
  const contextChars = messages.reduce((n, m) => n + (m.content?.length || 0), 0);
  console.log(
    `[AI call] ${new Date(startedAt).toISOString()} → provider=openrouter model=${model} messages=${messages.length} contextChars=${contextChars}`
  );

  let upstream;
  try {
    upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        "X-Title": "Places Explorer",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: temperature ?? 0.4,
        max_tokens: Math.min(max_tokens ?? 2048, 4096),
      }),
    });
  } catch (err) {
    console.error(
      `[AI call] ${new Date().toISOString()} ✗ model=${model} durationMs=${Date.now() - startedAt} network-error=${err.message}`
    );
    return res.status(502).json({ error: "Impossible de joindre OpenRouter." });
  }

  const durationMs = Date.now() - startedAt;
  const data = await upstream.json().catch(() => ({}));

  if (upstream.ok) {
    const usage = data?.usage;
    console.log(
      `[AI call] ${new Date().toISOString()} ✓ model=${model} status=${upstream.status} durationMs=${durationMs}` +
        (usage ? ` tokens(prompt=${usage.prompt_tokens},completion=${usage.completion_tokens},total=${usage.total_tokens})` : "")
    );
  } else {
    console.error(
      `[AI call] ${new Date().toISOString()} ✗ model=${model} status=${upstream.status} durationMs=${durationMs} error=${JSON.stringify(data?.error || data)}`
    );
  }

  return res.status(upstream.status).json(data);
}
