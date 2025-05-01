import React, { useState, useEffect } from "react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from "recharts";
import CountUp from "react-countup";
import { UserCheck, Coffee, TrendingUp, Settings, LogOut } from "lucide-react";

const API_BASE = process.env.REACT_APP_API_BASE;
const AUTH_HEADER = "Basic " + btoa("admin:admin123");

function AdminPaneli() {
  const [orders, setOrders] = useState([]);
  const [arama, setArama] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(() => localStorage.getItem("adminGiris") === "true");
  const [kullaniciAdi, setKullaniciAdi] = useState("");
  const [sifre, setSifre] = useState("");
  const [gunluk, setGunluk] = useState({ siparis_sayisi: 0, gelir: 0 });
  const [aylik, setAylik] = useState({ siparis_sayisi: 0, gelir: 0 });
  const [yillik, setYillik] = useState([]);        // [{ tarih, adet }, …]
  const [populer, setPopuler] = useState([]);      // [{ urun, adet }, …]
  const [online, setOnline] = useState(0);
  const [menu, setMenu] = useState([]);            // [{ kategori, urunler: […] }, …]
  const [yeniUrun, setYeniUrun] = useState({ ad: "", fiyat: "", kategori: "" });
  const [silUrunAdi, setSilUrunAdi] = useState("");
  const [yeniKullaniciAdi, setYeniKullaniciAdi] = useState("");
  const [yeniSifre, setYeniSifre] = useState("");
  const [loadingMenuOp, setLoadingMenuOp] = useState(false);
  const [loadingSifreOp, setLoadingSifreOp] = useState(false);

  useEffect(() => {
    document.title = "Admin Paneli - Neso";
  }, []);

  useEffect(() => {
    if (isLoggedIn) verileriGetir();
  }, [isLoggedIn]);

  const girisYap = () => {
    if (kullaniciAdi === "admin" && sifre === "admin123") {
      localStorage.setItem("adminGiris", "true");
      setIsLoggedIn(true);
    } else {
      alert("🔒 Hatalı kullanıcı adı veya şifre");
    }
  };

  async function verileriGetir() {
    try {
      const [sipRes, gunRes, ayRes, yilRes, popRes, onRes, menuRes] = await Promise.all([
        fetch(`${API_BASE}/siparisler`, { headers: { Authorization: AUTH_HEADER }}).then(r=>r.json()),
        fetch(`${API_BASE}/istatistik/gunluk`).then(r=>r.json()),
        fetch(`${API_BASE}/istatistik/aylik`).then(r=>r.json()),
        fetch(`${API_BASE}/istatistik/yillik`).then(r=>r.json()),
        fetch(`${API_BASE}/istatistik/en-cok-satilan`).then(r=>r.json()),
        fetch(`${API_BASE}/istatistik/online`).then(r=>r.json()),
        fetch(`${API_BASE}/menu`).then(r=>r.json())
      ]);

      const menu = Array.isArray(menuRes.menu) ? menuRes.menu.flatMap(k => k.urunler) : [];
      setMenu(menu);

      const orders = Array.isArray(sipRes.orders) ? sipRes.orders.reverse() : [];
      setOrders(orders);

      const gunlukGelir = gelirHesapla(orders.filter(o => o.zaman.startsWith(new Date().toISOString().split("T")[0])), menu);
      const aylikGelir = gelirHesapla(orders, menu); // Aylık veriler için örnek
      setGunluk({ siparis_sayisi: gunRes.siparis_sayisi || 0, gelir: gunlukGelir });
      setAylik({ siparis_sayisi: ayRes.siparis_sayisi || 0, gelir: aylikGelir });

      const yilVerileri = yilRes && typeof yilRes === "object"
        ? Object.entries(yilRes).map(([tarih, adet]) => ({ tarih, adet }))
        : [];
      setYillik(yilVerileri);

      setPopuler(Array.isArray(popRes) ? popRes : []);
      setOnline(onRes.count ?? 0);
    } catch (err) {
      console.error("Veri alınırken hata:", err);
    }
  }

  function gelirHesapla(siparisler, menu) {
    return siparisler.reduce((toplamGelir, siparis) => {
      const sepet = JSON.parse(siparis.sepet || "[]");
      const siparisGeliri = sepet.reduce((gelir, item) => {
        const urun = menu.find(u => u.ad.toLowerCase() === item.urun.toLowerCase());
        if (urun) {
          return gelir + (urun.fiyat * (item.adet || 1));
        }
        return gelir;
      }, 0);
      return toplamGelir + siparisGeliri;
    }, 0);
  }

  const urunEkle = async () => {
    if (!yeniUrun.ad || !yeniUrun.fiyat || !yeniUrun.kategori) {
      return alert("Lütfen tüm alanları doldurun.");
    }
    setLoadingMenuOp(true);
    try {
      await fetch(`${API_BASE}/menu/ekle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(yeniUrun)
      });
      setYeniUrun({ ad: "", fiyat: "", kategori: "" });
      await verileriGetir();
    } catch (e) {
      console.error("Ürün ekleme hatası:", e);
    }
    setLoadingMenuOp(false);
  };

  const urunSil = async () => {
    if (!silUrunAdi) return alert("Silinecek ürün adını girin.");
    setLoadingMenuOp(true);
    try {
      await fetch(`${API_BASE}/menu/sil?urun_adi=${encodeURIComponent(silUrunAdi)}`, { method: "DELETE" });
      setSilUrunAdi("");
      await verileriGetir();
    } catch (e) {
      console.error("Ürün silme hatası:", e);
    }
    setLoadingMenuOp(false);
  };

  const sifreGuncelle = async () => {
    if (!yeniKullaniciAdi || !yeniSifre) {
      return alert("Hem kullanıcı adı hem şifre girmelisiniz.");
    }
    setLoadingSifreOp(true);
    try {
      const res = await fetch(`${API_BASE}/admin/sifre-degistir`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ yeniKullaniciAdi, yeniSifre })
      });
      const { mesaj, hata } = await res.json();
      alert(mesaj || hata || "İşlem tamamlandı.");
      setYeniKullaniciAdi("");
      setYeniSifre("");
    } catch (e) {
      console.error("Şifre güncelleme hatası:", e);
    }
    setLoadingSifreOp(false);
  };

  const cikisYap = () => {
    localStorage.removeItem("adminGiris");
    setIsLoggedIn(false);
  };

  const filtrelenmis = orders.filter(o =>
    o.masa.includes(arama) || o.istek.toLowerCase().includes(arama.toLowerCase())
  );

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-100 to-indigo-100">
        <div className="bg-white shadow-xl p-8 rounded-lg w-full max-w-sm border border-gray-200 animate-fade-in">
          <h2 className="text-2xl font-bold mb-6 text-center text-gray-800 flex items-center justify-center gap-2">
            <span role="img" aria-label="lock">🔐</span> Admin Girişi
          </h2>
          <input type="text" placeholder="Kullanıcı Adı" value={kullaniciAdi}
            onChange={e => setKullaniciAdi(e.target.value)}
            className="w-full p-3 border mb-4 rounded" />
          <input type="password" placeholder="Şifre" value={sifre}
            onChange={e => setSifre(e.target.value)}
            className="w-full p-3 border mb-4 rounded" />
          <button onClick={girisYap}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded active:scale-95 transition">
            Giriş Yap
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 bg-gradient-to-tr from-slate-100 to-slate-200 min-h-screen text-gray-800 font-sans animate-fade-in relative">
      <button onClick={cikisYap}
        className="absolute top-6 right-6 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded shadow flex items-center gap-2">
        <LogOut className="w-4 h-4" /> Çıkış Yap
      </button>

      <h1 className="text-4xl font-bold mb-8 text-center flex justify-center gap-2">
        <Settings className="inline-block w-7 h-7 text-blue-500" /> Admin Paneli
      </h1>

      {/* İstatistik Kartları */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10">
        <StatCard icon={<Coffee className="w-4 h-4" />} label="Bugünkü Sipariş"
          value={gunluk.siparis_sayisi} color="green" />
        <StatCard icon={<TrendingUp className="w-4 h-4" />} label="Bugünkü Gelir"
          prefix="₺" value={gunluk.gelir} color="amber" />
        <StatCard icon={<UserCheck className="w-4 h-4" />} label="Online Kullanıcı"
          value={online} color="red" pulse />
      </div>

      {/* Grafikler */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
        <ChartWrapper title="📈 Yıllık Sipariş">
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={yillik}>
              <XAxis dataKey="tarih" />
              <YAxis />
              <Tooltip />
              <CartesianGrid stroke="#ccc" />
              <Line type="monotone" dataKey="adet" stroke="#3b82f6" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </ChartWrapper>
        <ChartWrapper title="🔥 En Çok Satılanlar">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={populer}>
              <XAxis dataKey="urun" />
              <YAxis />
              <Tooltip />
              <CartesianGrid strokeDasharray="3 3" />
              <Bar dataKey="adet" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </ChartWrapper>
      </div>

      {/* Menü Yönetimi */}
      <section className="bg-white p-6 rounded shadow border mb-10 animate-fade-in">
        <h3 className="text-xl font-bold mb-4">🍽️ Menü Yönetimi</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <input type="text" placeholder="Ürün Adı" value={yeniUrun.ad}
            onChange={e => setYeniUrun({ ...yeniUrun, ad: e.target.value })}
            className="p-2 border rounded" />
          <input type="text" placeholder="Fiyat" value={yeniUrun.fiyat}
            onChange={e => setYeniUrun({ ...yeniUrun, fiyat: e.target.value })}
            className="p-2 border rounded" />
          <input type="text" placeholder="Kategori" value={yeniUrun.kategori}
            onChange={e => setYeniUrun({ ...yeniUrun, kategori: e.target.value })}
            className="p-2 border rounded" />
        </div>
        <button onClick={urunEkle} disabled={loadingMenuOp}
          className="bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 active:scale-95 transition mb-4">
          {loadingMenuOp ? "Ekleniyor…" : "➕ Ürün Ekle"}
        </button>

        <div className="mt-6">
          <input type="text" placeholder="Silinecek ürün adı" value={silUrunAdi}
            onChange={e => setSilUrunAdi(e.target.value)}
            className="p-2 border rounded mr-2" />
          <button onClick={urunSil} disabled={loadingMenuOp}
            className="bg-red-600 text-white py-2 px-4 rounded hover:bg-red-700 active:scale-95 transition">
            {loadingMenuOp ? "Siliniyor…" : "🗑️ Ürün Sil"}
          </button>
        </div>

        {/* Menü Görünümü */}
        {menu.length > 0 && (
          menu.map(({ kategori, urunler }, idx) => (
            <div key={kategori + idx}
              className="bg-blue-50 p-4 rounded-xl shadow-inner mb-6 border border-blue-200">
              <h4 className="font-bold text-xl text-blue-800 mb-3 flex items-center gap-2">
                🍽️ {kategori}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {Array.isArray(urunler) && urunler.map((urun, i) => (
                  <div key={urun.ad + i}
                    className="bg-white rounded-lg p-3 shadow border hover:shadow-md hover:scale-105 transition-transform">
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
          ))
        )}
      </section>

      {/* Şifre Güncelle */}
      <section className="bg-white p-6 rounded shadow border mb-10 animate-fade-in">
        <h3 className="text-xl font-bold mb-4">🔐 Yönetici Bilgilerini Güncelle</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input type="text" placeholder="Yeni Kullanıcı Adı" value={yeniKullaniciAdi}
            onChange={e => setYeniKullaniciAdi(e.target.value)}
            className="p-2 border rounded" />
          <input type="password" placeholder="Yeni Şifre" value={yeniSifre}
            onChange={e => setYeniSifre(e.target.value)}
            className="p-2 border rounded" />
        </div>
        <button onClick={sifreGuncelle} disabled={loadingSifreOp}
          className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 mt-4 active:scale-95 transition">
          {loadingSifreOp ? "Güncelleniyor…" : "🛠️ Bilgileri Güncelle"}
        </button>
      </section>

      {/* Sipariş Arama ve Listeleme */}
      <input type="text" placeholder="🔍 Masa no veya istek ara..." value={arama}
        onChange={e => setArama(e.target.value)}
        className="w-full p-2 border rounded mb-6" />
      {filtrelenmis.length === 0 ? (
        <p className="text-center text-gray-500">📭 Gösterilecek sipariş yok.</p>
      ) : (
        <div className="space-y-5 animate-fade-in">
          {filtrelenmis.map((o, i) => (
            <div key={o.masa + o.zaman + i}
              className="bg-white p-4 rounded shadow border max-w-2xl mx-auto animate-slide-in">
              <p><strong>🪑 Masa:</strong> {o.masa}</p>
              <p><strong>🗣️ İstek:</strong> {o.istek}</p>
              <p><strong>🤖 Neso:</strong> {o.yanit}</p>
              <p className="text-sm text-gray-500">⏰ {o.zaman}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Helper components
function StatCard({ icon, label, value, prefix = "", color = "gray", pulse = false }) {
  const bgFrom = `from-${color}-100`;
  const bgTo = `to-${color}-200`;
  const text = `text-${color}-700`;
  return (
    <div className={`bg-gradient-to-br ${bgFrom} ${bgTo} p-5 rounded-xl shadow-xl text-center hover:scale-105 transform transition duration-300`}>
      <h2 className={`flex justify-center gap-2 items-center text-sm ${text} ${pulse ? "animate-pulse" : ""}`}>
        {icon} {label}
      </h2>
      <p className={`text-3xl font-bold ${text}`}>
        {prefix}<CountUp end={value} duration={1} />
      </p>
    </div>
  );
}
export default AdminPaneli;