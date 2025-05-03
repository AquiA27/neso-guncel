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
  const [karsilamaYapildi, setKarsilamaYapildi] = useState(false);
  const audioRef = useRef(null);
  const mesajKutusuRef = useRef(null);
  const ws = useRef(null);

  // WebSocket bağlantısı
  useEffect(() => {
    ws.current = new WebSocket(`${API_BASE.replace('http', 'ws')}/ws/mutfak`);
    
    ws.current.onopen = () => {
      console.log("WebSocket bağlantısı açıldı");
    };

    ws.current.onerror = (error) => {
      console.error("WebSocket hatası:", error);
    };

    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, []);

  // Menü verisi
  useEffect(() => {
    const fetchMenu = async () => {
      try {
        const res = await axios.get(`${API_BASE}/menu`);
        setMenuUrunler(
          res.data.menu.flatMap((cat) => cat.urunler.map((u) => u.ad.toLowerCase()))
        );
      } catch (error) {
        console.error("Menü verisi alınamadı:", error);
      }
    };
    fetchMenu();
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

  // Karşılama mesajı - LocalStorage ile kontrol
  useEffect(() => {
    const karsilamaKey = `karsilama_${masaId}`;
    const karsilamaDone = localStorage.getItem(karsilamaKey);
    
    if (!karsilamaDone && !karsilamaYapildi) {
      const greeting = `Merhaba, ben Neso, Fıstık Kafe sipariş asistanınız. ${masaId} numaralı masaya hoş geldiniz. Size nasıl yardımcı olabilirim?`;
      sesliYanıtVer(greeting).catch(() => {
        const utt = new SpeechSynthesisUtterance(greeting);
        utt.lang = "tr-TR";
        synth.speak(utt);
      });
      setKarsilamaYapildi(true);
      localStorage.setItem(karsilamaKey, 'true');
      
      // Karşılama mesajını geçmişe ekle
      setGecmis([{ soru: "", cevap: greeting }]);
    }
  }, [masaId, karsilamaYapildi]);

  // Mutfağa sipariş gönderme
  const mutfagaBildir = (siparis) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      try {
        ws.current.send(JSON.stringify({
          masa: masaId,
          istek: siparis.istek,
          sepet: siparis.sepet,
          zaman: new Date().toISOString()
        }));
      } catch (error) {
        console.error("Mutfağa bildirim hatası:", error);
      }
    }
  };

  // Google TTS MP3 çalma
  const sesliYanıtVer = async (text) => {
    try {
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
      audio.onended = () => {
        setAudioPlaying(false);
        URL.revokeObjectURL(url); // Bellek temizliği
      };
    } catch (error) {
      console.error("Google TTS ile sesli yanıt alınamadı:", error);
      throw error;
    }
  };

  // Mesaj gönderme & seslendirme & sipariş kaydetme
  const gonder = async (txt) => {
    setLoading(true);
    const original = (txt ?? mesaj).trim();
    let reply = "";

    if (!original) {
      setLoading(false);
      return;
    }

    try {
      const res = await axios.post(`${API_BASE}/yanitla`, { text: original, masa: masaId });
      reply = res.data.reply;
    } catch (error) {
      console.error("Yanıt alınamadı:", error);
      reply = "Üzgünüm, bir sorun oluştu. Lütfen tekrar deneyin.";
    }

    setGecmis((prev) => [...prev, { soru: original, cevap: reply }]);
    setMesaj("");

    try {
      await sesliYanıtVer(reply);
    } catch (error) {
      console.warn("TTS fallback kullanılıyor:", error);
      const utt = new SpeechSynthesisUtterance(reply);
      utt.lang = "tr-TR";
      synth.speak(utt);
    }

    // Sipariş işleme ve gönderme
    try {
      const sepet = urunAyikla(original);
      if (sepet.length > 0) {
        const siparisData = {
          masa: masaId,
          istek: original,
          yanit: reply,
          sepet: sepet
        };

        await axios.post(
          `${API_BASE}/siparis-ekle`,
          siparisData,
          { headers: { "Content-Type": "application/json" } }
        );

        // Mutfağa bildir
        mutfagaBildir(siparisData);
      }
    } catch (error) {
      console.error("Sipariş kaydetme hatası:", error);
    }

    setLoading(false);
  };

  // [Diğer fonksiyonlar aynı kalacak: urunAyikla, levenshteinDistance, sesiDinle, durdur]

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
          onChange={(e) => setMesaj(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !loading && !audioPlaying && gonder()}
          placeholder="Konuş ya da yazın..."
          className="w-full p-3 mb-4 rounded-xl bg-white/20 placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white"
          disabled={loading || audioPlaying}
        />

        <div className="flex gap-3 mb-4">
          <button
            onClick={() => gonder()}
            disabled={loading || audioPlaying || !mesaj.trim()}
            className={`flex-1 py-2 rounded-xl font-bold transition ${
              loading || audioPlaying || !mesaj.trim()
                ? "bg-white/10 text-white/40 cursor-not-allowed"
                : "bg-white/20 hover:bg-white/40"
            }`}
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
              {g.soru && (
                <div className="bg-white/20 p-2 rounded-xl text-sm">
                  🧑‍💼 <span className="font-semibold">Siz:</span> {g.soru}
                </div>
              )}
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