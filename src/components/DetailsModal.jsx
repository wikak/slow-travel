import { X, MapPin, Tag, MessageSquare, Video, ExternalLink } from "lucide-react";
import { computeScore, scoreColor } from "../lib/score.js";
import { formatDate } from "../lib/format.js";
import { Stars, TypeBadges, PriceInfo } from "./Shared.jsx";

function ScoreBreakdown({ place }) {
  const s = computeScore(place);
  const rows = [
    ["Note fiabilisée (volume d'avis)", s.fiable, 40],
    ["Avis des 12 derniers mois", s.recent, 25],
    ["Service · ambiance · qualité-prix", s.signaux, 25],
    ["Accessibilité prix", s.prix, 10],
  ];
  return (
    <section>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Score voyageur</h3>
      <div className={`rounded-xl border p-3 ${s.isCreme ? "border-amber-300 bg-amber-50" : "border-gray-100 bg-gray-50"}`}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-bold text-gray-800">
            {s.isCreme ? "🏆 Crème de la crème" : "Score global"}
          </span>
          <span className={`px-2 py-0.5 rounded-full border text-sm font-bold ${scoreColor(s.total)}`}>
            {s.total}/100
          </span>
        </div>
        <div className="space-y-2 sm:space-y-1.5">
          {rows.map(([label, val, max]) => (
            <div key={label} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2 text-xs">
              <span className="sm:w-56 sm:shrink-0 text-gray-600">{label}</span>
              <div className="flex items-center gap-2 sm:flex-1">
                <div className="flex-1 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                  <div className="h-full bg-indigo-500" style={{ width: `${(val / max) * 100}%` }} />
                </div>
                <span className="w-12 shrink-0 text-right text-gray-500">{val}/{max}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {s.flags.service && <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs">✓ Service salué</span>}
          {s.flags.ambiance && <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs">✓ Bonne ambiance</span>}
          {s.flags.qualitePrix && <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs">✓ Bon rapport qualité-prix</span>}
          {s.negCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs">
              ⚠ {s.negCount} avis récent{s.negCount > 1 ? "s" : ""} ≤ 2★
            </span>
          )}
        </div>
      </div>
    </section>
  );
}

export default function DetailsModal({ place, onClose }) {
  if (!place) return null;
  const reviews = place.reviews_last_12_months || [];
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${place.name} ${place.address || ""}`.trim()
  )}`;
  // Recherche Google "nom + ville tiktok" : sur mobile, tiktok.com/search ouvre
  // l'app et bute sur un mur de connexion ; Google reste dans le navigateur.
  const tiktokUrl = `https://www.google.com/search?q=${encodeURIComponent(
    `${place.name} ${place.city_full || place.city || ""} tiktok`.trim()
  )}`;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between p-5 border-b border-gray-100">
          <div className="pr-4">
            <h2 className="text-xl font-bold text-gray-900">{place.name}</h2>
            <div className="mt-1 flex items-center gap-2 text-sm text-gray-500">
              <Stars rating={place.global_rating} />
              <span>· {place.total_ratings_count?.toLocaleString("fr-FR")} avis</span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 text-gray-500">
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-5">
          {/* Actions bien visibles : itinéraire Maps (principal) + vidéos TikTok */}
          <div className="flex flex-wrap gap-2">
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold shadow-sm hover:bg-indigo-700 transition-colors"
            >
              <MapPin size={16} /> Ouvrir dans Google Maps
              <ExternalLink size={14} className="opacity-70" />
            </a>
            <a
              href={tiktokUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-semibold hover:border-pink-300 hover:text-pink-600 transition-colors"
            >
              <Video size={16} /> Vidéos TikTok
              <ExternalLink size={14} className="opacity-70" />
            </a>
          </div>

          <ScoreBreakdown place={place} />

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Prix</h3>
            <PriceInfo place={place} detailed />
          </section>

          {place.address && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Adresse</h3>
              <p className="flex items-start gap-2 text-sm text-gray-700">
                <MapPin size={16} className="mt-0.5 shrink-0 text-indigo-500" /> {place.address}
              </p>
            </section>
          )}

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2 flex items-center gap-1">
              <Tag size={12} /> Types
            </h3>
            <TypeBadges types={place.types || []} max={0} compact={false} />
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2 flex items-center gap-1">
              <MessageSquare size={12} /> Avis des 12 derniers mois ({reviews.length})
            </h3>
            {reviews.length === 0 ? (
              <p className="text-sm text-gray-400 italic">Aucun avis récent.</p>
            ) : (
              <div className="space-y-3">
                {reviews.map((r, i) => (
                  <div key={i} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-gray-800 truncate">{r.author}</span>
                      <span className="text-xs text-gray-400 shrink-0">{formatDate(r.publish_time)}</span>
                    </div>
                    <div className="mt-0.5"><Stars rating={r.rating} /></div>
                    {r.text && <p className="mt-2 text-sm text-gray-600 whitespace-pre-line">{r.text}</p>}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
