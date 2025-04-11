import React, { useState } from "react";
import axios from "axios";
import { useParams } from "react-router-dom";

function MasaAsistani() {
  console.log("🔥 Cafcaflı MasaAsistani Yüklendi");

  const { masaId } = useParams();
  const [mesaj, setMesaj] = useState("");
  const [yanit, setYanit] = useState("");
  const [loading, setLoading] = useState(false);

  const gonder = async () => {
    if (!mesaj) return;
    setLoading(true);
    try {
      const res = await axios.post("https://neso-backend-clean.onrender.com/neso", {
        text: mesaj,
        masa: masaId,
      });
      setYanit(res.data.reply);
    } catch (err) {
      setYanit("🛑 Sunucuya ulaşılamadı.");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 flex items-center justify-center px-4 py-12">
      <div className="backdrop-blur-md bg-white/10 shadow-2xl rounded-3xl p-8 max-w-xl w-full text-white border border-white/30">
        <div className="text-center mb-6">
          <h1 className="text-4xl font-extrabold drop-shadow-lg animate-pulse">
            🎙️ Neso Asistan
          </h1>
          <p className="text-sm mt-1 opacity-80">
            Masa No: <span className="font-bold">{masaId}</span>
          </p>
        </div>

        <div className="mb-4">
          <label className="block text-lg font-semibold mb-1">🗣️ Mesajınız</label>
          <input
            type="text"
            value={mesaj}
            onChange={(e) => setMesaj(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && gonder()}
            placeholder="Örn: 1 çay 1 latte veya ne içmeliyim?"
            className="w-full p-3 rounded-xl bg-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white focus:bg-white/30"
          />
        </div>

        <button
          onClick={gonder}
          disabled={loading}
          className="w-full mt-2 bg-white/20 hover:bg-white/40 text-white font-bold py-2 px-4 rounded-xl transition duration-300 ease-in-out"
        >
          {loading ? "🎧 Neso düşünüyor..." : "🚀 Gönder"}
        </button>

        {mesaj && (
          <div className="mt-6 text-sm">
            <p className="mb-1 text-white/70">
              🎤 <span className="font-semibold">Algılanan:</span> {mesaj}
            </p>
            <p className="mt-2 text-white/90 text-lg">
              🤖 <span className="font-semibold">Neso'nun Yanıtı:</span>{" "}
              <span className="animate-fadeIn">{yanit}</span>
            </p>
          </div>
        )}

        <div className="mt-8 text-center text-xs text-white/60">
          ☕ Neso Asistan © {new Date().getFullYear()} | Hayatın tadı burada çıkar
        </div>
      </div>
    </div>
  );
}

export default MasaAsistani;
