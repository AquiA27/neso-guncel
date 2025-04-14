import React, { useEffect, useState } from "react";
import axios from "axios";

function Menu() {
  const [menu, setMenu] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios
      .get("https://neso-backend-clean-v2.onrender.com/menu")
      .then((res) => {
        setMenu(res.data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Menü alınamadı:", err);
        setLoading(false);
      });
  }, []);

  if (loading) return <p className="text-center mt-10">Yükleniyor...</p>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 min-h-screen bg-gradient-to-b from-white via-blue-50 to-purple-100">
      <h1 className="text-3xl font-bold text-center mb-8">📋 Menü</h1>
      {menu.map((kategori) => (
        <div key={kategori.kategori} className="mb-10">
          <h2 className="text-xl font-semibold border-b border-blue-300 mb-4 pb-1">{kategori.kategori}</h2>
          <ul className="space-y-2">
            {kategori.urunler.map((urun, i) => (
              <li
                key={i}
                className="flex justify-between items-center bg-white shadow-sm rounded-md p-3 hover:shadow-md transition"
              >
                <span className="text-gray-700">{urun.ad}</span>
                <span className="font-medium text-gray-800">{urun.fiyat} ₺</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export default Menu;
