import React, { useState, useEffect } from "react";

const API_BASE = process.env.REACT_APP_API_BASE;

function MutfakEkrani() {
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    const fetchOrders = () => {
      fetch(`${API_BASE}/siparisler`)
        .then((res) => res.json())
        .then((data) => setOrders(data.orders.reverse()))
        .catch((err) => console.error("Siparişler alınamadı", err));
    };

    fetchOrders();
    const interval = setInterval(fetchOrders, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-100 to-orange-200 p-6 text-gray-800 font-sans">
      <h1 className="text-4xl font-bold text-center mb-8">👨‍🍳 Mutfak Sipariş Paneli</h1>

      {orders.length === 0 ? (
        <p className="text-center text-gray-500">Henüz sipariş yok.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {orders.map((o, i) => (
            <div
              key={i}
              className="bg-white border border-gray-200 rounded-xl shadow-md p-5 hover:shadow-lg transition-all"
            >
              <p className="font-semibold text-lg mb-2">🪑 Masa: {o.masa}</p>
              <div className="bg-gray-100 rounded p-3 mb-3">
                <p><strong>🗣️ İstek:</strong> {o.istek}</p>
              </div>
              <div className="bg-blue-100 rounded p-3">
                <p><strong>🤖 Yanıt:</strong> {o.yanit}</p>
              </div>
              <p className="text-sm text-right text-gray-500 mt-2">⏰ {o.zaman}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default MutfakEkrani;
