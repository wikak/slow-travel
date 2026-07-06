// ---------- Assistant voyage (Gemini) ----------
// Les fichiers JSON sont trop gros pour être envoyés au LLM (~16 000 lieux).
// Stratégie : on filtre localement les lieux pertinents pour la question,
// puis on envoie un extrait condensé (nom, zone, note, prix moyen...) à Gemini.

import { computeScore } from "./score.js";

// ---------- Fournisseur LLM ----------
// En local : clé dans .env (VITE_OPENROUTER_API_KEY, appel direct depuis le navigateur).
// En ligne (Vercel) : PAS de clé dans le bundle — le front appelle /api/chat,
// une fonction serverless qui détient la clé (variable OPENROUTER_API_KEY côté Vercel).
// Forçable : VITE_LLM_PROVIDER=openrouter|deepseek|gemini ; modèle : VITE_LLM_MODEL.

const ENV = import.meta.env;

// Modèles gratuits OpenRouter essayés dans l'ordre (la liste :free évolue ;
// si l'un disparaît ou est saturé, on passe au suivant automatiquement).
const FREE_MODELS = [
  "google/gemma-4-31b-it:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "openai/gpt-oss-120b:free",
  "openrouter/free", // routeur automatique vers un modèle gratuit disponible
];

function getConfig() {
  const forced = ENV.VITE_LLM_PROVIDER;
  const provider =
    forced ||
    (ENV.VITE_OPENROUTER_API_KEY && "openrouter") ||
    (ENV.VITE_DEEPSEEK_API_KEY && "deepseek") ||
    (ENV.VITE_GEMINI_API_KEY && "gemini") ||
    "proxy"; // aucune clé locale → fonction serverless /api/chat (production Vercel)

  switch (provider) {
    case "openrouter":
      return {
        provider,
        kind: "openai",
        url: "https://openrouter.ai/api/v1/chat/completions",
        key: ENV.VITE_OPENROUTER_API_KEY,
        models: [ENV.VITE_LLM_MODEL || FREE_MODELS[0], ...FREE_MODELS],
      };
    case "deepseek":
      return {
        provider,
        kind: "openai",
        url: "https://api.deepseek.com/chat/completions",
        key: ENV.VITE_DEEPSEEK_API_KEY,
        models: [ENV.VITE_LLM_MODEL || "deepseek-v4-flash"],
      };
    case "gemini":
      return {
        provider,
        kind: "gemini",
        key: ENV.VITE_GEMINI_API_KEY,
        model: ENV.VITE_LLM_MODEL || ENV.VITE_GEMINI_MODEL || "gemini-2.5-flash",
      };
    default:
      return {
        provider: "openrouter",
        kind: "openai",
        url: "/api/chat",
        key: null, // la clé vit côté serveur
        models: [ENV.VITE_LLM_MODEL || FREE_MODELS[0], ...FREE_MODELS],
      };
  }
}

// Dispo si clé locale, ou en production (la fonction serverless prend le relais)
export const hasApiKey = () => Boolean(getConfig()?.key) || ENV.PROD;

// ---------- 1. Index plat de tous les lieux ----------

let _index = null;

export function buildIndex(cities) {
  if (_index) return _index;
  const rows = [];
  const seen = new Set();
  cities.forEach(({ id, full, data }) => {
    Object.entries(data).forEach(([zone, cats]) => {
      Object.entries(cats || {}).forEach(([cat, arr]) => {
        (arr || []).forEach((p) => {
          const key = `${p.name}::${p.address || ""}`;
          if (seen.has(key)) return; // dédoublonné (multi-catégories)
          seen.add(key);
          const start = Number(p.price_range?.startPrice?.units);
          const end = Number(p.price_range?.endPrice?.units);
          rows.push({
            city: id,
            cityFull: full,
            zone,
            cat,
            name: p.name || "",
            rating: p.global_rating || 0,
            reviews: p.total_ratings_count || 0,
            priceLevel: p.price_level || "",
            priceStart: Number.isNaN(start) ? null : start,
            priceEnd: Number.isNaN(end) ? null : end,
            types: p.types || [],
            score: computeScore(p).total,
            _search: `${p.name} ${zone} ${cat} ${(p.types || []).join(" ")}`.toLowerCase(),
          });
        });
      });
    });
  });
  _index = rows;
  return rows;
}

