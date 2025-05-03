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

  // 🎙️ Tarayıcı TTS konuşma fonksiyonu
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

  // 🚀 Bileşen mount olduğunda karşılama ve otomatik dinleme
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

  // 🏷️ Sayfa başlığını güncelle
  useEffect(() => {
    document.title = `Neso Asistan - Masa ${masaId}`;
  }, [masaId]);

  // 🔄 Geçmiş güncellendiğinde scroll
  useEffect(() => {
    if (mesajKutusuRef.current) {
      mesajKutusuRef.current.scrollTop = mesajKutusuRef.current.scrollHeight;
    }
  }, [gecmis]);

  // 📥 Menü verisini al
  useEffect(() => {
    axios
      .get(`${process.env.REACT_APP_API_BASE}/menu`)
      .then(res => {
        const urunler = res.data.menu.flatMap(cat =>
          cat.urunler.map(u => u.ad.toLowerCase())
        );
        setMenuUrunler(urunler);
      })
      .catch(err => console.error("Menü alınamadı:", err));
  }, []);

  // 🔢 Levenshtein mesafe hesaplama
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

  // 🍽️ Mesajdan ürün ve adet ayıkla
  const urunAyikla = msg => {
    const items = [];
    const mk = msg.toLowerCase();
    const siparisIstekli = /(ver|getir|istiyorum|isterim|sipariş)/i.test(mk);
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

  // 🎤 Sesli dinleme
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

  // 📤 Gönder, seslendir ve sipariş kaydet
  const gonder = async () => {
    if (!mesaj.trim()) return;
    setLoading(true);

    const original = mesaj.trim();
    let reply = "";

    // BOT yanıtını al
    try {
      const res = await axios.post(
        `${process.env.REACT_APP_API_BASE}/yanitla`,
        { text: original, masa: masaId }
      );
      reply = res.data.reply || "Üzgünüm, cevap alınamadı.";
    } catch (err) {
      console.error("Yanıt hatası:", err);
      reply = "Üzgünüm, bir sorun oluştu. Lütfen tekrar deneyin.";
    }

    // Geçmişe ekle
    setGecmis(prev => [...prev, { soru: original, cevap: reply }]);
    setMesaj("");

    // Seslendir ve tekrar dinle
    speak(reply, sesiDinle);

    // Mutfak ve admin paneli için siparişi kaydet
    try {
      const sepet = urunAyikla(original);
      await axios.post(
        `${process.env.REACT_APP_API_BASE}/siparis-ekle`,
        { masa: masaId, istek: original, yanit: reply, sepet },
        { headers: { "Content-Type": "application/json" } }
      );
      console.log("✅ Sipariş mutfak & admin paneline gönderildi");
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
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 flex items-center justify-center px-4 py-8">
      <div className="bg-white/10 backdrop-blur-md shadow-2xl rounded-3xl p-6 w-full max-w-md text-white border border-white/30">
        <h1 className="text-3xl font-extrabold text-center mb-4">
          🎙️ Neso Asistan
        </h1>
        <p className="text-center mb-6 opacity-80">
          Masa No: <span className="font-semibold">{masaId}</span>
        </p>

        <input
          type="text"
          value={mesaj}
          onChange={e => setMesaj(e.target.value)}
          onKeyDown={e => e.key === "Enter" && gonder()}
          placeholder="Konuş ya da yazın..."
          className="w-full p-3 mb-4 rounded-xl bg-white/20 placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white"
        />

        <div className="flex gap-3 mb-4">
          <button
            onClick={gonder}
            disabled={loading || audioPlaying}
            className="flex-1 bg-white/20 hover:bg-white/40 py-2 rounded-xl font-bold transition"
          >
            {loading ? "⏳ Bekleniyor..." : "🚀 Gönder"}
          </button>
          <button
            onClick={sesiDinle}
            disabled={loading || audioPlaying}
            className={`py-2 px-4 rounded-xl font-bold transition ${
              micActive ? "bg-red-500" : "bg-white/20 hover:bg-white/40"
            }`}
          >
            🎤 Dinle
          </button>
        </div>

        <button
          onClick={durdur}
          disabled={!audioPlaying}
          className={`w-full py-2 mb-4 rounded-xl font-bold transition ${
            audioPlaying
              ? "bg-red-500 hover:bg-red-600 text-white"
              : "bg-white/10 text-white/40 cursor-not-allowed"
          }`}
        >
          🛑 Konuşmayı Durdur
        </button>

        <div
          ref={mesajKutusuRef}
          className="max-h-64 overflow-y-auto space-y-4 bg-white/10 p-3 rounded-xl"
        >
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

        <p className="text-center text-xs opacity-60 mt-6">
          ☕ Neso Asistan © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}

export default MasaAsistani;
