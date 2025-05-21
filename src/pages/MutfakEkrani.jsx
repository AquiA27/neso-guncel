// src/pages/MutfakEkrani.jsx
import React, { useState, useEffect, useRef, useCallback, useContext } from "react";
import apiClient from '../services/apiClient';
import { AuthContext } from '../AuthContext';
import { useNavigate } from 'react-router-dom';

function MutfakEkrani() {
  const { isAuthenticated, currentUser, userRole, loadingAuth, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const [orders, setOrders] = useState([]);
  const [error, setError] = useState(null);
  const [loadingData, setLoadingData] = useState(true);
  const wsRef = useRef(null);
  const audioRef = useRef(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const logInfo = useCallback((message) => console.log(`[Mutfak Ekranı] INFO: ${message}`), []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const logError = useCallback((message, errorObj) => console.error(`[Mutfak Ekranı] ERROR: ${message}`, errorObj || ""), []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const logWarn = useCallback((message) => console.warn(`[Mutfak Ekranı] WARN: ${message}`), []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const logDebug = useCallback((message) => console.log(`[Mutfak Ekranı] DEBUG: ${message}`), []);

  useEffect(() => {
    document.title = "Mutfak Paneli - Neso";
    if (typeof window !== "undefined") {
      try {
        audioRef.current = new Audio("/notification.mp3");
        audioRef.current.preload = "auto";
        logInfo("🔔 Sesli bildirim nesnesi oluşturuldu.");
      } catch (err) {
        logError("Sesli bildirim nesnesi oluşturulamadı:", err);
      }
    }
  }, [logInfo, logError]);

  const fetchOrders = useCallback(async () => {
    logInfo("🔄 Siparişler getiriliyor (Mutfak)...");
    setLoadingData(true);
    setError(null);
    try {
      const response = await apiClient.get(`/siparisler`);
      const parsedOrders = (response.data.orders || []).map((order) => {
        if (typeof order.sepet === "string") {
          try { order.sepet = JSON.parse(order.sepet); }
          catch (e) { logWarn(`Sipariş ID ${order.id} için sepet parse edilemedi:`, order.sepet); order.sepet = []; }
        }
        return order;
      });
      setOrders(parsedOrders);
      logInfo(`✅ Mutfak siparişleri başarıyla getirildi (${parsedOrders.length} adet).`);
    } catch (err) {
      logError("❌ Mutfak siparişleri alınamadı:", err);
      const errorDetail = err.response?.data?.detail || err.message || "Bilinmeyen hata.";
      if (err.response?.status === 401 || err.response?.status === 403) {
        setError("Bu verilere erişim yetkiniz yok veya oturumunuz sonlanmış.");
        logout();
      } else {
        setError(`Siparişler alınamadı: ${errorDetail}`);
      }
    } finally {
      setLoadingData(false);
    }
  }, [logInfo, logError, logWarn, logout]);

  useEffect(() => {
    if (!loadingAuth) {
      const allowedRoles = ['admin', 'mutfak_personeli', 'barista'];
      if (isAuthenticated && allowedRoles.includes(userRole)) {
        logInfo("Mutfak ekranı için yetkili kullanıcı, veriler çekiliyor ve WS bağlanıyor...");
        fetchOrders();
      } else if (isAuthenticated && !allowedRoles.includes(userRole)) {
        logWarn("Mutfak ekranı için yetkisiz kullanıcı. Yönlendiriliyor...");
        navigate('/unauthorized');
      } else if (!isAuthenticated) {
        logWarn("Giriş yapılmamış, mutfak ekranı için login'e yönlendiriliyor.");
        navigate('/login', { state: { from: { pathname: '/mutfak' } } });
      }
    }
  }, [isAuthenticated, userRole, loadingAuth, navigate, fetchOrders, logInfo, logWarn]);

  useEffect(() => {
    const allowedRolesForWS = ['admin', 'mutfak_personeli', 'barista'];
    if (!isAuthenticated || !allowedRolesForWS.includes(userRole) || loadingAuth) {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            logInfo("Yetki yok veya çıkış yapıldı, Mutfak WebSocket kapatılıyor.");
            wsRef.current.close(1000, "User not authorized or logged out for Mutfak WS");
            wsRef.current = null;
        }
        return;
    }

    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;
    const baseReconnectDelay = 5000;
    let reconnectTimeoutId = null;

    const connectWebSocket = () => {
      if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
        logInfo("Mutfak WebSocket zaten açık veya bağlanıyor.");
        return;
      }
      const apiBaseForWs = process.env.REACT_APP_API_BASE;
      if (!apiBaseForWs) {
        logError("REACT_APP_API_BASE tanımlı değil, Mutfak WS kurulamıyor.");
        setError("API adresi yapılandırılmamış.");
        return;
      }

      try {
        const wsProtocol = apiBaseForWs.startsWith("https") ? "wss:" : (window.location.protocol === "https:" ? "wss:" : "ws:");
        const wsHost = apiBaseForWs.replace(/^https?:\/\//, "");
        const wsUrl = `${wsProtocol}//${wsHost}/ws/mutfak`;
        logInfo(`📡 Mutfak WebSocket bağlantısı deneniyor: ${wsUrl}`);
        wsRef.current = new WebSocket(wsUrl);

        wsRef.current.onopen = () => {
          logInfo("✅ Mutfak WebSocket bağlantısı başarılı.");
          setError(null);
          reconnectAttempts = 0;
          if (reconnectTimeoutId) { clearTimeout(reconnectTimeoutId); reconnectTimeoutId = null;}
        };

        wsRef.current.onmessage = (event) => {
          logDebug(`Mutfak WS Mesajı Geldi: ${event.data}`);
          try {
            const message = JSON.parse(event.data);
            logInfo(`📥 Mutfak WebSocket mesajı alındı: Tip: ${message.type}`);
            if (message.type === "siparis") {
              logInfo("📦 Yeni sipariş geldi (Mutfak WS), liste güncelleniyor ve bildirim çalınıyor...");
              if (audioRef.current && audioRef.current.readyState >= 2) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
                audioRef.current.play().catch(err => {
                    logError("Sesli bildirim çalınamadı (play error):", err);
                });
              } else if (audioRef.current) {
                logWarn("Audio nesnesi henüz çalmaya hazır değil veya yüklenemedi.");
              }
              fetchOrders();
            } else if (message.type === "durum") {
              logInfo(`📊 Sipariş durumu güncellemesi alındı (Mutfak WS), liste güncelleniyor...`);
              fetchOrders();
            } else if (message.type === "pong") {
              logDebug("Mutfak Pong alındı.");
            } else {
              logWarn(`⚠️ Mutfak - Bilinmeyen WS mesaj tipi: ${message.type}`);
            }
          } catch (err) {
            logError("Mutfak WS mesaj işleme hatası:", err);
          }
        };

        wsRef.current.onerror = (errorEvent) => {
          logError("❌ Mutfak WebSocket hatası:", errorEvent);
          setError("Mutfak sunucu bağlantısında bir sorun oluştu.");
        };

        wsRef.current.onclose = (event) => {
          logInfo(`🔌 Mutfak WebSocket bağlantısı kapandı. Kod: ${event.code}, Sebep: ${event.reason || "Yok"}`);
          wsRef.current = null;
          if (isAuthenticated && allowedRolesForWS.includes(userRole) && event.code !== 1000 && event.code !== 1001 && !event.wasClean && reconnectAttempts < maxReconnectAttempts) {
            const delay = baseReconnectDelay * Math.pow(2, reconnectAttempts) + Math.random() * 1000;
            logInfo(`Mutfak WS beklenmedik şekilde kapandı, ${Math.round(delay/1000)}sn sonra tekrar denenecek... (Deneme: ${reconnectAttempts + 1})`);
            reconnectTimeoutId = setTimeout(connectWebSocket, delay);
            reconnectAttempts++;
          } else if (reconnectAttempts >= maxReconnectAttempts) {
            setError("Mutfak sunucu bağlantısı tekrar sağlanamadı. Lütfen sayfayı yenileyin.");
          }
        };
      } catch (error) {
        logError("❌ Mutfak WS başlatma kritik hata:", error);
        setError("Mutfak sunucu bağlantısı (WebSocket) kurulamıyor.");
      }
    };

    connectWebSocket();

    const pingInterval = setInterval(() => {
      if (isAuthenticated && allowedRolesForWS.includes(userRole) && wsRef.current?.readyState === WebSocket.OPEN) {
        try {
          wsRef.current.send(JSON.stringify({ type: "ping" }));
          logDebug("Mutfak Ping gönderildi.");
        } catch (err) {
          logError("Mutfak Ping gönderilemedi:", err);
        }
      } else if (isAuthenticated && allowedRolesForWS.includes(userRole) && !wsRef.current && reconnectAttempts < maxReconnectAttempts) {
        logWarn("Mutfak Ping: WebSocket bağlantısı aktif değil, yeniden bağlantı deneniyor.");
        connectWebSocket();
      }
    }, 15000);

    return () => {
      clearInterval(pingInterval);
      if (reconnectTimeoutId) clearTimeout(reconnectTimeoutId);
      if (wsRef.current) {
        logInfo("MutfakEkrani: Component kaldırılıyor, WebSocket kapatılıyor.");
        wsRef.current.close(1000, "Component unmounting");
        wsRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, userRole, loadingAuth, fetchOrders, logInfo, logError, logWarn, logDebug]);


  const updateOrderStatus = useCallback(async (siparisId, masa, durum) => {
    logInfo(`🔄 Mutfak: Sipariş durumu güncelleniyor: ID: ${siparisId}, Masa: ${masa}, Yeni Durum: ${durum}`);
    setError(null);
    try {
      // === DÜZELTME YAPILAN KISIM ===
      const response = await apiClient.patch( // apiClient.post yerine apiClient.patch
        `/siparis/${siparisId}`,              // Doğru endpoint yolu: /siparis/{siparis_id}
        { durum: durum }                     // Body'de sadece "durum" gönderilecek
      );
      // === DÜZELTME SONU ===
      logInfo(`✅ Mutfak: Sipariş durumu başarıyla güncellendi (ID: ${siparisId}). Yanıt: ${response.data.message}`);
      // fetchOrders(); // WebSocket zaten güncelleyeceği için bu genellikle gereksizdir.
    } catch (error) {
      logError(`❌ Mutfak: Sipariş durumu güncellenemedi (ID: ${siparisId}):`, error.response || error);
      const errorDetail = error.response?.data?.detail || error.message || "Bilinmeyen hata.";
      setError(`Sipariş durumu güncellenirken bir hata oluştu: ${errorDetail}`);
      if (error.response?.status === 401 || error.response?.status === 403) {
        logout();
      }
    }
  }, [logInfo, logError, logout, setError, apiClient]); // apiClient bağımlılıklara eklendi (önemli değilse de iyi pratik)

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
    } catch (e) {
      return timeStr;
    }
  }, []);

  const getStatusColors = useCallback((status) => {
    switch (status?.toLowerCase()) {
      case "bekliyor":
        return "bg-yellow-100 border-yellow-400";
      case "hazirlaniyor":
        return "bg-blue-100 border-blue-400";
      case "hazir":
        return "bg-green-100 border-green-400";
      case "iptal":
        return "bg-red-200 border-red-400 text-gray-600 line-through";
      default:
        return "bg-gray-100 border-gray-300";
    }
  }, []);

  if (loadingAuth) {
    return <div className="min-h-screen flex items-center justify-center p-4 text-slate-600">Mutfak ekranı yetkileri kontrol ediliyor...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-100 via-orange-100 to-orange-200 p-6 text-gray-800 font-sans">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold text-orange-700">👨‍🍳 Mutfak Sipariş Paneli</h1>
        {currentUser && (
            <div className="text-right">
                <span className="text-sm text-slate-600">Kullanıcı: {currentUser.kullanici_adi} ({currentUser.rol})</span>
                <button
                  onClick={logout}
                  className="ml-4 bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-md text-sm shadow"
                >
                  Çıkış Yap
                </button>
            </div>
        )}
      </div>

      {error && (
        <div
          className="bg-red-100 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded relative mb-4 shadow"
          role="alert"
        >
          <strong className="font-bold">Hata: </strong>
          <span className="block sm:inline">{error}</span>
          <button onClick={() => { setError(null); fetchOrders(); }} className="ml-4 bg-red-500 text-white px-2 py-1 rounded text-xs">Tekrar Dene</button>
        </div>
      )}

      {loadingData && (
        <div className="text-center p-8 text-orange-600 animate-pulse">Siparişler yükleniyor...</div>
      )}

      {!loadingData && orders.filter((order) => order.durum === "bekliyor" || order.durum === "hazirlaniyor").length === 0 && !error ? (
        <div className="text-center p-8 bg-white rounded-xl shadow-md mt-8">
          <p className="text-gray-500 text-lg">📭 Bekleyen veya hazırlanan sipariş bulunmamaktadır.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {orders
            .filter((order) => order.durum === "bekliyor" || order.durum === "hazirlaniyor")
            .sort((a, b) => new Date(a.zaman) - new Date(b.zaman))
            .map((order) => {
              if (!Array.isArray(order.sepet) || order.sepet.length === 0) {
                logWarn(`Boş veya geçersiz sepetli sipariş atlandı (ID: ${order.id})`);
                return null;
              }
              const cardColors = getStatusColors(order.durum);
              return (
                <div
                  key={order.id}
                  className={`${cardColors} rounded-xl shadow-lg p-4 hover:shadow-xl transition-all duration-300 ease-in-out flex flex-col`}
                >
                  <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-300/70">
                    <p className="font-semibold text-lg text-slate-800">
                      #{order.id} / <span className="font-bold">Masa: {order.masa}</span>
                    </p>
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                        order.durum === "hazirlaniyor" ? "bg-blue-500 text-white" :
                        order.durum === "bekliyor" ? "bg-yellow-500 text-white" :
                        "bg-gray-500 text-white"
                      }`}
                    >
                      {order.durum || "Bilinmiyor"}
                    </span>
                  </div>

                  <div className="bg-white/70 rounded p-3 mb-3 flex-grow min-h-[80px]">
                    <ul className="space-y-1.5">
                      {order.sepet.map((item, index) => (
                        <li key={index} className="flex justify-between items-start text-sm text-slate-700">
                          <span className="flex-1 mr-2">• {item.urun}</span>
                          <span className="font-semibold text-orange-800">× {item.adet}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {order.istek && (
                    <div className="mb-3 p-2 bg-amber-100/90 rounded border border-amber-300 text-amber-900 text-xs italic shadow-sm">
                      <span className="font-semibold">Not:</span> {order.istek}
                    </div>
                  )}

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