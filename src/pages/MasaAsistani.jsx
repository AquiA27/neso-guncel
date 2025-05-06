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
  const { masaId } = useParams(); // URL'den masa numarasını al örn: /masa/1 -> masaId = "1"
  const [mesaj, setMesaj] = useState(""); // Kullanıcının input alanına yazdığı metin
  const [gecmis, setGecmis] = useState([]); // Sohbet geçmişini tutan dizi [{soru, cevap}, ...]
  const [loading, setLoading] = useState(false); // Backend'den yanıt veya işlem bekleniyor mu? (Butonları pasif yapmak için)
  const [micActive, setMicActive] = useState(false); // Mikrofon (ses tanıma) aktif mi?
  const [audioPlaying, setAudioPlaying] = useState(false); // Neso'nun sesi (TTS) çalıyor mu?
  const [menuUrunler, setMenuUrunler] = useState([]); // Backend'den çekilen menü ürünlerinin listesi
  const [karsilamaYapildi, setKarsilamaYapildi] = useState(false); // Karşılama mesajı verildi mi? (localStorage ile kontrol edilir)
  const [siparisDurumu, setSiparisDurumu] = useState(null); // Bu masanın son siparişinin durumu (string: bekliyor, hazirlaniyor, hazir, iptal)
  const [hataMesaji, setHataMesaji] = useState(null); // Kullanıcıya gösterilecek hata mesajı (string)

  // --- Referanslar (DOM elementlerine veya kalıcı nesnelere erişim için) ---
  const audioRef = useRef(null); // <audio> elementini veya Audio nesnesini tutar
  const mesajKutusuRef = useRef(null); // Sohbet geçmişinin gösterildiği div (scroll için)
  const wsRef = useRef(null); // WebSocket bağlantı nesnesini tutar
  const recognitionRef = useRef(null); // Ses tanıma nesnesini tutar

  // --- Yardımcı Fonksiyonlar (Component İçine Taşındı) ---

  /**
   * İki string arasındaki Levenshtein mesafesini hesaplar.
   * Bu, iki stringin ne kadar farklı olduğunu ölçer (kaç ekleme/silme/değiştirme gerekli).
   */
  const levenshteinDistance = (a = '', b = '') => { // Varsayılan değerler eklendi
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    // Matris oluşturma
    const matrix = Array(a.length + 1).fill(null).map(() => Array(b.length + 1).fill(null));
    for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
    for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
    // Mesafeyi hesaplama
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
      }
    }
    return matrix[a.length][b.length];
  };

  /**
   * Levenshtein mesafesini kullanarak 0 ile 1 arasında bir benzerlik skoru hesaplar.
   * Skor 1'e yaklaştıkça stringler daha benzerdir.
   */
  const calculateSimilarity = (str1 = '', str2 = '') => { // Varsayılan değerler eklendi
    const distance = levenshteinDistance(str1, str2);
    const maxLength = Math.max(str1.length, str2.length);
    if (maxLength === 0) return 1; // İkisi de boşsa %100 benzer
    return 1 - distance / maxLength; // Mesafe ne kadar azsa benzerlik o kadar yüksek
  };

  /**
   * Sipariş durum kodunu kullanıcıya gösterilecek metne çevirir.
   */
  const getDurumText = (durum) => {
    switch(durum) {
        case 'bekliyor': return 'Siparişiniz Alındı, Bekliyor...';
        case 'hazirlaniyor': return 'Siparişiniz Hazırlanıyor... 👨‍🍳';
        case 'hazir': return 'Siparişiniz Hazır! Afiyet olsun. ✅';
        case 'iptal': return 'Siparişiniz İptal Edildi. ❌';
        default: return null; // Bilinmeyen veya null durum için bir şey gösterme
    }
  };
  // --- Yardımcı Fonksiyonlar Sonu --- //

  // --- Loglama Fonksiyonları (useCallback ile gereksiz yeniden oluşumları engelle) ---
  const logInfo = useCallback((message) => console.log(`[Masa ${masaId}] INFO: ${message}`), [masaId]);
  const logError = useCallback((message, error) => console.error(`[Masa ${masaId}] ERROR: ${message}`, error || ''), [masaId]);
  const logWarn = useCallback((message) => console.warn(`[Masa ${masaId}] WARN: ${message}`), [masaId]);

  // --- WebSocket Bağlantısı Kurulum ve Yönetimi ---
  useEffect(() => {
    // WebSocket bağlantısını kuran ve yöneten fonksiyon
    const connectWebSocket = () => {
      // Zaten açık bir bağlantı varsa tekrar kurma
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        // logInfo("WebSocket zaten bağlı."); // Sık loglama yapmamak için yorumlandı
        return;
      }
      // API adresi tanımlı değilse hata ver ve çık
      if (!API_BASE) {
          logError("API_BASE tanımlı değil, WebSocket bağlantısı kurulamıyor.");
          setHataMesaji("API bağlantı adresi bulunamadı."); // Kullanıcıya göster
          return;
      }

      try {
        // Güvenli (wss) veya güvensiz (ws) protokolü belirle
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        // API adresinden http/https kaldırıp hostu al
        const wsHost = API_BASE.replace(/^https?:\/\//, '');
        // Tam WebSocket URL'ini oluştur (/ws/mutfak endpoint'ine bağlanır)
        const wsUrl = `${wsProtocol}//${wsHost}/ws/mutfak`;

        logInfo(`📡 WebSocket bağlantısı deneniyor: ${wsUrl}`);
        wsRef.current = new WebSocket(wsUrl); // Yeni WebSocket nesnesi oluştur

        // Bağlantı başarıyla açıldığında
        wsRef.current.onopen = () => {
          logInfo("✅ WebSocket bağlantısı başarılı.");
          setHataMesaji(null); // Varsa önceki hatayı temizle
        };

        // Sunucudan mesaj geldiğinde
        wsRef.current.onmessage = (event) => {
          // DEBUG logu: Gelen mesajı ham haliyle göster
          console.log(`[Masa ${masaId}] DEBUG: WebSocket Mesajı Geldi:`, event.data);
          try {
            const message = JSON.parse(event.data); // Gelen veriyi JSON olarak işle
            logInfo(`📥 WebSocket mesajı alındı: Tip: ${message.type}`);

            if (message.type === 'pong') {
              // Sunucudan ping'e karşılık pong geldi, bağlantı canlı.
            } else if (message.type === 'durum') {
              // Sipariş durumu güncellemesi geldi
              const { masa, durum } = message.data || {}; // message.data null olabilir
              if (masa !== undefined && durum !== undefined) {
                  logInfo(`📊 Durum güncellemesi: Masa ${masa}, Durum: ${durum}`);
                  // Eğer gelen güncelleme bu masaya aitse state'i güncelle
                  if (String(masa) === String(masaId)) {
                    setSiparisDurumu(durum);
                    logInfo(`👍 Bu masanın sipariş durumu güncellendi: ${durum}`);
                  }
              } else {
                  logWarn("⚠️ Geçersiz 'durum' mesajı formatı alındı:", message.data);
              }
            } else {
              // Bilinmeyen mesaj tipi
              logWarn(`⚠️ Bilinmeyen WebSocket mesaj tipi: ${message.type}`);
            }
          } catch (err) {
            logError("WebSocket mesajı işlenirken hata:", err);
          }
        };

        // WebSocket hatası oluştuğunda
        wsRef.current.onerror = (error) => {
          logError("❌ WebSocket hatası:", error);
          setHataMesaji("Sunucuyla anlık bağlantı kesildi..."); // Kullanıcıya göster
        };

        // WebSocket bağlantısı kapandığında/kapatıldığında
        wsRef.current.onclose = (event) => {
          logInfo(`🔌 WebSocket bağlantısı kapandı. Kod: ${event.code}, Sebep: ${event.reason || 'Yok'}`);
          const currentWs = wsRef.current; // Kapanış anındaki ref
          wsRef.current = null; // Referansı temizle
          // Eğer normal bir kapanma değilse (1000 veya 1001 değilse), tekrar bağlanmayı dene
          if (event.code !== 1000 && event.code !== 1001) {
            logInfo("WebSocket beklenmedik şekilde kapandı, 5 saniye sonra tekrar denenecek...");
            setTimeout(connectWebSocket, 5000 + Math.random() * 1000); // Küçük bir gecikme ekleyerek çakışmayı önle
          }
        };
      } catch (error) {
        // WebSocket nesnesi oluşturulurken bile hata olabilir
        logError("❌ WebSocket bağlantısı başlatılırken kritik hata:", error);
        setHataMesaji("Sunucu bağlantısı kurulamıyor.");
      }
    };

    // 30 saniyede bir sunucuya ping göndererek bağlantıyı canlı tut veya yeniden kur
    const pingInterval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        try { wsRef.current.send(JSON.stringify({ type: 'ping' })); }
        catch (err) { logError("Ping gönderilirken hata:", err); }
      } else if (!wsRef.current) { // Eğer bağlantı referansı null ise (kapandı veya hiç kurulmadı)
        // logInfo("Ping: Bağlantı kapalı/yok, tekrar bağlanılıyor..."); // Sık log olabilir
        connectWebSocket(); // Tekrar bağlanmayı dene
      }
      // CONNECTING veya CLOSING durumundaysa bekle
    }, 30000);

    // Component yüklendiğinde ilk bağlantıyı kur
    connectWebSocket();

    // Component kaldırıldığında (unmount) interval'ı temizle ve WebSocket'i kapat
    return () => {
      clearInterval(pingInterval);
      if (wsRef.current) {
        logInfo("Component kaldırılıyor, WebSocket bağlantısı kapatılıyor.");
        wsRef.current.close(1000, "Component unmounting"); // Normal kapanma kodu
        wsRef.current = null;
      }
    };
    // useEffect bağımlılıkları: API_BASE veya masaId değişirse yeniden çalışır
  }, [API_BASE, masaId, logInfo, logError, logWarn]);

  // --- Menü Verisini Backend'den Çekme ---
  useEffect(() => {
    const fetchMenu = async () => {
      if (!API_BASE) {
          logError("API_BASE tanımsız, menü çekilemiyor.");
          setHataMesaji("API adresi yapılandırılmamış."); // Hata mesajını state'e yaz
          return;
      }
      logInfo("🍽️ Menü verisi çekiliyor...");
      setHataMesaji(null); // Önceki hatayı temizle
      try {
        const res = await axios.get(`${API_BASE}/menu`);
        if (res.data && Array.isArray(res.data.menu)) {
          // Gelen menü verisini işle: ürün adlarını küçük harfe çevir, stok durumunu al
          const menuItems = res.data.menu.flatMap((cat) =>
             // Sadece ürünler dizisi varsa ve array ise işle
             Array.isArray(cat.urunler) ? cat.urunler.map((u) => ({
              // Ürün adı ve fiyat zorunlu, diğerleri opsiyonel olabilir
              ad: u.ad ? String(u.ad).toLowerCase().trim() : 'İsimsiz Ürün',
              fiyat: typeof u.fiyat === 'number' ? u.fiyat : 0,
              kategori: cat.kategori || 'Bilinmeyen Kategori',
              stok_durumu: u.stok_durumu ?? 1 // Stok durumu yoksa varsayılan 1 (stokta var)
            })) : [] // Ürünler yoksa veya array değilse boş dizi dön
          );
          setMenuUrunler(menuItems); // Menü state'ini güncelle
          logInfo(`✅ Menü verisi başarıyla alındı (${menuItems.length} ürün).`);
        } else {
          // Beklenmedik formatta veri gelirse uyar
          logWarn("Menü verisi beklenen formatta değil:", res.data);
          setHataMesaji("Menü verisi sunucudan alınamadı (format hatası).");
        }
      } catch (error) {
        // Hata olursa logla ve kullanıcıya mesaj göster
        logError("❌ Menü verisi alınamadı:", error);
        setHataMesaji(`Menü bilgisi yüklenemedi: ${error.message}`);
      }
    };
    fetchMenu(); // Component yüklendiğinde fonksiyonu çalıştır
    // useEffect bağımlılıkları: API_BASE değişirse yeniden çalıştır
  }, [API_BASE, logInfo, logError, logWarn]);

  // --- Sayfa Başlığını Ayarlama ve Karşılama Durumunu Kontrol Etme ---
  useEffect(() => {
     document.title = `Neso Asistan - Masa ${masaId}`; // Tarayıcı sekme başlığını ayarla
    // localStorage'dan bu masa için karşılama yapılıp yapılmadığını kontrol et
    if (typeof window !== 'undefined') { // localStorage sadece tarayıcıda var
        const karsilamaKey = `karsilama_yapildi_${masaId}`;
        if (localStorage.getItem(karsilamaKey) === 'true') {
          setKarsilamaYapildi(true); // Daha önce yapıldıysa state'i güncelle
        }
    }
    // useEffect bağımlılıkları: masaId değişirse yeniden çalıştır
  }, [masaId]);

  // --- Sohbet Geçmişi Değiştiğinde Scroll'u En Alta Kaydırma ---
  useEffect(() => {
     if (mesajKutusuRef.current) {
       // Scroll'u en alta ayarla (yeni mesajları görmek için)
       mesajKutusuRef.current.scrollTop = mesajKutusuRef.current.scrollHeight;
     }
     // useEffect bağımlılıkları: gecmis state'i değiştiğinde yeniden çalıştır
  }, [gecmis]);

  // --- Google TTS ile Sesli Yanıt Verme Fonksiyonu ---
  const sesliYanıtVer = useCallback(async (text) => {
    // API adresi yoksa veya metin boşsa çık
    if (!API_BASE) {
        logError("API_BASE tanımlı değil...");
        console.error(`[Masa ${masaId}] DEBUG: Sesli yanıt verilemiyor - API_BASE tanımsız.`);
        throw new Error("API_BASE not defined");
    }
    if (!text || typeof text !== 'string' || !text.trim()) { // Metin geçerli mi kontrolü
        logWarn("Seslendirilecek geçerli metin boş.");
        return;
    }

    logInfo(`🔊 Sesli yanıt isteği: "${text.substring(0, 50)}..."`);
    setAudioPlaying(true); // Ses çalma başladığı için state'i true yap
    setHataMesaji(null); // Varsa önceki hatayı temizle

    try {
      // Backend'deki /sesli-yanit endpoint'ine POST isteği gönder
      console.log(`[Masa ${masaId}] DEBUG: TTS isteği gönderiliyor: /sesli-yanit, Metin: "${text.substring(0,50)}..."`);
      const res = await axios.post(
          `${API_BASE}/sesli-yanit`,
          { text }, // İstek gövdesinde metni gönder
          { responseType: "arraybuffer" } // Yanıtı ses verisi olarak al (byte dizisi)
      );
      console.log(`[Masa ${masaId}] DEBUG: TTS yanıtı alındı. Status: ${res.status}, Data length: ${res.data?.byteLength}`);

       // Yanıt verisi var mı kontrolü
      if (!res.data || res.data.byteLength < 100) { // Küçük bir boyut kontrolü
          throw new Error("Sunucudan boş veya geçersiz ses verisi alındı.");
      }

      // Gelen ses verisini Blob'a çevirip çalınabilir URL oluştur
      const blob = new Blob([res.data], { type: "audio/mpeg" });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url); // Yeni Audio nesnesi oluştur

      // Eğer başka bir ses çalıyorsa onu durdur
      if (audioRef.current) { audioRef.current.pause(); }
      audioRef.current = audio; // Yeni sesi referans al

      // Sesi çal ve hataları yakala
      await audio.play();
      logInfo("✅ Sesli yanıt çalınıyor.");

      // Ses çalma bittiğinde yapılacaklar
      audio.onended = () => {
        logInfo("🏁 Sesli yanıt bitti.");
        setAudioPlaying(false); // Ses çalma bittiği için state'i false yap
        URL.revokeObjectURL(url); // Oluşturulan URL'i bellekten temizle
        audioRef.current = null; // Referansı temizle
      };
      // Ses çalarken hata olursa
      audio.onerror = (err) => {
        logError("Ses çalma hatası:", err);
        setAudioPlaying(false);
        URL.revokeObjectURL(url); // Hata durumunda da URL'i temizle
        audioRef.current = null;
        setHataMesaji("Sesli yanıt oynatılamadı.");
      };
    } catch (error) {
      // API isteği veya başka bir hata olursa
      console.error(`[Masa ${masaId}] DEBUG: sesliYanıtVer catch bloğuna düşüldü. Hata:`, error);
      logError("❌ TTS/ses çalma hatası:", error);
      setAudioPlaying(false);
      const hataMesajiDetay = error.response?.data?.detail || error.message || "Bilinmeyen TTS hatası.";
      setHataMesaji(`Sesli yanıt alınamadı: ${hataMesajiDetay}`);

      // Fallback: Tarayıcı TTS (Hata durumunda çalıştır)
      if (synth && text) {
        console.warn(`[Masa ${masaId}] DEBUG: Tarayıcı TTS fallback kullanılıyor.`);
        logWarn("⚠️ Fallback TTS (tarayıcı) kullanılıyor.");
        try {
            // Önceki konuşmaları iptal et (varsa)
            synth.cancel();
            const utt = new SpeechSynthesisUtterance(text);
            utt.lang = "tr-TR";
             // Konuşma bitince state'i güncelle
             utt.onend = () => {
                 logInfo("🏁 Fallback TTS (tarayıcı) bitti.");
                 setAudioPlaying(false);
             };
             // Konuşma sırasında hata olursa
             utt.onerror = (errEvent) => {
                 logError("Fallback TTS (tarayıcı) hatası:", errEvent);
                 setAudioPlaying(false);
             };
             setAudioPlaying(true); // Tarayıcı konuşmaya başlayınca state'i true yap
             synth.speak(utt);
        }
        catch(ttsError){ logError("Fallback TTS hatası:", ttsError); setAudioPlaying(false); }
      } else {
        // Fallback de yoksa veya başarısızsa hatayı yukarıya bildir (zaten state'e yazıldı)
      }
    }
  }, [API_BASE, masaId, logInfo, logError, logWarn, synth]); // Bağımlılıklar doğru

  // --- Karşılama Mesajını Oynatma (Input'a ilk odaklanıldığında) ---
  const handleInputFocus = useCallback(async () => {
    // Karşılama sadece bir kez ve menü yüklendikten sonra yapılır
    if (!karsilamaYapildi && menuUrunler.length > 0) {
      const karsilamaKey = `karsilama_yapildi_${masaId}`;
      const greeting = `Merhaba, ben Neso. Fıstık Kafe sipariş asistanınızım. ${masaId} numaralı masaya hoş geldiniz. Size nasıl yardımcı olabilirim? Menümüzü saymamı ister misiniz?`;
      logInfo("👋 Karşılama mesajı tetikleniyor...");
      // Karşılama mesajını sohbet geçmişine ekle (Soru kısmı boş)
      setGecmis((prev) => [...prev, { soru: "", cevap: greeting }]);
      try {
        // Mesajı seslendir
        await sesliYanıtVer(greeting);
        // localStorage'a kaydederek tekrar gösterilmesini engelle
        if (typeof window !== 'undefined') {
            localStorage.setItem(karsilamaKey, 'true');
        }
        setKarsilamaYapildi(true); // State'i güncelle
      } catch (error) {
        logError("Karşılama mesajı seslendirilemedi:", error);
        // sesliYanıtVer hatayı zaten state'e yazar.
      }
    }
  }, [karsilamaYapildi, masaId, menuUrunler.length, sesliYanıtVer, logInfo, logError]); // Bağımlılıklar doğru

  // --- Kullanıcının Konuşmasından Ürünleri Ayıklama Fonksiyonu ---
   const urunAyikla = useCallback((msg) => {
    const items = [];
    const lowerMsg = (msg || '').toLowerCase();

    // *** DÜZELTME: Sipariş istekliliği kontrolü kaldırıldı ***
    // const siparisIstekli = /\b(ver|getir|istiyor|isterim|alabilir miyim|sipariş|ekle|olsun|yaz)\b/i.test(lowerMsg);
    // if (!siparisIstekli) { logInfo("📝 Mesajda sipariş ifadesi yok, ürün ayıklama atlanıyor."); return []; }
    logInfo(`📝 Sipariş ayıklama işlemi başlıyor: "${lowerMsg}"`);

    // Menü yüklenmemişse ayıklama yapma
    if (!menuUrunler || menuUrunler.length === 0) {
        logWarn("⚠️ Ürün ayıklama atlanıyor: Menü ürünleri henüz yüklenmemiş.");
        // Hata mesajı gösterilebilir veya boş dönülebilir. Boş dönelim.
        // setHataMesaji("Ürünleri ayıklamak için menü bilgisi bekleniyor.");
        return [];
    }

    // "2çay" gibi birleşik ifadeleri ayır: "2 çay"
    const cleanedMsg = lowerMsg.replace(/(\d+)([a-zçğıöşü])/gi, "$1 $2");

    const pattern = /(?:(\d+|bir|iki|üç|dört|beş)\s+)?([a-zçğıöşü\s]+?)(?:\s*,\s*|\s+ve\s+|\s+lütfen\b|\s+bi\b|\s*$|\d|bir|iki|üç|dört|beş)/gi;
    let match;
    const sayiMap = { "bir": 1, "iki": 2, "üç": 3, "dört": 4, "beş": 5 };

    // Mesajdaki tüm potansiyel ürün ifadelerini bul
    while ((match = pattern.exec(cleanedMsg + " ")) !== null) {
        const adetStr = match[1];
        let adet = 1;
        if (adetStr) { adet = sayiMap[adetStr.toLowerCase()] || parseInt(adetStr) || 1; } // Sayıyı çevir (lowercase eklendi)

        // Yakalanan ürün adı kısmını temizle ve trim et
        const urunAdiHam = match[2]
            .replace(/\b(tane|adet|tanesi|çay|kahve|kola|tost|su)\b/gi, '') // Genel kelimeleri çıkar (isteğe bağlı genişletilebilir)
            .replace(/\s+/g, ' ') // Birden fazla boşluğu tek boşluğa indir
            .trim();

        // Çok kısa (<3 karakter) veya anlamsız ifadeleri atla (isteğe bağlı ayarlanabilir)
        if (!urunAdiHam || urunAdiHam.length < 3) continue;

        let bestMatch = null; // En iyi eşleşmeyi tutacak obje
        let maxSimilarity = 0.70; // Minimum benzerlik eşiği (ayarlanabilir)

        // Menüdeki her ürünle benzerliğini kontrol et
        for (const menuItem of menuUrunler) {
            const similarity = calculateSimilarity(menuItem.ad, urunAdiHam);
            // Eğer benzerlik eşikten yüksekse ve önceki en iyi eşleşmeden daha iyiyse
            if (similarity >= maxSimilarity && similarity > (bestMatch?.similarity || 0)) {
                 bestMatch = { ...menuItem, similarity }; // En iyi eşleşmeyi güncelle
            }
        }

        // Eğer yeterli benzerlikte bir ürün bulunduysa VE stoktaysa sepete ekle
        if (bestMatch && bestMatch.stok_durumu === 1) {
            logInfo(`🛒 Bulunan Ürün: "${bestMatch.ad}" (İstenen: "${urunAdiHam}", Adet: ${adet}, Benzerlik: ${bestMatch.similarity.toFixed(2)})`);
            items.push({
                urun: bestMatch.ad, // Menüdeki orijinal adı (büyük/küçük harf duyarlı olabilir backend'de)
                adet: adet,
                fiyat: bestMatch.fiyat,
                kategori: bestMatch.kategori
            });
        } else if (bestMatch && bestMatch.stok_durumu === 0) {
             logWarn(` Stokta yok: "${bestMatch.ad}" (İstenen: "${urunAdiHam}")`);
             // Kullanıcıya bilgi vermek için ayrı bir mekanizma gerekebilir (örn: AI yanıtta belirtme)
        } else {
            // Eşleşme bulunamadı veya benzerlik düşükse uyar
            // logWarn(`❓ Eşleşme bulunamadı/düşük: "${urunAdiHam}"`); // Çok fazla log üretebilir
        }
    }
    logInfo(`🛍️ Ayıklanan Sepet Sonucu: ${items.length} çeşit ürün bulundu.`);
    return items; // Ayıklanan ürünlerin listesini döndür
   // useCallback bağımlılıkları
  }, [menuUrunler, logInfo, logWarn]); // menuUrunler eklendi

  // --- Ana Mesaj Gönderme ve İşleme Fonksiyonu ---
  const gonder = useCallback(async (gonderilecekMesaj) => {
    const kullaniciMesaji = (gonderilecekMesaj ?? mesaj).trim();
    if (!kullaniciMesaji || loading) return;

    logInfo(`➡️ Mesaj gönderiliyor: "${kullaniciMesaji}"`);
    setLoading(true); setMesaj(""); setHataMesaji(null);
    setGecmis((prev) => [...prev, { soru: kullaniciMesaji, cevap: "..." }]);

    let aiYaniti = "";
    let siparisSepeti = []; // Bu scope'ta tanımlı

    try {
      // 1. Adım: Backend'den AI yanıtını al
      logInfo("Adım 1: AI Yanıtı alınıyor...");
      const yanitRes = await axios.post(`${API_BASE}/yanitla`, { text: kullaniciMesaji, masa: masaId });
      aiYaniti = yanitRes.data.reply || "Üzgünüm, bir yanıt alamadım."; // Yanıt yoksa default mesaj
      logInfo(`⬅️ AI yanıtı alındı: "${aiYaniti.substring(0,50)}..."`);

      setGecmis((prev) => prev.map((g, i) => i === prev.length - 1 ? { ...g, cevap: aiYaniti } : g)); // Son cevabı güncelle

      // 2. Adım: AI yanıtını seslendir
      logInfo("Adım 2: AI Yanıtı seslendiriliyor...");
      await sesliYanıtVer(aiYaniti);

      // 3. Adım: Kullanıcının mesajından sipariş olabilecek ürünleri ayıkla
      logInfo("Adım 3: Ürünler ayıklanıyor...");
      siparisSepeti = urunAyikla(kullaniciMesaji);
      console.log(`[Masa ${masaId}] DEBUG: Ayıklanan Sepet:`, JSON.stringify(siparisSepeti));

      // 4. Adım: Eğer ayıklanan sepette ürün varsa, siparişi backend'e kaydet
      console.log(`[Masa ${masaId}] DEBUG: Sipariş sepeti kontrol ediliyor. Uzunluk: ${siparisSepeti.length}`);
      if (siparisSepeti.length > 0) {
        logInfo("📦 Geçerli sipariş bulundu, backend'e kaydediliyor...");
        const siparisData = {
          masa: masaId,
          istek: kullaniciMesaji,
          yanit: aiYaniti,
          sepet: siparisSepeti // Artık geçerli ürünleri içeriyor
        };
        console.log(`[Masa ${masaId}] DEBUG: Sipariş API'ye gönderiliyor:`, JSON.stringify(siparisData));

        try {
          const siparisRes = await axios.post(`${API_BASE}/siparis-ekle`, siparisData, {
            headers: { "Content-Type": "application/json" }
          });
          logInfo(`✅ Sipariş başarıyla kaydedildi. Backend Yanıtı: ${siparisRes.data.mesaj}`);
          setSiparisDurumu("bekliyor"); // Sipariş durumunu güncelle (opsiyonel, WS'den de gelebilir)
        } catch (siparisHata) {
          console.error(`[Masa ${masaId}] DEBUG: /siparis-ekle isteği HATASI:`, siparisHata);
          logError("❌ Sipariş kaydetme API hatası:", siparisHata);
          const hataDetayi = siparisHata.response?.data?.detail || siparisHata.message || "Bilinmeyen API hatası.";
          setHataMesaji(`Siparişiniz kaydedilirken bir sorun oluştu: ${hataDetayi}`);
          setGecmis((prev) => [...prev, { soru: "", cevap: `Sipariş gönderilemedi: ${hataDetayi}` }]);
        }
      } else {
        logInfo("ℹ️ Mesajda kaydedilecek bir sipariş bulunamadı.");
      }

    } catch (error) {
      // Genel hata (AI yanıtı alma, seslendirme vb.)
      console.error(`[Masa ${masaId}] DEBUG: gonder fonksiyonu genel catch bloğuna düşüldü. Hata:`, error);
      logError("❌ Mesaj gönderme/işleme genel hatası:", error);
      const hataDetayi = error.response?.data?.detail || error.message || "Bilinmeyen bir hata oluştu.";
      setHataMesaji(`İşlem sırasında bir hata oluştu: ${hataDetayi}`);
      setGecmis((prev) => prev.map((g, i) => i === prev.length - 1 && g.cevap === '...' ? { ...g, cevap: `Üzgünüm, bir hata oluştu. (${hataDetayi})` } : g));
    } finally {
      logInfo("Adım 5: İşlem tamamlandı (finally).");
      setLoading(false); // Yükleniyor durumunu bitir
    }
  }, [mesaj, loading, API_BASE, masaId, sesliYanıtVer, urunAyikla, logInfo, logError, logWarn]); // Bağımlılıklar doğru

   // --- Sesle Dinleme İşlemini Başlatma/Durdurma ---
   const sesiDinle = useCallback(() => {
     if (!SpeechRecognition) { logError("🚫 Tarayıcı ses tanımayı desteklemiyor."); alert("Tarayıcı desteklemiyor."); return; }
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
  }, [micActive, gonder, logInfo, logError, masaId]); // Bağımlılıklar doğru

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
  }, [synth, logInfo]); // Bağımlılıklar doğru

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

         {/* Sohbet Geçmişi */}
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

        {/* Footer */}
        <p className="text-center text-xs opacity-60 mt-6">☕ Neso Asistan v1.2 © {new Date().getFullYear()}</p>
      </div>
    </div>
  );
}

export default MasaAsistani;