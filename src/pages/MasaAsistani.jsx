import React, { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { useParams } from "react-router-dom";
import NesoLogo from '../NesoLogo.svg'; // Logo doğru yolda olmalı

// Tarayıcı API'ları (varsa)
const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
const SpeechRecognition = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;

// REACT_APP_API_BASE ortam değişkeninden API adresini al
const API_BASE = process.env.REACT_APP_API_BASE;

// --- İkonlar ---
const SendIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
  </svg>
);

const MicIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
  </svg>
);

const StopSoundIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 9.563C9 9.252 9.252 9 9.563 9h4.874c.311 0 .563.252.563.563v4.874c0 .311-.252.563-.563.563H9.564A.562.562 0 019 14.437V9.564z" />
  </svg>
);

const LoadingSpinner = () => (
  <div className="flex items-center justify-center space-x-1">
    <span className="h-1.5 w-1.5 bg-current rounded-full animate-pulse delay-75"></span>
    <span className="h-1.5 w-1.5 bg-current rounded-full animate-pulse delay-150"></span>
    <span className="h-1.5 w-1.5 bg-current rounded-full animate-pulse delay-200"></span>
  </div>
);

function MasaAsistani() {
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
  const [aktifSiparis, setAktifSiparis] = useState(null);
  const [iptalKalanSure, setIptalKalanSure] = useState(0);
  const [iptalLoading, setIptalLoading] = useState(false);
  const [lastAiResponseData, setLastAiResponseData] = useState(null);

  const audioRef = useRef(null);
  const mesajKutusuRef = useRef(null);
  const wsRef = useRef(null);
  const recognitionRef = useRef(null);

  const getDurumTextAndStyle = (durum) => {
    switch (durum) {
      case 'bekliyor': return { text: 'Siparişiniz Alındı, Bekliyor...', style: 'bg-amber-500/90 text-white', icon: '⏳' };
      case 'hazirlaniyor': return { text: 'Siparişiniz Hazırlanıyor...', style: 'bg-sky-500/90 text-white animate-pulse', icon: '👨‍🍳' };
      case 'hazir': return { text: 'Siparişiniz Hazır! Afiyet olsun.', style: 'bg-green-500/90 text-white', icon: '✅' };
      case 'iptal': return { text: 'Siparişiniz İptal Edildi.', style: 'bg-red-600/90 text-white', icon: '❌' };
      case 'odendi': return { text: 'Siparişiniz Ödendi. Teşekkürler!', style: 'bg-purple-500/90 text-white', icon: '🛍️' };
      default: return { text: null, style: '', icon: '' };
    }
  };

  const logInfo = useCallback((message, ...optionalParams) => console.info(`[Masa ${masaId}] INFO: ${message}`, ...optionalParams), [masaId]);
  const logError = useCallback((message, error, ...optionalParams) => console.error(`[Masa ${masaId}] ERROR: ${message}`, error || '', ...optionalParams), [masaId]);
  const logWarn = useCallback((message, ...optionalParams) => console.warn(`[Masa ${masaId}] WARN: ${message}`, ...optionalParams), [masaId]);
  const logDebug = useCallback((message, ...optionalParams) => console.debug(`[Masa ${masaId}] DEBUG: ${message}`, ...optionalParams), [masaId]);

  useEffect(() => {
    document.title = `Neso Asistan - Masa ${masaId} | Fıstık Kafe`;
  }, [masaId]);

  useEffect(() => {
    const connectWebSocket = () => {
      if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
        return;
      }
      if (!API_BASE) {
        logError("API_BASE tanımlı değil, WebSocket bağlantısı kurulamıyor.");
        setHataMesaji("Sunucu adresi ayarlanmamış. Lütfen yetkiliye bildirin.");
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
          logDebug("WebSocket Mesajı Geldi (Ham):", event.data);
          try {
            const message = JSON.parse(event.data);
            logInfo(`📥 WebSocket mesajı alındı (Parse Edilmiş): Tip: ${message.type}, Data:`, message.data);
            if (message.type === 'pong') {
              // logDebug("Pong alındı.");
            } else if (message.type === 'durum' && message.data) {
              const { masa, durum: newDurum, id: siparisIdWS } = message.data;
              if (String(masa) === String(masaId)) {
                logInfo(`📊 Durum güncellemesi alındı: Masa ${masaId}, Sipariş ID (WS): ${siparisIdWS}, Yeni Durum: ${newDurum}`);
                setSiparisDurumu(newDurum);
                if (aktifSiparis && String(aktifSiparis.id) === String(siparisIdWS) && (newDurum === 'iptal' || newDurum === 'hazir' || newDurum === 'odendi')) {
                  logInfo(`Aktif sipariş (ID: ${aktifSiparis.id}) durumu '${newDurum}' olarak güncellendi, iptal bilgileri ve aktif sipariş temizleniyor.`);
                  setAktifSiparis(null);
                  setIptalKalanSure(0);
                }
              } else {
                logDebug(`WS durum güncellemesi (${newDurum}) farklı bir masa (${masa}) için, mevcut masa (${masaId}) etkilenmedi.`);
              }
            } else if (message.type === 'siparis' && message.data) {
              logInfo(`ℹ️ Backend'den genel yeni sipariş yayını alındı (ID: ${message.data?.id}). Bu masa (${masaId}) için özel bir işlem yapılmıyor, 'durum' mesajı bekleniyor.`);
                // Yeni sipariş geldiğinde ve bu masaya aitse, sipariş durumunu 'bekliyor' yapabiliriz.
                // Ancak bu, 'durum' mesajıyla çakışabilir. Backend'in 'durum' mesajı göndermesi daha güvenilir.
                // if (String(message.data.masa) === String(masaId)) {
                //     setSiparisDurumu("bekliyor");
                // }
            } else {
              logWarn("⚠️ Bilinmeyen WebSocket mesaj tipi:", message);
            }
          } catch (err) {
            logError("WebSocket mesajı işlenirken hata:", err, "Ham mesaj:", event.data);
          }
        };
        wsRef.current.onerror = (errorEvent) => {
          const errorDetail = errorEvent.message || (errorEvent.target?.url ? `Bağlantı hatası: ${errorEvent.target.url}` : "Bilinmeyen WS hatası");
          logError("❌ WebSocket bağlantı hatası:", errorDetail, errorEvent);
          setHataMesaji("Sunucuyla anlık bağlantı koptu. Sayfayı yenilemeyi deneyebilirsiniz.");
        };
        wsRef.current.onclose = (event) => {
          logInfo(`🔌 WebSocket bağlantısı kapandı. Kod: ${event.code}, Sebep: ${event.reason || 'Bilinmiyor'}, Temiz mi: ${event.wasClean}`);
          wsRef.current = null;
          if (event.code !== 1000 && event.code !== 1001 && !event.wasClean) {
            logInfo("WebSocket beklenmedik şekilde kapandı, 5 saniye sonra tekrar bağlantı denenecek...");
            setTimeout(connectWebSocket, 5000 + Math.random() * 1000);
          }
        };
      } catch (error) {
        logError("❌ WebSocket bağlantısı başlatılırken kritik hata:", error);
        setHataMesaji("Sunucu bağlantısı kurulamıyor. Lütfen yetkiliye bildirin.");
      }
    };

    if (API_BASE) {
      connectWebSocket();
    }

    const pingInterval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        try {
          wsRef.current.send(JSON.stringify({ type: 'ping' }));
          // logDebug("Ping gönderildi."); // Çok sık loglamamak için kapatılabilir
        }
        catch (err) { logError("Ping gönderilirken hata:", err); }
      } else if (API_BASE && (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED)) {
        logWarn("Ping: WebSocket bağlantısı aktif değil veya kapalı, yeniden bağlantı deneniyor.");
        connectWebSocket();
      }
    }, 30000);

    return () => {
      clearInterval(pingInterval);
      if (wsRef.current) {
        logInfo("Component kaldırılıyor, WebSocket bağlantısı normal şekilde kapatılıyor (1000).");
        wsRef.current.close(1000, "Component unmounting");
        wsRef.current = null;
      }
    };
  }, [API_BASE, masaId, logInfo, logError, logWarn, logDebug, aktifSiparis]);


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
        setHataMesaji("Menü bilgileri yüklenemedi. Lütfen daha sonra tekrar deneyin.");
      }
    };
    if (API_BASE) {
      fetchMenu();
    }
  }, [API_BASE, logInfo, logError, logWarn]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const karsilamaKey = `karsilama_yapildi_${masaId}`;
      if (localStorage.getItem(karsilamaKey) === 'true') {
        setKarsilamaYapildi(true);
      }
    }
  }, [masaId]);

  useEffect(() => {
    if (mesajKutusuRef.current) {
      mesajKutusuRef.current.scrollTop = mesajKutusuRef.current.scrollHeight;
    }
  }, [gecmis]);

  const sesliYanıtVer = useCallback(async (text) => {
    if (!API_BASE) { logError("API_BASE tanımsız, sesli yanıt verilemiyor."); setHataMesaji("API adresi ayarlanmamış."); return; }
    if (!text || typeof text !== 'string' || !text.trim()) { logWarn("Seslendirilecek geçerli metin boş."); return; }
    
    logInfo(`🔊 Sesli yanıt isteği hazırlanıyor: "${text.substring(0, 50)}..."`);
    setAudioPlaying(true); setHataMesaji(null);

    try {
      logDebug(`TTS isteği gönderiliyor: URL: ${API_BASE}/sesli-yanit, Metin: "${text.substring(0, 50)}..."`);
      const res = await axios.post(`${API_BASE}/sesli-yanit`, { text: text, language: "tr-TR" }, { responseType: "arraybuffer" });
      logDebug(`TTS yanıtı alındı. Status: ${res.status}, Data length (bytes): ${res.data?.byteLength}`);

      if (!res.data || res.data.byteLength < 100) {
        throw new Error(`Sunucudan boş veya geçersiz ses verisi alındı (boyut: ${res.data?.byteLength} byte).`);
      }

      const blob = new Blob([res.data], { type: "audio/mpeg" });
      const url = URL.createObjectURL(blob);
      
      if (audioRef.current) {
        audioRef.current.pause();
        if (audioRef.current.src && audioRef.current.src.startsWith('blob:')) {
            URL.revokeObjectURL(audioRef.current.src); 
        }
        audioRef.current.src = ''; 
        audioRef.current.load(); 
        audioRef.current = null;
      }
      
      const newAudio = new Audio(url); 
      audioRef.current = newAudio; 

      await newAudio.play();
      logInfo("✅ Sesli yanıt çalınıyor.");
      
      newAudio.onended = () => { logInfo("🏁 Sesli yanıt bitti."); setAudioPlaying(false); URL.revokeObjectURL(url); audioRef.current = null; };
      newAudio.onerror = (err) => { logError("Ses çalma hatası (audio.onerror):", err); setAudioPlaying(false); URL.revokeObjectURL(url); audioRef.current = null; setHataMesaji("Sesli yanıt oynatılamadı."); };
    
    } catch (error) {
      logError("❌ TTS API isteği veya ses işleme hatası:", error.response || error); 
      setAudioPlaying(false);
      const hataMesajiDetay = error.response?.data?.detail || (error.response?.data ? new TextDecoder().decode(error.response.data) : null) || error.message || "Bilinmeyen TTS hatası.";
      setHataMesaji(`Sesli yanıt alınamadı: ${hataMesajiDetay}`);
    }
  }, [API_BASE, logInfo, logError, logWarn, logDebug]);


   const handleInputFocus = useCallback(async () => {
    if (!karsilamaYapildi && API_BASE && !audioPlaying && menuUrunler.length > 0) { 
      const karsilamaKey = `karsilama_yapildi_${masaId}`;
      const greeting = `Merhaba, ben Neso! Fıstık Kafe sipariş asistanınızım. Masa ${masaId}'ye hoş geldiniz. Size nasıl yardımcı olabilirim?`;
      logInfo("👋 Karşılama mesajı tetikleniyor (input focus)...");
      setGecmis((prev) => [...prev, { type: 'neso', soru: "", cevap: greeting, timestamp: new Date().toISOString() }]);
      try {
        await sesliYanıtVer(greeting);
        if (typeof window !== 'undefined') { localStorage.setItem(karsilamaKey, 'true'); }
        setKarsilamaYapildi(true);
      } catch (error) { 
        logError("Karşılama mesajı seslendirilemedi (input focus):", error); 
        if (typeof window !== 'undefined') { localStorage.setItem(karsilamaKey, 'true'); }
        setKarsilamaYapildi(true);
      }
    }
  }, [karsilamaYapildi, masaId, sesliYanıtVer, logInfo, logError, API_BASE, audioPlaying, menuUrunler]);


  const gonder = useCallback(async (gonderilecekMesaj) => {
    const kullaniciMesaji = (gonderilecekMesaj ?? mesaj).trim();
    if (!kullaniciMesaji || loading || audioPlaying || micActive || iptalLoading) return;

    logInfo(`➡️ Kullanıcı mesajı gönderiliyor: "${kullaniciMesaji}"`);
    setLoading(true); setMesaj(""); setHataMesaji(null);
    setGecmis((prev) => [...prev, { type: 'user', soru: kullaniciMesaji, cevap: "...", timestamp: new Date().toISOString() }]);

    let aiHamYanit = "";
    let konusmaMetniAI = "Yanıtınız işleniyor...";
    let siparisSepetiKaydedilecek = [];
    let currentAIActionStatus = null;

    try {
      logInfo("Adım 1: AI Yanıtı alınıyor...");
      if (!API_BASE) {
        logError("API_BASE tanımlı değil, AI yanıtı alınamıyor.");
        throw new Error("API adresi yapılandırılmamış.");
      }
      
      const requestPayload = {
        text: kullaniciMesaji,
        masa: masaId,
        onceki_ai_durumu: lastAiResponseData
      };
      logDebug("AI'a gönderilecek payload:", JSON.stringify(requestPayload, null, 2));

      const yanitRes = await axios.post(`${API_BASE}/yanitla`, requestPayload);
      aiHamYanit = yanitRes.data.reply || ""; 
      logInfo(`⬅️ AI yanıtı alındı (ham): "${aiHamYanit.substring(0, 250)}..."`);

      let parsedAIData = null;
      try {
        parsedAIData = JSON.parse(aiHamYanit);
        logInfo("AI yanıtı JSON olarak BAŞARIYLA parse edildi.");
        console.log("[MasaAsistani] Parse Edilmiş AI Verisi:", parsedAIData); // KONSOL LOGU EKLENDİ
        setLastAiResponseData(parsedAIData); 

        konusmaMetniAI = parsedAIData.konusma_metni || "İsteğiniz anlaşıldı, işleniyor.";
        currentAIActionStatus = parsedAIData.aksiyon_durumu || null; // AI null gönderirse null kalacak
        console.log("[MasaAsistani] AI Aksiyon Durumu:", currentAIActionStatus); // KONSOL LOGU EKLENDİ

        if (parsedAIData.sepet && Array.isArray(parsedAIData.sepet) && parsedAIData.sepet.length > 0) {
          siparisSepetiKaydedilecek = parsedAIData.sepet.map(itemFromAI => {
            const menuUrun = menuUrunler.find(m => 
                m.orjinalAd === itemFromAI.urun || 
                m.ad === String(itemFromAI.urun || "").toLowerCase().trim()
            );
            if (menuUrun && menuUrun.stok_durumu !== 0) {
              return {
                urun: menuUrun.orjinalAd,
                adet: parseInt(itemFromAI.adet, 10) || 0,
                fiyat: menuUrun.fiyat, 
                kategori: menuUrun.kategori,
                musteri_notu: itemFromAI.musteri_notu || ""
              };
            }
            logWarn(`Sepette AI tarafından gönderilen ürün '${itemFromAI.urun}' menüde bulunamadı/stokta yok, siparişten çıkarılıyor.`);
            return null; 
          }).filter(item => item && item.adet > 0); 
          logDebug("AI JSON'ından ve menüden doğrulanan/oluşturulan geçerli sepet:", siparisSepetiKaydedilecek);
          console.log("[MasaAsistani] Kaydedilecek Sepet:", siparisSepetiKaydedilecek); // KONSOL LOGU EKLENDİ
        } else {
          logInfo("AI JSON yanıtında sepet boş veya bulunmuyor.");
          siparisSepetiKaydedilecek = []; 
        }
      } catch (parseError) {
        logWarn(`AI yanıtı JSON olarak parse edilemedi (${parseError.message}), ham yanıt metin olarak kabul edilecek.`);
        konusmaMetniAI = aiHamYanit; 
        siparisSepetiKaydedilecek = []; 
        setLastAiResponseData(null); 
        currentAIActionStatus = "anlasilamadi_duz_metin"; 
      }
      
      setGecmis((prev) => prev.map((g, i) => i === prev.length - 1 ? { ...g, cevap: konusmaMetniAI, type: 'neso', timestamp: new Date().toISOString() } : g));
      
      logInfo("Adım 2: Oluşturulan/Alınan konuşma metni seslendiriliyor...");
      await sesliYanıtVer(konusmaMetniAI);
      
      logInfo("Adım 3: Sipariş sepeti kontrol ediliyor...");
      logDebug("Backend'e gönderilebilecek nihai sepet:", siparisSepetiKaydedilecek);

      // Sistem mesajında JSON dönüldüğünde aksiyon_durumu'nun 'siparis_guncellendi' olması gerektiği belirtildi.
      const shouldSaveOrder = currentAIActionStatus === "siparis_guncellendi" && siparisSepetiKaydedilecek.length > 0;
      console.log("[MasaAsistani] shouldSaveOrder Koşulu:", shouldSaveOrder, " (currentAIActionStatus:", currentAIActionStatus, ", siparisSepetiKaydedilecek.length:", siparisSepetiKaydedilecek.length,")"); // KONSOL LOGU EKLENDİ

      if (shouldSaveOrder) {
        logInfo(`📦 Geçerli sipariş (${siparisSepetiKaydedilecek.length} çeşit) bulundu ve aksiyon durumu ('${currentAIActionStatus}') sipariş kaydını gerektiriyor, backend'e kaydediliyor...`);
        const siparisData = {
          masa: String(masaId),
          istek: kullaniciMesaji,
          yanit: aiHamYanit, 
          sepet: siparisSepetiKaydedilecek 
        };
        logDebug("Sipariş API'ye gönderiliyor (/siparis-ekle), Payload:", JSON.stringify(siparisData, null, 2));
        
        try {
          const siparisRes = await axios.post(`${API_BASE}/siparis-ekle`, siparisData, {
            headers: { "Content-Type": "application/json" }
          });
          logInfo(`✅ Sipariş başarıyla kaydedildi. Backend Yanıtı:`, siparisRes.data);
          setSiparisDurumu("bekliyor"); 

          if (siparisRes.data && siparisRes.data.siparisId) {
            setAktifSiparis({
              id: siparisRes.data.siparisId,
              zaman: siparisRes.data.zaman || new Date().toISOString(),
              iptalEdilemez: false
            });
            setIptalKalanSure(120);
            logInfo(`Aktif sipariş ayarlandı: ID ${siparisRes.data.siparisId}, Zaman: ${siparisRes.data.zaman || 'Frontend Saati'}`);
          }
        } catch (siparisHata) {
          logError("❌ Sipariş kaydetme API hatası:", siparisHata.response || siparisHata);
          let hataDetayi = "Bilinmeyen API hatası.";
          if (siparisHata.response?.data) {
            if (typeof siparisHata.response.data.detail === 'string') hataDetayi = siparisHata.response.data.detail;
            else if (Array.isArray(siparisHata.response.data.detail)) hataDetayi = siparisHata.response.data.detail.map(err => `${err.loc?.join('->') || 'alan'}: ${err.msg}`).join(', ');
            else if (typeof siparisHata.response.data === 'string') hataDetayi = siparisHata.response.data;
          } else if (siparisHata.message) hataDetayi = siparisHata.message;
          setHataMesaji(`Siparişiniz kaydedilemedi: ${hataDetayi}`);
          setGecmis((prev) => [...prev, { type: 'hata', soru: "", cevap: `Sipariş gönderilemedi: ${hataDetayi}`, timestamp: new Date().toISOString() }]);
        }
      } else {
        logInfo(`ℹ️ AI yanıtından kaydedilecek bir sipariş oluşturulamadı veya aksiyon durumu ('${currentAIActionStatus}') sipariş kaydını gerektirmiyor.`);
      }
    } catch (error) { 
      logError("❌ Mesaj gönderme/işleme genel hatası:", error);
      const hataDetayi = error.response?.data?.detail || error.message || "Bilinmeyen bir hata oluştu.";
      setHataMesaji(`İşlem sırasında bir hata oluştu: ${hataDetayi}`);
      setGecmis((prev) => prev.map((g, i) => i === prev.length - 1 && g.cevap === "..." ? { ...g, cevap: `Üzgünüm, bir hata oluştu. (${hataDetayi})`, type: 'hata', timestamp: new Date().toISOString() } : g));
      setLastAiResponseData(null); 
    } finally {
      logInfo("Adım 5: İşlem tamamlandı (finally).");
      setLoading(false);
    }
  }, [mesaj, loading, audioPlaying, micActive, API_BASE, masaId, sesliYanıtVer, menuUrunler, logInfo, logError, logWarn, logDebug, iptalLoading, lastAiResponseData]);


  const sesiDinle = useCallback(() => {
    if (!SpeechRecognition) { logError("🚫 Tarayıcı ses tanımayı desteklemiyor."); alert("Tarayıcınız sesle komut özelliğini desteklemiyor."); return; }
    if (micActive && recognitionRef.current) {
      logInfo("🎤 Mikrofon kapatılıyor (manuel).");
      try { recognitionRef.current.stop(); } catch (e) { logError("Mikrofon durdurulurken hata:", e); }
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
        logError("🎤 Ses tanıma hatası:", event.error, event);
        let errorMsg = `Ses tanıma hatası: ${event.error}`;
        if (event.error === 'no-speech') errorMsg = "Ses algılanamadı, lütfen tekrar deneyin.";
        else if (event.error === 'audio-capture') errorMsg = "Mikrofon erişim sorunu. Lütfen izinleri kontrol edin.";
        else if (event.error === 'not-allowed') errorMsg = "Mikrofon kullanımı engellendi. Lütfen sayfa izinlerini kontrol edin.";
        
        if (event.error !== 'aborted') { 
            setHataMesaji(errorMsg);
        }
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
      if (recognitionRef.current) { 
        try { recognitionRef.current.abort(); } catch (e) {} 
        recognitionRef.current = null;
      }
    }
  }, [micActive, gonder, logInfo, logError, audioPlaying, logWarn]);

  const durdur = useCallback(() => {
    if (audioRef.current && !audioRef.current.paused) {
      logInfo("🛑 Backend TTS konuşması durduruluyor (kullanıcı isteği).");
      audioRef.current.pause();
      audioRef.current.currentTime = 0; 
      if (audioRef.current.src && audioRef.current.src.startsWith('blob:')) { 
        URL.revokeObjectURL(audioRef.current.src);
      }
      audioRef.current.src = '';
      audioRef.current = null; 
    }
    if (synth && synth.speaking) { 
      logInfo("🛑 Tarayıcı TTS konuşması durduruldu (kullanıcı isteği).");
      synth.cancel();
    }
    setAudioPlaying(false); 
  }, [logInfo]);


  useEffect(() => {
    let intervalId = null;
    if (aktifSiparis && aktifSiparis.id && aktifSiparis.zaman && !aktifSiparis.iptalEdilemez && (siparisDurumu === 'bekliyor' || siparisDurumu === 'hazirlaniyor')) {
      logDebug(`İptal süresi takibi başlatılıyor. Sipariş Zamanı: ${aktifSiparis.zaman}, ID: ${aktifSiparis.id}`);
      intervalId = setInterval(() => {
        const olusturmaZamaniMs = new Date(aktifSiparis.zaman).getTime();
        const simdiMs = new Date().getTime();
        const gecenSureSn = Math.floor((simdiMs - olusturmaZamaniMs) / 1000);
        const kalanSn = 120 - gecenSureSn; 

        if (kalanSn > 0) {
          setIptalKalanSure(kalanSn);
        } else {
          setIptalKalanSure(0);
          logInfo(`Sipariş ${aktifSiparis.id} için iptal süresi doldu (useEffect timer).`);
          setAktifSiparis(prev => prev ? { ...prev, iptalEdilemez: true } : null);
          if (intervalId) clearInterval(intervalId); 
        }
      }, 1000);
    } else {
      if (iptalKalanSure !== 0) setIptalKalanSure(0);
      if (aktifSiparis && (siparisDurumu !== 'bekliyor' && siparisDurumu !== 'hazirlaniyor') && !aktifSiparis.iptalEdilemez) {
          setAktifSiparis(prev => prev ? { ...prev, iptalEdilemez: true } : null);
      }
    }
    return () => {
      if (intervalId) {
        logDebug("İptal süresi takibi temizleniyor (useEffect cleanup).");
        clearInterval(intervalId);
      }
    };
  }, [aktifSiparis, siparisDurumu, logDebug, logInfo, iptalKalanSure]);


   const handleSiparisIptal = async () => {
    if (!aktifSiparis || !aktifSiparis.id) {
      logWarn("İptal edilecek aktif sipariş ID'si bulunamadı.");
      setHataMesaji("İptal edilecek sipariş bulunamadı.");
      return;
    }
    if (aktifSiparis.iptalEdilemez || iptalKalanSure <= 0) {
        logWarn(`Sipariş ${aktifSiparis.id} için iptal süresi dolmuş veya iptal edilemez durumda.`);
        setHataMesaji("Bu sipariş artık iptal edilemez.");
        setAktifSiparis(prev => prev ? { ...prev, iptalEdilemez: true } : null); 
        setIptalKalanSure(0);
        return;
    }

    logInfo(`Sipariş iptal isteği gönderiliyor: ID ${aktifSiparis.id}, Masa No: ${masaId}`);
    setIptalLoading(true); 
    setHataMesaji(null);

    try {
      const response = await axios.post(`${API_BASE}/musteri/siparis/${aktifSiparis.id}/iptal?masa_no=${masaId}`);
      logInfo("Sipariş iptal API yanıtı:", response.data);
      
      setSiparisDurumu('iptal'); 
      const iptalMesaji = response.data.message || "Siparişiniz başarıyla iptal edildi.";
      setGecmis(prev => [...prev, { type: 'neso', soru: "", cevap: iptalMesaji, timestamp: new Date().toISOString() }]);
      await sesliYanıtVer(iptalMesaji);

      setAktifSiparis(null); 
      setIptalKalanSure(0); 

    } catch (error) {
      logError("Sipariş iptal API hatası:", error.response || error);
      const hataDetayi = error.response?.data?.detail || error.message || "Sipariş iptal edilemedi.";
      setHataMesaji(hataDetayi);
      setGecmis(prev => [...prev, { type: 'hata', soru: "", cevap: `Sipariş iptal edilemedi: ${hataDetayi}`, timestamp: new Date().toISOString() }]);
      await sesliYanıtVer(`Üzgünüm, siparişiniz iptal edilirken bir sorun oluştu. Lütfen bir yetkiliye bildirin.`);
    } finally {
      setIptalLoading(false); 
    }
  };

  const formatTimestamp = (isoString) => {
    if (!isoString) return "";
    try {
      return new Date(isoString).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      logWarn("Geçersiz zaman damgası formatı:", isoString, e);
      return "hatalı saat";
    }
  };

  const { text: durumMesajiText, style: durumStili, icon: durumIconu } = getDurumTextAndStyle(siparisDurumu);

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-100 via-amber-50 to-green-100 flex items-center justify-center p-2 sm:p-4 font-['Nunito',_sans-serif]">
      <div className="bg-white/80 backdrop-blur-lg shadow-2xl rounded-3xl p-4 sm:p-6 w-full max-w-lg text-slate-700 border border-white/30">
        <div className="flex flex-col items-center justify-center mb-4 space-y-2">
          <img src={NesoLogo} alt="NESO Logo" className="h-16 w-16 sm:h-20 sm:w-20" />
          <h1 className="text-2xl sm:text-3xl font-bold text-green-700">Neso Asistan</h1>
          <p className="text-sm text-amber-700 font-semibold bg-amber-100 px-3 py-1 rounded-full shadow-sm">Masa No: {masaId}</p>
        </div>

        {hataMesaji && (
          <div className="bg-red-100 border border-red-300 text-red-700 px-3 py-2.5 rounded-xl mb-4 text-sm text-center shadow-md break-words">
            <span className="font-semibold">⚠️ Hata:</span> {hataMesaji}
          </div>
        )}

        {durumMesajiText && (
          <div className={`px-4 py-3 rounded-xl mb-4 text-sm text-center font-semibold shadow-md flex items-center justify-center gap-2 ${durumStili}`}>
            <span>{durumIconu}</span>
            <span>{durumMesajiText}</span>
          </div>
        )}
        
        {aktifSiparis && aktifSiparis.id && !aktifSiparis.iptalEdilemez && iptalKalanSure > 0 && (siparisDurumu === 'bekliyor' || siparisDurumu === 'hazirlaniyor') && (
          <div className="my-3">
            <button
              onClick={handleSiparisIptal}
              disabled={iptalLoading || loading || audioPlaying || micActive}
              className={`w-full py-3 rounded-xl font-semibold text-white bg-red-500 hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-opacity-50 transition duration-200 ease-in-out active:scale-[0.98] shadow-lg hover:shadow-red-400/50 ${iptalLoading || loading || audioPlaying || micActive ? "opacity-70 cursor-not-allowed" : ""}`}
            >
              {iptalLoading ? <LoadingSpinner /> : `Siparişi İptal Et (${Math.floor(iptalKalanSure / 60)}:${(iptalKalanSure % 60).toString().padStart(2, '0')})`}
            </button>
          </div>
        )}
        {aktifSiparis && aktifSiparis.id && aktifSiparis.iptalEdilemez && (siparisDurumu === 'bekliyor' || siparisDurumu === 'hazirlaniyor') && iptalKalanSure <=0 && (
          <p className="text-xs text-center text-amber-600 my-2 font-medium">Bu sipariş için iptal süresi dolmuştur.</p>
        )}

        <input
          type="text"
          value={mesaj}
          onChange={(e) => setMesaj(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !loading && !audioPlaying && !micActive && !iptalLoading) gonder(); }}
          onFocus={handleInputFocus}
          placeholder={micActive ? "Dinleniyor..." : (loading ? "Yanıt bekleniyor..." : (!karsilamaYapildi ? "Merhaba! Başlamak için tıklayın..." : "Ne arzu edersiniz?"))}
          className="w-full p-3.5 mb-3 rounded-xl bg-slate-50 border border-slate-300 text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition duration-200 shadow-inner text-sm sm:text-base"
          disabled={loading || audioPlaying || micActive || iptalLoading}
        />

        <div className="grid grid-cols-2 gap-3 mb-3">
          <button
            onClick={() => gonder()}
            disabled={loading || audioPlaying || !mesaj.trim() || micActive || iptalLoading}
            className={`col-span-1 py-3 rounded-xl font-bold transition duration-200 ease-in-out active:scale-[0.98] shadow-md hover:shadow-lg flex items-center justify-center gap-2 text-sm sm:text-base ${loading || audioPlaying || !mesaj.trim() || micActive || iptalLoading
                ? "bg-slate-300 text-slate-500 cursor-not-allowed"
                : "bg-green-600 hover:bg-green-700 text-white"
              }`}
            aria-label="Mesajı Gönder"
          >
            {loading ? <LoadingSpinner /> : <><SendIcon /> Gönder</>}
          </button>
          <button
            onClick={sesiDinle}
            disabled={loading || audioPlaying || !SpeechRecognition || iptalLoading}
            className={`col-span-1 py-3 rounded-xl font-bold transition duration-200 ease-in-out active:scale-[0.98] shadow-md hover:shadow-lg flex items-center justify-center gap-2 text-sm sm:text-base ${micActive ? "bg-red-500 hover:bg-red-600 text-white animate-pulse" : "bg-sky-500 hover:bg-sky-600 text-white"
              } ${loading || audioPlaying || !SpeechRecognition || iptalLoading ? "opacity-60 cursor-not-allowed" : ""}`}
            aria-label={micActive ? "Dinlemeyi Durdur" : "Sesli Komut Ver"}
            title={!SpeechRecognition ? "Tarayıcı bu özelliği desteklemiyor" : (micActive ? "Dinlemeyi Durdur" : "Sesli Komut Ver")}
          >
            <MicIcon /> {micActive && <span>Dinliyor</span>}
          </button>
        </div>

        {audioPlaying && (
             <button
                onClick={durdur}
                className="w-full py-2.5 mb-4 rounded-xl font-semibold text-white bg-orange-500 hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-opacity-50 transition duration-200 ease-in-out active:scale-[0.98] shadow-md hover:shadow-orange-400/50 flex items-center justify-center gap-2 text-sm"
                aria-label="Neso'nun konuşmasını durdur"
            >
                <StopSoundIcon /> Sesi Durdur
            </button>
        )}

        <div
          ref={mesajKutusuRef}
          className="h-72 overflow-y-auto space-y-3 bg-slate-100/70 p-3 rounded-xl scrollbar-thin scrollbar-thumb-slate-400/70 scrollbar-track-slate-200/50 scrollbar-corner-transparent shadow-inner"
          aria-live="polite"
        >
          {gecmis.map((g, i) => (
            <div key={i} className={`flex flex-col ${g.type === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`p-2.5 rounded-xl max-w-[85%] shadow-sm text-sm sm:text-base ${
                  g.type === 'user' ? 'bg-green-600 text-white rounded-br-none' :
                  g.type === 'neso' ? 'bg-slate-600 text-white rounded-bl-none' :
                  'bg-red-100 text-red-700 border border-red-300' 
              }`}>
                <div className="flex justify-between items-baseline mb-0.5">
                    <span className={`font-semibold text-xs opacity-80 ${g.type === 'user' ? 'text-green-100' : g.type === 'neso' ? 'text-slate-300' : 'text-red-500'}`}>
                        {g.type === 'user' ? 'Siz' : g.type === 'neso' ? 'Neso Asistan' : 'Sistem'}
                    </span>
                    {g.timestamp && (
                        <span className={`text-xs ml-2 opacity-60 ${g.type === 'user' ? 'text-green-200' : g.type === 'neso' ? 'text-slate-400' : 'text-red-400'}`}>
                            {formatTimestamp(g.timestamp)}
                        </span>
                    )}
                </div>
                <span className="break-words leading-relaxed">
                    {g.cevap === "..." ? <LoadingSpinner /> : g.cevap}
                </span>
              </div>
            </div>
          ))}
          {loading && gecmis.length === 0 && ( 
            <div className="text-center text-sm text-slate-500 opacity-70 animate-pulse py-4">Bağlanılıyor veya yanıt bekleniyor...</div>
          )}
          {!loading && gecmis.length === 0 && !hataMesaji && menuUrunler.length > 0 && ( 
             <div className="text-center text-sm text-slate-500 opacity-80 py-4">
                {karsilamaYapildi ? "Sohbete başlamak için yazın veya mikrofonu kullanın." : "Merhaba! Neso Asistan'a hoş geldiniz. Başlamak için bir şeyler yazın veya mikrofona tıklayın."}
             </div>
          )}
          {!loading && gecmis.length === 0 && !hataMesaji && menuUrunler.length === 0 && API_BASE &&( 
             <div className="text-center text-sm text-slate-500 opacity-80 py-4">
                Menü yükleniyor, lütfen bekleyin...
             </div>
          )}
        </div>
        <p className="text-center text-xs text-slate-500 opacity-70 mt-5">
          Fıstık Kafe & Neso Asistan &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}

export default MasaAsistani;