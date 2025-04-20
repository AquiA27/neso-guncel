import React, { useState, useEffect } from "react";

const API_BASE = process.env.REACT_APP_API_BASE;
const AUTH_HEADER = "Basic " + btoa("admin:admin123");

function MutfakEkrani() {
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    const fetchOrders = () => {
      fetch(`${API_BASE}/siparisler`, {
        headers: { Authorization: AUTH_HEADER },
      })
        .then((res) => res.json())
        .then((data) => setOrders(data.orders.reverse()))
        .catch((err) => console.error("Siparişler alınamadı", err));
    };

    fetchOrders(); // ilk yüklemede al
    const interval = setInterval(fetchOrders, 20000); // her 20 saniyede bir güncelle
    return () => clearInterval(interval); // component unload olursa temizle
  }, []);

  const handleHazirlaniyor = (masa) => {
    alert(`Masa ${masa} siparişi hazırlanıyor olarak işaretlendi.`);
  };

  const handleIptal = (masa) => {
    alert(`Masa ${masa} siparişi iptal edildi.`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-100 to-orange-200 p-6 text-gray-800 font-sans">
      <h1 className="text-4xl font-bold text-center mb-8">👨‍🍳 Mutfak Sipariş Paneli</h1>

      {orders.length === 0 ? (
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
            }

            return (
              <div
                key={i}
                className="bg-white border border-gray-200 rounded-xl shadow-md p-5 hover:shadow-lg transition-all"
              >
                <p className="font-semibold text-lg mb-2">🪑 Masa: {o.masa}</p>
                {sepet.length > 0 && (
                  <div className="bg-gray-100 rounded p-3 mb-3">
                    <p><strong>🛒 Ürünler:</strong></p>
                    <ul className="list-disc list-inside">
                      {sepet.map((item, index) => (
                        <li key={index}>{item.adet} × {item.urun}</li>
                      ))}
                    </ul>
                  </div>
                )}
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