// ---------- 2. Sélection des lieux pertinents pour la question ----------

const CITY_ALIASES = {
  JHB: ["jhb", "johannesburg", "joburg", "jozi", "gauteng", "pretoria", "sandton", "soweto"],
  DBN: ["dbn", "durban", "kwazulu", "umhlanga", "uhmlanga"],
  CPT: ["cpt", "cape town", "le cap", "cape-town", "capetown", "western cape", "waterfront"],
};

const norm = (s) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export function selectRelevant(index, question, activeCityId, limit = 140) {
  const q = norm(question);

  // Zones explicitement mentionnées — cherchées dans TOUTES les villes,
  // pour que "Camps Bay" fonctionne même si l'onglet actif est JHB.
  const zoneNames = [...new Set(index.map((r) => r.zone))];
  const hitZones = zoneNames.filter((z) => q.includes(norm(z.split(",")[0])));

  // Ville(s) mentionnée(s) explicitement
  const cityIds = Object.entries(CITY_ALIASES)
    .filter(([, aliases]) => aliases.some((a) => q.includes(a)))
    .map(([id]) => id);

  let pool;
  if (hitZones.length > 0) {
    pool = index.filter((r) => hitZones.includes(r.zone));
    // Une zone homonyme peut exister dans 2 villes (ex. Newlands) : si une
    // ville est aussi citée, on l'utilise pour trancher.
    if (cityIds.length > 0) {
      const both = pool.filter((r) => cityIds.includes(r.city));
      if (both.length > 0) pool = both;
    }
  } else {
    const ids = cityIds.length > 0 ? cityIds : [activeCityId];
    pool = index.filter((r) => ids.includes(r.city));
  }

  // Catégories mentionnées
  const catNames = [...new Set(pool.map((r) => r.cat))];
  const hitCats = catNames.filter((c) => q.includes(norm(c)));

  // Mots-clés libres (≥ 4 lettres, hors mots vides)
  const STOP = new Set(["dans", "avec", "pour", "cout", "coute", "prix", "budget", "jour", "journee", "itineraire", "propose", "moyenne", "restaurant", "restaurants", "faire", "voir", "manger", "quel", "quelle", "quels", "combien", "estime", "estimation", "zone", "zones", "matin", "midi", "soir", "apres"]);
  const words = q.split(/[^a-z0-9]+/).filter((w) => w.length >= 4 && !STOP.has(w));

  const scored = pool.map((r) => {
    let rel = 0;
    if (hitZones.includes(r.zone)) rel += 30;
    if (hitCats.includes(r.cat)) rel += 30;
    words.forEach((w) => {
      if (r._search.includes(w)) rel += 8;
    });
    return { r, rel, rank: rel * 1000 + r.score };
  });

  // Si des critères matchent, on privilégie ces lieux ; sinon top score général
  const anyRel = scored.some((s) => s.rel > 0);
  const kept = (anyRel ? scored.filter((s) => s.rel > 0 || s.r.score >= 60) : scored)
    .sort((a, b) => b.rank - a.rank)
    .slice(0, limit)
    .map((s) => s.r);

  // Pour un itinéraire il faut de la variété : compléter avec les meilleures
  // attractions/culture/nature de la même sélection de ville/zones si absentes
  const hasNonFood = kept.some((r) => !r.cat.match(/restaurant|café|bar|food|steak|pub|livraison|nourriture/i));
  if (!hasNonFood) {
    const extras = pool
      .filter((r) => !r.cat.match(/restaurant|café|bar|food|steak|pub|livraison|nourriture|grossiste/i))
      .filter((r) => (hitZones.length === 0 || hitZones.includes(r.zone)))
      .sort((a, b) => b.score - a.score)
      .slice(0, 30);
    kept.push(...extras);
  }
  return kept.slice(0, limit + 30);
}

// ---------- 3. Contexte condensé envoyé au LLM ----------

export function condense(rows) {
  return rows
    .map((r) => {
      const price =
        r.priceStart !== null
          ? `${r.priceStart}${r.priceEnd ? "–" + r.priceEnd : ""} ZAR (moy. ${Math.round(
            r.priceEnd ? (r.priceStart + r.priceEnd) / 2 : r.priceStart
          )} ZAR/pers)`
          : "prix inconnu";
      return `${r.name} | ${r.zone.split(",")[0]} (${r.city}) | ${r.cat} | ★${r.rating} (${r.reviews} avis) | score ${r.score} | ${price}`;
    })
    .join("\n");
}

