// src/pages/MutfakEkrani.jsx
import React, { useState, useEffect, useRef, useCallback, useContext } from "react";
import apiClient from '../services/apiClient';
import { AuthContext } from '../AuthContext';
import { useNavigate } from 'react-router-dom';
import {
    ChefHat,    // EKLENDİ (Panel başlığı için)
    Clock,      // EKLENDİ (Sipariş zamanı için)
    ClipboardX, // EKLENDİ (Boş sipariş listesi için)
    Loader2,    // EKLENDİ (Yükleme ikonları için)
    PlayCircle, // EKLENDİ (Hazırlanıyor butonu için)
    CheckCircle2, // EKLENDİ (Hazır butonu için)
    XCircle,     // EKLENDİ (İptal butonu ve Hata kapatma için)
    AlertTriangle, // EKLENDİ (Hata mesajı ikonu için)
    RotateCw    // Gerekirse diye, ama butonlarda kullanmıyoruz şimdilik
} from 'lucide-react';

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
    // setError(null); // Hata mesajını hemen temizleme, kullanıcı görsün. Tekrar denemede temizlenebilir.
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
      setError(null); // Başarılı olursa hatayı temizle
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
              if (audioRef.current && audioRef.current.readyState >= 2) { // HTMLMediaElement.HAVE_CURRENT_DATA or more
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
                audioRef.current.play().catch(err => {
                    logError("Sesli bildirim çalınamadı (play error):", err);
                });
              } else if (audioRef.current) {
                logWarn("Audio nesnesi henüz çalmaya hazır değil veya yüklenemedi. Durum: " + audioRef.current.readyState);
                // Fallback: Belki bir sonraki yüklemede çalmayı dener.
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
    // setError(null); // Optimistic update için yorum satırı veya state'e göre ayarla
    try {
      const response = await apiClient.patch(
        `/siparis/${siparisId}`,
        { durum: durum }
      );
      logInfo(`✅ Mutfak: Sipariş durumu başarıyla güncellendi (ID: ${siparisId}). Yanıt: ${response.data.message}`);
      // WS güncelleyeceği için fetchOrders() çağrısı burada genellikle gereksizdir.
      // Ancak, WS gecikmesi veya hatası durumunda anında UI güncellemesi için
      // setOrders(prevOrders => prevOrders.map(o => o.id === siparisId ? {...o, durum: durum} : o));
      // veya fetchOrders(); çağrısı düşünülebilir. Şimdilik WS'e güveniyoruz.
    } catch (error) {
      logError(`❌ Mutfak: Sipariş durumu güncellenemedi (ID: ${siparisId}):`, error.response || error);
      const errorDetail = error.response?.data?.detail || error.message || "Bilinmeyen hata.";
      setError(`Sipariş durumu güncellenirken bir hata oluştu: ${errorDetail}`);
      if (error.response?.status === 401 || error.response?.status === 403) {
        logout();
      }
    }
  }, [logInfo, logError, logout, apiClient]);

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

  const getStatusCardStyle = useCallback((status) => {
    switch (status?.toLowerCase()) {
      case "bekliyor":
        return "bg-yellow-50 border-yellow-400 ring-2 ring-yellow-200";
      case "hazirlaniyor":
        return "bg-blue-50 border-blue-400 ring-2 ring-blue-200";
      // Diğer durumlar filtrelendiği için bu ekranda görünmeyecek ama fonksiyon tam kalsın.
      case "hazir":
        return "bg-green-50 border-green-400";
      case "iptal":
        return "bg-red-100 border-red-400 text-gray-500 line-through opacity-70";
      default:
        return "bg-gray-50 border-gray-300";
    }
  }, []);

  const getStatusBadgeStyle = useCallback((status) => {
    switch (status?.toLowerCase()) {
        case "bekliyor": return "bg-yellow-400 text-yellow-800 border border-yellow-500";
        case "hazirlaniyor": return "bg-blue-400 text-blue-800 border border-blue-500";
        default: return "bg-gray-400 text-gray-800";
    }
  }, []);

  if (loadingAuth) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-yellow-50 via-orange-50 to-red-50 p-4">
          <div className="bg-white shadow-xl p-10 rounded-lg text-center border border-slate-300">
            <Loader2 className="w-12 h-12 text-orange-500 mx-auto mb-6 animate-spin" />
            <h2 className="text-2xl font-semibold mb-3 text-slate-700">Yükleniyor...</h2>
            <p className="text-slate-500">Mutfak ekranı yetkileri kontrol ediliyor, lütfen bekleyin.</p>
          </div>
        </div>
      );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-100 via-orange-100 to-red-100 p-4 md:p-6 text-gray-800 font-sans">
      <header className="flex flex-wrap justify-between items-center mb-8 gap-4 pb-4 border-b border-orange-300">
        <h1 className="text-3xl md:text-4xl font-bold text-orange-700 flex items-center">
            <ChefHat className="w-9 h-9 mr-3 text-orange-600" /> Mutfak Sipariş Paneli
        </h1>
        {currentUser && (
            <div className="text-right">
                <span className="text-sm text-slate-600 block mb-1 sm:mb-0 sm:inline">Kullanıcı: {currentUser.kullanici_adi} ({currentUser.rol})</span>
                <button
                  onClick={logout}
                  className="ml-0 sm:ml-4 mt-1 sm:mt-0 bg-red-500 hover:bg-red-600 text-white px-4 py-1.5 rounded-md text-sm shadow-md hover:shadow-lg transition-shadow"
                >
                  Çıkış Yap
                </button>
            </div>
        )}
      </header>

      {error && (
        <div
          className="bg-red-100 border-l-4 border-red-500 text-red-800 px-5 py-4 rounded-md relative mb-6 shadow-lg"
          role="alert"
        >
          <div className="flex">
            <AlertTriangle className="h-5 w-5 text-red-600 mr-3 mt-0.5 flex-shrink-0" />
            <div className="flex-grow">
              <strong className="font-bold block">Hata Oluştu!</strong>
              <span className="block sm:inline text-sm">{error}</span>
            </div>
          </div>
          <div className="mt-3 flex gap-3">
            <button
                onClick={() => { setError(null); fetchOrders(); }}
                className="bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-md text-xs font-semibold shadow transition-all"
            >
                Tekrar Dene
            </button>
            <button
                onClick={() => setError(null)}
                className="text-red-700 hover:text-red-900 px-3 py-1.5 rounded-md text-xs font-semibold hover:bg-red-200 transition-colors"
                aria-label="Hata mesajını kapat"
            >
                Kapat
            </button>
          </div>
        </div>
      )}

      {loadingData && !error && ( // Hata yokken yükleme mesajı
        <div className="text-center p-10 text-orange-600 flex flex-col items-center justify-center">
            <Loader2 className="w-16 h-16 text-orange-400 animate-spin mb-5" />
            <p className="text-xl font-medium">Siparişler Yükleniyor...</p>
        </div>
      )}

      {!loadingData && orders.filter((order) => order.durum === "bekliyor" || order.durum === "hazirlaniyor").length === 0 && !error && (
        <div className="text-center p-10 bg-white/70 backdrop-blur-sm rounded-xl shadow-lg mt-8 border border-orange-200 min-h-[300px] flex flex-col justify-center items-center">
          <ClipboardX className="w-24 h-24 text-orange-300 mb-6" />
          <p className="text-gray-600 text-xl font-medium">Bekleyen veya hazırlanan sipariş bulunmamaktadır.</p>
          <p className="text-gray-400 text-sm mt-2">Yeni siparişler geldiğinde burada görünecektir.</p>
        </div>
      )}

      {!loadingData && orders.filter((order) => order.durum === "bekliyor" || order.durum === "hazirlaniyor").length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-5 md:gap-6">
          {orders
            .filter((order) => order.durum === "bekliyor" || order.durum === "hazirlaniyor")
            .sort((a, b) => new Date(a.zaman) - new Date(b.zaman)) // En eski siparişler üste
            .map((order) => {
              if (!Array.isArray(order.sepet) || order.sepet.length === 0) {
                logWarn(`Boş veya geçersiz sepetli sipariş atlandı (ID: ${order.id})`);
                return null;
              }
              const cardStyle = getStatusCardStyle(order.durum);
              const badgeStyle = getStatusBadgeStyle(order.durum);
              return (
                <div
                  key={order.id}
                  className={`${cardStyle} rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 ease-in-out flex flex-col p-5`}
                >
                  <div className="flex justify-between items-center mb-3 pb-3 border-b border-gray-300/70">
                    <p className="font-semibold text-lg text-slate-800">
                      <span className="text-orange-600 font-bold">#{order.id}</span> / Masa: <span className="font-bold text-orange-600">{order.masa}</span>
                    </p>
                    <span
                      className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${badgeStyle}`}
                    >
                      {order.durum || "Bilinmiyor"}
                    </span>
                  </div>

                  <div className="bg-white/80 rounded-lg p-3.5 mb-4 flex-grow min-h-[100px] shadow-inner">
                    <ul className="space-y-2">
                      {order.sepet.map((item, index) => (
                        <li key={index} className="flex justify-between items-center text-base text-slate-700">
                          <span className="flex-1 mr-3 font-medium leading-tight">• {item.urun}</span>
                          <span className="font-bold text-xl text-orange-700 whitespace-nowrap">× {item.adet}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {order.istek && (
                    <div className="mb-4 p-3 bg-amber-50 rounded-lg border border-amber-300 text-amber-800 text-sm italic shadow-sm">
                      <span className="font-semibold block mb-0.5">Özel İstek:</span> {order.istek}
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-2.5 mt-auto">
                    {order.durum === "bekliyor" && (
                      <button
                        onClick={() => handleHazirlaniyor(order.id, order.masa)}
                        className="w-full flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ease-in-out active:scale-95 shadow-md hover:shadow-lg"
                        title="Hazırlamaya başla"
                      >
                        <PlayCircle className="w-5 h-5" /> Hazırlanıyor Al
                      </button>
                    )}
                    {order.durum === "hazirlaniyor" && (
                      <button
                        onClick={() => handleHazir(order.id, order.masa)}
                        className="w-full flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ease-in-out active:scale-95 shadow-md hover:shadow-lg"
                        title="Sipariş hazırlandı"
                      >
                        <CheckCircle2 className="w-5 h-5" /> Sipariş Hazır
                      </button>
                    )}
                    <button
                      onClick={() => handleIptal(order.id, order.masa)}
                      className="w-full flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ease-in-out active:scale-95 shadow-md hover:shadow-lg"
                      title="Siparişi iptal et"
                    >
                      <XCircle className="w-5 h-5" /> İptal Et
                    </button>
                  </div>
                  <div className="text-right mt-4 text-xs text-gray-500 flex items-center justify-end">
                    <Clock className="w-4 h-4 mr-1.5 text-slate-400" /> {formatTime(order.zaman)}
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