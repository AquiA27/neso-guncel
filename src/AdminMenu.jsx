import React, { useEffect, useState } from "react";
import axios from "axios";

const API_BASE = process.env.REACT_APP_API_BASE;

function AdminMenu() {
  const [menu, setMenu] = useState([]);
  const [kategori, setKategori] = useState("");
  const [urun, setUrun] = useState("");
  const [fiyat, setFiyat] = useState("");

  const fetchMenu = async () => {
    const res = await axios.get(`${API_BASE}/menu`);
    setMenu(res.data.menu);
  };

  const urunEkle = async (e) => {
    e.preventDefault();
    await axios.post(`${API_BASE}/menu`, {
      kategori,
      urun,
      fiyat: parseFloat(fiyat)
    });
    setKategori("");
    setUrun("");
    setFiyat("");
    fetchMenu();
  };

  const urunSil = async (id) => {
    await axios.delete(`${API_BASE}/menu/${id}`);
    fetchMenu();
  };

  useEffect(() => {
    fetchMenu();
  }, []);

  return (
    <div className="mt-12">
      <h2 className="text-xl font-bold mb-4">📋 Menü Yönetimi</h2>

      <form onSubmit={urunEkle} className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <input
          className="p-2 border rounded"
          placeholder="Kategori"
          value={kategori}
          onChange={(e) => setKategori(e.target.value)}
          required
        />
        <input
          className="p-2 border rounded"
          placeholder="Ürün Adı"
          value={urun}
          onChange={(e) => setUrun(e.target.value)}
          required
        />
        <input
          className="p-2 border rounded"
          placeholder="Fiyat (₺)"
          value={fiyat}
          onChange={(e) => setFiyat(e.target.value)}
          required
          type="number"
        />
        <button className="bg-green-600 text-white rounded p-2 hover:bg-green-700 transition">
          Ekle
        </button>
      </form>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {menu.map((item) => (
          <div key={item.id} className="border rounded p-4 shadow hover:shadow-md transition">
            <h3 className="text-lg font-semibold">{item.urun}</h3>
            <p className="text-sm text-gray-500">{item.kategori}</p>
            <p className="text-sm text-gray-700 font-medium">{item.fiyat} ₺</p>
            <button
              onClick={() => urunSil(item.id)}
              className="mt-2 bg-red-600 text-white rounded px-3 py-1 hover:bg-red-700 transition"
            >
              Sil
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default AdminMenu;
