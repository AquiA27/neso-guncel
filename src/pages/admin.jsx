import React, { useState, useEffect } from "react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from "recharts";
import { LogIn, LogOut, Settings2, Save } from "lucide-react";
import { Link } from "react-router-dom";

const API_BASE = process.env.REACT_APP_API_BASE;
const AUTH_HEADER = "Basic " + btoa("admin:admin123");

function AdminPaneli() {
  const [orders, setOrders] = useState([]);
  const [arama, setArama] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(() => localStorage.getItem("adminGiris") === "true");
  const [kullaniciAdi, setKullaniciAdi] = useState("");
  const [sifre, setSifre] = useState("");
  const [ayarlarAcik, setAyarlarAcik] = useState(false);
  const [emojiKullan, setEmojiKullan] = useState(true);
  const [model, setModel] = useState("gpt-3.5-turbo");
  const [hiz, setHiz] = useState(1.2);
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [gunluk, setGunluk] = useState(null);
  const [aylik, setAylik] = useState(null);
  const [yillik, setYillik] = useState([]);
  const [populer, setPopuler] = useState([]);
  const [online, setOnline] = useState(0);

  const girisYap = () => {
    if (kullaniciAdi === "admin" && sifre === "admin123") {
      setIsLoggedIn(true);
      localStorage.setItem("adminGiris", "true");
      verileriGetir();
    } else {
      alert("🔒 Hatalı kullanıcı adı veya şifre");
    }
  };

  const cikisYap = () => {
    localStorage.removeItem("adminGiris");
    setIsLoggedIn(false);
    setOrders([]);
  };

  const verileriGetir = () => {
    fetch(`${API_BASE}/siparisler`, {
      headers: {
        Authorization: AUTH_HEADER,
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Yetkisiz erişim");
        return res.json();
      })
      .then((data) => setOrders(data.orders.reverse()))
      .catch((err) => console.error("Veriler alınamadı:", err));

    fetch(`${API_BASE}/istatistik/gunluk`).then(res => res.json()).then(setGunluk);
    fetch(`${API_BASE}/istatistik/aylik`).then(res => res.json()).then(setAylik);
    fetch(`${API_BASE}/istatistik/yillik`).then(res => res.json()).then(data => {
      const arr = Object.entries(data).map(([tarih, adet]) => ({ tarih, adet }));
      setYillik(arr);
    });
    fetch(`${API_BASE}/istatistik/en-cok-satilan`).then(res => res.json()).then(setPopuler);
    fetch(`${API_BASE}/istatistik/online`).then(res => res.json()).then(data => setOnline(data.count));
  };

  const ayarlariKaydet = () => {
    setKaydediliyor(true);
    fetch(`${API_BASE}/ayarlar`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: AUTH_HEADER,
      },
      body: JSON.stringify({ model, hiz, emojiKullan })
    })
      .then((res) => res.json())
      .then(() => alert("✅ Ayarlar kaydedildi."))
      .catch((err) => alert("Hata oluştu: " + err.message))
      .finally(() => setKaydediliyor(false));
  };

  useEffect(() => {
    if (isLoggedIn) {
      verileriGetir();
      const interval = setInterval(verileriGetir, 3000);
      return () => clearInterval(interval);
    }
  }, [isLoggedIn]);

  const filtrelenmis = orders.filter((o) =>
    o.masa.includes(arama) || o.istek.toLowerCase().includes(arama.toLowerCase())
  );

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 to-purple-200">
        <div className="bg-white shadow-lg p-8 rounded-lg w-full max-w-sm border border-gray-200">
          <h2 className="text-2xl font-bold mb-6 text-center text-gray-800 flex items-center justify-center gap-2">
            <span role="img" aria-label="lock">🔐</span> Admin Girişi
          </h2>
          <input
            type="text"
            placeholder="Kullanıcı Adı"
            value={kullaniciAdi}
            onChange={(e) => setKullaniciAdi(e.target.value)}
            className="w-full p-3 border mb-4 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="password"
            placeholder="Şifre"
            value={sifre}
            onChange={(e) => setSifre(e.target.value)}
            className="w-full p-3 border mb-4 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={girisYap}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded transition flex items-center justify-center gap-2"
          >
            <LogIn size={18} /> Giriş Yap
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 min-h-screen bg-gradient-to-tr from-gray-100 via-blue-100 to-purple-100 text-gray-800 font-sans">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">🛠️ Admin Paneli</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setAyarlarAcik(!ayarlarAcik)}
            className="bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-2 px-3 rounded flex items-center gap-1"
          >
            <Settings2 size={18} /> Ayarlar
          </button>
          <Link
            to="/mutfak"
            className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded"
          >
            👨‍🍳 Mutfak Ekranı
          </Link>
          <button
            onClick={cikisYap}
            className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded flex items-center gap-2"
          >
            <LogOut size={18} /> Çıkış Yap
          </button>
        </div>
      </div>

      {ayarlarAcik && (
        <div className="bg-white p-5 rounded-lg shadow mb-6 border max-w-2xl mx-auto">
          <h3 className="text-xl font-semibold mb-3">🔧 Asistan Ayarları</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label>Ses Hızı:</label>
              <input
                type="number"
                step="0.1"
                min="0.5"
                max="2.0"
                value={hiz}
                onChange={(e) => setHiz(parseFloat(e.target.value))}
                className="border p-1 rounded w-24 text-right"
              />
            </div>
            <div className="flex justify-between items-center">
              <label>Model:</label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="border p-1 rounded"
              >
                <option value="gpt-3.5-turbo">GPT 3.5</option>
                <option value="gpt-4">GPT 4</option>
              </select>
            </div>
            <div className="flex justify-between items-center">
              <label>Emoji Kullan:</label>
              <input
                type="checkbox"
                checked={emojiKullan}
                onChange={(e) => setEmojiKullan(e.target.checked)}
              />
            </div>
            <div className="flex justify-end">
              <button
                onClick={ayarlariKaydet}
                disabled={kaydediliyor}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded flex items-center gap-2"
              >
                <Save size={16} /> {kaydediliyor ? "Kaydediliyor..." : "Kaydet"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Kartlar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8 max-w-6xl mx-auto">
        <div className="bg-white p-5 rounded shadow border text-center">
          <h2 className="text-lg font-semibold text-gray-600 mb-2">📅 Bugünkü Sipariş</h2>
          <p className="text-2xl font-bold text-blue-600">{gunluk?.siparis_sayisi ?? '-'}</p>
        </div>
        <div className="bg-white p-5 rounded shadow border text-center">
          <h2 className="text-lg font-semibold text-gray-600 mb-2">💰 Bugünkü Gelir</h2>
          <p className="text-2xl font-bold text-green-600">₺{gunluk?.gelir ?? '-'}</p>
        </div>
        <div className="bg-white p-5 rounded shadow border text-center">
          <h2 className="text-lg font-semibold text-gray-600 mb-2">🟢 Online Kullanıcı</h2>
          <p className="text-2xl font-bold text-purple-600">{online}</p>
        </div>
      </div>

      {/* Grafikler */}
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white p-4 rounded shadow border">
          <h3 className="text-center text-lg font-semibold mb-4">📈 Yıllık Sipariş Sayısı</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={yillik}>
              <XAxis dataKey="tarih" />
              <YAxis />
              <Tooltip />
              <CartesianGrid stroke="#eee" strokeDasharray="5 5" />
              <Line type="monotone" dataKey="adet" stroke="#3b82f6" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white p-4 rounded shadow border">
          <h3 className="text-center text-lg font-semibold mb-4">🔥 En Çok Satılanlar</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={populer}>
              <XAxis dataKey="urun" />
              <YAxis />
              <Tooltip />
              <CartesianGrid strokeDasharray="3 3" />
              <Bar dataKey="adet" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Sipariş Listesi */}
      <input
        type="text"
        placeholder="🔍 Masa no veya istek ara..."
        value={arama}
        onChange={(e) => setArama(e.target.value)}
        className="block mx-auto w-full max-w-md p-3 mt-10 mb-6 border rounded shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
      />
      {filtrelenmis.length === 0 ? (
        <p className="text-center text-gray-500">📭 Gösterilecek sipariş yok.</p>
      ) : (
        <div className="space-y-5">
          {filtrelenmis.map((o, i) => (
            <div
              key={i}
              className="max-w-2xl mx-auto bg-gradient-to-bl from-white to-blue-50 p-5 rounded-lg shadow border border-gray-200"
            >
              <p className="mb-1"><strong>🪑 Masa:</strong> {o.masa}</p>
              <div className="bg-gray-100 rounded p-3 mb-2">
                <p><strong>🗣️ İstek:</strong> {o.istek}</p>
              </div>
              <div className="bg-blue-100 rounded p-3">
                <p><strong>🤖 Neso:</strong> {o.yanit}</p>
              </div>
              <p className="text-sm text-gray-500 mt-2">⏰ {o.zaman}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default AdminPaneli;
