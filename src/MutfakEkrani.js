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

    fetchOrders(); // İlk açıldığında getir
    const interval = setInterval(fetchOrders, 5000); // Her 5 saniyede bir yenile
    return () => clearInterval(interval); // Sayfa kapanırsa interval iptal
  }, []);

  return (
    <div style={{ textAlign: "center", padding: 50, fontFamily: "Arial" }}>
      <h1>👨‍🍳 Mutfak Sipariş Paneli</h1>
      {orders.length === 0 && <p>Henüz sipariş yok.</p>}
      {orders.map((o, i) => (
        <div
          key={i}
          style={{
            margin: "20px auto",
            maxWidth: 400,
            border: "2px solid #444",
            borderRadius: 10,
            padding: 15,
            textAlign: "left",
            backgroundColor: "#f9f9f9",
            boxShadow: "2px 2px 10px rgba(0,0,0,0.1)",
          }}
        >
          <p><strong>🪑 Masa:</strong> {o.masa}</p>
          <p><strong>🗣️ İstek:</strong> {o.istek}</p>
          <p><strong>🤖 Yanıt:</strong> {o.yanit}</p>
          <p><small>⏰ {o.zaman}</small></p>
        </div>
      ))}
    </div>
  );
}

export default MutfakEkrani;
