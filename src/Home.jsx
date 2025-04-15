import React, { useEffect, useState } from "react";
import axios from "axios";

function MenuGoruntule() {
  const [menu, setMenu] = useState([]);

  useEffect(() => {
    axios
      .get(`${process.env.REACT_APP_API_BASE}/menu`)
      .then((res) => setMenu(res.data.menu))
      .catch((err) => console.error("Menü alınamadı:", err));
  }, []);

  const kategoriler = [...new Set(menu.map((item) => item.kategori))];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 to-indigo-800 text-white px-6 py-10">
      <h1 className="text-3xl font-bold text-center mb-8">📋 Menü</h1>

      {kategoriler.map((kategori) => (
        <div key={kategori} className="mb-6">
          <h2 className="text-xl font-semibold mb-2 border-b border-white/30 pb-1">{kategori}</h2>
          <ul className="grid gap-2">
            {menu
              .filter((item) => item.kategori === kategori)
              .map((urun) => (
                <li
                  key={urun.id}
                  className="flex justify-between bg-white/10 rounded-xl px-4 py-2"
                >
                  <span>{urun.urun}</span>
                  <span>{urun.fiyat.toFixed(2)} ₺</span>
                </li>
              ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export default MenuGoruntule;
