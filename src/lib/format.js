// Types techniques à masquer dans l'affichage compact
export const HIDDEN_TYPES = new Set([
  "point_of_interest",
  "establishment",
  "food",
  "store",
  "service",
]);

export const formatType = (t) =>
  t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export const PRICE_LEVELS = {
  PRICE_LEVEL_INEXPENSIVE: { label: "€", text: "Bon marché", color: "bg-green-100 text-green-700" },
  PRICE_LEVEL_MODERATE: { label: "€€", text: "Modéré", color: "bg-amber-100 text-amber-700" },
  PRICE_LEVEL_EXPENSIVE: { label: "€€€", text: "Cher", color: "bg-orange-100 text-orange-700" },
  PRICE_LEVEL_VERY_EXPENSIVE: { label: "€€€€", text: "Très cher", color: "bg-red-100 text-red-700" },
};

export const formatPriceRange = (pr) => {
  if (!pr?.startPrice) return null;
  const cur = pr.startPrice.currencyCode || "";
  const start = pr.startPrice.units ?? "?";
  const end = pr.endPrice?.units;
  return end ? `${start}–${end} ${cur}` : `dès ${start} ${cur}`;
};

export const priceStart = (place) => {
  const v = Number(place.price_range?.startPrice?.units);
  return Number.isNaN(v) ? null : v;
};

export const formatDate = (iso) => {
  try {
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
};

// Identifiant stable d'un lieu (utilisé pour la déduplication)
export const placeKey = (p) => `${p.name}::${p.address || ""}`;
