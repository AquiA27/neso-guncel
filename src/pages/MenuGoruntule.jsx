import React, { useEffect, useState } from "react";
import axios from "axios";

const API_BASE = process.env.REACT_APP_API_BASE;

function MenuGoruntule() {
  const [menu, setMenu] = useState([]);
  const [aktifKategori, setAktifKategori] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios
      .get(`${API_BASE}/menu`)
      .then((res) => {
        if (Array.isArray(res.data.menu)) {
          const duzMenu = res.data.menu.flatMap((k) =>
            k.urunler.map((u) => ({
              urun: u.ad,
              fiyat: u.fiyat,
              kategori: k.kategori,
            }))
          );
          setMenu(duzMenu);
        } else {
          console.error("Beklenmeyen menü formatı:", res.data);
        }
      })
      .catch((err) => console.error("Menü verisi alınamadı:", err))
      .finally(() => setLoading(false));
  }, []);

  const kategoriler = [...new Set(menu.map((item) => item.kategori))];

  const filtreliMenu = aktifKategori
    ? menu.filter((item) => item.kategori === aktifKategori)
    : menu;

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-600 via-pink-500 to-red-400 text-white p-6">
      <h1 className="text-4xl font-bold text-center mb-6">📋 Menü</h1>

      {loading ? (
        <p className="text-center text-white text-lg animate-pulse">Yükleniyor...</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-3 justify-center mb-6">
            {kategoriler.map((kategori) => (
              <button
                key={kategori}
                onClick={() => setAktifKategori(kategori)}
                className={`px-4 py-2 rounded-full text-sm font-semibold border border-white/40 transition ${
                  aktifKategori === kategori
                    ? "bg-white text-black"
                    : "bg-white/20 hover:bg-white/30"
                }`}
              >
                {kategori}
              </button>
            ))}

            <button
              onClick={() => setAktifKategori(null)}
              className={`px-4 py-2 rounded-full text-sm font-semibold border border-white/40 transition ${
                aktifKategori === null
                  ? "bg-white text-black"
                  : "bg-red-400 hover:bg-red-500"
              }`}
            >
              Tümünü Göster
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {filtreliMenu.map((item, i) => (
              <div
                key={i}
                className="bg-white/10 backdrop-blur-md p-4 rounded-xl shadow-xl border border-white/20"
              >
                <h3 className="text-xl font-semibold mb-1">{item.urun}</h3>
                <p className="text-sm opacity-80">{item.kategori}</p>
                <p className="mt-2 text-lg font-bold">{parseFloat(item.fiyat).toFixed(2)} ₺</p>
              </div>
            ))}
          </div>

          {filtreliMenu.length === 0 && (
            <p className="text-center mt-10 opacity-80">
              Bu kategoride ürün bulunamadı.
            </p>
          )}
        </>
      )}
    </div>
  );
}

export default MenuGoruntule;
