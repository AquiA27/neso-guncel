import React, { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";

// Ortam değişkenlerinden API ve kimlik bilgilerini al
const API_BASE = process.env.REACT_APP_API_BASE;
const ADMIN_USERNAME = process.env.REACT_APP_ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.REACT_APP_ADMIN_PASSWORD || "admin123";
const AUTH_HEADER = "Basic " + btoa(`${ADMIN_USERNAME}:${ADMIN_PASSWORD}`);

function MutfakEkrani() {
  const [orders, setOrders] = useState([]); // Görüntülenecek siparişler
  const [error, setError] = useState(null); // Hata mesajları için state
  const [loading, setLoading] = useState(true); // Siparişler yükleniyor mu?
  const wsRef = useRef(null); // WebSocket bağlantısı referansı
  const audioRef = useRef(null); // Sesli bildirim için Audio nesnesi referansı

  // --- Yardımcı Fonksiyonlar ---
  const logInfo = useCallback((message) => console.log(`[Mutfak Ekranı] INFO: ${message}`), []);
  const logError = useCallback((message, error) => console.error(`[Mutfak Ekranı] ERROR: ${message}`, error || ""), []);
  const logWarn = useCallback((message) => console.warn(`[Mutfak Ekranı] WARN: ${message}`), []);
  const logDebug = useCallback((message) => console.log(`[Mutfak Ekranı] DEBUG: ${message}`), []);

  // --- Sesli Bildirim Nesnesini Hazırla ---
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        audioRef.current = new Audio("/notification.mp3"); // Public klasöründeki ses
        audioRef.current.preload = "auto"; // Ses dosyasını önceden yükle
        logInfo("🔔 Sesli bildirim nesnesi oluşturuldu.");
      } catch (err) {
        logError("Sesli bildirim nesnesi oluşturulamadı:", err);
        setError("Sesli bildirim başlatılamadı.");
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
    if (!API_BASE) {
      logError("API_BASE tanımlı değil.");
      setError("API adresi tanımlı değil.");
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE}/siparisler`, {
        headers: { Authorization: AUTH_HEADER, "Content-Type": "application/json" },
      });
      const parsedOrders = (response.data.orders || []).map((order) => {
        if (typeof order.sepet === "string") {
          try {
            order.sepet = JSON.parse(order.sepet);
          } catch (e) {
            logWarn(`Sipariş ID ${order.id} için sepet parse edilemedi:`, order.sepet);
            order.sepet = [];
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
      if (err.response?.status === 401) {
        setError("Yetki hatası: Lütfen giriş yapın.");
      } else {
        setError(`Siparişler alınamadı: ${errorDetail}`);
      }
    } finally {
      setLoading(false);
    }
  }, [logInfo, logError, logWarn]);

  // --- WebSocket Bağlantısı Kurulumu ---
  useEffect(() => {
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;
    const baseReconnectDelay = 5000;

    const connectWebSocket = () => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        logInfo("WebSocket zaten bağlı.");
        return;
      }
      if (!API_BASE) {
        logError("API_BASE tanımlı değil.");
        setError("API adresi tanımlı değil.");
        return;
      }
      try {
        const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsHost = API_BASE.replace(/^https?:\/\//, "");
        const wsUrl = `${wsProtocol}//${wsHost}/ws/mutfak`;
        logInfo(`📡 WebSocket bağlantısı deneniyor: ${wsUrl}`);
        wsRef.current = new WebSocket(wsUrl);

        wsRef.current.onopen = () => {
          logInfo("✅ WebSocket bağlantısı başarılı.");
          setError(null);
          reconnectAttempts = 0; // Başarılı bağlantıda sayacı sıfırla
        };

        wsRef.current.onmessage = (event) => {
          logDebug(`WS Mesajı Geldi: ${event.data}`);
          try {
            const message = JSON.parse(event.data);
            logInfo(`📥 WebSocket mesajı alındı: Tip: ${message.type}`);
            if (message.type === "siparis") {
              logInfo("📦 Yeni sipariş geldi, liste güncelleniyor ve bildirim çalınıyor...");
              if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
                audioRef.current.play().catch((err) => {
                  logError("Sesli bildirim çalınamadı:", err);
                  setError("Sesli bildirim oynatılamadı.");
                });
              }
              fetchOrders();
            } else if (message.type === "durum") {
              logInfo(`📊 Sipariş durumu güncellemesi alındı, liste güncelleniyor...`);
              fetchOrders();
            } else if (message.type === "pong") {
              logDebug("Pong alındı.");
            } else {
              logWarn(`⚠️ Bilinmeyen WS mesaj tipi: ${message.type}`);
            }
          } catch (err) {
            logError("WS mesaj işleme hatası:", err);
          }
        };

        wsRef.current.onerror = (errorEvent) => {
          logError("❌ WebSocket hatası:", errorEvent);
          setError("Sunucuyla anlık bağlantı kesildi...");
        };

        wsRef.current.onclose = (event) => {
          logInfo(`🔌 WebSocket bağlantısı kapandı. Kod: ${event.code}, Sebep: ${event.reason || "Yok"}`);
          wsRef.current = null;
          if (event.code !== 1000 && event.code !== 1001 && reconnectAttempts < maxReconnectAttempts) {
            const delay = baseReconnectDelay * Math.pow(2, reconnectAttempts) + Math.random() * 100;
            logInfo(`WS beklenmedik şekilde kapandı, ${delay}ms sonra tekrar denenecek...`);
            setTimeout(connectWebSocket, delay);
            reconnectAttempts++;
          } else if (reconnectAttempts >= maxReconnectAttempts) {
            setError("Sunucu bağlantısı tekrar sağlanamadı. Lütfen sayfayı yenileyin.");
          }
        };
      } catch (error) {
        logError("❌ WS başlatma kritik hata:", error);
        setError("Sunucu bağlantısı kurulamıyor.");
      }
    };

    const pingInterval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        try {
          wsRef.current.send(JSON.stringify({ type: "ping" }));
          logDebug("Ping gönderildi.");
        } catch (err) {
          logError("Ping gönderilemedi:", err);
        }
      } else if (!wsRef.current) {
        connectWebSocket();
      }
    }, 15000); // 15 saniyede bir ping

    connectWebSocket();
    fetchOrders(); // İlk yükleme

    return () => {
      clearInterval(pingInterval);
      if (wsRef.current) {
        logInfo("Component kaldırılıyor, WS kapatılıyor.");
        wsRef.current.close(1000, "Component unmounting");
        wsRef.current = null;
      }
    };
  }, [fetchOrders, logInfo, logError, logWarn, logDebug]);

  // --- Sipariş Durumu Güncelleme Fonksiyonu ---
  const updateOrderStatus = useCallback(
    async (siparisId, masa, durum) => {
      logInfo(`🔄 Sipariş durumu güncelleniyor: ID: ${siparisId}, Masa: ${masa}, Yeni Durum: ${durum}`);
      if (!API_BASE) {
        logError("API_BASE tanımlı değil.");
        setError("API adresi tanımlı değil.");
        return;
      }
      setError(null);
      try {
        const response = await axios.post(
          `${API_BASE}/siparis-guncelle`,
          { id: siparisId, masa, durum },
          { headers: { Authorization: AUTH_HEADER, "Content-Type": "application/json" } }
        );
        logInfo(`✅ Sipariş durumu başarıyla güncellendi (ID: ${siparisId}). Yanıt: ${response.data.message}`);
      } catch (error) {
        logError(`❌ Sipariş durumu güncellenemedi (ID: ${siparisId}):`, error);
        const errorDetail = error.response?.data?.detail || error.message || "Bilinmeyen hata.";
        setError(`Sipariş durumu güncellenirken bir hata oluştu: ${errorDetail}`);
      }
    },
    [logInfo, logError]
  );

  // --- Buton Handler'ları ---
  const handleHazirlaniyor = useCallback((siparisId, masa) => {
    updateOrderStatus(siparisId, masa, "hazirlaniyor");
  }, [updateOrderStatus]);

  const handleHazir = useCallback((siparisId, masa) => {
    updateOrderStatus(siparisId, masa, "hazir");
  }, [updateOrderStatus]);

  const handleIptal = useCallback((siparisId, masa) => {
    if (window.confirm(`Masa ${masa}, Sipariş #${siparisId} iptal edilecek. Emin misiniz?`)) {
      updateOrderStatus(siparisId, masa, "iptal");
    }
  }, [updateOrderStatus]);

  // --- Zaman Formatlama ---
  const formatTime = useCallback((timeStr) => {
    if (!timeStr) return "-";
    try {
      const date = new Date(timeStr);
      return new Intl.DateTimeFormat("tr-TR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).format(date);
    } catch {
      return timeStr;
    }
  }, []);

  // --- Sipariş Kartı Rengi ---
  const getStatusColors = useCallback((status) => {
    switch (status) {
      case "bekliyor":
        return "bg-yellow-100 border-yellow-300";
      case "hazirlaniyor":
        return "bg-blue-100 border-blue-300";
      case "hazir":
        return "bg-green-100 border-green-300";
      case "iptal":
        return "bg-red-100 border-red-300 text-gray-500 line-through";
      default:
        return "bg-gray-100 border-gray-300";
    }
  }, []);

  // --- Render ---
  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-100 via-orange-100 to-orange-200 p-6 text-gray-800 font-sans">
      <h1 className="text-4xl font-bold text-center mb-8 text-orange-700">👨‍🍳 Mutfak Sipariş Paneli</h1>

      {/* Hata Mesajı Alanı */}
      {error && (
        <div
          className="bg-red-100 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded relative mb-4 shadow"
          role="alert"
        >
          <strong className="font-bold">Hata: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      )}

      {/* Yükleniyor Durumu */}
      {loading && (
        <div className="text-center p-8 text-orange-600 animate-pulse">Siparişler yükleniyor...</div>
      )}

      {/* Sipariş Yok Mesajı */}
      {!loading && orders.length === 0 && !error ? (
        <div className="text-center p-8 bg-white rounded-xl shadow-md mt-8">
          <p className="text-gray-500 text-lg">📭 Bekleyen veya hazırlanan sipariş bulunmamaktadır.</p>
        </div>
      ) : (
        // Sipariş Kartları
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {orders
            .filter((order) => order.durum === "bekliyor" || order.durum === "hazirlaniyor")
            .map((order) => {
              if (!Array.isArray(order.sepet) || order.sepet.length === 0) {
                logWarn(`Boş veya geçersiz sepetli sipariş atlandı (ID: ${order.id})`);
                return null;
              }

              const cardColors = getStatusColors(order.durum);

              return (
                <div
                  key={order.id}
                  className={`${cardColors} rounded-xl shadow-md p-4 hover:shadow-lg transition-all duration-300 ease-in-out flex flex-col`}
                >
                  {/* Kart Başlığı */}
                  <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-300/50">
                    <p className="font-semibold text-lg">
                      #{order.id} / <span className="font-bold">Masa: {order.masa}</span>
                    </p>
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                        order.durum === "hazirlaniyor" ? "bg-blue-500 text-white" : "bg-yellow-500 text-white"
                      }`}
                    >
                      {order.durum || "Bilinmiyor"}
                    </span>
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
                  {order.istek && (
                    <div className="mb-3 p-2 bg-amber-100/80 rounded border border-amber-300 text-amber-800 text-xs italic">
                      <span className="font-semibold">Not:</span> {order.istek}
                    </div>
                  )}
                  {/* Aksiyon Butonları */}
                  <div className="flex gap-2 mt-auto">
                    {order.durum === "bekliyor" && (
                      <button
                        onClick={() => handleHazirlaniyor(order.id, order.masa)}
                        className="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-semibold transition duration-200 ease-in-out active:scale-95 shadow hover:shadow-md"
                        title="Hazırlamaya başla"
                      >
                        🔵 Hazırlanıyor
                      </button>
                    )}
                    {order.durum === "hazirlaniyor" && (
                      <button
                        onClick={() => handleHazir(order.id, order.masa)}
                        className="flex-1 bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded-lg text-sm font-semibold transition duration-200 ease-in-out active:scale-95 shadow hover:shadow-md"
                        title="Sipariş hazırlandı"
                      >
                        ✅ Hazır
                      </button>
                    )}
                    <button
                      onClick={() => handleIptal(order.id, order.masa)}
                      className="bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-lg text-sm font-semibold transition duration-200 ease-in-out active:scale-95 shadow hover:shadow-md"
                      title="Siparişi iptal et"
                    >
                      ❌ İptal
                    </button>
                  </div>
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