import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useParams } from "react-router-dom";

const synth = window.speechSynthesis;
const recognition = window.SpeechRecognition || window.webkitSpeechRecognition;

function MasaAsistani() {
  const { masaId } = useParams();
  const [mesaj, setMesaj] = useState("");
  const [gecmis, setGecmis] = useState([]);
  const [loading, setLoading] = useState(false);
  const [micActive, setMicActive] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [menuUrunler, setMenuUrunler] = useState([]);
  const mesajKutusuRef = useRef(null);

  // 🔊 Tarayıcı TTS konuşma yardımcı
  const speak = (text, onEnd) => {
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = "tr-TR";
    utt.rate = 1.3;
    utt.pitch = 1.0;
    utt.onstart = () => setAudioPlaying(true);
    utt.onend = () => {
      setAudioPlaying(false);
      if (onEnd) onEnd();
    };
    synth.speak(utt);
  };

  // 🚀 Karşılama ve ilk dinleme (mount)
  useEffect(() => {
    const greeting = `Merhaba, ben Neso, Fıstık Kafe sipariş asistanınız. ${masaId} numaralı masaya hoş geldiniz. Size nasıl yardımcı olabilirim?`;
    if (synth.getVoices().length === 0) {
      synth.onvoiceschanged = () => {
        synth.onvoiceschanged = null;
        speak(greeting, sesiDinle);
      };
    } else {
      speak(greeting, sesiDinle);
    }
  }, [masaId]);

  // 🏷️ Başlık
  useEffect(() => {
    document.title = `Neso Asistan - Masa ${masaId}`;
  }, [masaId]);

  // 🔄 Otomatik scroll
  useEffect(() => {
    if (mesajKutusuRef.current) {
      mesajKutusuRef.current.scrollTop = mesajKutusuRef.current.scrollHeight;
    }
  }, [gecmis]);

  // 📥 Menü verisi çek
  useEffect(() => {
    axios.get(`${process.env.REACT_APP_API_BASE}/menu`)
      .then(res => {
        const urunler = res.data.menu.flatMap(k =>
          k.urunler.map(u => u.ad.toLowerCase())
        );
        setMenuUrunler(urunler);
      })
      .catch(err => console.error("Menü verisi alınamadı:", err));
  }, []);

  // 🔢 Levenshtein mesafe
  const levenshteinDistance = (a, b) => {
    const m = Array.from({ length: b.length + 1 }, (_, i) =>
      Array(a.length + 1).fill(0)
    );
    for (let i = 0; i <= b.length; i++) m[i][0] = i;
    for (let j = 0; j <= a.length; j++) m[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        const cost = a[j - 1] === b[i - 1] ? 0 : 1;
        m[i][j] = Math.min(
          m[i - 1][j] + 1,
          m[i][j - 1] + 1,
          m[i - 1][j - 1] + cost
        );
      }
    }
    return m[b.length][a.length];
  };

  // 🍽️ Mesajdan ürün ayıkla
  const urunAyikla = msg => {
    const items = [];
    const mk = msg.toLowerCase();
    const siparisIstekli = /(ver|getir|istiyorum|isterim|alabilir miyim|sipariş)/i.test(mk);
    const temiz = mk.replace(/(\d+)([a-zçğıöşü]+)/gi, "$1 $2");
    const pat = /(?:(\d+)\s*)?([a-zçğıöşü\s]+)/gi;
    let m;
    while ((m = pat.exec(temiz)) !== null) {
      const adet = parseInt(m[1]) || 1;
      const gir = m[2].trim();
      let best = { urun: null, puan: 0 };
      for (const u of menuUrunler) {
        const puan = 1 - levenshteinDistance(u, gir) / Math.max(u.length, gir.length);
        if (puan > best.puan) best = { urun: u, puan };
      }
      if (siparisIstekli && best.urun && best.puan >= 0.75) {
        items.push({ urun: best.urun, adet });
      }
    }
    return items;
  };

  // 🎤 Mikrofon dinleme
  const sesiDinle = () => {
    if (!recognition) {
      alert("Tarayıcınız ses tanımıyor.");
      return;
    }
    const r = new recognition();
    r.lang = "tr-TR";
    r.start();
    setMicActive(true);
    r.onresult = async e => {
      const txt = e.results[0][0].transcript;
      setMicActive(false);
      setMesaj(txt);
      await gonder();
    };
    r.onerror = () => setMicActive(false);
    r.onend = () => {};
  };

  // 📤 Gönder + seslendir + sipariş kaydet
  const gonder = async () => {
    if (!mesaj.trim()) return;
    setLoading(true);

    const original = mesaj.trim();        // ◆ eski mesajı sakla
    let reply = "";

    try {
      const res = await axios.post(
        `${process.env.REACT_APP_API_BASE}/yanitla`,
        { mesaj: original, masaId }
      );
      reply = res.data.cevap || "Üzgünüm, cevap alınamadı.";
    } catch (err) {
      console.error("Yanıt hatası:", err);
      reply = "Üzgünüm, bir hata oluştu. Tekrar deneyin.";
    }

    // ◆ Geçmişe ekle
    setGecmis(prev => [...prev, { soru: original, cevap: reply }]);
    setMesaj("");

    // ◆ Seslendir ve tekrar dinle
    speak(reply, sesiDinle);

    // ◆ Siparişi kaydet
    try {
      const sepet = urunAyikla(original);
      await axios.post(
        `${process.env.REACT_APP_API_BASE}/siparis-ekle`,
        { masa: masaId, istek: original, yanit: reply, sepet },
        { headers: { "Content-Type": "application/json" } }
      );
      console.log("✅ /siparis-ekle çağrısı yapıldı");
    } catch (err) {
      console.error("Sipariş kaydetme hatası:", err);
    }

    setLoading(false);
  };

  // ⏹️ Konuşmayı durdur
  const durdur = () => {
    synth.cancel();
    setAudioPlaying(false);
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
          <input
            type="text"
            value={mesaj}
            onChange={e => setMesaj(e.target.value)}
            onKeyDown={e => e.key === "Enter" && gonder()}
            placeholder="Konuş ya da yazın..."
            className="w-full p-3 rounded-xl bg-white/20 placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white focus:bg-white/30"
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-3">
          <button
            onClick={gonder}
            disabled={loading || audioPlaying}
            className="w-full sm:flex-1 bg-white/20 hover:bg-white/40 text-white font-bold py-2 px-4 rounded-xl transition"
          >
            {loading ? "⏳ Bekleniyor..." : "🚀 Gönder"}
          </button>
          <button
            onClick={sesiDinle}
            disabled={loading || audioPlaying}
            className={`w-full sm:flex-1 ${micActive ? "bg-red-500" : "bg-white/20"} hover:bg-white/40 text-white font-bold py-2 px-4 rounded-xl transition`}
          >
            🎤 Dinle
          </button>
        </div>

        <button
          onClick={durdur}
          disabled={!audioPlaying}
          className={`w-full py-2 mb-4 rounded-xl font-bold transition ${audioPlaying ? "bg-red-500 hover:bg-red-600 text-white" : "bg-white/10 text-white/40 cursor-not-allowed"}`}
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
