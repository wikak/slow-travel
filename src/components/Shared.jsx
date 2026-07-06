import { Star, Banknote } from "lucide-react";
import { HIDDEN_TYPES, formatType, PRICE_LEVELS, formatPriceRange } from "../lib/format.js";

export function Stars({ rating }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="flex">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            size={14}
            className={i <= Math.round(rating) ? "text-yellow-400 fill-yellow-400" : "text-gray-300"}
          />
        ))}
      </span>
      <span className="text-sm font-semibold text-gray-700">{rating}</span>
    </span>
  );
}

export function TypeBadges({ types, max = 3, compact = true }) {
  const visible = compact ? types.filter((t) => !HIDDEN_TYPES.has(t)) : types;
  const shown = max ? visible.slice(0, max) : visible;
  const extra = visible.length - shown.length;
  return (
    <div className="flex flex-wrap gap-1">
      {shown.map((t) => (
        <span key={t} className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-medium">
          {formatType(t)}
        </span>
      ))}
      {extra > 0 && (
        <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-xs">+{extra}</span>
      )}
    </div>
  );
}

export function PriceInfo({ place, detailed = false }) {
  const lvl = PRICE_LEVELS[place.price_level];
  const range = formatPriceRange(place.price_range);
  if (!lvl && !range) return <span className="text-xs text-gray-400 italic">Prix non renseigné</span>;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {lvl && (
        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${lvl.color}`} title={lvl.text}>
          {lvl.label}{detailed ? ` · ${lvl.text}` : ""}
        </span>
      )}
      {range && (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
          <Banknote size={12} /> {range}
        </span>
      )}
    </div>
  );
}
