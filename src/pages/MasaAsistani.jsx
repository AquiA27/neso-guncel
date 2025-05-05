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
  const [karsilamaBeklemede, setKarsilamaBeklemede] = useState(true);
  const audioRef = useRef(null);
  const mesajKutusuRef = useRef(null);
  const wsRef = useRef(null);

  // WebSocket bağlantısı
  useEffect(() => {
    const connectWebSocket = () => {
      try {
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsHost = API_BASE.replace('https://', '').replace('http://', '');
        const wsUrl = `${wsProtocol}//${wsHost}/ws/mutfak`;
        
        console.log("📡 WebSocket bağlantısı deneniyor:", wsUrl);
        
        wsRef.current = new WebSocket(wsUrl);
        
        wsRef.current.onopen = () => {
          console.log("✅ WebSocket bağlantısı başarılı");
        };

        wsRef.current.onerror = (error) => {
          console.error("❌ WebSocket hatası:", error);
          setTimeout(connectWebSocket, 5000);
        };

        wsRef.current.onclose = (event) => {
          console.log("🔌 WebSocket bağlantısı kapandı", event.code);
          if (event.code !== 1000) {
            setTimeout(connectWebSocket, 5000);
          }
        };

        // Ping/Pong ile bağlantıyı canlı tut
        const pingInterval = setInterval(() => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'ping' }));
          }
        }, 30000);

        return () => clearInterval(pingInterval);
      } catch (error) {
        console.error("❌ WebSocket bağlantı hatası:", error);
        setTimeout(connectWebSocket, 5000);
      }
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close(1000, "Component unmounting");
      }
    };
  }, []);

  // Menü verisi
  useEffect(() => {
    const fetchMenu = async () => {
      try {
        const res = await axios.get(`${API_BASE}/menu`);
        const menuItems = res.data.menu.flatMap((cat) => 
          cat.urunler.map((u) => ({
            ...u,
            ad: u.ad.toLowerCase(),
            kategori: cat.kategori
          }))
        );
        setMenuUrunler(menuItems);
      } catch (error) {
        console.error("❌ Menü verisi alınamadı:", error);
      }
    };
    fetchMenu();
  }, []);

  // Başlık ve karşılama kontrolü
  useEffect(() => {
    document.title = `Neso Asistan - Masa ${masaId}`;
    
    const karsilamaKey = `karsilama_${masaId}`;
    const karsilamaDone = localStorage.getItem(karsilamaKey);
    
    if (!karsilamaDone) {
      setKarsilamaBeklemede(true);
    } else {
      setKarsilamaBeklemede(false);
    }
  }, [masaId]);

  // Scroll
  useEffect(() => {
    if (mesajKutusuRef.current) {
      mesajKutusuRef.current.scrollTop = mesajKutusuRef.current.scrollHeight;
    }
  }, [gecmis]);

  // Karşılama mesajını çal
  const handleInputFocus = async () => {
    if (karsilamaBeklemede) {
      const karsilamaKey = `karsilama_${masaId}`;
      const greeting = `Merhaba, ben Neso, Fıstık Kafe sipariş asistanınız. ${masaId} numaralı masaya hoş geldiniz. Size nasıl yardımcı olabilirim?`;
      
      try {
        await sesliYanıtVer(greeting);
        setGecmis([{ soru: "", cevap: greeting }]);
        localStorage.setItem(karsilamaKey, 'true');
      } catch (error) {
        console.warn("⚠️ Fallback TTS kullanılıyor:", error);
        const utt = new SpeechSynthesisUtterance(greeting);
        utt.lang = "tr-TR";
        synth.speak(utt);
      }
      
      setKarsilamaBeklemede(false);
    }
  };

  // Mutfağa sipariş gönderme
  const mutfagaBildir = (siparis) => {
    try {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        const bildirim = {
          type: 'siparis',
          data: {
            masa: masaId,
            istek: siparis.istek,
            sepet: siparis.sepet,
            zaman: new Date().toISOString()
          }
        };

        wsRef.current.send(JSON.stringify(bildirim));
        console.log("✅ Sipariş mutfağa iletildi");
      } else {
        throw new Error("WebSocket bağlantısı kapalı");
      }
    } catch (error) {
      console.error("❌ Mutfak bildirimi başarısız:", error);
      // Fallback: HTTP ile gönder
      axios.post(`${API_BASE}/siparis-bildir`, {
        masa: masaId,
        istek: siparis.istek,
        sepet: siparis.sepet,
        zaman: new Date().toISOString()
      }).catch(err => {
        console.error("❌ HTTP bildirimi de başarısız:", err);
      });
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
      
      if (audioRef.current) {
        audioRef.current.pause();
      }
      
      audioRef.current = audio;
      setAudioPlaying(true);
      
      await audio.play();
      
      audio.onended = () => {
        setAudioPlaying(false);
        URL.revokeObjectURL(url);
      };
    } catch (error) {
      console.error("❌ Google TTS hatası:", error);
      throw error;
    }
  };

  // Sesle dinleme
  const sesiDinle = () => {
    if (!recognition) {
      alert("🚫 Tarayıcınız ses tanımayı desteklemiyor.");
      return;
    }

    const r = new recognition();
    r.lang = "tr-TR";
    r.continuous = false;
    r.interimResults = false;

    r.start();
    setMicActive(true);

    r.onresult = async (e) => {
      const txt = e.results[0][0].transcript;
      setMicActive(false);
      setMesaj(txt);
      await gonder(txt);
    };

    r.onerror = (e) => {
      console.error("🎤 Ses tanıma hatası:", e);
      setMicActive(false);
    };

    r.onend = () => {
      setMicActive(false);
    };
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
      const res = await axios.post(`${API_BASE}/yanitla`, {
        text: original,
        masa: masaId
      });
      reply = res.data.reply;
    } catch (error) {
      console.error("❌ Yanıt alınamadı:", error);
      reply = "Üzgünüm, bir sorun oluştu. Lütfen tekrar deneyin.";
    }

    setGecmis((prev) => [...prev, { soru: original, cevap: reply }]);
    setMesaj("");

    try {
      await sesliYanıtVer(reply);
    } catch (error) {
      console.warn("⚠️ TTS fallback kullanılıyor:", error);
      const utt = new SpeechSynthesisUtterance(reply);
      utt.lang = "tr-TR";
      synth.speak(utt);
    }

    // Sipariş işleme
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
        console.log("✅ Sipariş kaydedildi");

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
      let best = { urun: null, fiyat: 0, kategori: "", puan: 0 };

      for (const u of menuUrunler) {
        const puan = 1 - levenshteinDistance(u.ad, gir) / Math.max(u.ad.length, gir.length);
        if (puan > best.puan) {
          best = { ...u, puan };
        }
      }

      if (siparisIstekli && best.urun && best.puan >= 0.75) {
        items.push({
          urun: best.urun,
          adet,
          fiyat: best.fiyat,
          kategori: best.kategori
        });
      }
    }

    return items;
  };

  // Levenshtein mesafe hesaplama
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
          onChange={(e) => setMesaj(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !loading && !audioPlaying && gonder()}
          onFocus={handleInputFocus}
          placeholder={karsilamaBeklemede ? "Hoş geldiniz! Tıklayın..." : "Konuş ya da yazın..."}
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
            } ${loading || audioPlaying ? "opacity-50 cursor-not-allowed" : ""}`}
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
          className="max-h-64 overflow-y-auto space-y-4 bg-white/10 p-3 rounded-xl scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent"
        >
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