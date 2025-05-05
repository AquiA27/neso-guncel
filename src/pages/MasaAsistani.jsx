import React, { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { useParams } from "react-router-dom";

// Tarayıcı API'ları (varsa)
const synth = window.speechSynthesis;
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const API_BASE = process.env.REACT_APP_API_BASE;

// --- Levenshtein Mesafe Fonksiyonu (Benzerlik için) ---
// İki string arasındaki düzenleme mesafesini hesaplar
const levenshteinDistance = (a, b) => {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = Array(a.length + 1).fill(null).map(() =>
    Array(b.length + 1).fill(null)
  );

  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // Deletion
        matrix[i][j - 1] + 1,      // Insertion
        matrix[i - 1][j - 1] + cost // Substitution
      );
    }
  }
  return matrix[a.length][b.length];
};

// Levenshtein mesafesini kullanarak 0-1 arasında benzerlik skoru hesaplar
const calculateSimilarity = (str1, str2) => {
  const distance = levenshteinDistance(str1, str2);
  const maxLength = Math.max(str1.length, str2.length);
  if (maxLength === 0) return 1; // İki string de boşsa benzerlik %100
  return 1 - distance / maxLength;
};
// --- //

function MasaAsistani() {
  const { masaId } = useParams(); // URL'den masa numarasını al
  const [mesaj, setMesaj] = useState(""); // Kullanıcının yazdığı mesaj
  const [gecmis, setGecmis] = useState([]); // Sohbet geçmişi [{soru, cevap}]
  const [loading, setLoading] = useState(false); // Backend'den yanıt bekleniyor mu?
  const [micActive, setMicActive] = useState(false); // Mikrofon aktif mi?
  const [audioPlaying, setAudioPlaying] = useState(false); // Neso konuşuyor mu?
  const [menuUrunler, setMenuUrunler] = useState([]); // Menüdeki ürünlerin listesi [{ad, fiyat, kategori}]
  const [karsilamaYapildi, setKarsilamaYapildi] = useState(false); // Hoşgeldin mesajı verildi mi?
  const [siparisDurumu, setSiparisDurumu] = useState(null); // Son siparişin durumu (bekliyor, hazirlaniyor, hazir, iptal)
  const [hataMesaji, setHataMesaji] = useState(null); // Gösterilecek hata mesajı

  // Referanslar
  const audioRef = useRef(null); // Ses çalma elementi
  const mesajKutusuRef = useRef(null); // Sohbet geçmişi alanı (scroll için)
  const wsRef = useRef(null); // WebSocket bağlantısı
  const recognitionRef = useRef(null); // Ses tanıma nesnesi

  // --- Yardımcı Fonksiyonlar ---
  const logInfo = useCallback((message) => console.log(`[Masa ${masaId}] INFO: ${message}`), [masaId]);
  const logError = useCallback((message, error) => console.error(`[Masa ${masaId}] ERROR: ${message}`, error || ''), [masaId]);
  const logWarn = useCallback((message) => console.warn(`[Masa ${masaId}] WARN: ${message}`), [masaId]);

  // --- WebSocket Bağlantısı ---
  useEffect(() => {
    const connectWebSocket = () => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        logInfo("WebSocket zaten bağlı.");
        return;
      }
      if (!API_BASE) {
          logError("API_BASE tanımlı değil, WebSocket bağlantısı kurulamıyor.");
          return;
      }

      try {
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsHost = API_BASE.replace(/^https?:\/\//, ''); // http:// veya https:// kaldır
        const wsUrl = `${wsProtocol}//${wsHost}/ws/mutfak`;

        logInfo(`📡 WebSocket bağlantısı deneniyor: ${wsUrl}`);

        wsRef.current = new WebSocket(wsUrl);

        wsRef.current.onopen = () => {
          logInfo("✅ WebSocket bağlantısı başarılı.");
          setHataMesaji(null); // Bağlantı başarılıysa hata mesajını temizle
        };

        wsRef.current.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            logInfo(`📥 WebSocket mesajı alındı: Tip: ${message.type}`);

            // Gelen mesajı işle (örn: ping yanıtı veya sipariş durumu)
            if (message.type === 'pong') {
              // Ping yanıtı geldi, her şey yolunda.
            } else if (message.type === 'durum') {
              // Sipariş durumu güncellemesi geldi
              const { masa, durum } = message.data;
              logInfo(`📊 Durum güncellemesi: Masa ${masa}, Durum: ${durum}`);
              // Eğer bu masanın durumu güncellendiyse state'i güncelle
              if (String(masa) === String(masaId)) {
                setSiparisDurumu(durum);
                logInfo(`👍 Bu masanın sipariş durumu güncellendi: ${durum}`);
                // İsteğe bağlı olarak kullanıcıya bildirim verilebilir (örn: toast mesajı)
              }
            } else {
               logWarn(`⚠️ Bilinmeyen WebSocket mesaj tipi: ${message.type}`);
            }
          } catch (err) {
            logError("WebSocket mesajı işlenirken hata:", err);
          }
        };

        wsRef.current.onerror = (error) => {
          logError("❌ WebSocket hatası:", error);
          // Hata mesajını kullanıcıya gösterebiliriz
          setHataMesaji("Sunucuyla anlık bağlantı kurulamadı. Sayfayı yenilemeyi deneyin.");
          // Bağlantı tekrar denenecek (onclose içinde)
        };

        wsRef.current.onclose = (event) => {
          logInfo(`🔌 WebSocket bağlantısı kapandı. Kod: ${event.code}, Sebep: ${event.reason}`);
          // Eğer beklenmedik bir şekilde kapandıysa tekrar bağlanmayı dene (örn: 5 sn sonra)
          if (event.code !== 1000) { // 1000: Normal kapanma
             logInfo("WebSocket beklenmedik şekilde kapandı, 5 saniye sonra tekrar denenecek...");
             setTimeout(connectWebSocket, 5000);
          }
        };

      } catch (error) {
        logError("❌ WebSocket bağlantısı başlatılırken kritik hata:", error);
        setHataMesaji("Sunucu bağlantısı kurulamıyor.");
      }
    };

    // Periyodik ping gönderme (bağlantıyı canlı tutmak için)
    const pingInterval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        try {
            wsRef.current.send(JSON.stringify({ type: 'ping' }));
            // logInfo("PING ->"); // Çok fazla log üretebilir
        } catch (err) {
            logError("Ping gönderilirken hata:", err);
        }
      } else if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
          // Eğer bağlantı kapalıysa tekrar bağlanmayı dene
          logInfo("Ping: Bağlantı kapalı, tekrar bağlanılıyor...");
          connectWebSocket();
      }
    }, 30000); // 30 saniyede bir ping

    // İlk bağlantıyı kur
    connectWebSocket();

    // Component kaldırıldığında WebSocket bağlantısını kapat ve interval'ı temizle
    return () => {
      clearInterval(pingInterval);
      if (wsRef.current) {
        logInfo("Component kaldırılıyor, WebSocket bağlantısı kapatılıyor.");
        wsRef.current.close(1000, "Component unmounting"); // Normal kapanış kodu
      }
    };
  }, [API_BASE, masaId, logInfo, logError, logWarn]); // Bağımlılıklar eklendi

  // --- Menü Verisi Çekme ---
  useEffect(() => {
    const fetchMenu = async () => {
      if (!API_BASE) return;
      logInfo("🍽️ Menü verisi çekiliyor...");
      try {
        const res = await axios.get(`${API_BASE}/menu`);
        if (res.data && Array.isArray(res.data.menu)) {
          // Ürün adlarını küçük harfe çevirerek ve kategori bilgisiyle birlikte sakla
          const menuItems = res.data.menu.flatMap((cat) =>
            cat.urunler.map((u) => ({
              ad: u.ad.toLowerCase().trim(), // Küçük harf ve boşluksuz
              fiyat: u.fiyat,
              kategori: cat.kategori,
              stok_durumu: u.stok_durumu // Stok bilgisi de geldi
            }))
          );
          setMenuUrunler(menuItems);
          logInfo(`✅ Menü verisi başarıyla alındı (${menuItems.length} ürün).`);
        } else {
            logWarn("Menü verisi beklenen formatta değil:", res.data);
        }
      } catch (error) {
        logError("❌ Menü verisi alınamadı:", error);
        setHataMesaji("Menü bilgisi yüklenemedi.");
      }
    };
    fetchMenu();
  }, [API_BASE, logInfo, logError, logWarn]); // Bağımlılıklar

  // --- Başlık ve Karşılama Kontrolü ---
  useEffect(() => {
    document.title = `Neso Asistan - Masa ${masaId}`;

    // Karşılama mesajı sadece bir kere verilsin (localStorage ile kontrol)
    const karsilamaKey = `karsilama_yapildi_${masaId}`;
    if (localStorage.getItem(karsilamaKey) === 'true') {
      setKarsilamaYapildi(true);
    }
  }, [masaId]);

  // --- Sohbet Geçmişi Kaydırma ---
  useEffect(() => {
    // Mesaj kutusunu en alta kaydır
    if (mesajKutusuRef.current) {
      mesajKutusuRef.current.scrollTop = mesajKutusuRef.current.scrollHeight;
    }
  }, [gecmis]); // Sohbet geçmişi her değiştiğinde çalışır

  // --- Google TTS ile Sesli Yanıt Verme ---
  const sesliYanıtVer = useCallback(async (text) => {
     if (!API_BASE) {
        logError("API_BASE tanımlı değil, sesli yanıt verilemiyor.");
        throw new Error("API_BASE not defined");
     }
     if (!text) {
         logWarn("Seslendirilecek metin boş.");
         return; // Boş metni seslendirmeye çalışma
     }
     logInfo(`🔊 Sesli yanıt isteği gönderiliyor: "${text.substring(0, 50)}..."`);
     setAudioPlaying(true); // Ses çalmaya başlıyor
     setHataMesaji(null); // Hata varsa temizle

     try {
       const res = await axios.post(
         `${API_BASE}/sesli-yanit`,
         { text }, // Gönderilecek metin
         { responseType: "arraybuffer" } // Yanıtı byte dizisi olarak al
       );

       // Başarılı yanıt geldiyse sesi çal
       const blob = new Blob([res.data], { type: "audio/mpeg" });
       const url = URL.createObjectURL(blob);
       const audio = new Audio(url);

       // Eğer önceki ses çalıyorsa durdur
       if (audioRef.current) {
         audioRef.current.pause();
       }
       audioRef.current = audio; // Yeni sesi referans al

       await audio.play(); // Sesi çalmaya başla
       logInfo("✅ Sesli yanıt çalınıyor.");

       // Ses bittiğinde state'i güncelle ve URL'i serbest bırak
       audio.onended = () => {
         logInfo("🏁 Sesli yanıt çalma bitti.");
         setAudioPlaying(false);
         URL.revokeObjectURL(url); // Bellekten temizle
         audioRef.current = null;
       };
       audio.onerror = (err) => {
           logError("Ses çalma hatası:", err);
           setAudioPlaying(false); // Hata durumunda da state'i güncelle
           URL.revokeObjectURL(url);
           audioRef.current = null;
           setHataMesaji("Sesli yanıt oynatılırken bir sorun oluştu.");
       }

     } catch (error) {
       logError("❌ Google TTS veya ses çalma hatası:", error);
       setAudioPlaying(false); // Hata durumunda state'i güncelle
       setHataMesaji("Sesli yanıt alınamadı veya oynatılamadı.");
       // Fallback: Tarayıcının kendi TTS'ini kullan (varsa)
       if (synth && text) {
          logWarn("⚠️ Fallback TTS (tarayıcı) kullanılıyor.");
          try {
              const utt = new SpeechSynthesisUtterance(text);
              utt.lang = "tr-TR"; // Türkçe dil ayarı
              synth.speak(utt);
              // Tarayıcı TTS'i için onended takibi daha karmaşık olabilir
          } catch(ttsError){
              logError("Fallback TTS hatası:", ttsError);
          }
       } else {
           throw error; // Fallback de yoksa hatayı yukarı fırlat
       }
     }
  }, [API_BASE, logInfo, logError, logWarn]); // Bağımlılıklar

  // --- Karşılama Mesajını Oynat (Input'a ilk odaklanmada) ---
  const handleInputFocus = useCallback(async () => {
    // Eğer karşılama daha önce yapılmadıysa ve menü yüklendiyse
    if (!karsilamaYapildi && menuUrunler.length > 0) {
      const karsilamaKey = `karsilama_yapildi_${masaId}`;
      const greeting = `Merhaba, ben Neso. Fıstık Kafe sipariş asistanınızım. ${masaId} numaralı masaya hoş geldiniz. Size nasıl yardımcı olabilirim? Menümüzü saymamı ister misiniz?`;

      logInfo("👋 Karşılama mesajı hazırlanıyor...");
      setGecmis((prev) => [...prev, { soru: "", cevap: greeting }]); // Mesajı geçmişe ekle
      try {
        await sesliYanıtVer(greeting); // Sesli yanıt ver
        localStorage.setItem(karsilamaKey, 'true'); // Karşılama yapıldı olarak işaretle
        setKarsilamaYapildi(true); // State'i güncelle
      } catch (error) {
        // Hata sesliYanıtVer içinde loglandı, burada ek bir şey yapmaya gerek yok
      }
    }
  }, [karsilamaYapildi, masaId, menuUrunler.length, sesliYanıtVer, logInfo]); // Bağımlılıklar

  // --- Sesle Dinleme İşlemi ---
  const sesiDinle = useCallback(() => {
    if (!SpeechRecognition) {
      logError("🚫 Tarayıcı ses tanımayı desteklemiyor.");
      alert("Tarayıcınız ses tanımayı desteklemiyor.");
      return;
    }

    // Eğer zaten aktifse durdur
    if (micActive && recognitionRef.current) {
         logInfo("🎤 Mikrofon kapatılıyor.");
         recognitionRef.current.stop();
         setMicActive(false);
         return;
    }

    logInfo("🎤 Mikrofon başlatılıyor...");
    setHataMesaji(null); // Hata varsa temizle
    const recognizer = new SpeechRecognition();
    recognitionRef.current = recognizer; // Referansı sakla

    recognizer.lang = "tr-TR"; // Türkçe dinleme
    recognizer.continuous = false; // Tek bir sonuç yeterli
    recognizer.interimResults = false; // Ara sonuçları alma

    recognizer.start(); // Dinlemeyi başlat
    setMicActive(true); // Mikrofon state'ini güncelle

    // Ses tanıma sonucu geldiğinde
    recognizer.onresult = async (event) => {
      const transcript = event.results[0][0].transcript;
      logInfo(`👂 Ses tanıma sonucu: "${transcript}"`);
      setMicActive(false); // Mikrofonu kapat
      setMesaj(transcript); // Tanınan metni input'a yaz
      // Otomatik olarak gönder
      await gonder(transcript);
    };

    // Hata oluşursa
    recognizer.onerror = (event) => {
      logError("🎤 Ses tanıma hatası:", event.error);
      setMicActive(false); // Mikrofonu kapat
      if (event.error === 'no-speech') {
          setHataMesaji("Herhangi bir konuşma algılanmadı.");
      } else if (event.error === 'audio-capture') {
          setHataMesaji("Mikrofon erişim sorunu. İzinleri kontrol edin.");
      } else if (event.error === 'not-allowed') {
           setHataMesaji("Mikrofon kullanımı için izin verilmedi.");
      } else {
           setHataMesaji("Ses tanıma sırasında bir hata oluştu.");
      }
    };

    // Dinleme bittiğinde (ses kesildiğinde veya süre dolduğunda)
    recognizer.onend = () => {
      logInfo("🏁 Ses tanıma bitti.");
      setMicActive(false); // Mikrofon state'ini güncelle
      recognitionRef.current = null;
    };

  }, [micActive, gonder, logInfo, logError]); // Bağımlılıklar

  // --- Ürün Ayıklama Fonksiyonu ---
  const urunAyikla = useCallback((msg) => {
    const items = [];
    const lowerMsg = msg.toLowerCase();
    // Basit sipariş belirteçleri
    const siparisIstekli = /\b(ver|getir|istiyor|isterim|alabilir miyim|sipariş|ekle|olsun)\b/i.test(lowerMsg);

    if (!siparisIstekli) {
        logInfo("📝 Mesajda sipariş ifadesi bulunamadı, ürün ayıklama atlanıyor.");
        return []; // Sipariş ifadesi yoksa boş dön
    }

    logInfo(`📝 Sipariş ayıklama başlıyor: "${lowerMsg}"`);
    // Sayı ve birimi ayır (örn: "2çay" -> "2 çay")
    const cleanedMsg = lowerMsg.replace(/(\d+)([a-zçğıöşü])/gi, "$1 $2");
    // Sayı (opsiyonel) ve ürün adını yakalamak için regex
    // Örnek: "2 çay", "bir kahve", "sade tost"
    const pattern = /(?:(\d+|bir|iki|üç|dört|beş)\s+)?([a-zçğıöşü\s]+?)(?:\s*,\s*|\s+ve\s+|\s*$|\d|bir|iki|üç|dört|beş)/gi;
    let match;
    const sayiMap = { "bir": 1, "iki": 2, "üç": 3, "dört": 4, "beş": 5 };

    // Tüm eşleşmeleri bul
    while ((match = pattern.exec(cleanedMsg + " ")) !== null) { // Son kelimeyi de yakalamak için boşluk ekle
        const adetStr = match[1]; // Sayı kısmı (örn: "2", "bir")
        let adet = 1;
        if (adetStr) {
            adet = sayiMap[adetStr] || parseInt(adetStr) || 1;
        }

        const urunAdiHam = match[2].replace(/\b(tane|adet|tanesi)\b/gi, '').trim(); // "tane", "adet" gibi kelimeleri temizle

        if (!urunAdiHam) continue; // Boş ürün adı varsa atla

        let bestMatch = { urun: null, fiyat: 0, kategori: "", stok_durumu: 0, similarity: 0 };

        // Menüdeki her ürünle karşılaştır
        for (const menuItem of menuUrunler) {
            const similarity = calculateSimilarity(menuItem.ad, urunAdiHam);
            // Eğer daha iyi bir eşleşme bulunduysa veya stokta varsa ve eşik üzerindeyse
            if (similarity > bestMatch.similarity && similarity >= 0.70) { // Eşik değeri 0.70
                 bestMatch = { ...menuItem, similarity };
            }
        }

        // Eğer yeterince iyi bir eşleşme bulunduysa ve stoktaysa sepete ekle
        if (bestMatch.urun && bestMatch.stok_durumu === 1) {
            logInfo(`🛒 Bulunan Ürün: "${bestMatch.urun}" (Adet: ${adet}, Benzerlik: ${bestMatch.similarity.toFixed(2)})`);
            items.push({
                urun: bestMatch.urun, // Menüdeki orijinal adı (küçük harf)
                adet: adet,
                fiyat: bestMatch.fiyat,
                kategori: bestMatch.kategori
            });
            // Not: Aynı ürün tekrar bulunursa üzerine yazmak yerine adedi artırabiliriz (opsiyonel)
        } else if (bestMatch.urun && bestMatch.stok_durumu === 0) {
             logWarn(` स्टॉक खत्म Ürün bulundu ama stokta yok: "${bestMatch.urun}"`);
             // Kullanıcıya stokta olmadığı bilgisi AI yanıtında verilebilir.
        } else {
            logWarn(`❓ Ürün bulunamadı veya eşik altında: "${urunAdiHam}" (En yakın: ${bestMatch.urun}, Benzerlik: ${bestMatch.similarity.toFixed(2)})`);
        }
    }
    logInfo(`🛍️ Ayıklanan Sepet: ${items.length} çeşit ürün.`);
    return items;
  }, [menuUrunler, logInfo, logWarn]); // Bağımlılık

  // --- Mesaj Gönderme, Yanıt Alma ve Sipariş İşleme ---
  const gonder = useCallback(async (gonderilecekMesaj) => {
    const kullaniciMesaji = (gonderilecekMesaj ?? mesaj).trim(); // Gönderilecek mesajı al veya state'deki mesajı kullan
    if (!kullaniciMesaji || loading) {
      return; // Boş mesajı veya yükleme sırasında tekrar gönderme
    }

    logInfo(`➡️ Mesaj gönderiliyor: "${kullaniciMesaji}"`);
    setLoading(true); // Yükleme başladı
    setMesaj(""); // Input alanını temizle
    setHataMesaji(null); // Hata varsa temizle
    setGecmis((prev) => [...prev, { soru: kullaniciMesaji, cevap: "..." }]); // Kullanıcı sorusunu ve bekleme işaretini geçmişe ekle

    let aiYaniti = "";
    let siparisSepeti = [];

    try {
      // 1. AI Yanıtı Al
      const yanitRes = await axios.post(`${API_BASE}/yanitla`, {
        text: kullaniciMesaji,
        masa: masaId
      });
      aiYaniti = yanitRes.data.reply;
      logInfo(`⬅️ AI yanıtı alındı: "${aiYaniti.substring(0,50)}..."`);

      // Geçmişteki son mesajın AI yanıtını güncelle
      setGecmis((prev) => {
          const sonGecmis = [...prev];
          if (sonGecmis.length > 0) {
              sonGecmis[sonGecmis.length - 1].cevap = aiYaniti;
          }
          return sonGecmis;
      });

      // 2. Yanıtı Seslendir
      await sesliYanıtVer(aiYaniti);

      // 3. Mesajdan Sipariş Ayıkla
      siparisSepeti = urunAyikla(kullaniciMesaji);

      // 4. Sipariş Varsa Kaydet
      if (siparisSepeti.length > 0) {
        logInfo("📦 Geçerli sipariş bulundu, kaydediliyor...");
        const siparisData = {
          masa: masaId,
          istek: kullaniciMesaji, // Kullanıcının orijinal isteği
          yanit: aiYaniti, // AI'nın verdiği yanıt
          sepet: siparisSepeti // Ayıklanan ürünler [{urun, adet, fiyat, kategori}]
        };

        try {
          const siparisRes = await axios.post(
            `${API_BASE}/siparis-ekle`,
            siparisData,
            { headers: { "Content-Type": "application/json" } }
          );
          logInfo(`✅ Sipariş başarıyla kaydedildi. Yanıt: ${siparisRes.data.mesaj}`);
          setSiparisDurumu("bekliyor"); // Sipariş verildiğinde durumu 'bekliyor' yap
          // Backend zaten WebSocket yayını yapıyor, frontend'den tekrar göndermeye gerek yok.
          // mutfagaBildir(siparisData); // Bu satır kaldırıldı/yorumlandı.
        } catch (siparisHata) {
           logError("❌ Sipariş kaydetme API hatası:", siparisHata);
           // Kullanıcıya siparişin alınamadığı bilgisi verilebilir
           const hataDetayi = siparisHata.response?.data?.detail || siparisHata.message;
           setHataMesaji(`Siparişiniz kaydedilirken bir sorun oluştu: ${hataDetayi}`);
           // Sipariş kaydedilemese bile konuşma devam edebilir.
        }
      } else {
          logInfo("ℹ️ Mesajda kaydedilecek bir sipariş bulunamadı.");
      }

    } catch (error) {
      logError("❌ Mesaj gönderme/işleme hatası:", error);
      const hataDetayi = error.response?.data?.detail || error.message || "Bilinmeyen bir hata oluştu.";
      setHataMesaji(`İşlem sırasında bir hata oluştu: ${hataDetayi}`);
      // Hata durumunda geçmişteki "..." yanıtını güncelle
       setGecmis((prev) => {
          const sonGecmis = [...prev];
          if (sonGecmis.length > 0 && sonGecmis[sonGecmis.length-1].cevap === '...') {
               sonGecmis[sonGecmis.length - 1].cevap = `Üzgünüm, bir hata oluştu. (${hataDetayi})`;
          }
          return sonGecmis;
      });
      // Sesli yanıt hatası zaten kendi içinde loglanıyor/fallback yapıyor.
    } finally {
      setLoading(false); // Yükleme bitti
    }
  }, [mesaj, loading, API_BASE, masaId, sesliYanıtVer, urunAyikla, logInfo, logError]); // Bağımlılıklar

  // --- Konuşmayı Durdurma ---
  const durdur = useCallback(() => {
    if (audioRef.current) {
      logInfo("🛑 Konuşma manuel olarak durduruluyor.");
      audioRef.current.pause(); // Sesi duraklat
      audioRef.current.currentTime = 0; // Başa sar (opsiyonel)
      setAudioPlaying(false); // State'i güncelle
      // URL'i hemen serbest bırakmak sorun yaratabilir, onended beklenmeli normalde
    }
    // Tarayıcı TTS'ini de durdurmaya çalış
    if(synth && synth.speaking){
        synth.cancel();
        logInfo("🛑 Tarayıcı TTS durduruldu.");
        setAudioPlaying(false); // State'i güncelle (eğer tarayıcı TTS'i çalıyorsa)
    }
  }, []); // Bağımlılık yok

  // --- Sipariş Durumu Metni ---
  const getDurumText = (durum) => {
      switch(durum) {
          case 'bekliyor': return 'Siparişiniz Alındı, Bekliyor...';
          case 'hazirlaniyor': return 'Siparişiniz Hazırlanıyor... 👨‍🍳';
          case 'hazir': return 'Siparişiniz Hazır! Afiyet olsun. ✅';
          case 'iptal': return 'Siparişiniz İptal Edildi. ❌';
          default: return null;
      }
  };
  const durumText = getDurumText(siparisDurumu);

  // --- Render ---
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 flex items-center justify-center p-4 font-sans">
      <div className="bg-white/10 backdrop-blur-md shadow-2xl rounded-3xl p-6 w-full max-w-md text-white border border-white/30">
        {/* Başlık ve Masa Numarası */}
        <h1 className="text-3xl font-extrabold text-center mb-2">🎙️ Neso Asistan</h1>
        <p className="text-center mb-4 opacity-80">
          Masa No: <span className="font-semibold">{masaId}</span>
        </p>

        {/* Hata Mesajı Alanı */}
        {hataMesaji && (
            <div className="bg-red-500/50 border border-red-700 text-white px-4 py-2 rounded-lg mb-4 text-sm text-center">
                {hataMesaji}
            </div>
        )}

         {/* Sipariş Durumu Alanı */}
         {durumText && (
             <div className={`px-4 py-2 rounded-lg mb-4 text-sm text-center font-semibold ${
                 siparisDurumu === 'hazir' ? 'bg-green-500/80' :
                 siparisDurumu === 'hazirlaniyor' ? 'bg-blue-500/80' :
                 siparisDurumu === 'iptal' ? 'bg-red-500/80' :
                 'bg-yellow-500/80'
             }`}>
                 {durumText}
             </div>
         )}

        {/* Mesaj Giriş Alanı */}
        <input
          type="text"
          value={mesaj}
          onChange={(e) => setMesaj(e.target.value)}
          // Enter'a basıldığında mesajı gönder
          onKeyDown={(e) => e.key === "Enter" && !loading && !audioPlaying && gonder()}
          // İlk odaklanmada karşılama mesajını ver
          onFocus={handleInputFocus}
          placeholder={!karsilamaYapildi ? "Merhaba! Başlamak için tıklayın..." : "Konuşun veya yazın..."}
          className="w-full p-3 mb-4 rounded-xl bg-white/20 placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/80 transition duration-200"
          disabled={loading || audioPlaying} // Yükleme veya konuşma sırasında pasif
        />

        {/* Butonlar */}
        <div className="flex gap-3 mb-4">
          {/* Gönder Butonu */}
          <button
            onClick={() => gonder()}
            disabled={loading || audioPlaying || !mesaj.trim()} // Yükleniyorsa, konuşuyorsa veya mesaj boşsa pasif
            className={`flex-1 py-2 rounded-xl font-bold transition duration-200 ease-in-out active:scale-95 ${
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
            disabled={loading || audioPlaying || !SpeechRecognition} // Yükleniyorsa, konuşuyorsa veya tarayıcı desteklemiyorsa pasif
            className={`py-2 px-4 rounded-xl font-bold transition duration-200 ease-in-out active:scale-95 ${
              micActive ? "bg-red-600 hover:bg-red-700 text-white animate-pulse" : "bg-blue-500/80 hover:bg-blue-600/90 text-white"
            } ${loading || audioPlaying || !SpeechRecognition ? "opacity-50 cursor-not-allowed" : ""}`}
            aria-label={micActive ? "Dinlemeyi Durdur" : "Sesli Komut Ver"}
          >
             {micActive ? "🔴 Durdur" : "🎤 Dinle"}
          </button>
        </div>

        {/* Konuşmayı Durdur Butonu */}
        <button
          onClick={durdur}
          disabled={!audioPlaying} // Sadece Neso konuşuyorsa aktif
          className={`w-full py-2 mb-4 rounded-xl font-bold transition duration-200 ease-in-out active:scale-95 ${
            audioPlaying
              ? "bg-red-500/80 hover:bg-red-600/90 text-white"
              : "bg-gray-500/50 text-white/50 cursor-not-allowed"
          }`}
           aria-label="Neso'nun konuşmasını durdur"
        >
          🛑 Konuşmayı Durdur
        </button>

        {/* Sohbet Geçmişi */}
        <div
          ref={mesajKutusuRef}
          className="h-64 overflow-y-auto space-y-3 bg-black/20 p-3 rounded-xl scrollbar-thin scrollbar-thumb-white/30 scrollbar-track-transparent scrollbar-corner-transparent"
          aria-live="polite" // Yeni mesajlar geldiğinde ekran okuyuculara bildir
        >
          {gecmis.map((g, i) => (
            <div key={i} className="flex flex-col">
              {/* Kullanıcı Mesajı */}
              {g.soru && (
                <div className="bg-blue-500/60 p-2 rounded-lg rounded-br-none self-end max-w-[80%] mb-1 shadow">
                   <span className="font-semibold text-xs opacity-80 block mb-0.5">Siz</span>
                   <span className="text-sm">{g.soru}</span>
                </div>
              )}
              {/* Neso'nun Yanıtı */}
              {g.cevap && (
                 <div className={`bg-gray-600/60 p-2 rounded-lg ${g.soru ? 'rounded-bl-none' : ''} self-start max-w-[80%] shadow`}>
                    <span className="font-semibold text-xs opacity-80 block mb-0.5">Neso</span>
                    <span className="text-sm">{g.cevap === "..." ? <span className="animate-pulse">Yazıyor...</span> : g.cevap}</span>
                 </div>
              )}
            </div>
          ))}
           {loading && gecmis.length === 0 && ( // Başlangıçta yükleniyorsa
                <div className="text-center text-sm opacity-70 animate-pulse">Bağlanılıyor...</div>
           )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs opacity-60 mt-6">
          ☕ Neso Asistan v1.1 © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}

export default MasaAsistani;