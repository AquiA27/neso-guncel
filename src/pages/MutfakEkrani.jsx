import React, { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";

const API_BASE = process.env.REACT_APP_API_BASE;
// DİKKAT: Bu yöntem üretim ortamları için GÜVENLİ DEĞİLDİR!
// Güvenli bir kimlik doğrulama mekanizması (örn: Token tabanlı) kullanılmalıdır.
// AUTH_HEADER artık AdminPanel gibi ortam değişkenlerinden alınmalı veya props olarak geçilmeli.
// Şimdilik eski haliyle bırakıyorum ama AdminPanel'deki gibi düzeltilmesi önerilir.
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
    // Tarayıcı ortamında çalıştığımızdan emin olalım
    if (typeof window !== 'undefined') {
        try {
            // Public klasöründeki ses dosyasının yolu
            // Ensure the path is correct based on your public folder structure
            audioRef.current = new Audio(process.env.PUBLIC_URL + "/notification.mp3");
            // Sesi ön yüklemeyi deneyebiliriz (opsiyonel)
            // audioRef.current.preload = "auto";
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
    // setLoading(true); // Her güncellemede loading göstermek rahatsız edici olabilir, ilk yüklemede yeterli.
    logInfo("🔄 Siparişler getiriliyor...");
    if (!API_BASE) {
      logError("API_BASE tanımlı değil.");
      setError("API adresi yapılandırılmamış.");
      setLoading(false);
      return;
    }
    setError(null); // Yeni istek öncesi hatayı temizle
    setLoading(true); // Yüklemeyi başlat (fetchOrders her çağrıldığında)
    try {
      const response = await axios.get(`${API_BASE}/siparisler`, {
        headers: { Authorization: AUTH_HEADER } // AUTH_HEADER'ı kullan
      });
      // Gelen verinin beklendiği gibi olup olmadığını kontrol et
      if (response.data && Array.isArray(response.data.orders)) {
          // API'den gelen siparişleri ID'ye göre ters sıralı (en yeni üstte) alıyoruz zaten.
          setOrders(response.data.orders);
          logInfo(`✅ Siparişler başarıyla getirildi (${response.data.orders.length} adet).`);
      } else {
           logWarn("API'den beklenen formatta sipariş verisi gelmedi.", response.data);
           setOrders([]); // Hatalı formatta veri gelirse listeyi boşalt
           setError("Sunucudan beklenmedik formatta sipariş verisi alındı.");
      }

    } catch (err) {
      logError("❌ Siparişler alınamadı:", err);
      const errorDetail = err.response?.data?.detail || err.message || "Bilinmeyen bir hata oluştu.";
      // Eğer yetkilendirme hatasıysa (401) özel mesaj gösterilebilir.
      if (err.response?.status === 401) {
          setError("Siparişleri görüntülemek için yetkiniz yok veya kimlik bilgileri hatalı.");
          // Yetki hatası durumunda belki logout işlemi de tetiklenebilir.
      } else {
          setError(`Siparişler alınamadı: ${errorDetail}`);
      }
       setOrders([]); // Hata durumunda mevcut siparişleri temizle
    } finally {
       setLoading(false); // Yükleme bitti
    }
  }, [API_BASE, logInfo, logError, logWarn]); // Bağımlılıklar güncellendi

  // --- WebSocket Bağlantısı Kurulumu ---
  useEffect(() => {
    const connectWebSocket = () => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            // logInfo("WebSocket zaten bağlı."); // Çok sık log
            return;
        }
         if (!API_BASE) {
            logError("API_BASE tanımlı değil, WebSocket bağlantısı kurulamıyor.");
            return;
         }

      try {
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsHost = API_BASE.replace(/^https?:\/\//, '');
        const wsUrl = `${wsProtocol}//${wsHost}/ws/mutfak`; // Mutfak endpoint'i

        logInfo(`📡 WebSocket bağlantısı deneniyor: ${wsUrl}`);
        wsRef.current = new WebSocket(wsUrl);

        wsRef.current.onopen = () => {
          logInfo("✅ WebSocket bağlantısı başarılı.");
          // setError(null); // Sadece WS hatasını temizlemek yerine fetchOrders'da genel hata temizleniyor
        };

        wsRef.current.onmessage = (event) => {
           console.log("[Mutfak Ekranı] DEBUG: WebSocket Mesajı Geldi:", event.data); // Gelen mesajı logla
          try {
             const message = JSON.parse(event.data);
             logInfo(`📥 WebSocket mesajı alındı: Tip: ${message.type}`);

             if (message.type === 'siparis') {
                 logInfo("📦 Yeni sipariş geldi, liste güncelleniyor ve bildirim çalınıyor...");
                 // Yeni sipariş geldiğinde sesli bildirim ver
                 if (audioRef.current) {
                     // Kullanıcı etkileşimi olmadan play() engellenebilir, try-catch ekleyelim
                     try {
                        // Sesi başa sarıp çalmayı dene
                        audioRef.current.currentTime = 0;
                        // play() bir Promise döndürür
                        audioRef.current.play().catch(playError => {
                            // Kullanıcı etkileşimi yoksa veya başka bir hata varsa logla
                            logError("Sesli bildirim otomatik çalınamadı:", playError);
                            // Belki kullanıcıya bir bildirim gösterebiliriz?
                        });
                     } catch (audioError) {
                         logError("Ses nesnesiyle ilgili hata:", audioError);
                     }
                 }
                 // Sipariş listesini güncelleyerek yeni siparişi al
                 fetchOrders();
             } else if (message.type === 'durum') {
                 logInfo(`📊 Sipariş durumu güncellemesi alındı (Masa: ${message.data?.masa}, Durum: ${message.data?.durum}), liste güncelleniyor...`);
                 // Durum güncellendiğinde de listeyi yenile
                 fetchOrders();
             } else if (message.type === 'pong') {
                 // Ping yanıtı, sorun yok.
             } else {
                 logWarn(`⚠️ Bilinmeyen WebSocket mesaj tipi: ${message.type}`);
             }
          } catch (err) {
              logError("WebSocket mesajı işlenirken hata:", err);
          }
        };

        wsRef.current.onerror = (errorEvent) => {
          logError("❌ WebSocket hatası:", errorEvent);
          setError("Sunucuyla anlık bağlantı kesildi (WebSocket).");
        };

        wsRef.current.onclose = (event) => {
          logInfo(`🔌 WebSocket bağlantısı kapandı. Kod: ${event.code}, Sebep: ${event.reason}`);
          wsRef.current = null; // Referansı temizle
          if (event.code !== 1000 && event.code !== 1001) { // Normal veya sayfa kapanışı değilse
            logInfo("WebSocket beklenmedik şekilde kapandı, 5 saniye sonra tekrar denenecek...");
            setTimeout(connectWebSocket, 5000);
          }
        };

      } catch (error) {
        logError("❌ WebSocket bağlantısı başlatılırken kritik hata:", error);
        setError("Sunucu bağlantısı (WebSocket) kurulamıyor.");
      }
    };

    // Periyodik ping
     const pingInterval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        try { wsRef.current.send(JSON.stringify({ type: 'ping' })); }
        catch (err) { logError("Ping gönderilemedi:", err); }
      } else if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
          // logInfo("Ping: Bağlantı kapalı, tekrar bağlanılıyor..."); // Çok sık log
          connectWebSocket(); // Kapalıysa yeniden bağlanmayı dene
      }
    }, 30000);

    // İlk bağlantıyı kur ve siparişleri getir
    connectWebSocket();
    fetchOrders(); // İlk yükleme için siparişleri çek

    // Component kaldırıldığında temizlik yap
    return () => {
      clearInterval(pingInterval);
      if (wsRef.current) {
        logInfo("Component kaldırılıyor, WebSocket bağlantısı kapatılıyor.");
        wsRef.current.close(1000, "Component unmounting");
        wsRef.current = null;
      }
    };
  // fetchOrders'ı dependency array'den çıkardık, çünkü içerideki state güncellemeleri döngüye neden olabilir.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [API_BASE, logInfo, logError, logWarn]);

  // --- Sipariş Durumu Güncelleme Fonksiyonu ---
  const updateOrderStatus = useCallback(async (siparisId, masa, durum) => {
    logInfo(`🔄 Sipariş durumu güncelleniyor: ID: ${siparisId}, Masa: ${masa}, Yeni Durum: ${durum}`);
    if (!API_BASE) {
       logError("API_BASE tanımlı değil.");
       setError("API adresi yapılandırılmamış.");
       return;
    }
    setError(null); // Önceki hatayı temizle

    try {
      const response = await axios.post(
        `${API_BASE}/siparis-guncelle`,
        { id: siparisId, masa, durum }, // Sipariş ID'sini de gönderiyoruz
        { headers: {
            Authorization: AUTH_HEADER, // Auth header kullan
            'Content-Type': 'application/json'
        }}
      );

      logInfo(`✅ Sipariş durumu başarıyla güncellendi (ID: ${siparisId}). Yanıt: ${response.data.message}`);
      // Başarılı güncelleme sonrası listeyi hemen yenilemek yerine WebSocket'ten gelecek mesajı bekleyebiliriz.
      // Ancak anında görsel geri bildirim için burada da çağrılabilir (fetchOrders içinde zaten setLoading var)
      fetchOrders();

    } catch (error) {
      logError(`❌ Sipariş durumu güncellenemedi (ID: ${siparisId}):`, error);
      const errorDetail = error.response?.data?.detail || error.message || "Bilinmeyen bir hata oluştu.";
        if (error.response?.status === 401) {
            setError("Yetkiniz yok veya kimlik bilgileri hatalı.");
        } else {
            setError(`Sipariş durumu güncellenirken bir hata oluştu: ${errorDetail}`);
        }
      // Hata durumunda listeyi tekrar çekerek tutarlılığı sağlamayı deneyebiliriz (opsiyonel)
      // fetchOrders();
    }
  }, [API_BASE, fetchOrders, logInfo, logError]); // Bağımlılıklar güncellendi

  // --- Buton Handler'ları ---
  const handleHazirlaniyor = (siparisId, masa) => {
    updateOrderStatus(siparisId, masa, "hazirlaniyor");
  };

  const handleHazir = (siparisId, masa) => {
    updateOrderStatus(siparisId, masa, "hazir");
  };

  const handleIptal = (siparisId, masa) => {
    // İptal işlemi için onay isteyelim
    if (window.confirm(`Masa ${masa}, Sipariş #${siparisId} iptal edilecek. Emin misiniz?`)) {
      updateOrderStatus(siparisId, masa, "iptal");
    }
  };

  // --- Zaman Formatlama ---
  const formatTime = (timeStr) => {
    if (!timeStr) return "-";
    try {
      const date = new Date(timeStr);
      // Zaman geçerli mi kontrolü
      if (isNaN(date.getTime())) {
          return timeStr; // Geçersizse orijinali döndür
      }
      // Sadece saat:dakika:saniye formatı yeterli olabilir
      return new Intl.DateTimeFormat('tr-TR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false // 24 saat formatı
      }).format(date);
    } catch {
      return timeStr; // Hata olursa orijinal string'i döndür
    }
  };

  // --- Sipariş Kartı Rengi ---
   const getStatusColors = (status) => {
        switch (status) {
            case 'bekliyor': return "bg-yellow-100 border-yellow-300";
            case 'hazirlaniyor': return "bg-blue-100 border-blue-300";
            case 'hazir': return "bg-green-100 border-green-300";
            case 'iptal': return "bg-red-100 border-red-300 text-gray-500 line-through"; // İptalleri soluk ve üstü çizili yap
            default: return "bg-gray-100 border-gray-300"; // Bilinmeyen durum
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
          <span className="block sm:inline">{error}</span>
          {/* Yeniden deneme butonu */}
          <button
            onClick={fetchOrders}
            className="ml-4 px-2 py-1 bg-red-600 text-white rounded text-xs"
            disabled={loading}
            >
             {loading ? 'Yükleniyor...' : 'Tekrar Dene'}
           </button>
        </div>
      )}

      {/* Yükleniyor Durumu */}
      {loading && (
         <div className="text-center p-8 text-orange-600 animate-pulse">
            Siparişler yükleniyor...
         </div>
      )}

      {/* Sipariş Yok Mesajı (Yükleme bittikten sonra ve hata yoksa) */}
      {!loading && orders.length === 0 && !error ? (
        <div className="text-center p-8 bg-white rounded-xl shadow-md mt-8">
          <p className="text-gray-500 text-lg">📭 Gösterilecek aktif sipariş bulunmamaktadır.</p>
        </div>
      ) : null }

      {/* Sipariş Kartları (Yükleme bittikten sonra ve sipariş varsa) */}
      {!loading && orders.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {orders.map((order) => {
            // Sadece belirli durumları göstermek istersek burada filtreleyebiliriz
             // if (order.durum === 'hazir' || order.durum === 'iptal') {
             //     // return null; // Tamamlanmış veya iptal edilmişleri gösterme (Opsiyonel)
             // }

            // --- GÜNCELLENMİŞ SEPET PARSE ETME VE HATA YÖNETİMİ ---
            let sepetItems = [];
            let parseError = null; // Hata durumunu takip etmek için

            // order.sepet'in varlığını, string olup olmadığını ve boş olmadığını kontrol et
            if (order.sepet && typeof order.sepet === 'string' && order.sepet.trim() !== '') {
                try {
                    // JSON.parse ile veriyi çözmeye çalış
                    const parsedSepet = JSON.parse(order.sepet);

                    // Çözülen verinin bir dizi (array) olup olmadığını kontrol et
                    if (Array.isArray(parsedSepet)) {
                        // Geçerli ürünleri filtrele (ürün adı ve adedi olanlar)
                        sepetItems = parsedSepet.filter(item => item && item.urun && typeof item.adet === 'number' && item.adet > 0);
                        // İsteğe bağlı loglama
                        // if (sepetItems.length === 0 && parsedSepet.length > 0) {
                        //    logWarn(`Sipariş ID ${order.id}: Sepet parse edildi ancak geçerli ürün bulunamadı.`);
                        //}
                    } else {
                        parseError = new Error("Sepet verisi bir dizi (array) değil.");
                        logError(`❌ Sepet verisi dizi değil (ID: ${order.id}):`, order.sepet);
                    }
                } catch (e) {
                    // JSON.parse hatasını yakala
                    parseError = e; // Hatayı sakla
                    // Hata zaten loglandı, tekrar loglamaya gerek yok (logError çağrısı vardı)
                    // logError(`❌ Sepet verisi çözümlenemedi (ID: ${order.id}):`, e); // Bu satır kaldırıldı, üstte loglandı
                }
            } else {
                // order.sepet null, undefined, boş string veya string değilse
                logWarn(`Sipariş ID ${order.id}: Sepet verisi boş veya geçersiz tipte.`);
                // parseError = new Error("Boş veya geçersiz sepet verisi"); // Bunu da hata olarak sayabiliriz
            }

            // Eğer parse hatası varsa, bu kart için özel bir hata gösterimi yap
            if (parseError) {
                return (
                    <div key={order.id || `error-${Math.random()}`}
                         className="bg-red-100 border border-red-300 rounded-xl shadow-md p-5 opacity-70">
                        <p className="font-semibold text-lg text-red-700">Hata: Sipariş ID {order.id}</p>
                        <p className="text-sm text-red-600">Sipariş detayları okunamadı.</p>
                        <p className="text-xs text-gray-500 mt-1">({parseError.message})</p>
                        <p className="text-xs text-gray-500 mt-2">Zaman: {formatTime(order.zaman)}</p>
                        {/* Hatalı veriyi göstermek için (debug amaçlı):
                        <pre className="text-xs bg-red-50 mt-2 p-1 overflow-auto max-h-20"><code>{String(order.sepet)}</code></pre>
                        */}
                    </div>
                );
            }

            // Parse hatası yok ama sepet boşsa (veya filtreleme sonucu boşaldıysa)
            // Bu siparişleri atlayabiliriz.
            if (sepetItems.length === 0) {
                 logWarn(`Boş veya geçersiz ürün içeren sepetli sipariş atlandı (ID: ${order.id})`);
                 return null; // Kartı render etme
            }
            // --------------------------------------------------------------------

            // --- Sepet geçerliyse ve boş değilse kart render edilir ---
            const cardColors = getStatusColors(order.durum);

            return (
              <div
                key={order.id} // Benzersiz anahtar olarak sipariş ID'sini kullan
                className={`${cardColors} rounded-xl shadow-md p-4 hover:shadow-lg transition-all duration-300 ease-in-out flex flex-col`}
              >
                {/* Kart Başlığı */}
                <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-300/50">
                  <p className="font-semibold text-lg">
                     #{order.id} / <span className="font-bold">Masa: {order.masa}</span>
                  </p>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                    order.durum === 'hazir' ? 'bg-green-500 text-white' :
                    order.durum === 'hazirlaniyor' ? 'bg-blue-500 text-white' :
                    order.durum === 'iptal' ? 'bg-red-500 text-white' :
                    order.durum === 'bekliyor' ? 'bg-yellow-500 text-white' :
                    'bg-gray-500 text-white' // Diğer durumlar için
                  }`}>
                    {order.durum || 'Bilinmiyor'}
                  </span>
                </div>

                {/* Sipariş İçeriği */}
                <div className="bg-white/60 rounded p-3 mb-3 flex-grow">
                  {/* <p className="font-medium mb-2 text-sm text-gray-600">🛒 İçerik:</p> */}
                  <ul className="space-y-1.5">
                    {sepetItems.map((item, index) => (
                      <li key={`${order.id}-${index}`} className="flex justify-between items-start text-sm"> {/* Daha benzersiz key */}
                        <span className="flex-1 mr-2">• {item.urun}</span>
                        <span className="font-semibold text-orange-700">× {item.adet}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                 {/* Müşteri Notu (varsa) */}
                 {order.istek && (
                    <div className="mb-3 p-2 bg-amber-100/80 rounded border border-amber-300 text-amber-800 text-xs italic">
                      <span className="font-semibold">Not:</span> {order.istek}
                    </div>
                 )}

                {/* Aksiyon Butonları */}
                {/* İptal edilmiş veya hazır siparişler için butonları gösterme */}
                {order.durum !== 'iptal' && order.durum !== 'hazir' && (
                  <div className="flex gap-2 mt-auto pt-3 border-t border-gray-300/50"> {/* Butonları alta sabitlemek ve ayıraç eklemek için */}
                    {/* Eğer 'bekliyor' ise 'Hazırlanıyor' butonu */}
                    {order.durum === 'bekliyor' && (
                      <button
                        onClick={() => handleHazirlaniyor(order.id, order.masa)}
                        className="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-semibold transition duration-200 ease-in-out active:scale-95 shadow hover:shadow-md"
                        title="Siparişi hazırlamaya başla"
                      >
                        🔵 Hazırlanıyor
                      </button>
                    )}

                    {/* Eğer 'hazirlaniyor' ise 'Hazır' butonu */}
                    {order.durum === 'hazirlaniyor' && (
                      <button
                        onClick={() => handleHazir(order.id, order.masa)}
                        className="flex-1 bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded-lg text-sm font-semibold transition duration-200 ease-in-out active:scale-95 shadow hover:shadow-md"
                        title="Sipariş hazırlandı"
                      >
                        ✅ Hazır
                      </button>
                    )}

                    {/* Her zaman gösterilen 'İptal' butonu (bekliyor veya hazırlanıyor ise) */}
                     {(order.durum === 'bekliyor' || order.durum === 'hazirlaniyor') && (
                        <button
                          onClick={() => handleIptal(order.id, order.masa)}
                          className="bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-lg text-sm font-semibold transition duration-200 ease-in-out active:scale-95 shadow hover:shadow-md"
                          title="Siparişi iptal et"
                        >
                          ❌ İptal
                        </button>
                    )}
                  </div>
                )}

                {/* Zaman Bilgisi */}
                <div className="text-right mt-3 text-xs text-gray-500">
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