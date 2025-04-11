import React, { useState, useEffect } from "react";

// Create React App uyumlu ortam değişkeni
const API_BASE = process.env.REACT_APP_API_BASE;

function AdminPaneli() {
  const [orders, setOrders] = useState([]);
  const [arama, setArama] = useState("");

  useEffect(() => {
    console.log("🌍 API BASE:", API_BASE);
    fetch(`${API_BASE}/siparisler`)
      .then((res) => res.json())
      .then((data) => setOrders(data.orders.reverse()))
      .catch((err) => console.error("Veriler alınamadı", err));
  }, []);

  const filtrelenmis = orders.filter((o) =>
    o.masa.includes(arama) || o.istek.toLowerCase().includes(arama.toLowerCase())
  );

  return (
    <div style={{ textAlign: "center", padding: 50, fontFamily: "Arial" }}>
      <h1>🛠️ Neso - Admin Paneli</h1>
      <input
        type="text"
        placeholder="Masa no veya istek ara..."
        value={arama}
        onChange={(e) => setArama(e.target.value)}
        style={{ padding: 10, fontSize: 16, width: 300 }}
      />
      <br /><br />
      {filtrelenmis.length === 0 && <p>Gösterilecek sipariş yok.</p>}
      {filtrelenmis.map((o, i) => (
        <div
          key={i}
          style={{
            margin: "20px auto",
            maxWidth: 500,
            border: "2px solid #555",
            borderRadius: 10,
            padding: 15,
            textAlign: "left",
            backgroundColor: "#fffdf5",
            boxShadow: "0 0 10px rgba(0,0,0,0.1)",
          }}
        >
          <p><strong>🪑 Masa:</strong> {o.masa}</p>
          <p><strong>🗣️ İstek:</strong> {o.istek}</p>
          <p><strong>🤖 Neso:</strong> {o.yanit}</p>
          <p><small>⏰ {o.zaman}</small></p>
        </div>
      ))}
    </div>
  );
}

export default AdminPaneli;
