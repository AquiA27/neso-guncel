import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useParams } from "react-router-dom";

const synth = window.speechSynthesis;
const recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const API_BASE = process.env.REACT_APP_API_BASE;

function MasaAsistani() {
  const { masaId } = useParams();
  const [mesaj, setMesaj] = useState("");
  const [gecmis, setGecmis] = useState([]);
  const [loading, setLoading] = useState(false);
  const [micActive, setMicActive] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [menuUrunler, setMenuUrunler] = useState([]);
  const audioRef = useRef(null);
  const mesajKutusuRef = useRef(null);

  // Menü verisi
  useEffect(() => {
    axios.get(`${API_BASE}/menu`)
      .then(res => {
        setMenuUrunler(
          res.data.menu.flatMap(cat => cat.urunler.map(u => u.ad.toLowerCase()))
        );
      })
      .catch(console.error);
  }, []);

  // Başlık
  useEffect(() => {
    document.title = `Neso Asistan - Masa ${masaId}`;
  }, [masaId]);

  // Scroll
  useEffect(() => {
    if (mesajKutusuRef.current) {
      mesajKutusuRef.current.scrollTop = mesajKutusuRef.current.scrollHeight;
    }
  }, [gecmis]);

  // Karşılama mesajı (mount anında)
  useEffect(() => {
    const greeting = `Merhaba, ben Neso, Fıstık Kafe sipariş asistanınız. ${masaId} numaralı masaya hoş geldiniz. Size nasıl yardımcı olabilirim?`;
    // İlk olarak Google TTS ile dene
    sesliYanıtVer(greeting)
      .catch(() => {
        // Hata olursa fallback olarak yerel TTS
        const utt = new SpeechSynthesisUtterance(greeting);
        utt.lang = "tr-TR";
        synth.speak(utt);
      });
  }, [masaId]);

  // Google TTS MP3 çalma
  const sesliYanıtVer = async (text) => {
    const res = await axios.post(
      `${API_BASE}/sesli-yanit`,
      { text },
      { responseType: "arraybuffer" }
    );
    const blob = new Blob([res.data], { type: "audio/mp3" });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audioRef.current = audio;
    setAudioPlaying(true);
    await audio.play();
    audio.onended = () => setAudioPlaying(false);
  };

  // Sesle dinleme
  const sesiDinle = () => {
    if (!recognition) return alert("Tarayıcı ses tanımıyor.");
    const r = new recognition();
    r.lang = "tr-TR";
    r.start();
    setMicActive(true);
    r.onresult = async e => {
      const txt = e.results[0][0].transcript;
      setMicActive(false);
      setMesaj(txt);
      await gonder(txt);
    };
    r.onerror = () => setMicActive(false);
  };

  // Gönderme & seslendirme & sipariş kaydetme
  const gonder = async (txt) => {
    setLoading(true);
    const original = (txt ?? mesaj).trim();
    let reply = "";
    try {
      const res = await axios.post(
        `${API_BASE}/yanitla`,
        { text: original, masa: masaId }
      );
      reply = res.data.reply;
    } catch {
      reply = "Üzgünüm, bir sorun oluştu. Lütfen tekrar deneyin.";
    }
    setGecmis(prev => [...prev, { soru: original, cevap: reply }]);
    setMesaj("");
    try {
      await sesliYanıtVer(reply);
    } catch (err) {
      console.warn("TTS fallback:", err);
      const utt = new SpeechSynthesisUtterance(reply);
      utt.lang = "tr-TR";
      synth.speak(utt);
    }
    try {
      const sepet = urunAyikla(original);
      await axios.post(
        `${API_BASE}/siparis-ekle`,
        { masaId, istek: original, cevap: reply, sepet },
        { headers: { "Content-Type": "application/json" } }
      );
    } catch (err) {
      console.error("Sipariş kaydetme hatası:", err);
    }
    setLoading(false);
  };

  // Ürün ayıklama
  const urunAyikla = (msg) => {
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
      if (siparisIstekli && best.urun && best.puan >= 0.75) items.push({ urun: best.urun, adet });
    }
    return items;
  };

  // Levenshtein hesaplama
  const levenshteinDistance = (a, b) => {
    const m = Array.from({ length: b.length + 1 }, (_, i) =>
      Array(a.length + 1).fill(0)
    );
    for (let i = 0; i <= b.length; i++) m[i][0] = i;
    for (let j = 0; j <= a.length; j++) m[0][j] = j;
    for (let i = 1; i <= b.length; i++)
      for (let j = 1; j <= a.length; j++) {
        const cost = a[j - 1] === b[i - 1] ? 0 : 1;
        m[i][j] = Math.min(
          m[i - 1][j] + 1,
          m[i][j - 1] + 1,
          m[i - 1][j - 1] + cost
        );
      }
    return m[b.length][a.length];
  };

  // Konuşmayı durdur
  const durdur = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setAudioPlaying(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-md shadow-2xl rounded-3xl p-6 w-full max-w-md text-white border border-white/30">
        <h1 className="text-3xl font-extrabold text-center mb-4">🎙️ Neso Asistan</h1>
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
            onClick={() => gonder()}
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

        <p className="text-center text-xs opacity-60 mt-6">
          ☕ Neso Asistan © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}

export default MasaAsistani;
