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
// --- GÜNCELLENDİ: Eksik RotateCw ikonu eklendi ---
import { UserCheck, Coffee, TrendingUp, Settings, LogOut, AlertCircle, MenuSquare, Trash2, PlusCircle, RotateCw } from "lucide-react";
import axios from "axios";

// API Base URL ortam değişkeninden okunur
const API_BASE = process.env.REACT_APP_API_BASE;

// --- Kimlik Bilgilerini Ortam Değişkenlerinden Oku ---
const ADMIN_USERNAME = process.env.REACT_APP_ADMIN_USERNAME || "admin"; // Varsayılan: admin
const ADMIN_PASSWORD = process.env.REACT_APP_ADMIN_PASSWORD || "admin123"; // Varsayılan: admin123

// Basic Auth başlığını dinamik olarak oluştur
const AUTH_HEADER = "Basic " + btoa(`<span class="math-inline">\{ADMIN\_USERNAME\}\:</span>{ADMIN_PASSWORD}`);
// --------------------------------------------------------------

function AdminPaneli() {
  // --- State Tanımlamaları ---
  const [orders, setOrders] = useState([]); // Sipariş listesi
  const [arama, setArama] = useState(""); // Sipariş arama metni
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
  // --- GÜNCELLENDİ: Başlangıç loading state'i isLoggedIn'e göre ayarlandı ---
  const [loading, setLoading] = useState(() => isLoggedIn); // Eğer giriş yapılmışsa true, değilse false
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
  const verileriGetir = useCallback(async (isRetry = false) => { // isRetry parametresi eklendi
    // Giriş yapılmamışsa ve tekrar deneme değilse işlem yapma
    if (!isLoggedIn && !isRetry) {
      logWarn("Giriş yapılmamış veya yetki bekleniyor, otomatik veri çekme atlanıyor.");
      setLoading(false); // Yükleniyor durumunu kapat
      return;
    }

    logInfo(`🔄 Tüm veriler getiriliyor... (Retry: ${isRetry})`);
    setLoading(true); // Yükleme başlangıcı
    setError(null); // Önceki hatayı temizle

    if (!API_BASE) {
      logError("API_BASE tanımlı değil.");
      setError("API adresi yapılandırılmamış.");
      setLoading(false);
      return;
    }

    try {
      const headers = { Authorization: AUTH_HEADER }; // Dinamik AUTH_HEADER kullanılıyor

      const [
        siparisRes,
        gunlukRes,
        aylikRes,
        yillikRes,
        populerRes,
        aktifMasalarRes,
        menuRes
      ] = await Promise.all([
        axios.get(`${API_BASE}/siparisler`, { headers }),
        axios.get(`${API_BASE}/istatistik/gunluk`), // Auth gerektirmeyenler için headers yok
        axios.get(`${API_BASE}/istatistik/aylik`),
        axios.get(`${API_BASE}/istatistik/yillik`),
        axios.get(`${API_BASE}/istatistik/en-cok-satilan`),
        axios.get(`${API_BASE}/aktif-masalar`),
        axios.get(`${API_BASE}/menu`)
      ]);

      // Başarılı veri alımı sonrası giriş durumunu ayarla
      if (typeof window !== 'undefined') {
          localStorage.setItem("adminGiris", "true");
      }
      // Eğer state false ise (ilk başarılı giriş veya tekrar deneme sonrası) true yap
      if (!isLoggedIn) {
         setIsLoggedIn(true);
      }

      // Verileri state'e aktar (null/undefined kontrolleri)
      setOrders(siparisRes?.data?.orders || []);
      setGunluk(gunlukRes?.data || { siparis_sayisi: 0, gelir: 0 });
      setAylik(aylikRes?.data || { siparis_sayisi: 0, gelir: 0 });
      setPopuler(populerRes?.data || []);
      setAktifMasaSayisi(aktifMasalarRes?.data?.tables?.length || 0);

      const yillikRawData = yillikRes?.data || {};
      const formattedYillikData = Object.entries(yillikRawData)
          .map(([tarih, adet]) => ({ tarih, adet }))
          .sort((a, b) => a.tarih.localeCompare(b.tarih));
      setYillikChartData(formattedYillikData);

      setMenu(menuRes?.data?.menu || []);

      logInfo("✅ Tüm veriler başarıyla getirildi.");

    } catch (err) {
      logError("❌ Veriler alınamadı:", err);
      const errorDetail = err.response?.data?.detail || err.message || "Bilinmeyen bir hata oluştu.";
      if (err.response?.status === 401) {
          setError("Yetkiniz yok veya kimlik bilgileri hatalı. Lütfen tekrar deneyin.");
          // Yetki hatası alındığında localStorage'ı temizle ve state'i güncelle
          if (typeof window !== 'undefined') {
              localStorage.removeItem("adminGiris");
          }
          setIsLoggedIn(false); // Yetki hatasıysa çıkış yapmış sayalım
      } else {
          // Diğer API veya ağ hataları
          setError(`Veriler alınamadı: ${errorDetail}`);
      }
    } finally {
        setLoading(false); // Yükleme bitti
    }
  // useCallback bağımlılıkları güncellendi
  }, [API_BASE, isLoggedIn, logInfo, logError, logWarn]);

  // --- WebSocket Bağlantısı ---
   useEffect(() => {
    if (!isLoggedIn) {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            logInfo("Çıkış yapıldı, WebSocket bağlantısı kapatılıyor.");
            wsRef.current.close(1000, "User logged out");
            wsRef.current = null;
        }
        return; // Giriş yapılmadıysa WS bağlantısı kurma
    }

    let reconnectTimeoutId = null;
    const connectWebSocket = () => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;
        if (!API_BASE) { logError("API_BASE tanımlı değil, WS kurulamıyor."); return; }

        try {
            const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsHost = API_BASE.replace(/^https?:\/\//, '');
            const wsUrl = `<span class="math-inline">\{wsProtocol\}//</span>{wsHost}/ws/admin`;
            logInfo(`📡 Admin WebSocket bağlantısı deneniyor: ${wsUrl}`);
            wsRef.current = new WebSocket(wsUrl);

            wsRef.current.onopen = () => { logInfo("✅ Admin WebSocket bağlantısı başarılı."); };

            wsRef.current.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    logInfo(`📥 Admin WS mesajı alındı: Tip: ${message.type}`);
                    if (['siparis', 'durum', 'masa_durum'].includes(message.type)) {
                        logInfo(`⚡ WS: ${message.type} alındı, veriler yenileniyor...`);
                        verileriGetir(); // Verileri yeniden çek
                    } else if (message.type === 'pong') { /* İşlem yok */ }
                     else { logWarn(`⚠️ Bilinmeyen Admin WS mesaj tipi: ${message.type}`); }
                } catch (err) { logError("Admin WS mesaj işleme hatası:", err); }
            };

            wsRef.current.onerror = (errorEvent) => { logError("❌ Admin WebSocket hatası:", errorEvent); setError("Sunucuyla anlık bağlantı kesildi (WebSocket)."); };

            wsRef.current.onclose = (event) => {
                logInfo(`🔌 Admin WebSocket bağlantısı kapandı. Kod: ${event.code}, Sebep: ${event.reason || 'Yok'}`);
                const currentWs = wsRef.current; // Mevcut referansı sakla
                wsRef.current = null; // Referansı temizle

                const checkAndReconnect = () => {
                    // Yeniden bağlanmadan önce hala girişli olup olmadığını kontrol et (localStorage daha güvenilir olabilir)
                    const stillLoggedIn = typeof window !== 'undefined' && localStorage.getItem("adminGiris") === "true";
                    if (stillLoggedIn && event.code !== 1000 && event.code !== 1001) {
                        logInfo("Admin WS beklenmedik şekilde kapandı, 5sn sonra tekrar denenecek...");
                        if (reconnectTimeoutId) clearTimeout(reconnectTimeoutId);
                        reconnectTimeoutId = setTimeout(connectWebSocket, 5000 + Math.random() * 1000);
                    } else if (!stillLoggedIn) {
                        logInfo("Tekrar bağlanma iptal edildi (çıkış yapılmış veya bilerek kapatılmış).");
                        if (currentWs && currentWs.readyState === WebSocket.OPEN) {
                           try { currentWs.close(1000, "Clean close after logout/close check"); } catch {}
                        }
                    }
                };
                 // State güncellemelerinin yansıması için küçük bir gecikme
                setTimeout(checkAndReconnect, 100);
            };
        } catch (error) { logError("❌ Admin WebSocket başlatılırken kritik hata:", error); setError("Sunucu bağlantısı (WebSocket) kurulamıyor."); }
    };

    const pingInterval = setInterval(() => {
        // Ping sadece bağlantı açıksa ve kullanıcı giriş yapmışsa gönderilir
        const stillLoggedIn = typeof window !== 'undefined' && localStorage.getItem("adminGiris") === "true";
        if (stillLoggedIn && wsRef.current?.readyState === WebSocket.OPEN) {
            try { wsRef.current.send(JSON.stringify({ type: 'ping' })); }
            catch (err) { logError("Admin Ping gönderilemedi:", err); }
        }
        // Bağlantı koptuysa onclose zaten yeniden bağlanmayı deneyecektir.
    }, 30000);

    // Giriş yapılmışsa ilk bağlantıyı kur
    connectWebSocket();

    // Component kaldırıldığında veya çıkış yapıldığında temizlik
    return () => {
        clearInterval(pingInterval);
        if (reconnectTimeoutId) clearTimeout(reconnectTimeoutId);
        if (wsRef.current) {
            logInfo("Admin Paneli: Component kaldırılıyor/çıkış yapılıyor, WebSocket kapatılıyor.");
            wsRef.current.onclose = null; // Yeniden bağlanma döngüsünü kır
            wsRef.current.close(1000, "Component unmounting or logout");
            wsRef.current = null;
        }
    };
  // isLoggedIn değiştiğinde bu effect yeniden çalışır ve WS bağlantısını yönetir
  }, [isLoggedIn, API_BASE, logInfo, logError, logWarn, verileriGetir]);

  // --- İlk Veri Çekme ---
  useEffect(() => {
    // Sadece component ilk yüklendiğinde ve localStorage'da giriş varsa verileri çek
    const initialLoggedIn = typeof window !== 'undefined' && localStorage.getItem("adminGiris") === "true";
    if (initialLoggedIn) {
        logInfo("İlk yükleme: Giriş yapılmış görünüyor, veriler çekiliyor...");
        verileriGetir();
    } else {
        logInfo("İlk yükleme: Giriş yapılmamış.");
        setLoading(false); // Giriş yoksa yükleme de olmaz
    }
    // Bu effect sadece mount edildiğinde çalışmalı.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Boş dependency array

  // --- Menü Yönetimi Fonksiyonları ---
  const urunEkle = useCallback(async () => {
    if (!yeniUrun.ad || !yeniUrun.fiyat || !yeniUrun.kategori) { alert("Lütfen ürün adı, fiyatı ve kategorisini girin."); return; }
    logInfo(`➕ Ürün ekleniyor: ${JSON.stringify(yeniUrun)}`);
    setLoading(true); setError(null);
    try {
      await axios.post(`${API_BASE}/menu/ekle`, yeniUrun, { headers: { Authorization: AUTH_HEADER, 'Content-Type': 'application/json' } });
      logInfo("✅ Ürün başarıyla eklendi.");
      setYeniUrun({ ad: "", fiyat: "", kategori: "" });
      await verileriGetir(true); // Verileri tekrar çek (retry=true farketmez ama alışkanlık)
      alert("Ürün başarıyla eklendi.");
    } catch (err) {
      logError("❌ Ürün eklenemedi:", err);
      const errorDetail = err.response?.data?.detail || err.message || "Bilinmeyen bir hata.";
      setError(`Ürün eklenirken bir hata oluştu: ${errorDetail}`);
      alert(`Ürün eklenemedi: ${errorDetail}`);
    } finally { setLoading(false); }
  }, [API_BASE, yeniUrun, verileriGetir, logInfo, logError]);

  const urunSil = useCallback(async () => {
    if (!silUrunAdi) { alert("Lütfen silinecek ürünün adını girin."); return; }
    const urunAdiTrimmedLower = silUrunAdi.trim().toLowerCase();
    const urunVarMi = menu && Array.isArray(menu) && menu.some(kategori =>
        kategori && Array.isArray(kategori.urunler) &&
        kategori.urunler.some(urun => urun?.ad?.toLowerCase() === urunAdiTrimmedLower)
    );
    if (!urunVarMi) { alert(`'${silUrunAdi}' adında bir ürün menüde bulunamadı.`); return; }
    if (!window.confirm(`'${silUrunAdi}' adlı ürünü silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`)) { return; }
    logInfo(`➖ Ürün siliniyor: ${silUrunAdi.trim()}`);
    setLoading(true); setError(null);
    try {
      await axios.delete(`${API_BASE}/menu/sil`, { params: { urun_adi: silUrunAdi.trim() }, headers: { Authorization: AUTH_HEADER } });
      logInfo("🗑️ Ürün başarıyla silindi.");
      setSilUrunAdi("");
      await verileriGetir(true); // Verileri tekrar çek
      alert("Ürün başarıyla silindi.");
    } catch (err) {
      logError("❌ Ürün silinemedi:", err);
       const errorDetail = err.response?.data?.detail || err.message || "Bilinmeyen bir hata.";
       setError(`Ürün silinirken bir hata oluştu: ${errorDetail}`);
       alert(`Ürün silinemedi: ${errorDetail}`);
    } finally { setLoading(false); }
  }, [API_BASE, silUrunAdi, menu, verileriGetir, logInfo, logError]);

  // --- Çıkış Fonksiyonu ---
  const cikisYap = () => {
    logInfo("🚪 Çıkış yapılıyor...");
    if (typeof window !== 'undefined') { localStorage.removeItem("adminGiris"); }
    setIsLoggedIn(false);
    setError(null); // Çıkış yaparken hataları temizle
    // WS bağlantısı useEffect içinde isLoggedIn false olunca kapatılacak
  };

  // --- Sipariş Filtreleme ---
  const filtrelenmisSiparisler = orders.filter( (o) => {
        if (!o || typeof o !== 'object') return false;
        const aramaLower = arama.toLowerCase();
        let sepetText = "";
        if (Array.isArray(o.sepet)) {
             sepetText = o.sepet
               .map(item => (item && typeof item === 'object') ? `${item.adet || '?'}x ${item.urun || '?'}` : '')
               .filter(Boolean).join(' ');
        } else if (typeof o.sepet === 'string') { sepetText = o.sepet; }

        const aranacakMetin = [ String(o.id || ''), String(o.masa || ''), o.durum || "", o.istek || "", o.yanit || "", sepetText ].join(' ').toLowerCase();
        return aranacakMetin.includes(aramaLower);
    }
  );

  // --- Giriş Yapılmadıysa (Erişim Engellendi Mesajı) ---
  if (!isLoggedIn) {
      return (
          <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-100 to-orange-100 p-4">
              <div className="bg-white shadow-xl p-8 rounded-lg text-center border border-red-300 max-w-md w-full">
                  <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                  <h2 className="text-xl font-bold mb-4 text-red-700">Erişim Engellendi</h2>
                  {loading ? ( // Tekrar denerken yükleniyor göster
                    <p className="text-gray-600 mb-4 animate-pulse">Giriş deneniyor...</p>
                  ) : (
                    <>
                      <p className="text-gray-600 mb-4">
                          {error || "Admin paneline erişim yetkiniz bulunmuyor veya oturumunuz sonlanmış."}
                      </p>
                      <p className="text-sm text-gray-500 mb-6">
                          Giriş yapmak için aşağıdaki butonu kullanın veya sayfayı yenileyin.
                      </p>
                      {/* --- GÜNCELLENDİ: Tekrar Dene / Giriş Yap Butonu --- */}
                      <button
                        // onClick ile verileriGetir(true) çağırılır, 401 alınca browser prompt tetiklenir
                        onClick={() => verileriGetir(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-md flex items-center justify-center gap-2 transition duration-200 ease-in-out active:scale-95 mx-auto"
                        disabled={loading}
                      >
                        <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        {loading ? 'Deneniyor...' : 'Tekrar Dene / Giriş Yap'}
                      </button>
                    </>
                  )}
              </div>
          </div>
      );
  }

  // --- Giriş Yapıldıysa Ana Panel ---
  return (
    <div className="p-4 md:p-8 bg-gradient-to-tr from-slate-100 to-slate-200 min-h-screen text-gray-800 font-sans relative">
       {/* Genel Hata Mesajı (Yetki hatası dışındaki hatalar için) */}
       {error && !error.toLowerCase().includes("yetki") && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded relative mb-6 shadow" role="alert">
           <strong className="font-bold">Hata: </strong>
           <span className="block sm:inline mr-2">{error}</span>
            {/* --- GÜNCELLENDİ: Hata mesajına tekrar deneme butonu --- */}
            <button
                onClick={() => verileriGetir(true)} // Burası da tekrar denemeyi tetikler
                className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-semibold transition duration-200 ease-in-out ml-4"
                disabled={loading}
            >
                {loading ? 'Yükleniyor...' : 'Tekrar Dene'}
            </button>
        </div>
      )}

      {/* Yükleniyor Göstergesi (Tam Ekran Overlay) */}
      {loading && (
          <div className="fixed inset-0 bg-black/10 backdrop-blur-sm flex items-center justify-center z-50">
              <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500"></div>
          </div>
      )}

      {/* Başlık ve Çıkış Butonu */}
      <div className="flex flex-wrap justify-between items-center mb-8 gap-4">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-800 flex items-center gap-3">
            <Settings className="w-8 h-8 text-blue-600" /> Admin Paneli ({ADMIN_USERNAME})
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
        <div className="bg-white p-5 rounded-lg shadow-md border-t-4 border-blue-500">
          <h3 className="text-base font-semibold mb-2 flex items-center gap-2 text-gray-600"> <Coffee className="w-5 h-5 text-blue-500" /> Günlük Ürün Adedi </h3>
          <CountUp end={gunluk?.siparis_sayisi || 0} separator="." className="text-3xl font-bold text-blue-700 block" />
        </div>
        <div className="bg-white p-5 rounded-lg shadow-md border-t-4 border-green-500">
          <h3 className="text-base font-semibold mb-2 flex items-center gap-2 text-gray-600"> ₺ Günlük Gelir </h3>
          <CountUp end={gunluk?.gelir || 0} separator="." decimal="," decimals={2} suffix=" ₺" className="text-3xl font-bold text-green-700 block" />
        </div>
        <div className="bg-white p-5 rounded-lg shadow-md border-t-4 border-purple-500">
          <h3 className="text-base font-semibold mb-2 flex items-center gap-2 text-gray-600"> <UserCheck className="w-5 h-5 text-purple-500" /> Aktif Masalar </h3>
          <CountUp end={aktifMasaSayisi} separator="." className="text-3xl font-bold text-purple-700 block" />
        </div>
        <div className="bg-white p-5 rounded-lg shadow-md border-t-4 border-orange-500">
          <h3 className="text-base font-semibold mb-2 flex items-center gap-2 text-gray-600"> 🏆 En Çok Satan </h3>
          {populer && populer[0] ? ( <p className="text-lg font-bold text-orange-700 truncate" title={populer[0].urun}> {populer[0].urun} <span className="text-sm font-normal text-gray-500 ml-2"> ({populer[0].adet} adet) </span> </p> ) : ( <p className="text-gray-500 text-sm">Veri yok</p> )}
        </div>
      </div>

      {/* Grafik ve İstatistikler */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Yıllık Sipariş Grafiği */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold mb-4 text-gray-700">📈 Aylık Satılan Ürün Adedi</h3>
          <div className="h-64">
             {yillikChartData && yillikChartData.length > 0 ? ( <ResponsiveContainer width="100%" height="100%"> <LineChart data={yillikChartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}> <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0"/> <XAxis dataKey="tarih" fontSize={12} /> <YAxis fontSize={12} allowDecimals={false} /> <Tooltip formatter={(value) => [`${value} Adet`, 'Toplam Ürün']}/> <Legend /> <Line type="monotone" dataKey="adet" name="Aylık Ürün Adedi" stroke="#4F46E5" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} /> </LineChart> </ResponsiveContainer> ) : ( <div className="flex items-center justify-center h-full text-gray-500">Yıllık veri bulunamadı.</div> )}
          </div>
        </div>
        {/* En Çok Satan Ürünler Grafiği */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold mb-4 text-gray-700">📊 En Çok Satan 5 Ürün (Adet)</h3>
          <div className="h-64">
            {populer && populer.length > 0 ? ( <ResponsiveContainer width="100%" height="100%"> <BarChart data={populer} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}> <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0"/> <XAxis type="number" fontSize={12} allowDecimals={false} /> <YAxis dataKey="urun" type="category" fontSize={12} width={100} tick={{ textAnchor: 'end', width: 95 }}/> <Tooltip formatter={(value) => [`${value} Adet`, 'Satış Adedi']}/> <Bar dataKey="adet" name="Satış Adedi" fill="#FB923C" barSize={20} /> </BarChart> </ResponsiveContainer> ) : ( <div className="flex items-center justify-center h-full text-gray-500">Popüler ürün verisi bulunamadı.</div> )}
          </div>
        </div>
      </div>

      {/* Menü Yönetimi */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-8">
        <h3 className="text-lg font-semibold mb-4 text-gray-700 flex items-center gap-2"><MenuSquare className="w-5 h-5 text-teal-600"/> Menü Yönetimi</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Ürün Ekleme Formu */}
          <div className="md:col-span-1 space-y-6">
            <div>
              <h4 className="font-medium mb-3 text-gray-600">Yeni Ürün Ekle</h4>
              <form onSubmit={(e) => { e.preventDefault(); urunEkle(); }}>
                  <div className="space-y-3">
                  <input type="text" placeholder="Ürün Adı" value={yeniUrun.ad} onChange={(e) => setYeniUrun({ ...yeniUrun, ad: e.target.value })} className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-500" required />
                  <input type="number" placeholder="Fiyat (örn: 25.50)" value={yeniUrun.fiyat} onChange={(e) => setYeniUrun({ ...yeniUrun, fiyat: e.target.value })} className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-500" step="0.01" min="0" required />
                  <input type="text" placeholder="Kategori" value={yeniUrun.kategori} onChange={(e) => setYeniUrun({ ...yeniUrun, kategori: e.target.value })} className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-500" required />
                  <button type="submit" disabled={loading} className={`w-full text-white py-2 rounded shadow transition duration-200 ease-in-out active:scale-95 flex items-center justify-center gap-2 ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-teal-600 hover:bg-teal-700'}`} > <PlusCircle className="w-4 h-4"/> Ürün Ekle </button>
                  </div>
              </form>
            </div>
             {/* Ürün Silme Formu */}
            <div className="pt-4 border-t">
                 <h4 className="font-medium mb-3 text-gray-600">Ürün Sil</h4>
                 <form onSubmit={(e) => { e.preventDefault(); urunSil(); }}>
                     <div className="space-y-3">
                        <input type="text" placeholder="Silinecek Ürün Adı" value={silUrunAdi} onChange={(e) => setSilUrunAdi(e.target.value)} className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-red-500" required />
                        <button type="submit" disabled={!silUrunAdi.trim() || loading} className={`w-full text-white py-2 rounded shadow transition duration-200 ease-in-out active:scale-95 flex items-center justify-center gap-2 ${ !silUrunAdi.trim() || loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700' }`} > <Trash2 className="w-4 h-4"/> Ürün Sil </button>
                     </div>
                 </form>
            </div>
          </div>
          {/* Mevcut Menü Gösterimi */}
          <div className="md:col-span-2">
             <h4 className="font-medium mb-3 text-gray-600">Mevcut Menü</h4>
             {/* Menü yüklenirken veya boşsa mesaj göster */}
             {loading && (!menu || menu.length === 0) && ( <div className="text-center py-10 text-gray-400 italic">Menü yükleniyor...</div> )}
             {!loading && (!menu || menu.length === 0) && ( <div className="text-center py-10 text-gray-500">Menü boş veya yüklenemedi.</div> )}
             {/* Menü varsa göster */}
             {menu && menu.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-h-96 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                    {menu.map((kategori) => (
                      <div key={kategori.kategori} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                        <h5 className="font-semibold mb-2 text-teal-700">{kategori.kategori}</h5>
                        <ul className="space-y-1 text-sm">
                          {/* Kategoride ürün yoksa mesaj göster */}
                          {(!kategori.urunler || kategori.urunler.length === 0) && ( <li className="text-xs text-gray-400 italic">Bu kategoride ürün yok.</li> )}
                          {/* Ürünleri listele */}
                          {kategori.urunler?.map((urun) => (
                            <li key={`<span class="math-inline">\{kategori\.kategori\}\-</span>{urun.ad}`} className="flex justify-between items-center border-b border-gray-100 py-1 last:border-b-0">
                              <span className={urun.stok_durumu === 0 ? 'text-red-500 line-through' : ''} title={urun.ad}>{urun.ad}</span>
                              <span className={`font-medium whitespace-nowrap ${urun.stok_durumu === 0 ? 'text-red-400' : 'text-gray-700'}`}>
                                  {/* Fiyatı güvenli göster */}
                                  {typeof urun.fiyat === 'number' ? urun.fiyat.toFixed(2) : 'N/A'}₺
                                  {urun.stok_durumu === 0 && <span className="text-xs ml-1">(Stokta Yok)</span>}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                </div>
             )}
          </div>
        </div>
      </div>

      {/* Sipariş Listesi */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-lg font-semibold mb-4 text-gray-700">📋 Sipariş Geçmişi</h3>
        <input type="text" placeholder="Sipariş Ara (ID, Masa, Durum, İçerik, Not...)" value={arama} onChange={(e) => setArama(e.target.value)} className="w-full p-3 border border-gray-300 rounded mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 border border-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Masa</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sipariş İçeriği & Not</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Durum</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tarih</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {/* Yükleme Durumu */}
              {loading && (!orders || orders.length === 0) && ( <tr> <td colSpan="5" className="text-center py-10 text-gray-400 italic">Siparişler yükleniyor...</td> </tr> )}
              {/* Yükleme bitti, sonuç yoksa */}
              {!loading && filtrelenmisSiparisler.length === 0 && ( <tr> <td colSpan="5" className="text-center py-10 text-gray-500"> {arama ? 'Aramanızla eşleşen sipariş bulunamadı.' : (orders.length === 0 ? 'Henüz sipariş yok.' : 'Filtreyle eşleşen sipariş bulunamadı.')} </td> </tr> )}
              {/* Siparişler varsa listele */}
              {filtrelenmisSiparisler.length > 0 && filtrelenmisSiparisler.map((siparis) => {
                   // Sepet detayını güvenli bir şekilde oluştur
                   let sepetDetay = "Detay yok";
                   if (Array.isArray(siparis.sepet) && siparis.sepet.length > 0) {
                       sepetDetay = siparis.sepet
                           .map(item => (item && typeof item === 'object') ? `${item.adet || '?'}x ${item.urun || '?'}` : '')
                           .filter(Boolean) // Boş stringleri filtrele
                           .join(", ");
                   } else if (typeof siparis.sepet === 'string' && siparis.sepet.trim() !== '' && siparis.sepet !== '[]') {
                       sepetDetay = "Detay okunamadı (Format Hatalı)";
                   }
                   // Tooltip için tam metin
                   const fullText = `<span class="math-inline">\{sepetDetay\}</span>{siparis.istek ? ` | Not: ${siparis.istek}` : ''}`;

                   return (
                       <tr key={siparis.id} className="hover:bg-gray-50 text-sm">
                         <td className="px-4 py-3 whitespace-nowrap text-gray-700">#{siparis.id}</td>
                         <td className="px-4 py-3 whitespace-nowrap font-medium">Masa {siparis.masa}</td>
                         {/* İçerik ve Not */}
                         <td className="px-4 py-3">
                             <div className="max-w-xs truncate" title={fullText}>
                                {sepetDetay || (siparis.istek ? '(Sadece Not)' : '(İçerik Yok)')}
                             </div>
                             {siparis.istek && (
                               <div className="text-xs text-gray-500 mt-1 italic truncate" title={`Not: ${siparis.istek}`}>
                                   💬 {siparis.istek}
                               </div>
                             )}
                         </td>
                         {/* Durum */}
                         <td className="px-4 py-3 whitespace-nowrap">
                           <span className={`px-2.5 py-1 text-xs font-semibold rounded-full leading-tight ${
                               siparis.durum === "hazir" ? "bg-green-100 text-green-800" :
                               siparis.durum === "hazirlaniyor" ? "bg-blue-100 text-blue-800" :
                               siparis.durum === "iptal" ? "bg-red-100 text-red-800 line-through" :
                               "bg-yellow-100 text-yellow-800" // Bekliyor veya diğer
                           }`} >
                               {siparis.durum || "Bilinmiyor"}
                           </span>
                         </td>
                         {/* Tarih */}
                         <td className="px-4 py-3 whitespace-nowrap text-gray-500">
                            {siparis.zaman ? new Date(siparis.zaman).toLocaleString("tr-TR", {
                               year: 'numeric', month: 'numeric', day: 'numeric',
                               hour: '2-digit', minute: '2-digit'
                            }) : "-"}
                         </td>
                       </tr>
                   );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ayarlar Bölümü */}
      <div className="bg-white p-6 rounded-lg shadow-md mt-8">
        <h3 className="text-lg font-semibold mb-4 text-gray-700">⚙️ Ayarlar</h3>
        <p className="text-sm text-gray-600">
          Admin kullanıcı adı ve şifresi gibi yapılandırmalar sunucu tarafında ortam değişkenleri (`ADMIN_USERNAME`, `ADMIN_PASSWORD`) ile yönetilmektedir. Frontend tarafında kullanılan kimlik bilgileri ise `.env` dosyasındaki `REACT_APP_ADMIN_USERNAME` ve `REACT_APP_ADMIN_PASSWORD` değişkenlerinden okunur. Değişiklik için bu değişkenleri güncellemeniz ve hem backend'i hem de frontend build'ini yeniden başlatmanız/deploy etmeniz gerekir.
        </p>
      </div>

    </div> // Ana container kapanışı
  );
}

export default AdminPaneli;
bu kodu güncelledim ama hata devam ediyor
Giriş Yapıldıysa Ana Panel ---
  return (
    <div className="p-4 md:p-8 bg-gradient-to-tr from-slate-100 to-slate-200 min-h-screen text-gray-800 font-sans relative">
       {/* Genel Hata Mesajı (Yetki hatası dışındaki hatalar için) */}
       {error && !error.toLowerCase().includes("yetki") && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded relative mb-6 shadow" role="alert">
           <strong className="font-bold">Hata: </strong>
           <span className="block sm:inline mr-2">{error}</span>
            {/* --- GÜNCELLENDİ: Hata mesajına tekrar deneme butonu --- */}
            <button
                onClick={() => verileriGetir(true)}
                className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-semibold transition duration-200 ease-in-out ml-4"
                disabled={loading}
            >
                {loading ? 'Yükleniyor...' : 'Tekrar Dene'}
            </button>
        </div>
      )}

      {/* Yükleniyor Göstergesi (Tam Ekran Overlay) */}
      {loading && (
          <div className="fixed inset-0 bg-black/10 backdrop-blur-sm flex items-center justify-center z-50">
              <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500"></div>
          </div>
      )}

      {/* Başlık ve Çıkış Butonu */}
      <div className="flex flex-wrap justify-between items-center mb-8 gap-4">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-800 flex items-center gap-3">
            <Settings className="w-8 h-8 text-blue-600" /> Admin Paneli ({ADMIN_USERNAME})
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
        <div className="bg-white p-5 rounded-lg shadow-md border-t-4 border-blue-500">
          <h3 className="text-base font-semibold mb-2 flex items-center gap-2 text-gray-600"> <Coffee className="w-5 h-5 text-blue-500" /> Günlük Ürün Adedi </h3>
          <CountUp end={gunluk?.siparis_sayisi || 0} separator="." className="text-3xl font-bold text-blue-700 block" />
        </div>
        <div className="bg-white p-5 rounded-lg shadow-md border-t-4 border-green-500">
          <h3 className="text-base font-semibold mb-2 flex items-center gap-2 text-gray-600"> ₺ Günlük Gelir </h3>
          <CountUp end={gunluk?.gelir || 0} separator="." decimal="," decimals={2} suffix=" ₺" className="text-3xl font-bold text-green-700 block" />
        </div>
        <div className="bg-white p-5 rounded-lg shadow-md border-t-4 border-purple-500">
          <h3 className="text-base font-semibold mb-2 flex items-center gap-2 text-gray-600"> <UserCheck className="w-5 h-5 text-purple-500" /> Aktif Masalar </h3>
          <CountUp end={aktifMasaSayisi} separator="." className="text-3xl font-bold text-purple-700 block" />
        </div>
        <div className="bg-white p-5 rounded-lg shadow-md border-t-4 border-orange-500">
          <h3 className="text-base font-semibold mb-2 flex items-center gap-2 text-gray-600"> 🏆 En Çok Satan </h3>
          {populer && populer[0] ? ( <p className="text-lg font-bold text-orange-700 truncate" title={populer[0].urun}> {populer[0].urun} <span className="text-sm font-normal text-gray-500 ml-2"> ({populer[0].adet} adet) </span> </p> ) : ( <p className="text-gray-500 text-sm">Veri yok</p> )}
        </div>
      </div>

      {/* Grafik ve İstatistikler */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Yıllık Sipariş Grafiği */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold mb-4 text-gray-700">📈 Aylık Satılan Ürün Adedi</h3>
          <div className="h-64">
             {yillikChartData && yillikChartData.length > 0 ? ( <ResponsiveContainer width="100%" height="100%"> <LineChart data={yillikChartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}> <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0"/> <XAxis dataKey="tarih" fontSize={12} /> <YAxis fontSize={12} allowDecimals={false} /> <Tooltip formatter={(value) => [`${value} Adet`, 'Toplam Ürün']}/> <Legend /> <Line type="monotone" dataKey="adet" name="Aylık Ürün Adedi" stroke="#4F46E5" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} /> </LineChart> </ResponsiveContainer> ) : ( <div className="flex items-center justify-center h-full text-gray-500">Yıllık veri bulunamadı.</div> )}
          </div>
        </div>
        {/* En Çok Satan Ürünler Grafiği */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold mb-4 text-gray-700">📊 En Çok Satan 5 Ürün (Adet)</h3>
          <div className="h-64">
            {populer && populer.length > 0 ? ( <ResponsiveContainer width="100%" height="100%"> <BarChart data={populer} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}> <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0"/> <XAxis type="number" fontSize={12} allowDecimals={false} /> <YAxis dataKey="urun" type="category" fontSize={12} width={100} tick={{ textAnchor: 'end', width: 95 }}/> <Tooltip formatter={(value) => [`${value} Adet`, 'Satış Adedi']}/> <Bar dataKey="adet" name="Satış Adedi" fill="#FB923C" barSize={20} /> </BarChart> </ResponsiveContainer> ) : ( <div className="flex items-center justify-center h-full text-gray-500">Popüler ürün verisi bulunamadı.</div> )}
          </div>
        </div>
      </div>

      {/* Menü Yönetimi */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-8">
        <h3 className="text-lg font-semibold mb-4 text-gray-700 flex items-center gap-2"><MenuSquare className="w-5 h-5 text-teal-600"/> Menü Yönetimi</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Ürün Ekleme Formu */}
          <div className="md:col-span-1 space-y-6">
            <div>
              <h4 className="font-medium mb-3 text-gray-600">Yeni Ürün Ekle</h4>
              <form onSubmit={(e) => { e.preventDefault(); urunEkle(); }}>
                  <div className="space-y-3">
                  <input type="text" placeholder="Ürün Adı" value={yeniUrun.ad} onChange={(e) => setYeniUrun({ ...yeniUrun, ad: e.target.value })} className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-500" required />
                  <input type="number" placeholder="Fiyat (örn: 25.50)" value={yeniUrun.fiyat} onChange={(e) => setYeniUrun({ ...yeniUrun, fiyat: e.target.value })} className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-500" step="0.01" min="0" required />
                  <input type="text" placeholder="Kategori" value={yeniUrun.kategori} onChange={(e) => setYeniUrun({ ...yeniUrun, kategori: e.target.value })} className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-500" required />
                  <button type="submit" disabled={loading} className={`w-full text-white py-2 rounded shadow transition duration-200 ease-in-out active:scale-95 flex items-center justify-center gap-2 ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-teal-600 hover:bg-teal-700'}`} > <PlusCircle className="w-4 h-4"/> Ürün Ekle </button>
                  </div>
              </form>
            </div>
             {/* Ürün Silme Formu */}
            <div className="pt-4 border-t">
                 <h4 className="font-medium mb-3 text-gray-600">Ürün Sil</h4>
                 <form onSubmit={(e) => { e.preventDefault(); urunSil(); }}>
                     <div className="space-y-3">
                        <input type="text" placeholder="Silinecek Ürün Adı" value={silUrunAdi} onChange={(e) => setSilUrunAdi(e.target.value)} className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-red-500" required />
                        <button type="submit" disabled={!silUrunAdi.trim() || loading} className={`w-full text-white py-2 rounded shadow transition duration-200 ease-in-out active:scale-95 flex items-center justify-center gap-2 ${ !silUrunAdi.trim() || loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700' }`} > <Trash2 className="w-4 h-4"/> Ürün Sil </button>
                     </div>
                 </form>
            </div>
          </div>
          {/* Mevcut Menü Gösterimi */}
          <div className="md:col-span-2">
             <h4 className="font-medium mb-3 text-gray-600">Mevcut Menü</h4>
             {/* Menü yüklenirken veya boşsa mesaj göster */}
             {loading && (!menu || menu.length === 0) && ( <div className="text-center py-10 text-gray-400 italic">Menü yükleniyor...</div> )}
             {!loading && (!menu || menu.length === 0) && ( <div className="text-center py-10 text-gray-500">Menü boş veya yüklenemedi.</div> )}
             {/* Menü varsa göster */}
             {menu && menu.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-h-96 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                    {menu.map((kategori) => (
                      <div key={kategori.kategori} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                        <h5 className="font-semibold mb-2 text-teal-700">{kategori.kategori}</h5>
                        <ul className="space-y-1 text-sm">
                          {/* Kategoride ürün yoksa mesaj göster */}
                          {(!kategori.urunler || kategori.urunler.length === 0) && ( <li className="text-xs text-gray-400 italic">Bu kategoride ürün yok.</li> )}
                          {/* Ürünleri listele */}
                          {kategori.urunler?.map((urun) => (
                            <li key={`<span class="math-inline">\{kategori\.kategori\}\-</span>{urun.ad}`} className="flex justify-between items-center border-b border-gray-100 py-1 last:border-b-0">
                              <span className={urun.stok_durumu === 0 ? 'text-red-500 line-through' : ''} title={urun.ad}>{urun.ad}</span>
                              <span className={`font-medium whitespace-nowrap ${urun.stok_durumu === 0 ? 'text-red-400' : 'text-gray-700'}`}>
                                  {/* Fiyatı güvenli göster */}
                                  {typeof urun.fiyat === 'number' ? urun.fiyat.toFixed(2) : 'N/A'}₺
                                  {urun.stok_durumu === 0 && <span className="text-xs ml-1">(Stokta Yok)</span>}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                </div>
             )}
          </div>
        </div>
      </div>


      {/* Sipariş Listesi */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-lg font-semibold mb-4 text-gray-700">📋 Sipariş Geçmişi</h3>
        <input type="text" placeholder="Sipariş Ara (ID, Masa, Durum, İçerik, Not...)" value={arama} onChange={(e) => setArama(e.target.value)} className="w-full p-3 border border-gray-300 rounded mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 border border-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Masa</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sipariş İçeriği & Not</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Durum</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tarih</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {/* Yükleme Durumu */}
              {loading && (!orders || orders.length === 0) && ( <tr> <td colSpan="5" className="text-center py-10 text-gray-400 italic">Siparişler yükleniyor...</td> </tr> )}
              {/* Yükleme bitti, sonuç yoksa */}
              {!loading && filtrelenmisSiparisler.length === 0 && ( <tr> <td colSpan="5" className="text-center py-10 text-gray-500"> {arama ? 'Aramanızla eşleşen sipariş bulunamadı.' : (orders.length === 0 ? 'Henüz sipariş yok.' : 'Filtreyle eşleşen sipariş bulunamadı.')} </td> </tr> )}
              {/* Siparişler varsa listele */}
              {filtrelenmisSiparisler.length > 0 && filtrelenmisSiparisler.map((siparis) => {
                   // Sepet detayını güvenli bir şekilde oluştur
                   let sepetDetay = "Detay yok";
                   if (Array.isArray(siparis.sepet) && siparis.sepet.length > 0) {
                       sepetDetay = siparis.sepet
                           .map(item => (item && typeof item === 'object') ? `${item.adet || '?'}x ${item.urun || '?'}` : '')
                           .filter(Boolean) // Boş stringleri filtrele
                           .join(", ");
                   } else if (typeof siparis.sepet === 'string' && siparis.sepet.trim() !== '' && siparis.sepet !== '[]') {
                       sepetDetay = "Detay okunamadı (Format Hatalı)";
                   }
                   // Tooltip için tam metin
                   const fullText = `<span class="math-inline">\{sepetDetay\}</span>{siparis.istek ? ` | Not: ${siparis.istek}` : ''}`;

                   return (
                      <tr key={siparis.id} className="hover:bg-gray-50 text-sm">
                        <td className="px-4 py-3 whitespace-nowrap text-gray-700">#{siparis.id}</td>
                        <td className="px-4 py-3 whitespace-nowrap font-medium">Masa {siparis.masa}</td>
                        {/* İçerik ve Not */}
                        <td className="px-4 py-3">
                            <div className="max-w-xs truncate" title={fullText}>
                               {sepetDetay || (siparis.istek ? '(Sadece Not)' : '(İçerik Yok)')}
                            </div>
                            {siparis.istek && (
                              <div className="text-xs text-gray-500 mt-1 italic truncate" title={`Not: ${siparis.istek}`}>
                                  💬 {siparis.istek}
                              </div>
                          )}
                        </td>
                        {/* Durum */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`px-2.5 py-1 text-xs font-semibold rounded-full leading-tight ${
                              siparis.durum === "hazir" ? "bg-green-100 text-green-800" :
                              siparis.durum === "hazirlaniyor" ? "bg-blue-100 text-blue-800" :
                              siparis.durum === "iptal" ? "bg-red-100 text-red-800 line-through" :
                              "bg-yellow-100 text-yellow-800" // Bekliyor veya diğer
                          }`} >
                              {siparis.durum || "Bilinmiyor"}
                          </span>
                        </td>
                        {/* Tarih */}
                        <td className="px-4 py-3 whitespace-nowrap text-gray-500">
                           {siparis.zaman ? new Date(siparis.zaman).toLocaleString("tr-TR", {
                              year: 'numeric', month: 'numeric', day: 'numeric',
                              hour: '2-digit', minute: '2-digit'
                           }) : "-"}
                        </td>
                      </tr>
                  );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ayarlar Bölümü */}
      <div className="bg-white p-6 rounded-lg shadow-md mt-8">
        <h3 className="text-lg font-semibold mb-4 text-gray-700">⚙️ Ayarlar</h3>
        <p className="text-sm text-gray-600">
            Admin kullanıcı adı ve şifresi gibi yapılandırmalar sunucu tarafında ortam değişkenleri (`ADMIN_USERNAME`, `ADMIN_PASSWORD`) ile yönetilmektedir. Frontend tarafında kullanılan kimlik bilgileri ise `.env` dosyasındaki `REACT_APP_ADMIN_USERNAME` ve `REACT_APP_ADMIN_PASSWORD` değişkenlerinden okunur. Değişiklik için bu değişkenleri güncellemeniz ve hem backend'i hem de frontend build'ini yeniden başlatmanız/deploy etmeniz gerekir.
        </p>
      </div>

    </div> // Ana container kapanışı
  );
}

export default AdminPaneli;