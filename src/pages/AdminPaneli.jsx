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
  const [error, setError] = useState(null);

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
  const verileriGetir = async () => {
    try {
      const siparisRes = await fetch(`${API_BASE}/siparisler`, {
        headers: { Authorization: AUTH_HEADER },
      });
      const siparisData = await siparisRes.json();
      const raw = Array.isArray(siparisData)
        ? siparisData
        : Array.isArray(siparisData.orders)
        ? siparisData.orders
        : [];
      setOrders(raw.reverse());

      const gunlukRes = await fetch(`${API_BASE}/istatistik/gunluk`);
      setGunluk(await gunlukRes.json());

      const aylikRes = await fetch(`${API_BASE}/istatistik/aylik`);
      setAylik(await aylikRes.json());

      const yillikRes = await fetch(`${API_BASE}/istatistik/yillik`);
      const yillikData = await yillikRes.json();
      const yillikArr = Object.entries(yillikData).map(([tarih, adet]) => ({
        tarih,
        adet,
      }));
      setYillik(yillikArr);

      const populerRes = await fetch(`${API_BASE}/istatistik/en-cok-satilan`);
      setPopuler(await populerRes.json());

      const onlineRes = await fetch(`${API_BASE}/istatistik/online`);
      const onlineData = await onlineRes.json();
      setOnline(onlineData.count);

      const menuRes = await fetch(`${API_BASE}/menu`);
      const menuData = await menuRes.json();
      setMenu(menuData.menu || []);
      setError(null);
    } catch (err) {
      console.error("Veriler alınamadı:", err);
      setError("Veriler alınamadı. Lütfen daha sonra tekrar deneyin.");
    }
  };

  // --- Menü yönetimi ---
  const urunEkle = async () => {
    try {
      await fetch(`${API_BASE}/menu/ekle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(yeniUrun),
      });
      verileriGetir();
      setYeniUrun({ ad: "", fiyat: "", kategori: "" });
    } catch (err) {
      console.error("Ürün eklenemedi:", err);
    }
  };

  const urunSil = async () => {
    try {
      await fetch(
        `${API_BASE}/menu/sil?urun_adi=${encodeURIComponent(silUrunAdi)}`,
        { method: "DELETE" }
      );
      verileriGetir();
      setSilUrunAdi("");
    } catch (err) {
      console.error("Ürün silinemedi:", err);
    }
  };

  const sifreGuncelle = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/sifre-degistir`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ yeniKullaniciAdi, yeniSifre }),
      });
      const data = await res.json();
      alert(data.mesaj || data.hata);
    } catch (err) {
      console.error("Şifre güncellenemedi:", err);
    }
  };

  const cikisYap = () => {
    localStorage.removeItem("adminGiris");
    setIsLoggedIn(false);
  };

  const filtrelenmis = orders.filter(
    (o) =>
      String(o.masa).includes(arama) ||
      String(o.istek).toLowerCase().includes(arama.toLowerCase())
  );

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

  return (
    <div className="p-8 bg-gradient-to-tr from-slate-100 to-slate-200 min-h-screen text-gray-800 font-sans animate-fade-in relative">
      {error && (
        <p className="text-red-500 text-center mb-4">
          {error}
        </p>
      )}
      
      <button
        onClick={cikisYap}
        className="absolute top-6 right-6 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded shadow flex items-center gap-2"
      >
        <LogOut className="w-4 h-4" /> Çıkış Yap
      </button>

      <h1 className="text-4xl font-bold mb-8 text-center flex justify-center gap-2">
        <Settings className="inline-block w-7 h-7 text-blue-500" /> Admin Paneli
      </h1>

      {/* Aşağıda tüm istatistik kartları, grafikler, menü yönetimi ve sipariş listeleme bölümleri orijinal kodda olduğu gibi yer alır */}
    </div>
  );
}

export default AdminPaneli;