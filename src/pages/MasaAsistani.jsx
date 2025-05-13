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
  const [menuUrunler, setMenuUrunler] = useState([]);
  const [karsilamaYapildi, setKarsilamaYapildi] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(`karsilama_yapildi_${masaId}`) === 'true';
  });
  const [siparisDurumu, setSiparisDurumu] = useState(null);
  const [hataMesaji, setHataMesaji] = useState(null);

  // --- YENİ STATE'LER (Sipariş İptali İçin) ---
  const [aktifSiparis, setAktifSiparis] = useState(null); // { id: null, zaman: null, iptalEdilemez: false }
  const [iptalKalanSure, setIptalKalanSure] = useState(0); // Saniye cinsinden
  const [iptalLoading, setIptalLoading] = useState(false); // İptal işlemi için ayrı bir yükleme durumu

  // --- Referanslar ---
  const audioRef = useRef(null);
  const mesajKutusuRef = useRef(null);
  const wsRef = useRef(null);
  const recognitionRef = useRef(null);

  // --- Yardımcı Fonksiyonlar ---
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
    const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
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
        const wsUrl = `${wsProtocol}//${wsHost}/ws/mutfak?masa_id=${masaId}`;
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
              const { masa, durum: newDurum, id: siparisIdWS } = message.data;
              if (String(masa) === String(masaId)) {
                logInfo(`📊 Durum güncellemesi: Masa ${masaId}, Sipariş ID (WS): ${siparisIdWS}, Yeni Durum: ${newDurum}`);
                setSiparisDurumu(newDurum);
                if (aktifSiparis && aktifSiparis.id === siparisIdWS && (newDurum === 'iptal' || newDurum === 'hazir')) {
                  logInfo(`Aktif sipariş (ID: ${aktifSiparis.id}) durumu '${newDurum}' olarak güncellendi, iptal bilgileri temizleniyor.`);
                  setAktifSiparis(null);
                  setIptalKalanSure(0);
                }
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
          if (event.code !== 1000 && event.code !== 1001 && !event.wasClean) {
            logInfo("WebSocket beklenmedik şekilde kapandı, 5 saniye sonra tekrar denenecek...");
            setTimeout(connectWebSocket, 5000 + Math.random() * 1000);
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
      } else if (API_BASE && !wsRef.current) {
        logWarn("Ping: WebSocket bağlantısı aktif değil, yeniden bağlantı deneniyor.");
        connectWebSocket();
      }
    }, 30000);
    return () => {
      clearInterval(pingInterval);
      if (wsRef.current) {
        logInfo("Component kaldırılıyor, WebSocket kapatılıyor (normal kapanış).");
        wsRef.current.close(1000, "Component unmounting");
        wsRef.current = null;
      }
    };
  }, [API_BASE, masaId, logInfo, logError, logWarn, logDebug, aktifSiparis]);

  // --- Menü Verisini Çekme ---
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
              stok_durumu: u.stok_durumu === undefined ? 1 : Number(u.stok_durumu),
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
      if (!res.data || res.data.byteLength < 100) {
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
        setHataMesaji("Ses dosyası otomatik oynatılamadı. Lütfen tekrar deneyin veya sayfaya tıklayın.");
        return;
      }
      audio.onended = () => { logInfo("🏁 Sesli yanıt bitti."); setAudioPlaying(false); URL.revokeObjectURL(url); audioRef.current = null; };
      audio.onerror = (err) => { logError("Ses çalma hatası (onerror):", err); setAudioPlaying(false); URL.revokeObjectURL(url); audioRef.current = null; setHataMesaji("Sesli yanıt oynatılamadı."); };
    } catch (error) {
      logError("❌ TTS API isteği veya ses işleme hatası:", error); setAudioPlaying(false);
      const hataMesajiDetay = error.response?.data?.detail || error.message || "Bilinmeyen TTS hatası.";
      setHataMesaji(`Sesli yanıt alınamadı: ${hataMesajiDetay}`);
      if (synth && text && SpeechRecognition) {
        logWarn("⚠️ Fallback TTS (tarayıcı) kullanılıyor.");
        try {
          synth.cancel(); const utt = new SpeechSynthesisUtterance(text); utt.lang = "tr-TR";
          utt.onend = () => { logInfo("🏁 Fallback TTS (tarayıcı) bitti."); setAudioPlaying(false); };
          utt.onerror = (errEvent) => { logError("Fallback TTS (tarayıcı) hatası:", errEvent); setAudioPlaying(false); };
          setAudioPlaying(true); synth.speak(utt);
        } catch (ttsError) { logError("Fallback TTS hatası:", ttsError); setAudioPlaying(false); }
      }
    }
  }, [API_BASE, masaId, logInfo, logError, logWarn, logDebug, synth]);

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
    if (!kullaniciMesaji || loading || audioPlaying || micActive || iptalLoading) return;

    logInfo(`➡️ Mesaj gönderiliyor: "${kullaniciMesaji}"`);
    setLoading(true); setMesaj(""); setHataMesaji(null);
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

      try {
        const parsedAI = JSON.parse(aiHamYanit);
        logInfo("AI yanıtı JSON olarak BAŞARIYLA parse edildi.", parsedAI);

        if (parsedAI.sepet && Array.isArray(parsedAI.sepet) && parsedAI.sepet.length > 0) {
          siparisSepetiGonderilecek = parsedAI.sepet.map(item => {
            const menuUrun = menuUrunler.find(m => m.ad === String(item.urun || "").toLowerCase().trim());
            return {
              urun: menuUrun ? menuUrun.orjinalAd : String(item.urun || "Bilinmeyen Ürün").trim(),
              adet: parseInt(item.adet, 10) || 0,
              fiyat: menuUrun ? menuUrun.fiyat : parseFloat(item.fiyat) || 0,
              kategori: menuUrun ? menuUrun.kategori : String(item.kategori || "Bilinmeyen Kategori").trim()
            };
          }).filter(item => item.adet > 0 && item.urun !== "Bilinmeyen Ürün");
          logDebug("AI JSON'ından ve menüden doğrulanan/oluşturulan geçerli sepet:", siparisSepetiGonderilecek);

          if (parsedAI.konusma_metni && typeof parsedAI.konusma_metni === 'string' && parsedAI.konusma_metni.trim()) {
            konusmaMetni = parsedAI.konusma_metni;
            logInfo("AI'dan özel konuşma metni alındı:", konusmaMetni);
          } else {
            const itemsSummary = siparisSepetiGonderilecek.map(item => `${item.adet} ${item.urun}`).join(' ve ');
            const toplamTutarHesaplanan = siparisSepetiGonderilecek.reduce((sum, item) => sum + (item.adet * item.fiyat), 0);
            konusmaMetni = itemsSummary
              ? `${itemsSummary} siparişinizi aldım. Toplam tutarınız ${toplamTutarHesaplanan.toFixed(2)} TL.`
              : "Siparişinizde geçerli ürün bulunamadı.";
            if (parsedAI.musteri_notu) {
              konusmaMetni += ` Notunuz: ${parsedAI.musteri_notu}`;
            }
          }
        } else {
          logWarn("AI JSON yanıtında geçerli 'sepet' alanı yok veya sepet boş. AI'ın konuşma metni veya ham yanıtı kullanılacak.");
          konusmaMetni = parsedAI.konusma_metni || (typeof aiHamYanit === 'string' ? aiHamYanit : "Siparişinizi şuan için işleyemedim, lütfen daha net bir şekilde tekrar eder misiniz?");
          siparisSepetiGonderilecek = [];
        }
      } catch (parseError) {
        logWarn("AI yanıtı JSON olarak parse edilemedi, ham yanıt metin olarak kabul edilecek.", parseError);
        konusmaMetni = aiHamYanit;
        siparisSepetiGonderilecek = [];
      }

      setGecmis((prev) => prev.map((g, i) => i === prev.length - 1 ? { ...g, cevap: konusmaMetni, type: 'neso' } : g));
      logInfo("Adım 2: Oluşturulan/Alınan konuşma metni seslendiriliyor...");
      await sesliYanıtVer(konusmaMetni);
      logInfo("Adım 3: Sipariş sepeti kontrol ediliyor...");
      logDebug("Backend'e gönderilecek son sepet:", siparisSepetiGonderilecek);

      if (siparisSepetiGonderilecek && siparisSepetiGonderilecek.length > 0) {
        logInfo(`📦 Geçerli sipariş (${siparisSepetiGonderilecek.length} çeşit) bulundu, backend'e kaydediliyor...`);
        const siparisData = {
          masa: String(masaId),
          istek: kullaniciMesaji,
          yanit: aiHamYanit,
          sepet: siparisSepetiGonderilecek.map(item => ({
            urun: item.urun,
            adet: item.adet,
            fiyat: item.fiyat,
            kategori: item.kategori
          }))
        };
        logDebug("Sipariş API'ye gönderiliyor (/siparis-ekle), Payload:", JSON.stringify(siparisData, null, 2));
        try {
          const siparisRes = await axios.post(`${API_BASE}/siparis-ekle`, siparisData, {
            headers: { "Content-Type": "application/json" }
          });
          logInfo(`✅ Sipariş başarıyla kaydedildi. Backend Yanıtı:`, siparisRes.data);
          setSiparisDurumu("bekliyor");
          
          // --- GÜNCELLENDİ: Aktif sipariş bilgilerini sakla (Backend'den gelen zaman ile) ---
          if (siparisRes.data && siparisRes.data.siparisId) {
            setAktifSiparis({
              id: siparisRes.data.siparisId,
              zaman: siparisRes.data.zaman || new Date().toISOString(), // Backend'den gelen zamanı kullan, yoksa fallback
              iptalEdilemez: false
            });
            setIptalKalanSure(120); // 2 dakika ile başlat
            logInfo(`Aktif sipariş ayarlandı: ID ${siparisRes.data.siparisId}, Zaman: ${siparisRes.data.zaman || 'Frontend Saati'}`);
          }
          // --- BİTTİ: Aktif sipariş bilgilerini sakla ---

        } catch (siparisHata) {
          logError("❌ Sipariş kaydetme API hatası:", siparisHata.response || siparisHata);
          let hataDetayi = "Bilinmeyen API hatası.";
          if (siparisHata.response && siparisHata.response.data) {
            if (typeof siparisHata.response.data.detail === 'string') {
              hataDetayi = siparisHata.response.data.detail;
            } else if (Array.isArray(siparisHata.response.data.detail)) {
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
    } catch (error) {
      logError("❌ Mesaj gönderme/işleme genel hatası:", error);
      const hataDetayi = error.response?.data?.detail || error.message || "Bilinmeyen bir hata oluştu.";
      setHataMesaji(`İşlem sırasında bir hata oluştu: ${hataDetayi}`);
      setGecmis((prev) => prev.map((g, i) => i === prev.length - 1 && g.cevap === "..." ? { ...g, cevap: `Üzgünüm, bir hata oluştu. (${hataDetayi})`, type: 'hata' } : g));
    } finally {
      logInfo("Adım 5: İşlem tamamlandı (finally).");
      setLoading(false);
    }
  }, [mesaj, loading, audioPlaying, micActive, API_BASE, masaId, sesliYanıtVer, menuUrunler, logInfo, logError, logWarn, logDebug, iptalLoading]);


  // --- Ses Tanıma Fonksiyonları ---
  const sesiDinle = useCallback(() => {
    if (!SpeechRecognition) { logError("🚫 Tarayıcı ses tanımayı desteklemiyor."); alert("Tarayıcı ses tanımayı desteklemiyor."); return; }
    if (micActive && recognitionRef.current) {
      logInfo("🎤 Mikrofon kapatılıyor (manuel).");
      try { recognitionRef.current.stop(); } catch (e) { logError("Mic stop hatası", e); }
      return;
    }
    if (audioPlaying) {
        logWarn("🎤 Ses oynatılırken mikrofon açılamaz.");
        return;
    }
    logInfo("🎤 Mikrofon başlatılıyor..."); setHataMesaji(null);
    try {
      const recognizer = new SpeechRecognition();
      recognitionRef.current = recognizer;
      recognizer.lang = "tr-TR";
      recognizer.continuous = false;
      recognizer.interimResults = false;
      recognizer.onstart = () => { logInfo("🎤 Dinleme başladı."); setMicActive(true); };
      recognizer.onresult = async (event) => {
        const transcript = event.results[0][0].transcript;
        logInfo(`👂 Ses tanıma sonucu: "${transcript}"`);
        await gonder(transcript);
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
        if (event.error !== 'aborted') { // Aborted kullanıcı tarafından durdurulduğunda gelir
            setHataMesaji(errorMsg);
        }
        // setMicActive(false) ve recognitionRef.current = null onend içinde zaten yapılıyor
      };
      recognizer.onend = () => {
        logInfo("🏁 Ses tanıma bitti/durduruldu.");
        setMicActive(false);
        recognitionRef.current = null;
      };
      recognizer.start();
    } catch (err) {
      logError("🎤 Mikrofon başlatılamadı/kritik hata:", err);
      setHataMesaji("Mikrofon başlatılamadı. Lütfen sayfa için mikrofon izinlerini kontrol edin.");
      setMicActive(false);
      recognitionRef.current = null;
    }
  }, [micActive, gonder, logInfo, logError, audioPlaying, logWarn]);

  // --- Ses Durdurma ---
  const durdur = useCallback(() => {
    if (audioRef.current && !audioRef.current.paused) {
      logInfo("🛑 Backend TTS konuşması durduruluyor.");
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      if (audioRef.current.src.startsWith('blob:')) { // Sadece blob URL ise revoke et
        URL.revokeObjectURL(audioRef.current.src);
      }
      audioRef.current = null;
    }
    if (synth && synth.speaking) {
      logInfo("🛑 Tarayıcı TTS konuşması durduruldu.");
      synth.cancel();
    }
    setAudioPlaying(false);
  }, [synth, logInfo]);

  // --- Sipariş İptal Süresi Takibi ---
  useEffect(() => {
    let intervalId = null;
    if (aktifSiparis && aktifSiparis.zaman && !aktifSiparis.iptalEdilemez && (siparisDurumu === 'bekliyor' || siparisDurumu === 'hazirlaniyor')) {
      logDebug(`İptal süresi takibi başlatılıyor. Sipariş Zamanı: ${aktifSiparis.zaman}`);
      intervalId = setInterval(() => {
        const olusturmaZamaniMs = new Date(aktifSiparis.zaman).getTime();
        const simdiMs = new Date().getTime();
        const gecenSureSn = Math.floor((simdiMs - olusturmaZamaniMs) / 1000);
        const kalanSn = 120 - gecenSureSn;

        if (kalanSn > 0) {
          setIptalKalanSure(kalanSn);
        } else {
          setIptalKalanSure(0);
          logInfo(`Sipariş ${aktifSiparis.id} için iptal süresi doldu (useEffect).`);
          setAktifSiparis(prev => prev ? { ...prev, iptalEdilemez: true } : null);
          if (intervalId) clearInterval(intervalId);
        }
      }, 1000);
    } else {
      setIptalKalanSure(0);
    }
    return () => {
      if (intervalId) {
        logDebug("İptal süresi takibi temizleniyor.");
        clearInterval(intervalId);
      }
    };
  }, [aktifSiparis, siparisDurumu, logDebug, logInfo]);

  // --- Sipariş İptal Fonksiyonu ---
  const handleSiparisIptal = async () => {
    if (!aktifSiparis || !aktifSiparis.id) {
      logWarn("İptal edilecek aktif sipariş ID'si bulunamadı.");
      setHataMesaji("İptal edilecek sipariş bulunamadı.");
      return;
    }
    if (aktifSiparis.iptalEdilemez || iptalKalanSure <= 0) {
        logWarn(`Sipariş ${aktifSiparis.id} için iptal süresi dolmuş veya iptal edilemez durumda.`);
        setHataMesaji("Bu sipariş artık iptal edilemez.");
        return;
    }

    logInfo(`Sipariş iptal isteği gönderiliyor: ID ${aktifSiparis.id}, Masa No: ${masaId}`);
    setIptalLoading(true);
    setHataMesaji(null);

    try {
      // --- GÜNCELLENDİ: Yeni müşteri iptal endpoint'ine istek ---
      const response = await axios.post(`${API_BASE}/musteri/siparis/${aktifSiparis.id}/iptal?masa_no=${masaId}`);
      logInfo("Sipariş iptal yanıtı:", response.data);
      
      // WebSocket'ten durum güncellemesi beklenecek olsa da, kullanıcıya hemen geri bildirim verelim.
      setSiparisDurumu('iptal');
      const iptalMesaji = response.data.message || "Siparişiniz başarıyla iptal edildi.";
      setGecmis(prev => [...prev, { type: 'neso', soru: "", cevap: iptalMesaji }]);
      await sesliYanıtVer(iptalMesaji);

      setAktifSiparis(null);
      setIptalKalanSure(0);

    } catch (error) {
      logError("Sipariş iptal hatası:", error.response || error);
      const hataDetayi = error.response?.data?.detail || error.message || "Sipariş iptal edilemedi.";
      setHataMesaji(hataDetayi);
      setGecmis(prev => [...prev, { type: 'hata', soru: "", cevap: `Sipariş iptal edilemedi: ${hataDetayi}` }]);
      await sesliYanıtVer(`Üzgünüm, siparişiniz iptal edilirken bir sorun oluştu. Lütfen yetkililere bildirin.`); // Hata detayını seslendirmek yerine genel mesaj
    } finally {
      setIptalLoading(false);
    }
  };


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
        
        {aktifSiparis && aktifSiparis.id && !aktifSiparis.iptalEdilemez && iptalKalanSure > 0 && (siparisDurumu === 'bekliyor' || siparisDurumu === 'hazirlaniyor') && (
          <div className="my-3">
            <button
              onClick={handleSiparisIptal}
              disabled={iptalLoading || loading || audioPlaying || micActive}
              className={`w-full py-2.5 rounded-xl font-semibold text-white bg-red-500/90 hover:bg-red-600/90 transition duration-200 ease-in-out active:scale-95 shadow hover:shadow-md ${iptalLoading || loading ? "opacity-70 cursor-not-allowed" : ""}`}
            >
              {iptalLoading ? <span className="animate-pulse">İptal Ediliyor...</span> : `Siparişi İptal Et (${Math.floor(iptalKalanSure / 60)}:${(iptalKalanSure % 60).toString().padStart(2, '0')})`}
            </button>
          </div>
        )}
        {aktifSiparis && aktifSiparis.iptalEdilemez && (siparisDurumu === 'bekliyor' || siparisDurumu === 'hazirlaniyor') && iptalKalanSure <=0 && (
          <p className="text-xs text-center text-amber-300 my-2">Bu sipariş için iptal süresi dolmuştur.</p>
        )}

        <input
          type="text"
          value={mesaj}
          onChange={(e) => setMesaj(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !loading && !audioPlaying && !micActive && !iptalLoading) gonder(); }}
          onFocus={handleInputFocus}
          placeholder={micActive ? "Dinleniyor..." : (!karsilamaYapildi ? "Merhaba! Başlamak için tıklayın..." : "Konuşun veya yazın...")}
          className="w-full p-3 mb-4 rounded-xl bg-white/20 placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/80 transition duration-200 shadow-inner"
          disabled={loading || audioPlaying || micActive || iptalLoading}
        />

        <div className="flex gap-3 mb-4">
          <button
            onClick={() => gonder()}
            disabled={loading || audioPlaying || !mesaj.trim() || micActive || iptalLoading}
            className={`flex-1 py-3 rounded-xl font-bold transition duration-200 ease-in-out active:scale-95 shadow hover:shadow-md flex items-center justify-center ${loading || audioPlaying || !mesaj.trim() || micActive || iptalLoading
                ? "bg-gray-500/50 text-white/50 cursor-not-allowed"
                : "bg-green-500/80 hover:bg-green-600/90 text-white"
              }`}
            aria-label="Mesajı Gönder"
          >
            {loading ? <span className="animate-pulse">⏳</span> : "🚀 Gönder"}
          </button>
          <button
            onClick={sesiDinle}
            disabled={loading || audioPlaying || !SpeechRecognition || iptalLoading}
            className={`py-3 px-5 rounded-xl font-bold transition duration-200 ease-in-out active:scale-95 shadow hover:shadow-md flex items-center justify-center ${micActive ? "bg-red-600 hover:bg-red-700 text-white animate-ping" : "bg-blue-500/80 hover:bg-blue-600/90 text-white"
              } ${loading || audioPlaying || !SpeechRecognition || iptalLoading ? "opacity-50 cursor-not-allowed" : ""}`}
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
        <p className="text-center text-xs opacity-60 mt-6">☕ Neso Asistan v1.6 © {new Date().getFullYear()}</p> {/* Versiyon güncellendi */}
      </div>
    </div>
  );
}

export default MasaAsistani;