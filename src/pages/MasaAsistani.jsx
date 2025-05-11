import React, { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { useParams } from "react-router-dom";

// Tarayıcı API'ları (varsa)
const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
const SpeechRecognition = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;

// REACT_APP_API_BASE ortam değişkeninden API adresini al
const API_BASE = process.env.REACT_APP_API_BASE;

// Ana component fonksiyonu
function MasaAsistani() {
  // --- State Tanımlamaları ---
  const { masaId } = useParams();
  const [mesaj, setMesaj] = useState("");
  const [gecmis, setGecmis] = useState([]);
  const [loading, setLoading] = useState(false);
  const [micActive, setMicActive] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [menuUrunler, setMenuUrunler] = useState([]); // Fallback için
  const [karsilamaYapildi, setKarsilamaYapildi] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(`karsilama_yapildi_${masaId}`) === 'true';
  });
  const [siparisDurumu, setSiparisDurumu] = useState(null);
  const [hataMesaji, setHataMesaji] = useState(null);

  // --- Referanslar ---
  const audioRef = useRef(null);
  const mesajKutusuRef = useRef(null);
  const wsRef = useRef(null);
  const recognitionRef = useRef(null);

  // --- Yardımcı Fonksiyonlar ---
  // Levenshtein ve similarity fonksiyonları burada (değişiklik yok)
  const levenshteinDistance = (a = '', b = '') => {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    const matrix = Array(a.length + 1).fill(null).map(() => Array(b.length + 1).fill(null));
    for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
    for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
      }
    }
    return matrix[a.length][b.length];
  };

  const calculateSimilarity = (str1 = '', str2 = '') => {
    const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase()); // Küçük harfe çevirerek karşılaştır
    const maxLength = Math.max(str1.length, str2.length);
    if (maxLength === 0) return 1;
    return 1 - distance / maxLength;
  };


  const getDurumText = (durum) => {
    switch (durum) {
      case 'bekliyor': return 'Siparişiniz Alındı, Bekliyor...';
      case 'hazirlaniyor': return 'Siparişiniz Hazırlanıyor... 👨‍🍳';
      case 'hazir': return 'Siparişiniz Hazır! Afiyet olsun. ✅';
      case 'iptal': return 'Siparişiniz İptal Edildi. ❌';
      default: return null;
    }
  };

  // --- Loglama Fonksiyonları ---
  const logInfo = useCallback((message, ...optionalParams) => console.info(`[Masa ${masaId}] INFO: ${message}`, ...optionalParams), [masaId]);
  const logError = useCallback((message, error, ...optionalParams) => console.error(`[Masa ${masaId}] ERROR: ${message}`, error || '', ...optionalParams), [masaId]);
  const logWarn = useCallback((message, ...optionalParams) => console.warn(`[Masa ${masaId}] WARN: ${message}`, ...optionalParams), [masaId]);
  const logDebug = useCallback((message, ...optionalParams) => console.debug(`[Masa ${masaId}] DEBUG: ${message}`, ...optionalParams), [masaId]);

  useEffect(() => {
    document.title = `Neso Asistan - Masa ${masaId}`;
  }, [masaId]);

  // --- WebSocket Bağlantısı ---
  useEffect(() => {
    const connectWebSocket = () => {
      if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
        return;
      }
      if (!API_BASE) {
        logError("API_BASE tanımlı değil, WebSocket bağlantısı kurulamıyor.");
        setHataMesaji("Sunucu adresi ayarlanmamış.");
        return;
      }
      try {
        const wsProtocol = API_BASE.startsWith('https') ? 'wss:' : (typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:');
        const wsHost = API_BASE.replace(/^https?:\/\//, '');
        const wsUrl = `${wsProtocol}//${wsHost}/ws/mutfak?masa_id=${masaId}`; // masa_id query param olarak eklendi
        logInfo(`📡 WebSocket bağlantısı deneniyor: ${wsUrl}`);
        wsRef.current = new WebSocket(wsUrl);
        wsRef.current.onopen = () => { logInfo("✅ WebSocket bağlantısı başarılı."); setHataMesaji(null); };
        wsRef.current.onmessage = (event) => {
          logDebug("WebSocket Mesajı Geldi:", event.data);
          try {
            const message = JSON.parse(event.data);
            logInfo(`📥 WebSocket mesajı alındı: Tip: ${message.type}`);
            if (message.type === 'pong') {
              // Isteyerek bir şey yapmıyoruz
            } else if (message.type === 'durum' && message.data) {
              const { masa, durum: newDurum, id: siparisIdWS } = message.data; // Sipariş ID'sini de alabiliriz
              // Backend tüm masalara yayın yapıyorsa, sadece bu masayı ilgilendiren durumu alalım
              if (String(masa) === String(masaId)) {
                logInfo(`📊 Durum güncellemesi: Masa ${masaId}, Sipariş ID (WS): ${siparisIdWS}, Yeni Durum: ${newDurum}`);
                setSiparisDurumu(newDurum);
              }
            } else if (message.type === 'siparis') {
              logInfo(`ℹ️ Backend'den yeni sipariş yayını alındı (ID: ${message.data?.id}). Bu masa arayüzünde bu mesaja özel bir işlem tanımlanmadı.`);
            } else {
              logWarn("⚠️ Bilinmeyen WebSocket mesaj tipi:", message);
            }
          } catch (err) {
            logError("WebSocket mesajı işlenirken hata:", err);
          }
        };
        wsRef.current.onerror = (errorEvent) => {
          const error = errorEvent.message || (errorEvent.target?.url ? `Bağlantı hatası: ${errorEvent.target.url}` : "Bilinmeyen WS hatası");
          logError("❌ WebSocket hatası:", error);
          setHataMesaji("Sunucuyla anlık bağlantı koptu.");
        };
        wsRef.current.onclose = (event) => {
          logInfo(`🔌 WebSocket bağlantısı kapandı. Kod: ${event.code}, Sebep: ${event.reason || 'Bilinmiyor'}`);
          wsRef.current = null;
          if (event.code !== 1000 && event.code !== 1001 && !event.wasClean) { // 1000 Normal, 1001 Gidiyor
            logInfo("WebSocket beklenmedik şekilde kapandı, 5 saniye sonra tekrar denenecek...");
            setTimeout(connectWebSocket, 5000 + Math.random() * 1000); // Rastgele jitter ekle
          }
        };
      } catch (error) {
        logError("❌ WebSocket bağlantısı başlatılırken kritik hata:", error);
        setHataMesaji("Sunucu bağlantısı kurulamıyor.");
      }
    };
    if (API_BASE) {
      connectWebSocket();
    }
    const pingInterval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        try { wsRef.current.send(JSON.stringify({ type: 'ping' })); }
        catch (err) { logError("Ping gönderilirken hata:", err); }
      } else if (API_BASE && !wsRef.current) { // Bağlantı yoksa veya kopmuşsa yeniden dene
        logWarn("Ping: WebSocket bağlantısı aktif değil, yeniden bağlantı deneniyor.");
        connectWebSocket();
      }
    }, 30000); // 30 saniyede bir ping
    return () => {
      clearInterval(pingInterval);
      if (wsRef.current) {
        logInfo("Component kaldırılıyor, WebSocket kapatılıyor (normal kapanış).");
        wsRef.current.close(1000, "Component unmounting"); // Normal kapanış kodu
        wsRef.current = null;
      }
    };
  }, [API_BASE, masaId, logInfo, logError, logWarn, logDebug]);

  // --- Menü Verisini Çekme (urunAyiklaManuel için fallback ve fiyat/kategori doğrulaması) ---
  useEffect(() => {
    const fetchMenu = async () => {
      if (!API_BASE) { logError("API_BASE tanımsız, menü çekilemiyor."); return; }
      logInfo("🍽️ Menü verisi çekiliyor...");
      try {
        const res = await axios.get(`${API_BASE}/menu`);
        if (res.data && Array.isArray(res.data.menu)) {
          const menuItems = res.data.menu.flatMap(cat =>
            Array.isArray(cat.urunler) ? cat.urunler.map(u => ({
              ad: String(u.ad || 'İsimsiz Ürün').toLowerCase().trim(),
              orjinalAd: String(u.ad || 'İsimsiz Ürün').trim(),
              fiyat: Number(u.fiyat) || 0,
              kategori: String(cat.kategori || 'Bilinmeyen Kategori').trim(),
              stok_durumu: u.stok_durumu === undefined ? 1 : Number(u.stok_durumu), // stok_durumu backend'den geliyor
            })) : []
          );
          setMenuUrunler(menuItems);
          logInfo(`✅ Menü verisi başarıyla alındı (${menuItems.length} ürün).`);
        } else {
          logWarn("Menü verisi beklenen formatta değil:", res.data);
        }
      } catch (error) {
        logError("❌ Menü verisi alınamadı:", error);
      }
    };
    if (API_BASE) {
      fetchMenu();
    }
  }, [API_BASE, logInfo, logError, logWarn]);

  // --- Karşılama Mesajı ---
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const karsilamaKey = `karsilama_yapildi_${masaId}`;
      if (localStorage.getItem(karsilamaKey) === 'true') {
        setKarsilamaYapildi(true);
      }
    }
  }, [masaId]);

  // --- Mesaj Kutusu Kaydırma ---
  useEffect(() => {
    if (mesajKutusuRef.current) {
      mesajKutusuRef.current.scrollTop = mesajKutusuRef.current.scrollHeight;
    }
  }, [gecmis]);

  // --- Sesli Yanıt Verme ---
  const sesliYanıtVer = useCallback(async (text) => {
    if (!API_BASE) { logError("API_BASE tanımsız, sesli yanıt verilemiyor."); setHataMesaji("API adresi ayarlanmamış."); return; }
    if (!text || typeof text !== 'string' || !text.trim()) { logWarn("Seslendirilecek geçerli metin boş."); return; }
    logInfo(`🔊 Sesli yanıt isteği: "${text.substring(0, 50)}..."`);
    setAudioPlaying(true); setHataMesaji(null);
    try {
      logDebug(`TTS isteği gönderiliyor: /sesli-yanit, Metin: "${text.substring(0, 50)}..."`);
      const res = await axios.post(`${API_BASE}/sesli-yanit`, { text }, { responseType: "arraybuffer" });
      logDebug(`TTS yanıtı alındı. Status: ${res.status}, Data length: ${res.data?.byteLength}`);
      if (!res.data || res.data.byteLength < 100) { // Çok kısa ses dosyalarını geçersiz say
        throw new Error("Sunucudan boş veya geçersiz ses verisi alındı.");
      }
      const blob = new Blob([res.data], { type: "audio/mpeg" });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      if (audioRef.current && !audioRef.current.paused) { audioRef.current.pause(); audioRef.current.src = ''; }
      audioRef.current = audio;
      try {
        await audio.play();
        logInfo("✅ Sesli yanıt çalınıyor.");
      } catch (playError) {
        logError("Audio.play() hatası (muhtemelen kullanıcı etkileşimi eksik):", playError);
        setAudioPlaying(false); URL.revokeObjectURL(url); audioRef.current = null;
        // Bu durumda hata mesajı göstermek yerine, belki bir "Oynatmak için tıklayın" butonu daha iyi olabilir.
        // Şimdilik hata mesajı kalsın.
        setHataMesaji("Ses dosyası otomatik oynatılamadı. Lütfen tekrar deneyin veya sayfaya tıklayın.");
        return;
      }
      audio.onended = () => { logInfo("🏁 Sesli yanıt bitti."); setAudioPlaying(false); URL.revokeObjectURL(url); audioRef.current = null; };
      audio.onerror = (err) => { logError("Ses çalma hatası (onerror):", err); setAudioPlaying(false); URL.revokeObjectURL(url); audioRef.current = null; setHataMesaji("Sesli yanıt oynatılamadı."); };
    } catch (error) {
      logError("❌ TTS API isteği veya ses işleme hatası:", error); setAudioPlaying(false);
      const hataMesajiDetay = error.response?.data?.detail || error.message || "Bilinmeyen TTS hatası.";
      setHataMesaji(`Sesli yanıt alınamadı: ${hataMesajiDetay}`);
      // Tarayıcı TTS Fallback (opsiyonel)
      if (synth && text && SpeechRecognition) { // SpeechRecognition kontrolü aslında gereksiz burada
        logWarn("⚠️ Fallback TTS (tarayıcı) kullanılıyor.");
        try {
          synth.cancel(); const utt = new SpeechSynthesisUtterance(text); utt.lang = "tr-TR";
          utt.onend = () => { logInfo("🏁 Fallback TTS (tarayıcı) bitti."); setAudioPlaying(false); };
          utt.onerror = (errEvent) => { logError("Fallback TTS (tarayıcı) hatası:", errEvent); setAudioPlaying(false); };
          setAudioPlaying(true); synth.speak(utt);
        } catch (ttsError) { logError("Fallback TTS hatası:", ttsError); setAudioPlaying(false); }
      }
    }
  }, [API_BASE, masaId, logInfo, logError, logWarn, logDebug, synth]); // synth eklendi

  // --- Input'a Odaklanınca Karşılama ---
  const handleInputFocus = useCallback(async () => {
    if (!karsilamaYapildi && API_BASE) {
      const karsilamaKey = `karsilama_yapildi_${masaId}`;
      const greeting = `Merhaba, ben Neso. Fıstık Kafe sipariş asistanınızım. ${masaId} numaralı masaya hoş geldiniz. Size nasıl yardımcı olabilirim?`;
      logInfo("👋 Karşılama mesajı tetikleniyor...");
      setGecmis((prev) => [...prev, { type: 'neso', soru: "", cevap: greeting }]);
      try {
        await sesliYanıtVer(greeting);
        if (typeof window !== 'undefined') { localStorage.setItem(karsilamaKey, 'true'); }
        setKarsilamaYapildi(true);
      } catch (error) { logError("Karşılama mesajı seslendirilemedi:", error); }
    }
  }, [karsilamaYapildi, masaId, sesliYanıtVer, logInfo, logError, API_BASE]);


  // --- Ana Mesaj Gönderme ve İşleme Fonksiyonu ---
  const gonder = useCallback(async (gonderilecekMesaj) => {
    const kullaniciMesaji = (gonderilecekMesaj ?? mesaj).trim();
    if (!kullaniciMesaji || loading || audioPlaying || micActive) return;

    logInfo(`➡️ Mesaj gönderiliyor: "${kullaniciMesaji}"`);
    setLoading(true); setMesaj(""); setHataMesaji(null);
    // Kullanıcı mesajını hemen geçmişe ekle, Neso'nun cevabını "..." olarak göster
    setGecmis((prev) => [...prev, { type: 'user', soru: kullaniciMesaji, cevap: "..." }]);

    let aiHamYanit = "";
    let konusmaMetni = "Yanıtınız işleniyor, lütfen bekleyin...";
    let siparisSepetiGonderilecek = [];

    try {
      logInfo("Adım 1: AI Yanıtı alınıyor...");
      if (!API_BASE) {
        logError("API_BASE tanımlı değil, AI yanıtı alınamıyor.");
        throw new Error("API adresi yapılandırılmamış.");
      }
      const yanitRes = await axios.post(`${API_BASE}/yanitla`, { text: kullaniciMesaji, masa: masaId });
      aiHamYanit = yanitRes.data.reply || "";
      logInfo(`⬅️ AI yanıtı alındı (ham): "${aiHamYanit.substring(0, 150)}..."`);

      // AI Yanıtını Parse Etme ve Sepet Oluşturma
      try {
        const parsedAI = JSON.parse(aiHamYanit);
        logInfo("AI yanıtı JSON olarak BAŞARIYLA parse edildi.", parsedAI);

        if (parsedAI.sepet && Array.isArray(parsedAI.sepet) && parsedAI.sepet.length > 0) {
          siparisSepetiGonderilecek = parsedAI.sepet.map(item => {
            // Menüden güncel fiyat ve kategori bilgilerini alalım (fallback olarak AI'ın verdiğini kullan)
            const menuUrun = menuUrunler.find(m => m.ad === String(item.urun || "").toLowerCase().trim());
            return {
              urun: menuUrun ? menuUrun.orjinalAd : String(item.urun || "Bilinmeyen Ürün").trim(), // Orjinal adı kullanalım
              adet: parseInt(item.adet, 10) || 0, // Tam sayıya çevir
              fiyat: menuUrun ? menuUrun.fiyat : parseFloat(item.fiyat) || 0, // Ondalıklı sayıya çevir, menüden al
              kategori: menuUrun ? menuUrun.kategori : String(item.kategori || "Bilinmeyen Kategori").trim() // Menüden al
            };
          }).filter(item => item.adet > 0 && item.urun !== "Bilinmeyen Ürün");
          logDebug("AI JSON'ından ve menüden doğrulanan/oluşturulan geçerli sepet:", siparisSepetiGonderilecek);

          // Konuşma Metni
          if (parsedAI.konusma_metni && typeof parsedAI.konusma_metni === 'string' && parsedAI.konusma_metni.trim()) {
            konusmaMetni = parsedAI.konusma_metni;
            logInfo("AI'dan özel konuşma metni alındı:", konusmaMetni);
          } else { // AI konuşma metni vermezse, sepet üzerinden oluştur
            const itemsSummary = siparisSepetiGonderilecek.map(item => `${item.adet} ${item.urun}`).join(' ve ');
            const toplamTutarHesaplanan = siparisSepetiGonderilecek.reduce((sum, item) => sum + (item.adet * item.fiyat), 0);
            
            konusmaMetni = itemsSummary
              ? `${itemsSummary} siparişinizi aldım. Toplam tutarınız ${toplamTutarHesaplanan.toFixed(2)} TL.`
              : "Siparişinizde geçerli ürün bulunamadı.";
            if (parsedAI.musteri_notu) {
              konusmaMetni += ` Notunuz: ${parsedAI.musteri_notu}`;
            }
          }
        } else { // AI sepet döndürmezse veya sepet boşsa
          logWarn("AI JSON yanıtında geçerli 'sepet' alanı yok veya sepet boş. AI'ın konuşma metni veya ham yanıtı kullanılacak.");
          konusmaMetni = parsedAI.konusma_metni || (typeof aiHamYanit === 'string' ? aiHamYanit : "Siparişinizi şuan için işleyemedim, lütfen daha net bir şekilde tekrar eder misiniz?");
          siparisSepetiGonderilecek = [];
        }
      } catch (parseError) { // AI yanıtı JSON değilse
        logWarn("AI yanıtı JSON olarak parse edilemedi, ham yanıt metin olarak kabul edilecek.", parseError);
        konusmaMetni = aiHamYanit; // AI'ın ham metnini konuşma metni olarak kullan
        siparisSepetiGonderilecek = []; // Bu durumda sipariş sepeti olmayacak
      }

      // Geçmişi güncelle (Neso'nun cevabıyla)
      setGecmis((prev) => prev.map((g, i) => i === prev.length - 1 ? { ...g, cevap: konusmaMetni, type: 'neso' } : g));

      logInfo("Adım 2: Oluşturulan/Alınan konuşma metni seslendiriliyor...");
      await sesliYanıtVer(konusmaMetni);

      logInfo("Adım 3: Sipariş sepeti kontrol ediliyor...");
      logDebug("Backend'e gönderilecek son sepet:", siparisSepetiGonderilecek);

      // Adım 4: Siparişi Backend'e Gönder
      if (siparisSepetiGonderilecek && siparisSepetiGonderilecek.length > 0) {
        logInfo(`📦 Geçerli sipariş (${siparisSepetiGonderilecek.length} çeşit) bulundu, backend'e kaydediliyor...`);
        const siparisData = {
          masa: String(masaId), // String olduğundan emin ol
          istek: kullaniciMesaji,
          yanit: aiHamYanit, // AI'ın ham yanıtı (JSON veya metin)
          sepet: siparisSepetiGonderilecek.map(item => ({ // Backend'in beklediği formatta gönder
            urun: item.urun, // Orjinal ürün adı
            adet: item.adet, // Number
            fiyat: item.fiyat, // Number
            kategori: item.kategori // String
          }))
        };

        // Payload'ı logla (SORUN GİDERME İÇİN EN ÖNEMLİ NOKTA)
        logDebug("Sipariş API'ye gönderiliyor (/siparis-ekle), Payload:", JSON.stringify(siparisData, null, 2));

        try {
          const siparisRes = await axios.post(`${API_BASE}/siparis-ekle`, siparisData, {
            headers: { "Content-Type": "application/json" }
          });
          logInfo(`✅ Sipariş başarıyla kaydedildi. Backend Yanıtı:`, siparisRes.data);
          setSiparisDurumu("bekliyor"); // Sipariş başarılı ise durumu 'bekliyor' yap
        } catch (siparisHata) {
          logError("❌ Sipariş kaydetme API hatası:", siparisHata.response || siparisHata);
          // Detaylı hata mesajını backend'den almaya çalış
          let hataDetayi = "Bilinmeyen API hatası.";
          if (siparisHata.response && siparisHata.response.data) {
            if (typeof siparisHata.response.data.detail === 'string') {
                hataDetayi = siparisHata.response.data.detail;
            } else if (Array.isArray(siparisHata.response.data.detail)) { // Pydantic validasyon hataları için
                hataDetayi = siparisHata.response.data.detail.map(err => `${err.loc.join(' -> ')}: ${err.msg}`).join(', ');
            } else if (typeof siparisHata.response.data === 'string') {
                hataDetayi = siparisHata.response.data;
            }
          } else if (siparisHata.message) {
            hataDetayi = siparisHata.message;
          }
          setHataMesaji(`Siparişiniz kaydedilemedi: ${hataDetayi}`);
          setGecmis((prev) => [...prev, { type: 'hata', soru: "", cevap: `Sipariş gönderilemedi: ${hataDetayi}` }]);
        }
      } else {
        logInfo("ℹ️ AI yanıtından kaydedilecek bir sipariş oluşturulamadı.");
      }

    } catch (error) { // Genel /yanitla veya diğer işlem hataları
      logError("❌ Mesaj gönderme/işleme genel hatası:", error);
      const hataDetayi = error.response?.data?.detail || error.message || "Bilinmeyen bir hata oluştu.";
      setHataMesaji(`İşlem sırasında bir hata oluştu: ${hataDetayi}`);
      // Eğer Neso'nun cevabı hala "..." ise, hata mesajıyla güncelle
      setGecmis((prev) => prev.map((g, i) => i === prev.length - 1 && g.cevap === "..." ? { ...g, cevap: `Üzgünüm, bir hata oluştu. (${hataDetayi})`, type: 'hata' } : g));
    } finally {
      logInfo("Adım 5: İşlem tamamlandı (finally).");
      setLoading(false);
    }
  }, [mesaj, loading, audioPlaying, micActive, API_BASE, masaId, sesliYanıtVer, menuUrunler, logInfo, logError, logWarn, logDebug]);


  // --- Ses Tanıma Fonksiyonları ---
  const sesiDinle = useCallback(() => {
    if (!SpeechRecognition) { logError("🚫 Tarayıcı ses tanımayı desteklemiyor."); alert("Tarayıcı ses tanımayı desteklemiyor."); return; }
    if (micActive && recognitionRef.current) {
      logInfo("🎤 Mikrofon kapatılıyor (manuel).");
      try { recognitionRef.current.stop(); } catch (e) { logError("Mic stop hatası", e); }
      // onend tetiklenecek ve micActive'i false yapacak
      return;
    }
    if (audioPlaying) { // Konuşma sırasında mikrofonu açma
        logWarn("🎤 Ses oynatılırken mikrofon açılamaz.");
        return;
    }

    logInfo("🎤 Mikrofon başlatılıyor..."); setHataMesaji(null);
    try {
      const recognizer = new SpeechRecognition();
      recognitionRef.current = recognizer;
      recognizer.lang = "tr-TR";
      recognizer.continuous = false; // Tek seferlik tanıma için false daha iyi
      recognizer.interimResults = false; // Sadece kesin sonuçları al
      recognizer.onstart = () => { logInfo("🎤 Dinleme başladı."); setMicActive(true); };
      recognizer.onresult = async (event) => {
        const transcript = event.results[0][0].transcript;
        logInfo(`👂 Ses tanıma sonucu: "${transcript}"`);
        // setMesaj(transcript); // Input'u doldurmak yerine doğrudan gönderelim
        await gonder(transcript); // Tanınan sesi doğrudan gönder
      };
      recognizer.onerror = (event) => {
        logError("🎤 Ses tanıma hatası:", event.error);
        let errorMsg = `Ses tanıma hatası: ${event.error}`;
        if (event.error === 'no-speech') {
            errorMsg = "Ses algılanamadı, lütfen tekrar deneyin.";
        } else if (event.error === 'audio-capture') {
            errorMsg = "Mikrofon erişim sorunu. Lütfen izinleri kontrol edin.";
        } else if (event.error === 'not-allowed') {
            errorMsg = "Mikrofon kullanımı engellendi. Lütfen izinleri kontrol edin.";
        }
        if (event.error !== 'aborted') { // Aborted kullanıcı tarafından durdurulduğunda gelir, hata sayılmaz
            setHataMesaji(errorMsg);
        }
        setMicActive(false);
        recognitionRef.current = null; // Ref'i temizle
      };
      recognizer.onend = () => {
        logInfo("🏁 Ses tanıma bitti/durduruldu.");
        setMicActive(false);
        recognitionRef.current = null; // Ref'i temizle
      };
      recognizer.start();
    } catch (err) {
      logError("🎤 Mikrofon başlatılamadı/kritik hata:", err);
      setHataMesaji("Mikrofon başlatılamadı. Lütfen sayfa için mikrofon izinlerini kontrol edin.");
      setMicActive(false);
      recognitionRef.current = null;
    }
  }, [micActive, gonder, logInfo, logError, audioPlaying, logWarn]); // audioPlaying eklendi

  // --- Ses Durdurma ---
  const durdur = useCallback(() => {
    if (audioRef.current && !audioRef.current.paused) {
      logInfo("🛑 Backend TTS konuşması durduruluyor.");
      audioRef.current.pause();
      audioRef.current.currentTime = 0; // Sesi başa sar
      // onended tetiklenecek mi? Bazen evet, bazen hayır. Manuel olarak state'i resetle.
      URL.revokeObjectURL(audioRef.current.src); // Belleği serbest bırak
      audioRef.current = null;
    }
    if (synth && synth.speaking) {
      logInfo("🛑 Tarayıcı TTS konuşması durduruldu.");
      synth.cancel();
    }
    setAudioPlaying(false); // Her durumda audioPlaying'i false yap
  }, [synth, logInfo]);

  // --- JSX Return ---
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 flex items-center justify-center p-4 font-sans">
      <div className="bg-white/10 backdrop-blur-md shadow-2xl rounded-3xl p-6 w-full max-w-md text-white border border-white/30">
        <h1 className="text-3xl font-extrabold text-center mb-2">🎙️ Neso Asistan</h1>
        <p className="text-center mb-4 opacity-80">Masa No: <span className="font-semibold">{masaId}</span></p>

        {hataMesaji && (
          <div className="bg-red-500/80 border border-red-700 text-white px-4 py-2 rounded-lg mb-4 text-sm text-center shadow-lg break-words">
            {hataMesaji}
          </div>
        )}

        {getDurumText(siparisDurumu) && (
          <div className={`px-4 py-2 rounded-lg mb-4 text-sm text-center font-semibold shadow ${siparisDurumu === 'hazir' ? 'bg-green-500/90' :
              siparisDurumu === 'hazirlaniyor' ? 'bg-blue-500/90 animate-pulse' :
                siparisDurumu === 'iptal' ? 'bg-red-600/90' :
                  'bg-yellow-500/90'
            }`}
          >
            {getDurumText(siparisDurumu)}
          </div>
        )}

        <input
          type="text"
          value={mesaj}
          onChange={(e) => setMesaj(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !loading && !audioPlaying && !micActive) gonder(); }}
          onFocus={handleInputFocus}
          placeholder={micActive ? "Dinleniyor..." : (!karsilamaYapildi ? "Merhaba! Başlamak için tıklayın..." : "Konuşun veya yazın...")}
          className="w-full p-3 mb-4 rounded-xl bg-white/20 placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/80 transition duration-200 shadow-inner"
          disabled={loading || audioPlaying || micActive}
        />

        <div className="flex gap-3 mb-4">
          <button
            onClick={() => gonder()}
            disabled={loading || audioPlaying || !mesaj.trim() || micActive}
            className={`flex-1 py-3 rounded-xl font-bold transition duration-200 ease-in-out active:scale-95 shadow hover:shadow-md flex items-center justify-center ${loading || audioPlaying || !mesaj.trim() || micActive
                ? "bg-gray-500/50 text-white/50 cursor-not-allowed"
                : "bg-green-500/80 hover:bg-green-600/90 text-white"
              }`}
            aria-label="Mesajı Gönder"
          >
            {loading ? <span className="animate-pulse">⏳</span> : "🚀 Gönder"}
          </button>
          <button
            onClick={sesiDinle}
            disabled={loading || audioPlaying || !SpeechRecognition} // SpeechRecognition yoksa veya işlem varsa disable
            className={`py-3 px-5 rounded-xl font-bold transition duration-200 ease-in-out active:scale-95 shadow hover:shadow-md flex items-center justify-center ${micActive ? "bg-red-600 hover:bg-red-700 text-white animate-ping" : "bg-blue-500/80 hover:bg-blue-600/90 text-white"
              } ${loading || audioPlaying || !SpeechRecognition ? "opacity-50 cursor-not-allowed" : ""}`}
            aria-label={micActive ? "Dinlemeyi Durdur" : "Sesli Komut Ver"}
            title={!SpeechRecognition ? "Tarayıcı bu özelliği desteklemiyor" : (micActive ? "Dinlemeyi Durdur" : "Sesli Komut Ver")}
          >
            {micActive ? "🔴" : "🎤"}
          </button>
        </div>

        <button
          onClick={durdur}
          disabled={!audioPlaying}
          className={`w-full py-2 mb-4 rounded-xl font-bold transition duration-200 ease-in-out active:scale-95 shadow hover:shadow-md ${audioPlaying ? "bg-orange-500/80 hover:bg-orange-600/90 text-white" : "bg-gray-500/50 text-white/50 cursor-not-allowed"
            }`}
          aria-label="Neso'nun konuşmasını durdur"
        >
          🛑 Konuşmayı Durdur
        </button>

        <div
          ref={mesajKutusuRef}
          className="h-64 overflow-y-auto space-y-3 bg-black/20 p-3 rounded-xl scrollbar-thin scrollbar-thumb-white/30 scrollbar-track-transparent scrollbar-corner-transparent shadow-inner"
          aria-live="polite"
        >
          {gecmis.map((g, i) => (
            <div key={i} className="flex flex-col">
              {g.type === 'user' && g.soru && (
                <div className="bg-blue-500/70 p-2.5 rounded-lg rounded-br-none self-end max-w-[85%] mb-1 shadow">
                  <span className="font-semibold text-xs opacity-90 block mb-0.5 text-blue-100">Siz</span>
                  <span className="text-sm break-words">{g.soru}</span>
                </div>
              )}
              {g.type === 'neso' && g.cevap && (
                <div className={`bg-gray-700/70 p-2.5 rounded-lg ${ (i > 0 && gecmis[i-1]?.type === 'user' && gecmis[i-1]?.soru) ? 'rounded-bl-none' : 'rounded-b-lg'} self-start max-w-[85%] shadow`}>
                  <span className="font-semibold text-xs opacity-90 block mb-0.5 text-gray-300">Neso</span>
                  <span className="text-sm break-words">{g.cevap === "..." ? <span className="animate-pulse">Yazıyor...</span> : g.cevap}</span>
                </div>
              )}
              {g.type === 'hata' && g.cevap && (
                <div className="bg-red-500/80 p-2.5 rounded-lg self-start max-w-[85%] shadow my-1">
                  <span className="font-semibold text-xs opacity-90 block mb-0.5 text-red-100">Sistem</span>
                  <span className="text-sm break-words">{g.cevap}</span>
                </div>
              )}
            </div>
          ))}
          {loading && gecmis.length > 0 && gecmis[gecmis.length-1]?.cevap === "..." && (
            <div className="text-left text-sm opacity-70 animate-pulse py-1 self-start max-w-[85%]">
              <div className="bg-gray-700/70 p-2.5 rounded-lg rounded-b-lg">
                <span className="font-semibold text-xs opacity-90 block text-gray-300">Neso</span>
                <span>Yazıyor...</span>
              </div>
            </div>
          )}
          {loading && gecmis.length === 0 && (
            <div className="text-center text-sm opacity-70 animate-pulse py-4">Bağlanılıyor veya yanıt bekleniyor...</div>
          )}
        </div>
        <p className="text-center text-xs opacity-60 mt-6">☕ Neso Asistan v1.4 © {new Date().getFullYear()}</p> {/* Versiyon güncellendi */}
      </div>
    </div>
  );
}

export default MasaAsistani;