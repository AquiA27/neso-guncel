// MasaAsistani.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";
import { useParams } from "react-router-dom";

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = SpeechRecognition ? new SpeechRecognition() : null;

function MasaAsistani() {
  const { masaId } = useParams();
  const [mesaj, setMesaj] = useState("");
  const [yanit, setYanit] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);

  useEffect(() => {
    if (!recognition) return;
    recognition.continuous = false;
    recognition.lang = "tr-TR";

    recognition.onresult = (event) => {
      const text = event.results[0][0].transcript;
      setMesaj(text);
      setListening(false);
      gonder(text);
    };

    recognition.onend = () => {
      setListening(false);
    };
  }, []);

  const gonder = async (textOverride = null) => {
    const gonderilecek = textOverride || mesaj;
    if (!gonderilecek) return;
    setLoading(true);
    try {
      const res = await axios.post("https://neso-backend-clean.onrender.com/neso", {
        text: gonderilecek,
        masa: masaId,
      });
      setYanit(res.data.reply);
      speak(res.data.reply);
    } catch (err) {
      setYanit("🛑 Sunucuya ulaşılamadı.");
    }
    setLoading(false);
  };

  const baslaDinle = () => {
    if (!recognition) return alert("Tarayıcınız ses tanımayı desteklemiyor.");
    setListening(true);
    setMesaj("");
    recognition.start();
  };

  const speak = (text) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "tr-TR";
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 flex items-center justify-center px-4 py-12">
      <div className="backdrop-blur-md bg-white/10 shadow-2xl rounded-3xl p-8 max-w-xl w-full text-white border border-white/30">
        <div className="text-center mb-6">
          <h1 className="text-4xl font-extrabold drop-shadow-lg animate-pulse">🎙️ Neso Asistan</h1>
          <p className="text-sm mt-1 opacity-80">Masa No: <span className="font-bold">{masaId}</span></p>
        </div>

        <div className="mb-4">
          <label className="block text-lg font-semibold mb-1">🗣️ Mesajınız</label>
          <input
            type="text"
            value={mesaj}
            onChange={(e) => setMesaj(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && gonder()}
            placeholder="Söyleyin ya da yazın..."
            className="w-full p-3 rounded-xl bg-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white focus:bg-white/30"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => gonder()}
            disabled={loading}
            className="w-full mt-2 bg-white/20 hover:bg-white/40 text-white font-bold py-2 px-4 rounded-xl transition duration-300 ease-in-out"
          >
            {loading ? "🎧 Neso düşünüyor..." : "🚀 Gönder"}
          </button>
          <button
            onClick={baslaDinle}
            disabled={listening}
            className={`w-full mt-2 ${listening ? "bg-green-500 animate-pulse" : "bg-white/20 hover:bg-white/40"} text-white font-bold py-2 px-4 rounded-xl`}
          >
            {listening ? "🎙️ Dinleniyor..." : "🎤 Sesli"}
          </button>
        </div>

        {mesaj && (
          <div className="mt-6 text-sm">
            <p className="mb-1 text-white/70">🎤 <span className="font-semibold">Algılanan:</span> {mesaj}</p>
            <p className="mt-2 text-white/90 text-lg">
              🤖 <span className="font-semibold">Neso'nun Yanıtı:</span> {yanit}
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