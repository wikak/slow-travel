import { useState } from "react";
import CityView from "./components/CityView.jsx";
import DetailsModal from "./components/DetailsModal.jsx";
import ChatWidget from "./components/ChatWidget.jsx";

// Données chargées depuis les assets — aucun upload nécessaire.
// Remplacez simplement le contenu de ces fichiers par vos exports complets.
import jhbData from "./assets/data/jhb.json";
import dbnData from "./assets/data/dbn.json";
import cptData from "./assets/data/cpt.json";

const CITIES = [
  { id: "JHB", label: "JHB", full: "Johannesburg", data: jhbData },
  { id: "DBN", label: "DBN", full: "Durban", data: dbnData },
  { id: "CPT", label: "CPT", full: "Cape Town", data: cptData },
];

export default function App() {
  const [activeTab, setActiveTab] = useState("JHB");
  const [selectedPlace, setSelectedPlace] = useState(null);

  const city = CITIES.find((c) => c.id === activeTab);

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <header className="mb-5">
          <h1 className="text-2xl font-bold text-gray-900">Explorateur de lieux</h1>
          <p className="text-sm text-gray-500">
            Restaurants, cafés, galeries et attractions — la crème de la crème pour vos vacances
          </p>
        </header>

        {/* Onglets villes */}
        <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
          {CITIES.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveTab(c.id)}
              className={`px-6 py-2 rounded-lg text-sm font-semibold transition-colors ${
                activeTab === c.id
                  ? "bg-white text-indigo-700 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
              title={c.full}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* key={city.id} : réinitialise les filtres quand on change de ville */}
        <CityView key={city.id} data={city.data} onDetails={setSelectedPlace} />
      </div>

      <DetailsModal place={selectedPlace} onClose={() => setSelectedPlace(null)} />
      <ChatWidget cities={CITIES} activeCityId={activeTab} />
    </div>
  );
}
