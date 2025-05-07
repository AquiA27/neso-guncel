import React, { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { useParams } from "react-router-dom";

// Tarayıcı API'ları (varsa)
const synth = window.speechSynthesis;
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
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
  const [karsilamaYapildi, setKarsilamaYapildi] = useState(false);
  const [siparisDurumu, setSiparisDurumu] = useState(null);
  const [hataMesaji, setHataMesaji] = useState(null);
  // const [bekleyenOnay, setBekleyenOnay] = useState(null); // Onay mekanizması kaldırıldı

  // --- Referanslar ---
  const audioRef = useRef(null);
  const mesajKutusuRef = useRef(null);
  const wsRef = useRef(null);
  const recognitionRef = useRef(null);

  // --- Yardımcı Fonksiyonlar (Component İçine Taşındı) ---
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
    const distance = levenshteinDistance(str1, str2);
    const maxLength = Math.max(str1.length, str2.length);
    if (maxLength === 0) return 1;
    return 1 - distance / maxLength;
  };

  const getDurumText = (durum) => {
    switch(durum) {
        case 'bekliyor': return 'Siparişiniz Alındı, Bekliyor...';
        case 'hazirlaniyor': return 'Siparişiniz Hazırlanıyor... 👨‍🍳';
        case 'hazir': return 'Siparişiniz Hazır! Afiyet olsun. ✅';
        case 'iptal': return 'Siparişiniz İptal Edildi. ❌';
        default: return null;
    }
  };
  // --- //

  // --- Loglama Fonksiyonları ---
  const logInfo = useCallback((message) => console.log(`[Masa ${masaId}] INFO: ${message}`), [masaId]);
  const logError = useCallback((message, error) => console.error(`[Masa ${masaId}] ERROR: ${message}`, error || ''), [masaId]);
  const logWarn = useCallback((message) => console.warn(`[Masa ${masaId}] WARN: ${message}`), [masaId]);

  // --- WebSocket Bağlantısı ---
  useEffect(() => {
    const connectWebSocket = () => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) { logInfo("WebSocket zaten bağlı."); return; }
      if (!API_BASE) { logError("API_BASE tanımlı değil..."); setHataMesaji("API adresi yok."); return; }
      try {
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsHost = API_BASE.replace(/^https?:\/\//, '');
        const wsUrl = `${wsProtocol}//${wsHost}/ws/mutfak`;
        logInfo(`📡 WebSocket bağlantısı deneniyor: ${wsUrl}`);
        wsRef.current = new WebSocket(wsUrl);
        wsRef.current.onopen = () => { logInfo("✅ WebSocket bağlantısı başarılı."); setHataMesaji(null); };
        wsRef.current.onmessage = (event) => {
          console.log(`[Masa ${masaId}] DEBUG: WebSocket Mesajı Geldi:`, event.data); // DEBUG
          try {
            const message = JSON.parse(event.data);
            logInfo(`📥 WebSocket mesajı alındı: Tip: ${message.type}`);
            if (message.type === 'pong') {}
            else if (message.type === 'durum') {
              const { masa, durum } = message.data || {};
              if (masa !== undefined && durum !== undefined) {
                logInfo(`📊 Durum güncellemesi: Masa ${masa}, Durum: ${durum}`);
                if (String(masa) === String(masaId)) { setSiparisDurumu(durum); logInfo(`👍 Bu masanın durumu güncellendi: ${durum}`); }
              } else { logWarn("⚠️ Geçersiz 'durum' mesajı formatı:", message.data); }
            } else { logWarn(`⚠️ Bilinmeyen WS mesaj tipi: ${message.type}`); }
          } catch (err) { logError("WS mesaj işleme hatası:", err); }
        };
        wsRef.current.onerror = (error) => { logError("❌ WebSocket hatası:", error); setHataMesaji("Sunucuyla anlık bağlantı kesildi..."); };
        wsRef.current.onclose = (event) => {
          logInfo(`🔌 WebSocket bağlantısı kapandı. Kod: ${event.code}, Sebep: ${event.reason || 'Yok'}`);
          const currentWs = wsRef.current; wsRef.current = null;
          if (event.code !== 1000 && event.code !== 1001) { logInfo("WS beklenmedik şekilde kapandı, 5sn sonra tekrar denenecek..."); setTimeout(connectWebSocket, 5000 + Math.random() * 1000); }
        };
      } catch (error) { logError("❌ WS başlatma kritik hata:", error); setHataMesaji("Sunucu bağlantısı kurulamıyor."); }
    };
    const pingInterval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        try { wsRef.current.send(JSON.stringify({ type: 'ping' })); }
        catch (err) { logError("Ping gönderilemedi:", err); }
      } else if (!wsRef.current) { connectWebSocket(); }
    }, 30000);
    connectWebSocket();
    return () => { clearInterval(pingInterval); if (wsRef.current) { logInfo("Component kaldırılıyor, WS kapatılıyor."); wsRef.current.close(1000, "Component unmounting"); wsRef.current = null; } };
  }, [API_BASE, masaId, logInfo, logError, logWarn]);

  // --- Menü Verisi Çekme ---
  useEffect(() => {
    const fetchMenu = async () => {
      if (!API_BASE) { logError("API_BASE tanımsız..."); setHataMesaji("API adresi yok."); return; }
      logInfo("🍽️ Menü verisi çekiliyor..."); setHataMesaji(null);
      try {
        const res = await axios.get(`${API_BASE}/menu`);
        if (res.data && Array.isArray(res.data.menu)) {
          const menuItems = res.data.menu.flatMap((cat) => Array.isArray(cat.urunler) ? cat.urunler.map((u) => ({ ad: u.ad ? String(u.ad).toLowerCase().trim() : 'İsimsiz', fiyat: typeof u.fiyat === 'number' ? u.fiyat : 0, kategori: cat.kategori || 'Diğer', stok_durumu: u.stok_durumu ?? 1 })) : [] );
          setMenuUrunler(menuItems);
          logInfo(`✅ Menü verisi alındı (${menuItems.length} ürün).`);
        } else { logWarn("Menü verisi formatı hatalı:", res.data); setHataMesaji("Menü verisi alınamadı (format)."); }
      } catch (error) { logError("❌ Menü verisi alınamadı:", error); setHataMesaji(`Menü yüklenemedi: ${error.message}`); }
    };
    fetchMenu();
  }, [API_BASE, logInfo, logError, logWarn]);

  // --- Başlık ve Karşılama Kontrolü ---
  useEffect(() => {
     document.title = `Neso Asistan - Masa ${masaId}`;
    if (typeof window !== 'undefined') {
        const karsilamaKey = `karsilama_yapildi_${masaId}`;
        if (localStorage.getItem(karsilamaKey) === 'true') { setKarsilamaYapildi(true); }
    }
  }, [masaId]);

  // --- Sohbet Geçmişi Kaydırma ---
  useEffect(() => {
     if (mesajKutusuRef.current) { mesajKutusuRef.current.scrollTop = mesajKutusuRef.current.scrollHeight; }
  }, [gecmis]);

  // --- Google TTS ile Sesli Yanıt Verme ---
  const sesliYanıtVer = useCallback(async (text) => {
    if (!API_BASE) { logError("API_BASE tanımlı değil..."); console.error(`[Masa ${masaId}] DEBUG: Sesli yanıt verilemiyor - API_BASE tanımsız.`); throw new Error("API_BASE not defined"); }
    if (!text || typeof text !== 'string' || !text.trim()) { logWarn("Seslendirilecek geçerli metin boş."); return; }
    logInfo(`🔊 Sesli yanıt isteği: "${text.substring(0, 50)}..."`);
    setAudioPlaying(true); setHataMesaji(null);
    try {
      console.log(`[Masa ${masaId}] DEBUG: TTS isteği gönderiliyor: /sesli-yanit, Metin: "${text.substring(0,50)}..."`);
      const res = await axios.post(`${API_BASE}/sesli-yanit`, { text }, { responseType: "arraybuffer" });
      console.log(`[Masa ${masaId}] DEBUG: TTS yanıtı alındı. Status: ${res.status}, Data length: ${res.data?.byteLength}`);
      if (!res.data || res.data.byteLength < 100) { throw new Error("Sunucudan boş veya geçersiz ses verisi alındı."); }
      const blob = new Blob([res.data], { type: "audio/mpeg" });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      if (audioRef.current) { audioRef.current.pause(); }
      audioRef.current = audio;
      await audio.play(); logInfo("✅ Sesli yanıt çalınıyor.");
      audio.onended = () => { logInfo("🏁 Sesli yanıt bitti."); setAudioPlaying(false); URL.revokeObjectURL(url); audioRef.current = null; };
      audio.onerror = (err) => { logError("Ses çalma hatası:", err); setAudioPlaying(false); URL.revokeObjectURL(url); audioRef.current = null; setHataMesaji("Sesli yanıt oynatılamadı."); };
    } catch (error) {
      console.error(`[Masa ${masaId}] DEBUG: sesliYanıtVer catch bloğuna düşüldü. Hata:`, error);
      logError("❌ TTS/ses çalma hatası:", error); setAudioPlaying(false);
      const hataMesajiDetay = error.response?.data?.detail || error.message || "Bilinmeyen TTS hatası.";
      setHataMesaji(`Sesli yanıt alınamadı: ${hataMesajiDetay}`);
      if (synth && text) {
        console.warn(`[Masa ${masaId}] DEBUG: Tarayıcı TTS fallback kullanılıyor.`);
        logWarn("⚠️ Fallback TTS (tarayıcı) kullanılıyor.");
        try { synth.cancel(); const utt = new SpeechSynthesisUtterance(text); utt.lang = "tr-TR"; utt.onend = () => { logInfo("🏁 Fallback TTS (tarayıcı) bitti."); setAudioPlaying(false); }; utt.onerror = (errEvent) => { logError("Fallback TTS (tarayıcı) hatası:", errEvent); setAudioPlaying(false); }; setAudioPlaying(true); synth.speak(utt); }
        catch(ttsError){ logError("Fallback TTS hatası:", ttsError); setAudioPlaying(false); }
      } else { logError("Fallback TTS de kullanılamıyor."); }
    }
  }, [API_BASE, masaId, logInfo, logError, logWarn, synth]); // synth eklendi

  // --- Karşılama Mesajını Oynat ---
  const handleInputFocus = useCallback(async () => {
    if (!karsilamaYapildi && menuUrunler.length > 0) {
      const karsilamaKey = `karsilama_yapildi_${masaId}`;
      const greeting = `Merhaba, ben Neso. Fıstık Kafe sipariş asistanınızım. ${masaId} numaralı masaya hoş geldiniz. Size nasıl yardımcı olabilirim?`;
      logInfo("👋 Karşılama mesajı tetikleniyor...");
      setGecmis((prev) => [...prev, { soru: "", cevap: greeting }]);
      try {
        await sesliYanıtVer(greeting);
        if (typeof window !== 'undefined') { localStorage.setItem(karsilamaKey, 'true'); }
        setKarsilamaYapildi(true);
      } catch (error) { logError("Karşılama mesajı seslendirilemedi:", error); }
    }
  }, [karsilamaYapildi, masaId, menuUrunler.length, sesliYanıtVer, logInfo, logError]);

  // --- Ürün Ayıklama Fonksiyonu (İyileştirilmiş) ---
   const urunAyikla = useCallback((msg) => {
    const items = [];
    const lowerMsg = (msg || '').toLowerCase();
    logInfo(`📝 Ürün ayıklama başlıyor: "${lowerMsg}"`);

    if (!menuUrunler || menuUrunler.length === 0) {
        logWarn("⚠️ Ürün ayıklama atlanıyor: Menü ürünleri henüz yüklenmemiş.");
        return [];
    }

    // Sayısal ifadeleri ve "bir" gibi kelimeleri bul (daha geniş kapsamlı)
    const sayiRegex = /(\d+|bir|iki|üç|dört|beş|altı|yedi|sekiz|dokuz|on)\s+/gi;
    const sayiMap = { "bir": 1, "iki": 2, "üç": 3, "dört": 4, "beş": 5, "altı": 6, "yedi": 7, "sekiz": 8, "dokuz": 9, "on": 10 };
    const kelimeler = lowerMsg.split(/\s+/); // Mesajı kelimelere ayır

    // Kelime kelime dolaşarak ürün ve adet bulmaya çalış
    for (let i = 0; i < kelimeler.length; i++) {
        let adet = 1;
        let urunKelimeIndex = i;

        // Önceki kelime sayı mı kontrol et
        if (i > 0) {
            const oncekiKelime = kelimeler[i - 1];
            const sayiDegeri = sayiMap[oncekiKelime] || parseInt(oncekiKelime);
            if (!isNaN(sayiDegeri)) {
                adet = sayiDegeri;
                // Eğer önceki kelime sayıysa, ürün adı buradan başlar
                urunKelimeIndex = i;
            } else {
                 // Önceki kelime sayı değilse, ürün adı bir önceki kelimeden başlayabilir
                 urunKelimeIndex = i - 1;
            }
        } else {
             // İlk kelime sayı mı? (Nadir durum ama olabilir)
             const sayiDegeri = sayiMap[kelimeler[i]] || parseInt(kelimeler[i]);
             if (!isNaN(sayiDegeri)) {
                 adet = sayiDegeri;
                 urunKelimeIndex = i + 1; // Ürün bir sonraki kelime
             }
        }


        // Potansiyel ürün adını oluştur (birkaç kelime ileriye bakarak)
        let potansiyelUrunMetni = "";
        for (let j = urunKelimeIndex; j < Math.min(urunKelimeIndex + 4, kelimeler.length); j++) { // Max 4 kelimeye bak
            potansiyelUrunMetni = kelimeler.slice(urunKelimeIndex, j + 1).join(" ");

            if (!potansiyelUrunMetni || potansiyelUrunMetni.length < 3) continue;

            let bestMatch = null;
            let maxSimilarity = 0.68; // Eşik biraz daha ayarlandı

            for (const menuItem of menuUrunler) {
                const similarity = calculateSimilarity(menuItem.ad, potansiyelUrunMetni);
                if (similarity >= maxSimilarity && similarity > (bestMatch?.similarity || 0)) {
                    bestMatch = { ...menuItem, similarity };
                }
            }

            // Eğer iyi bir eşleşme bulunduysa ve stoktaysa
            if (bestMatch && bestMatch.stok_durumu === 1) {
                logInfo(`🛒 Bulunan Ürün: "${bestMatch.ad}" (İstenen: "${potansiyelUrunMetni}", Adet: ${adet}, Benzerlik: ${bestMatch.similarity.toFixed(2)})`);
                // Daha önce aynı ürün eklenmiş mi kontrol et
                const existingItemIndex = items.findIndex(item => item.urun === bestMatch.ad);
                if (existingItemIndex > -1) {
                    // Eğer varsa adedi güncelle (opsiyonel, üzerine yazmak yerine)
                    // items[existingItemIndex].adet += adet;
                } else {
                    items.push({ urun: bestMatch.ad, adet: adet, fiyat: bestMatch.fiyat, kategori: bestMatch.kategori });
                }
                // Eşleşme bulundu, bu kelime grubunu atla ve sonraki potansiyel sayıdan devam et
                i = j; // Döngüyü ilerlet
                break; // İçteki kelime döngüsünden çık
            } else if (bestMatch && bestMatch.stok_durumu === 0) {
                 logWarn(` Stokta yok: "${bestMatch.ad}" (İstenen: "${potansiyelUrunMetni}")`);
                 // Stokta olmayan ürünü de ekleyebiliriz ama backend bunu reddedebilir.
            }
        }
    }

    // Onay ifadelerini kontrol et (örn: "evet doğru") - Bu kısım sipariş mantığını karmaşıklaştırabilir.
    // Şimdilik doğrudan ayıklananları döndürelim.
    // const onayVar = /\b(evet|doğru|tamam|okey|onaylıyorum)\b/i.test(lowerMsg);
    // if (onayVar && bekleyenOnay) { ... }

    logInfo(`🛍️ Ayıklanan Sepet Sonucu: ${items.length} çeşit ürün bulundu.`);
    return items;
  }, [menuUrunler, logInfo, logWarn]); // Bağımlılıklar güncellendi

  // --- Ana Mesaj Gönderme ve İşleme Fonksiyonu ---
  const gonder = useCallback(async (gonderilecekMesaj) => {
    const kullaniciMesaji = (gonderilecekMesaj ?? mesaj).trim();
    if (!kullaniciMesaji || loading) return;

    logInfo(`➡️ Gönderiliyor: "${kullaniciMesaji}"`);
    setLoading(true); setMesaj(""); setHataMesaji(null);
    setGecmis((prev) => [...prev, { soru: kullaniciMesaji, cevap: "..." }]);

    let aiYaniti = "";
    let siparisSepeti = []; // Bu scope'ta tanımlı

    try {
      // 1. Adım: Kullanıcının mesajından sipariş ayıkla
      logInfo("Adım 1: Ürünler ayıklanıyor...");
      siparisSepeti = urunAyikla(kullaniciMesaji);
      console.log(`[Masa ${masaId}] DEBUG: Ayıklanan Sepet:`, JSON.stringify(siparisSepeti));

      // 2. Adım: AI Yanıtı Al
      logInfo("Adım 2: AI Yanıtı alınıyor...");
      const yanitRes = await axios.post(`${API_BASE}/yanitla`, { text: kullaniciMesaji, masa: masaId });
      aiYaniti = yanitRes.data.reply || "Üzgünüm, bir yanıt alamadım.";
      logInfo(`⬅️ AI yanıtı alındı: "${aiYaniti.substring(0,50)}..."`);

      setGecmis((prev) => prev.map((g, i) => i === prev.length - 1 ? { ...g, cevap: aiYaniti } : g));

      // 3. Adım: AI yanıtını seslendir
      logInfo("Adım 3: AI Yanıtı seslendiriliyor...");
      await sesliYanıtVer(aiYaniti);

      // 4. Adım: Eğer ayıklanan sepette ürün varsa, siparişi backend'e kaydet
      console.log(`[Masa ${masaId}] DEBUG: Sipariş sepeti kontrol ediliyor. Uzunluk: ${siparisSepeti.length}`);
      if (siparisSepeti.length > 0) {
        logInfo("📦 Geçerli sipariş bulundu, backend'e kaydediliyor...");
        const siparisData = {
          masa: masaId,
          istek: kullaniciMesaji,
          yanit: aiYaniti,
          sepet: siparisSepeti
        };
        console.log(`[Masa ${masaId}] DEBUG: Sipariş API'ye gönderiliyor:`, JSON.stringify(siparisData));

        try {
          const siparisRes = await axios.post(`${API_BASE}/siparis-ekle`, siparisData, {
            headers: { "Content-Type": "application/json" }
          });
          logInfo(`✅ Sipariş başarıyla kaydedildi. Backend Yanıtı: ${siparisRes.data.mesaj}`);
          setSiparisDurumu("bekliyor"); // Durumu güncelle
        } catch (siparisHata) {
          console.error(`[Masa ${masaId}] DEBUG: /siparis-ekle isteği HATASI:`, siparisHata);
          logError("❌ Sipariş kaydetme API hatası:", siparisHata);
          const hataDetayi = siparisHata.response?.data?.detail || siparisHata.message || "Bilinmeyen API hatası.";
          setHataMesaji(`Siparişiniz kaydedilirken bir sorun oluştu: ${hataDetayi}`);
          // Hata mesajını da sohbet geçmişine ekleyebiliriz
          setGecmis((prev) => [...prev, { soru: "", cevap: `Sipariş gönderilemedi: ${hataDetayi}` }]);
        }
      } else {
        logInfo("ℹ️ Mesajda kaydedilecek bir sipariş bulunamadı.");
      }

    } catch (error) {
      console.error(`[Masa ${masaId}] DEBUG: gonder fonksiyonu genel catch bloğuna düşüldü. Hata:`, error);
      logError("❌ Mesaj gönderme/işleme genel hatası:", error);
      const hataDetayi = error.response?.data?.detail || error.message || "Bilinmeyen bir hata oluştu.";
      setHataMesaji(`İşlem sırasında bir hata oluştu: ${hataDetayi}`);
      setGecmis((prev) => prev.map((g, i) => i === prev.length - 1 && g.cevap === '...' ? { ...g, cevap: `Üzgünüm, bir hata oluştu. (${hataDetayi})` } : g));
    } finally {
      logInfo("Adım 5: İşlem tamamlandı (finally).");
      setLoading(false); // Yükleniyor durumunu bitir
    }
  }, [mesaj, loading, API_BASE, masaId, sesliYanıtVer, urunAyikla, logInfo, logError]); // Bağımlılıklar doğru

   // --- Sesle Dinleme İşlemini Başlatma/Durdurma ---
   const sesiDinle = useCallback(() => {
     if (!SpeechRecognition) { logError("🚫 Tarayıcı desteklemiyor."); alert("Tarayıcı desteklemiyor."); return; }
    if (micActive && recognitionRef.current) {
        logInfo("🎤 Mikrofon kapatılıyor (manuel).");
        try { recognitionRef.current.stop(); } catch (e) { logError("Mic stop hatası", e); }
        // setMicActive(false); // onend içinde halledilecek
        return;
    }

    logInfo("🎤 Mikrofon başlatılıyor..."); setHataMesaji(null);
    try {
        const recognizer = new SpeechRecognition();
        recognitionRef.current = recognizer; // Referansı ata
        recognizer.lang = "tr-TR";
        recognizer.continuous = false;
        recognizer.interimResults = false;

        recognizer.onstart = () => {
             logInfo("🎤 Dinleme başladı.");
             setMicActive(true); // Dinleme başlayınca state'i güncelle
        };

        recognizer.onresult = async (event) => {
            const transcript = event.results[0][0].transcript;
            logInfo(`👂 Ses tanıma sonucu: "${transcript}"`);
            // setMicActive(false); // onend içinde halledilecek
            setMesaj(transcript); // Metni input'a yaz
            await gonder(transcript); // Otomatik olarak gönder
        };

        recognizer.onerror = (event) => {
            logError("🎤 Ses tanıma hatası:", event.error);
            // setMicActive(false); // onend içinde halledilecek
            if (event.error !== 'no-speech') { // 'no-speech' yaygın, diğerlerini göster
                 setHataMesaji(`Ses tanıma hatası: ${event.error}`);
            }
        };

        recognizer.onend = () => {
            logInfo("🏁 Ses tanıma bitti.");
            setMicActive(false); // Dinleme bitince (hata, sonuç veya sessizlik) state'i false yap
            recognitionRef.current = null; // Referansı temizle
        };

        recognizer.start(); // Dinlemeyi başlat

    } catch (err) {
         logError("🎤 Mikrofon başlatılamadı/kritik hata:", err);
         setHataMesaji("Mikrofon başlatılamadı. İzinleri kontrol edin veya tarayıcı desteklemiyor olabilir.");
         setMicActive(false); // Hata durumunda state'i false yap
         recognitionRef.current = null; // Referansı temizle
    }
  }, [micActive, gonder, logInfo, logError, masaId]); // masaId eklendi

  // --- Neso'nun Konuşmasını Durdurma Fonksiyonu ---
  const durdur = useCallback(() => {
    // Backend TTS sesini durdur
    if (audioRef.current) {
        logInfo("🛑 Backend TTS konuşması durduruluyor.");
        audioRef.current.pause();
        audioRef.current.currentTime = 0; // Başa sar
        // audioRef.current = null; // Referansı henüz temizleme, tekrar çalınabilir
        // URL.revokeObjectURL çağrısı onended/onerror içinde yapılmalı
    }
    // Tarayıcının kendi TTS sesini durdur (fallback durumunda)
    if(synth && synth.speaking){
        logInfo("🛑 Tarayıcı TTS konuşması durduruldu.");
        synth.cancel(); // Tüm sıradaki konuşmaları iptal et
    }
     // Her iki durumda da audioPlaying state'ini false yapalım
     setAudioPlaying(false);
  }, [synth, logInfo]); // synth eklendi

  // Her render'da sipariş durumu metnini hesapla
  const durumText = getDurumText(siparisDurumu);

  // --- JSX Render Bloğu ---
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 flex items-center justify-center p-4 font-sans">
      <div className="bg-white/10 backdrop-blur-md shadow-2xl rounded-3xl p-6 w-full max-w-md text-white border border-white/30">
        {/* Başlık ve Masa Numarası */}
        <h1 className="text-3xl font-extrabold text-center mb-2">🎙️ Neso Asistan</h1>
        <p className="text-center mb-4 opacity-80">Masa No: <span className="font-semibold">{masaId}</span></p>

        {/* Hata Mesajı Alanı */}
        {hataMesaji && (
            <div className="bg-red-500/70 border border-red-700 text-white px-4 py-2 rounded-lg mb-4 text-sm text-center shadow-lg">
                {hataMesaji}
            </div>
        )}

        {/* Sipariş Durumu Alanı */}
        {durumText && (
            <div className={`px-4 py-2 rounded-lg mb-4 text-sm text-center font-semibold shadow ${
                 siparisDurumu === 'hazir' ? 'bg-green-500/80' :
                 siparisDurumu === 'hazirlaniyor' ? 'bg-blue-500/80' :
                 siparisDurumu === 'iptal' ? 'bg-red-500/80' :
                 'bg-yellow-500/80' // bekliyor veya diğer
            }`}>
                {durumText}
            </div>
        )}

        {/* Mesaj Giriş Alanı */}
        <input
          type="text"
          value={mesaj}
          onChange={(e) => setMesaj(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !loading && !audioPlaying) gonder(); }}
          onFocus={handleInputFocus} // İlk tıklamada karşılama
          placeholder={!karsilamaYapildi ? "Merhaba! Başlamak için tıklayın..." : "Konuşun veya yazın..."}
          className="w-full p-3 mb-4 rounded-xl bg-white/20 placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/80 transition duration-200 shadow-inner"
          disabled={loading || audioPlaying} // İşlem sırasında pasif yap
        />

        {/* Butonlar */}
        <div className="flex gap-3 mb-4">
          {/* Gönder Butonu */}
          <button
            onClick={() => gonder()} // Direkt gonder() çağırılabilir
            disabled={loading || audioPlaying || !mesaj.trim()} // Koşullara göre pasif yap
            className={`flex-1 py-2 rounded-xl font-bold transition duration-200 ease-in-out active:scale-95 shadow hover:shadow-md ${
              loading || audioPlaying || !mesaj.trim()
                ? "bg-gray-500/50 text-white/50 cursor-not-allowed"
                : "bg-green-500/80 hover:bg-green-600/90 text-white"
            }`}
            aria-label="Mesajı Gönder"
          >
            {loading ? "⏳ Gönderiliyor..." : "🚀 Gönder"}
          </button>
          {/* Dinle Butonu */}
          <button
            onClick={sesiDinle}
            disabled={loading || audioPlaying || !SpeechRecognition} // Koşullara göre pasif yap
            className={`py-2 px-4 rounded-xl font-bold transition duration-200 ease-in-out active:scale-95 shadow hover:shadow-md ${
                 micActive ? "bg-red-600 hover:bg-red-700 text-white animate-pulse" : "bg-blue-500/80 hover:bg-blue-600/90 text-white"
             } ${loading || audioPlaying || !SpeechRecognition ? "opacity-50 cursor-not-allowed" : ""}`}
            aria-label={micActive ? "Dinlemeyi Durdur" : "Sesli Komut Ver"}
            title={!SpeechRecognition ? "Tarayıcı desteklemiyor" : ""} // Destek yoksa title ekle
          >
            {micActive ? "🔴 Durdur" : "🎤 Dinle"}
          </button>
        </div>

        {/* Konuşmayı Durdur Butonu */}
        <button
          onClick={durdur}
          disabled={!audioPlaying} // Sadece ses çalıyorsa aktif
          className={`w-full py-2 mb-4 rounded-xl font-bold transition duration-200 ease-in-out active:scale-95 shadow hover:shadow-md ${
               audioPlaying ? "bg-orange-500/80 hover:bg-orange-600/90 text-white" : "bg-gray-500/50 text-white/50 cursor-not-allowed" // Renk değişti
           }`}
          aria-label="Neso'nun konuşmasını durdur"
        >
          🛑 Konuşmayı Durdur
        </button>

         {/* Sohbet Geçmişi (ORİJİNAL JSX YAPISI) */}
         <div
           ref={mesajKutusuRef}
           className="h-64 overflow-y-auto space-y-3 bg-black/20 p-3 rounded-xl scrollbar-thin scrollbar-thumb-white/30 scrollbar-track-transparent scrollbar-corner-transparent shadow-inner"
           aria-live="polite"
         >
           {gecmis.map((g, i) => (
             <div key={i} className="flex flex-col">
               {/* Kullanıcı Mesajı */}
               {g.soru && (
                 <div className="bg-blue-500/70 p-2.5 rounded-lg rounded-br-none self-end max-w-[85%] mb-1 shadow"> {/* Stil ayarlandı */}
                    <span className="font-semibold text-xs opacity-90 block mb-0.5 text-blue-100">Siz</span> {/* Renk ayarlandı */}
                    <span className="text-sm break-words">{g.soru}</span> {/* break-words eklendi */}
                 </div>
               )}
               {/* Neso'nun Yanıtı */}
               {g.cevap && (
                  <div className={`bg-gray-700/70 p-2.5 rounded-lg ${g.soru ? 'rounded-bl-none' : 'rounded-b-lg'} self-start max-w-[85%] shadow`}> {/* Stil ayarlandı */}
                     <span className="font-semibold text-xs opacity-90 block mb-0.5 text-gray-300">Neso</span> {/* Renk ayarlandı */}
                     {/* Hatanın `ReferenceError: Cannot access 'C' before initialization` olarak işaret ettiği yer bu satır civarıydı */}
                     <span className="text-sm break-words">{g.cevap === "..." ? <span className="animate-pulse">Yazıyor...</span> : g.cevap}</span> {/* break-words eklendi */}
                  </div>
               )}
             </div>
           ))}
            {/* Yükleniyor mesajı (eğer sohbet boşsa ve hala yükleniyorsa) */}
            {loading && gecmis.length === 0 && (
                 <div className="text-center text-sm opacity-70 animate-pulse py-4">Bağlanılıyor veya yanıt bekleniyor...</div>
            )}
         </div>
         {/* // ORİJİNAL JSX SONU */}

        {/* Footer */}
        <p className="text-center text-xs opacity-60 mt-6">☕ Neso Asistan v1.2 © {new Date().getFullYear()}</p> {/* Sürüm güncellendi */}
      </div>
    </div>
  );
}

