// ---------- Score "Crème de la crème" (0–100) ----------
// Identifie les lieux qu'un touriste adorerait :
// note fiable, retours récents excellents, service/ambiance/qualité-prix salués.

const SIGNAL_KEYWORDS = {
  service: ["service", "personnel", "accueil", "serveur", "serveuse", "attentionn", "aimable", "staff", "friendly"],
  ambiance: ["ambiance", "atmosph", "cadre", "déco", "decor", "cosy", "chaleureu", "vibe", "magnifique"],
  qualitePrix: ["prix", "abordable", "rapport qualité", "raisonnable", "généreu", "value", "pas cher", "imbattable"],
};

export const CREME_THRESHOLD = 72;

// Cache : le score d'un lieu ne change jamais pendant la session
const cache = new Map();

export function computeScore(place) {
  const key = `${place.name}::${place.address || ""}`;
  if (cache.has(key)) return cache.get(key);

  // 1) Note fiabilisée (moyenne bayésienne) — 40 pts.
  //    Une note de 5.0 avec 1 avis est ramenée vers 4.2 ;
  //    4.7 avec 900 avis garde presque toute sa valeur.
  const v = place.total_ratings_count || 0;
  const R = place.global_rating || 0;
  const m = 50, C = 4.2;
  const bayes = (v / (v + m)) * R + (m / (v + m)) * C;
  const ptsFiable = (bayes / 5) * 40;

  // 2) Retours récents (12 derniers mois) — 25 pts
  const reviews = place.reviews_last_12_months || [];
  const n = reviews.length;
  const recentAvg = n ? reviews.reduce((s, r) => s + (r.rating || 0), 0) / n : 0;
  const ptsRecent = n ? (recentAvg / 5) * 15 + (Math.min(n, 5) / 5) * 10 : 0;

  // 3) Signaux qualitatifs dans le texte des avis — 25 pts max
  const allText = reviews.map((r) => (r.text || "").toLowerCase()).join(" ");
  const flags = {
    service: SIGNAL_KEYWORDS.service.some((k) => allText.includes(k)),
    ambiance: SIGNAL_KEYWORDS.ambiance.some((k) => allText.includes(k)),
    qualitePrix: SIGNAL_KEYWORDS.qualitePrix.some((k) => allText.includes(k)),
  };
  const negCount = reviews.filter((r) => (r.rating || 0) <= 2).length;
  const ptsSignaux = Math.max(
    0,
    (flags.service ? 8 : 0) + (flags.ambiance ? 8 : 0) + (flags.qualitePrix ? 9 : 0) - negCount * 5
  );

  // 4) Accessibilité prix — 10 pts
  const start = Number(place.price_range?.startPrice?.units || NaN);
  let ptsPrix;
  if (Number.isNaN(start)) ptsPrix = 4;
  else if (start <= 100) ptsPrix = 10;
  else if (start <= 200) ptsPrix = 8;
  else if (start <= 300) ptsPrix = 5;
  else ptsPrix = 2;

  const total = Math.round(Math.min(100, ptsFiable + ptsRecent + ptsSignaux + ptsPrix));
  const result = {
    total,
    fiable: Math.round(ptsFiable),
    recent: Math.round(ptsRecent),
    signaux: Math.round(ptsSignaux),
    prix: ptsPrix,
    flags,
    negCount,
    isCreme: total >= CREME_THRESHOLD,
  };
  cache.set(key, result);
  return result;
}

export function scoreColor(total) {
  if (total >= CREME_THRESHOLD) return "bg-amber-100 text-amber-800 border-amber-300";
  if (total >= 55) return "bg-blue-50 text-blue-700 border-blue-200";
  return "bg-gray-100 text-gray-500 border-gray-200";
}
