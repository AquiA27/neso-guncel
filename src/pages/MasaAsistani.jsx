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
        logInfo("WebSocket zaten bağlı.");
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
          // *** EKLENEN LOG - WebSocket mesaj alımı ***
          console.log(`[Masa ${masaId}] DEBUG: WebSocket Mesajı Geldi:`, event.data);
          try {
            const message = JSON.parse(event.data); // Gelen veriyi JSON olarak işle
            logInfo(`📥 WebSocket mesajı alındı: Tip: ${message.type}`);

            if (message.type === 'pong') {
              // Sunucudan ping'e karşılık pong geldi, bağlantı canlı.
            } else if (message.type === 'durum') {
              // Sipariş durumu güncellemesi geldi
              const { masa, durum } = message.data;
              logInfo(`📊 Durum güncellemesi: Masa ${masa}, Durum: ${durum}`);
              // Eğer gelen güncelleme bu masaya aitse state'i güncelle
              if (String(masa) === String(masaId)) {
                setSiparisDurumu(durum);
                logInfo(`👍 Bu masanın sipariş durumu güncellendi: ${durum}`);
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
          logInfo(`🔌 WebSocket bağlantısı kapandı. Kod: ${event.code}, Sebep: ${event.reason}`);
          // Eğer normal bir kapanma değilse (kod 1000 değilse), tekrar bağlanmayı dene
          if (event.code !== 1000) {
            logInfo("WebSocket beklenmedik şekilde kapandı, 5 saniye sonra tekrar denenecek...");
            // Önceki timeout varsa temizle (gereksiz tekrar denemeleri önlemek için)
            // clearTimeout(wsRetryTimeoutRef.current); // Bunun için ek bir ref gerekir
            setTimeout(connectWebSocket, 5000);
          }
        };
      } catch (error) {
        // WebSocket nesnesi oluşturulurken bile hata olabilir
        logError("❌ WebSocket bağlantısı başlatılırken kritik hata:", error);
        setHataMesaji("Sunucu bağlantısı kurulamıyor.");
      }
    };

    // 30 saniyede bir sunucuya ping göndererek bağlantıyı canlı tut
    const pingInterval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        try { wsRef.current.send(JSON.stringify({ type: 'ping' })); }
        catch (err) { logError("Ping gönderilirken hata:", err); }
      } else if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
          // Bağlantı kapalıysa tekrar bağlanmayı dene
          logInfo("Ping: Bağlantı kapalı, tekrar bağlanılıyor...");
          connectWebSocket();
      }
    }, 30000);

    // Component yüklendiğinde ilk bağlantıyı kur
    connectWebSocket();

    // Component kaldırıldığında (unmount) interval'ı temizle ve WebSocket'i kapat
    return () => {
      clearInterval(pingInterval);
      if (wsRef.current) {
        logInfo("Component kaldırılıyor, WebSocket bağlantısı kapatılıyor.");
        wsRef.current.close(1000, "Component unmounting"); // Normal kapanma kodu
      }
    };
    // useEffect bağımlılıkları: Bu değerler değişirse effect yeniden çalışır
  }, [API_BASE, masaId, logInfo, logError, logWarn]);

  // --- Menü Verisini Backend'den Çekme ---
  useEffect(() => {
    const fetchMenu = async () => {
      if (!API_BASE) {
          logError("API_BASE tanımsız, menü çekilemiyor.");
          return;
      }
      logInfo("🍽️ Menü verisi çekiliyor...");
      try {
        const res = await axios.get(`${API_BASE}/menu`);
        if (res.data && Array.isArray(res.data.menu)) {
          // Gelen menü verisini işle: ürün adlarını küçük harfe çevir, stok durumunu al
          const menuItems = res.data.menu.flatMap((cat) =>
            cat.urunler.map((u) => ({
              ad: u.ad.toLowerCase().trim(),
              fiyat: u.fiyat,
              kategori: cat.kategori,
              stok_durumu: u.stok_durumu ?? 1 // Stok durumu yoksa varsayılan 1 (stokta var)
            }))
          );
          setMenuUrunler(menuItems); // Menü state'ini güncelle
          logInfo(`✅ Menü verisi başarıyla alındı (${menuItems.length} ürün).`);
        } else {
          // Beklenmedik formatta veri gelirse uyar
          logWarn("Menü verisi beklenen formatta değil:", res.data);
        }
      } catch (error) {
        // Hata olursa logla ve kullanıcıya mesaj göster
        logError("❌ Menü verisi alınamadı:", error);
        setHataMesaji("Menü bilgisi yüklenemedi.");
      }
    };
    fetchMenu(); // Component yüklendiğinde fonksiyonu çalıştır
    // useEffect bağımlılıkları: API_BASE değişirse yeniden çalıştır
  }, [API_BASE, logInfo, logError, logWarn]);

  // --- Sayfa Başlığını Ayarlama ve Karşılama Durumunu Kontrol Etme ---
  useEffect(() => {
     document.title = `Neso Asistan - Masa ${masaId}`; // Tarayıcı sekme başlığını ayarla
    // localStorage'dan bu masa için karşılama yapılıp yapılmadığını kontrol et
    const karsilamaKey = `karsilama_yapildi_${masaId}`;
    if (localStorage.getItem(karsilamaKey) === 'true') {
      setKarsilamaYapildi(true); // Daha önce yapıldıysa state'i güncelle
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
        // *** EKLENEN LOG - TTS hatası ***
        console.error(`[Masa ${masaId}] DEBUG: Sesli yanıt verilemiyor - API_BASE tanımsız.`);
        throw new Error("API_BASE not defined");
    }
    if (!text) { logWarn("Seslendirilecek metin boş."); return; }

    logInfo(`🔊 Sesli yanıt isteği: "${text.substring(0, 50)}..."`);
    setAudioPlaying(true); // Ses çalma başladığı için state'i true yap
    setHataMesaji(null); // Varsa önceki hatayı temizle

    try {
      // Backend'deki /sesli-yanit endpoint'ine POST isteği gönder
       // *** EKLENEN LOG - TTS isteği ***
      console.log(`[Masa ${masaId}] DEBUG: TTS isteği gönderiliyor: /sesli-yanit, Metin: "${text.substring(0,50)}..."`);
      const res = await axios.post(
          `${API_BASE}/sesli-yanit`,
          { text }, // İstek gövdesinde metni gönder
          { responseType: "arraybuffer" } // Yanıtı ses verisi olarak al (byte dizisi)
      );
       // *** EKLENEN LOG - TTS yanıtı ***
       console.log(`[Masa ${masaId}] DEBUG: TTS yanıtı alındı. Status: ${res.status}, Data length: ${res.data?.byteLength}`);

      // Gelen ses verisini Blob'a çevirip çalınabilir URL oluştur
      const blob = new Blob([res.data], { type: "audio/mpeg" });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url); // Yeni Audio nesnesi oluştur

      // Eğer başka bir ses çalıyorsa onu durdur
      if (audioRef.current) { audioRef.current.pause(); }
      audioRef.current = audio; // Yeni sesi referans al

      await audio.play(); // Sesi çal
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
        URL.revokeObjectURL(url);
        audioRef.current = null;
        setHataMesaji("Sesli yanıt oynatılamadı.");
      };
    } catch (error) {
      // API isteği veya başka bir hata olursa
      // *** EKLENEN LOG - TTS Catch Bloğu ***
      console.error(`[Masa ${masaId}] DEBUG: sesliYanıtVer catch bloğuna düşüldü. Hata:`, error);
      logError("❌ TTS/ses çalma hatası:", error);
      setAudioPlaying(false);
      setHataMesaji("Sesli yanıt alınamadı veya oynatılamadı.");
      // Fallback: Eğer tarayıcı kendi TTS'ini destekliyorsa onu kullanmayı dene
      if (synth && text) {
        // *** EKLENEN LOG - TTS Fallback ***
        console.warn(`[Masa ${masaId}] DEBUG: Tarayıcı TTS fallback kullanılıyor.`);
        logWarn("⚠️ Fallback TTS (tarayıcı) kullanılıyor.");
        try { const utt = new SpeechSynthesisUtterance(text); utt.lang = "tr-TR"; synth.speak(utt); }
        catch(ttsError){ logError("Fallback TTS hatası:", ttsError); }
      } else {
        // Fallback de yoksa veya başarısızsa hatayı yukarıya bildir
        throw error;
      }
    }
    // useCallback bağımlılıkları: Bu değerler değişirse fonksiyon yeniden oluşturulur
  }, [API_BASE, masaId, logInfo, logError, logWarn, synth]); // synth eklendi

  // --- Karşılama Mesajını Oynatma (Input'a ilk odaklanıldığında) ---
  const handleInputFocus = useCallback(async () => {
    // Eğer karşılama daha önce yapılmadıysa VE menü verisi yüklendiyse
    if (!karsilamaYapildi && menuUrunler.length > 0) {
      const karsilamaKey = `karsilama_yapildi_${masaId}`;
      const greeting = `Merhaba, ben Neso. Fıstık Kafe sipariş asistanınızım. ${masaId} numaralı masaya hoş geldiniz. Size nasıl yardımcı olabilirim? Menümüzü saymamı ister misiniz?`;
      logInfo("👋 Karşılama mesajı tetiklendi...");
      // Karşılama mesajını sohbet geçmişine ekle (Soru kısmı boş)
      setGecmis((prev) => [...prev, { soru: "", cevap: greeting }]);
      try {
        // Mesajı seslendir
        await sesliYanıtVer(greeting);
        // localStorage'a kaydederek tekrar gösterilmesini engelle
        localStorage.setItem(karsilamaKey, 'true');
        setKarsilamaYapildi(true); // State'i güncelle
      } catch (error) {
        logError("Karşılama mesajı seslendirilemedi:", error);
        // sesliYanıtVer fonksiyonu zaten hatayı logluyor ve kullanıcıya gösteriyor.
      }
    }
    // useCallback bağımlılıkları
  }, [karsilamaYapildi, masaId, menuUrunler.length, sesliYanıtVer, logInfo, logError]);

  // --- Kullanıcının Konuşmasından Ürünleri Ayıklama Fonksiyonu ---
   const urunAyikla = useCallback((msg) => {
    const items = []; // Bulunan ürünleri tutacak dizi
    const lowerMsg = (msg || '').toLowerCase(); // Gelen mesajı küçük harfe çevir (null kontrolüyle)

    // Mesaj içinde siparişle ilgili anahtar kelimeler var mı? (Basit kontrol)
    const siparisIstekli = /\b(ver|getir|istiyor|isterim|alabilir miyim|sipariş|ekle|olsun|yaz)\b/i.test(lowerMsg);
    // Eğer sipariş ifadesi yoksa, boş dizi döndür
    if (!siparisIstekli) { logInfo("📝 Mesajda sipariş ifadesi yok, ürün ayıklama atlanıyor."); return []; }

    logInfo(`📝 Sipariş ayıklama işlemi başlıyor: "${lowerMsg}"`);

    // "2çay" gibi birleşik ifadeleri ayır: "2 çay"
    const cleanedMsg = lowerMsg.replace(/(\d+)([a-zçğıöşü])/gi, "$1 $2");

    // "(sayı veya bir/iki..) (ürün adı)" formatını yakalamak için regex
    // Örnekler: "2 çay", "bir kahve", "sade tost", "üç kola ve 1 tost"
    // Biraz karmaşık bir regex, tüm durumları yakalamayabilir.
    const pattern = /(?:(\d+|bir|iki|üç|dört|beş)\s+)?([a-zçğıöşü\s]+?)(?:\s*,\s*|\s+ve\s+|\s+lütfen\b|\s+bi\b|\s*$|\d|bir|iki|üç|dört|beş)/gi;
    let match;
    const sayiMap = { "bir": 1, "iki": 2, "üç": 3, "dört": 4, "beş": 5 }; // Yazıyla sayıları çevir

    // Menü yüklenmemişse ayıklama yapma
    if (!menuUrunler || menuUrunler.length === 0) {
        logWarn("⚠️ Ürün ayıklama atlanıyor: Menü ürünleri henüz yüklenmemiş.");
        return [];
    }

    // Mesajdaki tüm potansiyel ürün ifadelerini bul
    while ((match = pattern.exec(cleanedMsg + " ")) !== null) { // Son kelimeyi de yakalamak için boşluk ekle
        const adetStr = match[1]; // Yakalanan sayı kısmı ("2", "bir" vb.)
        let adet = 1; // Varsayılan adet
        if (adetStr) { adet = sayiMap[adetStr] || parseInt(adetStr) || 1; } // Sayıyı çevir

        // Yakalanan ürün adı kısmını temizle ("tane", "adet" vb. çıkar)
        const urunAdiHam = match[2].replace(/\b(tane|adet|tanesi|çay|kahve|kola)\b/gi, '').trim();
        // Regex'in yanlışlıkla yakaladığı kısa veya anlamsız ifadeleri atla
        if (!urunAdiHam || urunAdiHam.length < 2) continue;

        let bestMatch = { urun: null, fiyat: 0, kategori: "", stok_durumu: 0, similarity: 0 };

        // Menüdeki her ürünle benzerliğini kontrol et
        for (const menuItem of menuUrunler) {
            // calculateSimilarity component içinde tanımlı
            const similarity = calculateSimilarity(menuItem.ad, urunAdiHam);
            // Eğer bulunan benzerlik önceki en iyi eşleşmeden daha iyiyse VE belirli bir eşiğin üzerindeyse
            if (similarity > bestMatch.similarity && similarity >= 0.70) { // Benzerlik eşiği 0.70
                 bestMatch = { ...menuItem, similarity }; // En iyi eşleşmeyi güncelle
            }
        }

        // Eğer yeterli benzerlikte bir ürün bulunduysa VE stoktaysa sepete ekle
        if (bestMatch.urun && bestMatch.stok_durumu === 1) {
            logInfo(`🛒 Bulunan Ürün: "${bestMatch.urun}" (Adet: ${adet}, Benzerlik: ${bestMatch.similarity.toFixed(2)})`);
            items.push({
                urun: bestMatch.urun, // Menüdeki adı (veritabanı için)
                adet: adet,
                fiyat: bestMatch.fiyat, // Fiyat bilgisini de ekleyelim
                kategori: bestMatch.kategori // Kategori bilgisini de ekleyelim
            });
        } else if (bestMatch.urun && bestMatch.stok_durumu === 0) {
             // Ürün bulundu ama stokta yoksa uyar
             logWarn(` Stokta yok: "${bestMatch.urun}"`);
             // AI yanıtta bu bilgi verilebilir.
        } else {
            // Eşleşme bulunamadı veya benzerlik düşükse uyar
            logWarn(`❓ Eşleşme bulunamadı/düşük: "${urunAdiHam}" (En yakın: ${bestMatch.urun || 'Yok'}, Benzerlik: ${bestMatch.similarity.toFixed(2)})`);
        }
    }
    logInfo(`🛍️ Ayıklanan Sepet Sonucu: ${items.length} çeşit ürün bulundu.`);
    return items; // Ayıklanan ürünlerin listesini döndür
   // useCallback bağımlılıkları
  }, [menuUrunler, logInfo, logWarn]); // menuUrunler eklendi

  // --- Ana Mesaj Gönderme ve İşleme Fonksiyonu ---
  const gonder = useCallback(async (gonderilecekMesaj) => {
    // Input'taki veya sesle gelen mesajı al, başındaki/sonundaki boşlukları sil
    const kullaniciMesaji = (gonderilecekMesaj ?? mesaj).trim();
    // Eğer mesaj boşsa veya zaten bir işlem yapılıyorsa gönderme
    if (!kullaniciMesaji || loading) return;

    logInfo(`➡️ Mesaj gönderiliyor: "${kullaniciMesaji}"`);
    setLoading(true); // Yükleniyor durumunu başlat
    setMesaj(""); // Input alanını temizle
    setHataMesaji(null); // Hata mesajını temizle
    // Kullanıcının sorusunu ve geçici "..." yanıtını sohbet geçmişine ekle
    setGecmis((prev) => [...prev, { soru: kullaniciMesaji, cevap: "..." }]);

    let aiYaniti = "";
    let siparisSepeti = [];

    try {
      // 1. Adım: Backend'den AI yanıtını al
      logInfo("Adım 1: AI Yanıtı alınıyor...");
      const yanitRes = await axios.post(`${API_BASE}/yanitla`, {
        text: kullaniciMesaji,
        masa: masaId
      });
      aiYaniti = yanitRes.data.reply; // Gelen yanıtı değişkene ata
      logInfo(`⬅️ AI yanıtı alındı: "${aiYaniti.substring(0,50)}..."`);

      // Sohbet geçmişindeki son elemanın ("...") cevabını gerçek AI yanıtıyla güncelle
      setGecmis((prev) => {
        const sonGecmis = [...prev];
        if (sonGecmis.length > 0) {
          sonGecmis[sonGecmis.length - 1].cevap = aiYaniti;
        }
        return sonGecmis;
      });

      // 2. Adım: AI yanıtını seslendir
      logInfo("Adım 2: AI Yanıtı seslendiriliyor...");
      await sesliYanıtVer(aiYaniti); // sesliYanıtVer component içinde tanımlı

      // 3. Adım: Kullanıcının mesajından sipariş olabilecek ürünleri ayıkla
      logInfo("Adım 3: Ürünler ayıklanıyor...");
      siparisSepeti = urunAyikla(kullaniciMesaji); // urunAyikla component içinde tanımlı
      // *** EKLENEN LOG - Ayıklanan Sepet ***
      console.log(`[Masa ${masaId}] DEBUG: Ayıklanan Sepet:`, JSON.stringify(siparisSepeti));

      // 4. Adım: Eğer ayıklanan sepette ürün varsa, siparişi backend'e kaydet
      // *** EKLENEN LOG - Sepet Kontrolü ***
      console.log(`[Masa ${masaId}] DEBUG: Sipariş sepeti kontrol ediliyor. Uzunluk: ${siparisSepeti.length}`);
      if (siparisSepeti.length > 0) {
        logInfo("📦 Geçerli sipariş bulundu, backend'e kaydediliyor...");
        const siparisData = {
          masa: masaId,
          istek: kullaniciMesaji, // Loglama ve referans için kullanıcının orijinal isteği
          yanit: aiYaniti, // AI'nın verdiği yanıt (loglama için)
          sepet: siparisSepeti // Ayıklanan ürünler [{urun, adet, fiyat, kategori}]
        };
         // *** EKLENEN LOG - Sipariş Gönderme Datası ***
        console.log(`[Masa ${masaId}] DEBUG: Sipariş API'ye gönderiliyor:`, JSON.stringify(siparisData));

        try {
          // /siparis-ekle endpoint'ine POST isteği gönder
          const siparisRes = await axios.post(
            `${API_BASE}/siparis-ekle`,
            siparisData,
            { headers: { "Content-Type": "application/json" } } // İçerik tipini belirt
          );
          logInfo(`✅ Sipariş başarıyla kaydedildi. Backend Yanıtı: ${siparisRes.data.mesaj}`);
          setSiparisDurumu("bekliyor"); // Yeni sipariş verildi, durumu "bekliyor" yap
        } catch (siparisHata) {
          // Sipariş kaydetme sırasında hata olursa logla ve kullanıcıya bildir
          // *** GÜNCELLENEN LOG - Sipariş Gönderme Hatası ***
          console.error(`[Masa ${masaId}] DEBUG: /siparis-ekle isteği HATASI:`, siparisHata);
          logError("❌ Sipariş kaydetme API hatası:", siparisHata);
          const hataDetayi = siparisHata.response?.data?.detail || siparisHata.message || "Bilinmeyen API hatası.";
          setHataMesaji(`Siparişiniz kaydedilirken bir sorun oluştu: ${hataDetayi}`);
          // Hatayı sohbet geçmişine de yazabiliriz
          setGecmis((prev) => [...prev, { soru: "", cevap: `Sipariş gönderilemedi: ${hataDetayi}` }]);
        }
      } else {
        // Mesajda sipariş olarak algılanan ürün yoksa bilgi ver
        logInfo("ℹ️ Mesajda kaydedilecek bir sipariş bulunamadı.");
      }

    } catch (error) {
      // Genel hata (AI yanıtı alma, seslendirme vb.)
       // *** EKLENEN LOG - Genel Gönder Hatası ***
      console.error(`[Masa ${masaId}] DEBUG: gonder fonksiyonu genel catch bloğuna düşüldü. Hata:`, error);
      logError("❌ Mesaj gönderme/işleme genel hatası:", error);
      const hataDetayi = error.response?.data?.detail || error.message || "Bilinmeyen bir hata oluştu.";
      setHataMesaji(`İşlem sırasında bir hata oluştu: ${hataDetayi}`);
      // Hata durumunda sohbet geçmişindeki "..." yanıtını hata mesajıyla güncelle
      setGecmis((prev) => {
        const sonGecmis = [...prev];
        if (sonGecmis.length > 0 && sonGecmis[sonGecmis.length-1].cevap === '...') {
          sonGecmis[sonGecmis.length - 1].cevap = `Üzgünüm, bir hata oluştu. (${hataDetayi})`;
        }
        return sonGecmis;
      });
    } finally {
      // Hata olsa da olmasa da yükleniyor durumunu bitir
      logInfo("Adım 5: İşlem tamamlandı (finally).");
      setLoading(false);
    }
    // useCallback bağımlılıkları
  }, [mesaj, loading, API_BASE, masaId, sesliYanıtVer, urunAyikla, logInfo, logError, logWarn]); // logWarn eklendi

   // --- Sesle Dinleme İşlemini Başlatma/Durdurma ---
   const sesiDinle = useCallback(() => {
     // Tarayıcı desteklemiyorsa uyarı ver
     if (!SpeechRecognition) { logError("🚫 Tarayıcı ses tanımayı desteklemiyor."); alert("Tarayıcı desteklemiyor."); return; }
    // Mikrofon zaten aktifse durdur
    if (micActive && recognitionRef.current) { logInfo("🎤 Mikrofon kapatılıyor."); recognitionRef.current.stop(); setMicActive(false); return; }

    logInfo("🎤 Mikrofon başlatılıyor..."); setHataMesaji(null);
    const recognizer = new SpeechRecognition(); recognitionRef.current = recognizer;
    recognizer.lang = "tr-TR"; // Türkçe dinle
    recognizer.continuous = false; // Tek bir sonuç döndürsün yeterli
    recognizer.interimResults = false; // Ara sonuçları istemiyoruz
    try {
        recognizer.start(); // Dinlemeye başla
        setMicActive(true); // Mikrofon butonunu aktif göster
    } catch (err) {
         logError("🎤 Mikrofon başlatılamadı:", err);
         setHataMesaji("Mikrofon başlatılamadı. İzinleri kontrol edin.");
         setMicActive(false);
         return;
    }


    // Sonuç geldiğinde
    recognizer.onresult = async (event) => {
        const transcript = event.results[0][0].transcript; // Tanınan metni al
        logInfo(`👂 Ses tanıma sonucu: "${transcript}"`);
        setMicActive(false); // Mikrofonu kapat (dinleme bittiği için)
        setMesaj(transcript); // Metni input'a yaz
        await gonder(transcript); // Otomatik olarak gönder fonksiyonunu çağır
    };
    // Hata oluşursa
    recognizer.onerror = (event) => {
        logError("🎤 Ses tanıma hatası:", event.error);
        setMicActive(false); // Mikrofonu kapat
        // Hata tipine göre kullanıcıya mesaj göster
        if (event.error === 'no-speech') { setHataMesaji("Konuşma algılanmadı."); }
        else if (event.error === 'audio-capture') { setHataMesaji("Mikrofon erişilemiyor."); }
        else if (event.error === 'not-allowed') { setHataMesaji("Mikrofon izni verilmedi."); }
        else { setHataMesaji(`Ses tanıma hatası: ${event.error}`); }
    };
    // Dinleme bittiğinde (başarılı sonuç olmasa bile)
    recognizer.onend = () => {
        // onresult tetiklenmişse micActive zaten false olmuştur.
        // Eğer onresult tetiklenmeden biterse (örn: hata, no-speech), burada false yapalım.
        if (micActive) {
             logInfo("🏁 Ses tanıma bitti (sonuçsuz veya hata ile).");
             setMicActive(false); // Mikrofonu kapat
        }
        recognitionRef.current = null; // Referansı temizle
    };
    // useCallback bağımlılıkları
  }, [micActive, gonder, logInfo, logError, masaId]); // masaId eklendi

  // --- Neso'nun Konuşmasını Durdurma Fonksiyonu ---
  const durdur = useCallback(() => {
    // Google TTS sesini durdur
    if (audioRef.current) {
        logInfo("🛑 Google TTS konuşması durduruluyor.");
        audioRef.current.pause();
        audioRef.current.currentTime = 0; // Başa sar
        setAudioPlaying(false); // State'i güncelle
    }
    // Tarayıcının kendi TTS sesini durdur (fallback durumunda)
    if(synth && synth.speaking){
        synth.cancel();
        logInfo("🛑 Tarayıcı TTS konuşması durduruldu.");
        setAudioPlaying(false); // State'i güncelle
    }
  }, [synth]); // synth eklendi

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
        {hataMesaji && (<div className="bg-red-500/50 border border-red-700 text-white px-4 py-2 rounded-lg mb-4 text-sm text-center">{hataMesaji}</div>)}

        {/* Sipariş Durumu Alanı */}
        {durumText && (<div className={`px-4 py-2 rounded-lg mb-4 text-sm text-center font-semibold ${ siparisDurumu === 'hazir' ? 'bg-green-500/80' : siparisDurumu === 'hazirlaniyor' ? 'bg-blue-500/80' : siparisDurumu === 'iptal' ? 'bg-red-500/80' : 'bg-yellow-500/80' }`}>{durumText}</div>)}

        {/* Mesaj Giriş Alanı */}
        <input
          type="text"
          value={mesaj}
          onChange={(e) => setMesaj(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !loading && !audioPlaying && gonder()}
          onFocus={handleInputFocus} // İlk tıklamada karşılama
          placeholder={!karsilamaYapildi ? "Merhaba! Başlamak için tıklayın..." : "Konuşun veya yazın..."}
          className="w-full p-3 mb-4 rounded-xl bg-white/20 placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/80 transition duration-200"
          disabled={loading || audioPlaying} // İşlem sırasında pasif yap
        />

        {/* Butonlar */}
        <div className="flex gap-3 mb-4">
          {/* Gönder Butonu */}
          <button
            onClick={() => gonder()}
            disabled={loading || audioPlaying || !mesaj.trim()} // Koşullara göre pasif yap
            className={`flex-1 py-2 rounded-xl font-bold transition duration-200 ease-in-out active:scale-95 ${ loading || audioPlaying || !mesaj.trim() ? "bg-gray-500/50 text-white/50 cursor-not-allowed" : "bg-green-500/80 hover:bg-green-600/90 text-white" }`}
            aria-label="Mesajı Gönder"
          >
            {loading ? "⏳ Gönderiliyor..." : "🚀 Gönder"}
          </button>
          {/* Dinle Butonu */}
          <button
            onClick={sesiDinle}
            disabled={loading || audioPlaying || !SpeechRecognition} // Koşullara göre pasif yap
            className={`py-2 px-4 rounded-xl font-bold transition duration-200 ease-in-out active:scale-95 ${ micActive ? "bg-red-600 hover:bg-red-700 text-white animate-pulse" : "bg-blue-500/80 hover:bg-blue-600/90 text-white" } ${loading || audioPlaying || !SpeechRecognition ? "opacity-50 cursor-not-allowed" : ""}`}
            aria-label={micActive ? "Dinlemeyi Durdur" : "Sesli Komut Ver"}
          >
            {micActive ? "🔴 Durdur" : "🎤 Dinle"}
          </button>
        </div>

        {/* Konuşmayı Durdur Butonu */}
        <button
          onClick={durdur}
          disabled={!audioPlaying} // Sadece ses çalıyorsa aktif
          className={`w-full py-2 mb-4 rounded-xl font-bold transition duration-200 ease-in-out active:scale-95 ${ audioPlaying ? "bg-red-500/80 hover:bg-red-600/90 text-white" : "bg-gray-500/50 text-white/50 cursor-not-allowed" }`}
          aria-label="Neso'nun konuşmasını durdur"
        >
          🛑 Konuşmayı Durdur
        </button>

         {/* Sohbet Geçmişi */}
         <div
           ref={mesajKutusuRef}
           className="h-64 overflow-y-auto space-y-3 bg-black/20 p-3 rounded-xl scrollbar-thin scrollbar-thumb-white/30 scrollbar-track-transparent scrollbar-corner-transparent"
           aria-live="polite"
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
            {/* Yükleniyor mesajı (eğer varsa) */}
            {loading && gecmis.length === 0 && (
                 <div className="text-center text-sm opacity-70 animate-pulse">Bağlanılıyor...</div>
            )}
         </div>

        {/* Footer */}
        <p className="text-center text-xs opacity-60 mt-6">☕ Neso Asistan v1.1 © {new Date().getFullYear()}</p>
      </div>
    </div>
  );
}

export default MasaAsistani;