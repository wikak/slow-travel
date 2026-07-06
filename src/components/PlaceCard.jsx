import { computeScore, scoreColor } from "../lib/score.js";
import { Stars, TypeBadges, PriceInfo } from "./Shared.jsx";

export default function PlaceCard({ place, onDetails }) {
  const score = computeScore(place);
  return (
    <div
      className={`bg-white rounded-xl border shadow-sm hover:shadow-md transition-shadow p-4 flex flex-col gap-2 ${
        score.isCreme ? "border-amber-300 ring-1 ring-amber-200" : "border-gray-100"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-semibold text-gray-900 leading-snug">{place.name}</h4>
        <span
          className={`shrink-0 px-2 py-0.5 rounded-full border text-xs font-bold ${scoreColor(score.total)}`}
          title="Score voyageur : note fiabilisée + avis récents + service/ambiance/prix"
        >
          {score.isCreme && "🏆 "}{score.total}
        </span>
      </div>
      <Stars rating={place.global_rating} />
      <TypeBadges types={place.types || []} />
      <PriceInfo place={place} />
      {place.address && (
        <p className="text-xs italic text-gray-400 leading-snug">{place.address}</p>
      )}
      <button
        onClick={() => onDetails(place)}
        className="mt-auto self-start px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors"
      >
        Détails
      </button>
    </div>
  );
}