export default MasaAsistani;
```

**2. Güncellenmiş `MutfakEkrani.jsx`:**


```jsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";

const API_BASE = process.env.REACT_APP_API_BASE;
// DİKKAT: Bu yöntem üretim ortamları için GÜVENLİ DEĞİLDİR!
const AUTH_HEADER = "Basic " + btoa("admin:admin123");

function MutfakEkrani() {
  const [orders, setOrders] = useState([]); // Görüntülenecek siparişler
  const [error, setError] = useState(null); // Hata mesajları için state
  const [loading, setLoading] = useState(true); // Siparişler yükleniyor mu?
  const wsRef = useRef(null); // WebSocket bağlantısı referansı
  const audioRef = useRef(null); // Sesli bildirim için Audio nesnesi referansı

  // --- Yardımcı Fonksiyonlar ---
  const logInfo = useCallback((message) => console.log(`[Mutfak Ekranı] INFO: ${message}`), []);
  const logError = useCallback((message, error) => console.error(`[Mutfak Ekranı] ERROR: ${message}`, error || ''), []);
  const logWarn = useCallback((message) => console.warn(`[Mutfak Ekranı] WARN: ${message}`), []);

  // --- Sesli Bildirim Nesnesini Hazırla ---
  useEffect(() => {
    if (typeof window !== 'undefined') {
        try {
            audioRef.current = new Audio("/notification.mp3"); // Public klasöründeki ses
            logInfo("🔔 Sesli bildirim nesnesi oluşturuldu.");
        } catch (err) {
            logError("Sesli bildirim nesnesi oluşturulamadı:", err);
        }
    }
  }, [logInfo, logError]);

  // --- Sayfa Başlığı ---
  useEffect(() => {
    document.title = "Mutfak Paneli - Neso";
  }, []);

  // --- Siparişleri Getirme Fonksiyonu ---
  const fetchOrders = useCallback(async () => {
    logInfo("🔄 Siparişler getiriliyor...");
    if (!API_BASE) { logError("API_BASE tanımlı değil."); setError("API adresi yok."); setLoading(false); return; }
    setLoading(true); // Yükleme başladığını belirt
    try {
      const response = await axios.get(`${API_BASE}/siparisler`, {
        headers: { Authorization: AUTH_HEADER }
      });
      // API zaten ters sıralı veriyor, tekrar sıralamaya gerek yok.
      // Sepet verisini parse et (eğer string ise)
      const parsedOrders = (response.data.orders || []).map(order => {
          if (typeof order.sepet === 'string') {
              try {
                  order.sepet = JSON.parse(order.sepet);
              } catch (e) {
                  logWarn(`Sipariş ID ${order.id} için sepet parse edilemedi:`, order.sepet);
                  order.sepet = []; // Hata durumunda boş sepet
              }
          }
          return order;
      });
      setOrders(parsedOrders);
      setError(null);
      logInfo(`✅ Siparişler başarıyla getirildi (${parsedOrders.length} adet).`);
    } catch (err) {
      logError("❌ Siparişler alınamadı:", err);
      const errorDetail = err.response?.data?.detail || err.message || "Bilinmeyen hata.";
      if (err.response?.status === 401) { setError("Yetki hatası. Giriş yapın."); }
      else { setError(`Siparişler alınamadı: ${errorDetail}`); }
    } finally {
       setLoading(false);
    }
  }, [API_BASE, logInfo, logError, logWarn]); // AUTH_HEADER'ı bağımlılığa eklemeye gerek yok

  // --- WebSocket Bağlantısı Kurulumu ---
  useEffect(() => {
    const connectWebSocket = () => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) { logInfo("WebSocket zaten bağlı."); return; }
        if (!API_BASE) { logError("API_BASE tanımlı değil..."); return; }
        try {
            const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsHost = API_BASE.replace(/^https?:\/\//, '');
            const wsUrl = `${wsProtocol}//${wsHost}/ws/mutfak`;
            logInfo(`📡 WebSocket bağlantısı deneniyor: ${wsUrl}`);
            wsRef.current = new WebSocket(wsUrl);
            wsRef.current.onopen = () => { logInfo("✅ WebSocket bağlantısı başarılı."); setError(null); };
            wsRef.current.onmessage = (event) => {
                console.log("[Mutfak Ekranı] DEBUG: WS Mesajı Geldi:", event.data); // DEBUG
                try {
                    const message = JSON.parse(event.data);
                    logInfo(`📥 WebSocket mesajı alındı: Tip: ${message.type}`);
                    if (message.type === 'siparis') {
                        logInfo("📦 Yeni sipariş geldi, liste güncelleniyor ve bildirim çalınıyor...");
                        if (audioRef.current) {
                            audioRef.current.pause();
                            audioRef.current.currentTime = 0;
                            audioRef.current.play().catch(err => logError("Sesli bildirim çalınamadı:", err));
                        }
                        fetchOrders(); // Listeyi yenile
                    } else if (message.type === 'durum') {
                        logInfo(`📊 Sipariş durumu güncellemesi alındı, liste güncelleniyor...`);
                        fetchOrders(); // Durum değişince de listeyi yenile
                    } else if (message.type === 'pong') { }
                      else { logWarn(`⚠️ Bilinmeyen WS mesaj tipi: ${message.type}`); }
                } catch (err) { logError("WS mesaj işleme hatası:", err); }
            };
            wsRef.current.onerror = (errorEvent) => { logError("❌ WebSocket hatası:", errorEvent); setError("Sunucuyla anlık bağlantı kesildi..."); };
            wsRef.current.onclose = (event) => {
                logInfo(`🔌 WebSocket bağlantısı kapandı. Kod: ${event.code}, Sebep: ${event.reason || 'Yok'}`);
                const currentWs = wsRef.current; wsRef.current = null;
                if (event.code !== 1000 && event.code !== 1001) { logInfo("WS beklenmedik şekilde kapandı, 5sn sonra tekrar denenecek..."); setTimeout(connectWebSocket, 5000 + Math.random() * 1000); }
            };
        } catch (error) { logError("❌ WS başlatma kritik hata:", error); setError("Sunucu bağlantısı kurulamıyor."); }
    };
    const pingInterval = setInterval(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            try { wsRef.current.send(JSON.stringify({ type: 'ping' })); }
            catch (err) { logError("Ping gönderilemedi:", err); }
        } else if (!wsRef.current) { connectWebSocket(); }
    }, 30000);
    connectWebSocket();
    fetchOrders(); // İlk yükleme
    return () => { clearInterval(pingInterval); if (wsRef.current) { logInfo("Component kaldırılıyor, WS kapatılıyor."); wsRef.current.close(1000, "Component unmounting"); wsRef.current = null; } };
  }, [API_BASE, fetchOrders, logInfo, logError, logWarn]); // Bağımlılıklar

  // --- Sipariş Durumu Güncelleme Fonksiyonu ---
  const updateOrderStatus = useCallback(async (siparisId, masa, durum) => {
    logInfo(`🔄 Sipariş durumu güncelleniyor: ID: ${siparisId}, Masa: ${masa}, Yeni Durum: ${durum}`);
    if (!API_BASE) { logError("API_BASE tanımlı değil."); setError("API adresi yok."); return; }
    setError(null);
    try {
      const response = await axios.post(
        `${API_BASE}/siparis-guncelle`,
        { id: siparisId, masa, durum }, // Sipariş ID'sini gönderiyoruz
        { headers: { Authorization: AUTH_HEADER, 'Content-Type': 'application/json' }}
      );
      logInfo(`✅ Sipariş durumu başarıyla güncellendi (ID: ${siparisId}). Yanıt: ${response.data.message}`);
      // Backend zaten WS yayını yapıyor, listeyi yenilemeye gerek yok, WS mesajını bekleyelim.
      // fetchOrders(); // Bu satır kaldırıldı, WS mesajı bekleniyor.
    } catch (error) {
      logError(`❌ Sipariş durumu güncellenemedi (ID: ${siparisId}):`, error);
      const errorDetail = error.response?.data?.detail || error.message || "Bilinmeyen hata.";
      setError(`Sipariş durumu güncellenirken bir hata oluştu: ${errorDetail}`);
    }
  }, [API_BASE, logInfo, logError]); // fetchOrders bağımlılığı kaldırıldı

  // --- Buton Handler'ları ---
  const handleHazirlaniyor = (siparisId, masa) => { updateOrderStatus(siparisId, masa, "hazirlaniyor"); };
  const handleHazir = (siparisId, masa) => { updateOrderStatus(siparisId, masa, "hazir"); };
  const handleIptal = (siparisId, masa) => { if (window.confirm(`Masa ${masa}, Sipariş #${siparisId} iptal edilecek. Emin misiniz?`)) { updateOrderStatus(siparisId, masa, "iptal"); } };

  // --- Zaman Formatlama ---
  const formatTime = (timeStr) => {
    if (!timeStr) return "-";
    try {
      const date = new Date(timeStr);
      return new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(date);
    } catch { return timeStr; }
  };

  // --- Sipariş Kartı Rengi ---
   const getStatusColors = (status) => {
        switch (status) {
            case 'bekliyor': return "bg-yellow-100 border-yellow-300";
            case 'hazirlaniyor': return "bg-blue-100 border-blue-300";
            case 'hazir': return "bg-green-100 border-green-300";
            case 'iptal': return "bg-red-100 border-red-300 text-gray-500 line-through";
            default: return "bg-gray-100 border-gray-300";
        }
    };

   // --- Render ---
  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-100 via-orange-100 to-orange-200 p-6 text-gray-800 font-sans">
      <h1 className="text-4xl font-bold text-center mb-8 text-orange-700">👨‍🍳 Mutfak Sipariş Paneli</h1>

      {/* Hata Mesajı Alanı */}
      {error && ( <div className="bg-red-100 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded relative mb-4 shadow" role="alert"> <strong className="font-bold">Hata: </strong> <span className="block sm:inline">{error}</span> </div> )}

      {/* Yükleniyor Durumu */}
      {loading && ( <div className="text-center p-8 text-orange-600 animate-pulse"> Siparişler yükleniyor... </div> )}

      {/* Sipariş Yok Mesajı */}
      {!loading && orders.length === 0 && !error ? (
        <div className="text-center p-8 bg-white rounded-xl shadow-md mt-8"> <p className="text-gray-500 text-lg">📭 Bekleyen veya hazırlanan sipariş bulunmamaktadır.</p> </div>
      ) : (
        // Sipariş Kartları
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {orders
            // İsteğe bağlı: Sadece belirli durumları göster
            .filter(order => order.durum === 'bekliyor' || order.durum === 'hazirlaniyor')
            .map((order) => {
            // Sepet verisi array değilse veya boşsa bu siparişi atla
            if (!Array.isArray(order.sepet) || order.sepet.length === 0) {
                 logWarn(`Boş veya geçersiz sepetli sipariş atlandı (ID: ${order.id})`);
                 return null;
            }

            const cardColors = getStatusColors(order.durum);

            return (
              <div key={order.id} className={`${cardColors} rounded-xl shadow-md p-4 hover:shadow-lg transition-all duration-300 ease-in-out flex flex-col`}>
                {/* Kart Başlığı */}
                <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-300/50">
                  <p className="font-semibold text-lg"> #{order.id} / <span className="font-bold">Masa: {order.masa}</span> </p>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${ order.durum === 'hazirlaniyor' ? 'bg-blue-500 text-white' : 'bg-yellow-500 text-white' }`}> {order.durum || 'Bilinmiyor'} </span>
                </div>
                {/* Sipariş İçeriği */}
                <div className="bg-white/60 rounded p-3 mb-3 flex-grow">
                  <ul className="space-y-1.5">
                    {order.sepet.map((item, index) => (
                      <li key={index} className="flex justify-between items-start text-sm">
                        <span className="flex-1 mr-2">• {item.urun}</span>
                        <span className="font-semibold text-orange-700">× {item.adet}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                 {/* Müşteri Notu */}
                 {order.istek && ( <div className="mb-3 p-2 bg-amber-100/80 rounded border border-amber-300 text-amber-800 text-xs italic"> <span className="font-semibold">Not:</span> {order.istek} </div> )}
                {/* Aksiyon Butonları */}
                <div className="flex gap-2 mt-auto">
                  {order.durum === 'bekliyor' && ( <button onClick={() => handleHazirlaniyor(order.id, order.masa)} className="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-semibold transition duration-200 ease-in-out active:scale-95 shadow hover:shadow-md" title="Hazırlamaya başla"> 🔵 Hazırlanıyor </button> )}
                  {order.durum === 'hazirlaniyor' && ( <button onClick={() => handleHazir(order.id, order.masa)} className="flex-1 bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded-lg text-sm font-semibold transition duration-200 ease-in-out active:scale-95 shadow hover:shadow-md" title="Sipariş hazırlandı"> ✅ Hazır </button> )}
                  <button onClick={() => handleIptal(order.id, order.masa)} className="bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-lg text-sm font-semibold transition duration-200 ease-in-out active:scale-95 shadow hover:shadow-md" title="Siparişi iptal et"> ❌ İptal </button>
                </div>
                {/* Zaman Bilgisi */}
                <div className="text-right mt-3 text-xs text-gray-500"> ⏱️ {formatTime(order.zaman)} </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default MutfakEkrani;
