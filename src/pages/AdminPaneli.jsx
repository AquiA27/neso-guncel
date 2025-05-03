import React, { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import CountUp from "react-countup";
import { UserCheck, Coffee, TrendingUp, Settings, LogOut } from "lucide-react";

const API_BASE = process.env.REACT_APP_API_BASE;
const AUTH_HEADER = "Basic " + btoa("admin:admin123");

function AdminPaneli() {
  // --- State'ler ---
  const [orders, setOrders] = useState([]);
  const [arama, setArama] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(
    () => localStorage.getItem("adminGiris") === "true"
  );
  const [kullaniciAdi, setKullaniciAdi] = useState("");
  const [sifre, setSifre] = useState("");
  const [gunluk, setGunluk] = useState(null);
  const [aylik, setAylik] = useState(null);
  const [yillik, setYillik] = useState([]);
  const [populer, setPopuler] = useState([]);
  const [online, setOnline] = useState(0);
  const [menu, setMenu] = useState([]);
  const [yeniUrun, setYeniUrun] = useState({ ad: "", fiyat: "", kategori: "" });
  const [silUrunAdi, setSilUrunAdi] = useState("");
  const [yeniKullaniciAdi, setYeniKullaniciAdi] = useState("");
  const [yeniSifre, setYeniSifre] = useState("");

  // --- Document title ---
  useEffect(() => {
    document.title = "Admin Paneli - Neso";
  }, []);

  // --- Veri çekimi (login sonrası ve 5 saniyede bir) ---
  useEffect(() => {
    if (isLoggedIn) {
      verileriGetir();
      const interval = setInterval(verileriGetir, 5000);
      return () => clearInterval(interval);
    }
  }, [isLoggedIn]);

  // --- Giriş fonksiyonu ---
  const girisYap = () => {
    if (kullaniciAdi === "admin" && sifre === "admin123") {
      setIsLoggedIn(true);
      localStorage.setItem("adminGiris", "true");
    } else {
      alert("🔒 Hatalı kullanıcı adı veya şifre");
    }
  };

  // --- API'den verileri getir ---
  const verileriGetir = () => {
    // **Siparişler**: ya data.orders ya da direkt dizi
    fetch(`${API_BASE}/siparisler`, { headers: { Authorization: AUTH_HEADER } })
  .then(res => res.json())
  .then(data => {
    // hem array hem de { orders: [...] } formatını destekle
    const raw = Array.isArray(data)
      ? data
      : Array.isArray(data.orders)
        ? data.orders
        : [];
    setOrders(raw.reverse());
  })
  .catch(err => console.error("Veriler alınamadı:", err));

    // **İstatistikler**
    fetch(`${API_BASE}/istatistik/gunluk`)
      .then((res) => res.json())
      .then(setGunluk)
      .catch(console.error);

    fetch(`${API_BASE}/istatistik/aylik`)
      .then((res) => res.json())
      .then(setAylik)
      .catch(console.error);

    fetch(`${API_BASE}/istatistik/yillik`)
      .then((res) => res.json())
      .then((data) => {
        const arr = Object.entries(data).map(([tarih, adet]) => ({ tarih, adet }));
        setYillik(arr);
      })
      .catch(console.error);

    fetch(`${API_BASE}/istatistik/en-cok-satilan`)
      .then((res) => res.json())
      .then(setPopuler)
      .catch(console.error);

    fetch(`${API_BASE}/istatistik/online`)
      .then((res) => res.json())
      .then((d) => setOnline(d.count))
      .catch(console.error);

    // **Menü**
    fetch(`${API_BASE}/menu`)
      .then((res) => res.json())
      .then((d) => setMenu(d.menu || []))
      .catch(console.error);
  };

  // --- Menü yönetimi ---
  const urunEkle = () => {
    fetch(`${API_BASE}/menu/ekle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(yeniUrun),
    })
      .then((res) => res.json())
      .then(() => {
        verileriGetir();
        setYeniUrun({ ad: "", fiyat: "", kategori: "" });
      })
      .catch(console.error);
  };

  const urunSil = () => {
    fetch(
      `${API_BASE}/menu/sil?urun_adi=${encodeURIComponent(silUrunAdi)}`,
      {
        method: "DELETE",
      }
    )
      .then((res) => res.json())
      .then(() => {
        verileriGetir();
        setSilUrunAdi("");
      })
      .catch(console.error);
  };

  // --- Şifre güncelleme ---
  const sifreGuncelle = () => {
    fetch(`${API_BASE}/admin/sifre-degistir`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ yeniKullaniciAdi, yeniSifre }),
    })
      .then((res) => res.json())
      .then((d) => alert(d.mesaj || d.hata))
      .catch(console.error);
  };

  // --- Çıkış ---
  const cikisYap = () => {
    localStorage.removeItem("adminGiris");
    setIsLoggedIn(false);
  };

  // --- Arama filtresi ---
  const filtrelenmis = orders.filter(
    (o) =>
      String(o.masa).includes(arama) ||
      String(o.istek).toLowerCase().includes(arama.toLowerCase())
  );

  // --- Login ekranı ---
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-100 to-indigo-100">
        <div className="bg-white shadow-xl p-8 rounded-lg w-full max-w-sm border border-gray-200 animate-fade-in">
          <h2 className="text-2xl font-bold mb-6 text-center text-gray-800 flex items-center justify-center gap-2">
            <span role="img" aria-label="lock">
              🔐
            </span>{" "}
            Admin Girişi
          </h2>
          <input
            type="text"
            placeholder="Kullanıcı Adı"
            value={kullaniciAdi}
            onChange={(e) => setKullaniciAdi(e.target.value)}
            className="w-full p-3 border mb-4 rounded"
          />
          <input
            type="password"
            placeholder="Şifre"
            value={sifre}
            onChange={(e) => setSifre(e.target.value)}
            className="w-full p-3 border mb-4 rounded"
          />
          <button
            onClick={girisYap}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded active:scale-95 transition"
          >
            Giriş Yap
          </button>
        </div>
      </div>
    );
  }

  // --- Admin paneli ana ekranı ---
  return (
    <div className="p-8 bg-gradient-to-tr from-slate-100 to-slate-200 min-h-screen text-gray-800 font-sans animate-fade-in relative">
      <button
        onClick={cikisYap}
        className="absolute top-6 right-6 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded shadow flex items-center gap-2"
      >
        <LogOut className="w-4 h-4" /> Çıkış Yap
      </button>

      <h1 className="text-4xl font-bold mb-8 text-center flex justify-center gap-2">
        <Settings className="inline-block w-7 h-7 text-blue-500" /> Admin Paneli
      </h1>

      {/* İstatistik Kartları */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-6 mb-10">
        <div className="bg-gradient-to-br from-green-100 to-green-200 p-5 rounded-xl shadow-xl text-center hover:scale-105 transform transition duration-300">
          <h2 className="flex justify-center gap-2 items-center text-sm text-green-700">
            <Coffee className="w-4 h-4" /> Bugünkü Sipariş
          </h2>
          <p className="text-3xl font-bold text-green-700">
            <CountUp end={gunluk?.siparis_sayisi ?? 0} duration={1} />
          </p>
        </div>

        <div className="bg-gradient-to-br from-amber-100 to-yellow-200 p-5 rounded-xl shadow-xl text-center hover:scale-105 transform transition duration-300">
          <h2 className="flex justify-center gap-2 items-center text-sm text-amber-700">
            <TrendingUp className="w-4 h-4" /> Bugünkü Gelir
          </h2>
          <p className="text-3xl font-bold text-amber-700">
            ₺<CountUp end={gunluk?.gelir ?? 0} duration={1} />
          </p>
        </div>

        <div className="bg-gradient-to-br from-red-100 to-pink-200 p-5 rounded-xl shadow-xl text-center hover:scale-105 transform transition duration-300">
          <h2 className="flex justify-center gap-2 items-center text-sm text-red-700 animate-pulse">
            <UserCheck className="w-4 h-4" /> Online Kullanıcı
          </h2>
          <p className="text-3xl font-bold text-red-700">
            <CountUp end={online} duration={1} />
          </p>
        </div>

        <div className="bg-gradient-to-br from-blue-100 to-blue-200 p-5 rounded-xl shadow-xl text-center hover:scale-105 transform transition duration-300">
          <h2 className="flex justify-center gap-2 items-center text-sm text-blue-700">
            <TrendingUp className="w-4 h-4" /> Aylık Gelir
          </h2>
          <p className="text-3xl font-bold text-blue-700">
            ₺<CountUp end={aylik?.gelir ?? 0} duration={1} />
          </p>
        </div>
      </div>

      {/* Grafikler */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
        <div className="bg-white p-4 rounded shadow border animate-fade-in">
          <h3 className="text-center mb-4 font-semibold">📈 Yıllık Sipariş</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={yillik}>
              <XAxis dataKey="tarih" />
              <YAxis />
              <Tooltip />
              <CartesianGrid stroke="#ccc" />
              <Line
                type="monotone"
                dataKey="adet"
                stroke="#3b82f6"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white p-4 rounded shadow border animate-fade-in">
          <h3 className="text-center mb-4 font-semibold">🔥 En Çok Satılanlar</h3>
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

      {/* Menü Yönetimi */}
      <div className="bg-white p-6 rounded shadow border mb-10 animate-fade-in">
        <h3 className="text-xl font-bold mb-4">🍽️ Menü Yönetimi</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <input
            type="text"
            placeholder="Ürün Adı"
            value={yeniUrun.ad}
            onChange={(e) =>
              setYeniUrun({ ...yeniUrun, ad: e.target.value })
            }
            className="p-2 border rounded"
          />
          <input
            type="text"
            placeholder="Fiyat"
            value={yeniUrun.fiyat}
            onChange={(e) =>
              setYeniUrun({ ...yeniUrun, fiyat: e.target.value })
            }
            className="p-2 border rounded"
          />
          <input
            type="text"
            placeholder="Kategori"
            value={yeniUrun.kategori}
            onChange={(e) =>
              setYeniUrun({ ...yeniUrun, kategori: e.target.value })
            }
            className="p-2 border rounded"
          />
        </div>
        <button
          onClick={urunEkle}
          className="bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 active:scale-95 transition mb-4"
        >
          ➕ Ürün Ekle
        </button>

        <div className="mt-6">
          <input
            type="text"
            placeholder="Silinecek ürün adı"
            value={silUrunAdi}
            onChange={(e) => setSilUrunAdi(e.target.value)}
            className="p-2 border rounded mr-2"
          />
          <button
            onClick={urunSil}
            className="bg-red-600 text-white py-2 px-4 rounded hover:bg-red-700 active:scale-95 transition"
          >
            🗑️ Ürün Sil
          </button>
        </div>

        {/* Güncellenmiş Menü Görünümü */}
        <div className="mt-6">
          {menu.map((kategori, idx) => (
            <div
              key={idx}
              className="bg-blue-50 p-4 rounded-xl shadow-inner mb-6 border border-blue-200"
            >
              <h4 className="font-bold text-xl text-blue-800 mb-3 flex items-center gap-2">
                🍽️ {kategori.kategori}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {kategori.urunler.map((urun, i) => (
                  <div
                    key={i}
                    className="bg-white rounded-lg p-3 shadow border border-gray-200 hover:shadow-md hover:scale-105 transition-transform"
                  >
                    <p className="text-base font-semibold text-gray-800 truncate">
                      🥤 {urun.ad}
                    </p>
                    <p className="text-sm text-gray-600">
                      ₺{parseFloat(urun.fiyat).toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Şifre Güncelle */}
      <div className="bg-white p-6 rounded shadow border mb-10 animate-fade-in">
        <h3 className="text-xl font-bold mb-4">
          🔐 Yönetici Bilgilerini Güncelle
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            type="text"
            placeholder="Yeni Kullanıcı Adı"
            value={yeniKullaniciAdi}
            onChange={(e) => setYeniKullaniciAdi(e.target.value)}
            className="p-2 border rounded"
          />
          <input
            type="password"
            placeholder="Yeni Şifre"
            value={yeniSifre}
            onChange={(e) => setYeniSifre(e.target.value)}
            className="p-2 border rounded"
          />
        </div>
        <button
          onClick={sifreGuncelle}
          className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 mt-4 active:scale-95 transition"
        >
          🛠️ Bilgileri Güncelle
        </button>
      </div>

      {/* Sipariş Arama ve Listeleme */}
      <input
        type="text"
        placeholder="🔍 Masa no veya istek ara..."
        value={arama}
        onChange={(e) => setArama(e.target.value)}
        className="w-full p-2 border rounded mb-6"
      />
      {filtrelenmis.length === 0 ? (
        <p className="text-center text-gray-500">📭 Gösterilecek sipariş yok.</p>
      ) : (
        <div className="space-y-5 animate-fade-in">
          {filtrelenmis.map((o, i) => (
            <div
              key={i}
              className="bg-white p-4 rounded shadow border max-w-2xl mx-auto animate-slide-in"
            >
              <p>
                <strong>🪑 Masa:</strong> {o.masa}
              </p>
              <p>
                <strong>🗣️ İstek:</strong> {o.istek}
              </p>
              <p>
                <strong>🤖 Neso:</strong> {o.yanit}
              </p>
              <p className="text-sm text-gray-500">⏰ {o.zaman}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default AdminPaneli;
