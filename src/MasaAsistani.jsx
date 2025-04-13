import React, { useState, useEffect } from "react";
import axios from "axios";
import { useParams } from "react-router-dom";

const synth = window.speechSynthesis;
const recognition = window.SpeechRecognition || window.webkitSpeechRecognition;

function MasaAsistani() {
  const { masaId } = useParams();
  const [mesaj, setMesaj] = useState("");
  const [yanit, setYanit] = useState("");
  const [loading, setLoading] = useState(false);
  const [micActive, setMicActive] = useState(false);

  useEffect(() => {
    console.log("🎙️ Sesli MasaAsistani aktif");

    if (synth.onvoiceschanged !== undefined) {
      synth.onvoiceschanged = () => {
        synth.getVoices(); // Sesleri yükle
      };
    }
  }, []);

  const gonder = async () => {
    if (!mesaj) return;
    setLoading(true);
    try {
      const res = await axios.post(`${process.env.REACT_APP_API_BASE}/neso`, {
        text: mesaj,
        masa: masaId,
      });
      const reply = res.data.reply;
      setYanit(reply);
      sesliYanıtVer(reply);
    } catch (err) {
      setYanit("🛑 Sunucuya ulaşılamadı.");
    }
    setLoading(false);
  };

  const sesliYanıtVer = (text) => {
    const temizlenmis = text.replace(/☕️|🍵|🥤/g, ""); // Emojileri sil
    const utterance = new SpeechSynthesisUtterance(temizlenmis);
    utterance.lang = "tr-TR";
    utterance.pitch = 1.3;
    utterance.rate = 0.95;

    const voices = synth.getVoices();
    const femaleVoice = voices.find(
      (v) =>
        v.lang === "tr-TR" &&
        v.name.toLowerCase().includes("google") &&
        v.name.toLowerCase().includes("female")
    );

    if (femaleVoice) {
      utterance.voice = femaleVoice;
      synth.speak(utterance);
    } else {
      synth.onvoiceschanged = () => {
        const updated = synth.getVoices().find((v) => v.lang === "tr-TR");
        if (updated) {
          utterance.voice = updated;
          synth.speak(utterance);
        }
      };
    }
  };

  const sesiDinle = () => {
    if (!recognition) {
      alert("Tarayıcınız ses tanımıyor olabilir.");
      return;
    }

    const recog = new recognition();
    recog.lang = "tr-TR";
    recog.start();
    setMicActive(true);

    recog.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setMesaj(transcript);
      setMicActive(false);
      setTimeout(gonder, 300);
    };

    recog.onerror = (e) => {
      console.error("🎤 Mikrofon hatası:", e.error);
      setMicActive(false);
    };
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
            placeholder="Konuş ya da yazın..."
            className="w-full p-3 rounded-xl bg-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white focus:bg-white/30"
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={gonder}
            disabled={loading}
            className="flex-1 bg-white/20 hover:bg-white/40 text-white font-bold py-2 px-4 rounded-xl transition duration-300 ease-in-out"
          >
            {loading ? "⏳ Bekleniyor..." : "🚀 Gönder"}
          </button>

          <button
            onClick={sesiDinle}
            className={`flex-1 ${
              micActive ? "bg-red-500" : "bg-white/20"
            } hover:bg-white/40 text-white font-bold py-2 px-4 rounded-xl transition duration-300 ease-in-out`}
          >
            🎤 Dinle
          </button>
        </div>

        {yanit && (
          <div className="mt-6 text-sm">
            <p className="text-white/70 mb-1">
              📨 <span className="font-semibold">Mesajınız:</span> {mesaj}
            </p>
            <p className="mt-2 text-white/90 text-lg">
              🤖 <span className="font-semibold">Neso:</span>{" "}
              <span className="animate-fadeIn">{yanit}</span>
            </p>
          </div>
        )}

        <div className="mt-8 text-center text-xs text-white/60">
          ☕ Neso Asistan © {new Date().getFullYear()} | Sesli destek aktif
        </div>
      </div>
    </div>
  );
}

export default MasaAsistani;
