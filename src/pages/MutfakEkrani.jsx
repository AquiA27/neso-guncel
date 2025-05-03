import React, { useState, useEffect } from "react";

const API_BASE = process.env.REACT_APP_API_BASE;
const AUTH_HEADER = "Basic " + btoa("admin:admin123");

function MutfakEkrani() {
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    document.title = "Mutfak Paneli - Neso";
  }, []);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const response = await fetch(`${API_BASE}/siparisler`, {
          headers: { Authorization: AUTH_HEADER },
        });
        if (!response.ok) {
          throw new Error("Siparişler alınırken bir hata oluştu.");
        }
        const data = await response.json();
        setOrders(data.orders.reverse());
        setError(null);
      } catch (err) {
        console.error("Siparişler alınamadı:", err);
        setError("Siparişler alınamadı. Lütfen daha sonra tekrar deneyin.");
      }
    };

    fetchOrders(); // İlk yüklemede siparişleri al
    const interval = setInterval(fetchOrders, 20000); // Her 20 saniyede bir güncelle
    return () => clearInterval(interval); // Component unload olursa temizle
  }, []);

  const handleHazirlaniyor = (masa) => {
    alert(`🚀 Masa ${masa} siparişi hazırlanıyor olarak işaretlendi.`);
  };

  const handleIptal = (masa) => {
    alert(`❌ Masa ${masa} siparişi iptal edildi.`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-100 to-orange-200 p-6 text-gray-800 font-sans">
      <h1 className="text-4xl font-bold text-center mb-8">👨‍🍳 Mutfak Sipariş Paneli</h1>

      {error && (
        <p className="text-center text-red-500 mb-4">
          {error}
        </p>
      )}

      {orders.length === 0 && !error ? (
        <p className="text-center text-gray-500">Henüz sipariş yok.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {orders.map((o, i) => {
            let sepet = [];
            try {
              const parsed = JSON.parse(o.sepet || "[]");
              sepet = Array.isArray(parsed) ? parsed.filter((item) => item.urun && item.adet) : [];
            } catch (e) {
              console.error("❌ Sepet verisi çözümlenemedi:", e);
              return (
                <div
                  key={i}
                  className="bg-red-100 border border-red-200 rounded-xl shadow-md p-5"
                >
                  <p className="text-red-600">Sipariş verisi çözümlenemedi.</p>
                </div>
              );
            }

            if (sepet.length === 0) return null; // Boş sepetli kartları gösterme

            return (
              <div
                key={i}
                className="bg-white border border-gray-200 rounded-xl shadow-md p-5 hover:shadow-lg transition-all"
              >
                <p className="font-semibold text-lg mb-2">🪑 Masa: {o.masa}</p>
                <div className="bg-gray-100 rounded p-3 mb-3">
                  <p><strong>🛒 Ürünler:</strong></p>
                  <ul className="list-disc list-inside">
                    {sepet.map((item, index) => (
                      <li key={index}>{item.adet} × {item.urun}</li>
                    ))}
                  </ul>
                </div>
                <div className="flex justify-between mt-3">
                  <button
                    onClick={() => handleHazirlaniyor(o.masa)}
                    className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm"
                  >
                    ✅ Hazırlanıyor
                  </button>
                  <button
                    onClick={() => handleIptal(o.masa)}
                    className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm"
                  >
                    ❌ İptal Et
                  </button>
                </div>
                <p className="text-sm text-right text-gray-500 mt-2">⏰ {o.zaman}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default MutfakEkrani;