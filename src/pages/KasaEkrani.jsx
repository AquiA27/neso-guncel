import React, { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";

// Ortam değişkenlerinden API ve kimlik bilgilerini al
const API_BASE = process.env.REACT_APP_API_BASE; //örn: http://localhost:8000
const ADMIN_USERNAME = process.env.REACT_APP_ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.REACT_APP_ADMIN_PASSWORD || "admin123"; // Güvenlik için .env dosyasında saklayın
const AUTH_HEADER = "Basic " + btoa(`${ADMIN_USERNAME}:${ADMIN_PASSWORD}`);

function KasaEkrani() {
  const [payableOrders, setPayableOrders] = useState([]); // Ödeme bekleyen siparişler
  const [tableBill, setTableBill] = useState(null); // Görüntülenen masa hesabı
  const [currentTableId, setCurrentTableId] = useState(""); // Masa hesabı için input
  const [selectedOrderStatusFilter, setSelectedOrderStatusFilter] = useState(""); // Filtre için ('hazir', 'bekliyor')

  const [error, setError] = useState(null);
  const [loadingPayable, setLoadingPayable] = useState(true);
  const [loadingBill, setLoadingBill] = useState(false);
  const wsRef = useRef(null);

  // --- Yardımcı Log Fonksiyonları ---
  const logInfo = useCallback((message) => console.log(`[Kasa Ekranı] INFO: ${message}`), []);
  const logError = useCallback((message, errorObj) => console.error(`[Kasa Ekranı] ERROR: ${message}`, errorObj || ""), []);
  const logWarn = useCallback((message) => console.warn(`[Kasa Ekranı] WARN: ${message}`), []);
  const logDebug = useCallback((message) => console.log(`[Kasa Ekranı] DEBUG: ${message}`), []);

  // --- Sayfa Başlığı ---
  useEffect(() => {
    document.title = "Kasa Paneli - Neso";
  }, []);

  // --- Siparişleri (Ödeme Bekleyenleri) Getirme Fonksiyonu ---
  const fetchPayableOrders = useCallback(async (statusFilter = selectedOrderStatusFilter) => {
    logInfo(`🔄 Ödeme bekleyen siparişler getiriliyor... Filtre: ${statusFilter || 'varsayılan'}`);
    if (!API_BASE) {
      logError("API_BASE tanımlı değil.");
      setError("API adresi tanımlı değil.");
      setLoadingPayable(false);
      return;
    }
    setLoadingPayable(true);
    try {
      let url = `${API_BASE}/kasa/odemeler`;
      if (statusFilter) {
        url += `?durum=${statusFilter}`;
      }
      const response = await axios.get(url, {
        headers: { Authorization: AUTH_HEADER, "Content-Type": "application/json" },
      });
      const parsedOrders = (response.data.orders || []).map(parseOrderBasket);
      setPayableOrders(parsedOrders);
      setError(null);
      logInfo(`✅ Ödeme bekleyen siparişler başarıyla getirildi (${parsedOrders.length} adet).`);
    } catch (err) {
      logError("❌ Ödeme bekleyen siparişler alınamadı:", err);
      handleApiError(err, "Ödeme bekleyen siparişler alınamadı");
    } finally {
      setLoadingPayable(false);
    }
  }, [logInfo, logError, selectedOrderStatusFilter]); // selectedOrderStatusFilter bağımlılık olarak eklendi

  // --- Masa Hesabını Getirme Fonksiyonu ---
  const fetchTableBill = useCallback(async (masaId) => {
    if (!masaId) {
      logWarn("Masa ID'si girilmedi.");
      setError("Lütfen bir masa numarası girin.");
      return;
    }
    logInfo(`🧾 Masa ${masaId} için hesap getiriliyor...`);
    if (!API_BASE) {
      logError("API_BASE tanımlı değil.");
      setError("API adresi tanımlı değil.");
      return;
    }
    setLoadingBill(true);
    setTableBill(null); // Önceki hesabı temizle
    try {
      const response = await axios.get(`${API_BASE}/kasa/masa/${masaId}/hesap`, {
        headers: { Authorization: AUTH_HEADER, "Content-Type": "application/json" },
      });
      const billData = response.data;
      if (billData && billData.siparisler) {
        billData.siparisler = billData.siparisler.map(parseOrderBasket);
      }
      setTableBill(billData);
      setError(null);
      logInfo(`✅ Masa ${masaId} hesabı başarıyla getirildi.`);
    } catch (err) {
      logError(`❌ Masa ${masaId} hesabı alınamadı:`, err);
      handleApiError(err, `Masa ${masaId} hesabı alınamadı`);
      setTableBill(null);
    } finally {
      setLoadingBill(false);
    }
  }, [logInfo, logError, logWarn]);

  // --- Siparişi Ödendi Olarak İşaretleme ---
  const markOrderAsPaid = useCallback(async (siparisId, odemeYontemi = null) => {
    logInfo(`💰 Sipariş ${siparisId} ödendi olarak işaretleniyor...`);
    if (!API_BASE) {
      logError("API_BASE tanımlı değil.");
      setError("API adresi tanımlı değil.");
      return;
    }
    setError(null);
    try {
      const payload = odemeYontemi ? { odeme_yontemi: odemeYontemi } : {};
      const response = await axios.post(
        `${API_BASE}/kasa/siparis/${siparisId}/odendi`,
        payload,
        { headers: { Authorization: AUTH_HEADER, "Content-Type": "application/json" } }
      );
      logInfo(`✅ Sipariş ${siparisId} ödendi olarak işaretlendi: ${response.data.message}`);
      // fetchPayableOrders(); // Liste WebSocket ile güncellenecek, ancak hemen de çekilebilir.
    } catch (err) {
      logError(`❌ Sipariş ${siparisId} ödendi olarak işaretlenemedi:`, err);
      handleApiError(err, `Sipariş ${siparisId} ödendi olarak işaretlenemedi`);
    }
  }, [logInfo, logError]);


  // --- API Hata Yönetimi ---
  const handleApiError = (err, defaultMessage) => {
    const errorDetail = err.response?.data?.detail || err.message || "Bilinmeyen hata.";
    if (err.response?.status === 401) {
      setError("Yetki hatası: Lütfen yönetici kimlik bilgilerini kontrol edin (.env).");
    } else {
      setError(`${defaultMessage}: ${errorDetail}`);
    }
  };

  // --- Sepet Parse Etme ---
  const parseOrderBasket = (order) => {
    if (typeof order.sepet === "string") {
      try {
        order.sepet = JSON.parse(order.sepet);
      } catch (e) {
        logWarn(`Sipariş ID ${order.id} için sepet parse edilemedi:`, order.sepet);
        order.sepet = [];
      }
    }
    return order;
  };
  
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
        const wsUrl = `${wsProtocol}//${wsHost}/ws/kasa`; // KASA WebSocket endpoint'i
        logInfo(`📡 Kasa WebSocket bağlantısı deneniyor: ${wsUrl}`);
        wsRef.current = new WebSocket(wsUrl);

        wsRef.current.onopen = () => {
          logInfo("✅ Kasa WebSocket bağlantısı başarılı.");
          setError(null);
          reconnectAttempts = 0;
        };

        wsRef.current.onmessage = (event) => {
          logDebug(`Kasa WS Mesajı Geldi: ${event.data}`);
          try {
            const message = JSON.parse(event.data);
            logInfo(`📥 Kasa WebSocket mesajı alındı: Tip: ${message.type}`);
            if (message.type === "siparis" || message.type === "durum" || message.type === "masa_durum") {
              logInfo("Sipariş veya durum güncellemesi, ödeme bekleyenler listesi yenileniyor...");
              fetchPayableOrders(selectedOrderStatusFilter); // Mevcut filtreyle yenile
              if (tableBill && message.data?.masa === tableBill.masa_id) {
                 logInfo(`Aktif görüntülenen masa (${tableBill.masa_id}) için hesap yenileniyor...`);
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
          if (event.code !== 1000 && event.code !== 1001 && reconnectAttempts < maxReconnectAttempts) {
            const delay = baseReconnectDelay * Math.pow(2, reconnectAttempts) + Math.random() * 100;
            logInfo(`Kasa WS beklenmedik şekilde kapandı, ${delay}ms sonra tekrar denenecek...`);
            setTimeout(connectWebSocket, delay);
            reconnectAttempts++;
          } else if (reconnectAttempts >= maxReconnectAttempts) {
            setError("Kasa sunucu bağlantısı tekrar sağlanamadı. Lütfen sayfayı yenileyin.");
          }
        };
      } catch (error) {
        logError("❌ Kasa WS başlatma kritik hata:", error);
        setError("Kasa sunucu bağlantısı kurulamıyor.");
      }
    };

    const pingInterval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        try {
          wsRef.current.send(JSON.stringify({ type: "ping" }));
          logDebug("Kasa Ping gönderildi.");
        } catch (err) {
          logError("Kasa Ping gönderilemedi:", err);
        }
      } else if (!wsRef.current && API_BASE) { // Sadece API_BASE varsa yeniden bağlanmayı dene
        connectWebSocket();
      }
    }, 20000); // 20 saniyede bir ping

    if (API_BASE) { // Sadece API_BASE tanımlıysa işlemleri başlat
        connectWebSocket();
        fetchPayableOrders(); // İlk yükleme
    }


    return () => {
      clearInterval(pingInterval);
      if (wsRef.current) {
        logInfo("Kasa Component kaldırılıyor, WS kapatılıyor.");
        wsRef.current.close(1000, "Component unmounting");
        wsRef.current = null;
      }
    };
  }, [fetchPayableOrders, fetchTableBill, logInfo, logError, logWarn, logDebug, selectedOrderStatusFilter, tableBill]); // tableBill'i de ekledik

  // --- Zaman Formatlama ---
  const formatTime = useCallback((timeStr) => {
    if (!timeStr) return "-";
    try {
      const date = new Date(timeStr); // API'den gelen ISO formatlı zamanı direkt kullanabilir
      return new Intl.DateTimeFormat("tr-TR", {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: "2-digit", minute: "2-digit", second: "2-digit",
        hour12: false,
      }).format(date);
    } catch {
      return timeStr;
    }
  }, []);

  // --- Sipariş Kartı Rengi ---
  const getStatusColors = useCallback((status) => {
    switch (status?.toLowerCase()) {
      case "bekliyor": return "bg-yellow-100 border-yellow-400";
      case "hazirlaniyor": return "bg-blue-100 border-blue-400";
      case "hazir": return "bg-green-100 border-green-400";
      case "odendi": return "bg-purple-100 border-purple-400"; // Yeni durum
      case "iptal": return "bg-red-100 border-red-400 text-gray-500 line-through";
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

  // --- Sipariş Detaylarını Gösteren Yardımcı Fonksiyon ---
  const renderSingleOrder = (order, isBillItem = false) => {
    if (!order || !order.sepet || !Array.isArray(order.sepet)) {
      logWarn(`Geçersiz sipariş verisi veya sepeti yok: ID ${order?.id}`);
      return <p className="text-red-500">Bu siparişin detayları yüklenemedi.</p>;
    }
    
    let totalAmount = order.sepet.reduce((sum, item) => sum + (item.adet * item.fiyat), 0);
    const cardColors = getStatusColors(order.durum);

    return (
      <div
        key={order.id}
        className={`${cardColors} rounded-xl shadow-md p-4 mb-4 hover:shadow-lg transition-all duration-300 ease-in-out flex flex-col`}
      >
        <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-300/50">
          <p className="font-semibold text-lg">
            Sipariş #{order.id} / <span className="font-bold">Masa: {order.masa}</span>
          </p>
          <span
            className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
              order.durum === "hazir" ? "bg-green-500 text-white" :
              order.durum === "bekliyor" ? "bg-yellow-500 text-white" :
              order.durum === "hazirlaniyor" ? "bg-blue-500 text-white" :
              order.durum === "odendi" ? "bg-purple-500 text-white" :
              "bg-gray-500 text-white"
            }`}
          >
            {order.durum || "Bilinmiyor"}
          </span>
        </div>
        <div className="bg-white/60 rounded p-3 mb-3 flex-grow">
          <ul className="space-y-1.5">
            {order.sepet.map((item, index) => (
              <li key={index} className="flex justify-between items-start text-sm">
                <span className="flex-1 mr-2">• {item.urun}</span>
                <span className="font-semibold text-orange-700">× {item.adet} ({item.fiyat.toFixed(2)} TL)</span>
              </li>
            ))}
          </ul>
        </div>
        {order.istek && (
          <div className="mb-3 p-2 bg-amber-100/80 rounded border border-amber-300 text-amber-800 text-xs italic">
            <span className="font-semibold">Not:</span> {order.istek}
          </div>
        )}
        <p className="font-semibold text-md mb-2">Sipariş Toplamı: {totalAmount.toFixed(2)} TL</p>
        {!isBillItem && order.durum !== "odendi" && order.durum !== "iptal" && (
          <button
            onClick={() => markOrderAsPaid(order.id)}
            className="w-full mt-2 bg-indigo-500 hover:bg-indigo-600 text-white px-3 py-2 rounded-lg text-sm font-semibold transition duration-200 ease-in-out active:scale-95 shadow hover:shadow-md"
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


  // --- Render ---
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100 p-6 text-gray-800 font-sans">
      <h1 className="text-4xl font-bold text-center mb-8 text-indigo-700">💰 Kasa Paneli</h1>

      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded relative mb-4 shadow" role="alert">
          <strong className="font-bold">Hata: </strong>
          <span className="block sm:inline">{error}</span>
          <button onClick={() => setError(null)} className="absolute top-0 bottom-0 right-0 px-4 py-3 text-red-700">X</button>
        </div>
      )}

      {/* Ödeme Bekleyen Siparişler Bölümü */}
      <section className="mb-10 p-6 bg-white rounded-xl shadow-lg">
        <h2 className="text-2xl font-semibold text-purple-700 mb-4">Ödeme Bekleyen Siparişler</h2>
        <div className="flex items-center mb-4">
            <label htmlFor="statusFilter" className="mr-2 font-medium">Duruma Göre Filtrele:</label>
            <select 
                id="statusFilter"
                value={selectedOrderStatusFilter}
                onChange={(e) => setSelectedOrderStatusFilter(e.target.value)}
                className="p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
            >
                <option value="">Tümü (Bekliyor/Hazır)</option>
                <option value="bekliyor">Bekliyor</option>
                <option value="hazir">Hazır</option>
            </select>
            <button 
                onClick={() => fetchPayableOrders()} 
                className="ml-4 bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
            >
                Filtrele/Yenile
            </button>
        </div>
        {loadingPayable ? (
          <div className="text-center p-8 text-purple-600 animate-pulse">Ödeme bekleyen siparişler yükleniyor...</div>
        ) : payableOrders.length === 0 ? (
          <p className="text-gray-500 text-lg">Şu anda ödeme bekleyen sipariş bulunmamaktadır.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {payableOrders.map(order => renderSingleOrder(order, false))}
          </div>
        )}
      </section>

      {/* Masa Hesabı Bölümü */}
      <section className="p-6 bg-white rounded-xl shadow-lg">
        <h2 className="text-2xl font-semibold text-green-700 mb-4">Masa Hesabı</h2>
        <form onSubmit={handleFetchTableBill} className="flex items-end gap-4 mb-6">
          <div>
            <label htmlFor="tableIdInput" className="block text-sm font-medium text-gray-700 mb-1">Masa Numarası:</label>
            <input
              type="text"
              id="tableIdInput"
              value={currentTableId}
              onChange={(e) => setCurrentTableId(e.target.value)}
              placeholder="Örn: Masa-5"
              className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500"
            />
          </div>
          <button
            type="submit"
            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
            disabled={loadingBill}
          >
            {loadingBill ? "Yükleniyor..." : "Hesabı Getir"}
          </button>
        </form>

        {loadingBill && <div className="text-center p-4 text-green-600 animate-pulse">Masa hesabı yükleniyor...</div>}
        
        {tableBill && (
          <div className="mt-4 border-t pt-4">
            <h3 className="text-xl font-semibold text-gray-700 mb-3">
              Masa <span className="text-green-600">{tableBill.masa_id}</span> Detayları
            </h3>
            {tableBill.siparisler && tableBill.siparisler.length > 0 ? (
              <>
                {tableBill.siparisler.map(order => renderSingleOrder(order, true))}
                <div className="mt-6 pt-4 border-t border-gray-300 text-right">
                  <p className="text-2xl font-bold text-green-700">
                    Genel Toplam: {tableBill.toplam_tutar?.toFixed(2) || '0.00'} TL
                  </p>
                </div>
              </>
            ) : (
              <p className="text-gray-500">Bu masa için ödenecek aktif sipariş bulunmuyor.</p>
            )}
          </div>
        )}
        {!loadingBill && tableBill === null && currentTableId && <p className="text-gray-500 mt-4">Masa hesabı getirilmedi veya bulunamadı.</p>}

      </section>
    </div>
  );
}

export default KasaEkrani;