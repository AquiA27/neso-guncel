// src/pages/AdminPaneli.jsx
import React, { useState, useEffect, useRef, useCallback, useContext } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import CountUp from "react-countup";
import {
  UserCheck,
  Coffee,
  Settings,
  LogOut,
  AlertCircle,
  MenuSquare,
  Trash2,
  PlusCircle,
  RotateCw,
  DollarSign, 
  ListChecks, 
  CreditCard as CreditCardIcon,
  Users, 
  UserPlus,
  // Edit3, // Opsiyonel, şimdilik eklenmedi
  // UserX, // Opsiyonel, şimdilik eklenmedi
} from "lucide-react";
import apiClient from '../services/apiClient'; 
import { AuthContext } from '../AuthContext'; 
import { useNavigate } from 'react-router-dom'; 

const KULLANICI_ROLLER = ["admin", "kasiyer", "barista", "mutfak_personeli"];

function AdminPaneli() {
  const { isAuthenticated, currentUser, userRole, loadingAuth, logout } = useContext(AuthContext); 
  const navigate = useNavigate(); 

  const [orders, setOrders] = useState([]);
  const [arama, setArama] = useState("");
  const [gunluk, setGunluk] = useState({
    siparis_sayisi: 0,
    toplam_gelir: 0,
    satilan_urun_adedi: 0,
  });
  const [aylik, setAylik] = useState({
    siparis_sayisi: 0,
    toplam_gelir: 0,
    satilan_urun_adedi: 0,
  });
  const [yillikChartData, setYillikChartData] = useState([]);
  const [populer, setPopuler] = useState([]);
  const [aktifMasaOzetleri, setAktifMasaOzetleri] = useState([]);
  const [menu, setMenu] = useState([]);
  const [yeniUrun, setYeniUrun] = useState({
    ad: "",
    fiyat: "",
    kategori: "",
  });
  const [silUrunAdi, setSilUrunAdi] = useState("");
  
  const [kullanicilar, setKullanicilar] = useState([]);
  const [yeniKullanici, setYeniKullanici] = useState({
    kullanici_adi: "",
    sifre: "",
    rol: KULLANICI_ROLLER[1], 
    aktif_mi: true,
  });
  const [showAddUserForm, setShowAddUserForm] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const [error, setError] = useState(null);
  const [loadingData, setLoadingData] = useState(false);
  const wsRef = useRef(null);

  const logInfo = useCallback((message) => console.log(`[Admin Paneli] INFO: ${message}`), []);
  const logError = useCallback(
    (message, errorObj) => console.error(`[Admin Paneli] ERROR: ${message}`, errorObj || ""),
    []
  );
  const logWarn = useCallback((message) => console.warn(`[Admin Paneli] WARN: ${message}`), []);
  const logDebug = useCallback((message) => console.log(`[Admin Paneli] DEBUG: ${message}`), []);


  useEffect(() => {
    document.title = "Admin Paneli - Neso";
  }, []);

  const kullanicilariGetir = useCallback(async () => {
    logInfo("👥 Kullanıcılar getiriliyor...");
    setLoadingUsers(true);
    setError(null);
    try {
      const response = await apiClient.get("/admin/kullanicilar");
      setKullanicilar(response.data || []);
      logInfo(`✅ Kullanıcılar başarıyla getirildi (${response.data?.length || 0} adet).`);
    } catch (err) {
      logError("❌ Kullanıcılar alınamadı:", err);
      const errorDetail = err.response?.data?.detail || err.message || "Kullanıcı listesi alınamadı.";
      setError(errorDetail);
      if (err.response?.status === 401 || err.response?.status === 403) logout();
    } finally {
      setLoadingUsers(false);
    }
  }, [logInfo, logError, logout]);

  const verileriGetir = useCallback(async () => {
    logInfo(`🔄 Veriler getiriliyor (Admin)...`);
    setLoadingData(true);
    setError(null);

    try {
      const [
        siparisRes,
        gunlukRes,
        aylikRes,
        yillikRes,
        populerRes,
        aktifMasalarTutarlariRes,
        menuRes,
      ] = await Promise.all([
        apiClient.get(`/siparisler`), 
        apiClient.get(`/istatistik/gunluk`),
        apiClient.get(`/istatistik/aylik`),
        apiClient.get(`/istatistik/yillik-aylik-kirilim`),
        apiClient.get(`/istatistik/en-cok-satilan`),
        apiClient.get(`/admin/aktif-masa-tutarlari`), 
        apiClient.get(`/menu`), 
      ]);

      setOrders(siparisRes?.data?.orders || []);
      setGunluk(
        gunlukRes?.data || { siparis_sayisi: 0, toplam_gelir: 0, satilan_urun_adedi: 0 }
      );
      setAylik(
        aylikRes?.data || { siparis_sayisi: 0, toplam_gelir: 0, satilan_urun_adedi: 0 }
      );
      setPopuler(populerRes?.data || []);
      setAktifMasaOzetleri(aktifMasalarTutarlariRes?.data || []);

      const yillikHamVeri = yillikRes?.data?.aylik_kirilim || {};
      const formatlanmisYillikVeri = Object.entries(yillikHamVeri)
        .map(([tarih, veri]) => ({
          tarih,
          adet: Number(veri?.satilan_urun_adedi) || 0,
          gelir: Number(veri?.toplam_gelir) || 0,
        }))
        .sort((a, b) => a.tarih.localeCompare(b.tarih));
      setYillikChartData(formatlanmisYillikVeri);

      setMenu(menuRes?.data?.menu || []);
      logInfo("✅ Temel admin verileri başarıyla getirildi.");
    } catch (err) {
      logError("❌ Temel admin verileri alınamadı:", err);
      const errorDetail =
        err.response?.data?.detail || err.message || "Bilinmeyen bir hata oluştu.";
      if (err.response?.status === 401 || err.response?.status === 403) {
        setError("Bu verilere erişim yetkiniz yok veya oturumunuz sonlanmış. Lütfen tekrar giriş yapın.");
        logout(); 
      } else {
        setError(
          `Veriler alınamadı: ${errorDetail}`
        );
      }
    } finally {
      setLoadingData(false);
    }
  }, [logInfo, logError, logout]); 

  useEffect(() => {
    if (!loadingAuth) { 
      if (isAuthenticated && userRole === 'admin') {
        logInfo("Admin giriş yapmış ve yetkili, veriler çekiliyor...");
        verileriGetir();
        kullanicilariGetir();
      } else if (isAuthenticated && userRole !== 'admin') {
        logWarn("Admin olmayan kullanıcı admin paneline erişmeye çalıştı. Yetkisiz sayfasına yönlendiriliyor...");
        navigate('/unauthorized');
      } else if (!isAuthenticated) {
        logWarn("Giriş yapılmamış, admin paneli için login'e yönlendiriliyor.");
        navigate('/login', { state: { from: { pathname: '/admin' } } });
      }
    }
  }, [isAuthenticated, userRole, loadingAuth, navigate, verileriGetir, kullanicilariGetir, logInfo, logWarn]);

  useEffect(() => {
    if (!isAuthenticated || userRole !== 'admin' || loadingAuth) {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        logInfo("Admin yetkisi yok veya çıkış yapıldı, Admin WebSocket bağlantısı kapatılıyor.");
        wsRef.current.close(1000, "User not admin or logged out for Admin WS");
        wsRef.current = null;
      }
      return; 
    }

    let reconnectTimeoutId = null;
    let pingIntervalId = null;

    const connectWebSocket = () => {
      if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
        logDebug("Admin WebSocket zaten açık veya bağlanıyor.");
        return;
      }
      const apiBaseForWs = process.env.REACT_APP_API_BASE;
      if (!apiBaseForWs) {
        logError("REACT_APP_API_BASE tanımlı değil, Admin WS kurulamıyor.");
        setError("API adresi yapılandırılmamış. Lütfen sistem yöneticisi ile iletişime geçin.");
        return;
      }

      try {
        const wsProtocol = apiBaseForWs.startsWith("https") ? "wss:" : (window.location.protocol === "https:" ? "wss:" : "ws:");
        const wsHost = apiBaseForWs.replace(/^https?:\/\//, "");
        const wsUrl = `${wsProtocol}//${wsHost}/ws/admin`;
        logInfo(`📡 Admin WebSocket bağlantısı deneniyor: ${wsUrl}`);
        wsRef.current = new WebSocket(wsUrl);

        wsRef.current.onopen = () => {
          logInfo("✅ Admin WebSocket bağlantısı başarılı.");
          setError(null);
          if (reconnectTimeoutId) { clearTimeout(reconnectTimeoutId); reconnectTimeoutId = null; }
        };

        wsRef.current.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            logInfo(`📥 Admin WS mesajı alındı: Tip: ${message.type}`);
            if (["siparis", "durum", "masa_durum", "menu_guncellendi"].includes(message.type)) {
              logInfo(`⚡ Admin WS: ${message.type} alındı, veriler yenileniyor...`);
              verileriGetir();
              // Kullanıcı listesi için de bir güncelleme tetiklenebilir, eğer kullanıcı ekleme/silme de WS ile bildiriliyorsa
              // Veya sadece ilgili endpoint'ler çağrıldığında (yeniKullaniciEkle sonrası gibi) yenilenir.
              // Şimdilik sadece genel verileriGetir'i çağırıyoruz.
            } else if (message.type === "pong") {
                logDebug("Admin WS: Pong alındı.");
            }
          } catch (err) { logError("Admin WS mesaj işleme hatası:", err); }
        };

        wsRef.current.onerror = (errorEvent) => {
          logError("❌ Admin WebSocket hatası:", errorEvent);
          setError("Admin paneli sunucu bağlantısında (WebSocket) bir sorun oluştu. Sayfayı yenilemeyi deneyin.");
        };

        wsRef.current.onclose = (event) => {
          logInfo(`🔌 Admin WebSocket bağlantısı kapandı. Kod: ${event.code}, Sebep: ${event.reason || "Yok"}`);
          wsRef.current = null;
          if (isAuthenticated && userRole === 'admin' && event.code !== 1000 && event.code !== 1001 && !event.wasClean) {
            const delay = 3000 + Math.random() * 2000;
            logInfo(`Admin WS beklenmedik şekilde kapandı, ${Math.round(delay/1000)}sn sonra tekrar denenecek...`);
            reconnectTimeoutId = setTimeout(connectWebSocket, delay);
          }
        };
      } catch (error) {
        logError("❌ Admin WebSocket başlatılırken kritik hata:", error);
        setError("Admin paneli sunucu bağlantısı (WebSocket) kurulamıyor.");
      }
    };

    connectWebSocket();

    pingIntervalId = setInterval(() => {
      if (isAuthenticated && userRole === 'admin' && wsRef.current?.readyState === WebSocket.OPEN) {
        try { wsRef.current.send(JSON.stringify({ type: "ping" })); }
        catch (err) { logError("Admin Ping gönderilemedi:", err); }
      } else if (isAuthenticated && userRole === 'admin' && !wsRef.current) {
        logWarn("Admin Ping: WebSocket bağlantısı aktif değil, yeniden bağlantı deneniyor.");
        connectWebSocket();
      }
    }, 30000);

    return () => {
      clearInterval(pingIntervalId);
      if (reconnectTimeoutId) clearTimeout(reconnectTimeoutId);
      if (wsRef.current) {
        logInfo("Admin Paneli: Component kaldırılıyor, WebSocket kapatılıyor (normal kapanış).");
        wsRef.current.close(1000, "Component unmounting");
        wsRef.current = null;
      }
    };
  }, [isAuthenticated, userRole, loadingAuth, logInfo, logError, logWarn, logDebug, verileriGetir]);


  const urunEkle = useCallback(async () => {
    if (!yeniUrun.ad || !yeniUrun.fiyat || !yeniUrun.kategori) {
      alert("Lütfen ürün adı, fiyatı ve kategorisini girin."); return;
    }
    const fiyatNum = parseFloat(yeniUrun.fiyat);
    if (isNaN(fiyatNum) || fiyatNum < 0) {
      alert("Lütfen geçerli bir fiyat girin."); return;
    }
    logInfo(`➕ Ürün ekleniyor: ${JSON.stringify({ ...yeniUrun, fiyat: fiyatNum })}`);
    setLoadingData(true); setError(null);
    try {
      await apiClient.post(`/menu/ekle`, { ...yeniUrun, fiyat: fiyatNum });
      logInfo("✅ Ürün başarıyla eklendi.");
      setYeniUrun({ ad: "", fiyat: "", kategori: "" });
      await verileriGetir(); // Menü listesini de günceller
      alert("Ürün başarıyla eklendi.");
    } catch (err) {
      logError("❌ Ürün eklenemedi:", err);
      const errorDetail = err.response?.data?.detail || err.message || "Bilinmeyen bir hata.";
      setError(`Ürün eklenirken hata: ${errorDetail}`);
      alert(`Ürün eklenemedi: ${errorDetail}`);
      if (err.response?.status === 401 || err.response?.status === 403) logout(); 
    } finally {
      setLoadingData(false);
    }
  }, [yeniUrun, verileriGetir, logInfo, logError, logout]); 

  const urunSil = useCallback(async () => {
    if (!silUrunAdi) { alert("Lütfen silinecek ürünün adını girin."); return; }
    const urunAdiTrimmed = silUrunAdi.trim();
    if (!urunAdiTrimmed) { alert("Lütfen silinecek ürünün adını girin."); return; }
    const urunAdiTrimmedLower = urunAdiTrimmed.toLowerCase();

    const urunVarMi = menu?.some((kategori) =>
      kategori?.urunler?.some(
        (urun) => urun?.ad?.trim().toLowerCase() === urunAdiTrimmedLower
      )
    );
    if (!urunVarMi) {
      alert(`'${urunAdiTrimmed}' adında bir ürün menüde bulunamadı. Menü güncel mi? Büyük/küçük harf kontrolü yapınız.`);
      return;
    }

    if (!window.confirm(`'${urunAdiTrimmed}' adlı ürünü silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`)) {
      return;
    }

    logInfo(`➖ Ürün siliniyor: ${urunAdiTrimmed}`);
    setLoadingData(true); setError(null);
    try {
      await apiClient.delete(`/menu/sil`, { params: { urun_adi: urunAdiTrimmed } });
      logInfo("🗑️ Ürün başarıyla silindi.");
      setSilUrunAdi("");
      await verileriGetir(); // Menü listesini de günceller
      alert("Ürün başarıyla silindi.");
    } catch (err) {
      logError("❌ Ürün silinemedi:", err);
      const errorDetail = err.response?.data?.detail || err.message || "Bilinmeyen bir hata.";
      setError(`Ürün silinirken hata: ${errorDetail}`);
      alert(`Ürün silinemedi: ${errorDetail}`);
      if (err.response?.status === 401 || err.response?.status === 403) logout(); 
    } finally {
      setLoadingData(false);
    }
  }, [silUrunAdi, menu, verileriGetir, logInfo, logError, logout]); 

  const handleYeniKullaniciChange = (e) => {
    const { name, value, type, checked } = e.target;
    setYeniKullanici(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const yeniKullaniciEkle = async (e) => {
    e.preventDefault();
    if (!yeniKullanici.kullanici_adi || !yeniKullanici.sifre || !yeniKullanici.rol) {
      alert("Lütfen kullanıcı adı, şifre ve rol bilgilerini eksiksiz girin.");
      return;
    }
    logInfo(`➕ Yeni kullanıcı ekleniyor: ${yeniKullanici.kullanici_adi}`);
    setLoadingUsers(true);
    setError(null);
    try {
      await apiClient.post("/admin/kullanicilar", yeniKullanici);
      logInfo(`✅ Kullanıcı '${yeniKullanici.kullanici_adi}' başarıyla eklendi.`);
      setYeniKullanici({ kullanici_adi: "", sifre: "", rol: KULLANICI_ROLLER[1], aktif_mi: true });
      setShowAddUserForm(false); 
      await kullanicilariGetir(); 
      alert("Yeni kullanıcı başarıyla eklendi.");
    } catch (err) {
      logError("❌ Yeni kullanıcı eklenemedi:", err);
      const errorDetail = err.response?.data?.detail || err.message || "Bilinmeyen bir hata.";
      setError(`Yeni kullanıcı eklenirken hata: ${errorDetail}`);
      alert(`Yeni kullanıcı eklenemedi: ${errorDetail}`);
      if (err.response?.status === 401 || err.response?.status === 403) logout();
    } finally {
      setLoadingUsers(false);
    }
  };
  
  // TODO: Opsiyonel: Kullanıcı Düzenleme ve Silme fonksiyonları
  // const handleEditUser = (user) => { setEditingUser(user); /* Modal aç veya formu doldur */ };
  // const handleUpdateUser = async () => { /* API isteği ve liste güncelleme */ };
  // const handleDeleteUser = async (userId) => { /* API isteği ve liste güncelleme */ };


  const filtrelenmisSiparisler = orders.filter((o) => {
    if (!o || typeof o !== "object") return false;
    const aramaLower = arama.toLowerCase();
    let sepetText = "";
    if (Array.isArray(o.sepet)) {
      sepetText = o.sepet
        .map(
          (item) =>
            item && typeof item === "object"
              ? `${item.adet || "?"}x ${item.urun || "?"}`
              : ""
        )
        .filter(Boolean)
        .join(" ");
    } else if (typeof o.sepet === "string" && o.sepet.trim() && o.sepet !== "[]") {
      try {
        const parsedSepet = JSON.parse(o.sepet);
        if (Array.isArray(parsedSepet)) {
          sepetText = parsedSepet
            .map(
              (item) =>
                item && typeof item === "object"
                  ? `${item.adet || "?"}x ${item.urun || "?"}`
                  : ""
            )
            .filter(Boolean)
            .join(" ");
        } else {
          sepetText = o.sepet;
        }
      } catch (e) {
        sepetText = o.sepet;
      }
    }

    const aranacakMetin = [
      String(o.id || ""),
      String(o.masa || ""),
      o.durum || "",
      o.istek || "",
      o.yanit || "",
      sepetText,
      o.zaman
        ? new Date(o.zaman).toLocaleString("tr-TR", {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
          })
        : "",
      o.odeme_yontemi || "" 
    ]
      .join(" ")
      .toLowerCase();
    return aranacakMetin.includes(aramaLower);
  });

  if (loadingAuth) { 
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-sky-100 p-4">
        <div className="bg-white shadow-xl p-8 rounded-lg text-center border border-slate-300">
          <AlertCircle className="w-12 h-12 text-blue-500 mx-auto mb-4 animate-pulse" />
          <h2 className="text-xl font-semibold mb-2 text-slate-700">Yükleniyor...</h2>
          <p className="text-slate-500">Admin paneli yetkileri kontrol ediliyor, lütfen bekleyin.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 bg-gradient-to-tr from-slate-100 to-slate-200 min-h-screen text-gray-800 font-sans relative">
      {error && (
        <div
          className="bg-red-100 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded relative mb-6 shadow"
          role="alert"
        >
          <strong className="font-bold">Hata: </strong>
          <span className="block sm:inline mr-2">{error}</span>
          <button
            onClick={() => { setError(null); verileriGetir(); kullanicilariGetir(); }}
            className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-semibold transition duration-200 ease-in-out ml-4"
            disabled={loadingData || loadingUsers}
          >
            {loadingData || loadingUsers ? "Yükleniyor..." : "Tekrar Dene"}
          </button>
        </div>
      )}

      {(loadingData || loadingUsers) && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500"></div>
          <p className="text-white text-lg ml-4">Veriler Yükleniyor...</p>
        </div>
      )}

      <div className="flex flex-wrap justify-between items-center mb-8 gap-4">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-800 flex items-center gap-3">
          <Settings className="w-8 h-8 text-blue-600" /> Admin Paneli
          {currentUser && <span className="text-lg font-normal text-slate-500">({currentUser.kullanici_adi})</span>}
        </h1>
        <button
          onClick={logout} 
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg shadow-md flex items-center gap-2 transition duration-200 ease-in-out active:scale-95"
        >
          <LogOut className="w-4 h-4" /> Çıkış Yap
        </button>
      </div>

      {/* İstatistik Kartları */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-5 rounded-lg shadow-lg border-t-4 border-blue-500 hover:shadow-xl transition-shadow">
          <h3 className="text-base font-semibold mb-2 flex items-center gap-2 text-gray-600">
            <Coffee className="w-5 h-5 text-blue-500" /> Günlük Ürün Adedi
          </h3>
          <CountUp
            end={gunluk?.satilan_urun_adedi || 0}
            separator="."
            className="text-3xl font-bold text-blue-700 block"
          />
        </div>
        <div className="bg-white p-5 rounded-lg shadow-lg border-t-4 border-green-500 hover:shadow-xl transition-shadow">
          <h3 className="text-base font-semibold mb-2 flex items-center gap-2 text-gray-600">
            <DollarSign className="w-5 h-5 text-green-500" /> Günlük Gelir
          </h3>
          <CountUp
            end={gunluk?.toplam_gelir || 0}
            separator="."
            decimal=","
            decimals={2}
            prefix="₺"
            className="text-3xl font-bold text-green-700 block"
          />
        </div>
        <div className="bg-white p-5 rounded-lg shadow-lg border-t-4 border-purple-500 hover:shadow-xl transition-shadow">
          <h3 className="text-base font-semibold mb-2 flex items-center gap-2 text-gray-600">
            <UserCheck className="w-5 h-5 text-purple-500" /> Aktif Masa Sayısı
          </h3>
          <CountUp
            end={aktifMasaOzetleri?.length || 0}
            separator="."
            className="text-3xl font-bold text-purple-700 block"
          />
        </div>
        <div className="bg-white p-5 rounded-lg shadow-lg border-t-4 border-orange-500 hover:shadow-xl transition-shadow">
          <h3 className="text-base font-semibold mb-2 flex items-center gap-2 text-gray-600">
            🏆 En Çok Tercih Edilen Ürün
          </h3>
          {populer?.[0] ? (
            <p
              className="text-lg font-bold text-orange-700 truncate"
              title={populer[0].urun}
            >
              {populer[0].urun}{" "}
              <span className="text-sm font-normal text-gray-500 ml-2">
                ({populer[0].adet || 0} adet)
              </span>
            </p>
          ) : (
            <p className="text-gray-500 text-sm">{loadingData ? "Yükleniyor..." : "Veri yok"}</p>
          )}
        </div>
      </div>

      {/* Aktif Masalar ve Ödenmemiş Tutarları Tablosu */}
      <div className="bg-white p-6 rounded-lg shadow-lg mb-8">
        <h3 className="text-xl font-semibold mb-4 text-gray-700 flex items-center gap-2">
            <ListChecks className="w-6 h-6 text-purple-600" /> Aktif Masalar
        </h3>
        {loadingData && (!aktifMasaOzetleri || aktifMasaOzetleri.length === 0) ? (
             <div className="text-center py-10 text-gray-400 italic">Aktif masa verileri yükleniyor...</div>
        ) : !aktifMasaOzetleri || aktifMasaOzetleri.length === 0 ? (
            <div className="text-center py-10 text-gray-500">Şu anda aktif masa bulunmamaktadır.</div>
        ) : (
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 border border-gray-200 rounded-md">
                    <thead className="bg-purple-100">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-purple-700 uppercase tracking-wider">Masa ID</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-purple-700 uppercase tracking-wider">Aktif Sipariş Sayısı</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-purple-700 uppercase tracking-wider">Ödenmemiş Toplam Tutar (TL)</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {aktifMasaOzetleri.map((masa) => (
                            <tr key={masa.masa_id} className="hover:bg-purple-50 text-sm transition-colors">
                                <td className="px-4 py-3 whitespace-nowrap text-gray-700 font-medium">{masa.masa_id}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-gray-600">{masa.aktif_siparis_sayisi}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-gray-800 font-semibold text-right">
                                    {typeof masa.odenmemis_tutar === 'number' ? masa.odenmemis_tutar.toFixed(2) : 'N/A'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )}
      </div>

      {/* Grafikler */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-lg">
          <h3 className="text-lg font-semibold mb-4 text-gray-700">
            📈 Aylık Ciro ve Ürün Adedi (Yıllık Kırılım)
          </h3>
          <div className="h-64">
            {yillikChartData?.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={yillikChartData}
                  margin={{ top: 5, right: 35, left: -10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis
                    dataKey="tarih"
                    fontSize={12}
                    tickFormatter={(value) => value.substring(5)}
                  />
                  <YAxis yAxisId="left" label={{ value: 'Adet', angle: -90, position: 'insideLeft', offset: 0, fontSize: 11 }} fontSize={12} allowDecimals={false} />
                  <YAxis yAxisId="right" orientation="right" label={{ value: 'Ciro (₺)', angle: -90, position: 'insideRight', offset: -15, fontSize: 11 }} fontSize={12}
                    tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(value, name, props) => {
                      if (name === "Aylık Ürün Adedi") return [`${value} Adet`, `Dönem: ${props.payload.tarih}`];
                      if (name === "Aylık Ciro") return [`₺${value.toFixed(2)}`, `Dönem: ${props.payload.tarih}`];
                      return [value, name];
                    }}
                  />
                  <Legend wrapperStyle={{fontSize: "12px"}}/>
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="adet"
                    name="Aylık Ürün Adedi"
                    stroke="#4F46E5"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="gelir"
                    name="Aylık Ciro"
                    stroke="#22C55E"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                {loadingData ? "Yükleniyor..." : "Yıllık veri bulunamadı."}
              </div>
            )}
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-lg">
          <h3 className="text-lg font-semibold mb-4 text-gray-700">
            📊 En Çok Tercih Edilen 5 Ürün (Adet)
          </h3>
          <div className="h-64">
            {populer?.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={populer.slice(0, 5)}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 60, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis type="number" fontSize={12} allowDecimals={false} />
                  <YAxis
                    dataKey="urun"
                    type="category"
                    fontSize={12}
                    width={130}
                    tick={{ textAnchor: "end", width: 125, fontSize: "11px" }}
                    interval={0}
                  />
                  <Tooltip formatter={(value) => [`${value} Adet`, "Satış Adedi"]} />
                  <Legend wrapperStyle={{fontSize: "12px"}}/>
                  <Bar dataKey="adet" name="Satış Adedi" fill="#FB923C" barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                {loadingData ? "Yükleniyor..." : "Popüler ürün verisi bulunamadı."}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Menü Yönetimi */}
      <div className="bg-white p-6 rounded-lg shadow-lg mb-8">
        <h3 className="text-lg font-semibold mb-4 text-gray-700 flex items-center gap-2">
          <MenuSquare className="w-5 h-5 text-teal-600" /> Menü Yönetimi
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1 space-y-6">
            <div>
              <h4 className="font-medium mb-3 text-gray-600">Yeni Ürün Ekle</h4>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  urunEkle();
                }}
              >
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Ürün Adı"
                    value={yeniUrun.ad}
                    onChange={(e) =>
                      setYeniUrun({ ...yeniUrun, ad: e.target.value })
                    }
                    className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-500 transition-colors"
                    required
                    disabled={loadingData} 
                  />
                  <input
                    type="number"
                    placeholder="Fiyat (örn: 25.50)"
                    value={yeniUrun.fiyat}
                    onChange={(e) =>
                      setYeniUrun({ ...yeniUrun, fiyat: e.target.value })
                    }
                    className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-500 transition-colors"
                    step="0.01"
                    min="0"
                    required
                    disabled={loadingData} 
                  />
                  <input
                    type="text"
                    placeholder="Kategori"
                    value={yeniUrun.kategori}
                    onChange={(e) =>
                      setYeniUrun({ ...yeniUrun, kategori: e.target.value })
                    }
                    className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-500 transition-colors"
                    required
                    disabled={loadingData} 
                  />
                  <button
                    type="submit"
                    disabled={
                      loadingData || !yeniUrun.ad || !yeniUrun.fiyat || !yeniUrun.kategori 
                    }
                    className={`w-full text-white py-2 rounded shadow transition duration-200 ease-in-out active:scale-95 flex items-center justify-center gap-2 ${
                      loadingData || !yeniUrun.ad || !yeniUrun.fiyat || !yeniUrun.kategori 
                        ? "bg-gray-400 cursor-not-allowed"
                        : "bg-teal-600 hover:bg-teal-700"
                    }`}
                  >
                    {loadingData && yeniUrun.ad ? <RotateCw className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />} 
                     Ürün Ekle
                  </button>
                </div>
              </form>
            </div>
            <div className="pt-4 border-t border-gray-200">
              <h4 className="font-medium mb-3 text-gray-600">Ürün Sil</h4>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  urunSil();
                }}
              >
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Silinecek Ürün Adı"
                    value={silUrunAdi}
                    onChange={(e) => setSilUrunAdi(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors"
                    required
                    disabled={loadingData} 
                  />
                  <button
                    type="submit"
                    disabled={!silUrunAdi.trim() || loadingData} 
                    className={`w-full text-white py-2 rounded shadow transition duration-200 ease-in-out active:scale-95 flex items-center justify-center gap-2 ${
                      !silUrunAdi.trim() || loadingData 
                        ? "bg-gray-400 cursor-not-allowed"
                        : "bg-red-600 hover:bg-red-700"
                    }`}
                  >
                     {loadingData && silUrunAdi.trim() ? <RotateCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} 
                    Ürün Sil
                  </button>
                </div>
              </form>
            </div>
          </div>
          <div className="md:col-span-2">
            <h4 className="font-medium mb-3 text-gray-600">Mevcut Menü</h4>
            {loadingData && (!menu || menu.length === 0) && ( 
              <div className="text-center py-10 text-gray-400 italic">Menü yükleniyor...</div>
            )}
            {!loadingData && (!menu || menu.length === 0) && ( 
              <div className="text-center py-10 text-gray-500">Menü boş veya yüklenemedi. Lütfen bağlantıyı kontrol edin veya ürün ekleyin.</div>
            )}
            {menu?.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-h-96 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 border border-gray-200 rounded-md p-2">
                {menu.map((kategori) => (
                  <div key={kategori.kategori} className="bg-gray-50 p-4 rounded-lg border border-gray-200 shadow-sm">
                    <h5 className="font-semibold mb-2 text-teal-700 capitalize">{kategori.kategori}</h5>
                    <ul className="space-y-1 text-sm">
                      {(!kategori.urunler || kategori.urunler.length === 0) && (
                        <li className="text-xs text-gray-400 italic">Bu kategoride ürün yok.</li>
                      )}
                      {kategori.urunler?.map((urun) => (
                        <li
                          key={`${kategori.kategori}-${urun.ad}`}
                          className="flex justify-between items-center border-b border-gray-100 py-1.5 last:border-b-0 hover:bg-gray-100 px-1 rounded"
                        >
                          <span
                            className={`${urun.stok_durumu === 0 ? 'text-red-500 line-through opacity-70' : ''} truncate max-w-[60%]`}
                            title={urun.ad}
                          >
                            {urun.ad}
                          </span>
                          <span
                            className={`font-medium whitespace-nowrap ${urun.stok_durumu === 0 ? 'text-red-400' : 'text-gray-700'}`}
                          >
                            {typeof urun.fiyat === 'number' ? `₺${urun.fiyat.toFixed(2)}` : 'N/A'}
                            {urun.stok_durumu === 0 && <span className="text-xs ml-1 font-normal">(Stokta Yok)</span>}
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

      {/* --- YENİ BÖLÜM: KULLANICI YÖNETİMİ --- */}
      <div className="bg-white p-6 rounded-lg shadow-lg mb-8">
        <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-600" /> Kullanıcı Yönetimi
            </h3>
            <button
                onClick={() => setShowAddUserForm(prev => !prev)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition shadow active:scale-95 flex items-center gap-2 ${
                    showAddUserForm ? "bg-red-500 hover:bg-red-600 text-white" : "bg-indigo-600 hover:bg-indigo-700 text-white"
                }`}
            >
                {showAddUserForm ? "Formu Kapat" : <><UserPlus className="w-4 h-4" /> Yeni Kullanıcı Ekle</>}
            </button>
        </div>

        {showAddUserForm && (
            <form onSubmit={yeniKullaniciEkle} className="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50 space-y-4">
                 <h4 className="text-md font-medium text-gray-600 mb-2">Yeni Personel Kaydı</h4>
                <div>
                    <label htmlFor="kullanici_adi_form" className="block text-sm font-medium text-gray-700">Kullanıcı Adı</label> {/* ID değiştirildi */}
                    <input
                        type="text"
                        name="kullanici_adi"
                        id="kullanici_adi_form" // ID değiştirildi
                        value={yeniKullanici.kullanici_adi}
                        onChange={handleYeniKullaniciChange}
                        className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        required
                        minLength="3"
                    />
                </div>
                <div>
                    <label htmlFor="sifre_form" className="block text-sm font-medium text-gray-700">Şifre</label> {/* ID değiştirildi */}
                    <input
                        type="password"
                        name="sifre"
                        id="sifre_form" // ID değiştirildi
                        value={yeniKullanici.sifre}
                        onChange={handleYeniKullaniciChange}
                        className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        required
                        minLength="6"
                    />
                </div>
                <div>
                    <label htmlFor="rol_form" className="block text-sm font-medium text-gray-700">Rol</label> {/* ID değiştirildi */}
                    <select
                        name="rol"
                        id="rol_form" // ID değiştirildi
                        value={yeniKullanici.rol}
                        onChange={handleYeniKullaniciChange}
                        className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    >
                        {KULLANICI_ROLLER.map(rol => (
                            <option key={rol} value={rol}>
                                {rol.charAt(0).toUpperCase() + rol.slice(1).replace("_personeli", " Personeli")}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="flex items-center">
                    <input
                        id="aktif_mi_form" // ID değiştirildi
                        name="aktif_mi"
                        type="checkbox"
                        checked={yeniKullanici.aktif_mi}
                        onChange={handleYeniKullaniciChange}
                        className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                    />
                    <label htmlFor="aktif_mi_form" className="ml-2 block text-sm text-gray-900"> {/* ID değiştirildi */}
                        Aktif Kullanıcı
                    </label>
                </div>
                <button
                    type="submit"
                    disabled={loadingUsers}
                    className="w-full bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-md shadow-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    {loadingUsers ? <RotateCw className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" /> }
                    Kullanıcıyı Ekle
                </button>
            </form>
        )}

        <h4 className="text-md font-medium text-gray-600 mb-3 mt-4">Mevcut Kullanıcılar</h4>
        {loadingUsers && <div className="text-center py-4">Kullanıcılar yükleniyor...</div>}
        {!loadingUsers && kullanicilar.length === 0 && <div className="text-center py-4 text-gray-500">Kayıtlı kullanıcı bulunmamaktadır.</div>}
        {!loadingUsers && kullanicilar.length > 0 && (
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 border border-gray-200 rounded-md">
                    <thead className="bg-indigo-50">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-indigo-700 uppercase tracking-wider">ID</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-indigo-700 uppercase tracking-wider">Kullanıcı Adı</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-indigo-700 uppercase tracking-wider">Rol</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-indigo-700 uppercase tracking-wider">Durum</th>
                            {/* <th className="px-4 py-3 text-left text-xs font-medium text-indigo-700 uppercase tracking-wider">İşlemler</th> */}
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {kullanicilar.map(k => (
                            <tr key={k.id} className="hover:bg-indigo-50/50 text-sm">
                                <td className="px-4 py-3 whitespace-nowrap text-gray-700">{k.id}</td>
                                <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-800">{k.kullanici_adi}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                                    {k.rol.charAt(0).toUpperCase() + k.rol.slice(1).replace("_personeli", " Personeli")}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                    <span className={`px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                        k.aktif_mi ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                    }`}>
                                        {k.aktif_mi ? 'Aktif' : 'Pasif'}
                                    </span>
                                </td>
                                {/*
                                <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                                    <button onClick={() => console.log("Düzenle:", k.id)} className="text-indigo-600 hover:text-indigo-900 mr-3"><Edit3 size={16}/></button>
                                    <button onClick={() => console.log("Sil:", k.id)} className="text-red-600 hover:text-red-900"><UserX size={16}/></button>
                                </td>
                                */}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )}
      </div>
      {/* --- BİTİŞ: KULLANICI YÖNETİMİ --- */}

      {/* Sipariş Geçmişi */}
      <div className="bg-white p-6 rounded-lg shadow-lg">
        <h3 className="text-lg font-semibold mb-4 text-gray-700">📋 Sipariş Geçmişi</h3>
        <input
          type="text"
          placeholder="Sipariş Ara (ID, Masa, Durum, İçerik, Not, Tarih, Ödeme Yöntemi...)"
          value={arama}
          onChange={(e) => setArama(e.target.value)}
          className="w-full p-3 border border-gray-300 rounded mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
        />
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 border border-gray-200 rounded-md">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Masa</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider min-w-[200px]">Sipariş İçeriği & Not</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Durum</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Ödeme Yöntemi</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Tarih</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loadingData && (!filtrelenmisSiparisler || filtrelenmisSiparisler.length === 0) && (!arama && orders.length === 0) && ( 
                <tr>
                  <td colSpan="6" className="text-center py-10 text-gray-400 italic">Siparişler yükleniyor...</td>
                </tr>
              )}
              {!loadingData && filtrelenmisSiparisler.length === 0 && ( 
                <tr>
                  <td colSpan="6" className="text-center py-10 text-gray-500">
                    {arama
                      ? "Aramanızla eşleşen sipariş bulunamadı."
                      : orders.length === 0
                      ? "Henüz sipariş yok."
                      : "Filtreyle eşleşen sipariş bulunamadı."}
                  </td>
                </tr>
              )}
              {filtrelenmisSiparisler.map((siparis) => {
                let sepetDetay = "Detay yok";
                if (Array.isArray(siparis.sepet) && siparis.sepet.length > 0) {
                  sepetDetay = siparis.sepet
                    .map(
                      (item) =>
                        item && typeof item === "object"
                          ? `${item.adet || "?"}x ${item.urun || "?"}`
                          : ""
                    )
                    .filter(Boolean)
                    .join(", ");
                } else if (typeof siparis.sepet === "string" && siparis.sepet.trim() && siparis.sepet !== "[]") {
                  try {
                    const parsedSepet = JSON.parse(siparis.sepet);
                    if (Array.isArray(parsedSepet) && parsedSepet.length > 0) {
                      sepetDetay = parsedSepet
                        .map(
                          (item) =>
                            item && typeof item === "object"
                              ? `${item.adet || "?"}x ${item.urun || "?"}`
                              : ""
                        )
                        .filter(Boolean)
                        .join(", ");
                    } else {
                      sepetDetay = "Detay okunamadı";
                    }
                  } catch {
                    sepetDetay = "Detay okunamadı (Format Hatalı)";
                  }
                }
                const fullText = `${sepetDetay}${siparis.istek ? ` | Not: ${siparis.istek}` : ""}`;
                const durumText = siparis.durum ? siparis.durum.charAt(0).toUpperCase() + siparis.durum.slice(1) : "Bilinmiyor";
                let durumClass = "bg-yellow-100 text-yellow-800";
                if (siparis.durum === "hazir") durumClass = "bg-green-100 text-green-800";
                else if (siparis.durum === "hazirlaniyor") durumClass = "bg-blue-100 text-blue-800";
                else if (siparis.durum === "iptal") durumClass = "bg-red-100 text-red-800 line-through opacity-70";
                else if (siparis.durum === "odendi") durumClass = "bg-purple-100 text-purple-800";

                const odemeYontemiText = siparis.odeme_yontemi || "-"; 
                let odemeYontemiClass = "text-gray-500";
                if (siparis.odeme_yontemi === "Nakit") odemeYontemiClass = "text-green-700";
                else if (siparis.odeme_yontemi === "Kredi Kartı") odemeYontemiClass = "text-blue-700";


                return (
                  <tr key={siparis.id} className="hover:bg-slate-50 text-sm transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap text-gray-700">#{siparis.id}</td>
                    <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-800">Masa {siparis.masa}</td>
                    <td className="px-4 py-3">
                      <div className="max-w-md truncate" title={fullText}>
                        {sepetDetay || (siparis.istek ? "(Sadece Not)" : "(İçerik Yok)")}
                      </div>
                      {siparis.istek && (
                        <div className="text-xs text-gray-500 mt-1 italic truncate max-w-md" title={`Not: ${siparis.istek}`}>
                          💬 {siparis.istek}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`px-2.5 py-1 text-xs font-semibold rounded-full leading-tight ${durumClass}`}>
                        {durumText}
                      </span>
                    </td>
                    <td className={`px-4 py-3 whitespace-nowrap font-medium ${odemeYontemiClass}`}>
                        {siparis.durum === "odendi" && siparis.odeme_yontemi === "Kredi Kartı" && <CreditCardIcon className="w-4 h-4 inline-block mr-1" />}
                        {siparis.durum === "odendi" && siparis.odeme_yontemi === "Nakit" && <DollarSign className="w-4 h-4 inline-block mr-1" />}
                        {odemeYontemiText}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-500">
                      {siparis.zaman
                        ? new Date(siparis.zaman).toLocaleString("tr-TR", {
                            year: "numeric",
                            month: "2-digit",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-lg mt-8">
        <h3 className="text-lg font-semibold mb-4 text-gray-700">⚙️ Sistem Bilgisi</h3>
        <div className="text-sm text-gray-600 space-y-2">
          <p>Neso Sipariş Asistanı Admin Paneli.</p>
          {currentUser && (
            <p className="mt-3 text-xs text-gray-500">
              Mevcut Giriş Yapan Kullanıcı: <strong>{currentUser.kullanici_adi}</strong> (Rol: {currentUser.rol})
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default AdminPaneli;