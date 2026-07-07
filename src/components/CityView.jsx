import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Search, SlidersHorizontal, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";
import PlaceCard from "./PlaceCard.jsx";
import { computeScore } from "../lib/score.js";
import { placeKey, priceStart } from "../lib/format.js";

const PAGE_SIZE = 12; // lieux affichés par page

const DEFAULT_FILTERS = {
  zones: [],            // [] = toutes les zones ; l'ordre de sélection = ordre de l'itinéraire
  categories: [],       // [] = toutes les catégories
  query: "",            // recherche sur le nom et les types
  minRating: 0,         // note Google minimale
  minReviews: 0,        // nombre d'avis minimal
  priceLevel: "",       // niveau de prix Google
  maxBudget: "",        // budget max (startPrice, en ZAR)
  cremeOnly: false,     // score >= seuil
  wantService: false,   // service salué dans les avis
  wantAmbiance: false,  // ambiance saluée
  wantQP: false,        // qualité-prix salué
  sort: "score",        // score | rating | reviews | price
};

// Persistance des filtres dans localStorage, par ville.
const filtersKey = (cityId) => `places-explorer:filters:${cityId}`;

function loadFilters(cityId) {
  try {
    const raw = localStorage.getItem(filtersKey(cityId));
    if (!raw) return DEFAULT_FILTERS;
    // Fusion avec les valeurs par défaut : tolère les anciens formats/clés manquantes.
    return { ...DEFAULT_FILTERS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_FILTERS;
  }
}

function saveFilters(cityId, f) {
  try {
    if (JSON.stringify(f) === JSON.stringify(DEFAULT_FILTERS)) {
      localStorage.removeItem(filtersKey(cityId));
    } else {
      localStorage.setItem(filtersKey(cityId), JSON.stringify(f));
    }
  } catch {
    // stockage indisponible (mode privé, quota) — on ignore silencieusement
  }
}

function Select({ label, value, onChange, children }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-gray-500">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-2 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        {children}
      </select>
    </label>
  );
}