const SYSTEM_PROMPT = `Tu es l'assistant voyage de "Explorateur de lieux", une app de slow-travel en Afrique du Sud (Johannesburg, Durban, Cape Town).
Tu réponds UNIQUEMENT à partir de la liste de lieux fournie ci-dessous (données Google Maps de l'utilisateur). N'invente jamais de lieu, de note ni de prix.

Format des données : Nom | Zone (Ville) | Catégorie | ★note (nb avis) | score voyageur /100 | fourchette de prix ZAR (moy. = prix moyen par personne).

Tes missions :
1. Construire des itinéraires sur mesure (matin / déjeuner / après-midi / dîner / soirée), en regroupant les lieux par zone pour limiter les trajets, et en privilégiant les meilleurs scores voyageur.
2. Estimer le coût de la journée par personne : additionne le prix moyen de chaque restaurant/café retenu (moy. indiquée). Présente le détail du calcul puis le total, ex. "≈ 750 ZAR/pers (hors activités)". Si un lieu n'a pas de prix, dis-le et ne l'inclus pas dans le total. Les attractions n'ont en général pas de prix dans les données : précise que leur billetterie n'est pas incluse.
3. Répondre à toute question sur les lieux (comparaisons, meilleurs choix par zone/catégorie, budget...).

Règles : réponds en français, de façon claire et concise. Indique toujours la zone de chaque lieu proposé. Si la question sort des données disponibles (transport, hôtels, météo...), dis-le simplement. Utilise des montants en ZAR.`;

// ---------- 4. Appel du LLM ----------

async function callOpenAICompatible(cfg, systemText, history, question) {
  const messages = [
    { role: "system", content: systemText },
    ...history.map((m) => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.text,
    })),
    { role: "user", content: question },
  ];

  // Essaie chaque modèle de la liste : si l'un a disparu (404), est saturé (429)
  // ou nécessite des crédits (402), on tente le suivant.
  const models = [...new Set(cfg.models)];
  let lastError = null;
  const contextChars = messages.reduce((n, m) => n + (m.content?.length || 0), 0);

  for (const model of models) {
    const headers = { "Content-Type": "application/json" };
    if (cfg.key) headers.Authorization = `Bearer ${cfg.key}`;

    const startedAt = Date.now();
    console.log(
      `[AI call] ${new Date(startedAt).toISOString()} → provider=${cfg.provider} model=${model} messages=${messages.length} contextChars=${contextChars}`
    );

    let res;
    try {
      res = await fetch(cfg.url, {
        method: "POST",
        headers,
        body: JSON.stringify({ model, messages, temperature: 0.4, max_tokens: 2048 }),
      });
    } catch (err) {
      console.error(
        `[AI call] ${new Date().toISOString()} ✗ model=${model} durationMs=${Date.now() - startedAt} network-error=${err.message}`
      );
      throw new Error("Impossible de joindre le serveur — vérifiez votre connexion.");
    }

    const durationMs = Date.now() - startedAt;

    if (res.ok) {
      const json = await res.json();
      const text = json?.choices?.[0]?.message?.content || "";
      const usage = json?.usage;
      console.log(
        `[AI call] ${new Date().toISOString()} ✓ model=${model} status=${res.status} durationMs=${durationMs}` +
          (usage ? ` tokens(prompt=${usage.prompt_tokens},completion=${usage.completion_tokens},total=${usage.total_tokens})` : "")
      );
      if (text) return text;
      lastError = new Error("Réponse vide du modèle.");
      continue;
    }

    const errBody = await res.json().catch(() => ({}));
    const detail = errBody?.error?.message || errBody?.error || null;
    console.error(
      `[AI call] ${new Date().toISOString()} ✗ model=${model} status=${res.status} durationMs=${durationMs} error=${JSON.stringify(detail || errBody)}`
    );

    if (res.status === 401) throw new Error("Clé API invalide — vérifiez votre configuration.");
    // Erreur de config serveur (clé absente côté Vercel) : inutile de réessayer
    // les autres modèles, ça échouera pareil à chaque fois.
    if (typeof detail === "string" && detail.includes("OPENROUTER_API_KEY")) throw new Error(detail);
    // 500/502/503 : panne ponctuelle côté fournisseur (souvent un modèle gratuit
    // surchargé) — on bascule sur le modèle suivant plutôt que d'abandonner.
    if ([402, 404, 429, 500, 502, 503].includes(res.status)) {
      lastError = new Error(
        res.status === 429
          ? "Limite gratuite atteinte sur tous les modèles — réessayez dans une minute."
          : detail
          ? `Modèle "${model}" indisponible (${res.status}) : ${detail}`
          : `Modèle "${model}" indisponible (${res.status}).`
      );
      continue; // modèle suivant
    }
    throw new Error(
      detail ? `Erreur ${cfg.provider} (${res.status}) : ${detail}` : `Erreur ${cfg.provider} (${res.status}). Réessayez.`
    );
  }
  throw lastError || new Error("Aucun modèle disponible — réessayez plus tard.");
}

