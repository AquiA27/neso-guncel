import React, { useState, useEffect, useRef } from "react";
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
import axios from "axios";

const API_BASE = process.env.REACT_APP_API_BASE;
const AUTH_HEADER = "Basic " + btoa("admin:admin123");

function AdminPaneli() {
  // State'ler
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
  const wsRef = useRef(null);

  // Document title
  useEffect(() => {
    document.title = "Admin Paneli - Neso";
  }, []);

  // WebSocket bağlantısı
  useEffect(() => {
    if (isLoggedIn) {
      const connectWebSocket = () => {
        try {
          const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
          const wsHost = API_BASE.replace('https://', '').replace('http://', '');
          const wsUrl = `${wsProtocol}//${wsHost}/ws/admin`;
          
          console.log("📡 Admin WebSocket bağlantısı deneniyor:", wsUrl);
          
          wsRef.current = new WebSocket(wsUrl);
          
          wsRef.current.onopen = () => {
            console.log("✅ Admin WebSocket bağlantısı başarılı");
          };

          wsRef.current.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'siparis' || data.type === 'durum') {
              verileriGetir(); // Yeni sipariş veya durum güncellemesi geldiğinde verileri güncelle
            }
          };

          wsRef.current.onerror = (error) => {
            console.error("❌ WebSocket hatası:", error);
            setTimeout(connectWebSocket, 5000);
          };

          wsRef.current.onclose = (event) => {
            console.log("🔌 WebSocket bağlantısı kapandı", event.code);
            if (event.code !== 1000) {
              setTimeout(connectWebSocket, 5000);
            }
          };

          // Ping/Pong
          const pingInterval = setInterval(() => {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({ type: 'ping' }));
            }
          }, 30000);

          return () => clearInterval(pingInterval);
        } catch (error) {
          console.error("❌ WebSocket bağlantı hatası:", error);
          setTimeout(connectWebSocket, 5000);
        }
      };

      connectWebSocket();

      return () => {
        if (wsRef.current) {
          wsRef.current.close(1000, "Component unmounting");
        }
      };
    }
  }, [isLoggedIn]);

  // Veri çekimi
  const verileriGetir = async () => {
    try {
      const [
        siparisRes,
        gunlukRes,
        aylikRes,
        yillikRes,
        populerRes,
        onlineRes,
        menuRes
      ] = await Promise.all([
        axios.get(`${API_BASE}/siparisler`, { headers: { Authorization: AUTH_HEADER } }),
        axios.get(`${API_BASE}/istatistik/gunluk`),
        axios.get(`${API_BASE}/istatistik/aylik`),
        axios.get(`${API_BASE}/istatistik/yillik`),
        axios.get(`${API_BASE}/istatistik/en-cok-satilan`),
        axios.get(`${API_BASE}/istatistik/online`),
        axios.get(`${API_BASE}/menu`)
      ]);

      setOrders(siparisRes.data.orders.reverse());
      setGunluk(gunlukRes.data);
      setAylik(aylikRes.data);
      
      const yillikArr = Object.entries(yillikRes.data).map(([tarih, adet]) => ({
        tarih,
        adet
      }));
      setYillik(yillikArr);
      
      setPopuler(populerRes.data);
      setOnline(onlineRes.data.count);
      setMenu(menuRes.data.menu || []);
      setError(null);
    } catch (err) {
      console.error("❌ Veriler alınamadı:", err);
      setError("Veriler alınamadı. Lütfen daha sonra tekrar deneyin.");
    }
  };

  useEffect(() => {
    if (isLoggedIn) {
      verileriGetir();
      const interval = setInterval(verileriGetir, 5000);
      return () => clearInterval(interval);
    }
  }, [isLoggedIn]);

  // Giriş fonksiyonu
  const girisYap = async () => {
    try {
      const res = await axios.post(`${API_BASE}/admin/giris`, {
        kullaniciAdi,
        sifre
      });

      if (res.data.success) {
        setIsLoggedIn(true);
        localStorage.setItem("adminGiris", "true");
      } else {
        alert("🔒 Hatalı kullanıcı adı veya şifre");
      }
    } catch (error) {
      alert("🔒 Giriş başarısız");
    }
  };

  // Menü yönetimi
  const urunEkle = async () => {
    try {
      await axios.post(`${API_BASE}/menu/ekle`, yeniUrun);
      verileriGetir();
      setYeniUrun({ ad: "", fiyat: "", kategori: "" });
    } catch (err) {
      console.error("❌ Ürün eklenemedi:", err);
      alert("Ürün eklenirken bir hata oluştu");
    }
  };

  const urunSil = async () => {
    try {
      await axios.delete(`${API_BASE}/menu/sil`, {
        params: { urun_adi: silUrunAdi }
      });
      verileriGetir();
      setSilUrunAdi("");
    } catch (err) {
      console.error("❌ Ürün silinemedi:", err);
      alert("Ürün silinirken bir hata oluştu");
    }
  };

  const sifreGuncelle = async () => {
    try {
      const res = await axios.post(`${API_BASE}/admin/sifre-degistir`, {
        yeniKullaniciAdi,
        yeniSifre
      });
      alert(res.data.mesaj || "Şifre başarıyla güncellendi");
      setYeniKullaniciAdi("");
      setYeniSifre("");
    } catch (err) {
      console.error("❌ Şifre güncellenemedi:", err);
      alert("Şifre güncellenirken bir hata oluştu");
    }
  };

  const cikisYap = () => {
    localStorage.removeItem("adminGiris");
    setIsLoggedIn(false);
    if (wsRef.current) {
      wsRef.current.close(1000, "Logout");
    }
  };

  const filtrelenmis = orders.filter(
    (o) =>
      String(o.masa).includes(arama) ||
      String(o.istek).toLowerCase().includes(arama.toLowerCase())
  );

  // Giriş ekranı
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-100 to-indigo-100">
        <div className="bg-white shadow-xl p-8 rounded-lg w-full max-w-sm border border-gray-200 animate-fade-in">
          <h2 className="text-2xl font-bold mb-6 text-center text-gray-800 flex items-center justify-center gap-2">
            <span role="img" aria-label="lock">🔐</span> Admin Girişi
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

  // Ana panel
  return (
    <div className="p-8 bg-gradient-to-tr from-slate-100 to-slate-200 min-h-screen text-gray-800 font-sans animate-fade-in relative">
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
          <span className="block sm:inline">{error}</span>
        </div>
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

      {/* İstatistik Kartları */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
            <Coffee className="w-5 h-5 text-blue-500" />
            Günlük Sipariş
          </h3>
          <CountUp
            end={gunluk?.toplam || 0}
            className="text-3xl font-bold text-blue-600"
          />
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-500" />
            Aylık Sipariş
          </h3>
          <CountUp
            end={aylik?.toplam || 0}
            className="text-3xl font-bold text-green-600"
          />
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-purple-500" />
            Online Masalar
          </h3>
          <CountUp
            end={online}
            className="text-3xl font-bold text-purple-600"
          />
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold mb-2">🏆 En Çok Satan</h3>
          {populer[0] && (
            <p className="text-xl font-bold text-orange-600">
              {populer[0].urun}
              <span className="text-sm font-normal text-gray-500 ml-2">
                ({populer[0].adet} adet)
              </span>
            </p>
          )}
        </div>
      </div>

      {/* Grafik ve İstatistikler */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold mb-4">📈 Yıllık Sipariş Grafiği</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={yillik}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="tarih" />
                <YAxis />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="adet"
                  stroke="#4F46E5"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold mb-4">📊 En Çok Satan Ürünler</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={populer}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="urun" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="adet" fill="#4F46E5" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Menü Yönetimi */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-8">
        <h3 className="text-lg font-semibold mb-4">🍽️ Menü Yönetimi</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium mb-2">Ürün Ekle</h4>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Ürün Adı"
                value={yeniUrun.ad}
                onChange={(e) =>
                  setYeniUrun({ ...yeniUrun, ad: e.target.value })
                }
                className="w-full p-2 border rounded"
              />
              <input
                type="number"
                placeholder="Fiyat"
                value={yeniUrun.fiyat}
                onChange={(e) =>
                  setYeniUrun({ ...yeniUrun, fiyat: e.target.value })
                }
                className="w-full p-2 border rounded"
              />
              <input
                type="text"
                placeholder="Kategori"
                value={yeniUrun.kategori}
                onChange={(e) =>
                  setYeniUrun({ ...yeniUrun, kategori: e.target.value })
                }
                className="w-full p-2 border rounded"
              />
              <button
                onClick={urunEkle}
                className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded"
              >
                ➕ Ürün Ekle
              </button>
            </div>
          </div>

          <div>
            <h4 className="font-medium mb-2">Ürün Sil</h4>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Silinecek Ürün Adı"
                value={silUrunAdi}
                onChange={(e) => setSilUrunAdi(e.target.value)}
                className="w-full p-2 border rounded"
              />
              <button
                onClick={urunSil}
                className="w-full bg-red-600 hover:bg-red-700 text-white py-2 rounded"
              >
                🗑️ Ürün Sil
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <h4 className="font-medium mb-2">Mevcut Menü</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {menu.map((kategori) => (
              <div
                key={kategori.kategori}
                className="bg-gray-50 p-4 rounded-lg"
              >
                <h5 className="font-semibold mb-2">{kategori.kategori}</h5>
                <ul className="space-y-1">
                  {kategori.urunler.map((urun) => (
                    <li
                      key={urun.ad}
                      className="flex justify-between items-center"
                    >
                      <span>{urun.ad}</span>
                      <span className="text-gray-600">{urun.fiyat}₺</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sipariş Listesi */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-lg font-semibold mb-4">📋 Sipariş Geçmişi</h3>
        
        <input
          type="text"
          placeholder="Sipariş Ara..."
          value={arama}
          onChange={(e) => setArama(e.target.value)}
          className="w-full p-3 border rounded mb-4"
        />

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Masa
                </th>
                <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sipariş
                </th>
                <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Durum
                </th>
                <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tarih
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filtrelenmis.map((siparis, i) => (
                <tr key={i}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    Masa {siparis.masa}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm">
                      {(() => {
                        try {
                          const sepet = JSON.parse(siparis.sepet || "[]");
                          return sepet
                            .map((item) => `${item.adet}x ${item.urun}`)
                            .join(", ");
                        } catch {
                          return "Sipariş detayı alınamadı";
                        }
                      })()}
                    </div>
                    {siparis.istek && (
                      <div className="text-xs text-gray-500 mt-1">
                        Not: {siparis.istek}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        siparis.durum === "hazir"
                          ? "bg-green-100 text-green-800"
                          : siparis.durum === "hazirlaniyor"
                          ? "bg-blue-100 text-blue-800"
                          : siparis.durum === "iptal"
                          ? "bg-red-100 text-red-800"
                          : "bg-yellow-100 text-yellow-800"
                      }`}
                    >
                      {siparis.durum || "Bekliyor"}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(siparis.zaman).toLocaleString("tr-TR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ayarlar */}
      <div className="bg-white p-6 rounded-lg shadow-md mt-8">
        <h3 className="text-lg font-semibold mb-4">⚙️ Ayarlar</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium mb-2">Admin Bilgilerini Güncelle</h4>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Yeni Kullanıcı Adı"
                value={yeniKullaniciAdi}
                onChange={(e) => setYeniKullaniciAdi(e.target.value)}
                className="w-full p-2 border rounded"
              />
              <input
                type="password"
                placeholder="Yeni Şifre"
                value={yeniSifre}
                onChange={(e) => setYeniSifre(e.target.value)}
                className="w-full p-2 border rounded"
              />
              <button
                onClick={sifreGuncelle}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded"
              >
                💾 Güncelle
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminPaneli;