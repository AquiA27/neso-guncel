import React, { useState, useEffect, useRef } from "react";
import axios from "axios";

const API_BASE = process.env.REACT_APP_API_BASE;
const AUTH_HEADER = "Basic " + btoa("admin:admin123");

function MutfakEkrani() {
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState(null);
  const wsRef = useRef(null);
  const audioRef = useRef(new Audio("/notification.mp3")); // Sesli bildirim için

  // Başlık
  useEffect(() => {
    document.title = "Mutfak Paneli - Neso";
  }, []);

  // WebSocket bağlantısı
  useEffect(() => {
    const connectWebSocket = () => {
      try {
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsHost = API_BASE.replace('https://', '').replace('http://', '');
        const wsUrl = `${wsProtocol}//${wsHost}/ws/mutfak`;
        
        console.log("📡 WebSocket bağlantısı deneniyor:", wsUrl);
        
        wsRef.current = new WebSocket(wsUrl);
        
        wsRef.current.onopen = () => {
          console.log("✅ WebSocket bağlantısı başarılı");
        };

        wsRef.current.onmessage = (event) => {
          const data = JSON.parse(event.data);
          if (data.type === 'siparis') {
            // Yeni sipariş geldiğinde sesli bildirim ver
            audioRef.current.play().catch(console.error);
            // Siparişleri güncelle
            fetchOrders();
          }
        };

        wsRef.current.onerror = (error) => {
          console.error("❌ WebSocket hatası:", error);
          setTimeout(connectWebSocket, 5000);
        };

        wsRef.current.onclose = (event) => {
          console.log("🔌 WebSocket bağlantısı kapandı", event.code);
          if (event.code !== 1000) {
            setTimeout(connectWebSocket, 5000);
          }
        };

        // Ping/Pong ile bağlantıyı canlı tut
        const pingInterval = setInterval(() => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'ping' }));
          }
        }, 30000);

        return () => clearInterval(pingInterval);
      } catch (error) {
        console.error("❌ WebSocket bağlantı hatası:", error);
        setTimeout(connectWebSocket, 5000);
      }
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close(1000, "Component unmounting");
      }
    };
  }, []);

  // Siparişleri getir
  const fetchOrders = async () => {
    try {
      const response = await axios.get(`${API_BASE}/siparisler`, {
        headers: { Authorization: AUTH_HEADER }
      });
      
      setOrders(response.data.orders.reverse());
      setError(null);
    } catch (err) {
      console.error("❌ Siparişler alınamadı:", err);
      setError("Siparişler alınamadı. Lütfen daha sonra tekrar deneyin.");
    }
  };

  // İlk yükleme ve periyodik güncelleme
  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 20000);
    return () => clearInterval(interval);
  }, []);

  // Sipariş durumu güncelleme
  const updateOrderStatus = async (masa, durum) => {
    try {
      await axios.post(
        `${API_BASE}/siparis-guncelle`,
        { masa, durum },
        { headers: { 
          Authorization: AUTH_HEADER,
          'Content-Type': 'application/json'
        }}
      );
      
      // Başarılı güncelleme sonrası
      fetchOrders();
      
      // WebSocket üzerinden masaya bildirim gönder
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'durum',
          data: { masa, durum }
        }));
      }
      
    } catch (error) {
      console.error("❌ Sipariş güncellenemedi:", error);
      alert("Sipariş durumu güncellenirken bir hata oluştu!");
    }
  };

  const handleHazirlaniyor = (masa) => {
    updateOrderStatus(masa, "hazirlaniyor");
  };

  const handleHazir = (masa) => {
    updateOrderStatus(masa, "hazir");
  };

  const handleIptal = (masa) => {
    if (window.confirm(`${masa} numaralı masa siparişini iptal etmek istediğinize emin misiniz?`)) {
      updateOrderStatus(masa, "iptal");
    }
  };

  const formatTime = (timeStr) => {
    try {
      const date = new Date(timeStr);
      return new Intl.DateTimeFormat('tr-TR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }).format(date);
    } catch {
      return timeStr;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-100 to-orange-200 p-6 text-gray-800 font-sans">
      <h1 className="text-4xl font-bold text-center mb-8">👨‍🍳 Mutfak Sipariş Paneli</h1>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
          <span className="block sm:inline">{error}</span>
        </div>
      )}

      {orders.length === 0 && !error ? (
        <div className="text-center p-8 bg-white rounded-xl shadow">
          <p className="text-gray-500">📭 Henüz bekleyen sipariş yok.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {orders.map((order, i) => {
            let sepet = [];
            try {
              const parsed = JSON.parse(order.sepet || "[]");
              sepet = Array.isArray(parsed) ? parsed.filter(item => item.urun && item.adet) : [];
            } catch (e) {
              console.error("❌ Sepet verisi çözümlenemedi:", e);
              return null;
            }

            if (sepet.length === 0) return null;

            const statusColors = {
              bekliyor: "bg-yellow-100 border-yellow-200",
              hazirlaniyor: "bg-blue-100 border-blue-200",
              hazir: "bg-green-100 border-green-200",
              iptal: "bg-red-100 border-red-200"
            };

            return (
              <div
                key={i}
                className={`${statusColors[order.durum || 'bekliyor']} border rounded-xl shadow-md p-5 hover:shadow-lg transition-all`}
              >
                <div className="flex justify-between items-center mb-3">
                  <p className="font-semibold text-lg">🪑 Masa: {order.masa}</p>
                  <span className={`px-2 py-1 rounded-full text-sm ${
                    order.durum === 'hazir' ? 'bg-green-500 text-white' :
                    order.durum === 'hazirlaniyor' ? 'bg-blue-500 text-white' :
                    order.durum === 'iptal' ? 'bg-red-500 text-white' :
                    'bg-yellow-500 text-white'
                  }`}>
                    {order.durum || 'Bekliyor'}
                  </span>
                </div>

                <div className="bg-white/50 rounded p-3 mb-3">
                  <p className="font-medium mb-2">🛒 Sipariş:</p>
                  <ul className="space-y-1">
                    {sepet.map((item, index) => (
                      <li key={index} className="flex justify-between items-center">
                        <span>• {item.adet} × {item.urun}</span>
                        {item.kategori && (
                          <span className="text-xs bg-white/50 px-2 py-1 rounded">
                            {item.kategori}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>

                {order.durum !== 'iptal' && order.durum !== 'hazir' && (
                  <div className="flex gap-2 mt-3">
                    {order.durum !== 'hazirlaniyor' && (
                      <button
                        onClick={() => handleHazirlaniyor(order.masa)}
                        className="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm transition"
                      >
                        🔵 Hazırlanıyor
                      </button>
                    )}
                    
                    {order.durum === 'hazirlaniyor' && (
                      <button
                        onClick={() => handleHazir(order.masa)}
                        className="flex-1 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm transition"
                      >
                        ✅ Hazır
                      </button>
                    )}
                    
                    <button
                      onClick={() => handleIptal(order.masa)}
                      className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm transition"
                    >
                      ❌ İptal
                    </button>
                  </div>
                )}

                <div className="flex justify-between items-center mt-3 text-sm text-gray-500">
                  <span>⏱️ {formatTime(order.zaman)}</span>
                  {order.istek && (
                    <span className="text-xs bg-white/50 px-2 py-1 rounded" title={order.istek}>
                      💬 Not
                    </span>
                  )}
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