async function callGemini(cfg, systemText, history, question) {
  const contents = [
    ...history.map((m) => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.text }],
    })),
    { role: "user", parts: [{ text: question }] },
  ];

  const startedAt = Date.now();
  const contextChars = systemText.length + contents.reduce((n, c) => n + (c.parts?.[0]?.text?.length || 0), 0);
  console.log(
    `[AI call] ${new Date(startedAt).toISOString()} → provider=gemini model=${cfg.model} messages=${contents.length} contextChars=${contextChars}`
  );

  let res;
  try {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${cfg.model}:generateContent?key=${cfg.key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemText }] },
          contents,
          generationConfig: { temperature: 0.4, maxOutputTokens: 2048 },
        }),
      }
    );
  } catch (err) {
    console.error(
      `[AI call] ${new Date().toISOString()} ✗ model=${cfg.model} durationMs=${Date.now() - startedAt} network-error=${err.message}`
    );
    throw err;
  }

  const durationMs = Date.now() - startedAt;

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(
      `[AI call] ${new Date().toISOString()} ✗ model=${cfg.model} status=${res.status} durationMs=${durationMs} error=${body.slice(0, 300)}`
    );
    if (res.status === 400 && body.includes("API key")) {
      throw new Error("Clé API invalide — vérifiez VITE_GEMINI_API_KEY dans votre .env.");
    }
    if (res.status === 429) throw new Error("Quota gratuit atteint pour l'instant — réessayez dans une minute.");
    throw new Error(`Erreur Gemini (${res.status}). Réessayez.`);
  }

  const json = await res.json();
  const usage = json?.usageMetadata;
  console.log(
    `[AI call] ${new Date().toISOString()} ✓ model=${cfg.model} status=${res.status} durationMs=${durationMs}` +
      (usage ? ` tokens(prompt=${usage.promptTokenCount},completion=${usage.candidatesTokenCount},total=${usage.totalTokenCount})` : "")
  );
  return json?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";
}

export async function askAssistant({ question, history, cities, activeCityId }) {
  const cfg = getConfig();
  // En dev local sans clé, /api/chat n'existe pas (il ne tourne que sur Vercel)
  if (!cfg.key && cfg.url === "/api/chat" && ENV.DEV) {
    throw new Error(
      "Clé API manquante : copiez .env.example en .env, renseignez VITE_OPENROUTER_API_KEY (clé gratuite sur openrouter.ai/keys), puis relancez npm run dev."
    );
  }

  const index = buildIndex(cities);
  // La sélection tient compte de la question courante + la précédente (suivi de conversation)
  const prevUser = [...history].reverse().find((m) => m.role === "user");
  const relevant = selectRelevant(index, `${prevUser?.text || ""} ${question}`, activeCityId);
  const context = condense(relevant);
  const systemText = `${SYSTEM_PROMPT}\n\n=== LIEUX DISPONIBLES (${relevant.length}) ===\n${context}`;

  const text =
    cfg.kind === "gemini"
      ? await callGemini(cfg, systemText, history, question)
      : await callOpenAICompatible(cfg, systemText, history, question);

  if (!text) throw new Error("Réponse vide du modèle — réessayez.");
  return text;
}
