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

// API Base URL ortam değişkeninden okunur
const API_BASE = process.env.REACT_APP_API_BASE;

// --- YENİ: Kimlik Bilgilerini Ortam Değişkenlerinden Oku ---
// Frontend'inizin .env dosyasında veya build ortamında bu değişkenleri ayarlayın.
// Örnek .env içeriği:
// REACT_APP_API_BASE=http://localhost:8000
// REACT_APP_ADMIN_USERNAME=admin
// REACT_APP_ADMIN_PASSWORD=gercek_sifreniz
const ADMIN_USERNAME = process.env.REACT_APP_ADMIN_USERNAME || "admin"; // Varsayılan: admin
const ADMIN_PASSWORD = process.env.REACT_APP_ADMIN_PASSWORD || "admin123"; // Varsayılan: admin123

// Basic Auth başlığını dinamik olarak oluştur
const AUTH_HEADER = "Basic " + btoa(`${ADMIN_USERNAME}:${ADMIN_PASSWORD}`);
// --------------------------------------------------------------

function AdminPaneli() {
  // --- State Tanımlamaları ---
  const [orders, setOrders] = useState([]); // Sipariş listesi
  const [arama, setArama] = useState(""); // Sipariş arama metni
  // Giriş durumu localStorage'dan okunur, sayfa yenilense bile korunur
  // Not: Bu localStorage kullanımı, API'den 401 hatası alındığında otomatik olarak temizlenir.
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
    // Eğer daha önce yetki hatası alındıysa tekrar denemeyi durdurabiliriz
    // Veya her seferinde deneyip 401 alınca tekrar isLoggedIn'i false yaparız (mevcut mantık)
    // if (!isLoggedIn && localStorage.getItem("adminGiris") !== "true") {
    //    logWarn("Giriş yapılmamış veya yetki hatası alınmış, veri çekme atlanıyor.");
    //    setLoading(false);
    //    return;
    // }

    logInfo("🔄 Tüm veriler getiriliyor...");
    setLoading(true); // Yükleme başlangıcı
    setError(null); // Önceki hatayı temizle (yeni denemede)

    if (!API_BASE) {
      logError("API_BASE tanımlı değil.");
      setError("API adresi yapılandırılmamış.");
      setLoading(false);
      return;
    }

    // Her veri çekme denemesinde localStorage'ı tekrar kontrol etmek yerine
    // API'den 401 hatası alırsak isLoggedIn'i false yapıp localStorage'ı temizleyelim.
    // İlk yüklemede localStorage'dan okunan isLoggedIn state'i kullanılır.
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
        // Auth gerektiren endpointler için headers eklenir
        axios.get(`${API_BASE}/siparisler`, { headers }),
        // Bu endpointlerin main.py'de auth gerektirmediği varsayılıyor.
        // Eğer gerektiriyorlarsa, buraya da { headers } eklenmeli.
        axios.get(`${API_BASE}/istatistik/gunluk`),
        axios.get(`${API_BASE}/istatistik/aylik`),
        axios.get(`${API_BASE}/istatistik/yillik`),
        axios.get(`${API_BASE}/istatistik/en-cok-satilan`),
        axios.get(`${API_BASE}/aktif-masalar`),
        axios.get(`${API_BASE}/menu`)
      ]);

      // Veri başarıyla alındıysa, giriş yapılmış sayılır ve localStorage güncellenir.
      if (typeof window !== 'undefined') {
          localStorage.setItem("adminGiris", "true");
          // Eğer daha önce false ise state'i güncelle (ilk başarılı giriş sonrası)
          // Bu kontrol, state'in gereksiz yere güncellenmesini önler.
          // Ancak mevcut kodda zaten useEffect dependency'si var,
          // bu yüzden setIsLoggedIn'i burada çağırmak döngüye neden olabilir.
          // 401 hatası olmadıkça isLoggedIn'in true kalması yeterli.
      }
      // setIsLoggedIn(true); // Bu satır döngüye neden olabilir, kaldırıldı. Hata olmazsa zaten true'dur veya useEffect ile gelir.


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

      // setError(null); // Zaten yukarıda temizlendi
      logInfo("✅ Tüm veriler başarıyla getirildi.");

    } catch (err) {
      logError("❌ Veriler alınamadı:", err);
      const errorDetail = err.response?.data?.detail || err.message || "Bilinmeyen bir hata oluştu.";
      if (err.response?.status === 401) {
          setError("Verileri görüntülemek için yetkiniz yok veya kimlik bilgileri hatalı. Lütfen doğru bilgilerle tekrar deneyin.");
          // Yetki hatası alındığında localStorage'ı temizle ve state'i güncelle
          if (typeof window !== 'undefined') {
              localStorage.removeItem("adminGiris");
          }
          setIsLoggedIn(false); // Yetki hatasıysa çıkış yapmış sayalım
      } else {
          // Diğer hatalar (503 vb.) için genel hata mesajı
          setError(`Veriler alınamadı: ${errorDetail}`);
          // Diğer hatalarda çıkış yapmış saymaya gerek yok, belki geçici bir sunucu sorunudur.
      }
    } finally {
        setLoading(false); // Yükleme bitti
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [API_BASE, logInfo, logError]); // isLoggedIn'i dependency array'den çıkardık, çünkü 401 hatası ile yönetiliyor.

  // --- WebSocket Bağlantısı ---
   useEffect(() => {
    // Sadece giriş yapıldıysa WebSocket'e bağlanmaya çalış
    // isLoggedIn state'i localStorage'dan veya 401 hatası sonrası güncellenir.
    if (!isLoggedIn) {
        // Eğer bağlantı varsa ve çıkış yapıldıysa kapat
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            logInfo("Çıkış yapıldı, WebSocket bağlantısı kapatılıyor.");
            wsRef.current.close(1000, "User logged out");
            wsRef.current = null; // Referansı temizle
        }
        return; // Giriş yapılmadıysa fonksiyondan çık
    }

    // Giriş yapılmışsa WebSocket bağlantısını kur/yönet
    const connectWebSocket = () => {
        // Mevcut ve açık bir bağlantı varsa tekrar kurma
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            // logInfo("WebSocket zaten bağlı."); // Çok sık log olabilir
            return;
        }
        if (!API_BASE) {
            logError("API_BASE tanımlı değil, WebSocket bağlantısı kurulamıyor.");
            return;
        }

      try {
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsHost = API_BASE.replace(/^https?:\/\//, '');
        // Admin WebSocket endpoint'i
        const wsUrl = `${wsProtocol}//${wsHost}/ws/admin`;

        logInfo(`📡 Admin WebSocket bağlantısı deneniyor: ${wsUrl}`);
        wsRef.current = new WebSocket(wsUrl);

        wsRef.current.onopen = () => {
          logInfo("✅ Admin WebSocket bağlantısı başarılı.");
          // setError(null); // Bağlantı hatasını temizlemek yerine belki sadece WS özelinde bir state tutulabilir
        };

        wsRef.current.onmessage = (event) => {
          try {
             const message = JSON.parse(event.data);
             logInfo(`📥 Admin WS mesajı alındı: Tip: ${message.type}`);

             // Yeni sipariş veya durum güncellemesi geldiğinde tüm verileri yeniden çek
             // Bu yöntem basit ama çok verimli olmayabilir, sadece ilgili veriyi güncellemek daha iyi olabilir.
             if (message.type === 'siparis' || message.type === 'durum' || message.type === 'masa_durum') {
                 logInfo(`⚡ Gerçek zamanlı güncelleme alındı (${message.type}), veriler yenileniyor...`);
                 verileriGetir(); // Paneli güncelle
             } else if (message.type === 'pong') {
                 // Ping yanıtı, sorun yok.
             } else {
                logWarn(`⚠️ Bilinmeyen Admin WS mesaj tipi: ${message.type}`);
             }
          } catch (err) {
              logError("Admin WS mesajı işlenirken hata:", err)
          }
        };

        wsRef.current.onerror = (errorEvent) => {
          logError("❌ Admin WebSocket hatası:", errorEvent);
          setError("Sunucuyla anlık bağlantı kesildi (WebSocket)."); // Hata mesajını daha spesifik yap
        };

        wsRef.current.onclose = (event) => {
          logInfo(`🔌 Admin WebSocket bağlantısı kapandı. Kod: ${event.code}, Sebep: ${event.reason}`);
          wsRef.current = null; // Referansı temizle
           // Eğer kullanıcı hala giriş yapmış durumdaysa (state olarak) ve bağlantı beklenmedik şekilde kapandıysa tekrar dene
          if (isLoggedIn && event.code !== 1000 && event.code !== 1001) { // 1001 normal kapanma (örn: sayfa kapatma)
            logInfo("Admin WS beklenmedik şekilde kapandı, 5 saniye sonra tekrar denenecek...");
            // setTimeout içinde tekrar isLoggedIn kontrolü yapmak iyi olabilir
            setTimeout(() => {
                // Tekrar denemeden önce hala giriş yapmış durumda mıyız?
                // State anlık güncellenmeyebilir, bu yüzden doğrudan localStorage'a bakılabilir VEYA
                // isLoggedIn state'ine güvenilir. Şimdilik state'e güvenelim.
                if (isLoggedIn) {
                    connectWebSocket();
                } else {
                    logInfo("Tekrar bağlanma iptal edildi, kullanıcı çıkış yapmış.");
                }
            }, 5000);
          }
        };

      } catch (error) {
        logError("❌ Admin WebSocket başlatılırken kritik hata:", error);
        setError("Sunucu bağlantısı (WebSocket) kurulamıyor.");
      }
    };

    // Periyodik ping (sadece bağlantı açıkken ve giriş yapılmışken)
     const pingInterval = setInterval(() => {
      if (isLoggedIn && wsRef.current?.readyState === WebSocket.OPEN) {
         try { wsRef.current.send(JSON.stringify({ type: 'ping' })); }
         catch (err) { logError("Admin Ping gönderilemedi:", err); }
      }
      // Kapalıysa ve hala giriş yapmış görünüyorsak tekrar bağlanmayı dene (onclose zaten yapıyor ama ek kontrol)
      // else if (isLoggedIn && (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED)) {
      //      logInfo("Admin Ping: Bağlantı kapalı, tekrar bağlanılıyor...");
      //      connectWebSocket();
      // }
    }, 30000);

    // Giriş yapmışsak bağlantıyı kur
    connectWebSocket();

    // Component kaldırıldığında veya isLoggedIn false olduğunda temizlik
    return () => {
      clearInterval(pingInterval);
      if (wsRef.current) {
        logInfo("Admin Paneli: Component kaldırılıyor/çıkış yapılıyor, WebSocket kapatılıyor.");
        wsRef.current.close(1000, "Component unmounting or logout");
        wsRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, API_BASE, verileriGetir, logInfo, logError, logWarn]); // verileriGetir'i dependency array'e ekledik, çünkü WS mesajı gelince çağrılıyor.

  // --- İlk Veri Çekme ---
  useEffect(() => {
    // Sayfa ilk yüklendiğinde, localStorage'dan okunan isLoggedIn durumuna göre verileri çekmeyi dene
    if (isLoggedIn) {
        logInfo("İlk yükleme: Giriş yapılmış görünüyor, veriler çekiliyor...");
      verileriGetir();
    } else {
        logInfo("İlk yükleme: Giriş yapılmamış görünüyor.");
        setLoading(false); // Yükleniyor durumunu bitir
    }
  }, [isLoggedIn, verileriGetir]); // Sadece isLoggedIn değiştiğinde (örn: 401 sonrası) veya ilk yüklemede çalışır

  // --- Menü Yönetimi Fonksiyonları ---
  const urunEkle = useCallback(async () => {
    if (!yeniUrun.ad || !yeniUrun.fiyat || !yeniUrun.kategori) {
        alert("Lütfen ürün adı, fiyatı ve kategorisini girin.");
        return;
    }
    logInfo(`➕ Ürün ekleniyor: ${JSON.stringify(yeniUrun)}`);
    setLoading(true); // İşlem sırasında loading göster
    setError(null);
    try {
      // AUTH_HEADER dinamik olarak oluşturulduğu için burada tekrar kullanılıyor
      await axios.post(`${API_BASE}/menu/ekle`, yeniUrun, {
         headers: { Authorization: AUTH_HEADER, 'Content-Type': 'application/json' }
      });
      logInfo("✅ Ürün başarıyla eklendi.");
      setYeniUrun({ ad: "", fiyat: "", kategori: "" }); // Formu temizle
      await verileriGetir(); // Listeyi ve menüyü güncelle (await ekledik)
      alert("Ürün başarıyla eklendi.");
    } catch (err) {
      logError("❌ Ürün eklenemedi:", err);
      const errorDetail = err.response?.data?.detail || err.message || "Bilinmeyen bir hata.";
      setError(`Ürün eklenirken bir hata oluştu: ${errorDetail}`);
      alert(`Ürün eklenemedi: ${errorDetail}`);
    } finally {
        setLoading(false); // İşlem bitince loading'i kaldır
    }
  }, [API_BASE, yeniUrun, verileriGetir, logInfo, logError]); // AUTH_HEADER dependency değil çünkü component scope'unda sabit

  const urunSil = useCallback(async () => {
    if (!silUrunAdi) {
        alert("Lütfen silinecek ürünün adını girin.");
        return;
    }
    // Küçük harfe çevirerek karşılaştırma yapmak daha güvenli olabilir
    const urunVarMi = menu.some(kategori =>
        kategori.urunler.some(urun => urun.ad.toLowerCase() === silUrunAdi.trim().toLowerCase())
    );

    if (!urunVarMi) {
        alert(`'${silUrunAdi}' adında bir ürün menüde bulunamadı.`);
        return;
    }


    if (!window.confirm(`'${silUrunAdi}' adlı ürünü silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`)) {
        return;
    }
    logInfo(`➖ Ürün siliniyor: ${silUrunAdi}`);
    setLoading(true); // İşlem sırasında loading göster
    setError(null);
    try {
      // AUTH_HEADER dinamik olarak oluşturulduğu için burada tekrar kullanılıyor
      await axios.delete(`${API_BASE}/menu/sil`, {
        params: { urun_adi: silUrunAdi.trim() }, // Trim ekledik
        headers: { Authorization: AUTH_HEADER }
      });
      logInfo("🗑️ Ürün başarıyla silindi.");
      setSilUrunAdi(""); // Formu temizle
      await verileriGetir(); // Listeyi ve menüyü güncelle (await ekledik)
      alert("Ürün başarıyla silindi.");
    } catch (err) {
      logError("❌ Ürün silinemedi:", err);
       const errorDetail = err.response?.data?.detail || err.message || "Bilinmeyen bir hata.";
       setError(`Ürün silinirken bir hata oluştu: ${errorDetail}`);
       alert(`Ürün silinemedi: ${errorDetail}`);
    } finally {
        setLoading(false); // İşlem bitince loading'i kaldır
    }
  }, [API_BASE, silUrunAdi, menu, verileriGetir, logInfo, logError]); // menu ve AUTH_HEADER dependency değil

  // --- Çıkış Fonksiyonu ---
  const cikisYap = () => {
    logInfo("🚪 Çıkış yapılıyor...");
    if (typeof window !== 'undefined') {
        localStorage.removeItem("adminGiris"); // localStorage'dan girişi kaldır
    }
    setIsLoggedIn(false); // State'i güncelle
    // WebSocket bağlantısını kapatma işlemi zaten isLoggedIn state'i değişince useEffect içinde tetiklenecek.
  };

  // --- Sipariş Filtreleme ---
  // Not: Bu filtreleme büyük veri setlerinde yavaş olabilir, backend'de filtreleme daha verimli olur.
  const filtrelenmisSiparisler = orders.filter(
    (o) => {
        // Arama metnini küçük harfe çevir
        const aramaLower = arama.toLowerCase();
        // Siparişin aranacak alanlarını birleştir ve küçük harfe çevir
        const aranacakMetin = [
            String(o.id),
            String(o.masa),
            o.istek || "",
            // Sepet içeriğini de aranabilir hale getir (daha önce parse edildiği varsayılıyor)
            Array.isArray(o.sepet) ? o.sepet.map(item => `${item.adet}x ${item.urun}`).join(' ') : (typeof o.sepet === 'string' ? o.sepet : "")
        ].join(' ').toLowerCase();

        return aranacakMetin.includes(aramaLower);
    }
  );

  // --- Giriş Yapılmadıysa (Erişim Engellendi Mesajı) ---
  if (!isLoggedIn) {
      // Eğer localStorage'da giriş bilgisi yoksa veya API'den 401 hatası alındıysa bu kısım gösterilir.
      // Tarayıcı Basic Auth penceresini *ilk* istekte göstermeli.
      // Eğer kullanıcı iptal ederse veya yanlış girerse 401 hatası alınır ve bu ekran gösterilir.
      return (
          <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-100 to-orange-100 p-4">
              <div className="bg-white shadow-xl p-8 rounded-lg text-center border border-red-300">
                  <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                  <h2 className="text-xl font-bold mb-4 text-red-700">Erişim Engellendi</h2>
                  {/* Hata mesajını daha açıklayıcı hale getirebiliriz */}
                  <p className="text-gray-600 mb-4">
                      {error ? error : "Admin paneline erişim yetkiniz bulunmuyor veya oturumunuz sonlanmış."}
                  </p>
                  <p className="text-sm text-gray-500">
                      Lütfen geçerli admin bilgileriyle tekrar deneyin (sayfayı yenileyerek) veya sistem yöneticisiyle iletişime geçin.
                  </p>
                  {/* Detaylı hata mesajını logladık, kullanıcıya göstermeye gerek yok belki. */}
                  {/* {error && error !== "..." && <p className="mt-4 text-xs text-red-600 bg-red-50 p-2 rounded">Detay: {error}</p>} */}
              </div>
          </div>
      );
  }

  // --- Giriş Yapıldıysa Ana Panel ---
  return (
    <div className="p-4 md:p-8 bg-gradient-to-tr from-slate-100 to-slate-200 min-h-screen text-gray-800 font-sans relative">
      {/* Hata Mesajı (Yetki hatası dışındaki hatalar için) */}
       {error && ( // Sadece genel hataları göster, yetki hatası zaten yukarıda handle ediliyor.
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded relative mb-6 shadow" role="alert">
           <strong className="font-bold">Hata: </strong>
           <span className="block sm:inline">{error}</span>
           {/* Belki bir yeniden deneme butonu eklenebilir */}
           {/* <button onClick={verileriGetir} className="ml-4 px-2 py-1 bg-red-600 text-white rounded text-xs">Tekrar Dene</button> */}
        </div>
      )}

      {/* Yükleniyor Göstergesi */}
      {loading && (
          <div className="fixed inset-0 bg-black/10 backdrop-blur-sm flex items-center justify-center z-50"> {/* Hafif blur efekti eklendi */}
              <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500"></div>
          </div>
      )}


      {/* Başlık ve Çıkış Butonu */}
      <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-800 flex items-center gap-3">
            <Settings className="w-8 h-8 text-blue-600" /> Admin Paneli ({ADMIN_USERNAME}) {/* Kullanıcı adını göster */}
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
                    <YAxis fontSize={12} allowDecimals={false} /> {/* Tamsayı gösterimi */}
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
                  {/* Y ekseni etiketlerinin daha iyi sığması için sol marjini artır */}
                  <BarChart data={populer} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0"/>
                    <XAxis type="number" fontSize={12} allowDecimals={false} /> {/* Tamsayı gösterimi */}
                    {/* Y ekseni etiketleri için genişliği ayarla ve sığmazsa kısalt */}
                    <YAxis dataKey="urun" type="category" fontSize={12} width={100} tick={{ textAnchor: 'end', width: 95 }}/>
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
            <form onSubmit={(e) => { e.preventDefault(); urunEkle(); }}> {/* Form submit ile tetikleme */}
                <div className="space-y-3">
                <input
                    type="text"
                    placeholder="Ürün Adı"
                    value={yeniUrun.ad}
                    onChange={(e) => setYeniUrun({ ...yeniUrun, ad: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-500"
                    required // Zorunlu alan
                />
                <input
                    type="number"
                    placeholder="Fiyat (örn: 25.50)"
                    value={yeniUrun.fiyat}
                    onChange={(e) => setYeniUrun({ ...yeniUrun, fiyat: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-500"
                    step="0.01" // Ondalıklı giriş için
                    min="0" // Negatif fiyat engelleme
                    required // Zorunlu alan
                />
                <input
                    type="text"
                    placeholder="Kategori"
                    value={yeniUrun.kategori}
                    onChange={(e) => setYeniUrun({ ...yeniUrun, kategori: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-500"
                    required // Zorunlu alan
                />
                <button
                    type="submit" // Form submit butonu
                    disabled={loading} // İşlem sırasında pasif yap
                    className={`w-full text-white py-2 rounded shadow transition duration-200 ease-in-out active:scale-95 flex items-center justify-center gap-2 ${loading ? 'bg-gray-400' : 'bg-teal-600 hover:bg-teal-700'}`}
                >
                    <PlusCircle className="w-4 h-4"/> Ürün Ekle
                </button>
                </div>
            </form>
            {/* Ürün Silme Formu */}
            <div className="mt-6 pt-4 border-t">
                 <h4 className="font-medium mb-3 text-gray-600">Ürün Sil</h4>
                 <form onSubmit={(e) => { e.preventDefault(); urunSil(); }}> {/* Form submit ile tetikleme */}
                     <div className="space-y-3">
                        <input
                            type="text"
                            placeholder="Silinecek Ürün Adı"
                            value={silUrunAdi}
                            onChange={(e) => setSilUrunAdi(e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-red-500"
                            required // Zorunlu alan
                        />
                        <button
                            type="submit" // Form submit butonu
                            disabled={!silUrunAdi.trim() || loading} // İşlem sırasında pasif yap
                            className={`w-full text-white py-2 rounded shadow transition duration-200 ease-in-out active:scale-95 flex items-center justify-center gap-2 ${
                                !silUrunAdi.trim() || loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'
                            }`}
                        >
                           <Trash2 className="w-4 h-4"/> Ürün Sil
                        </button>
                     </div>
                 </form>
            </div>
          </div>

          {/* Mevcut Menü Gösterimi */}
          <div className="md:col-span-2">
             <h4 className="font-medium mb-3 text-gray-600">Mevcut Menü</h4>
             {/* Menü yüklenmemişse veya boşsa farklı mesaj göster */}
             {!loading && menu.length === 0 && (
                 <div className="text-center py-10 text-gray-500">Menü boş veya yüklenemedi.</div>
             )}
             {menu.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-h-96 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                    {menu.map((kategori) => (
                      <div key={kategori.kategori} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                        <h5 className="font-semibold mb-2 text-teal-700">{kategori.kategori}</h5>
                        <ul className="space-y-1 text-sm">
                          {/* Kategoride ürün yoksa mesaj göster */}
                          {kategori.urunler.length === 0 && (
                              <li className="text-xs text-gray-400 italic">Bu kategoride ürün yok.</li>
                          )}
                          {kategori.urunler.map((urun) => (
                            <li key={urun.ad} className="flex justify-between items-center border-b border-gray-100 py-1 last:border-b-0"> {/* Son elemanın alt çizgisini kaldır */}
                              <span className={urun.stok_durumu === 0 ? 'text-red-500 line-through' : ''} title={urun.ad}>{urun.ad}</span> {/* Title ekledik */}
                              <span className={`font-medium whitespace-nowrap ${urun.stok_durumu === 0 ? 'text-red-400' : 'text-gray-700'}`}> {/* Kaymayı önle */}
                                  {/* Fiyatı formatla */}
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
              {/* Filtrelenmiş sipariş yoksa veya hiç sipariş yoksa mesaj göster */}
              {!loading && filtrelenmisSiparisler.length === 0 && (
                   <tr>
                       <td colSpan="5" className="text-center py-10 text-gray-500">
                           {arama ? 'Aramanızla eşleşen sipariş bulunamadı.' : (orders.length === 0 ? 'Henüz sipariş yok.' : 'Aramanızla eşleşen sipariş bulunamadı.')}
                       </td>
                   </tr>
              )}
              {/* Siparişleri listele */}
              {filtrelenmisSiparisler.length > 0 && filtrelenmisSiparisler.map((siparis) => {
                  // Not: JSON parse etme işlemi zaten AdminPanel'de yapılmıyor, backend'den parse edilmiş gelmeli.
                  // Eğer backend'den string geliyorsa burada parse edilmeli ve hata yakalanmalı.
                  // Şimdilik backend'in parse edip array gönderdiği varsayılıyor.
                  let sepetDetay = "Detay yok";
                  if (Array.isArray(siparis.sepet) && siparis.sepet.length > 0) {
                       sepetDetay = siparis.sepet
                         .map(item => `${item.adet || '?'}x ${item.urun || '?'}`) // Adet/urun yoksa ? göster
                         .join(", ");
                  } else if (typeof siparis.sepet === 'string' && siparis.sepet.trim() !== '' && siparis.sepet !== '[]') {
                      // Eğer string gelmişse ve boş değilse, okunamadı de
                      sepetDetay = "Detay okunamadı (Format Hatalı)";
                  }


                  return (
                    <tr key={siparis.id} className="hover:bg-gray-50 text-sm">
                      <td className="px-4 py-3 whitespace-nowrap text-gray-700">#{siparis.id}</td>
                      <td className="px-4 py-3 whitespace-nowrap font-medium">Masa {siparis.masa}</td>
                      <td className="px-4 py-3">
                        {/* Tooltip ile tam içeriği göster */}
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
                          {/* Durum yoksa 'Bilinmiyor' göster */}
                          {siparis.durum || "Bilinmiyor"}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-500">
                        {/* Tarih formatlama */}
                        {siparis.zaman ? new Date(siparis.zaman).toLocaleString("tr-TR", {
                            year: 'numeric', month: 'numeric', day: 'numeric',
                            hour: '2-digit', minute: '2-digit'
                         }) : "-"}
                      </td>
                       {/* İşlemler Sütunu (Opsiyonel -örn: detayı gör, tekrar yazdır vb.) */}
                       {/* <td className="px-4 py-3 whitespace-nowrap">...</td> */}
                    </tr>
                  );
              })}
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
            Frontend tarafında kullanılan kimlik bilgileri `.env` dosyasındaki `REACT_APP_ADMIN_USERNAME` ve `REACT_APP_ADMIN_PASSWORD` değişkenlerinden okunur.
        </p>
        {/* ... önceki yorumlanmış kısım ... */}
      </div>

    </div> // Ana container kapanışı
  );
}

export default AdminPaneli;