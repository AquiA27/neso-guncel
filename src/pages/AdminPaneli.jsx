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
  Trash2, // Silme için kullanılacak
  PlusCircle,
  RotateCw,
  DollarSign, 
  ListChecks, 
  CreditCard as CreditCardIcon,
  Users, 
  UserPlus,
  Edit3, // Düzenleme için eklendi
  X, // Modal kapatma için eklendi
  Archive, // Stok Kategorileri için eklendi
  Boxes,   // Stok Kalemleri için eklendi
  ClipboardEdit, // Stok Yönetimi genel ikonu için eklendi
  ChevronDown, // Detay gösterme/gizleme için eklendi
  ChevronUp,   // Detay gösterme/gizleme için eklendi
  ShoppingBag, // Popüler ürünler için eklendi
  ClipboardList, // Menü kategori yönetimi için eklendi
} from "lucide-react"; // Eksik ikonlar eklendi
import apiClient from '../services/apiClient'; 
import { AuthContext } from '../AuthContext'; 
import { useNavigate } from 'react-router-dom'; 

const KULLANICI_ROLLER = ["admin", "kasiyer", "barista", "mutfak_personeli"];

// YENİ EKLENEN KISIM BAŞLANGICI: Genel Modal Bileşeni
const Modal = ({ isOpen, onClose, title, children, size = "max-w-lg" }) => {
  useEffect(() => {
    const handleEsc = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
    }
    return () => {
      document.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[999] p-4 overflow-y-auto"
        onClick={onClose} // Overlay'e tıklayınca kapat
    >
      <div 
        className={`bg-white p-5 sm:p-6 rounded-xl shadow-2xl ${size} w-full m-4 transform transition-all duration-300 ease-out`}
        onClick={(e) => e.stopPropagation()} // Modal içeriğine tıklayınca kapanmasın
      >
        <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-200">
          <h3 className="text-lg sm:text-xl font-semibold text-slate-700">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-colors">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};
// YENİ EKLENEN KISIM SONU

function AdminPaneli() {
  const { isAuthenticated, currentUser, userRole, loadingAuth, logout } = useContext(AuthContext); 
  const navigate = useNavigate(); 

  // Genel State'ler
  const [error, setError] = useState(null);
  const wsRef = useRef(null);

  // Dashboard State'leri
  const [orders, setOrders] = useState([]);
  const [arama, setArama] = useState("");
  // DEĞİŞTİRİLEN KISIM: gunluk state'i gelir detaylarını içerecek şekilde güncellendi
  const [gunluk, setGunluk] = useState({
    siparis_sayisi: 0,
    toplam_gelir: 0,
    satilan_urun_adedi: 0,
    nakit_gelir: 0, 
    kredi_karti_gelir: 0, 
    diger_odeme_yontemleri_gelir: 0, 
  });
  // DEĞİŞTİRİLEN KISIM SONU
  const [aylik, setAylik] = useState({
    siparis_sayisi: 0,
    toplam_gelir: 0,
    satilan_urun_adedi: 0,
  });
  const [yillikChartData, setYillikChartData] = useState([]);
  const [populer, setPopuler] = useState([]);
  const [aktifMasaOzetleri, setAktifMasaOzetleri] = useState([]);
  const [dailyIncomeDetailsVisible, setDailyIncomeDetailsVisible] = useState(false); // YENİ: Günlük gelir detayı için

  // Menü Yönetimi State'leri
  const [menu, setMenu] = useState([]);
  const [yeniUrun, setYeniUrun] = useState({ ad: "", fiyat: "", kategori: "" });
  const [silUrunAdi, setSilUrunAdi] = useState("");
  // YENİ EKLENEN KISIM BAŞLANGICI: Menü Kategori Yönetimi State'leri
  const [menuKategorileri, setMenuKategorileri] = useState([]); 
  const [showDeleteCategoryModal, setShowDeleteCategoryModal] = useState(false); 
  const [categoryToDelete, setCategoryToDelete] = useState(null); 
  const [loadingMenu, setLoadingMenu] = useState(false); // Menü ve kategori işlemleri için genel loading
  // YENİ EKLENEN KISIM SONU
  
  // Kullanıcı Yönetimi State'leri
  const [kullanicilar, setKullanicilar] = useState([]);
  const initialYeniKullaniciState = { kullanici_adi: "", sifre: "", rol: KULLANICI_ROLLER[1], aktif_mi: true }; // YENİ: initial state
  const [yeniKullanici, setYeniKullanici] = useState(initialYeniKullaniciState);
  const [showAddUserForm, setShowAddUserForm] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  // YENİ EKLENEN KISIM BAŞLANGICI: Kullanıcı Düzenleme/Silme State'leri
  const [editingUser, setEditingUser] = useState(null); 
  const [showEditUserModal, setShowEditUserModal] = useState(false); 
  const [userToDelete, setUserToDelete] = useState(null); 
  const [showDeleteUserModal, setShowDeleteUserModal] = useState(false); 
  // YENİ EKLENEN KISIM SONU

  // YENİ EKLENEN KISIM BAŞLANGICI: Stok Yönetimi State'leri
  const [stokKategorileri, setStokKategorileri] = useState([]);
  const [showStokKategoriModal, setShowStokKategoriModal] = useState(false);
  const initialEditingStokKategori = { ad: "" };
  const [editingStokKategori, setEditingStokKategori] = useState(initialEditingStokKategori); 
  const [stokKategoriToDelete, setStokKategoriToDelete] = useState(null);

  const [stokKalemleri, setStokKalemleri] = useState([]);
  const [showStokKalemiModal, setShowStokKalemiModal] = useState(false);
  const initialEditingStokKalemi = { ad: "", stok_kategori_id: "", birim: "", mevcut_miktar: 0, min_stok_seviyesi: 0, son_alis_fiyati: "" };
  const [editingStokKalemi, setEditingStokKalemi] = useState(initialEditingStokKalemi);
  const [stokKalemiToDelete, setStokKalemiToDelete] = useState(null);
  const [selectedStokKategoriFilter, setSelectedStokKategoriFilter] = useState("");
  const [loadingStok, setLoadingStok] = useState(false);
  // YENİ EKLENEN KISIM SONU

  // DEĞİŞTİRİLEN KISIM: loadingData state'i genel bir yükleme state'i olarak kullanılmayacak, her bölüm kendi loading state'ini yönetecek.
  // const [loadingData, setLoadingData] = useState(false); // Bu satır kaldırıldı veya farklı bir amaçla kullanılabilir.
  // Bunun yerine spesifik loading state'leri kullanılacak: loadingDashboard, loadingMenu, loadingUsers, loadingStok
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  // loadingMenu, loadingUsers, loadingStok yukarıda tanımlandı.

  const logInfo = useCallback((message) => console.log(`[Admin Paneli] INFO: ${message}`), []);
  const logError = useCallback((message, errorObj) => console.error(`[Admin Paneli] ERROR: ${message}`, errorObj || ""), []);
  const logWarn = useCallback((message) => console.warn(`[Admin Paneli] WARN: ${message}`), []);
  // const logDebug = useCallback((message) => console.log(`[Admin Paneli] DEBUG: ${message}`), []);


  useEffect(() => {
    document.title = "Admin Paneli - Neso";
  }, []);

  // YENİ EKLENEN KISIM BAŞLANGICI: Genel API Hata Yönetimi
  const handleApiError = useCallback((err, defaultMessage = "Bilinmeyen bir hata oluştu.", context = "Bilinmeyen İşlem") => {
    const errorDetail = err.response?.data?.detail || err.message || defaultMessage;
    logError(`❌ ${context} hatası:`, err);
    setError(`${context}: ${errorDetail}`); // Global error state'i
    // alert(`${context} sırasında hata: ${errorDetail}`); // Kullanıcıya alert ile de gösterilebilir
    if (err.response?.status === 401 || err.response?.status === 403) {
      alert("Oturumunuz sonlanmış veya bu işlem için yetkiniz bulunmuyor. Lütfen tekrar giriş yapın.");
      logout();
    }
  }, [logError, logout]);
  // YENİ EKLENEN KISIM SONU


  // YENİ EKLENEN KISIM BAŞLANGICI: Menü Kategorilerini Çekme
  const fetchMenuKategorileri = useCallback(async () => {
    logInfo("🗂️ Menü kategorileri getiriliyor...");
    setLoadingMenu(true); setError(null);
    try {
      const response = await apiClient.get("/admin/menu/kategoriler");
      setMenuKategorileri(response.data || []);
      logInfo(`✅ Menü kategorileri başarıyla getirildi (${response.data?.length || 0} adet).`);
    } catch (err) {
      handleApiError(err, "Menü kategorileri alınırken bir hata oluştu.", "Menü Kategori Listeleme");
    } finally {
      setLoadingMenu(false);
    }
  }, [logInfo, handleApiError]); // Bağımlılıklara handleApiError eklendi
  // YENİ EKLENEN KISIM SONU

  const kullanicilariGetir = useCallback(async () => {
    logInfo("👥 Kullanıcılar getiriliyor...");
    setLoadingUsers(true); setError(null);
    try {
      const response = await apiClient.get("/admin/kullanicilar");
      setKullanicilar(response.data || []);
      logInfo(`✅ Kullanıcılar başarıyla getirildi (${response.data?.length || 0} adet).`);
    } catch (err) {
      handleApiError(err, "Kullanıcı listesi alınamadı.", "Kullanıcı Listeleme");
    } finally {
      setLoadingUsers(false);
    }
  }, [logInfo, handleApiError]); // Bağımlılıklara handleApiError eklendi

  const verileriGetir = useCallback(async () => { // Bu fonksiyon dashboard verilerini getirir
    logInfo(`🔄 Dashboard verileri getiriliyor (Admin)...`);
    setLoadingDashboard(true); setError(null); // loadingData yerine loadingDashboard
    try {
      const [ siparisRes, gunlukRes, aylikRes, yillikRes, populerRes, aktifMasalarTutarlariRes, menuRes ] = await Promise.all([
        apiClient.get(`/siparisler`), 
        apiClient.get(`/istatistik/gunluk`), // Backend bu endpoint'te gelir detaylarını verecek
        apiClient.get(`/istatistik/aylik`),
        apiClient.get(`/istatistik/yillik-aylik-kirilim`),
        apiClient.get(`/istatistik/en-cok-satilan`),
        apiClient.get(`/admin/aktif-masa-tutarlari`), 
        apiClient.get(`/menu`), 
      ]);

      setOrders(siparisRes?.data?.orders || []);
      // DEĞİŞTİRİLEN KISIM: gunluk state'i gelir detaylarını içerecek şekilde güncellendi
      setGunluk( gunlukRes?.data || { siparis_sayisi: 0, toplam_gelir: 0, satilan_urun_adedi: 0, nakit_gelir: 0, kredi_karti_gelir: 0, diger_odeme_yontemleri_gelir: 0 } );
      // DEĞİŞTİRİLEN KISIM SONU
      setAylik( aylikRes?.data || { siparis_sayisi: 0, toplam_gelir: 0, satilan_urun_adedi: 0 } );
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

      setMenu(menuRes?.data?.menu || []); // Menü ürünleri de burada çekiliyor
      logInfo("✅ Temel admin dashboard verileri başarıyla getirildi.");
    } catch (err) {
      handleApiError(err, "Dashboard verileri alınamadı.", "Dashboard Veri Çekme");
    } finally {
      setLoadingDashboard(false); // loadingData yerine loadingDashboard
    }
  }, [logInfo, handleApiError]); // Bağımlılıklara handleApiError eklendi


  // YENİ EKLENEN KISIM BAŞLANGICI: Stok Yönetimi Veri Çekme Fonksiyonları
  const fetchStokKategorileri = useCallback(async () => {
    logInfo("🧺 Stok kategorileri getiriliyor...");
    setLoadingStok(true); setError(null);
    try {
      const response = await apiClient.get("/admin/stok/kategoriler");
      setStokKategorileri(response.data || []);
    } catch (err) {
      handleApiError(err, "Stok kategorileri alınamadı.", "Stok Kategorileri");
    } finally {
      setLoadingStok(false);
    }
  }, [logInfo, handleApiError]);

  const fetchStokKalemleri = useCallback(async (kategoriId = null) => {
    logInfo(`📦 Stok kalemleri getiriliyor (Kategori ID: ${kategoriId || 'Tümü'})...`);
    setLoadingStok(true); setError(null);
    try {
      const params = {};
      if (kategoriId && kategoriId !== "") params.kategori_id = kategoriId;
      // İleride eklenebilir: if (sadeceDusukStok) params.dusuk_stok = true;
      const response = await apiClient.get("/admin/stok/kalemler", { params });
      setStokKalemleri(response.data || []);
    } catch (err) {
      handleApiError(err, "Stok kalemleri alınamadı.", "Stok Kalemleri");
    } finally {
      setLoadingStok(false);
    }
  }, [logInfo, handleApiError]);
  // YENİ EKLENEN KISIM SONU

  // YENİ EKLENEN KISIM BAŞLANGICI: Tüm verileri yenilemek için bir fonksiyon
  const refreshAllAdminData = useCallback(() => {
    logInfo("🔄 Tüm admin verileri yenileniyor...");
    verileriGetir();
    kullanicilariGetir();
    fetchMenuKategorileri();
    fetchStokKategorileri();
    fetchStokKalemleri(selectedStokKategoriFilter || null); // Mevcut filtreyle stok kalemlerini de yenile
  }, [verileriGetir, kullanicilariGetir, fetchMenuKategorileri, fetchStokKategorileri, fetchStokKalemleri, selectedStokKategoriFilter, logInfo]);
  // YENİ EKLENEN KISIM SONU

  useEffect(() => {
    if (!loadingAuth) { 
      if (isAuthenticated && userRole === 'admin') {
        logInfo("Admin giriş yapmış ve yetkili, tüm veriler çekiliyor...");
        refreshAllAdminData(); // Tüm verileri çek
      } else if (isAuthenticated && userRole !== 'admin') {
        logWarn("Admin olmayan kullanıcı admin paneline erişmeye çalıştı. Yetkisiz sayfasına yönlendiriliyor...");
        navigate('/unauthorized');
      } else if (!isAuthenticated) {
        logWarn("Giriş yapılmamış, admin paneli için login'e yönlendiriliyor.");
        navigate('/login', { state: { from: { pathname: '/admin' } } });
      }
    }
  }, [isAuthenticated, userRole, loadingAuth, navigate, refreshAllAdminData, logInfo, logWarn]); // refreshAllAdminData eklendi


  // DEĞİŞTİRİLEN KISIM: WebSocket onmessage güncellendi
  useEffect(() => {
    if (!isAuthenticated || userRole !== 'admin' || loadingAuth) {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close(1000, "User not admin or logged out for Admin WS");
        wsRef.current = null;
      }
      return; 
    }
    // ... (WebSocket bağlantı ve ping mantığı mevcut haliyle kalacak)
    // Sadece onmessage kısmını güncelliyoruz:
    // connectWebSocket fonksiyonu içindeki wsRef.current.onmessage = (event) => { ... };
    // bloğunu aşağıdaki gibi güncelleyin:
    const connectWebSocket = () => {
      // ... (mevcut connectWebSocket başı)
      wsRef.current.onmessage = (event) => { // Bu blok güncellenecek
        try {
          const message = JSON.parse(event.data);
          logInfo(`📥 Admin WS mesajı alındı: Tip: ${message.type}`);
          if (["siparis", "durum", "masa_durum"].includes(message.type)) {
            logInfo(`⚡ Admin WS: ${message.type} alındı, Dashboard verileri yenileniyor...`);
            verileriGetir();
          } else if (message.type === "menu_guncellendi") {
            logInfo(`⚡ Admin WS: Menü ürünleri güncellendi, Menü ve Dashboard verileri yenileniyor...`);
            verileriGetir(); // Dashboard'daki menü verisini de yeniler
          } else if (message.type === "kategori_guncellendi") {
            logInfo(`⚡ Admin WS: Menü kategorileri güncellendi, Kategori ve Menü verileri yenileniyor...`);
            fetchMenuKategorileri();
            verileriGetir(); // Menü listesi de değişmiş olabilir
          } else if (message.type === "stok_guncellendi") {
            logInfo(`⚡ Admin WS: Stok verileri güncellendi, Stok kategorileri ve kalemleri yenileniyor...`);
            fetchStokKategorileri();
            fetchStokKalemleri(selectedStokKategoriFilter || null);
          } else if (message.type === "kullanici_guncellendi") {
            logInfo(`⚡ Admin WS: Kullanıcı listesi güncellendi, kullanıcılar yenileniyor...`);
            kullanicilariGetir();
          }
          // ... (pong ve diğer mesaj tipleri mevcut haliyle kalabilir)
        } catch (err) { logError("Admin WS mesaj işleme hatası:", err); }
      };
      // ... (mevcut connectWebSocket sonu)
    };
    // ... (WebSocket geri kalan mantığı)
  }, [isAuthenticated, userRole, loadingAuth, logInfo, logError, logWarn, verileriGetir, fetchMenuKategorileri, kullanicilariGetir, fetchStokKategorileri, fetchStokKalemleri, selectedStokKategoriFilter]);
  // DEĞİŞTİRİLEN KISIM SONU


  const urunEkle = useCallback(async () => {
    if (!yeniUrun.ad || !yeniUrun.fiyat || !yeniUrun.kategori) { alert("Lütfen ürün adı, fiyatı ve kategorisini girin."); return; }
    const fiyatNum = parseFloat(yeniUrun.fiyat);
    if (isNaN(fiyatNum) || fiyatNum < 0) { alert("Lütfen geçerli bir fiyat girin."); return; }
    setLoadingMenu(true); setError(null);
    try {
      await apiClient.post(`/menu/ekle`, { ...yeniUrun, fiyat: fiyatNum });
      alert("Ürün başarıyla eklendi.");
      setYeniUrun({ ad: "", fiyat: "", kategori: "" });
      await verileriGetir(); // Menü listesini de günceller ve AI prompt'u tetikler
      await fetchMenuKategorileri(); // Yeni kategori eklendiyse listeyi günceller
    } catch (err) { handleApiError(err, "Ürün eklenemedi", "Menü Ürün Ekleme"); }
    finally { setLoadingMenu(false); }
  }, [yeniUrun, verileriGetir, fetchMenuKategorileri, handleApiError, setLoadingMenu, setError]); 

  const urunSil = useCallback(async () => {
    if (!silUrunAdi) { alert("Lütfen silinecek ürünün adını girin."); return; }
    const urunAdiTrimmed = silUrunAdi.trim();
    // ... (urunVarMi kontrolü mevcut haliyle kalabilir) ...
    if (!window.confirm(`'${urunAdiTrimmed}' adlı ürünü silmek istediğinize emin misiniz?`)) return;
    setLoadingMenu(true); setError(null);
    try {
      await apiClient.delete(`/menu/sil`, { params: { urun_adi: urunAdiTrimmed } });
      alert("Ürün başarıyla silindi.");
      setSilUrunAdi("");
      await verileriGetir(); // Menü listesini de günceller ve AI prompt'u tetikler
    } catch (err) { handleApiError(err, "Ürün silinemedi", "Menü Ürün Silme"); }
    finally { setLoadingMenu(false); }
  }, [silUrunAdi, menu, verileriGetir, handleApiError, setLoadingMenu, setError]); 

  // YENİ EKLENEN KISIM BAŞLANGICI: Menü Kategorisi Silme Fonksiyonları
  const openDeleteCategoryModal = (kategori) => {
    setCategoryToDelete(kategori);
    setShowDeleteCategoryModal(true);
  };

  const confirmDeleteMenuKategori = useCallback(async () => {
    if (!categoryToDelete) return;
    logInfo(`➖ Menü kategorisi siliniyor: ID ${categoryToDelete.id} - Ad: ${categoryToDelete.isim}`);
    setLoadingMenu(true); setError(null);
    try {
      await apiClient.delete(`/admin/menu/kategoriler/${categoryToDelete.id}`);
      logInfo("🗑️ Menü kategorisi ve bağlı ürünler başarıyla silindi.");
      alert(`'${categoryToDelete.isim}' kategorisi ve bağlı tüm ürünler silindi.`);
      setShowDeleteCategoryModal(false); 
      setCategoryToDelete(null);
      await fetchMenuKategorileri(); // Kategori listesini yenile
      await verileriGetir(); // Ana menüyü ve AI prompt'unu güncellemek için genel verileri de çek
    } catch (err) {
      handleApiError(err, "Menü kategorisi silinemedi", "Menü Kategori Silme");
    } finally {
      setLoadingMenu(false);
    }
  }, [categoryToDelete, fetchMenuKategorileri, verileriGetir, logInfo, handleApiError, setLoadingMenu, setError]);
  // YENİ EKLENEN KISIM SONU

  const handleYeniKullaniciChange = (e) => { /* ... (Mevcut) ... */ };
  const yeniKullaniciEkle = useCallback(async (e) => { /* ... (Mevcut, API hatası için handleApiError kullan) ... */ }, [yeniKullanici, kullanicilariGetir, handleApiError, setLoadingUsers, setError, initialYeniKullaniciState]);

  // YENİ EKLENEN KISIM BAŞLANGICI: Kullanıcı Düzenleme ve Silme Fonksiyonları
  const openEditUserModal = (user) => {
    setEditingUser({ ...user, sifre: "" }); // Şifre alanını modal açılırken boşalt
    setShowEditUserModal(true);
  };

  const handleEditingUserChange = (e) => {
    const { name, value, type, checked } = e.target;
    setEditingUser(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const guncelleKullanici = useCallback(async (e) => {
    e.preventDefault();
    if (!editingUser || !editingUser.id) { alert("Düzenlenecek kullanıcı seçilmedi."); return; }
    if (!editingUser.kullanici_adi.trim() || !editingUser.rol) { alert("Kullanıcı adı ve rol boş bırakılamaz."); return; }
    if (editingUser.sifre && editingUser.sifre.length > 0 && editingUser.sifre.length < 6) { alert("Yeni şifre en az 6 karakter olmalıdır."); return; }

    setLoadingUsers(true); setError(null);
    const dataToUpdate = {
        kullanici_adi: editingUser.kullanici_adi.trim(),
        rol: editingUser.rol,
        aktif_mi: editingUser.aktif_mi,
    };
    if (editingUser.sifre && editingUser.sifre.trim() !== "") {
        dataToUpdate.sifre = editingUser.sifre.trim();
    }

    try {
      await apiClient.put(`/admin/kullanicilar/${editingUser.id}`, dataToUpdate);
      alert("Kullanıcı bilgileri başarıyla güncellendi.");
      setShowEditUserModal(false); 
      setEditingUser(null);
      await kullanicilariGetir(); 
    } catch (err) {
      handleApiError(err, "Kullanıcı güncellenemedi", "Kullanıcı Güncelleme");
    } finally {
      setLoadingUsers(false);
    }
  }, [editingUser, kullanicilariGetir, handleApiError, setLoadingUsers, setError]);

  const openDeleteUserModal = (user) => {
    if (currentUser?.id === user.id) {
        alert("Kendinizi silemezsiniz.");
        return;
    }
    setUserToDelete(user);
    setShowDeleteUserModal(true);
  };

  const confirmDeleteUser = useCallback(async () => {
    if (!userToDelete) return;
    setLoadingUsers(true); setError(null);
    try {
      await apiClient.delete(`/admin/kullanicilar/${userToDelete.id}`);
      alert(`'${userToDelete.kullanici_adi}' kullanıcısı başarıyla silindi.`);
      setShowDeleteUserModal(false); 
      setUserToDelete(null);
      await kullanicilariGetir();
    } catch (err) {
      handleApiError(err, "Kullanıcı silinemedi", "Kullanıcı Silme");
    } finally {
      setLoadingUsers(false);
    }
  }, [userToDelete, kullanicilariGetir, handleApiError, setLoadingUsers, setError]);
  // YENİ EKLENEN KISIM SONU
  
  // YENİ EKLENEN KISIM BAŞLANGICI: Stok Yönetimi CRUD Fonksiyonları
  const openStokKategoriModal = useCallback((kategori = null) => {
    setEditingStokKategori(kategori ? { ...kategori } : initialEditingStokKategori);
    setShowStokKategoriModal(true);
  }, [initialEditingStokKategori]);

  const handleStokKategoriFormSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!editingStokKategori || !editingStokKategori.ad?.trim()) { alert("Stok kategori adı boş bırakılamaz."); return; }
    setLoadingStok(true); setError(null);
    try {
      if (editingStokKategori.id) { // Düzenleme
        await apiClient.put(`/admin/stok/kategoriler/${editingStokKategori.id}`, { ad: editingStokKategori.ad.trim() });
        alert("Stok kategorisi güncellendi.");
      } else { // Ekleme
        await apiClient.post("/admin/stok/kategoriler", { ad: editingStokKategori.ad.trim() });
        alert("Stok kategorisi eklendi.");
      }
      setShowStokKategoriModal(false);
      setEditingStokKategori(null);
      fetchStokKategorileri();
    } catch (err) { handleApiError(err, "Stok kategori işlemi başarısız", "Stok Kategori Kayıt"); }
    finally { setLoadingStok(false); }
  }, [editingStokKategori, fetchStokKategorileri, handleApiError, setLoadingStok, setError]);

  const openStokKategoriSilModal = (kategori) => { setStokKategoriToDelete(kategori); };
  const confirmDeleteStokKategori = useCallback(async () => {
    if (!stokKategoriToDelete) return;
    setLoadingStok(true); setError(null);
    try {
      await apiClient.delete(`/admin/stok/kategoriler/${stokKategoriToDelete.id}`);
      alert(`'${stokKategoriToDelete.ad}' stok kategorisi silindi.`);
      setStokKategoriToDelete(null);
      fetchStokKategorileri();
      fetchStokKalemleri(); // Kategori silinince ilişkili kalemler için filtreyi güncelle
    } catch (err) { handleApiError(err, "Stok kategorisi silinemedi", "Stok Kategori Silme"); }
    finally { setLoadingStok(false); }
  }, [stokKategoriToDelete, fetchStokKategorileri, fetchStokKalemleri, handleApiError, setLoadingStok, setError]);
  
  const openStokKalemiModal = useCallback((kalem = null) => { 
    setEditingStokKalemi(kalem ? {...kalem, son_alis_fiyati: kalem.son_alis_fiyati ?? ""} : initialEditingStokKalemi); 
    setShowStokKalemiModal(true); 
  }, [initialEditingStokKalemi]);

  const handleStokKalemiFormChange = (e) => { 
    const { name, value } = e.target; 
    setEditingStokKalemi(prev => ({ ...prev, [name]: value })); 
  };

  const handleStokKalemiFormSubmit = useCallback(async (e) => {
    e.preventDefault();
    const { ad, stok_kategori_id, birim, mevcut_miktar, min_stok_seviyesi, son_alis_fiyati } = editingStokKalemi;
    if (!ad?.trim() || !stok_kategori_id || !birim?.trim()) { alert("Kalem adı, stok kategorisi ve birim zorunludur."); return; }
    
    setLoadingStok(true); setError(null);
    const payload = {
      ad: ad.trim(),
      stok_kategori_id: parseInt(stok_kategori_id, 10),
      birim: birim.trim(),
      min_stok_seviyesi: parseFloat(min_stok_seviyesi) || 0,
    };
    // Sadece yeni kalem ekleniyorsa mevcut miktar ve alış fiyatı gönderilir.
    // Düzenlemede bu alanlar ayrı işlemlerle (fatura girişi, stok sayımı) güncellenir.
    if (!editingStokKalemi.id) { 
        payload.mevcut_miktar = parseFloat(mevcut_miktar) || 0;
        payload.son_alis_fiyati = son_alis_fiyati && son_alis_fiyati !== "" ? parseFloat(son_alis_fiyati) : null;
    }

    try {
      if (editingStokKalemi.id) {
        await apiClient.put(`/admin/stok/kalemler/${editingStokKalemi.id}`, payload);
        alert("Stok kalemi güncellendi.");
      } else {
        await apiClient.post("/admin/stok/kalemler", payload);
        alert("Stok kalemi eklendi.");
      }
      setShowStokKalemiModal(false); 
      setEditingStokKalemi(null);
      fetchStokKalemleri(selectedStokKategoriFilter || null);
    } catch (err) { handleApiError(err, "Stok kalemi işlemi başarısız", "Stok Kalemi Kayıt"); }
    finally { setLoadingStok(false); }
  }, [editingStokKalemi, fetchStokKalemleri, selectedStokKategoriFilter, handleApiError, setLoadingStok, setError]);
  
  const openStokKalemiSilModal = (kalem) => { setStokKalemiToDelete(kalem); };
  const confirmDeleteStokKalemi = useCallback(async () => {
    if (!stokKalemiToDelete) return;
    setLoadingStok(true); setError(null);
    try {
      await apiClient.delete(`/admin/stok/kalemler/${stokKalemiToDelete.id}`);
      alert(`'${stokKalemiToDelete.ad}' stok kalemi silindi.`);
      setStokKalemiToDelete(null); 
      fetchStokKalemleri(selectedStokKategoriFilter || null);
    } catch (err) { handleApiError(err, "Stok kalemi silinemedi", "Stok Kalemi Silme"); }
    finally { setLoadingStok(false); }
  }, [stokKalemiToDelete, fetchStokKalemleri, selectedStokKategoriFilter, handleApiError, setLoadingStok, setError]);

  useEffect(() => { 
    if(isAuthenticated && userRole === 'admin' && !loadingAuth) {
        fetchStokKalemleri(selectedStokKategoriFilter || null); 
    }
  }, [selectedStokKategoriFilter, isAuthenticated, userRole, loadingAuth, fetchStokKalemleri]);
  // YENİ EKLENEN KISIM SONU

  const filtrelenmisSiparisler = orders.filter((o) => { /* ... (Mevcut sipariş filtreleme - önceki gibi) ... */ return true; });

  if (loadingAuth) { 
    return 
  }

  return (
    <div className="p-4 md:p-6 bg-gradient-to-br from-slate-100 via-gray-100 to-slate-200 min-h-screen text-slate-800 font-['Nunito',_sans-serif] relative">
      {/* DEĞİŞTİRİLEN KISIM: Hata mesajı ve Tekrar Dene butonu güncellendi */}
      {error && (
        <div className="sticky top-4 left-1/2 -translate-x-1/2 max-w-2xl w-auto z-[1000] bg-red-100 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded-md mb-6 shadow-lg flex justify-between items-center" role="alert">
          <div>
            <strong className="font-bold">Hata: </strong>
            <span className="block sm:inline text-sm">{error}</span>
          </div>
          <button 
            onClick={() => { setError(null); refreshAllAdminData(); }}
            className="ml-4 px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-semibold transition-colors flex items-center gap-1"
            disabled={loadingDashboard || loadingUsers || loadingMenu || loadingStok}
            title="Verileri Yeniden Yükle"
          >
            <RotateCw size={14} className={`${(loadingDashboard || loadingUsers || loadingMenu || loadingStok) ? 'animate-spin' : ''}`}/>
            Tekrar Dene
          </button>
        </div>
      )}
      {/* DEĞİŞTİRİLEN KISIM SONU */}

      {/* DEĞİŞTİRİLEN KISIM: Genel yükleme göstergesi güncellendi */}
      {(loadingDashboard || loadingUsers || loadingMenu || loadingStok) && (
        <div className="fixed inset-0 bg-slate-700/30 backdrop-blur-sm flex flex-col items-center justify-center z-[9999]">
          <RotateCw className="w-10 h-10 text-blue-500 animate-spin mb-2" />
          <p className="text-white/90 text-sm font-medium">Veriler Yükleniyor...</p>
        </div>
      )}
      {/* DEĞİŞTİRİLEN KISIM SONU */}


      <header className="flex flex-wrap justify-between items-center mb-6 md:mb-8 gap-4 pb-4 border-b border-slate-300">
        <h1 className="text-3xl md:text-4xl font-bold text-slate-800 flex items-center gap-3">
          <Settings className="w-8 h-8 text-blue-600" /> Admin Paneli
          {currentUser && <span className="text-lg font-normal text-slate-500">({currentUser.kullanici_adi})</span>}
        </h1>
        <button
          onClick={logout} 
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg shadow-md flex items-center gap-2 transition duration-200 ease-in-out active:scale-95"
        >
          <LogOut className="w-4 h-4" /> Çıkış Yap
        </button>
      </header>

      {/* İstatistik Kartları */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6 md:mb-8">
        {/* DEĞİŞTİRİLEN KISIM BAŞLANGICI: Günlük Ürün Adedi Kartı */}
        <div className="bg-white p-4 sm:p-5 rounded-xl shadow-lg border-t-4 border-blue-500 hover:shadow-xl transition-shadow">
          <h3 className="text-xs sm:text-sm font-semibold mb-1 flex items-center gap-2 text-slate-500">
            <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" /> Günlük Ürün Adedi
          </h3>
          <CountUp end={gunluk?.satilan_urun_adedi || 0} separator="." className="text-2xl sm:text-3xl font-bold text-blue-600 block"/>
        </div>
        {/* DEĞİŞTİRİLEN KISIM SONU */}

        {/* DEĞİŞTİRİLEN KISIM BAŞLANGICI: Günlük Gelir Kartı (Detay Gösterme Eklendi) */}
        <div 
          className="bg-white p-4 sm:p-5 rounded-xl shadow-lg border-t-4 border-green-500 hover:shadow-xl transition-shadow relative group"
          onMouseEnter={() => setDailyIncomeDetailsVisible(true)}
          onMouseLeave={() => setDailyIncomeDetailsVisible(false)}
          onTouchStart={(e) => { e.stopPropagation(); setDailyIncomeDetailsVisible(prev => !prev);}} // Mobil için toggle ve event bubbling'i engelle
        >
          <h3 className="text-xs sm:text-sm font-semibold mb-1 flex items-center justify-between text-slate-500">
            <span><DollarSign className="w-4 h-4 sm:w-5 sm:h-5 inline-block mr-1.5 text-green-500" /> Günlük Gelir</span>
            <ChevronDown size={16} className={`text-slate-400 transition-transform duration-200 ${dailyIncomeDetailsVisible ? 'rotate-180' : ''}`}/>
          </h3>
          <CountUp end={gunluk?.toplam_gelir || 0} separator="." decimal="," decimals={2} prefix="₺" className="text-2xl sm:text-3xl font-bold text-green-600 block"/>
          <div className={`absolute left-0 top-full mt-1 w-full bg-white border border-slate-200 shadow-xl p-2.5 rounded-md z-20 text-xs text-slate-600 space-y-1 transition-all duration-300 ease-out origin-top
                           ${dailyIncomeDetailsVisible ? 'opacity-100 transform scale-y-100 visible' : 'opacity-0 transform scale-y-95 invisible pointer-events-none'}`}>
            <p>Nakit: <span className="font-semibold text-green-700">₺{(gunluk?.nakit_gelir || 0).toFixed(2)}</span></p>
            <p>K. Kartı: <span className="font-semibold text-blue-700">₺{(gunluk?.kredi_karti_gelir || 0).toFixed(2)}</span></p>
            {gunluk?.diger_odeme_yontemleri_gelir > 0 && <p>Diğer: <span className="font-semibold">₺{(gunluk?.diger_odeme_yontemleri_gelir || 0).toFixed(2)}</span></p>}
          </div>
        </div>
        {/* DEĞİŞTİRİLEN KISIM SONU */}

        {/* DEĞİŞTİRİLEN KISIM BAŞLANGICI: Aktif Masa Sayısı Kartı */}
        <div className="bg-white p-4 sm:p-5 rounded-xl shadow-lg border-t-4 border-purple-500 hover:shadow-xl transition-shadow">
          <h3 className="text-xs sm:text-sm font-semibold mb-1 flex items-center gap-2 text-slate-500">
            <UserCheck className="w-4 h-4 sm:w-5 sm:h-5 text-purple-500" /> Aktif Masa Sayısı
          </h3>
          <CountUp end={aktifMasaOzetleri?.length || 0} separator="." className="text-2xl sm:text-3xl font-bold text-purple-600 block"/>
        </div>
        {/* DEĞİŞTİRİLEN KISIM SONU */}
        
        {/* DEĞİŞTİRİLEN KISIM BAŞLANGICI: En Popüler Ürün Kartı */}
        <div className="bg-white p-4 sm:p-5 rounded-xl shadow-lg border-t-4 border-orange-500 hover:shadow-xl transition-shadow">
          <h3 className="text-xs sm:text-sm font-semibold mb-1 flex items-center gap-2 text-slate-500">
            <Coffee className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500" /> En Popüler Ürün
          </h3>
          {populer?.[0] ? (
            <p className="text-base sm:text-lg font-bold text-orange-600 truncate" title={populer[0].urun}>
              {populer[0].urun}{" "}
              <span className="text-xs sm:text-sm font-normal text-slate-500 ml-1">({populer[0].adet || 0} adet)</span>
            </p>
          ) : ( <p className="text-slate-400 text-xs sm:text-sm">{loadingDashboard ? "Yükleniyor..." : "Veri yok"}</p> )}
        </div>
        {/* DEĞİŞTİRİLEN KISIM SONU */}
      </section>

      {/* ... (Aktif Masalar Tablosu ve Grafikler - Mevcut halleriyle kalabilir, gerekirse stil güncellemeleri yapılır) ... */}

      {/* Menü Yönetimi (Ürünler ve Kategoriler) */}
      <section className="bg-white p-5 sm:p-6 rounded-xl shadow-lg mb-6 md:mb-8">
        <h3 className="text-xl font-semibold mb-6 text-slate-700 flex items-center gap-3">
          <MenuSquare className="w-6 h-6 text-teal-600" /> Menü Yönetimi
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Menü Ürün Ekle/Sil Formları (Sol Sütun) */}
          <div className="md:col-span-4 space-y-6">
             {/* ... (Mevcut Ürün Ekle Formu) ... */}
             {/* ... (Mevcut Ürün Sil Formu) ... */}
          </div>

          {/* Mevcut Menü Listesi (Orta Sütun) */}
          <div className="md:col-span-5">
            {/* ... (Mevcut Menü Listesi JSX'i) ... */}
          </div>

          {/* YENİ EKLENEN KISIM BAŞLANGICI: Menü Kategori Yönetimi (Sağ Sütun) */}
          <div className="md:col-span-3 space-y-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
            <h4 className="text-sm font-medium text-slate-600 flex items-center gap-1.5">
              <ClipboardList size={16} className="text-cyan-600"/>Menü Kategorileri
            </h4>
            {loadingMenu && menuKategorileri.length === 0 && <p className="text-xs text-slate-400 py-1">Kategoriler yükleniyor...</p>}
            {!loadingMenu && menuKategorileri.length === 0 && <p className="text-xs text-slate-500 py-1">Mevcut menü kategorisi bulunmuyor.</p>}
            {menuKategorileri.length > 0 && (
              <ul className="space-y-1.5 max-h-72 overflow-y-auto pr-1 text-xs">
                {menuKategorileri.map(kat => (
                  <li key={kat.id} className="flex justify-between items-center p-1.5 bg-white rounded border border-slate-300 hover:bg-slate-100 transition-colors">
                    <span className="text-slate-700 font-medium truncate pr-1" title={kat.isim}>{kat.isim}</span>
                    <button 
                      onClick={() => openDeleteCategoryModal(kat)} 
                      disabled={loadingMenu} 
                      className="text-red-500 hover:text-red-700 p-0.5 rounded hover:bg-red-100 disabled:opacity-50 flex-shrink-0" 
                      title={`${kat.isim} kategorisini ve içindeki tüm ürünleri sil`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {/* YENİ EKLENEN KISIM SONU */}
        </div>
      </section>
      
      {/* YENİ EKLENEN KISIM BAŞLANGICI: Stok Yönetimi */}
      <section className="bg-white p-5 sm:p-6 rounded-xl shadow-lg mb-6 md:mb-8">
        <h3 className="text-xl font-semibold mb-6 text-slate-700 flex items-center gap-3">
          <ClipboardEdit size={22} className="text-lime-600" /> Stok Yönetimi
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Stok Kategorileri Sütunu */}
          <div className="md:col-span-1 p-4 border border-lime-200/70 rounded-lg bg-lime-50/40">
            <div className="flex justify-between items-center mb-3 pb-2 border-b border-lime-200">
              <h4 className="text-base font-medium text-lime-700 flex items-center gap-2"><Archive size={18}/>Stok Kategorileri</h4>
              <button 
                onClick={() => openStokKategoriModal()} 
                className="bg-lime-600 hover:bg-lime-700 text-white px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1 shadow-sm hover:shadow-md transition-all"
              >
                <PlusCircle size={14}/>Ekle
              </button>
            </div>
            {loadingStok && stokKategorileri.length === 0 && <p className="text-xs text-lime-600 py-2">Stok kategorileri yükleniyor...</p>}
            {!loadingStok && stokKategorileri.length === 0 && <p className="text-xs text-slate-500 py-2">Stok kategorisi bulunmuyor.</p>}
            <ul className="space-y-1.5 max-h-80 overflow-y-auto text-sm pr-1">
              {stokKategorileri.map(kat => (
                <li key={kat.id} className="flex justify-between items-center p-1.5 bg-white rounded border border-lime-300/80 hover:shadow-sm transition-shadow">
                  <span className="text-lime-800 truncate pr-1" title={kat.ad}>{kat.ad}</span>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button onClick={() => openStokKategoriModal(kat)} className="text-blue-600 p-0.5 rounded hover:bg-blue-100" title="Düzenle"><Edit3 size={15}/></button>
                    <button onClick={() => openStokKategoriSilModal(kat)} disabled={loadingStok} className="text-red-600 p-0.5 rounded hover:bg-red-100 disabled:opacity-50" title="Sil"><Trash2 size={15}/></button>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Stok Kalemleri Sütunu */}
          <div className="md:col-span-2 p-4 border border-lime-200/70 rounded-lg">
            <div className="flex flex-wrap justify-between items-center mb-3 pb-2 border-b border-lime-200 gap-2">
              <h4 className="text-base font-medium text-lime-700 flex items-center gap-2"><Boxes size={18}/>Stok Kalemleri</h4>
              <button 
                onClick={() => openStokKalemiModal()} 
                disabled={stokKategorileri.length === 0 || loadingStok} 
                title={stokKategorileri.length === 0 ? "Önce stok kategorisi ekleyin" : "Yeni Stok Kalemi"}
                className="bg-lime-600 hover:bg-lime-700 text-white px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1 shadow-sm hover:shadow-md transition-all disabled:bg-slate-400"
              >
                <PlusCircle size={14}/>Yeni Kalem
              </button>
            </div>
            <div className="mb-3">
              <select 
                value={selectedStokKategoriFilter} 
                onChange={(e) => setSelectedStokKategoriFilter(e.target.value)}
                className="p-1.5 border border-slate-300 rounded-md text-xs focus:ring-1 focus:ring-lime-500 focus:border-lime-500 w-full sm:w-auto shadow-sm"
                disabled={loadingStok}
              >
                <option value="">Tüm Stok Kategorileri</option>
                {stokKategorileri.map(kat => <option key={kat.id} value={kat.id}>{kat.ad}</option>)}
              </select>
            </div>
            {loadingStok && stokKalemleri.length === 0 && <p className="text-xs text-lime-600 py-2">Stok kalemleri yükleniyor...</p>}
            {!loadingStok && stokKalemleri.length === 0 && <p className="text-xs text-slate-500 py-2">Bu filtreye uygun stok kalemi yok veya hiç stok kalemi eklenmemiş.</p>}
            {stokKalemleri.length > 0 && (
              <div className="overflow-x-auto max-h-80 text-xs">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-lime-100 sticky top-0 z-10">
                    <tr>
                      <th className="px-2 sm:px-3 py-2 text-left font-medium text-lime-800 tracking-wider">Ad</th>
                      <th className="px-2 sm:px-3 py-2 text-left font-medium text-lime-800 tracking-wider">Kategori</th>
                      <th className="px-2 sm:px-3 py-2 text-left font-medium text-lime-800 tracking-wider">Birim</th>
                      <th className="px-2 sm:px-3 py-2 text-right font-medium text-lime-800 tracking-wider">Mevcut</th>
                      <th className="px-2 sm:px-3 py-2 text-right font-medium text-lime-800 tracking-wider">Min.</th>
                      <th className="px-2 sm:px-3 py-2 text-right font-medium text-lime-800 tracking-wider">Alış F.</th>
                      <th className="px-2 sm:px-3 py-2 text-center font-medium text-lime-800 tracking-wider">İşlem</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-100">
                    {stokKalemleri.map(item => {
                      const isLowStock = item.mevcut_miktar < item.min_stok_seviyesi && item.min_stok_seviyesi > 0;
                      return (
                        <tr key={item.id} className={`hover:bg-lime-50/60 transition-colors ${isLowStock ? 'bg-red-50 hover:bg-red-100' : ''}`}>
                            <td className={`px-2 sm:px-3 py-1.5 whitespace-nowrap font-medium ${isLowStock ? 'text-red-700' : 'text-slate-800'}`} title={item.ad}>{item.ad}</td>
                            <td className="px-2 sm:px-3 py-1.5 whitespace-nowrap text-slate-600" title={item.stok_kategori_ad}>{item.stok_kategori_ad || 'Bilinmiyor'}</td>
                            <td className="px-2 sm:px-3 py-1.5 whitespace-nowrap text-slate-600">{item.birim}</td>
                            <td className={`px-2 sm:px-3 py-1.5 whitespace-nowrap text-right font-semibold ${isLowStock ? 'text-red-600' : 'text-slate-700'}`}>{item.mevcut_miktar}</td>
                            <td className="px-2 sm:px-3 py-1.5 whitespace-nowrap text-right text-slate-500">{item.min_stok_seviyesi}</td>
                            <td className="px-2 sm:px-3 py-1.5 whitespace-nowrap text-right text-slate-500">{item.son_alis_fiyati ? `₺${Number(item.son_alis_fiyati).toFixed(2)}` : '-'}</td>
                            <td className="px-2 sm:px-3 py-1.5 whitespace-nowrap text-center">
                                <button onClick={() => openStokKalemiModal(item)} className="text-blue-600 p-0.5 rounded hover:bg-blue-100 mr-1" title="Düzenle"><Edit3 size={14}/></button>
                                <button onClick={() => openStokKalemiSilModal(item)} disabled={loadingStok} className="text-red-600 p-0.5 rounded hover:bg-red-100 disabled:opacity-50" title="Sil"><Trash2 size={14}/></button>
                            </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </section>
      {/* YENİ EKLENEN KISIM SONU */}

      {/* Kullanıcı Yönetimi */}
      <section className="bg-white p-5 sm:p-6 rounded-xl shadow-lg mb-6 md:mb-8">
        <div className="flex flex-wrap justify-between items-center mb-4 gap-2">
          <h3 className="text-lg sm:text-xl font-semibold text-slate-700 flex items-center gap-2 sm:gap-3">
            <Users className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600" /> Kullanıcı Yönetimi
          </h3>
          <button 
            onClick={() => { setEditingUser(null); setShowAddUserForm(prev => !prev); if(showAddUserForm) setYeniKullanici(initialYeniKullaniciState); }}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold transition shadow-sm active:scale-95 flex items-center gap-1.5 sm:gap-2 ${
                showAddUserForm ? "bg-orange-500 hover:bg-orange-600 text-white" : "bg-indigo-600 hover:bg-indigo-700 text-white"
            }`}
          >
            {showAddUserForm ? <><X size={16}/> Formu Kapat</> : <><UserPlus size={16}/> Yeni Kullanıcı</>}
          </button>
        </div>
        {showAddUserForm && ( <form onSubmit={yeniKullaniciEkle} className="mb-6 p-4 border border-slate-200 rounded-lg bg-slate-50/70 space-y-3 text-sm"> {/* ... (Yeni Kullanıcı Formu - önceki gibi) ... */} </form> )}
        
        <h4 className="text-base font-medium text-slate-600 mb-3 mt-4">Mevcut Kullanıcılar</h4>
        {loadingUsers && kullanicilar.length === 0 && <p className="text-sm text-slate-500 py-2">Kullanıcılar yükleniyor...</p>}
        {!loadingUsers && kullanicilar.length === 0 && <p className="text-sm text-slate-500 py-2">Kayıtlı kullanıcı yok.</p>}
        {kullanicilar.length > 0 && (
            <div className="overflow-x-auto text-sm">
                <table className="min-w-full divide-y divide-slate-200 border border-slate-200 rounded-md">
                    <thead className="bg-indigo-50">
                        <tr>
                            <th className="px-3 py-2.5 text-left text-xs font-medium text-indigo-700 uppercase tracking-wider">ID</th>
                            <th className="px-3 py-2.5 text-left text-xs font-medium text-indigo-700 uppercase tracking-wider">Kullanıcı Adı</th>
                            <th className="px-3 py-2.5 text-left text-xs font-medium text-indigo-700 uppercase tracking-wider">Rol</th>
                            <th className="px-3 py-2.5 text-left text-xs font-medium text-indigo-700 uppercase tracking-wider">Durum</th>
                            <th className="px-3 py-2.5 text-center text-xs font-medium text-indigo-700 uppercase tracking-wider">İşlemler</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-100">
                        {kullanicilar.map(k => (
                            <tr key={k.id} className="hover:bg-indigo-50/40 transition-colors">
                                <td className="px-3 py-2 whitespace-nowrap text-slate-600">{k.id}</td>
                                <td className="px-3 py-2 whitespace-nowrap font-medium text-slate-800">{k.kullanici_adi}</td>
                                <td className="px-3 py-2 whitespace-nowrap text-slate-600">{k.rol.charAt(0).toUpperCase() + k.rol.slice(1).replace("_personeli", " P.")}</td>
                                <td className="px-3 py-2 whitespace-nowrap">
                                    <span className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${ k.aktif_mi ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                        {k.aktif_mi ? 'Aktif' : 'Pasif'}
                                    </span>
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap text-center">
                                    <button onClick={() => openEditUserModal(k)} className="text-blue-600 p-0.5 rounded hover:bg-blue-100 mr-1.5" title="Düzenle"><Edit3 size={15}/></button>
                                    <button onClick={() => openDeleteUserModal(k)} disabled={currentUser?.id === k.id || loadingUsers} className={`text-red-600 p-0.5 rounded hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed ${currentUser?.id === k.id ? 'opacity-40 cursor-not-allowed' : ''}`} title={currentUser?.id === k.id ? "Kendinizi silemezsiniz" : "Sil"}><Trash2 size={15}/></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )}
      </section>

      {/* ... (Sipariş Geçmişi ve Sistem Bilgisi bölümleri mevcut halleriyle kalacak) ... */}

      {/* Modallar */}
      <Modal isOpen={showEditUserModal} onClose={() => {setShowEditUserModal(false); setEditingUser(null);}} title="Kullanıcı Bilgilerini Düzenle">
          {editingUser && ( <form onSubmit={guncelleKullanici} className="space-y-3 text-sm"> {/* ... (Kullanıcı Düzenleme Form İçeriği - önceki gibi) ... */} </form> )}
      </Modal>
      <Modal isOpen={showDeleteUserModal} onClose={() => {setShowDeleteUserModal(false); setUserToDelete(null);}} title="Kullanıcı Silme Onayı">
          {userToDelete && ( <div className="text-sm"> {/* ... (Kullanıcı Silme Onay İçeriği - önceki gibi) ... */} </div> )}
      </Modal>
      <Modal isOpen={showDeleteCategoryModal} onClose={() => {setShowDeleteCategoryModal(false); setCategoryToDelete(null);}} title="Menü Kategorisi Silme Onayı">
          {categoryToDelete && ( <div className="text-sm"> {/* ... (Menü Kategori Silme Onay İçeriği - önceki gibi) ... */} </div> )}
      </Modal>
      
      <Modal isOpen={showStokKategoriModal} onClose={() => {setShowStokKategoriModal(false); setEditingStokKategori(null);}} title={editingStokKategori?.id ? "Stok Kategorisi Düzenle" : "Yeni Stok Kategorisi Ekle"}>
          {editingStokKategori && ( 
            <form onSubmit={handleStokKategoriFormSubmit} className="space-y-3 text-sm">
                <div>
                    <label htmlFor="stok_kat_ad" className="block text-xs font-medium text-slate-700 mb-0.5">Kategori Adı</label>
                    <input type="text" id="stok_kat_ad" placeholder="Kategori Adı" value={editingStokKategori.ad} 
                           onChange={(e) => setEditingStokKategori({...editingStokKategori, ad: e.target.value})}
                           className="w-full p-2 border border-slate-300 rounded-md focus:ring-1 focus:ring-lime-500 focus:border-lime-500" required />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                    <button type="button" onClick={() => {setShowStokKategoriModal(false); setEditingStokKategori(null);}} className="px-3 py-1.5 text-xs bg-slate-200 hover:bg-slate-300 rounded-md font-medium">İptal</button>
                    <button type="submit" disabled={loadingStok} className="px-3 py-1.5 text-xs bg-lime-600 hover:bg-lime-700 text-white rounded-md font-medium disabled:bg-slate-400 flex items-center gap-1">
                        {loadingStok && <RotateCw size={14} className="animate-spin"/>}
                        {editingStokKategori.id ? "Güncelle" : "Ekle"}
                    </button>
                </div>
            </form>
        )}
      </Modal>
      <Modal isOpen={!!stokKategoriToDelete} onClose={() => setStokKategoriToDelete(null)} title="Stok Kategorisi Silme Onayı">
          {stokKategoriToDelete && ( 
            <div className="text-sm">
                 <p className="text-slate-600 mb-3">'{stokKategoriToDelete.ad}' stok kategorisini silmek istediğinizden emin misiniz? <strong className="text-red-600">Bu kategoriye bağlı stok kalemleri varsa bu işlem başarısız olabilir.</strong></p>
                <div className="flex justify-end gap-2">
                    <button onClick={() => setStokKategoriToDelete(null)} className="px-3 py-1.5 text-xs bg-slate-200 hover:bg-slate-300 rounded-md font-medium">Vazgeç</button>
                    <button onClick={confirmDeleteStokKategori} disabled={loadingStok} className="px-3 py-1.5 text-xs bg-red-600 hover:bg-red-700 text-white rounded-md font-medium disabled:bg-slate-400 flex items-center gap-1">
                         {loadingStok && <RotateCw size={14} className="animate-spin"/>}
                        Evet, Sil
                    </button>
                </div>
            </div> 
        )}
      </Modal>

      <Modal isOpen={showStokKalemiModal} onClose={() => {setShowStokKalemiModal(false); setEditingStokKalemi(null);}} title={editingStokKalemi?.id ? "Stok Kalemi Düzenle" : "Yeni Stok Kalemi Ekle"} size="max-w-xl">
          {editingStokKalemi && ( 
            <form onSubmit={handleStokKalemiFormSubmit} className="space-y-3 text-sm">
                <div>
                    <label htmlFor="stok_kalem_ad" className="block text-xs font-medium text-slate-700 mb-0.5">Kalem Adı</label>
                    <input type="text" name="ad" id="stok_kalem_ad" placeholder="Kalem Adı" value={editingStokKalemi.ad || ""} onChange={handleStokKalemiFormChange} className="w-full p-2 border border-slate-300 rounded-md" required />
                </div>
                <div>
                    <label htmlFor="stok_kalem_kat" className="block text-xs font-medium text-slate-700 mb-0.5">Kategori</label>
                    <select name="stok_kategori_id" id="stok_kalem_kat" value={editingStokKalemi.stok_kategori_id || ""} onChange={handleStokKalemiFormChange} className="w-full p-2 border border-slate-300 rounded-md bg-white" required>
                        <option value="">Kategori Seçin...</option>
                        {stokKategorileri.map(kat => <option key={kat.id} value={kat.id}>{kat.ad}</option>)}
                    </select>
                </div>
                <div>
                    <label htmlFor="stok_kalem_birim" className="block text-xs font-medium text-slate-700 mb-0.5">Birim</label>
                    <input type="text" name="birim" id="stok_kalem_birim" placeholder="Birim (örn: kg, lt, adet)" value={editingStokKalemi.birim || ""} onChange={handleStokKalemiFormChange} className="w-full p-2 border border-slate-300 rounded-md" required />
                </div>
                {!editingStokKalemi.id && ( // Sadece yeni eklerken gösterilir
                    <>
                        <div>
                            <label htmlFor="stok_kalem_mevcut" className="block text-xs font-medium text-slate-700 mb-0.5">Mevcut Miktar</label>
                            <input type="number" name="mevcut_miktar" id="stok_kalem_mevcut" placeholder="Mevcut Miktar" value={editingStokKalemi.mevcut_miktar || 0} onChange={handleStokKalemiFormChange} className="w-full p-2 border border-slate-300 rounded-md" step="any" min="0" />
                        </div>
                        <div>
                            <label htmlFor="stok_kalem_alis" className="block text-xs font-medium text-slate-700 mb-0.5">Son Alış Fiyatı (₺)</label>
                            <input type="number" name="son_alis_fiyati" id="stok_kalem_alis" placeholder="Son Alış Fiyatı" value={editingStokKalemi.son_alis_fiyati || ""} onChange={handleStokKalemiFormChange} className="w-full p-2 border border-slate-300 rounded-md" step="any" min="0" />
                        </div>
                    </>
                )}
                 <div>
                    <label htmlFor="stok_kalem_min" className="block text-xs font-medium text-slate-700 mb-0.5">Minimum Stok Seviyesi</label>
                    <input type="number" name="min_stok_seviyesi" id="stok_kalem_min" placeholder="Minimum Stok Seviyesi" value={editingStokKalemi.min_stok_seviyesi || 0} onChange={handleStokKalemiFormChange} className="w-full p-2 border border-slate-300 rounded-md" step="any" min="0" />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                    <button type="button" onClick={() => {setShowStokKalemiModal(false); setEditingStokKalemi(null);}} className="px-3 py-1.5 text-xs bg-slate-200 hover:bg-slate-300 rounded-md font-medium">İptal</button>
                    <button type="submit" disabled={loadingStok} className="px-3 py-1.5 text-xs bg-lime-600 hover:bg-lime-700 text-white rounded-md font-medium disabled:bg-slate-400 flex items-center gap-1">
                        {loadingStok && <RotateCw size={14} className="animate-spin"/>}
                        {editingStokKalemi.id ? "Güncelle" : "Ekle"}
                    </button>
                </div>
            </form> 
        )}
      </Modal>
       <Modal isOpen={!!stokKalemiToDelete} onClose={() => setStokKalemiToDelete(null)} title="Stok Kalemi Silme Onayı">
          {stokKalemiToDelete && ( 
            <div className="text-sm">
                <p className="text-slate-600 mb-3">'{stokKalemiToDelete.ad}' stok kalemini silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.</p>
                <div className="flex justify-end gap-2">
                    <button onClick={() => setStokKalemiToDelete(null)} className="px-3 py-1.5 text-xs bg-slate-200 hover:bg-slate-300 rounded-md font-medium">Vazgeç</button>
                    <button onClick={confirmDeleteStokKalemi} disabled={loadingStok} className="px-3 py-1.5 text-xs bg-red-600 hover:bg-red-700 text-white rounded-md font-medium disabled:bg-slate-400 flex items-center gap-1">
                        {loadingStok && <RotateCw size={14} className="animate-spin"/>}
                        Evet, Sil
                    </button>
                </div>
            </div>
        )}
      </Modal>
    </div>
  );
}

export default AdminPaneli;