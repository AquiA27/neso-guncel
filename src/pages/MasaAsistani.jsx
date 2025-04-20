import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useParams } from "react-router-dom";

const synth = window.speechSynthesis;
const recognition = window.SpeechRecognition || window.webkitSpeechRecognition;

function MasaAsistani() {
  const { masaId } = useParams();
  const [mesaj, setMesaj] = useState("");
  const [yanit, setYanit] = useState("");
  const [gecmis, setGecmis] = useState([]);
  const [loading, setLoading] = useState(false);
  const [micActive, setMicActive] = useState(false);
  const [voicesReady, setVoicesReady] = useState(false);
  const [audioOynuyor, setAudioOynuyor] = useState(false);
  const audioRef = useRef(null);
  const mesajKutusuRef = useRef(null);

  useEffect(() => {
    console.log("🎙️ Sesli MasaAsistani aktif");

    const handleVoicesChanged = () => {
      setVoicesReady(true);
    };

    synth.onvoiceschanged = handleVoicesChanged;
    if (synth.getVoices().length > 0) setVoicesReady(true);

    return () => {
      synth.onvoiceschanged = null;
    };
  }, []);

  useEffect(() => {
    if (mesajKutusuRef.current) {
      mesajKutusuRef.current.scrollTop = mesajKutusuRef.current.scrollHeight;
    }
  }, [gecmis]);

  const gonder = async () => {
    if (!mesaj) return;
    setLoading(true);
    try {
      const res = await axios.post(`${process.env.REACT_APP_API_BASE}/yanitla`, {
        text: mesaj,
        masa: masaId,
      });
      const reply = res.data.reply;
      setYanit(reply);
      setGecmis([...gecmis, { soru: mesaj, cevap: reply }]);
      await sesliYanıtVer(reply);

      // 🎯 Siparişi backend'e kaydet
      await axios.post(`${process.env.REACT_APP_API_BASE}/siparis-ekle`, {
        masa: masaId,
        istek: mesaj,
        yanit: reply,
        sepet: [],
      });

    } catch (err) {
      console.error("🛑 Hata:", err);
      setYanit("🛑 Sunucuya ulaşılamadı.");
    }
    setMesaj("");
    setLoading(false);
  };

  const sesliYanıtVer = async (text) => {
    try {
      const res = await axios.post(
        `${process.env.REACT_APP_API_BASE}/sesli-yanit`,
        { text },
        { responseType: "arraybuffer" }
      );
      const blob = new Blob([res.data], { type: "audio/mpeg" });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.play();
      setAudioOynuyor(true);
      audio.onended = () => setAudioOynuyor(false);
    } catch (err) {
      console.error("🎧 Sesli yanıt alınamadı:", err);
    }
  };

  const sesiDinle = () => {
    if (!recognition) {
      alert("Tarayıcınız ses tanımıyor.");
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
      setTimeout(gonder, 500);
    };

    recog.onerror = (e) => {
      console.error("🎤 Mikrofon hatası:", e.error);
      setMicActive(false);
    };
  };

  const durdur = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setAudioOynuyor(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 flex items-center justify-center px-4 py-8 sm:py-12">
      <div className="backdrop-blur-md bg-white/10 shadow-2xl rounded-3xl p-4 sm:p-8 w-full max-w-md sm:max-w-xl text-white border border-white/30">
        <div className="text-center mb-6">
          <h1 className="text-3xl sm:text-4xl font-extrabold drop-shadow-lg animate-pulse">
            🎙️ Neso Asistan
          </h1>
          <p className="text-sm mt-1 opacity-80">
            Masa No: <span className="font-bold">{masaId}</span>
          </p>
        </div>

        <div className="mb-4">
          <label className="block text-base sm:text-lg font-semibold mb-1">🗣️ Mesajınız</label>
          <input
            type="text"
            value={mesaj}
            onChange={(e) => setMesaj(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && gonder()}
            placeholder="Konuş ya da yazın..."
            className="w-full p-3 rounded-xl bg-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white focus:bg-white/30"
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-3">
          <button
            onClick={gonder}
            disabled={loading}
            className="w-full sm:flex-1 bg-white/20 hover:bg-white/40 text-white font-bold py-2 px-4 rounded-xl transition duration-300 ease-in-out"
          >
            {loading ? "⏳ Bekleniyor..." : "🚀 Gönder"}
          </button>

          <button
            onClick={sesiDinle}
            className={`w-full sm:flex-1 ${micActive ? "bg-red-500" : "bg-white/20"} hover:bg-white/40 text-white font-bold py-2 px-4 rounded-xl transition duration-300 ease-in-out`}
          >
            🎤 Dinle
          </button>
        </div>

        <button
          onClick={durdur}
          className={`w-full font-bold py-2 px-4 rounded-xl transition duration-300 ease-in-out mb-4 ${
            audioOynuyor ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-white/10 text-white/40 cursor-not-allowed'
          }`}
          disabled={!audioOynuyor}
        >
          🛑 Konuşmayı Durdur
        </button>

        <div ref={mesajKutusuRef} className="max-h-64 overflow-y-auto space-y-4 bg-white/10 p-3 rounded-xl">
          {gecmis.map((g, i) => (
            <div key={i} className="space-y-1">
              <div className="bg-white/20 p-2 rounded-xl text-sm">
                🧑‍💼 <span className="font-semibold">Siz:</span> {g.soru}
              </div>
              <div className="bg-white/30 p-2 rounded-xl text-sm">
                🤖 <span className="font-semibold">Neso:</span> {g.cevap}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 text-center text-xs text-white/60">
          ☕ Neso Asistan © {new Date().getFullYear()} | Sesli destek aktif
        </div>
      </div>
    </div>
  );
}

export default MasaAsistani;