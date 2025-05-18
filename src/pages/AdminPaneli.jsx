// src/pages/AdminPaneli.jsx
import React, { useState, useEffect, useRef, useCallback, useContext } from "react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
} from "recharts";
import CountUp from "react-countup";
import {
  UserCheck, Coffee, Settings, LogOut, AlertCircle, MenuSquare, Trash2, PlusCircle, RotateCw, DollarSign, ListChecks, Users, Edit3, Eye, EyeOff, Save, XCircle, CheckCircle, UserPlus // Kullanıcı yönetimi için ikonlar
} from "lucide-react";
import apiClient from '../services/apiClient';
import { AuthContext } from '../AuthContext';
import { useNavigate } from 'react-router-dom';

// Kullanıcı rolleri (main.py'deki KullaniciRol enum'ı ile aynı olmalı)
const KULLANICI_ROLLER = ["admin", "kasiyer", "barista", "mutfak_personeli"];

function AdminPaneli() {
  const { isAuthenticated, currentUser, userRole, loadingAuth, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const [orders, setOrders] = useState([]);
  const [arama, setArama] = useState("");
  const [gunluk, setGunluk] = useState({ siparis_sayisi: 0, toplam_gelir: 0, satilan_urun_adedi: 0 });
  const [aylik, setAylik] = useState({ siparis_sayisi: 0, toplam_gelir: 0, satilan_urun_adedi: 0 });
  const [yillikChartData, setYillikChartData] = useState([]);
  const [populer, setPopuler] = useState([]);
  const [aktifMasaOzetleri, setAktifMasaOzetleri] = useState([]);
  const [menu, setMenu] = useState([]);
  const [yeniUrun, setYeniUrun] = useState({ ad: "", fiyat: "", kategori: "" });
  const [silUrunAdi, setSilUrunAdi] = useState("");
  const [error, setError] = useState(null);
  const [loadingData, setLoadingData] = useState(false); // Genel veri yükleme (istatistikler, menü, siparişler)
  const [loadingKullaniciIslemi, setLoadingKullaniciIslemi] = useState(false); // Sadece kullanıcı işlemleri için yükleme durumu
  const wsRef = useRef(null);

  // Kullanıcı Yönetimi State'leri
  const [kullaniciListesi, setKullaniciListesi] = useState([]);
  const [modalGoster, setModalGoster] = useState(false);
  const [modalModu, setModalModu] = useState("ekle"); // "ekle" veya "duzenle"
  const [seciliKullanici, setSeciliKullanici] = useState(null); // Düzenlenecek kullanıcıyı tutar
  const [kullaniciForm, setKullaniciForm] = useState({
    id: null,
    kullanici_adi: "",
    sifre: "",
    rol: KULLANICI_ROLLER[1], // Varsayılan rol 'kasiyer'
    aktif_mi: true,
  });

  const logInfo = useCallback((message) => console.log(`[Admin Paneli] INFO: ${message}`), []);
  const logError = useCallback((message, errorObj) => console.error(`[Admin Paneli] ERROR: ${message}`, errorObj || ""), []);
  const logWarn = useCallback((message) => console.warn(`[Admin Paneli] WARN: ${message}`), []);

  useEffect(() => {
    document.title = "Admin Paneli - Neso";
  }, []);

  const fetchKullanicilar = useCallback(async (showLoadingSpinner = true) => {
    if (userRole !== 'admin') return;
    if(showLoadingSpinner && !loadingData) setLoadingKullaniciIslemi(true);
    try {
      const response = await apiClient.get("/admin/kullanicilar");
      setKullaniciListesi(response.data || []);
      logInfo("Personel listesi güncellendi.");
    } catch (err) {
      logError("Personel listesi alınamadı:", err);
      setError(err.response?.data?.detail || "Personel listesi yüklenirken bir hata oluştu.");
       if (err.response?.status === 401 || err.response?.status === 403) logout();
    } finally {
      if(showLoadingSpinner && !loadingData) setLoadingKullaniciIslemi(false);
    }
  }, [userRole, logInfo, logError, logout, loadingData]); // loadingData eklendi, genel yükleyici aktifse kullanıcı yükleyicisini tetikleme

  const verileriGetir = useCallback(async (showLoading = true) => {
    if (showLoading) setLoadingData(true);
    setError(null);
    try {
      const promises = [
        apiClient.get(`/siparisler`),
        apiClient.get(`/istatistik/gunluk`),
        apiClient.get(`/istatistik/aylik`),
        apiClient.get(`/istatistik/yillik-aylik-kirilim`),
        apiClient.get(`/istatistik/en-cok-satilan`),
        apiClient.get(`/admin/aktif-masa-tutarlari`),
        apiClient.get(`/menu`),
      ];
      if (userRole === 'admin') {
         promises.push(apiClient.get(`/admin/kullanicilar`));
      }

      const [siparisRes, gunlukRes, aylikRes, yillikRes, populerRes, aktifMasalarTutarlariRes, menuRes, kullanicilarResOptional] = await Promise.all(promises);

      setOrders(siparisRes?.data?.orders || []);
      setGunluk(gunlukRes?.data || { siparis_sayisi: 0, toplam_gelir: 0, satilan_urun_adedi: 0 });
      setAylik(aylikRes?.data || { siparis_sayisi: 0, toplam_gelir: 0, satilan_urun_adedi: 0 });
      setPopuler(populerRes?.data || []);
      setAktifMasaOzetleri(aktifMasalarTutarlariRes?.data || []);
      const yillikHamVeri = yillikRes?.data?.aylik_kirilim || {};
      const formatlanmisYillikVeri = Object.entries(yillikHamVeri).map(([tarih, veri]) => ({ tarih, adet: Number(veri?.satilan_urun_adedi) || 0, gelir: Number(veri?.toplam_gelir) || 0 })).sort((a, b) => a.tarih.localeCompare(b.tarih));
      setYillikChartData(formatlanmisYillikVeri);
      setMenu(menuRes?.data?.menu || []);
      if (kullanicilarResOptional && userRole === 'admin') setKullaniciListesi(kullanicilarResOptional?.data || []);

      logInfo("✅ Admin verileri (personel dahil) başarıyla getirildi.");
    } catch (err) {
      logError("❌ Admin verileri alınamadı:", err);
      const errorDetail = err.response?.data?.detail || err.message || "Bilinmeyen bir hata oluştu.";
      if (err.response?.status === 401 || err.response?.status === 403) {
        setError("Bu verilere erişim yetkiniz yok veya oturumunuz sonlanmış. Lütfen tekrar giriş yapın.");
        logout();
      } else { setError(`Veriler alınamadı: ${errorDetail}`); }
    } finally {
      if (showLoading) setLoadingData(false);
    }
  }, [logInfo, logError, logout, userRole]);

  useEffect(() => {
    if (!loadingAuth) {
      if (isAuthenticated && userRole === 'admin') {
        verileriGetir();
      } else if (isAuthenticated && userRole !== 'admin') {
        navigate('/unauthorized');
      } else if (!isAuthenticated) {
        navigate('/login', { state: { from: { pathname: '/admin' } } });
      }
    }
  }, [isAuthenticated, userRole, loadingAuth, navigate, verileriGetir]);

  useEffect(() => {
    if (!isAuthenticated || userRole !== 'admin' || loadingAuth) {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close(1000, "User not admin or logged out");
        wsRef.current = null;
      }
      return;
    }
    let reconnectTimeoutId = null;
    let pingIntervalId = null;
    const connectWebSocket = () => {
        if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) return;
        const apiBaseForWs = process.env.REACT_APP_API_BASE;
        if (!apiBaseForWs) { logError("REACT_APP_API_BASE tanımlı değil, Admin WS kurulamıyor."); setError("API adresi yapılandırılmamış."); return; }
        try {
            const wsProtocol = apiBaseForWs.startsWith("https") ? "wss:" : (window.location.protocol === "https:" ? "wss:" : "ws:");
            const wsHost = apiBaseForWs.replace(/^https?:\/\//, "");
            const wsUrl = `${wsProtocol}//${wsHost}/ws/admin`;
            wsRef.current = new WebSocket(wsUrl);
            wsRef.current.onopen = () => { logInfo("✅ Admin WebSocket bağlantısı başarılı."); setError(null); if (reconnectTimeoutId) clearTimeout(reconnectTimeoutId); reconnectTimeoutId = null; };
            wsRef.current.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    if (["siparis", "durum", "masa_durum", "menu_guncellendi"].includes(message.type)) {
                        logInfo(`⚡ Admin WS: Genel ${message.type} alındı, ana veriler yenileniyor...`);
                        verileriGetir(false);
                    } else if (message.type === "kullanici_guncellendi") {
                        logInfo(`⚡ Admin WS: Kullanıcı güncellemesi alındı, personel listesi yenileniyor...`);
                        fetchKullanicilar(false);
                    } else if (message.type === "pong") { /* console.log("Admin Pong"); */ }
                } catch (err) { logError("Admin WS mesaj işleme hatası:", err); }
            };
            wsRef.current.onerror = (errorEvent) => { logError("❌ Admin WebSocket hatası:", errorEvent); setError("Admin WebSocket bağlantısında sorun oluştu."); };
            wsRef.current.onclose = (event) => {
                logInfo(`🔌 Admin WebSocket bağlantısı kapandı. Kod: ${event.code}, Sebep: ${event.reason || "Yok"}`);
                wsRef.current = null;
                if (isAuthenticated && userRole === 'admin' && event.code !== 1000 && event.code !== 1001 && !event.wasClean) {
                    const delay = 5000 + Math.random() * 2000;
                    reconnectTimeoutId = setTimeout(connectWebSocket, delay);
                }
            };
        } catch (error) { logError("❌ Admin WebSocket başlatılırken kritik hata:", error); setError("Admin WebSocket kurulamıyor."); }
    };
    connectWebSocket();
    pingIntervalId = setInterval(() => {
        if (isAuthenticated && userRole === 'admin' && wsRef.current?.readyState === WebSocket.OPEN) {
            try { wsRef.current.send(JSON.stringify({ type: "ping" })); } catch (err) { logError("Admin Ping gönderilemedi:", err); }
        } else if (isAuthenticated && userRole === 'admin' && !wsRef.current ) { connectWebSocket(); }
    }, 30000);
    return () => { clearInterval(pingIntervalId); if (reconnectTimeoutId) clearTimeout(reconnectTimeoutId); if (wsRef.current) { wsRef.current.close(1000, "Component unmounting"); wsRef.current = null; }};
  }, [isAuthenticated, userRole, loadingAuth, verileriGetir, fetchKullanicilar, logError, logInfo]);

  const urunEkle = useCallback(async () => {
    if (!yeniUrun.ad || !yeniUrun.fiyat || !yeniUrun.kategori) { alert("Lütfen tüm ürün bilgilerini girin."); return; }
    const fiyatNum = parseFloat(yeniUrun.fiyat);
    if (isNaN(fiyatNum) || fiyatNum < 0) { alert("Geçerli bir fiyat girin."); return; }
    setLoadingData(true); setError(null);
    try {
        await apiClient.post(`/menu/ekle`, { ...yeniUrun, fiyat: fiyatNum });
        setYeniUrun({ ad: "", fiyat: "", kategori: "" });
        await verileriGetir(false);
        alert("Ürün eklendi.");
    } catch (err) { logError("Ürün eklenemedi:", err); alert(`Ürün eklenemedi: ${err.response?.data?.detail || err.message}`); if (err.response?.status === 401 || err.response?.status === 403) logout(); }
    finally { setLoadingData(false); }
  }, [yeniUrun, verileriGetir, logError, logout]);

  const urunSil = useCallback(async () => {
    if (!silUrunAdi.trim()) { alert("Silinecek ürün adını girin."); return; }
    if (!window.confirm(`'${silUrunAdi.trim()}' ürününü silmek istediğinize emin misiniz?`)) return;
    setLoadingData(true); setError(null);
    try {
        await apiClient.delete(`/menu/sil`, { params: { urun_adi: silUrunAdi.trim() } });
        setSilUrunAdi("");
        await verileriGetir(false);
        alert("Ürün silindi.");
    } catch (err) { logError("Ürün silinemedi:", err); alert(`Ürün silinemedi: ${err.response?.data?.detail || err.message}`); if (err.response?.status === 401 || err.response?.status === 403) logout(); }
    finally { setLoadingData(false); }
  }, [silUrunAdi, verileriGetir, logError, logout]);

  const handleKullaniciFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setKullaniciForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value, }));
  };

  const modalAc = (mod = "ekle", kullanici = null) => {
    setModalModu(mod);
    setError(null);
    if (mod === "duzenle" && kullanici) {
      setSeciliKullanici(kullanici);
      setKullaniciForm({
        id: kullanici.id,
        kullanici_adi: kullanici.kullanici_adi,
        sifre: "",
        rol: kullanici.rol,
        aktif_mi: kullanici.aktif_mi,
      });
    } else {
      setSeciliKullanici(null);
      setKullaniciForm({ id: null, kullanici_adi: "", sifre: "", rol: KULLANICI_ROLLER[1], aktif_mi: true });
    }
    setModalGoster(true);
  };

  const handleKullaniciKaydet = async (e) => {
    e.preventDefault();
    setError(null);
    if (!kullaniciForm.kullanici_adi.trim()) { setError("Kullanıcı adı boş olamaz."); return; }
    if (modalModu === "ekle" && !kullaniciForm.sifre) { setError("Yeni personel için şifre zorunludur."); return; }
    if (kullaniciForm.sifre && kullaniciForm.sifre.length < 6) { setError("Şifre en az 6 karakter olmalıdır."); return; }

    setLoadingKullaniciIslemi(true);
    const payload = {
        kullanici_adi: kullaniciForm.kullanici_adi.trim(),
        rol: kullaniciForm.rol,
        aktif_mi: kullaniciForm.aktif_mi,
    };
    if (kullaniciForm.sifre) {
        payload.sifre = kullaniciForm.sifre;
    }

    try {
      if (modalModu === "ekle") {
        await apiClient.post("/admin/kullanicilar", payload);
        logInfo(`Yeni personel eklendi: ${payload.kullanici_adi}`);
      } else if (modalModu === "duzenle" && seciliKullanici) {
        await apiClient.put(`/admin/kullanicilar/${seciliKullanici.id}`, payload);
        logInfo(`Personel güncellendi: ID ${seciliKullanici.id}`);
      }
      setModalGoster(false);
      await fetchKullanicilar(false);
    } catch (err) {
      logError(`Personel ${modalModu === 'ekle' ? 'ekleme' : 'güncelleme'} hatası:`, err);
      setError(err.response?.data?.detail || `Personel ${modalModu === 'ekle' ? 'eklenirken' : 'güncellenirken'} bir hata oluştu.`);
      if (err.response?.status === 401 || err.response?.status === 403) logout();
    } finally {
      setLoadingKullaniciIslemi(false);
    }
  };

  const handleKullaniciSil = async (kullaniciId, kullaniciAdi) => {
    if (currentUser?.kullanici_adi === kullaniciAdi) { alert("Kendinizi silemezsiniz!"); return; }
    if (!window.confirm(`'${kullaniciAdi}' (ID: ${kullaniciId}) adlı personeli silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`)) return;
    setLoadingKullaniciIslemi(true); setError(null);
    try {
      await apiClient.delete(`/admin/kullanicilar/${kullaniciId}`);
      logInfo(`Personel silindi: ID ${kullaniciId}`);
      await fetchKullanicilar(false);
    } catch (err) {
      logError(`Personel silme hatası (ID: ${kullaniciId}):`, err);
      setError(err.response?.data?.detail || "Personel silinirken bir hata oluştu.");
      if (err.response?.status === 401 || err.response?.status === 403) logout();
    } finally { setLoadingKullaniciIslemi(false); }
  };

   const handleAktiflikDegistir = async (kullanici) => {
    if (currentUser?.kullanici_adi === kullanici.kullanici_adi && !kullanici.aktif_mi) { alert("Kendi hesabınızı pasif hale getiremezsiniz!"); return; }
    if (!window.confirm(`'${kullanici.kullanici_adi}' personelinin aktiflik durumunu (${kullanici.aktif_mi ? "Pasif Yap" : "Aktif Yap"}) değiştirmek istediğinize emin misiniz?`)) return;
    setLoadingKullaniciIslemi(true); setError(null);
    const payload = { aktif_mi: !kullanici.aktif_mi };

    try {
      await apiClient.put(`/admin/kullanicilar/${kullanici.id}`, payload);
      logInfo(`Personel aktiflik durumu değiştirildi: ID ${kullanici.id}`);
      await fetchKullanicilar(false);
    } catch (err) {
      logError(`Personel aktiflik değiştirme hatası (ID: ${kullanici.id}):`, err);
      setError(err.response?.data?.detail || "Personel aktiflik durumu değiştirilirken bir hata oluştu.");
      if (err.response?.status === 401 || err.response?.status === 403) logout();
    } finally { setLoadingKullaniciIslemi(false); }
  };

  const filtrelenmisSiparisler = orders.filter((o) => {
    if (!o || typeof o !== "object") return false;
    const aramaLower = arama.toLowerCase();
    let sepetText = "";
    if (Array.isArray(o.sepet)) { sepetText = o.sepet.map(item => item && typeof item === "object" ? `${item.adet || "?"}x ${item.urun || "?"}` : "").filter(Boolean).join(" "); }
    else if (typeof o.sepet === "string" && o.sepet.trim() && o.sepet !== "[]") { try { const parsedSepet = JSON.parse(o.sepet); if (Array.isArray(parsedSepet)) { sepetText = parsedSepet.map(item => item && typeof item === "object" ? `${item.adet || "?"}x ${item.urun || "?"}` : "").filter(Boolean).join(" "); } else { sepetText = o.sepet; } } catch (e) { sepetText = o.sepet; } }
    const aranacakMetin = [ String(o.id || ""), String(o.masa || ""), o.durum || "", o.istek || "", o.yanit || "", sepetText, o.zaman ? new Date(o.zaman).toLocaleString("tr-TR", { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : "" ].join(" ").toLowerCase();
    return aranacakMetin.includes(aramaLower);
  });

  if (loadingAuth) {
    return ( <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-sky-100 p-4"> <div className="bg-white shadow-xl p-8 rounded-lg text-center border border-slate-300"> <AlertCircle className="w-12 h-12 text-blue-500 mx-auto mb-4 animate-pulse" /> <h2 className="text-xl font-semibold mb-2 text-slate-700">Yükleniyor...</h2> <p className="text-slate-500">Admin paneli yetkileri kontrol ediliyor, lütfen bekleyin.</p> </div> </div> );
  }

  return (
    <div className="p-4 md:p-8 bg-gradient-to-tr from-slate-100 to-slate-200 min-h-screen text-gray-800 font-sans relative">
      {error && !modalGoster && ( <div className="bg-red-100 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded relative mb-6 shadow" role="alert"> <strong className="font-bold">Hata: </strong> <span className="block sm:inline mr-2">{error}</span> <button onClick={() => { setError(null); verileriGetir(); }} className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-semibold" disabled={loadingData || loadingKullaniciIslemi}> {loadingData || loadingKullaniciIslemi ? "Yükleniyor..." : "Tekrar Dene / Kapat"} </button> </div> )}
      {(loadingData && !modalGoster) && ( <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50"> <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500"></div> <p className="text-white text-lg ml-4">Veriler Yükleniyor...</p> </div> )}

      <div className="flex flex-wrap justify-between items-center mb-8 gap-4"> <h1 className="text-3xl md:text-4xl font-bold text-gray-800 flex items-center gap-3"> <Settings className="w-8 h-8 text-blue-600" /> Admin Paneli {currentUser && <span className="text-lg font-normal text-slate-500">({currentUser.kullanici_adi})</span>} </h1> <button onClick={logout} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg shadow-md flex items-center gap-2"> <LogOut className="w-4 h-4" /> Çıkış Yap </button> </div>

      {/* İstatistik Kartları */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-5 rounded-lg shadow-lg border-t-4 border-blue-500"> <h3 className="text-base font-semibold mb-2 flex items-center gap-2 text-gray-600"> <Coffee /> Günlük Ürün Adedi </h3> <CountUp end={gunluk?.satilan_urun_adedi || 0} separator="." className="text-3xl font-bold text-blue-700 block" /> </div>
        <div className="bg-white p-5 rounded-lg shadow-lg border-t-4 border-green-500"> <h3 className="text-base font-semibold mb-2 flex items-center gap-2 text-gray-600"> <DollarSign /> Günlük Gelir (Ödendi) </h3> <CountUp end={gunluk?.toplam_gelir || 0} separator="." decimal="," decimals={2} prefix="₺" className="text-3xl font-bold text-green-700 block" /> </div>
        <div className="bg-white p-5 rounded-lg shadow-lg border-t-4 border-purple-500"> <h3 className="text-base font-semibold mb-2 flex items-center gap-2 text-gray-600"> <UserCheck /> Aktif Masa Sayısı </h3> <CountUp end={aktifMasaOzetleri?.length || 0} separator="." className="text-3xl font-bold text-purple-700 block" /> </div>
        <div className="bg-white p-5 rounded-lg shadow-lg border-t-4 border-orange-500"> <h3 className="text-base font-semibold mb-2 flex items-center gap-2 text-gray-600"> 🏆 En Çok Satan </h3> {populer?.[0] ? <p className="text-lg font-bold text-orange-700 truncate" title={populer[0].urun}> {populer[0].urun} <span className="text-sm font-normal text-gray-500 ml-2"> ({populer[0].adet || 0} adet) </span> </p> : <p className="text-gray-500 text-sm">{loadingData ? "Yükleniyor..." : "Veri yok"}</p>}</div>
      </div>

      {/* Aktif Masalar Tablosu */}
      <div className="bg-white p-6 rounded-lg shadow-lg mb-8"> <h3 className="text-xl font-semibold mb-4 text-gray-700 flex items-center gap-2"> <ListChecks className="w-6 h-6 text-purple-600" /> Aktif Masalar ve Ödenmemiş Tutarları </h3> {(loadingData && aktifMasaOzetleri.length === 0) ? ( <div className="text-center py-10 text-gray-400 italic">Aktif masa verileri yükleniyor...</div> ) : aktifMasaOzetleri.length === 0 ? ( <div className="text-center py-10 text-gray-500">Şu anda aktif (ödenmemiş siparişi olan) masa bulunmamaktadır.</div> ) : ( <div className="overflow-x-auto"> <table className="min-w-full divide-y divide-gray-200 border rounded-md"> <thead className="bg-purple-100"> <tr> <th className="px-4 py-3 text-left text-xs font-medium text-purple-700 uppercase tracking-wider">Masa ID</th> <th className="px-4 py-3 text-left text-xs font-medium text-purple-700 uppercase tracking-wider">Aktif Sipariş Sayısı</th> <th className="px-4 py-3 text-right text-xs font-medium text-purple-700 uppercase tracking-wider">Ödenmemiş Toplam Tutar (TL)</th> </tr> </thead> <tbody className="bg-white divide-y divide-gray-200"> {aktifMasaOzetleri.map((masa) => ( <tr key={masa.masa_id} className="hover:bg-purple-50 text-sm"> <td className="px-4 py-3 whitespace-nowrap font-medium">{masa.masa_id}</td> <td className="px-4 py-3 whitespace-nowrap">{masa.aktif_siparis_sayisi}</td> <td className="px-4 py-3 whitespace-nowrap font-semibold text-right"> {typeof masa.odenmemis_tutar === 'number' ? masa.odenmemis_tutar.toFixed(2) : 'N/A'} </td> </tr> ))} </tbody> </table> </div> )} </div>

      {/* Grafikler */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8"> <div className="bg-white p-6 rounded-lg shadow-lg"> <h3 className="text-lg font-semibold mb-4 text-gray-700"> 📈 Aylık Ciro ve Ürün Adedi (Yıllık Kırılım) </h3> <div className="h-64"> {yillikChartData?.length > 0 ? ( <ResponsiveContainer width="100%" height="100%"> <LineChart data={yillikChartData} margin={{ top: 5, right: 35, left: -10, bottom: 5 }}> <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" /> <XAxis dataKey="tarih" fontSize={12} tickFormatter={(value) => value.substring(5)} /> <YAxis yAxisId="left" label={{ value: 'Adet', angle: -90, position: 'insideLeft', offset: 0, fontSize: 11 }} fontSize={12} allowDecimals={false} /> <YAxis yAxisId="right" orientation="right" label={{ value: 'Ciro (₺)', angle: -90, position: 'insideRight', offset: -15, fontSize: 11 }} fontSize={12} tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} /> <Tooltip formatter={(value, name, props) => name === "Aylık Ürün Adedi" ? [`${value} Adet`, `Dönem: ${props.payload.tarih}`] : name === "Aylık Ciro" ? [`₺${value.toFixed(2)}`, `Dönem: ${props.payload.tarih}`] : [value, name]} /> <Legend wrapperStyle={{fontSize: "12px"}}/> <Line yAxisId="left" type="monotone" dataKey="adet" name="Aylık Ürün Adedi" stroke="#4F46E5" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} /> <Line yAxisId="right" type="monotone" dataKey="gelir" name="Aylık Ciro" stroke="#22C55E" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} /> </LineChart> </ResponsiveContainer> ) : ( <div className="flex items-center justify-center h-full text-gray-500"> {loadingData ? "Yükleniyor..." : "Yıllık veri bulunamadı."} </div> )} </div> </div> <div className="bg-white p-6 rounded-lg shadow-lg"> <h3 className="text-lg font-semibold mb-4 text-gray-700"> 📊 En Çok Satan 5 Ürün (Adet) </h3> <div className="h-64"> {populer?.length > 0 ? ( <ResponsiveContainer width="100%" height="100%"> <BarChart data={populer.slice(0, 5)} layout="vertical" margin={{ top: 5, right: 30, left: 60, bottom: 5 }}> <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" /> <XAxis type="number" fontSize={12} allowDecimals={false} /> <YAxis dataKey="urun" type="category" fontSize={12} width={130} tick={{ textAnchor: "end", width: 125, fontSize: "11px" }} interval={0}/> <Tooltip formatter={(value) => [`${value} Adet`, "Satış Adedi"]} /> <Legend wrapperStyle={{fontSize: "12px"}}/> <Bar dataKey="adet" name="Satış Adedi" fill="#FB923C" barSize={20} /> </BarChart> </ResponsiveContainer> ) : ( <div className="flex items-center justify-center h-full text-gray-500"> {loadingData ? "Yükleniyor..." : "Popüler ürün verisi bulunamadı."} </div> )} </div> </div> </div>

      {/* Menü Yönetimi */}
       <div className="bg-white p-6 rounded-lg shadow-lg mb-8"> <h3 className="text-lg font-semibold mb-4 text-gray-700 flex items-center gap-2"> <MenuSquare className="w-5 h-5 text-teal-600" /> Menü Yönetimi </h3> <div className="grid grid-cols-1 md:grid-cols-3 gap-6"> <div className="md:col-span-1 space-y-6"> <div> <h4 className="font-medium mb-3 text-gray-600">Yeni Ürün Ekle</h4> <form onSubmit={(e) => { e.preventDefault(); urunEkle(); }}> <div className="space-y-3"> <input type="text" placeholder="Ürün Adı" value={yeniUrun.ad} onChange={(e) => setYeniUrun({ ...yeniUrun, ad: e.target.value })} className="w-full p-2 border rounded focus:ring-teal-500" required disabled={loadingData} /> <input type="number" placeholder="Fiyat" value={yeniUrun.fiyat} onChange={(e) => setYeniUrun({ ...yeniUrun, fiyat: e.target.value })} className="w-full p-2 border rounded focus:ring-teal-500" step="0.01" min="0" required disabled={loadingData} /> <input type="text" placeholder="Kategori" value={yeniUrun.kategori} onChange={(e) => setYeniUrun({ ...yeniUrun, kategori: e.target.value })} className="w-full p-2 border rounded focus:ring-teal-500" required disabled={loadingData} /> <button type="submit" disabled={loadingData || !yeniUrun.ad || !yeniUrun.fiyat || !yeniUrun.kategori} className={`w-full text-white py-2 rounded shadow flex items-center justify-center gap-2 ${loadingData || !yeniUrun.ad || !yeniUrun.fiyat || !yeniUrun.kategori ? "bg-gray-400 cursor-not-allowed" : "bg-teal-600 hover:bg-teal-700"}`}> {loadingData && yeniUrun.ad ? <RotateCw className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />} Ürün Ekle </button> </div> </form> </div> <div className="pt-4 border-t"> <h4 className="font-medium mb-3 text-gray-600">Ürün Sil</h4> <form onSubmit={(e) => { e.preventDefault(); urunSil(); }}> <div className="space-y-3"> <input type="text" placeholder="Silinecek Ürün Adı" value={silUrunAdi} onChange={(e) => setSilUrunAdi(e.target.value)} className="w-full p-2 border rounded focus:ring-red-500" required disabled={loadingData} /> <button type="submit" disabled={!silUrunAdi.trim() || loadingData} className={`w-full text-white py-2 rounded shadow flex items-center justify-center gap-2 ${!silUrunAdi.trim() || loadingData ? "bg-gray-400 cursor-not-allowed" : "bg-red-600 hover:bg-red-700"}`}> {loadingData && silUrunAdi.trim() ? <RotateCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Ürün Sil </button> </div> </form> </div> </div> <div className="md:col-span-2"> <h4 className="font-medium mb-3 text-gray-600">Mevcut Menü</h4> {(loadingData && menu.length === 0) && (<div className="text-center py-10 italic">Menü yükleniyor...</div>)} {(!loadingData && menu.length === 0) && (<div className="text-center py-10">Menü boş.</div>)} {menu?.length > 0 && ( <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-h-96 overflow-y-auto pr-2 scrollbar-thin border rounded-md p-2"> {menu.map((kategori) => ( <div key={kategori.kategori} className="bg-gray-50 p-4 rounded-lg border shadow-sm"> <h5 className="font-semibold mb-2 text-teal-700 capitalize">{kategori.kategori}</h5> <ul className="space-y-1 text-sm"> {(!kategori.urunler || kategori.urunler.length === 0) && (<li className="text-xs italic">Bu kategoride ürün yok.</li>)} {kategori.urunler?.map((urun) => ( <li key={`${kategori.kategori}-${urun.ad}`} className="flex justify-between items-center py-1.5"> <span className={`${urun.stok_durumu === 0 ? 'text-red-500 line-through' : ''} truncate max-w-[60%]`}>{urun.ad}</span> <span className={`font-medium ${urun.stok_durumu === 0 ? 'text-red-400' : ''}`}> {typeof urun.fiyat === 'number' ? `₺${urun.fiyat.toFixed(2)}` : 'N/A'} {urun.stok_durumu === 0 && <span className="text-xs ml-1">(Stok Yok)</span>} </span> </li> ))} </ul> </div> ))} </div> )} </div> </div> </div>

      {/* KULLANICI YÖNETİMİ BÖLÜMÜ */}
      <div className="bg-white p-6 rounded-lg shadow-lg mt-8">
        <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
          <h3 className="text-xl font-semibold text-gray-700 flex items-center gap-3">
            <Users className="w-6 h-6 text-indigo-600" /> Personel Yönetimi
          </h3>
          <button
            onClick={() => modalAc("ekle")}
            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg shadow-md flex items-center gap-2 transition duration-150 ease-in-out active:scale-95"
            disabled={loadingKullaniciIslemi || loadingData}
          >
            <UserPlus className="w-5 h-5" /> Yeni Personel Ekle
          </button>
        </div>
        {(loadingData && kullaniciListesi.length === 0 && !modalGoster) ? ( // Modal açık değilken genel yükleyiciyi göster
          <div className="text-center py-10 text-gray-400 italic">Personel listesi yükleniyor...</div>
        ) : kullaniciListesi.length === 0 && !modalGoster ? (
          <div className="text-center py-10 text-gray-500">Kayıtlı personel bulunmamaktadır.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 border border-gray-200 rounded-md">
              <thead className="bg-indigo-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-indigo-700 uppercase tracking-wider">ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-indigo-700 uppercase tracking-wider">Kullanıcı Adı</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-indigo-700 uppercase tracking-wider">Rol</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-indigo-700 uppercase tracking-wider">Durum</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-indigo-700 uppercase tracking-wider">İşlemler</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {kullaniciListesi.map((k) => (
                  <tr key={k.id} className="hover:bg-indigo-50 text-sm transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600">{k.id}</td>
                    <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-800">{k.kullanici_adi}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600 capitalize">{k.rol.replace('_personeli', ' P.')}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <button
                        onClick={() => handleAktiflikDegistir(k)}
                        disabled={loadingKullaniciIslemi || (currentUser?.kullanici_adi === k.kullanici_adi && k.aktif_mi)}
                        title={currentUser?.kullanici_adi === k.kullanici_adi && k.aktif_mi ? "Kendinizi pasif yapamazsınız" : (k.aktif_mi ? "Pasif Yap" : "Aktif Yap")}
                        className={`px-2.5 py-1 text-xs font-semibold rounded-full leading-tight transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                                          ${ k.aktif_mi
                                              ? "bg-green-100 text-green-800 hover:bg-green-200"
                                              : "bg-red-100 text-red-800 hover:bg-red-200"
                                          }`}
                      >
                        {loadingKullaniciIslemi && seciliKullanici?.id === k.id && modalModu === 'aktiflik' ? <RotateCw className="animate-spin w-3 h-3 inline-block"/> : (k.aktif_mi ? <CheckCircle size={14} className="inline-block mr-1"/> : <XCircle size={14} className="inline-block mr-1"/>)}
                        {k.aktif_mi ? "Aktif" : "Pasif"}
                      </button>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium space-x-3">
                      <button onClick={() => modalAc("duzenle", k)} disabled={loadingKullaniciIslemi} className="text-yellow-600 hover:text-yellow-800 transition disabled:opacity-50" title="Düzenle"><Edit3 size={18} /></button>
                      {currentUser && currentUser.kullanici_adi !== k.kullanici_adi && (
                         <button onClick={() => handleKullaniciSil(k.id, k.kullanici_adi)} disabled={loadingKullaniciIslemi} className="text-red-600 hover:text-red-800 transition disabled:opacity-50" title="Sil"><Trash2 size={18} /></button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Kullanıcı Ekle/Düzenle Modal */}
      {modalGoster && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75 backdrop-blur-sm overflow-y-auto h-full w-full flex items-center justify-center z-40" onClick={() => {if(!loadingKullaniciIslemi) setModalGoster(false)}}>
          <div className="relative mx-auto p-6 md:p-8 border w-full max-w-lg shadow-2xl rounded-xl bg-white" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-5">
                <h3 className="text-xl font-semibold text-gray-800">
                    {modalModu === "ekle" ? "Yeni Personel Ekle" : `Personeli Düzenle: ${seciliKullanici?.kullanici_adi}`}
                </h3>
                <button onClick={() => {if(!loadingKullaniciIslemi) setModalGoster(false)}} disabled={loadingKullaniciIslemi} className="text-gray-400 hover:text-gray-600 transition rounded-full p-1 -mt-1 -mr-1">
                    <XCircle size={26}/>
                </button>
            </div>
            {error && modalGoster && <p className="text-red-600 text-sm mb-4 bg-red-50 p-3 rounded-md border border-red-200 flex items-center gap-2"><AlertCircle size={18}/> {error}</p>}
            <form onSubmit={handleKullaniciKaydet} className="space-y-5">
              <div>
                <label htmlFor="modal_kullanici_adi" className="block text-sm font-medium text-gray-700 mb-1">Kullanıcı Adı <span className="text-red-500">*</span></label>
                <input type="text" name="kullanici_adi" id="modal_kullanici_adi" value={kullaniciForm.kullanici_adi} onChange={handleKullaniciFormChange} required disabled={loadingKullaniciIslemi} className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition disabled:bg-gray-50" />
              </div>
              <div>
                <label htmlFor="modal_sifre" className="block text-sm font-medium text-gray-700 mb-1">Şifre {modalModu === "ekle" && <span className="text-red-500">*</span>} {modalModu === "duzenle" && "(Değiştirmek istemiyorsanız boş bırakın)"}</label>
                <input type="password" name="sifre" id="modal_sifre" value={kullaniciForm.sifre} onChange={handleKullaniciFormChange} required={modalModu === "ekle"} minLength={kullaniciForm.sifre ? 6 : undefined} disabled={loadingKullaniciIslemi} className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition disabled:bg-gray-50" />
              </div>
              <div>
                <label htmlFor="modal_rol" className="block text-sm font-medium text-gray-700 mb-1">Rol <span className="text-red-500">*</span></label>
                <select name="rol" id="modal_rol" value={kullaniciForm.rol} onChange={handleKullaniciFormChange} disabled={loadingKullaniciIslemi} className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition disabled:bg-gray-50 appearance-none bg-white bg-no-repeat bg-right pr-8" style={{backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.5rem center', backgroundSize: '1.5em 1.5em'}}>
                  {KULLANICI_ROLLER.map(r => (
                    <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1).replace('_personeli', ' Personeli')}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center pt-2">
                <input type="checkbox" name="aktif_mi" id="modal_aktif_mi" checked={kullaniciForm.aktif_mi} onChange={handleKullaniciFormChange} disabled={loadingKullaniciIslemi || (modalModu==='duzenle' && currentUser?.kullanici_adi === seciliKullanici?.kullanici_adi)} className="h-5 w-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 shadow-sm disabled:opacity-60" title={modalModu==='duzenle' && currentUser?.kullanici_adi === seciliKullanici?.kullanici_adi ? "Kendinizi pasif yapamazsınız" : ""} />
                <label htmlFor="modal_aktif_mi" className={`ml-2.5 block text-sm ${loadingKullaniciIslemi || (modalModu==='duzenle' && currentUser?.kullanici_adi === seciliKullanici?.kullanici_adi) ? "text-gray-500" : "text-gray-800"}`}>Personel Aktif</label>
              </div>
              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 mt-6">
                <button type="button" onClick={() => {if(!loadingKullaniciIslemi) setModalGoster(false)}} disabled={loadingKullaniciIslemi} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg shadow-sm transition disabled:opacity-70">İptal</button>
                <button type="submit" disabled={loadingKullaniciIslemi} className="px-5 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm flex items-center gap-2 transition disabled:opacity-70">
                  {loadingKullaniciIslemi ? <RotateCw className="animate-spin w-4 h-4" /> : <Save size={16}/>}
                  {modalModu === "ekle" ? "Personeli Kaydet" : "Değişiklikleri Kaydet"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sipariş Geçmişi */}
       <div className="bg-white p-6 rounded-lg shadow-lg mt-8"> <h3 className="text-lg font-semibold mb-4 text-gray-700">📋 Sipariş Geçmişi</h3> <input type="text" placeholder="Sipariş Ara (ID, Masa, Durum, İçerik, Not, Tarih...)" value={arama} onChange={(e) => setArama(e.target.value)} className="w-full p-3 border rounded mb-4 focus:ring-blue-500" /> <div className="overflow-x-auto"> <table className="min-w-full divide-y divide-gray-200 border rounded-md"> <thead className="bg-gray-100"> <tr> <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">ID</th> <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Masa</th> <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider min-w-[200px]">Sipariş İçeriği & Not</th> <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Durum</th> <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Tarih</th> </tr> </thead> <tbody className="bg-white divide-y divide-gray-200"> {(loadingData && filtrelenmisSiparisler.length === 0 && (!arama && orders.length === 0)) && (<tr><td colSpan="5" className="text-center py-10 italic">Siparişler yükleniyor...</td></tr>)} {(!loadingData && filtrelenmisSiparisler.length === 0) && (<tr><td colSpan="5" className="text-center py-10">{arama ? "Aramanızla eşleşen sipariş bulunamadı." : orders.length === 0 ? "Henüz sipariş yok." : "Filtreyle eşleşen sipariş bulunamadı."}</td></tr>)} {filtrelenmisSiparisler.map((siparis) => { let sepetDetay = "Detay yok"; if (Array.isArray(siparis.sepet) && siparis.sepet.length > 0) { sepetDetay = siparis.sepet.map(item => item && typeof item === "object" ? `${item.adet || "?"}x ${item.urun || "?"}` : "").filter(Boolean).join(", "); } else if (typeof siparis.sepet === "string" && siparis.sepet.trim() && siparis.sepet !== "[]") { try { const parsedSepet = JSON.parse(siparis.sepet); if (Array.isArray(parsedSepet) && parsedSepet.length > 0) { sepetDetay = parsedSepet.map(item => item && typeof item === "object" ? `${item.adet || "?"}x ${item.urun || "?"}` : "").filter(Boolean).join(", "); } else { sepetDetay = "Detay okunamadı"; } } catch { sepetDetay = "Detay okunamadı"; } } const fullText = `${sepetDetay}${siparis.istek ? ` | Not: ${siparis.istek}` : ""}`; const durumText = siparis.durum ? siparis.durum.charAt(0).toUpperCase() + siparis.durum.slice(1) : "Bilinmiyor"; let durumClass = "bg-yellow-100 text-yellow-800"; if (siparis.durum === "hazir") durumClass = "bg-green-100 text-green-800"; else if (siparis.durum === "hazirlaniyor") durumClass = "bg-blue-100 text-blue-800"; else if (siparis.durum === "iptal") durumClass = "bg-red-100 text-red-800 line-through"; else if (siparis.durum === "odendi") durumClass = "bg-purple-100 text-purple-800"; return ( <tr key={siparis.id} className="hover:bg-slate-50 text-sm"> <td className="px-4 py-3">#{siparis.id}</td> <td className="px-4 py-3 font-medium">Masa {siparis.masa}</td> <td className="px-4 py-3"> <div className="max-w-md truncate" title={fullText}>{sepetDetay || (siparis.istek ? "(Sadece Not)" : "(İçerik Yok)")}</div> {siparis.istek && (<div className="text-xs text-gray-500 mt-1 italic truncate max-w-md" title={`Not: ${siparis.istek}`}>💬 {siparis.istek}</div>)} </td> <td className="px-4 py-3"><span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${durumClass}`}>{durumText}</span></td> <td className="px-4 py-3">{siparis.zaman ? new Date(siparis.zaman).toLocaleString("tr-TR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit"}) : "-"}</td> </tr> ); })} </tbody> </table> </div> </div>

      {/* Eski Ayarlar Bölümü */}
      <div className="bg-white p-6 rounded-lg shadow-lg mt-8">
        <h3 className="text-lg font-semibold mb-4 text-gray-700">⚙️ Genel Ayarlar</h3>
        <div className="text-sm text-gray-600 space-y-2">
          <p>Bu bölümden genel uygulama ayarları veya gelecekte eklenecek diğer yönetimsel işlevler yönetilebilir.</p>
          {currentUser && (
            <p className="mt-3 text-xs text-gray-500">
              Mevcut Giriş Yapan Kullanıcı: <strong>{currentUser.kullanici_adi}</strong> (Rol: {currentUser.rol})
            </p>
          )}
        </div>
      </div>
      <div className="text-center mt-8 text-xs text-gray-500">
        Neso Admin Paneli &copy; {new Date().getFullYear()}
      </div>
    </div>
  );
}

export default AdminPaneli;