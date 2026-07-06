import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, Sparkles } from "lucide-react";
import { askAssistant, hasApiKey } from "../lib/assistant.js";

const SUGGESTIONS = [
  "Itinéraire d'une journée à Camps Bay avec budget",
  "Meilleurs restaurants indiens à Durban",
  "Journée culture + café à Maboneng, coût estimé ?",
];

// Mise en forme légère du markdown renvoyé par le modèle (gras + listes)
function renderText(text) {
  return text.split("\n").map((line, i) => {
    const parts = line.split(/\*\*(.+?)\*\*/g).map((seg, j) =>
      j % 2 === 1 ? <strong key={j}>{seg}</strong> : seg
    );
    const isBullet = /^\s*[-*•]\s+/.test(line);
    return (
      <p key={i} className={`${isBullet ? "pl-3" : ""} ${line.trim() === "" ? "h-2" : ""}`}>
        {isBullet ? "• " + line.replace(/^\s*[-*•]\s+/, "") : parts.length ? parts : line}
      </p>
    );
  });
}

export default function ChatWidget({ cities, activeCityId }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, open]);

  const send = async (text) => {
    const question = (text ?? input).trim();
    if (!question || loading) return;
    setInput("");
    const history = messages.filter((m) => m.role !== "error");
    setMessages((prev) => [...prev, { role: "user", text: question }]);
    setLoading(true);
    try {
      const answer = await askAssistant({ question, history, cities, activeCityId });
      setMessages((prev) => [...prev, { role: "model", text: answer }]);
    } catch (e) {
      setMessages((prev) => [...prev, { role: "error", text: e.message }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Bulle flottante */}
      <button
        onClick={() => setOpen((o) => !o)}
        title="Assistant voyage"
        className="fixed bottom-5 right-5 z-40 flex items-center justify-center w-14 h-14 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg transition-colors"
      >
        {open ? <X size={24} /> : <MessageCircle size={24} />}
      </button>

      {/* Panneau de chat */}
      {open && (
        <div className="fixed bottom-24 right-5 z-40 w-[min(420px,calc(100vw-2.5rem))] h-[min(600px,calc(100vh-8rem))] flex flex-col bg-white rounded-2xl border border-gray-200 shadow-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 bg-indigo-600 text-white">
            <Sparkles size={18} />
            <div className="flex-1">
              <p className="text-sm font-semibold leading-tight">Assistant voyage</p>
              <p className="text-[11px] text-indigo-200 leading-tight">
                Itinéraires & budgets à partir de vos données
              </p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-gray-50">
            {messages.length === 0 && (
              <div className="space-y-2">
                <p className="text-sm text-gray-500">
                  Posez une question sur vos lieux : itinéraire d'une journée, budget estimé,
                  meilleurs choix par zone ou catégorie...
                </p>
                {!hasApiKey() && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
                    ⚠️ Aucune clé API détectée. Créez une clé gratuite sur{" "}
                    <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" className="underline">
                      openrouter.ai/keys
                    </a>
                    , copiez <code>.env.example</code> en <code>.env</code>, renseignez{" "}
                    <code>VITE_OPENROUTER_API_KEY</code> et relancez <code>npm run dev</code>.
                  </p>
                )}
                <div className="flex flex-col gap-1.5 pt-1">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="text-left text-xs px-3 py-2 rounded-lg border border-indigo-100 bg-white text-indigo-700 hover:bg-indigo-50"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-indigo-600 text-white rounded-br-sm"
                      : m.role === "error"
                      ? "bg-red-50 text-red-700 border border-red-200"
                      : "bg-white text-gray-800 border border-gray-200 rounded-bl-sm"
                  }`}
                >
                  {m.role === "model" ? renderText(m.text) : m.text}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="px-4 py-3 rounded-2xl bg-white border border-gray-200 text-gray-400 text-sm">
                  <span className="animate-pulse">Je consulte vos lieux...</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="flex items-center gap-2 p-3 border-t border-gray-100 bg-white"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ex : itinéraire à Sea Point avec budget..."
              className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="flex items-center justify-center w-9 h-9 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-40"
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
