import React, { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";

const API_BASE = process.env.REACT_APP_API_BASE;
// DİKKAT: Bu yöntem üretim ortamları için GÜVENLİ DEĞİLDİR!
// Güvenli bir kimlik doğrulama mekanizması (örn: Token tabanlı) kullanılmalıdır.
// TODO: AUTH_HEADER AdminPanel'deki gibi ortam değişkenlerinden alınmalı veya daha güvenli bir yöntem kullanılmalı.
const AUTH_HEADER = "Basic " + btoa("admin:admin123");

function MutfakEkrani() {
  const [orders, setOrders] = useState([]); // Görüntülenecek siparişler
  const [error, setError] = useState(null); // Hata mesajları için state
  const [loading, setLoading] = useState(true); // Siparişler yükleniyor mu?
  const wsRef = useRef(null); // WebSocket bağlantısı referansı
  const audioRef = useRef(null); // Sesli bildirim için Audio nesnesi referansı

  // --- Yardımcı Fonksiyonlar ---
  // useCallback ile gereksiz yeniden oluşumları engelle
  const logInfo = useCallback((message) => console.log(`[Mutfak Ekranı] INFO: ${message}`), []);
  const logError = useCallback((message, error) => console.error(`[Mutfak Ekranı] ERROR: ${message}`, error || ''), []);
  const logWarn = useCallback((message) => console.warn(`[Mutfak Ekranı] WARN: ${message}`), []);

  // --- Sesli Bildirim Nesnesini Hazırla ---
  useEffect(() => {
    if (typeof window !== 'undefined') {
        try {
            const audioSrc = (process.env.PUBLIC_URL || '') + "/notification.mp3";
            audioRef.current = new Audio(audioSrc);
            // audioRef.current.preload = "auto"; // Opsiyonel
            logInfo("🔔 Sesli bildirim nesnesi oluşturuldu: " + audioSrc);
        } catch (err) {
            logError("Sesli bildirim nesnesi oluşturulamadı:", err);
        }
    }
  }, [logInfo, logError]); // Bağımlılıklar doğru

  // --- Sayfa Başlığı ---
  useEffect(() => {
    document.title = "Mutfak Paneli - Neso";
  }, []); // Bağımlılık yok, sadece mount'ta çalışır

  // --- Siparişleri Getirme Fonksiyonu ---
  const fetchOrders = useCallback(async () => {
    logInfo("🔄 Siparişler getiriliyor...");
    if (!API_BASE) {
      logError("API_BASE tanımlı değil.");
      setError("API adresi yapılandırılmamış.");
      setLoading(false); // Yüklemeyi bitir
      return;
    }
    setError(null); // Yeni istek öncesi hatayı temizle
    setLoading(true); // Yüklemeyi başlat
    try {
      const response = await axios.get(`${API_BASE}/siparisler`, {
        headers: { Authorization: AUTH_HEADER } // Kimlik doğrulama başlığını gönder
      });
      // Gelen verinin formatını kontrol et
      if (response.data && Array.isArray(response.data.orders)) {
          setOrders(response.data.orders); // Siparişleri state'e ata
          logInfo(`✅ Siparişler başarıyla getirildi (${response.data.orders.length} adet).`);
      } else {
           logWarn("API'den beklenen formatta sipariş verisi gelmedi.", response.data);
           setOrders([]); // Hatalı formatta veri gelirse listeyi boşalt
           setError("Sunucudan beklenmedik formatta sipariş verisi alındı.");
      }
    } catch (err) {
      logError("❌ Siparişler alınamadı:", err);
      const errorDetail = err.response?.data?.detail || err.message || "Bilinmeyen bir hata oluştu.";
      if (err.response?.status === 401) { // Yetkilendirme hatası
          setError("Siparişleri görüntülemek için yetkiniz yok veya kimlik bilgileri hatalı.");
          // Burada belki AdminPanel'deki gibi logout mekanizması tetiklenebilir.
      } else { // Diğer hatalar (503 vs.)
          setError(`Siparişler alınamadı: ${errorDetail}`);
      }
       setOrders([]); // Hata durumunda mevcut siparişleri temizle
    } finally {
       setLoading(false); // Yükleme bitti
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [API_BASE, logInfo, logError, logWarn]); // AUTH_HEADER state değil, dependency değil.

  // --- WebSocket Bağlantısı Kurulumu ---
  useEffect(() => {
    const connectWebSocket = () => {
        // Zaten bağlıysa veya API Base yoksa işlem yapma
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;
        if (!API_BASE) { logError("API_BASE tanımlı değil, WS bağlantısı kurulamıyor."); return; }

      try {
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsHost = API_BASE.replace(/^https?:\/\//, '');
        const wsUrl = `${wsProtocol}//${wsHost}/ws/mutfak`; // Mutfak odasına bağlan
        logInfo(`📡 WebSocket bağlantısı deneniyor: ${wsUrl}`);
        wsRef.current = new WebSocket(wsUrl);

        wsRef.current.onopen = () => {
            logInfo("✅ WebSocket bağlantısı başarılı.");
        };

        wsRef.current.onmessage = (event) => {
           console.log("[Mutfak Ekranı] DEBUG: WebSocket Mesajı Geldi:", event.data); // Gelen mesajı logla
           try {
             const message = JSON.parse(event.data);
             logInfo(`📥 WebSocket mesajı alındı: Tip: ${message.type}`);
             // Sadece sipariş veya durum mesajıysa listeyi yenile
             if (message.type === 'siparis' || message.type === 'durum') {
                 logInfo(`📦 WS: ${message.type} mesajı alındı, liste güncelleniyor...`);
                 // Yeni sipariş ise ses çalmayı dene
                 if (message.type === 'siparis' && audioRef.current) {
                     try {
                        audioRef.current.currentTime = 0;
                        audioRef.current.play().catch(playError => logError("Sesli bildirim otomatik çalınamadı (kullanıcı etkileşimi gerekebilir):", playError));
                     } catch (audioError) { logError("Ses nesnesiyle ilgili hata:", audioError); }
                 }
                 fetchOrders(); // Listeyi güncelle
             } else if (message.type === 'pong') { /* Ping yanıtı - işlem yok */ }
              else { logWarn(`⚠️ Bilinmeyen WS mesaj tipi: ${message.type}`); }
           } catch (err) { logError("WS mesajı işlenirken hata:", err); }
        };

        wsRef.current.onerror = (errorEvent) => {
          logError("❌ WebSocket hatası:", errorEvent);
          setError("Sunucuyla anlık bağlantı kesildi (WebSocket)."); // Daha spesifik hata mesajı
        };

        wsRef.current.onclose = (event) => {
          logInfo(`🔌 WebSocket bağlantısı kapandı. Kod: ${event.code}, Sebep: ${event.reason || 'Yok'}`);
          const currentWs = wsRef.current; // Kapanış anındaki referans
          wsRef.current = null; // Referansı temizle
          // Sadece beklenmedik kapanma durumunda tekrar bağlanmayı dene (1000 ve 1001 hariç)
          if (event.code !== 1000 && event.code !== 1001) {
            logInfo("WS beklenmedik şekilde kapandı, 5sn sonra tekrar denenecek...");
            // Tekrar bağlanma timeout'u öncekiyle çakışmasın diye küçük bir rastgelelik eklenebilir.
            setTimeout(connectWebSocket, 5000 + Math.random() * 1000);
          }
        };
      } catch (error) {
        logError("❌ WS başlatılırken kritik hata:", error);
        setError("Sunucu bağlantısı (WebSocket) kurulamıyor.");
      }
    };

    // Bağlantı durumunu ve ping'i yöneten interval
     const intervalId = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        // Bağlantı açıksa ping gönder
        try { wsRef.current.send(JSON.stringify({ type: 'ping' })); }
        catch (err) { logError("Ping gönderilemedi:", err); }
      } else if (!wsRef.current) {
        // Bağlantı hiç kurulmamışsa veya kapanmışsa (ref null ise) kurmayı dene
        // logInfo("WS Interval: Bağlantı kapalı/yok, bağlanılıyor..."); // Sık log olabilir
        connectWebSocket();
      }
      // Eğer bağlantı CLOSING veya CONNECTING ise bir şey yapma, kendi kendine çözülmesini bekle
    }, 30000); // 30 saniyede bir kontrol et

    // İlk bağlantıyı kur ve siparişleri getir
    connectWebSocket();
    fetchOrders();

    // Component kaldırıldığında interval'ı ve WebSocket'i temizle
    return () => {
      clearInterval(intervalId); // interval'ı temizle
      if (wsRef.current) {
        logInfo("Component kaldırılıyor, WS kapatılıyor.");
        wsRef.current.close(1000, "Component unmounting"); // Normal kapatma kodu
        wsRef.current = null; // Referansı temizle
      }
    };
  // fetchOrders'ı dependency array'den çıkardık, useCallback içinde olduğu için referansı değişmez ama
  // içerideki state güncellemeleri gereksiz tetiklemelere yol açabilir. İlk yükleme için dışarıda çağrılıyor.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [API_BASE, logInfo, logError, logWarn]); // fetchOrders dependency değil

  // --- Sipariş Durumu Güncelleme Fonksiyonu ---
  const updateOrderStatus = useCallback(async (siparisId, masa, durum) => {
    logInfo(`🔄 Sipariş durumu güncelleniyor: ID: ${siparisId}, Masa: ${masa}, Yeni Durum: ${durum}`);
    if (!API_BASE) { logError("API_BASE tanımlı değil."); setError("API adresi yapılandırılmamış."); return; }
    // Optimistic UI: İsteği göndermeden önce state'i güncelleyebiliriz (opsiyonel)
    // setOrders(prevOrders => prevOrders.map(o => o.id === siparisId ? { ...o, durum: durum } : o));
    setError(null); // Önceki hatayı temizle
    try {
      await axios.post(`${API_BASE}/siparis-guncelle`, { id: siparisId, masa, durum }, {
        headers: { Authorization: AUTH_HEADER, 'Content-Type': 'application/json' }
      });
      logInfo(`✅ Sipariş durumu başarıyla güncellendi (ID: ${siparisId}).`);
      // Başarılı olursa listeyi tekrar çekerek sunucuyla senkronize ol (veya WS mesajını bekle)
      // Optimistic UI kullanmadıysak veya emin olmak istiyorsak fetchOrders çağrılır.
       fetchOrders();
    } catch (error) {
      logError(`❌ Sipariş durumu güncellenemedi (ID: ${siparisId}):`, error);
      const errorDetail = error.response?.data?.detail || error.message || "Bilinmeyen bir hata oluştu.";
      if (error.response?.status === 401) {
          setError("Yetkiniz yok veya kimlik bilgileri hatalı.");
      } else {
          setError(`Sipariş durumu güncellenirken bir hata oluştu: ${errorDetail}`);
      }
      // Hata durumunda eski sipariş listesini geri yükleyebiliriz (eğer optimistic UI yapıldıysa)
      // Veya sadece tekrar fetch ederek sunucudaki son durumu alırız.
       fetchOrders(); // Hata durumunda da sunucudaki son durumu al
    }
  }, [API_BASE, fetchOrders, logInfo, logError]); // fetchOrders dependency

  // --- Buton Handler'ları ---
  // useCallback'e gerek yok çünkü basitçe updateOrderStatus'u çağırıyorlar.
  const handleHazirlaniyor = (siparisId, masa) => updateOrderStatus(siparisId, masa, "hazirlaniyor");
  const handleHazir = (siparisId, masa) => updateOrderStatus(siparisId, masa, "hazir");
  const handleIptal = (siparisId, masa) => {
    if (window.confirm(`Masa ${masa}, Sipariş #${siparisId} iptal edilecek. Emin misiniz?`)) {
      updateOrderStatus(siparisId, masa, "iptal");
    }
  };

  // --- Zaman Formatlama ---
  const formatTime = (timeStr) => {
    if (!timeStr) return "-";
    try {
      const date = new Date(timeStr);
      if (isNaN(date.getTime())) return timeStr; // Geçersiz tarih kontrolü
      // Intl.DateTimeFormat tarayıcı desteği iyidir.
      return new Intl.DateTimeFormat('tr-TR', {
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
      }).format(date);
    } catch (e) {
      logError("Zaman formatlama hatası:", e); // Hata olursa logla
      return timeStr; // Hata olursa orijinal string'i döndür
    }
  };

  // --- Sipariş Kartı Rengi ---
   const getStatusColors = (status) => {
        switch (status) {
            case 'bekliyor': return "bg-yellow-100 border-yellow-300";
            case 'hazirlaniyor': return "bg-blue-100 border-blue-300";
            case 'hazir': return "bg-green-100 border-green-300";
            case 'iptal': return "bg-red-100 border-red-300 text-gray-500 line-through";
            default: return "bg-gray-100 border-gray-300"; // Bilinmeyen durumlar için
        }
    };

   // --- Render ---
  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-100 via-orange-100 to-orange-200 p-6 text-gray-800 font-sans">
      <h1 className="text-4xl font-bold text-center mb-8 text-orange-700">👨‍🍳 Mutfak Sipariş Paneli</h1>

      {/* Hata Mesajı Alanı */}
      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded relative mb-4 shadow" role="alert">
          <strong className="font-bold">Hata: </strong>
          <span className="block sm:inline mr-2">{error}</span>
          {/* Hata mesajının yanında yeniden deneme butonu */}
          <button
            onClick={fetchOrders}
            className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-semibold transition duration-200 ease-in-out"
            disabled={loading} // Yükleme sırasında butonu pasif yap
            >
             {loading ? 'Yükleniyor...' : 'Tekrar Dene'}
           </button>
        </div>
      )}

      {/* Yükleniyor Göstergesi */}
      {loading && (
         <div className="text-center p-8 text-orange-600 animate-pulse">
            Siparişler yükleniyor...
         </div>
      )}

      {/* Sipariş Yok Mesajı (Yükleme bittikten sonra VE hata yoksa VE sipariş gerçekten yoksa) */}
      {!loading && orders.length === 0 && !error && (
        <div className="text-center p-8 bg-white rounded-xl shadow-md mt-8">
          <p className="text-gray-500 text-lg">📭 Gösterilecek aktif sipariş bulunmamaktadır.</p>
        </div>
      )}

      {/* Sipariş Kartları (Yükleme bittikten sonra VE sipariş varsa) */}
      {!loading && orders.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {/* orders state'i artık backend'den gelen orijinal listeyi tutuyor */}
          {orders.map((order) => {

            // *** BAŞLANGIÇ: GÜNCELLENMİŞ SEPET PARSE ETME VE HATA YÖNETİMİ ***
            let sepetItems = [];
            let parseError = null;

            // order.sepet'in varlığını, string olup olmadığını ve boş olmadığını kontrol et
            if (order.sepet && typeof order.sepet === 'string' && order.sepet.trim() !== '') {
                try {
                    const parsedSepet = JSON.parse(order.sepet);
                    // Dizi kontrolü
                    if (Array.isArray(parsedSepet)) {
                        // Geçerli ürünleri filtrele (item, item.urun, item.adet kontrolü)
                        sepetItems = parsedSepet.filter(item =>
                            item && typeof item === 'object' && // item null veya primitive değilse
                            item.urun && typeof item.urun === 'string' && // urun var ve string ise
                            typeof item.adet === 'number' && item.adet > 0 // adet var, sayı ve 0'dan büyükse
                        );
                    } else {
                        // Parse edildi ama dizi değil
                        parseError = new Error("Sepet verisi array formatında değil.");
                        logError(`❌ Sepet verisi array değil (ID: ${order.id}):`, order.sepet);
                    }
                } catch (e) {
                    // JSON parse hatası
                    parseError = e;
                    // Hata zaten loglanıyor (component scope'undaki logError ile)
                    // logError(`❌ Sepet verisi çözümlenemedi (ID: ${order.id}):`, e); // Bu satır gereksiz
                }
            } else {
                // Sepet alanı boş veya geçersiz tipteyse logla
                logWarn(`Sipariş ID ${order.id}: Sepet verisi boş veya geçersiz tipte.`);
                // Bu durumu hata olarak kabul edebiliriz veya boş sepet olarak devam edebiliriz.
                // Şimdilik hata olarak işaretlemeyelim, sepetItems boş kalacak.
            }

            // Eğer parse hatası varsa, bu kart için özel bir hata gösterimi yap
            if (parseError) {
                return (
                    <div key={order.id || `error-${Math.random()}`}
                         className="bg-red-100 border border-red-300 rounded-xl shadow-md p-5 opacity-75"> {/* Hatalı kartı soluklaştır */}
                        <p className="font-semibold text-lg text-red-700 mb-1">Hata: Sipariş ID {order.id}</p>
                        <p className="text-sm text-red-600">Sipariş detayı okunamadı.</p>
                        <p className="text-xs text-gray-500 mt-1">({parseError.message})</p>
                        <p className="text-xs text-gray-500 mt-2">Zaman: {formatTime(order.zaman)}</p>
                         {/* Debug için hatalı veriyi göster: */}
                        <details className="mt-2 text-xs">
                           <summary className="cursor-pointer text-gray-600">Detayı Gör</summary>
                           <pre className="bg-red-50 p-1 mt-1 overflow-auto max-h-24"><code>{String(order.sepet)}</code></pre>
                        </details>
                    </div>
                );
            }

            // Parse hatası yok ama filtrelenmiş sepet boşsa (geçerli ürün yoksa)
            // Bu siparişleri mutfakta göstermenin bir anlamı yok, atlayalım.
            if (sepetItems.length === 0) {
                 logWarn(`Geçerli ürün içermeyen sipariş atlandı (ID: ${order.id})`);
                 return null; // Kartı render etme
            }
            // *** BİTİŞ: GÜNCELLENMİŞ SEPET PARSE ETME VE HATA YÖNETİMİ ***


            // --- Sepet geçerliyse ve içinde ürün varsa kartı render et ---
            const cardColors = getStatusColors(order.durum);

            return (
              <div
                key={order.id}
                className={`${cardColors} rounded-xl shadow-md p-4 hover:shadow-lg transition-all duration-300 ease-in-out flex flex-col`}
              >
                {/* Kart Başlığı */}
                <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-300/50">
                  <p className="font-semibold text-lg text-gray-800"> {/* Renk düzeltildi */}
                     #{order.id} / <span className="font-bold">Masa: {order.masa}</span>
                  </p>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                    order.durum === 'hazir' ? 'bg-green-500 text-white' :
                    order.durum === 'hazirlaniyor' ? 'bg-blue-500 text-white' :
                    order.durum === 'iptal' ? 'bg-red-500 text-white' :
                    order.durum === 'bekliyor' ? 'bg-yellow-500 text-white' :
                    'bg-gray-500 text-white' // Bilinmeyen durumlar için
                  }`}>
                    {order.durum || 'Bilinmiyor'} {/* Default text eklendi */}
                  </span>
                </div>

                {/* Sipariş İçeriği */}
                <div className="bg-white/60 rounded p-3 mb-3 flex-grow">
                  <ul className="space-y-1.5">
                    {sepetItems.map((item, index) => (
                      // Key olarak index yerine daha stabil bir şey kullanmak iyi olurdu ama ürün adı tekrarlayabilir.
                      // Şimdilik order.id + index + ürün adı kombinasyonu kullanılabilir.
                      <li key={`${order.id}-${index}-${item.urun}`} className="flex justify-between items-start text-sm text-gray-700"> {/* Renk düzeltildi */}
                        <span className="flex-1 mr-2 break-words">• {item.urun}</span> {/* Uzun isimler için kelime bölme */}
                        <span className="font-semibold text-orange-700">× {item.adet}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                 {/* Müşteri Notu (varsa) */}
                 {order.istek && (
                    <div className="mb-3 p-2 bg-amber-100/80 rounded border border-amber-300 text-amber-800 text-xs italic break-words"> {/* Kelime bölme */}
                      <span className="font-semibold">Not:</span> {order.istek}
                    </div>
                 )}

                {/* Aksiyon Butonları (Sadece bekliyor veya hazırlanıyor durumundaysa) */}
                {(order.durum === 'bekliyor' || order.durum === 'hazirlaniyor') && (
                  <div className="flex flex-wrap gap-2 mt-auto pt-3 border-t border-gray-300/50"> {/* flex-wrap eklendi */}
                    {/* Duruma göre butonları göster */}
                    {order.durum === 'bekliyor' && (
                      <button onClick={() => handleHazirlaniyor(order.id, order.masa)} className="flex-1 min-w-[100px] bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-semibold transition duration-200 ease-in-out active:scale-95 shadow hover:shadow-md" title="Siparişi hazırlamaya başla">
                        🔵 Hazırlanıyor
                      </button>
                    )}
                    {order.durum === 'hazirlaniyor' && (
                      <button onClick={() => handleHazir(order.id, order.masa)} className="flex-1 min-w-[80px] bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded-lg text-sm font-semibold transition duration-200 ease-in-out active:scale-95 shadow hover:shadow-md" title="Sipariş hazırlandı">
                        ✅ Hazır
                      </button>
                    )}
                    {/* İptal butonu her iki durumda da görünebilir */}
                    <button onClick={() => handleIptal(order.id, order.masa)} className="flex-initial bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-lg text-sm font-semibold transition duration-200 ease-in-out active:scale-95 shadow hover:shadow-md" title="Siparişi iptal et">
                      ❌ İptal
                    </button>
                  </div>
                )}

                {/* Zaman Bilgisi */}
                <div className="text-right mt-3 text-xs text-gray-500 pt-2 border-t border-gray-300/20"> {/* Hafif ayıraç */}
                  ⏱️ {formatTime(order.zaman)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default MutfakEkrani;