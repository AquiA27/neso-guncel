// src/pages/KasaEkrani.jsx
import React, { useState, useEffect, useRef, useCallback, useContext } from "react";
import apiClient from '../services/apiClient';
import { AuthContext } from '../AuthContext';
import { useNavigate } from 'react-router-dom';
import {
    DollarSign,
    CreditCard,
    CheckCircle,
    AlertCircle, // Bu hala yetkilendirme yükleme ekranında kullanılıyor, isteğe bağlı olarak Loader2 ile değiştirilebilir
    RotateCw,
    Store,      // EKLENDİ (Kasa Paneli başlığı için)
    Receipt,    // EKLENDİ (Hesabı Getir butonu için)
    Clock,      // EKLENDİ (Sipariş zamanı için)
    Inbox,      // EKLENDİ (Boş sipariş listesi için)
    FileSearch, // EKLENDİ (Masa hesabı bulunamadı için)
    ClipboardList, // EKLENDİ (Masa için aktif sipariş yoksa)
    Loader2,    // EKLENDİ (Genel yükleme ikonları için)
    XCircle // EKLENDİ (Hata mesajı kapatma butonu için)
} from 'lucide-react';

function KasaEkrani() {
  const { isAuthenticated, currentUser, userRole, loadingAuth, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const [payableOrders, setPayableOrders] = useState([]);
  const [tableBill, setTableBill] = useState(null);
  const [currentTableId, setCurrentTableId] = useState("");
  const [selectedOrderStatusFilter, setSelectedOrderStatusFilter] = useState("");

  const [error, setError] = useState(null);
  const [loadingPayable, setLoadingPayable] = useState(true);
  const [loadingBill, setLoadingBill] = useState(false);
  const wsRef = useRef(null);
  const [payingOrderId, setPayingOrderId] = useState(null);
  const [paymentMethodModal, setPaymentMethodModal] = useState({
    isOpen: false,
    orderId: null,
    orderMasa: null,
    orderTotal: 0,
  });

  const logInfo = useCallback((message) => console.log(`[Kasa Ekranı] INFO: ${message}`), []);
  const logError = useCallback((message, errorObj) => console.error(`[Kasa Ekranı] ERROR: ${message}`, errorObj || ""), []);
  const logWarn = useCallback((message) => console.warn(`[Kasa Ekranı] WARN: ${message}`), []);
  const logDebug = useCallback((message, ...optionalParams) => console.debug(`[Kasa Ekranı] DEBUG: ${message}`, ...optionalParams), []);

  const handleApiError = useCallback((err, defaultMessage) => {
    const errorDetail = err.response?.data?.detail || err.message || "Bilinmeyen hata.";
    if (err.response?.status === 401 || err.response?.status === 403) {
      setError("Bu işlem için yetkiniz yok veya oturumunuz sonlanmış. Lütfen tekrar giriş yapın.");
      logout();
    } else {
      setError(`${defaultMessage}: ${errorDetail}`);
    }
  }, [logout]);

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
    setLoadingPayable(true);
    setError(null);
    try {
      let url = `/kasa/odemeler`;
      if (statusFilter) {
        url += `?durum=${statusFilter}`;
      }
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


  const markOrderAsPaid = useCallback(async (siparisId, odemeYontemi) => {
    if (!odemeYontemi) {
        logWarn("Ödeme yöntemi belirtilmedi.");
        setError("Lütfen bir ödeme yöntemi seçin.");
        return;
    }
    logInfo(`💰 Kasa: Sipariş ${siparisId} ödeme yöntemi '${odemeYontemi}' ile ödendi olarak işaretleniyor...`);
    setPayingOrderId(siparisId);
    setError(null);
    try {
      const payload = { odeme_yontemi: odemeYontemi };
      const response = await apiClient.post(
        `/kasa/siparis/${siparisId}/odendi`,
        payload
      );
      logInfo(`✅ Kasa: Sipariş ${siparisId} ödendi olarak işaretlendi: ${response.data.message}`);
      setPaymentMethodModal({ isOpen: false, orderId: null, orderMasa: null, orderTotal: 0 });
    } catch (err) {
      logError(`❌ Kasa: Sipariş ${siparisId} ödendi olarak işaretlenemedi:`, err);
      handleApiError(err, `Sipariş ${siparisId} (${odemeYontemi}) ödendi olarak işaretlenemedi`);
    } finally {
      setPayingOrderId(null);
    }
  }, [logInfo, logError, logWarn, handleApiError]);

  useEffect(() => {
    document.title = "Kasa Paneli - Neso";
  }, []);

  useEffect(() => {
    if (!loadingAuth) {
      const allowedRoles = ['admin', 'kasiyer'];
      if (isAuthenticated && allowedRoles.includes(userRole)) {
        logInfo("Kasa ekranı için yetkili kullanıcı, veriler çekiliyor ve WS bağlanıyor...");
        fetchPayableOrders();
      } else if (isAuthenticated && !allowedRoles.includes(userRole)) {
        logWarn("Kasa ekranı için yetkisiz kullanıcı. Yetkisiz sayfasına yönlendiriliyor...");
        navigate('/unauthorized');
      } else if (!isAuthenticated) {
        logWarn("Giriş yapılmamış, kasa ekranı için login'e yönlendiriliyor.");
        navigate('/login', { state: { from: { pathname: '/kasa' } } });
      }
    }
  }, [isAuthenticated, userRole, loadingAuth, navigate, fetchPayableOrders, logInfo, logWarn]);


  const fetchTableBill = useCallback(async (masaId) => {
    if (!masaId) {
      logWarn("Masa ID'si girilmedi.");
      setError("Lütfen bir masa numarası girin.");
      return;
    }
    logInfo(`🧾 Masa ${masaId} için hesap getiriliyor (Kasa)...`);
    setLoadingBill(true);
    setTableBill(null);
    setError(null);
    try {
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
              if (tableBill && message.data?.masa_id === tableBill.masa_id) { // masa_id olarak güncellendi
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
  }, [isAuthenticated, userRole, loadingAuth, logInfo, logError, logWarn, logDebug, selectedOrderStatusFilter, tableBill, fetchPayableOrders, fetchTableBill]);


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

  const getStatusBackground = useCallback((status) => { // Arka plan rengi için ayrı fonksiyon
    switch (status?.toLowerCase()) {
      case "bekliyor": return "bg-yellow-100 border-yellow-400";
      case "hazirlaniyor": return "bg-blue-100 border-blue-400";
      case "hazir": return "bg-green-100 border-green-400";
      case "odendi": return "bg-purple-100 border-purple-400";
      case "iptal": return "bg-red-100 border-red-400 text-gray-500 line-through opacity-80";
      default: return "bg-gray-100 border-gray-300";
    }
  }, []);

  const getStatusBadgeStyle = useCallback((status) => { // Statü rozeti için ayrı stil fonksiyonu
    switch (status?.toLowerCase()) {
        case "bekliyor": return "bg-yellow-500 text-white";
        case "hazirlaniyor": return "bg-blue-500 text-white";
        case "hazir": return "bg-green-500 text-white";
        case "odendi": return "bg-purple-500 text-white";
        case "iptal": return "bg-red-500 text-white";
        default: return "bg-gray-500 text-white";
    }
  }, []);


  const openPaymentModal = (order) => {
    const totalAmount = order.sepet.reduce((sum, item) => {
        const price = parseFloat(item.fiyat);
        const quantity = parseInt(item.adet, 10);
        if (!isNaN(price) && !isNaN(quantity)) {
            return sum + (quantity * price);
        }
        return sum;
    }, 0);
    setPaymentMethodModal({
      isOpen: true,
      orderId: order.id,
      orderMasa: order.masa,
      orderTotal: totalAmount,
    });
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
    const cardBackground = getStatusBackground(order.durum);
    const statusBadgeStyle = getStatusBadgeStyle(order.durum);

    return (
      <div
        key={order.id}
        className={`${cardBackground} rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 ease-in-out flex flex-col p-5`}
      >
        <div className="flex justify-between items-center mb-3 pb-3 border-b border-gray-300/70">
          <p className="font-semibold text-lg text-slate-800">
            Sipariş <span className="text-indigo-700 font-bold">#{order.id}</span> /
            Masa: <span className="font-bold text-indigo-700">{order.masa}</span>
          </p>
          <span
            className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${statusBadgeStyle}`}
          >
            {order.durum || "Bilinmiyor"}
          </span>
        </div>
        <div className="bg-white/70 rounded p-3.5 mb-3 flex-grow min-h-[80px] shadow-sm">
          <ul className="space-y-2">
            {order.sepet.map((item, index) => (
              <li key={index} className="flex justify-between items-start text-sm text-slate-700">
                <span className="flex-1 mr-2">• {item.urun}</span>
                <div className="text-right flex-shrink-0">
                  <span className="font-medium text-orange-800">× {item.adet}</span>
                  <span className="ml-2 text-xs text-slate-500 whitespace-nowrap">({parseFloat(item.fiyat).toFixed(2)} TL)</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
        {order.istek && (
          <div className="mb-3 p-2.5 bg-amber-100/80 rounded border border-amber-300 text-amber-900 text-xs italic shadow-sm">
            <span className="font-semibold">Not:</span> {order.istek}
          </div>
        )}
        <p className="font-semibold text-lg mb-3 text-slate-700">Sipariş Toplamı: {totalAmount.toFixed(2)} TL</p>
        {!isBillItem && order.durum !== "odendi" && order.durum !== "iptal" && (
          <button
            onClick={() => openPaymentModal(order)}
            disabled={payingOrderId === order.id}
            className="w-full mt-auto bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition duration-200 ease-in-out active:scale-95 shadow-md hover:shadow-lg flex items-center justify-center gap-2"
          >
            {payingOrderId === order.id ? <RotateCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
            {payingOrderId === order.id ? "İşleniyor..." : "Ödeme Al"}
          </button>
        )}
         <div className="text-right mt-4 text-xs text-gray-500 flex items-center justify-end">
            <Clock className="w-4 h-4 mr-1.5 text-slate-400" /> {formatTime(order.zaman)}
        </div>
      </div>
    );
  };


  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-100 p-4">
        <div className="bg-white shadow-xl p-10 rounded-lg text-center border border-slate-300">
           <Loader2 className="w-12 h-12 text-indigo-500 mx-auto mb-6 animate-spin" />
          <h2 className="text-2xl font-semibold mb-3 text-slate-700">Yükleniyor...</h2>
          <p className="text-slate-500">Kasa ekranı yetkileri kontrol ediliyor, lütfen bekleyin.</p>
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100 p-4 md:p-8 text-gray-800 font-sans">
      <header className="flex flex-wrap justify-between items-center mb-10 gap-4 pb-4 border-b border-indigo-200">
        <h1 className="text-3xl md:text-4xl font-bold text-indigo-700 flex items-center">
            <Store className="w-9 h-9 mr-3 text-indigo-500" /> Kasa Paneli
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
        <div className="bg-red-100 border-l-4 border-red-600 text-red-800 px-5 py-4 rounded-md relative mb-6 shadow-lg" role="alert">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-600 mr-3 mt-0.5" />
            <div>
              <strong className="font-bold block">Hata Oluştu!</strong>
              <span className="block sm:inline text-sm">{error}</span>
            </div>
          </div>
          <button
            onClick={() => setError(null)}
            className="absolute top-2.5 right-2.5 text-red-600 hover:text-red-800 transition-colors p-1 rounded-full hover:bg-red-200"
            aria-label="Hata mesajını kapat"
          >
            <XCircle className="w-6 h-6" />
          </button>
        </div>
      )}

      {paymentMethodModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-white p-7 rounded-xl shadow-2xl max-w-md w-full transform transition-all duration-300 ease-out scale-100"> {/* scale-95 opacity-0 group-hover:scale-100 group-hover:opacity-100 */}
            <h3 className="text-2xl font-semibold text-slate-800 mb-2 text-center">Ödeme Yöntemi</h3>
            <p className="text-sm text-slate-600 mb-1 text-center">Masa: <span className="font-bold">{paymentMethodModal.orderMasa}</span> / Sipariş ID: <span className="font-bold">#{paymentMethodModal.orderId}</span></p>
            <p className="text-2xl font-bold text-green-600 mb-6 text-center">Tutar: {paymentMethodModal.orderTotal.toFixed(2)} TL</p>
            <div className="space-y-3.5">
              <button
                onClick={() => markOrderAsPaid(paymentMethodModal.orderId, "Nakit")}
                disabled={payingOrderId === paymentMethodModal.orderId}
                className="w-full flex items-center justify-center gap-2.5 bg-green-500 hover:bg-green-600 disabled:bg-green-300 text-white px-5 py-3 rounded-lg font-semibold transition-all shadow-md hover:shadow-lg active:scale-95 text-base"
              >
                {payingOrderId === paymentMethodModal.orderId && <RotateCw className="w-5 h-5 animate-spin" />}
                <DollarSign className="w-5 h-5" /> Nakit
              </button>
              <button
                onClick={() => markOrderAsPaid(paymentMethodModal.orderId, "Kredi Kartı")}
                disabled={payingOrderId === paymentMethodModal.orderId}
                className="w-full flex items-center justify-center gap-2.5 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white px-5 py-3 rounded-lg font-semibold transition-all shadow-md hover:shadow-lg active:scale-95 text-base"
              >
                {payingOrderId === paymentMethodModal.orderId && <RotateCw className="w-5 h-5 animate-spin" />}
                <CreditCard className="w-5 h-5" /> Kredi Kartı
              </button>
            </div>
            <button
              onClick={() => setPaymentMethodModal({ isOpen: false, orderId: null, orderMasa: null, orderTotal: 0 })}
              disabled={payingOrderId === paymentMethodModal.orderId}
              className="mt-8 w-full text-sm text-slate-600 hover:text-slate-900 py-2.5 rounded-md hover:bg-slate-100 transition-colors disabled:opacity-50"
            >
              Vazgeç
            </button>
          </div>
        </div>
      )}


      <section className="mb-12 p-5 md:p-7 bg-white/80 backdrop-blur-sm rounded-xl shadow-xl border border-purple-200/50">
        <h2 className="text-2xl md:text-3xl font-semibold text-purple-700 mb-6">Ödeme Bekleyen Siparişler</h2>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center mb-6 gap-4">
            <div className="flex-grow">
                <label htmlFor="statusFilter" className="block text-sm font-medium text-slate-700 mb-1">Duruma Göre Filtrele:</label>
                <select
                    id="statusFilter"
                    value={selectedOrderStatusFilter}
                    onChange={(e) => {
                        setSelectedOrderStatusFilter(e.target.value);
                        fetchPayableOrders(e.target.value);
                    }}
                    className="w-full p-2.5 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition-colors"
                >
                    <option value="">Tümü (Aktif Siparişler)</option>
                    <option value="bekliyor">Bekliyor</option>
                    <option value="hazirlaniyor">Hazırlanıyor</option>
                    <option value="hazir">Hazır</option>
                </select>
            </div>
            <button
                onClick={() => fetchPayableOrders(selectedOrderStatusFilter)}
                className="w-full sm:w-auto bg-purple-500 hover:bg-purple-600 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-all shadow-md hover:shadow-lg active:scale-95 flex items-center justify-center gap-2 self-end"
                disabled={loadingPayable}
            >
                <RotateCw className={`w-4 h-4 ${loadingPayable ? "animate-spin" : ""}`} />
                Yenile
            </button>
        </div>
        {loadingPayable ? (
          <div className="text-center p-10 text-purple-600 flex flex-col items-center justify-center">
            <Loader2 className="w-12 h-12 text-purple-400 animate-spin mb-4" />
            Ödeme bekleyen siparişler yükleniyor...
          </div>
        ) : payableOrders.length === 0 ? (
          <div className="text-gray-500 text-lg p-8 bg-purple-50/70 rounded-lg text-center flex flex-col items-center justify-center min-h-[200px] border border-purple-200">
            <Inbox className="w-20 h-20 text-purple-300 mb-5" />
            {selectedOrderStatusFilter ? `"${selectedOrderStatusFilter}" durumunda ` : ""}
            Şu anda ödeme bekleyen sipariş bulunmamaktadır.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 md:gap-7">
            {payableOrders.map(order => renderSingleOrder(order, false))}
          </div>
        )}
      </section>

      <section className="p-5 md:p-7 bg-white/80 backdrop-blur-sm rounded-xl shadow-xl border border-green-200/50">
        <h2 className="text-2xl md:text-3xl font-semibold text-green-700 mb-6">Masa Hesabı</h2>
        <form onSubmit={(e) => { e.preventDefault(); fetchTableBill(currentTableId); }} className="flex flex-col sm:flex-row items-stretch sm:items-end gap-4 mb-7">
          <div className="flex-grow">
            <label htmlFor="tableIdInput" className="block text-sm font-medium text-gray-700 mb-1">Masa Numarası:</label>
            <input
              type="text"
              id="tableIdInput"
              value={currentTableId}
              onChange={(e) => setCurrentTableId(e.target.value)}
              placeholder="Örn: Masa-5 veya 12"
              className="w-full p-2.5 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm transition-colors"
            />
          </div>
          <button
            type="submit"
            className="w-full sm:w-auto bg-green-500 hover:bg-green-600 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-all shadow-md hover:shadow-lg active:scale-95 flex items-center justify-center gap-2"
            disabled={loadingBill || !currentTableId.trim()}
          >
            {loadingBill ? <RotateCw className="w-4 h-4 animate-spin" /> : <Receipt className="w-5 h-5" />}
            {loadingBill ? "Yükleniyor..." : "Hesabı Getir"}
          </button>
        </form>

        {loadingBill && (
            <div className="text-center p-10 text-green-600 flex flex-col items-center justify-center">
                <Loader2 className="w-12 h-12 text-green-400 animate-spin mb-4" />
                Masa hesabı yükleniyor...
            </div>
        )}

        {tableBill && (
          <div className="mt-5 border-t border-green-200 pt-6">
            <h3 className="text-xl md:text-2xl font-semibold text-gray-800 mb-5">
              Masa <span className="text-green-600 font-bold">{tableBill.masa_id}</span> Detayları
            </h3>
            {tableBill.siparisler && tableBill.siparisler.length > 0 ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 md:gap-7">
                    {tableBill.siparisler.map(order => renderSingleOrder(order, true))}
                </div>
                <div className="mt-8 pt-6 border-t border-gray-300 text-right">
                  <p className="text-2xl md:text-3xl font-bold text-green-700">
                    Genel Toplam: {tableBill.toplam_tutar?.toFixed(2) || '0.00'} TL
                  </p>
                </div>
              </>
            ) : (
              <div className="text-gray-500 p-8 bg-green-50/70 rounded-lg text-center flex flex-col items-center justify-center min-h-[200px] border border-green-200">
                <ClipboardList className="w-20 h-20 text-green-300 mb-5" />
                Bu masa için ödenecek aktif sipariş bulunmuyor.
              </div>
            )}
          </div>
        )}
        {!loadingBill && tableBill === null && currentTableId && !error && ( // Sadece currentTableId varken ve hata yokken göster
            <div className="text-gray-500 mt-6 p-8 bg-yellow-50/70 rounded-lg text-center flex flex-col items-center justify-center min-h-[200px] border border-yellow-200">
                <FileSearch className="w-20 h-20 text-yellow-400 mb-5" />
                Masa hesabı getirilmedi veya <span className="font-semibold">{currentTableId}</span> için aktif sipariş bulunamadı.
            </div>
        )}
      </section>
    </div>
  );
}

export default KasaEkrani;