// Liste déroulante à cases à cocher (plusieurs valeurs possibles).
// L'ordre de sélection est conservé : il définit l'ordre de l'itinéraire.
function MultiSelect({ label, options, values, onChange, allLabel = "Toutes" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const toggle = (opt) =>
    onChange(values.includes(opt) ? values.filter((v) => v !== opt) : [...values, opt]);

  const summary =
    values.length === 0 ? allLabel : values.length === 1 ? values[0] : `${values.length} sélections`;

  return (
    <div ref={ref} className="relative flex flex-col gap-1 text-xs font-medium text-gray-500">
      {label}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`px-2 py-2 rounded-lg border bg-white text-sm text-left truncate focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
          values.length > 0 ? "border-indigo-300 text-indigo-700 font-semibold" : "border-gray-200 text-gray-700"
        }`}
      >
        {summary}
      </button>
      {open && (
        <div className="absolute top-full left-0 z-20 mt-1 min-w-full w-56 max-h-64 overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg p-1">
          <button
            type="button"
            onClick={() => onChange([])}
            className="w-full text-left px-2 py-1.5 rounded text-sm text-gray-500 hover:bg-gray-50"
          >
            {allLabel} (tout effacer)
          </button>
          {options.map((opt) => {
            const idx = values.indexOf(opt);
            return (
              <label
                key={opt}
                className="flex items-center gap-2 px-2 py-1.5 rounded text-sm text-gray-700 hover:bg-indigo-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={idx !== -1}
                  onChange={() => toggle(opt)}
                  className="accent-indigo-600"
                />
                <span className="truncate flex-1">{opt}</span>
                {idx !== -1 && values.length > 1 && (
                  <span className="shrink-0 flex items-center justify-center w-4 h-4 rounded-full bg-indigo-600 text-white text-[10px] font-bold">
                    {idx + 1}
                  </span>
                )}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Toggle({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
        active
          ? "bg-indigo-600 border-indigo-600 text-white"
          : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
      }`}
    >
      {children}
    </button>
  );
}

export default function CityView({ cityId, data, onDetails }) {
  const zones = Object.keys(data);
  const [f, setF] = useState(() => loadFilters(cityId));
  const [page, setPage] = useState(1);
  const set = (patch) => setF((prev) => ({ ...prev, ...patch }));

  // Sauvegarde des filtres à chaque changement (par ville).
  useEffect(() => {
    saveFilters(cityId, f);
  }, [cityId, f]);

  // Catégories disponibles selon les zones choisies
  const categories = useMemo(() => {
    const src = f.zones.length > 0 ? f.zones : zones;
    const s = new Set();
    src.forEach((z) => {
      Object.entries(data[z] || {}).forEach(([cat, arr]) => {
        if ((arr || []).length > 0) s.add(cat);
      });
    });
    return [...s];
  }, [data, f.zones, zones]);

  // Retirer les catégories sélectionnées qui n'existent plus dans les zones choisies
  useEffect(() => {
    setF((prev) => {
      const kept = prev.categories.filter((c) => categories.includes(c));
      return kept.length === prev.categories.length ? prev : { ...prev, categories: kept };
    });
  }, [categories]);

  // Liste filtrée + triée (tous les critères combinés)
  const places = useMemo(() => {
    // 1. Collecte + déduplication (un lieu peut apparaître dans plusieurs catégories)
    const seen = new Map();
    const srcZones = f.zones.length > 0 ? f.zones : zones;
    srcZones.forEach((z) => {
      Object.entries(data[z] || {}).forEach(([cat, arr]) => {
        if (f.categories.length > 0 && !f.categories.includes(cat)) return;
        (arr || []).forEach((p) => {
          const key = placeKey(p);
          if (!seen.has(key)) seen.set(key, { ...p, _zone: z, _cats: [cat] });
          else seen.get(key)._cats.push(cat);
        });
      });
    });
    let list = [...seen.values()];

    // 2. Critères
    if (f.query.trim()) {
      const q = f.query.toLowerCase();
      list = list.filter(
        (p) =>
          p.name?.toLowerCase().includes(q) ||
          (p.types || []).some((t) => t.replace(/_/g, " ").includes(q))
      );
    }
    if (f.minRating > 0) list = list.filter((p) => (p.global_rating || 0) >= f.minRating);
    if (f.minReviews > 0) list = list.filter((p) => (p.total_ratings_count || 0) >= f.minReviews);
    if (f.priceLevel) list = list.filter((p) => p.price_level === f.priceLevel);
    if (f.maxBudget !== "" && !Number.isNaN(Number(f.maxBudget))) {
      list = list.filter((p) => {
        const s = priceStart(p);
        return s === null || s <= Number(f.maxBudget);
      });
    }
    if (f.cremeOnly) list = list.filter((p) => computeScore(p).isCreme);
    if (f.wantService) list = list.filter((p) => computeScore(p).flags.service);
    if (f.wantAmbiance) list = list.filter((p) => computeScore(p).flags.ambiance);
    if (f.wantQP) list = list.filter((p) => computeScore(p).flags.qualitePrix);

    // 3. Tri
    const sorters = {
      score: (a, b) => computeScore(b).total - computeScore(a).total,
      rating: (a, b) => (b.global_rating || 0) - (a.global_rating || 0),
      reviews: (a, b) => (b.total_ratings_count || 0) - (a.total_ratings_count || 0),
      price: (a, b) => (priceStart(a) ?? Infinity) - (priceStart(b) ?? Infinity),
    };
    const base = sorters[f.sort] || sorters.score;
    // Mode itinéraire : les lieux suivent l'ordre des zones sélectionnées
    if (f.zones.length > 1) {
      return list.sort(
        (a, b) => f.zones.indexOf(a._zone) - f.zones.indexOf(b._zone) || base(a, b)
      );
    }
    return list.sort(base);
  }, [data, zones, f]);

  const isFiltered = JSON.stringify(f) !== JSON.stringify(DEFAULT_FILTERS);

  // Revenir à la page 1 dès que les critères changent
  useEffect(() => {
    setPage(1);
  }, [f]);

  const totalPages = Math.max(1, Math.ceil(places.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedPlaces = useMemo(
    () => places.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [places, currentPage]
  );

  return (
    <div className="space-y-4">
      {/* -------- Barre de critères -------- */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <SlidersHorizontal size={16} /> Critères de recherche
          </span>
          {isFiltered && (
            <button
              onClick={() => setF(DEFAULT_FILTERS)}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500"
            >
              <RotateCcw size={12} /> Réinitialiser
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <MultiSelect
            label="Zones"
            options={zones}
            values={f.zones}
            onChange={(vals) => set({ zones: vals })}
          />

          <MultiSelect
            label="Catégories"
            options={categories}
            values={f.categories}
            onChange={(vals) => set({ categories: vals })}
          />

          <Select label="Note min." value={f.minRating} onChange={(v) => set({ minRating: Number(v) })}>
            <option value="0">Toutes</option>
            <option value="4.5">≥ 4.5 ★</option>
            <option value="4.6">≥ 4.6 ★</option>
            <option value="4.7">≥ 4.7 ★</option>
            <option value="4.8">≥ 4.8 ★</option>
          </Select>

          <Select label="Avis min." value={f.minReviews} onChange={(v) => set({ minReviews: Number(v) })}>
            <option value="0">Tous</option>
            <option value="50">≥ 50</option>
            <option value="200">≥ 200</option>
            <option value="500">≥ 500</option>
            <option value="1000">≥ 1000</option>
          </Select>

          <Select label="Niveau de prix" value={f.priceLevel} onChange={(v) => set({ priceLevel: v })}>
            <option value="">Tous</option>
            <option value="PRICE_LEVEL_INEXPENSIVE">€ Bon marché</option>
            <option value="PRICE_LEVEL_MODERATE">€€ Modéré</option>
            <option value="PRICE_LEVEL_EXPENSIVE">€€€ Cher</option>
          </Select>

          <label className="flex flex-col gap-1 text-xs font-medium text-gray-500">
            Budget max (ZAR)
            <input
              type="number"
              min="0"
              step="50"
              placeholder="ex : 300"
              value={f.maxBudget}
              onChange={(e) => set({ maxBudget: e.target.value })}
              className="px-2 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </label>

          <Select label="Trier par" value={f.sort} onChange={(v) => set({ sort: v })}>
            <option value="score">Score voyageur</option>
            <option value="rating">Note Google</option>
            <option value="reviews">Nombre d'avis</option>
            <option value="price">Prix croissant</option>
          </Select>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={f.query}
              onChange={(e) => set({ query: e.target.value })}
              placeholder="Rechercher un nom ou un type (ex : pizza, indien...)"
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <button
            onClick={() => set({ cremeOnly: !f.cremeOnly })}
            className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${
              f.cremeOnly
                ? "bg-amber-400 border-amber-400 text-amber-950"
                : "bg-white border-gray-200 text-gray-600 hover:bg-amber-50"
            }`}
          >
            🏆 Crème de la crème
          </button>
          <Toggle active={f.wantService} onClick={() => set({ wantService: !f.wantService })}>
            ✓ Service salué
          </Toggle>
          <Toggle active={f.wantAmbiance} onClick={() => set({ wantAmbiance: !f.wantAmbiance })}>
            ✓ Bonne ambiance
          </Toggle>
          <Toggle active={f.wantQP} onClick={() => set({ wantQP: !f.wantQP })}>
            ✓ Qualité-prix
          </Toggle>
        </div>
      </div>

      {/* -------- Résultats -------- */}
      {f.zones.length > 1 && (
        <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2">
          🗺️ Itinéraire :
          {f.zones.map((z, i) => (
            <Fragment key={z}>
              {i > 0 && <span className="text-indigo-300">→</span>}
              <span className="px-2 py-0.5 rounded-full bg-white border border-indigo-200">
                {i + 1}. {z}
              </span>
            </Fragment>
          ))}
        </p>
      )}
      <p className="text-sm text-gray-500">
        {places.length} lieu{places.length > 1 ? "x" : ""} trouvé{places.length > 1 ? "s" : ""}
      </p>
      {places.length === 0 ? (
        <p className="text-center text-gray-400 py-10">
          Aucun lieu ne correspond à ces critères — essayez d'en assouplir un.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {pagedPlaces.map((p, i) => {
              const showZoneHeader =
                f.zones.length > 1 && (i === 0 || pagedPlaces[i - 1]._zone !== p._zone);
              return (
                <Fragment key={placeKey(p)}>
                  {showZoneHeader && (
                    <h3 className="col-span-full flex items-center gap-2 text-sm font-semibold text-indigo-700 mt-1 first:mt-0">
                      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-indigo-600 text-white text-[11px] font-bold">
                        {f.zones.indexOf(p._zone) + 1}
                      </span>
                      {p._zone}
                    </h3>
                  )}
                  <PlaceCard place={p} onDetails={onDetails} />
                </Fragment>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white"
              >
                <ChevronLeft size={16} /> Précédent
              </button>
              <span className="text-sm text-gray-500">
                Page {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white"
              >
                Suivant <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
