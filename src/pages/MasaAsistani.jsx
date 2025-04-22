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
  const [menuUrunler, setMenuUrunler] = useState([]);
  const audioRef = useRef(null);
  const mesajKutusuRef = useRef(null);

  useEffect(() => {
    console.log("🎙️ Sesli MasaAsistani aktif");
    synth.onvoiceschanged = () => setVoicesReady(true);
    if (synth.getVoices().length > 0) setVoicesReady(true);
    return () => { synth.onvoiceschanged = null; };
  }, []);

  useEffect(() => {
    document.title = `Neso Asistan - Masa ${masaId}`;
  }, [masaId]);

  useEffect(() => {
    if (mesajKutusuRef.current) {
      mesajKutusuRef.current.scrollTop = mesajKutusuRef.current.scrollHeight;
    }
  }, [gecmis]);

  useEffect(() => {
    axios.get(`${process.env.REACT_APP_API_BASE}/menu`)
      .then((res) => {
        const urunler = res.data.menu.flatMap(k => k.urunler.map(u => u.ad.toLowerCase()));
        setMenuUrunler(urunler);
      })
      .catch((err) => console.error("Menü verisi alınamadı:", err));
  }, []);

  const levenshteinDistance = (a, b) => {
    const matrix = Array.from({ length: b.length + 1 }, (_, i) =>
      Array(a.length + 1).fill(0)
    );
    for (let i = 0; i <= b.length; i++) matrix[i][0] = i;
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        const cost = a[j - 1] === b[i - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }

    return matrix[b.length][a.length];
  };

  const urunAyikla = (mesaj) => {
    const urunler = [];
    const mesajKucuk = mesaj.toLowerCase();
    const siparisIstekli = /(ver|getir|istiyorum|isterim|alabilir miyim|sipariş)/i.test(mesajKucuk);
    const temizMesaj = mesajKucuk.replace(/(\d+)([a-zçğıöşü]+)/gi, "$1 $2");
    const pattern = /(?:(\d+)\s*)?([a-zçğıöşü\s]+)/gi;

    let match;
    while ((match = pattern.exec(temizMesaj)) !== null) {
      const adet = parseInt(match[1]) || 1;
      const girilenUrun = match[2].trim();

      let urunEslesen = null;
      let minMesafe = 2;

      for (const menuUrun of menuUrunler) {
        const mesafe = levenshteinDistance(girilenUrun, menuUrun);
        if (mesafe <= minMesafe) {
          urunEslesen = menuUrun;
          minMesafe = mesafe;
        }
      }

      if (urunEslesen) {
        urunler.push({
          urun: urunEslesen.charAt(0).toUpperCase() + urunEslesen.slice(1),
          adet,
        });
      }
    }

    if (urunler.length === 0 && siparisIstekli && mesaj.trim()) {
      urunler.push({ urun: mesaj.trim(), adet: 1 });
    }

    return urunler;
  };

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

      const sepet = urunAyikla(mesaj);

      await axios.post(
        `${process.env.REACT_APP_API_BASE}/siparis-ekle`,
        {
          masa: masaId,
          istek: mesaj,
          yanit: reply,
          sepet,
        },
        {
          headers: { "Content-Type": "application/json" },
        }
      );
      console.log("✅ /siparis-ekle çağrısı yapıldı");
    } catch (err) {
      console.error("🛑 sipariş hatası:", err);
      setYanit("🛑 Sipariş gönderilemedi.");
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
          <h1 className="text-3xl sm:text-4xl font-extrabold drop-shadow-lg animate-pulse">🎙️ Neso Asistan</h1>
          <p className="text-sm mt-1 opacity-80">Masa No: <span className="font-bold">{masaId}</span></p>
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
          className={`w-full font-bold py-2 px-4 rounded-xl transition duration-300 ease-in-out mb-4 ${audioOynuyor ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-white/10 text-white/40 cursor-not-allowed'}`}
          disabled={!audioOynuyor}
        >
          🛑 Konuşmayı Durdur
        </button>
        <div ref={mesajKutusuRef} className="max-h-64 overflow-y-auto space-y-4 bg-white/10 p-3 rounded-xl">
          {gecmis.map((g, i) => (
            <div key={i} className="space-y-1">
              <div className="bg-white/20 p-2 rounded-xl text-sm">🧑‍💼 <span className="font-semibold">Siz:</span> {g.soru}</div>
              <div className="bg-white/30 p-2 rounded-xl text-sm">🤖 <span className="font-semibold">Neso:</span> {g.cevap}</div>
            </div>
          ))}
        </div>
        <div className="mt-8 text-center text-xs text-white/60">☕ Neso Asistan © {new Date().getFullYear()} | Sesli destek aktif</div>
      </div>
    </div>
  );
}

export default MasaAsistani;