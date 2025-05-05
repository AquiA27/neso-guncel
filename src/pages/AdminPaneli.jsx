import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend, // Legend eklendi
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import CountUp from "react-countup";
import { UserCheck, Coffee, TrendingUp, Settings, LogOut, AlertCircle, MenuSquare, Trash2, PlusCircle } from "lucide-react"; // İkonlar eklendi
import axios from "axios";

const API_BASE = process.env.REACT_APP_API_BASE;
// DİKKAT: Bu yöntem üretim ortamları için GÜVENLİ DEĞİLDİR!
// Güvenli bir kimlik doğrulama mekanizması (örn: Token tabanlı) kullanılmalıdır.
const AUTH_HEADER = "Basic " + btoa("admin:admin123"); // Default credentials

function AdminPaneli() {
  // --- State Tanımlamaları ---
  const [orders, setOrders] = useState([]); // Sipariş listesi
  const [arama, setArama] = useState(""); // Sipariş arama metni
  // Giriş durumu localStorage'dan okunur, sayfa yenilense bile korunur
  const [isLoggedIn, setIsLoggedIn] = useState(
    () => typeof window !== 'undefined' && localStorage.getItem("adminGiris") === "true"
  );
  const [gunluk, setGunluk] = useState({ siparis_sayisi: 0, gelir: 0 }); // Günlük istatistikler
  const [aylik, setAylik] = useState({ siparis_sayisi: 0, gelir: 0 }); // Aylık istatistikler
  const [yillikChartData, setYillikChartData] = useState([]); // Yıllık istatistik (chart için formatlanmış)
  const [populer, setPopuler] = useState([]); // Popüler ürünler
  const [aktifMasaSayisi, setAktifMasaSayisi] = useState(0); // Aktif masa sayısı
  const [menu, setMenu] = useState([]); // Menü verisi
  const [yeniUrun, setYeniUrun] = useState({ ad: "", fiyat: "", kategori: "" }); // Yeni ürün formu state'i
  const [silUrunAdi, setSilUrunAdi] = useState(""); // Silinecek ürün adı state'i
  const [error, setError] = useState(null); // Genel hata mesajı
  const [loading, setLoading] = useState(true); // Veriler yükleniyor mu?
  const wsRef = useRef(null); // WebSocket referansı

  // --- Yardımcı Fonksiyonlar ---
  const logInfo = useCallback((message) => console.log(`[Admin Paneli] INFO: ${message}`), []);
  const logError = useCallback((message, error) => console.error(`[Admin Paneli] ERROR: ${message}`, error || ''), []);
  const logWarn = useCallback((message) => console.warn(`[Admin Paneli] WARN: ${message}`), []);

  // --- Sayfa Başlığı ---
  useEffect(() => {
    document.title = "Admin Paneli - Neso";
  }, []);

  // --- Veri Çekme Fonksiyonu ---
  const verileriGetir = useCallback(async () => {
    logInfo("🔄 Tüm veriler getiriliyor...");
    setLoading(true); // Yükleme başlangıcı
    if (!API_BASE) {
      logError("API_BASE tanımlı değil.");
      setError("API adresi yapılandırılmamış.");
      setLoading(false);
      return;
    }
    try {
      const [
        siparisRes,
        gunlukRes,
        aylikRes,
        yillikRes,
        populerRes,
        aktifMasalarRes, // /istatistik/online yerine /aktif-masalar
        menuRes
      ] = await Promise.all([
        axios.get(`${API_BASE}/siparisler`, { headers: { Authorization: AUTH_HEADER } }),
        axios.get(`${API_BASE}/istatistik/gunluk`),
        axios.get(`${API_BASE}/istatistik/aylik`),
        axios.get(`${API_BASE}/istatistik/yillik`),
        axios.get(`${API_BASE}/istatistik/en-cok-satilan`),
        axios.get(`${API_BASE}/aktif-masalar`), // Yeni endpoint çağrısı
        axios.get(`${API_BASE}/menu`)
      ]);

      // Siparişler (en yeni üstte)
      setOrders(siparisRes.data.orders || []);

      // İstatistikler
      setGunluk(gunlukRes.data || { siparis_sayisi: 0, gelir: 0 });
      setAylik(aylikRes.data || { siparis_sayisi: 0, gelir: 0 });
      setPopuler(populerRes.data || []);

      // Aktif Masa Sayısı
      setAktifMasaSayisi(aktifMasalarRes.data.tables?.length || 0); // Gelen listenin uzunluğu

      // Yıllık veriyi Recharts için formatla: [{tarih: "YYYY-MM", adet: X}]
      const yillikRawData = yillikRes.data || {};
      const formattedYillikData = Object.entries(yillikRawData)
          .map(([tarih, adet]) => ({ tarih, adet }))
          .sort((a, b) => a.tarih.localeCompare(b.tarih)); // Tarihe göre sırala
      setYillikChartData(formattedYillikData);

      // Menü
      setMenu(menuRes.data.menu || []);

      setError(null); // Başarılı istek sonrası hatayı temizle
      logInfo("✅ Tüm veriler başarıyla getirildi.");

    } catch (err) {
      logError("❌ Veriler alınamadı:", err);
      const errorDetail = err.response?.data?.detail || err.message || "Bilinmeyen bir hata oluştu.";
       if (err.response?.status === 401) {
          setError("Verileri görüntülemek için yetkiniz yok veya kimlik bilgileri hatalı. Lütfen sayfayı yenileyip tekrar deneyin veya çıkış yapıp tekrar girin.");
          setIsLoggedIn(false); // Yetki hatasıysa çıkış yapmış sayalım
          localStorage.removeItem("adminGiris");
      } else {
          setError(`Veriler alınamadı: ${errorDetail}`);
      }
    } finally {
        setLoading(false); // Yükleme bitti
    }
  }, [API_BASE, logInfo, logError]); // Bağımlılıklar

  // --- WebSocket Bağlantısı ---
   useEffect(() => {
    // Sadece giriş yapıldıysa WebSocket'e bağlan
    if (!isLoggedIn) {
        // Eğer bağlantı varsa ve çıkış yapıldıysa kapat
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            logInfo("Çıkış yapıldı, WebSocket bağlantısı kapatılıyor.");
            wsRef.current.close(1000, "User logged out");
        }
        return; // Giriş yapılmadıysa fonksiyondan çık
    }

    const connectWebSocket = () => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            logInfo("WebSocket zaten bağlı.");
            return;
        }
        if (!API_BASE) {
            logError("API_BASE tanımlı değil, WebSocket bağlantısı kurulamıyor.");
            return;
        }

      try {
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsHost = API_BASE.replace(/^https?:\/\//, '');
        const wsUrl = `${wsProtocol}//${wsHost}/ws/admin`;

        logInfo(`📡 Admin WebSocket bağlantısı deneniyor: ${wsUrl}`);
        wsRef.current = new WebSocket(wsUrl);

        wsRef.current.onopen = () => {
          logInfo("✅ Admin WebSocket bağlantısı başarılı.");
          setError(null); // Bağlantı hatasını temizle
        };

        wsRef.current.onmessage = (event) => {
          try {
             const message = JSON.parse(event.data);
             logInfo(`📥 Admin WS mesajı alındı: Tip: ${message.type}`);

             // Yeni sipariş veya durum güncellemesi geldiğinde tüm verileri yeniden çek
             if (message.type === 'siparis' || message.type === 'durum' || message.type === 'masa_durum') {
                 logInfo(`⚡ Gerçek zamanlı güncelleme alındı (${message.type}), veriler yenileniyor...`);
                 verileriGetir(); // Paneli güncelle
             } else if (message.type === 'pong') {
                 // Ping yanıtı
             } else {
                logWarn(`⚠️ Bilinmeyen Admin WS mesaj tipi: ${message.type}`);
             }
          } catch (err) {
              logError("Admin WS mesajı işlenirken hata:", err)
          }
        };

        wsRef.current.onerror = (errorEvent) => {
          logError("❌ Admin WebSocket hatası:", errorEvent);
          setError("Sunucuyla anlık bağlantı kesildi. Yeniden bağlanılmaya çalışılıyor...");
        };

        wsRef.current.onclose = (event) => {
          logInfo(`🔌 Admin WebSocket bağlantısı kapandı. Kod: ${event.code}, Sebep: ${event.reason}`);
           // Eğer kullanıcı hala giriş yapmış durumdaysa ve bağlantı beklenmedik şekilde kapandıysa tekrar dene
          if (isLoggedIn && event.code !== 1000) {
            logInfo("Admin WS beklenmedik şekilde kapandı, 5 saniye sonra tekrar denenecek...");
            setTimeout(connectWebSocket, 5000);
          }
        };

      } catch (error) {
        logError("❌ Admin WebSocket başlatılırken kritik hata:", error);
        setError("Sunucu bağlantısı kurulamıyor.");
      }
    };

    // Periyodik ping
     const pingInterval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
         try { wsRef.current.send(JSON.stringify({ type: 'ping' })); }
         catch (err) { logError("Admin Ping gönderilemedi:", err); }
      } else if (isLoggedIn && (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED)) {
           logInfo("Admin Ping: Bağlantı kapalı, tekrar bağlanılıyor...");
           connectWebSocket();
      }
    }, 30000);

    connectWebSocket(); // Bağlantıyı kur

    // Component kaldırıldığında veya çıkış yapıldığında temizlik
    return () => {
      clearInterval(pingInterval);
      if (wsRef.current) {
        logInfo("Admin Paneli: Component kaldırılıyor/çıkış yapılıyor, WebSocket kapatılıyor.");
        wsRef.current.close(1000, "Component unmounting or logout");
      }
    };
  }, [isLoggedIn, API_BASE, verileriGetir, logInfo, logError, logWarn]); // isLoggedIn bağımlılığı eklendi

  // --- İlk Veri Çekme ---
  useEffect(() => {
    // Sadece giriş yapıldıysa verileri çek
    if (isLoggedIn) {
      verileriGetir();
      // Periyodik veri çekme (WebSocket'e ek olarak fallback, daha uzun aralıklarla)
      // const interval = setInterval(verileriGetir, 120000); // 2 dakikada bir
      // return () => clearInterval(interval);
    }
  }, [isLoggedIn, verileriGetir]); // Sadece isLoggedIn değiştiğinde veya ilk yüklemede çalışır

  // --- Menü Yönetimi Fonksiyonları ---
  const urunEkle = useCallback(async () => {
    if (!yeniUrun.ad || !yeniUrun.fiyat || !yeniUrun.kategori) {
        alert("Lütfen ürün adı, fiyatı ve kategorisini girin.");
        return;
    }
    logInfo(`➕ Ürün ekleniyor: ${JSON.stringify(yeniUrun)}`);
    setError(null);
    try {
      await axios.post(`${API_BASE}/menu/ekle`, yeniUrun, {
         headers: { Authorization: AUTH_HEADER, 'Content-Type': 'application/json' }
      });
      logInfo("✅ Ürün başarıyla eklendi.");
      setYeniUrun({ ad: "", fiyat: "", kategori: "" }); // Formu temizle
      verileriGetir(); // Listeyi ve menüyü güncelle
      alert("Ürün başarıyla eklendi.");
    } catch (err) {
      logError("❌ Ürün eklenemedi:", err);
      const errorDetail = err.response?.data?.detail || err.message || "Bilinmeyen bir hata.";
      setError(`Ürün eklenirken bir hata oluştu: ${errorDetail}`);
      alert(`Ürün eklenemedi: ${errorDetail}`);
    }
  }, [API_BASE, yeniUrun, verileriGetir, logInfo, logError]);

  const urunSil = useCallback(async () => {
    if (!silUrunAdi) {
        alert("Lütfen silinecek ürünün adını girin.");
        return;
    }
    if (!window.confirm(`'${silUrunAdi}' adlı ürünü silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`)) {
        return;
    }
    logInfo(`➖ Ürün siliniyor: ${silUrunAdi}`);
    setError(null);
    try {
      await axios.delete(`${API_BASE}/menu/sil`, {
        params: { urun_adi: silUrunAdi },
        headers: { Authorization: AUTH_HEADER }
      });
      logInfo("🗑️ Ürün başarıyla silindi.");
      setSilUrunAdi(""); // Formu temizle
      verileriGetir(); // Listeyi ve menüyü güncelle
      alert("Ürün başarıyla silindi.");
    } catch (err) {
      logError("❌ Ürün silinemedi:", err);
       const errorDetail = err.response?.data?.detail || err.message || "Bilinmeyen bir hata.";
       setError(`Ürün silinirken bir hata oluştu: ${errorDetail}`);
       alert(`Ürün silinemedi: ${errorDetail}`);
    }
  }, [API_BASE, silUrunAdi, verileriGetir, logInfo, logError]);

  // --- Çıkış Fonksiyonu ---
  const cikisYap = () => {
    logInfo("🚪 Çıkış yapılıyor...");
    localStorage.removeItem("adminGiris"); // localStorage'dan girişi kaldır
    setIsLoggedIn(false); // State'i güncelle
    // Aktif WebSocket bağlantısını kapat (useEffect içinde zaten yapılıyor)
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close(1000, "User logged out");
    }
  };

  // --- Sipariş Filtreleme ---
  const filtrelenmisSiparisler = orders.filter(
    (o) =>
      // Sipariş ID, Masa No, İstek veya Sepet içeriğinde arama
      String(o.id).includes(arama) ||
      String(o.masa).toLowerCase().includes(arama.toLowerCase()) ||
      (o.istek && String(o.istek).toLowerCase().includes(arama.toLowerCase())) ||
      (o.sepet && o.sepet.toLowerCase().includes(arama.toLowerCase()))
  );

  // --- Giriş Yapılmadıysa (Erişim Engellendi Mesajı) ---
  // Basic Auth tarayıcı tarafından yönetildiği için ayrı bir giriş formu yerine
  // yetki yoksa verileriGetir fonksiyonunda hata alıp çıkış yapılacak.
  // Bu nedenle giriş formu tamamen kaldırıldı.

  // --- Ana Panel Render ---
  if (!isLoggedIn) {
      // Eğer localStorage'da giriş bilgisi yoksa veya yetki hatası alındıysa
      // Kullanıcıya bilgi verip sayfayı yenilemesini veya destek almasını isteyebiliriz.
      // Tarayıcı Basic Auth penceresini otomatik göstermeli.
      return (
          <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-100 to-orange-100 p-4">
              <div className="bg-white shadow-xl p-8 rounded-lg text-center border border-red-300">
                  <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                  <h2 className="text-xl font-bold mb-4 text-red-700">Erişim Engellendi</h2>
                  <p className="text-gray-600 mb-4">Admin paneline erişim yetkiniz bulunmuyor veya oturumunuz sonlanmış.</p>
                  <p className="text-sm text-gray-500">Lütfen geçerli admin bilgileriyle tekrar deneyin veya sistem yöneticisiyle iletişime geçin.</p>
                   {error && <p className="mt-4 text-xs text-red-600 bg-red-50 p-2 rounded">Detay: {error}</p>}
              </div>
          </div>
      );
  }

  // --- Giriş Yapıldıysa Ana Panel ---
  return (
    <div className="p-4 md:p-8 bg-gradient-to-tr from-slate-100 to-slate-200 min-h-screen text-gray-800 font-sans relative">
      {/* Hata Mesajı */}
       {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded relative mb-6 shadow" role="alert">
           <strong className="font-bold">Hata: </strong>
           <span className="block sm:inline">{error}</span>
        </div>
      )}

      {/* Yükleniyor Göstergesi */}
      {loading && (
          <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
              <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500"></div>
          </div>
      )}


      {/* Başlık ve Çıkış Butonu */}
      <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-800 flex items-center gap-3">
            <Settings className="w-8 h-8 text-blue-600" /> Admin Paneli
          </h1>
          <button
            onClick={cikisYap}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg shadow-md flex items-center gap-2 transition duration-200 ease-in-out active:scale-95"
          >
            <LogOut className="w-4 h-4" /> Çıkış Yap
          </button>
      </div>


      {/* İstatistik Kartları */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Günlük Sipariş (Ürün Adedi) */}
        <div className="bg-white p-5 rounded-lg shadow-md border-t-4 border-blue-500">
          <h3 className="text-base font-semibold mb-2 flex items-center gap-2 text-gray-600">
            <Coffee className="w-5 h-5 text-blue-500" />
            Günlük Ürün Adedi
          </h3>
          <CountUp
            end={gunluk?.siparis_sayisi || 0}
            separator="."
            className="text-3xl font-bold text-blue-700"
          />
        </div>
         {/* Günlük Gelir */}
        <div className="bg-white p-5 rounded-lg shadow-md border-t-4 border-green-500">
          <h3 className="text-base font-semibold mb-2 flex items-center gap-2 text-gray-600">
             ₺ Günlük Gelir
          </h3>
          <CountUp
            end={gunluk?.gelir || 0}
            separator="."
            decimal=","
            decimals={2}
            suffix=" ₺"
            className="text-3xl font-bold text-green-700"
          />
        </div>
        {/* Aktif Masalar */}
        <div className="bg-white p-5 rounded-lg shadow-md border-t-4 border-purple-500">
          <h3 className="text-base font-semibold mb-2 flex items-center gap-2 text-gray-600">
            <UserCheck className="w-5 h-5 text-purple-500" />
            Aktif Masalar
          </h3>
          <CountUp
            end={aktifMasaSayisi}
            separator="."
            className="text-3xl font-bold text-purple-700"
          />
        </div>
        {/* En Çok Satan */}
        <div className="bg-white p-5 rounded-lg shadow-md border-t-4 border-orange-500">
          <h3 className="text-base font-semibold mb-2 flex items-center gap-2 text-gray-600">
            🏆 En Çok Satan
          </h3>
          {populer[0] ? (
            <p className="text-lg font-bold text-orange-700 truncate" title={populer[0].urun}>
              {populer[0].urun}
              <span className="text-sm font-normal text-gray-500 ml-2">
                ({populer[0].adet} adet)
              </span>
            </p>
          ) : (
              <p className="text-gray-500 text-sm">Veri yok</p>
          )}
        </div>
      </div>

      {/* Grafik ve İstatistikler */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Yıllık Sipariş Grafiği (Aylık Ürün Adedi) */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold mb-4 text-gray-700">📈 Aylık Satılan Ürün Adedi</h3>
          <div className="h-64">
             {yillikChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={yillikChartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0"/>
                    <XAxis dataKey="tarih" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip formatter={(value) => [`${value} Adet`, 'Toplam Ürün']}/>
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="adet"
                      name="Aylık Ürün Adedi"
                      stroke="#4F46E5" // Indigo
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
             ) : (
                 <div className="flex items-center justify-center h-full text-gray-500">Yıllık veri bulunamadı.</div>
             )}
          </div>
        </div>
        {/* En Çok Satan Ürünler Grafiği */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold mb-4 text-gray-700">📊 En Çok Satan 5 Ürün (Adet)</h3>
          <div className="h-64">
            {populer.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={populer} layout="vertical" margin={{ top: 5, right: 30, left: 30, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0"/>
                    <XAxis type="number" fontSize={12} />
                    <YAxis dataKey="urun" type="category" fontSize={12} width={80} tick={{ textAnchor: 'end' }}/>
                    <Tooltip formatter={(value) => [`${value} Adet`, 'Satış Adedi']}/>
                    {/* <Legend /> */}
                    <Bar dataKey="adet" name="Satış Adedi" fill="#FB923C" barSize={20} /> {/* Orange */}
                  </BarChart>
                </ResponsiveContainer>
            ) : (
                 <div className="flex items-center justify-center h-full text-gray-500">Popüler ürün verisi bulunamadı.</div>
            )}
          </div>
        </div>
      </div>

      {/* Menü Yönetimi */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-8">
        <h3 className="text-lg font-semibold mb-4 text-gray-700 flex items-center gap-2"><MenuSquare className="w-5 h-5 text-teal-600"/> Menü Yönetimi</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Ürün Ekleme Formu */}
          <div className="md:col-span-1">
            <h4 className="font-medium mb-3 text-gray-600">Yeni Ürün Ekle</h4>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Ürün Adı"
                value={yeniUrun.ad}
                onChange={(e) => setYeniUrun({ ...yeniUrun, ad: e.target.value })}
                className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <input
                type="number"
                placeholder="Fiyat (örn: 25.50)"
                value={yeniUrun.fiyat}
                onChange={(e) => setYeniUrun({ ...yeniUrun, fiyat: e.target.value })}
                 className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-500"
                 step="0.01" // Ondalıklı giriş için
                 min="0" // Negatif fiyat engelleme
              />
              <input
                type="text"
                placeholder="Kategori"
                value={yeniUrun.kategori}
                onChange={(e) => setYeniUrun({ ...yeniUrun, kategori: e.target.value })}
                 className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <button
                onClick={urunEkle}
                className="w-full bg-teal-600 hover:bg-teal-700 text-white py-2 rounded shadow transition duration-200 ease-in-out active:scale-95 flex items-center justify-center gap-2"
              >
                <PlusCircle className="w-4 h-4"/> Ürün Ekle
              </button>
            </div>
            {/* Ürün Silme Formu */}
            <div className="mt-6 pt-4 border-t">
                 <h4 className="font-medium mb-3 text-gray-600">Ürün Sil</h4>
                 <div className="space-y-3">
                    <input
                        type="text"
                        placeholder="Silinecek Ürün Adı"
                        value={silUrunAdi}
                        onChange={(e) => setSilUrunAdi(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                    <button
                        onClick={urunSil}
                        disabled={!silUrunAdi.trim()}
                        className={`w-full text-white py-2 rounded shadow transition duration-200 ease-in-out active:scale-95 flex items-center justify-center gap-2 ${
                            !silUrunAdi.trim() ? 'bg-gray-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'
                        }`}
                    >
                       <Trash2 className="w-4 h-4"/> Ürün Sil
                    </button>
                 </div>
            </div>
          </div>

          {/* Mevcut Menü Gösterimi */}
          <div className="md:col-span-2">
             <h4 className="font-medium mb-3 text-gray-600">Mevcut Menü</h4>
             {menu.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-h-96 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                    {menu.map((kategori) => (
                      <div key={kategori.kategori} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                        <h5 className="font-semibold mb-2 text-teal-700">{kategori.kategori}</h5>
                        <ul className="space-y-1 text-sm">
                          {kategori.urunler.map((urun) => (
                            <li key={urun.ad} className="flex justify-between items-center border-b border-gray-100 py-1">
                              <span className={urun.stok_durumu === 0 ? 'text-red-500 line-through' : ''}>{urun.ad}</span>
                              <span className={`font-medium ${urun.stok_durumu === 0 ? 'text-red-400' : 'text-gray-700'}`}>
                                  {parseFloat(urun.fiyat).toFixed(2)}₺
                                  {urun.stok_durumu === 0 && <span className="text-xs ml-1">(Stokta Yok)</span>}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                </div>
             ) : (
                 <div className="text-center py-10 text-gray-500">Menü boş veya yüklenemedi.</div>
             )}
          </div>
        </div>
      </div>


      {/* Sipariş Listesi */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-lg font-semibold mb-4 text-gray-700">📋 Sipariş Geçmişi</h3>
         {/* Arama Çubuğu */}
        <input
          type="text"
          placeholder="Sipariş Ara (ID, Masa No, İçerik...)"
          value={arama}
          onChange={(e) => setArama(e.target.value)}
          className="w-full p-3 border border-gray-300 rounded mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {/* Sipariş Tablosu */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 border border-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Masa</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sipariş İçeriği</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Durum</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tarih</th>
                 {/* <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">İşlemler</th> */}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filtrelenmisSiparisler.length > 0 ? filtrelenmisSiparisler.map((siparis) => {
                  let sepetDetay = "Detay yok";
                  try {
                      const sepetList = JSON.parse(siparis.sepet || "[]");
                      if (Array.isArray(sepetList) && sepetList.length > 0) {
                          sepetDetay = sepetList
                            .map(item => `${item.adet}x ${item.urun}`)
                            .join(", ");
                      }
                  } catch {
                      sepetDetay = "Detay okunamadı";
                  }

                  return (
                    <tr key={siparis.id} className="hover:bg-gray-50 text-sm">
                      <td className="px-4 py-3 whitespace-nowrap text-gray-700">#{siparis.id}</td>
                      <td className="px-4 py-3 whitespace-nowrap font-medium">Masa {siparis.masa}</td>
                      <td className="px-4 py-3">
                        <div className="max-w-xs truncate" title={sepetDetay}>{sepetDetay}</div>
                        {siparis.istek && (
                          <div className="text-xs text-gray-500 mt-1 truncate" title={`Not: ${siparis.istek}`}>
                             💬 {siparis.istek}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`px-2.5 py-1 text-xs font-semibold rounded-full leading-tight ${
                            siparis.durum === "hazir"
                              ? "bg-green-100 text-green-800"
                              : siparis.durum === "hazirlaniyor"
                              ? "bg-blue-100 text-blue-800"
                              : siparis.durum === "iptal"
                              ? "bg-red-100 text-red-800 line-through"
                              : "bg-yellow-100 text-yellow-800" // Bekliyor veya diğer
                          }`}
                        >
                          {siparis.durum || "Bekliyor"}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-500">
                        {siparis.zaman ? new Date(siparis.zaman).toLocaleString("tr-TR", {
                            year: 'numeric', month: 'numeric', day: 'numeric',
                            hour: '2-digit', minute: '2-digit'
                         }) : "-"}
                      </td>
                       {/* İşlemler Sütunu (Opsiyonel -örn: detayı gör, tekrar yazdır vb.) */}
                       {/* <td className="px-4 py-3 whitespace-nowrap">...</td> */}
                    </tr>
                  );
              }) : (
                   <tr>
                       <td colSpan="5" className="text-center py-10 text-gray-500">
                           {arama ? 'Aramanızla eşleşen sipariş bulunamadı.' : 'Gösterilecek sipariş yok.'}
                       </td>
                   </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ayarlar Bölümü (Şifre Değiştirme kaldırıldı) */}
      <div className="bg-white p-6 rounded-lg shadow-md mt-8">
        <h3 className="text-lg font-semibold mb-4 text-gray-700">⚙️ Ayarlar</h3>
        <p className="text-sm text-gray-600">
            Şu anda admin paneli üzerinden değiştirilebilecek bir ayar bulunmamaktadır.
            Admin kullanıcı adı ve şifresi gibi yapılandırmalar sunucu tarafında ortam değişkenleri ile yönetilmektedir.
        </p>
        {/*
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium mb-2">Admin Bilgilerini Güncelle (Devre Dışı)</h4>
            <p className="text-xs text-red-600 mb-2">Bu özellik şu anda backend desteği olmadığı için aktif değildir.</p>
             <div className="space-y-3 opacity-50">
              <input type="text" placeholder="Yeni Kullanıcı Adı" disabled className="w-full p-2 border rounded bg-gray-100 cursor-not-allowed"/>
              <input type="password" placeholder="Yeni Şifre" disabled className="w-full p-2 border rounded bg-gray-100 cursor-not-allowed"/>
              <button disabled className="w-full bg-gray-400 text-white py-2 rounded cursor-not-allowed"> 💾 Güncelle </button>
            </div>
          </div>
        </div>
        */}
      </div>

    </div> // Ana container kapanışı
  );
}

export default AdminPaneli;