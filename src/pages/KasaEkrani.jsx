// src/pages/KasaEkrani.jsx
import React, { useState, useEffect, useRef, useCallback, useContext } from "react"; // useContext eklendi
// import axios from "axios"; // KALDIRILDI (apiClient kullanılacak)
import apiClient from '../services/apiClient'; // GÜNCELLENDİ: apiClient import edildi
import { AuthContext } from '../context/AuthContext'; // GÜNCELLENDİ: AuthContext import edildi
import { useNavigate } from 'react-router-dom'; // GÜNCELLENDİ: Yönlendirme için

// const API_BASE = process.env.REACT_APP_API_BASE; // KALDIRILDI (apiClient içinde)
// const ADMIN_USERNAME = process.env.REACT_APP_ADMIN_USERNAME || "admin"; // KALDIRILDI
// const ADMIN_PASSWORD = process.env.REACT_APP_ADMIN_PASSWORD || "admin123"; // KALDIRILDI
// const AUTH_HEADER = "Basic " + btoa(`${ADMIN_USERNAME}:${ADMIN_PASSWORD}`); // KALDIRILDI

function KasaEkrani() {
  const { isAuthenticated, currentUser, userRole, loadingAuth, logout } = useContext(AuthContext); // GÜNCELLENDİ
  const navigate = useNavigate(); // GÜNCELLENDİ

  const [payableOrders, setPayableOrders] = useState([]);
  const [tableBill, setTableBill] = useState(null);
  const [currentTableId, setCurrentTableId] = useState("");
  const [selectedOrderStatusFilter, setSelectedOrderStatusFilter] = useState("");

  const [error, setError] = useState(null);
  const [loadingPayable, setLoadingPayable] = useState(true);
  const [loadingBill, setLoadingBill] = useState(false);
  const wsRef = useRef(null);

  const logInfo = useCallback((message) => console.log(`[Kasa Ekranı] INFO: ${message}`), []);
  const logError = useCallback((message, errorObj) => console.error(`[Kasa Ekranı] ERROR: ${message}`, errorObj || ""), []);
  const logWarn = useCallback((message) => console.warn(`[Kasa Ekranı] WARN: ${message}`), []);
  const logDebug = useCallback((message) => console.log(`[Kasa Ekranı] DEBUG: ${message}`), []);

  useEffect(() => {
    document.title = "Kasa Paneli - Neso";
  }, []);

  // API Hata Yönetimi (GÜNCELLENDİ: logout eklendi)
  const handleApiError = useCallback((err, defaultMessage) => {
    const errorDetail = err.response?.data?.detail || err.message || "Bilinmeyen hata.";
    if (err.response?.status === 401 || err.response?.status === 403) {
      setError("Bu işlem için yetkiniz yok veya oturumunuz sonlanmış. Lütfen tekrar giriş yapın.");
      logout(); // Oturumu sonlandır
    } else {
      setError(`${defaultMessage}: ${errorDetail}`);
    }
  }, [logout]); // logout bağımlılığı eklendi

  const parseOrderBasket = useCallback((order) => {
    if (typeof order.sepet === "string") {
      try {
        order.sepet = JSON.parse(order.sepet);
      } catch (e) {
        logWarn(`Sipariş ID ${order.id} için sepet parse edilemedi:`, order.sepet);
        order.sepet = [];
      }
    }
    return order;
  }, [logWarn]);

  const fetchPayableOrders = useCallback(async (statusFilter = selectedOrderStatusFilter) => {
    logInfo(`🔄 Ödeme bekleyen siparişler getiriliyor (Kasa)... Filtre: ${statusFilter || 'varsayılan'}`);
    // const API_BASE_URL = process.env.REACT_APP_API_BASE; // apiClient içinde var
    // if (!API_BASE_URL) { // Bu kontrol AuthContext veya apiClient seviyesinde yapılmalı
    //   logError("API_BASE tanımlı değil.");
    //   setError("API adresi tanımlı değil.");
    //   setLoadingPayable(false);
    //   return;
    // }
    setLoadingPayable(true);
    setError(null); // Hata temizleme
    try {
      let url = `/kasa/odemeler`; // apiClient base URL'i kullanır
      if (statusFilter) {
        url += `?durum=${statusFilter}`;
      }
      // GÜNCELLENDİ: apiClient kullanıldı, Basic Auth header'ları kaldırıldı
      const response = await apiClient.get(url);
      const parsedOrders = (response.data.orders || []).map(parseOrderBasket);
      setPayableOrders(parsedOrders);
      logInfo(`✅ Kasa: Ödeme bekleyen siparişler başarıyla getirildi (${parsedOrders.length} adet).`);
    } catch (err) {
      logError("❌ Kasa: Ödeme bekleyen siparişler alınamadı:", err);
      handleApiError(err, "Ödeme bekleyen siparişler alınamadı");
    } finally {
      setLoadingPayable(false);
    }
  }, [selectedOrderStatusFilter, logInfo, logError, handleApiError, parseOrderBasket]);

  const fetchTableBill = useCallback(async (masaId) => {
    if (!masaId) {
      logWarn("Masa ID'si girilmedi.");
      setError("Lütfen bir masa numarası girin.");
      return;
    }
    logInfo(`🧾 Masa ${masaId} için hesap getiriliyor (Kasa)...`);
    // const API_BASE_URL = process.env.REACT_APP_API_BASE; // apiClient içinde var
    // if (!API_BASE_URL) { // Bu kontrol AuthContext veya apiClient seviyesinde yapılmalı
    //   logError("API_BASE tanımlı değil.");
    //   setError("API adresi tanımlı değil.");
    //   setLoadingBill(false);
    //   return;
    // }
    setLoadingBill(true);
    setTableBill(null);
    setError(null); // Hata temizleme
    try {
      // GÜNCELLENDİ: apiClient kullanıldı, Basic Auth header'ları kaldırıldı
      const response = await apiClient.get(`/kasa/masa/${masaId}/hesap`);
      const billData = response.data;
      if (billData && billData.siparisler) {
        billData.siparisler = billData.siparisler.map(parseOrderBasket);
      }
      setTableBill(billData);
      logInfo(`✅ Kasa: Masa ${masaId} hesabı başarıyla getirildi.`);
    } catch (err) {
      logError(`❌ Kasa: Masa ${masaId} hesabı alınamadı:`, err);
      handleApiError(err, `Masa ${masaId} hesabı alınamadı`);
      setTableBill(null);
    } finally {
      setLoadingBill(false);
    }
  }, [logInfo, logError, logWarn, handleApiError, parseOrderBasket]);

  const markOrderAsPaid = useCallback(async (siparisId, odemeYontemi = null) => {
    logInfo(`💰 Kasa: Sipariş ${siparisId} ödendi olarak işaretleniyor...`);
    // const API_BASE_URL = process.env.REACT_APP_API_BASE; // apiClient içinde var
    // if (!API_BASE_URL) { // Bu kontrol AuthContext veya apiClient seviyesinde yapılmalı
    //   logError("API_BASE tanımlı değil.");
    //   setError("API adresi tanımlı değil.");
    //   return;
    // }
    setError(null); // Hata temizleme
    try {
      const payload = odemeYontemi ? { odeme_yontemi: odemeYontemi } : {};
      // GÜNCELLENDİ: apiClient kullanıldı, Basic Auth header'ları kaldırıldı
      const response = await apiClient.post(
        `/kasa/siparis/${siparisId}/odendi`,
        payload
      );
      logInfo(`✅ Kasa: Sipariş ${siparisId} ödendi olarak işaretlendi: ${response.data.message}`);
      // fetchPayableOrders(); // Liste WebSocket ile güncellenmeli. Gerekirse manuel de çağrılabilir.
    } catch (err) {
      logError(`❌ Kasa: Sipariş ${siparisId} ödendi olarak işaretlenemedi:`, err);
      handleApiError(err, `Sipariş ${siparisId} ödendi olarak işaretlenemedi`);
    }
  }, [logInfo, logError, handleApiError]);


  // GÜNCELLENDİ: Auth durumu kontrolü ve ilk veri çekme
  useEffect(() => {
    if (!loadingAuth) { // AuthContext'ten gelen yükleme durumu bittikten sonra
      const allowedRoles = ['admin', 'kasiyer'];
      if (isAuthenticated && allowedRoles.includes(userRole)) {
        logInfo("Kasa ekranı için yetkili kullanıcı, veriler çekiliyor ve WS bağlanıyor...");
        fetchPayableOrders(); // İlk veri çekme
      } else if (isAuthenticated && !allowedRoles.includes(userRole)) {
        logWarn("Kasa ekranı için yetkisiz kullanıcı. Yetkisiz sayfasına yönlendiriliyor...");
        navigate('/unauthorized');
      } else if (!isAuthenticated) {
        logWarn("Giriş yapılmamış, kasa ekranı için login'e yönlendiriliyor.");
        navigate('/login', { state: { from: { pathname: '/kasa' } } });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, userRole, loadingAuth, navigate, logInfo, logWarn]); // fetchPayableOrders'ı bağımlılıktan çıkardık


  // GÜNCELLENDİ: WebSocket Bağlantısı (Sadece giriş yapmış ve yetkili role sahip kullanıcı için)
  useEffect(() => {
    const allowedRolesForWS = ['admin', 'kasiyer'];
    if (!isAuthenticated || !allowedRolesForWS.includes(userRole) || loadingAuth) {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            logInfo("Yetki yok veya çıkış yapıldı, Kasa WebSocket kapatılıyor.");
            wsRef.current.close(1000, "User not authorized or logged out for Kasa WS");
            wsRef.current = null;
        }
        return;
    }

    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;
    const baseReconnectDelay = 5000;
    let reconnectTimeoutId = null;
    let pingIntervalId = null;

    const connectWebSocket = () => {
      if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
        logDebug("Kasa WebSocket zaten açık veya bağlanıyor.");
        return;
      }
      const apiBaseForWs = process.env.REACT_APP_API_BASE;
      if (!apiBaseForWs) {
        logError("REACT_APP_API_BASE tanımlı değil, Kasa WS kurulamıyor.");
        setError("API adresi yapılandırılmamış.");
        return;
      }
      try {
        const wsProtocol = apiBaseForWs.startsWith("https") ? "wss:" : (window.location.protocol === "https:" ? "wss:" : "ws:");
        const wsHost = apiBaseForWs.replace(/^https?:\/\//, "");
        const wsUrl = `${wsProtocol}//${wsHost}/ws/kasa`;
        logInfo(`📡 Kasa WebSocket bağlantısı deneniyor: ${wsUrl}`);
        wsRef.current = new WebSocket(wsUrl);

        wsRef.current.onopen = () => {
          logInfo("✅ Kasa WebSocket bağlantısı başarılı.");
          setError(null);
          reconnectAttempts = 0;
          if (reconnectTimeoutId) { clearTimeout(reconnectTimeoutId); reconnectTimeoutId = null; }
        };

        wsRef.current.onmessage = (event) => {
          logDebug(`Kasa WS Mesajı Geldi: ${event.data}`);
          try {
            const message = JSON.parse(event.data);
            logInfo(`📥 Kasa WebSocket mesajı alındı: Tip: ${message.type}`);
            if (message.type === "siparis" || message.type === "durum" || message.type === "masa_durum") {
              logInfo("Sipariş/durum/masa güncellemesi (Kasa WS), ödeme bekleyenler listesi ve aktif masa hesabı (eğer varsa) yenileniyor...");
              fetchPayableOrders(selectedOrderStatusFilter);
              if (tableBill && message.data?.masa === tableBill.masa_id) {
                 logInfo(`Aktif görüntülenen masa (${tableBill.masa_id}) için hesap yenileniyor (Kasa WS)...`);
                 fetchTableBill(tableBill.masa_id);
              }
            } else if (message.type === "pong") {
              logDebug("Kasa Pong alındı.");
            } else {
              logWarn(`⚠️ Kasa - Bilinmeyen WS mesaj tipi: ${message.type}`);
            }
          } catch (err) {
            logError("Kasa WS mesaj işleme hatası:", err);
          }
        };

        wsRef.current.onerror = (errorEvent) => {
          logError("❌ Kasa WebSocket hatası:", errorEvent);
          setError("Sunucuyla anlık kasa bağlantısı kesildi...");
        };

        wsRef.current.onclose = (event) => {
          logInfo(`🔌 Kasa WebSocket bağlantısı kapandı. Kod: ${event.code}, Sebep: ${event.reason || "Yok"}`);
          wsRef.current = null;
          if (isAuthenticated && allowedRolesForWS.includes(userRole) && event.code !== 1000 && event.code !== 1001 && !event.wasClean && reconnectAttempts < maxReconnectAttempts) {
            const delay = baseReconnectDelay * Math.pow(2, reconnectAttempts) + Math.random() * 1000;
            logInfo(`Kasa WS beklenmedik şekilde kapandı, ${Math.round(delay/1000)}sn sonra tekrar denenecek... (Deneme: ${reconnectAttempts + 1})`);
            reconnectTimeoutId = setTimeout(connectWebSocket, delay);
            reconnectAttempts++;
          } else if (reconnectAttempts >= maxReconnectAttempts) {
            setError("Kasa sunucu bağlantısı tekrar sağlanamadı. Lütfen sayfayı yenileyin.");
          }
        };
      } catch (error) {
        logError("❌ Kasa WS başlatma kritik hata:", error);
        setError("Kasa sunucu bağlantısı (WebSocket) kurulamıyor.");
      }
    };

    connectWebSocket();

    pingIntervalId = setInterval(() => {
      if (isAuthenticated && allowedRolesForWS.includes(userRole) && wsRef.current?.readyState === WebSocket.OPEN) {
        try {
          wsRef.current.send(JSON.stringify({ type: "ping" }));
          logDebug("Kasa Ping gönderildi.");
        } catch (err) {
          logError("Kasa Ping gönderilemedi:", err);
        }
      } else if (isAuthenticated && allowedRolesForWS.includes(userRole) && !wsRef.current && reconnectAttempts < maxReconnectAttempts) {
        logWarn("Kasa Ping: WebSocket bağlantısı aktif değil, yeniden bağlantı deneniyor.");
        connectWebSocket();
      }
    }, 20000);

    return () => {
      clearInterval(pingIntervalId);
      if (reconnectTimeoutId) clearTimeout(reconnectTimeoutId);
      if (wsRef.current) {
        logInfo("KasaEkrani: Component kaldırılıyor, WebSocket kapatılıyor.");
        wsRef.current.close(1000, "Component unmounting");
        wsRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, userRole, loadingAuth, logInfo, logError, logWarn, logDebug, selectedOrderStatusFilter, tableBill]);
  // fetchPayableOrders ve fetchTableBill'i dependency array'den çıkardık, çünkü WS onmessage içinde direkt çağrılıyorlar.
  // Bu, sonsuz döngü riskini azaltır. İlk yükleme useEffect içinde fetchPayableOrders ile yapılıyor.

  const formatTime = useCallback((timeStr) => {
    if (!timeStr) return "-";
    try {
      const date = new Date(timeStr);
      return new Intl.DateTimeFormat("tr-TR", {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: "2-digit", minute: "2-digit", second: "2-digit",
        hour12: false,
      }).format(date);
    } catch {
      return timeStr;
    }
  }, []);

  const getStatusColors = useCallback((status) => {
    switch (status?.toLowerCase()) {
      case "bekliyor": return "bg-yellow-100 border-yellow-400";
      case "hazirlaniyor": return "bg-blue-100 border-blue-400";
      case "hazir": return "bg-green-100 border-green-400";
      case "odendi": return "bg-purple-100 border-purple-400";
      case "iptal": return "bg-red-100 border-red-400 text-gray-600 line-through opacity-80"; // text-gray-600 ve opacity eklendi
      default: return "bg-gray-100 border-gray-300";
    }
  }, []);

  const handleFetchTableBill = (e) => {
    e.preventDefault();
    if (currentTableId.trim()) {
        fetchTableBill(currentTableId.trim());
    } else {
        setError("Lütfen bir masa numarası giriniz.");
    }
  };

  const renderSingleOrder = (order, isBillItem = false) => {
    if (!order || !order.sepet || !Array.isArray(order.sepet)) {
      logWarn(`Geçersiz sipariş verisi veya sepeti yok: ID ${order?.id}`);
      return <p key={order?.id || Math.random()} className="text-red-500 p-4">Bu siparişin detayları yüklenemedi.</p>;
    }

    let totalAmount = order.sepet.reduce((sum, item) => {
        const price = parseFloat(item.fiyat);
        const quantity = parseInt(item.adet, 10);
        if (!isNaN(price) && !isNaN(quantity)) {
            return sum + (quantity * price);
        }
        return sum;
    }, 0);
    const cardColors = getStatusColors(order.durum);

    return (
      <div
        key={order.id} // Key eklendi
        className={`${cardColors} rounded-xl shadow-md p-4 mb-4 hover:shadow-lg transition-all duration-300 ease-in-out flex flex-col`}
      >
        <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-300/50">
          <p className="font-semibold text-lg text-slate-800">
            Sipariş #{order.id} / <span className="font-bold">Masa: {order.masa}</span>
          </p>
          <span
            className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
              order.durum === "hazir" ? "bg-green-500 text-white" :
              order.durum === "bekliyor" ? "bg-yellow-500 text-white" :
              order.durum === "hazirlaniyor" ? "bg-blue-500 text-white" :
              order.durum === "odendi" ? "bg-purple-500 text-white" :
              order.durum === "iptal" ? "bg-red-500 text-white" :
              "bg-gray-500 text-white"
            }`}
          >
            {order.durum || "Bilinmiyor"}
          </span>
        </div>
        <div className="bg-white/60 rounded p-3 mb-3 flex-grow min-h-[70px]">
          <ul className="space-y-1.5">
            {order.sepet.map((item, index) => (
              <li key={index} className="flex justify-between items-start text-sm text-slate-700">
                <span className="flex-1 mr-2">• {item.urun}</span>
                <span className="font-semibold text-orange-800">× {item.adet} ({parseFloat(item.fiyat).toFixed(2)} TL)</span>
              </li>
            ))}
          </ul>
        </div>
        {order.istek && (
          <div className="mb-3 p-2 bg-amber-100/80 rounded border border-amber-300 text-amber-900 text-xs italic shadow-sm">
            <span className="font-semibold">Not:</span> {order.istek}
          </div>
        )}
        <p className="font-semibold text-md mb-2 text-slate-700">Sipariş Toplamı: {totalAmount.toFixed(2)} TL</p>
        {!isBillItem && order.durum !== "odendi" && order.durum !== "iptal" && (
          <button
            onClick={() => markOrderAsPaid(order.id)}
            className="w-full mt-2 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg text-sm font-semibold transition duration-200 ease-in-out active:scale-95 shadow hover:shadow-md"
          >
            💰 Ödendi İşaretle
          </button>
        )}
         <div className="text-right mt-3 text-xs text-gray-500">
            ⏱️ {formatTime(order.zaman)}
        </div>
      </div>
    );
  };

  // GÜNCELLENDİ: Yükleme ve Yetki Kontrolü
  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-100 p-4">
        <div className="bg-white shadow-xl p-8 rounded-lg text-center border border-slate-300">
           <AlertCircle className="w-12 h-12 text-indigo-500 mx-auto mb-4 animate-pulse" />
          <h2 className="text-xl font-semibold mb-2 text-slate-700">Yükleniyor...</h2>
          <p className="text-slate-500">Kasa ekranı yetkileri kontrol ediliyor, lütfen bekleyin.</p>
        </div>
      </div>
    );
  }
  // ProtectedRoute bu sayfaya sadece yetkili kullanıcıların gelmesini sağlamalı.

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100 p-4 md:p-6 text-gray-800 font-sans">
      <div className="flex flex-wrap justify-between items-center mb-8 gap-4">
        <h1 className="text-3xl md:text-4xl font-bold text-indigo-700">💰 Kasa Paneli</h1>
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
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded relative mb-4 shadow" role="alert">
          <strong className="font-bold">Hata: </strong>
          <span className="block sm:inline">{error}</span>
          <button onClick={() => setError(null)} className="absolute top-0 bottom-0 right-0 px-4 py-3 text-red-700 hover:text-red-900 transition-colors">
            <span className="text-xl">&times;</span>
          </button>
        </div>
      )}

      <section className="mb-10 p-4 md:p-6 bg-white rounded-xl shadow-lg">
        <h2 className="text-xl md:text-2xl font-semibold text-purple-700 mb-4">Ödeme Bekleyen Siparişler</h2>
        <div className="flex flex-col sm:flex-row items-start sm:items-center mb-4 gap-3 sm:gap-4">
            <label htmlFor="statusFilter" className="mr-2 font-medium text-sm text-slate-700 whitespace-nowrap">Duruma Göre Filtrele:</label>
            <select
                id="statusFilter"
                value={selectedOrderStatusFilter}
                onChange={(e) => {
                    setSelectedOrderStatusFilter(e.target.value);
                    fetchPayableOrders(e.target.value); // Filtre değiştiğinde hemen yükle
                }}
                className="w-full sm:w-auto p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
            >
                <option value="">Tümü (Aktif Siparişler)</option>
                <option value="bekliyor">Bekliyor</option>
                <option value="hazirlaniyor">Hazırlanıyor</option>
                <option value="hazir">Hazır</option>
            </select>
            <button
                onClick={() => fetchPayableOrders(selectedOrderStatusFilter)} // Sadece yenileme için
                className="w-full sm:w-auto bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition shadow active:scale-95 flex items-center justify-center gap-1"
                disabled={loadingPayable}
            >
                <RotateCw className={`w-4 h-4 ${loadingPayable ? "animate-spin" : ""}`} />
                Yenile
            </button>
        </div>
        {loadingPayable ? (
          <div className="text-center p-8 text-purple-600 animate-pulse">Ödeme bekleyen siparişler yükleniyor...</div>
        ) : payableOrders.length === 0 ? (
          <p className="text-gray-500 text-lg p-4 bg-purple-50 rounded-md text-center">
            {selectedOrderStatusFilter ? `"${selectedOrderStatusFilter}" durumunda ` : ""}
            Şu anda ödeme bekleyen sipariş bulunmamaktadır.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {payableOrders.map(order => renderSingleOrder(order, false))}
          </div>
        )}
      </section>

      <section className="p-4 md:p-6 bg-white rounded-xl shadow-lg">
        <h2 className="text-xl md:text-2xl font-semibold text-green-700 mb-4">Masa Hesabı</h2>
        <form onSubmit={handleFetchTableBill} className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 sm:gap-4 mb-6">
          <div className="flex-grow">
            <label htmlFor="tableIdInput" className="block text-sm font-medium text-gray-700 mb-1">Masa Numarası:</label>
            <input
              type="text"
              id="tableIdInput"
              value={currentTableId}
              onChange={(e) => setCurrentTableId(e.target.value)}
              placeholder="Örn: Masa-5 veya 12"
              className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 text-sm"
            />
          </div>
          <button
            type="submit"
            className="w-full sm:w-auto bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition shadow active:scale-95 flex items-center justify-center gap-1"
            disabled={loadingBill || !currentTableId.trim()}
          >
            {loadingBill ? <RotateCw className="w-4 h-4 animate-spin" /> : "🧾"}
            {loadingBill ? "Yükleniyor..." : "Hesabı Getir"}
          </button>
        </form>

        {loadingBill && <div className="text-center p-4 text-green-600 animate-pulse">Masa hesabı yükleniyor...</div>}

        {tableBill && (
          <div className="mt-4 border-t pt-4">
            <h3 className="text-lg md:text-xl font-semibold text-gray-700 mb-3">
              Masa <span className="text-green-600">{tableBill.masa_id}</span> Detayları
            </h3>
            {tableBill.siparisler && tableBill.siparisler.length > 0 ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {tableBill.siparisler.map(order => renderSingleOrder(order, true))}
                </div>
                <div className="mt-6 pt-4 border-t border-gray-300 text-right">
                  <p className="text-xl md:text-2xl font-bold text-green-700">
                    Genel Toplam: {tableBill.toplam_tutar?.toFixed(2) || '0.00'} TL
                  </p>
                </div>
              </>
            ) : (
              <p className="text-gray-500 p-4 bg-green-50 rounded-md text-center">Bu masa için ödenecek aktif sipariş bulunmuyor.</p>
            )}
          </div>
        )}
        {!loadingBill && tableBill === null && currentTableId && <p className="text-gray-500 mt-4 p-4 bg-yellow-50 rounded-md text-center">Masa hesabı getirilmedi veya <span className="font-semibold">{currentTableId}</span> için aktif sipariş bulunamadı.</p>}
      </section>
    </div>
  );
}

export default KasaEkrani;