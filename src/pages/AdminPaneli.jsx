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
  Edit3,
  X,
  Archive,
  Boxes,
  ClipboardEdit,
  ChevronDown,
  ChevronUp,
  ShoppingBag,
  ClipboardList,
  ListPlus,
  FilePlus,
  BookOpenText, // YENİ EKLENEN İKON (Reçete için)
  ListOrdered, // YENİ EKLENEN İKON (Reçete için)
  ClipboardPlus, // YENİ EKLENEN İKON (Reçete için)
} from "lucide-react";
import apiClient from '../services/apiClient';
import { AuthContext } from '../AuthContext';
import { useNavigate } from 'react-router-dom';

const KULLANICI_ROLLER = ["admin", "kasiyer", "barista", "mutfak_personeli"];

// Genel Modal Bileşeni
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
        onClick={onClose}
    >
      <div
        className={`bg-white p-5 sm:p-6 rounded-xl shadow-2xl ${size} w-full m-4 transform transition-all duration-300 ease-out`}
        onClick={(e) => e.stopPropagation()}
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

function AdminPaneli() {
  const { isAuthenticated, currentUser, userRole, loadingAuth, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  // Genel State'ler
  const [error, setError] = useState(null);
  const wsRef = useRef(null);

  // Dashboard State'leri
  const [orders, setOrders] = useState([]);
  const [arama, setArama] = useState("");
  const [gunluk, setGunluk] = useState({
    siparis_sayisi: 0,
    toplam_gelir: 0,
    satilan_urun_adedi: 0,
    nakit_gelir: 0,
    kredi_karti_gelir: 0,
    diger_odeme_yontemleri_gelir: 0,
  });
  const [aylik, setAylik] = useState({ siparis_sayisi: 0, toplam_gelir: 0, satilan_urun_adedi: 0 });
  const [yillikChartData, setYillikChartData] = useState([]);
  const [populer, setPopuler] = useState([]);
  const [aktifMasaOzetleri, setAktifMasaOzetleri] = useState([]);
  const [dailyIncomeDetailsVisible, setDailyIncomeDetailsVisible] = useState(false);

  // Menü Yönetimi State'leri
  const [menu, setMenu] = useState([]);
  const initialYeniUrunState = { ad: "", fiyat: "", kategori: "" };
  const [yeniUrun, setYeniUrun] = useState(initialYeniUrunState);
  const [silUrunAdi, setSilUrunAdi] = useState("");
  const [menuKategorileri, setMenuKategorileri] = useState([]);
  const [showDeleteCategoryModal, setShowDeleteCategoryModal] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState(null);
  const [showAddMenuItemModal, setShowAddMenuItemModal] = useState(false);

  // Kullanıcı Yönetimi State'leri
  const [kullanicilar, setKullanicilar] = useState([]);
  const initialYeniKullaniciState = { kullanici_adi: "", sifre: "", rol: KULLANICI_ROLLER[1], aktif_mi: true };
  const [yeniKullanici, setYeniKullanici] = useState(initialYeniKullaniciState);
  const [showAddUserForm, setShowAddUserForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [showDeleteUserModal, setShowDeleteUserModal] = useState(false);

  // Stok Yönetimi State'leri
  const [stokKategorileri, setStokKategorileri] = useState([]);
  const [showStokKategoriModal, setShowStokKategoriModal] = useState(false);
  const initialEditingStokKategori = { ad: "" };
  const [editingStokKategori, setEditingStokKategori] = useState(initialEditingStokKategori);
  const [stokKategoriToDelete, setStokKategoriToDelete] = useState(null);

  const [stokKalemleri, setStokKalemleri] = useState([]);
  const [showStokKalemiModal, setShowStokKalemiModal] = useState(false);
  const initialEditingStokKalemi = { id: null, ad: "", stok_kategori_id: "", birim: "", mevcut_miktar: 0, min_stok_seviyesi: 0, son_alis_fiyati: "" };
  const [editingStokKalemi, setEditingStokKalemi] = useState(initialEditingStokKalemi);
  const [stokKalemiToDelete, setStokKalemiToDelete] = useState(null);
  const [selectedStokKategoriFilter, setSelectedStokKategoriFilter] = useState("");

  // YENİ EKLENEN: Reçete Yönetimi State'leri
  const [menuUrunReceteleri, setMenuUrunReceteleri] = useState([]);
  const [menuItemsForRecipe, setMenuItemsForRecipe] = useState([]);
  const [stockItemsForRecipe, setStockItemsForRecipe] = useState([]);
  const [showRecipeModal, setShowRecipeModal] = useState(false);
  const initialEditingRecipeState = {
    id: null,
    menu_urun_id: "",
    aciklama: "",
    porsiyon_birimi: "adet",
    porsiyon_miktari: 1,
    bilesenler: [], // [{ stok_kalemi_id: "", miktar: "", birim: "" }, ...]
  };
  const [editingRecipe, setEditingRecipe] = useState(initialEditingRecipeState);
  const [recipeToDelete, setRecipeToDelete] = useState(null);
  const [loadingRecipes, setLoadingRecipes] = useState(false);
  // YENİ EKLENEN KISIM SONU

  // Yükleme Durumları
  const [loadingDashboardStats, setLoadingDashboardStats] = useState(false);
  const [loadingMenu, setLoadingMenu] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingStok, setLoadingStok] = useState(false);


  const logInfo = useCallback((message) => console.log(`[Admin Paneli] INFO: ${message}`), []);
  const logError = useCallback((message, errorObj) => console.error(`[Admin Paneli] ERROR: ${message}`, errorObj || ""), []);

  useEffect(() => {
    document.title = "Admin Paneli - Neso";
  }, []);

  const handleApiError = useCallback((err, defaultMessage = "Bilinmeyen bir hata oluştu.", context = "Bilinmeyen İşlem") => {
    const errorDetail = err.response?.data?.detail || err.message || defaultMessage;
    logError(`❌ ${context} hatası:`, err);
    setError(`${context}: ${errorDetail}`);
    if (err.response?.status === 401 || err.response?.status === 403) {
      alert("Oturumunuz sonlanmış veya bu işlem için yetkiniz bulunmuyor. Lütfen tekrar giriş yapın.");
      logout();
    }
  }, [logError, logout, setError]);

  const fetchMenuKategorileri = useCallback(async () => {
    logInfo("🗂️ Menü kategorileri getiriliyor...");
    setLoadingMenu(true); setError(null);
    try {
      const response = await apiClient.get("/admin/menu/kategoriler");
      setMenuKategorileri(response.data || []);
    } catch (err) { handleApiError(err, "Menü kategorileri alınamadı", "Menü Kategorileri"); }
    finally { setLoadingMenu(false); }
  }, [logInfo, handleApiError]);

  const kullanicilariGetir = useCallback(async () => {
    logInfo("👥 Kullanıcılar getiriliyor...");
    setLoadingUsers(true); setError(null);
    try {
      const response = await apiClient.get("/admin/kullanicilar");
      setKullanicilar(response.data || []);
    } catch (err) { handleApiError(err, "Kullanıcı listesi alınamadı", "Kullanıcı Listeleme"); }
    finally { setLoadingUsers(false); }
  }, [logInfo, handleApiError]);

  const verileriGetir = useCallback(async () => {
    logInfo(`🔄 Dashboard verileri ve menü ürünleri getiriliyor...`);
    setLoadingDashboardStats(true); setError(null);
    try {
      const [ siparisRes, gunlukRes, aylikRes, yillikRes, populerRes, aktifMasalarTutarlariRes, menuRes ] = await Promise.all([
        apiClient.get(`/siparisler`),
        apiClient.get(`/istatistik/gunluk`),
        apiClient.get(`/istatistik/aylik`),
        apiClient.get(`/istatistik/yillik-aylik-kirilim`),
        apiClient.get(`/istatistik/en-cok-satilan`),
        apiClient.get(`/admin/aktif-masa-tutarlari`),
        apiClient.get(`/menu`),
      ]);
      setOrders(siparisRes?.data?.orders || []);
      setGunluk( gunlukRes?.data || { siparis_sayisi: 0, toplam_gelir: 0, satilan_urun_adedi: 0, nakit_gelir: 0, kredi_karti_gelir: 0, diger_odeme_yontemleri_gelir: 0 } );
      setAylik( aylikRes?.data || { siparis_sayisi: 0, toplam_gelir: 0, satilan_urun_adedi: 0 } );
      setPopuler(populerRes?.data || []);
      setAktifMasaOzetleri(aktifMasalarTutarlariRes?.data || []);
      const yillikHamVeri = yillikRes?.data?.aylik_kirilim || {};
      const formatlanmisYillikVeri = Object.entries(yillikHamVeri)
        .map(([tarih, veri]) => ({ tarih, adet: Number(veri?.satilan_urun_adedi) || 0, gelir: Number(veri?.toplam_gelir) || 0 }))
        .sort((a, b) => a.tarih.localeCompare(b.tarih));
      setYillikChartData(formatlanmisYillikVeri);
      setMenu(menuRes?.data?.menu || []);
    } catch (err) { handleApiError(err, "Dashboard verileri alınamadı.", "Dashboard Veri Çekme"); }
    finally { setLoadingDashboardStats(false); }
  }, [logInfo, handleApiError]);

  const fetchStokKategorileri = useCallback(async () => {
    logInfo("🧺 Stok kategorileri getiriliyor...");
    setLoadingStok(true); setError(null);
    try {
      const response = await apiClient.get("/admin/stok/kategoriler");
      setStokKategorileri(response.data || []);
    } catch (err) { handleApiError(err, "Stok kategorileri alınamadı.", "Stok Kategorileri"); }
    finally { setLoadingStok(false); }
  }, [logInfo, handleApiError]);

  const fetchStokKalemleri = useCallback(async (kategoriId = null) => {
    logInfo(`📦 Stok kalemleri getiriliyor (Kategori ID: ${kategoriId || 'Tümü'})...`);
    setLoadingStok(true); setError(null);
    try {
      const params = {};
      if (kategoriId && kategoriId !== "") params.kategori_id = kategoriId;
      const response = await apiClient.get("/admin/stok/kalemler", { params });
      setStokKalemleri(response.data || []);
    } catch (err) { handleApiError(err, "Stok kalemleri alınamadı.", "Stok Kalemleri"); }
    finally { setLoadingStok(false); }
  }, [logInfo, handleApiError]);

  // YENİ EKLENEN: Reçete verilerini çekme fonksiyonları
  const fetchMenuUrunReceteleri = useCallback(async () => {
    logInfo("🍲 Menü ürün reçeteleri getiriliyor...");
    setLoadingRecipes(true); setError(null);
    try {
      // Backend'de bu endpoint'in oluşturulması gerekecek: GET /admin/receteler
      const response = await apiClient.get("/admin/receteler");
      setMenuUrunReceteleri(response.data || []);
    } catch (err) { handleApiError(err, "Reçeteler alınamadı", "Reçete Listeleme"); }
    finally { setLoadingRecipes(false); }
  }, [logInfo, handleApiError]);

  const fetchMenuItemsForRecipeSelection = useCallback(async () => {
    logInfo("🍜 Reçete için menü ürünleri (basit liste) getiriliyor...");
    setLoadingMenu(true);
    try {
      // Backend'de bu endpoint'in oluşturulması lazım: GET /admin/menu-items-simple
      const response = await apiClient.get("/admin/menu-items-simple");
      setMenuItemsForRecipe(response.data || []);
    } catch (err) { handleApiError(err, "Menü ürünleri (reçete için) alınamadı", "Yardımcı Menü Listesi"); }
    finally { setLoadingMenu(false); }
  }, [logInfo, handleApiError]);

  const fetchStockItemsForRecipeSelection = useCallback(async () => {
    logInfo("🧱 Reçete için stok kalemleri (basit liste) getiriliyor...");
    setLoadingStok(true);
    try {
      // Backend'de bu endpoint'in oluşturulması lazım: GET /admin/stock-items-simple
      const response = await apiClient.get("/admin/stock-items-simple");
      setStockItemsForRecipe(response.data || []);
    } catch (err) { handleApiError(err, "Stok kalemleri (reçete için) alınamadı", "Yardımcı Stok Listesi"); }
    finally { setLoadingStok(false); }
  }, [logInfo, handleApiError]);
  // YENİ EKLENEN KISIM SONU


  const refreshAllAdminData = useCallback(() => {
    logInfo("🔄 Tüm admin verileri yenileniyor...");
    verileriGetir();
    kullanicilariGetir();
    fetchMenuKategorileri();
    fetchStokKategorileri();
    fetchStokKalemleri(selectedStokKategoriFilter || null);
    fetchMenuUrunReceteleri(); // YENİ EKLENDİ
    // Modal açıldığında veya ihtiyaç duyulduğunda çağrılacakları için burada genel refresh'e eklemeye gerek yok gibi duruyor.
    // fetchMenuItemsForRecipeSelection(); 
    // fetchStockItemsForRecipeSelection();
  }, [verileriGetir, kullanicilariGetir, fetchMenuKategorileri, fetchStokKategorileri, fetchStokKalemleri, selectedStokKategoriFilter, fetchMenuUrunReceteleri, logInfo]); // YENİ: fetchMenuUrunReceteleri eklendi

  useEffect(() => {
    if (!loadingAuth) {
      if (isAuthenticated && userRole === 'admin') {
        refreshAllAdminData();
      } else if (isAuthenticated && userRole !== 'admin') { navigate('/unauthorized'); }
      else if (!isAuthenticated) { navigate('/login', { state: { from: { pathname: '/admin' } } }); }
    }
  }, [isAuthenticated, userRole, loadingAuth, navigate, refreshAllAdminData]);

  useEffect(() => {
    if (!isAuthenticated || userRole !== 'admin' || loadingAuth) {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) { wsRef.current.close(1000, "User not admin or logged out"); wsRef.current = null; }
      return;
    }
    let reconnectTimeoutId = null;
    let pingIntervalId = null;
    const connectWebSocket = () => {
      if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) return;
      const apiBaseForWs = process.env.REACT_APP_API_BASE;
      if (!apiBaseForWs) { logError("REACT_APP_API_BASE tanımsız."); setError("API Adresi Yapılandırma Hatası"); return; }
      try {
        const wsProtocol = apiBaseForWs.startsWith("https") ? "wss:" : (window.location.protocol === "https:" ? "wss:" : "ws:");
        const wsHost = apiBaseForWs.replace(/^https?:\/\//, "");
        const wsUrl = `${wsProtocol}//${wsHost}/ws/admin`;
        wsRef.current = new WebSocket(wsUrl);
        wsRef.current.onopen = () => { logInfo("✅ Admin WS bağlandı."); if (reconnectTimeoutId) {clearTimeout(reconnectTimeoutId); reconnectTimeoutId=null;} };
        wsRef.current.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            logInfo(`📥 Admin WS mesajı: Tip: ${message.type}`);
            if (["siparis", "durum", "masa_durum"].includes(message.type)) { verileriGetir(); }
            else if (message.type === "menu_guncellendi") { fetchMenuKategorileri(); verileriGetir(); fetchMenuItemsForRecipeSelection(); }
            else if (message.type === "kategori_guncellendi") { fetchMenuKategorileri(); verileriGetir(); }
            else if (message.type === "stok_guncellendi") { fetchStokKategorileri(); fetchStokKalemleri(selectedStokKategoriFilter || null); fetchStockItemsForRecipeSelection(); }
            else if (message.type === "kullanici_guncellendi") { kullanicilariGetir(); }
            else if (message.type === "recete_guncellendi") { fetchMenuUrunReceteleri(); } // YENİ EKLENDİ
          } catch (err) { logError("Admin WS mesaj işleme hatası:", err); }
        };
        wsRef.current.onerror = (err) => { logError("❌ Admin WS hatası:", err); setError("WS bağlantı hatası."); };
        wsRef.current.onclose = (ev) => {
          logInfo(`🔌 Admin WS kapandı. Kod: ${ev.code}`); wsRef.current = null;
          if (isAuthenticated && userRole === 'admin' && ev.code !== 1000 && ev.code !== 1001 && !ev.wasClean) {
            reconnectTimeoutId = setTimeout(connectWebSocket, 5000 + Math.random() * 3000);
          }
        };
      } catch (err) { logError("❌ Admin WS başlatma kritik hata:", err); setError("WS başlatma hatası."); }
    };
    connectWebSocket();
    pingIntervalId = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) { try { wsRef.current.send(JSON.stringify({ type: "ping" })); } catch(e){logError("Ping gönderilemedi", e)}}
      else if (isAuthenticated && userRole === 'admin' && !wsRef.current) { connectWebSocket(); }
    }, 30000);
    return () => { clearInterval(pingIntervalId); if (reconnectTimeoutId) clearTimeout(reconnectTimeoutId); if (wsRef.current) { wsRef.current.close(1000, "Component unmounting"); wsRef.current = null;}};
  }, [isAuthenticated, userRole, loadingAuth, verileriGetir, fetchMenuKategorileri, kullanicilariGetir, fetchStokKategorileri, fetchStokKalemleri, selectedStokKategoriFilter, fetchMenuUrunReceteleri, fetchMenuItemsForRecipeSelection, fetchStockItemsForRecipeSelection, logInfo, logError, setError]); // YENİ: fetchMenuUrunReceteleri ve diğerleri eklendi.

  const urunEkle = useCallback(async (e) => {
    e.preventDefault();
    if (!yeniUrun.ad.trim() || !yeniUrun.fiyat.trim() || !yeniUrun.kategori.trim()) { alert("Lütfen ürün adı, fiyatı ve kategorisini girin."); return; }
    const fiyatNum = parseFloat(yeniUrun.fiyat);
    if (isNaN(fiyatNum) || fiyatNum <= 0) { alert("Lütfen geçerli bir pozitif fiyat girin."); return; }
    setLoadingMenu(true); setError(null);
    try {
      await apiClient.post(`/menu/ekle`, { ad: yeniUrun.ad.trim(), fiyat: fiyatNum, kategori: yeniUrun.kategori.trim() });
      alert("Ürün başarıyla eklendi.");
      setYeniUrun(initialYeniUrunState);
      setShowAddMenuItemModal(false);
      await verileriGetir();
      await fetchMenuKategorileri();
      await fetchMenuItemsForRecipeSelection();
    } catch (err) { handleApiError(err, "Ürün eklenemedi", "Menü Ürün Ekleme"); }
    finally { setLoadingMenu(false); }
  }, [yeniUrun, verileriGetir, fetchMenuKategorileri, fetchMenuItemsForRecipeSelection, handleApiError, initialYeniUrunState]);

  const urunSil = useCallback(async (e) => {
    e.preventDefault();
    if (!silUrunAdi.trim()) { alert("Lütfen silinecek ürünün adını girin."); return; }
    const urunAdiTrimmed = silUrunAdi.trim();
    if (!window.confirm(`'${urunAdiTrimmed}' adlı ürünü menüden silmek istediğinize emin misiniz? Bu işlem aynı zamanda bu ürüne ait reçeteyi de silebilir (backend ayarına göre).`)) return;
    setLoadingMenu(true); setError(null);
    try {
      await apiClient.delete(`/menu/sil`, { params: { urun_adi: urunAdiTrimmed } });
      alert("Ürün başarıyla silindi.");
      setSilUrunAdi("");
      await verileriGetir();
      await fetchMenuItemsForRecipeSelection();
      await fetchMenuUrunReceteleri();
    } catch (err) { handleApiError(err, "Ürün silinemedi", "Menü Ürün Silme"); }
    finally { setLoadingMenu(false); }
  }, [silUrunAdi, verileriGetir, fetchMenuItemsForRecipeSelection, fetchMenuUrunReceteleri, handleApiError]);

  const openDeleteCategoryModal = (kategori) => { setCategoryToDelete(kategori); setShowDeleteCategoryModal(true); };
  const confirmDeleteMenuKategori = useCallback(async () => {
    if (!categoryToDelete) return;
    setLoadingMenu(true); setError(null);
    try {
      await apiClient.delete(`/admin/menu/kategoriler/${categoryToDelete.id}`);
      alert(`'${categoryToDelete.isim}' kategorisi ve bağlı tüm ürünler silindi.`);
      setShowDeleteCategoryModal(false); setCategoryToDelete(null);
      await fetchMenuKategorileri();
      await verileriGetir();
      await fetchMenuItemsForRecipeSelection();
      await fetchMenuUrunReceteleri();
    } catch (err) { handleApiError(err, "Menü kategorisi silinemedi", "Menü Kategori Silme"); }
    finally { setLoadingMenu(false); }
  }, [categoryToDelete, fetchMenuKategorileri, verileriGetir, fetchMenuItemsForRecipeSelection, fetchMenuUrunReceteleri, handleApiError]);


  const handleYeniKullaniciChange = (e) => { const { name, value, type, checked } = e.target; setYeniKullanici(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value })); };
  const yeniKullaniciEkle = useCallback(async (e) => {
    e.preventDefault();
    if (!yeniKullanici.kullanici_adi.trim() || !yeniKullanici.sifre || !yeniKullanici.rol) { alert("Kullanıcı adı, şifre ve rol boş bırakılamaz."); return; }
    if (yeniKullanici.sifre.length < 6) { alert("Şifre en az 6 karakter olmalıdır."); return; }
    setLoadingUsers(true); setError(null);
    try {
      await apiClient.post("/admin/kullanicilar", { ...yeniKullanici, kullanici_adi: yeniKullanici.kullanici_adi.trim() });
      alert("Yeni kullanıcı eklendi.");
      setYeniKullanici(initialYeniKullaniciState); setShowAddUserForm(false);
      await kullanicilariGetir();
    } catch (err) { handleApiError(err, "Yeni kullanıcı eklenemedi", "Kullanıcı Ekleme"); }
    finally { setLoadingUsers(false); }
  }, [yeniKullanici, kullanicilariGetir, handleApiError, initialYeniKullaniciState]);

  const openEditUserModal = (user) => { setEditingUser({ ...user, sifre: "" }); setShowEditUserModal(true); };
  const handleEditingUserChange = (e) => { const { name, value, type, checked } = e.target; setEditingUser(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value })); };
  const guncelleKullanici = useCallback(async (e) => {
    e.preventDefault();
    if (!editingUser || !editingUser.id) { alert("Düzenlenecek kullanıcı seçilmedi."); return; }
    if (!editingUser.kullanici_adi.trim() || !editingUser.rol) { alert("Kullanıcı adı ve rol boş bırakılamaz."); return; }
    if (editingUser.sifre && editingUser.sifre.length > 0 && editingUser.sifre.length < 6) { alert("Yeni şifre en az 6 karakter olmalıdır."); return; }
    setLoadingUsers(true); setError(null);
    const dataToUpdate = { kullanici_adi: editingUser.kullanici_adi.trim(), rol: editingUser.rol, aktif_mi: editingUser.aktif_mi };
    if (editingUser.sifre && editingUser.sifre.trim() !== "") dataToUpdate.sifre = editingUser.sifre.trim();
    try {
      await apiClient.put(`/admin/kullanicilar/${editingUser.id}`, dataToUpdate);
      alert("Kullanıcı güncellendi.");
      setShowEditUserModal(false); setEditingUser(null);
      await kullanicilariGetir();
    } catch (err) { handleApiError(err, "Kullanıcı güncellenemedi", "Kullanıcı Güncelleme"); }
    finally { setLoadingUsers(false); }
  }, [editingUser, kullanicilariGetir, handleApiError]);

  const openDeleteUserModal = (user) => { if (currentUser?.id === user.id) { alert("Kendinizi silemezsiniz."); return; } setUserToDelete(user); setShowDeleteUserModal(true); };
  const confirmDeleteUser = useCallback(async () => {
    if (!userToDelete) return;
    setLoadingUsers(true); setError(null);
    try {
      await apiClient.delete(`/admin/kullanicilar/${userToDelete.id}`);
      alert(`'${userToDelete.kullanici_adi}' kullanıcısı silindi.`);
      setShowDeleteUserModal(false); setUserToDelete(null);
      await kullanicilariGetir();
    } catch (err) { handleApiError(err, "Kullanıcı silinemedi", "Kullanıcı Silme"); }
    finally { setLoadingUsers(false); }
  }, [userToDelete, kullanicilariGetir, handleApiError, currentUser]);


  const openStokKategoriModal = useCallback((kategori = null) => { setEditingStokKategori(kategori ? { ...kategori } : initialEditingStokKategori); setShowStokKategoriModal(true); }, [initialEditingStokKategori]);
  const handleStokKategoriFormSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!editingStokKategori || !editingStokKategori.ad?.trim()) { alert("Kategori adı boş olamaz."); return; }
    setLoadingStok(true); setError(null);
    try {
      if (editingStokKategori.id) {
        await apiClient.put(`/admin/stok/kategoriler/${editingStokKategori.id}`, { ad: editingStokKategori.ad.trim() });
        alert("Stok kategorisi güncellendi.");
      } else {
        await apiClient.post("/admin/stok/kategoriler", { ad: editingStokKategori.ad.trim() });
        alert("Stok kategorisi eklendi.");
      }
      setShowStokKategoriModal(false); setEditingStokKategori(initialEditingStokKategori);
      await fetchStokKategorileri();
    } catch (err) { handleApiError(err, "Stok kategori işlemi başarısız", "Stok Kategori Kayıt"); }
    finally { setLoadingStok(false); }
  }, [editingStokKategori, fetchStokKategorileri, handleApiError, initialEditingStokKategori]);

  const openStokKategoriSilModal = (kategori) => { setStokKategoriToDelete(kategori); };
  const confirmDeleteStokKategori = useCallback(async () => {
    if (!stokKategoriToDelete) return;
    setLoadingStok(true); setError(null);
    try {
      await apiClient.delete(`/admin/stok/kategoriler/${stokKategoriToDelete.id}`);
      alert(`'${stokKategoriToDelete.ad}' stok kategorisi silindi.`);
      setStokKategoriToDelete(null);
      await fetchStokKategorileri();
      await fetchStokKalemleri();
      await fetchStockItemsForRecipeSelection();
    } catch (err) { handleApiError(err, "Stok kategorisi silinemedi", "Stok Kategori Silme"); }
    finally { setLoadingStok(false); }
  }, [stokKategoriToDelete, fetchStokKategorileri, fetchStokKalemleri, fetchStockItemsForRecipeSelection, handleApiError]);

  const openStokKalemiModal = useCallback((kalem = null) => {
    setEditingStokKalemi(kalem ? {...kalem, stok_kategori_id: kalem.stok_kategori_id || "", son_alis_fiyati: kalem.son_alis_fiyati ?? ""} : initialEditingStokKalemi);
    setShowStokKalemiModal(true);
  }, [initialEditingStokKalemi]);

  const handleStokKalemiFormChange = (e) => {
    const { name, value } = e.target;
    setEditingStokKalemi(prev => ({ ...prev, [name]: value }));
  };

  const handleStokKalemiFormSubmit = useCallback(async (e) => {
    e.preventDefault();
    const { id, ad, stok_kategori_id, birim, mevcut_miktar, min_stok_seviyesi, son_alis_fiyati } = editingStokKalemi;
    if (!ad?.trim() || !stok_kategori_id || stok_kategori_id === "" || !birim?.trim()) { alert("Kalem adı, stok kategorisi ve birim zorunludur."); return; }
    setLoadingStok(true); setError(null);
    const payloadBase = { ad: ad.trim(), stok_kategori_id: parseInt(stok_kategori_id, 10), birim: birim.trim(), min_stok_seviyesi: parseFloat(min_stok_seviyesi) || 0 };
    let payload;
    if (id) { payload = { ...payloadBase }; }
    else { payload = { ...payloadBase, mevcut_miktar: parseFloat(mevcut_miktar) || 0, son_alis_fiyati: son_alis_fiyati && String(son_alis_fiyati).trim() !== "" ? parseFloat(son_alis_fiyati) : null }; }

    try {
      if (id) { await apiClient.put(`/admin/stok/kalemler/${id}`, payload); alert("Stok kalemi güncellendi."); }
      else { await apiClient.post("/admin/stok/kalemler", payload); alert("Stok kalemi eklendi."); }
      setShowStokKalemiModal(false); setEditingStokKalemi(initialEditingStokKalemi);
      await fetchStokKalemleri(selectedStokKategoriFilter || null);
      await fetchStockItemsForRecipeSelection();
    } catch (err) { handleApiError(err, "Stok kalemi işlemi başarısız", "Stok Kalemi Kayıt"); }
    finally { setLoadingStok(false); }
  }, [editingStokKalemi, fetchStokKalemleri, selectedStokKategoriFilter, fetchStockItemsForRecipeSelection, handleApiError, initialEditingStokKalemi]);

  const openStokKalemiSilModal = (kalem) => { setStokKalemiToDelete(kalem); };
  const confirmDeleteStokKalemi = useCallback(async () => {
    if (!stokKalemiToDelete) return;
    setLoadingStok(true); setError(null);
    try {
      await apiClient.delete(`/admin/stok/kalemler/${stokKalemiToDelete.id}`);
      alert(`'${stokKalemiToDelete.ad}' stok kalemi silindi.`);
      setStokKalemiToDelete(null);
      await fetchStokKalemleri(selectedStokKategoriFilter || null);
      await fetchStockItemsForRecipeSelection();
    } catch (err) { handleApiError(err, "Stok kalemi silinemedi", "Stok Kalemi Silme"); }
    finally { setLoadingStok(false); }
  }, [stokKalemiToDelete, fetchStokKalemleri, selectedStokKategoriFilter, fetchStockItemsForRecipeSelection, handleApiError]);

  useEffect(() => { if(isAuthenticated && userRole === 'admin' && !loadingAuth) fetchStokKalemleri(selectedStokKategoriFilter || null); }, [selectedStokKategoriFilter, isAuthenticated, userRole, loadingAuth, fetchStokKalemleri]);

  // YENİ EKLENEN: Reçete Yönetimi Fonksiyonları
  const openRecipeModal = useCallback((recipe = null) => {
    fetchMenuItemsForRecipeSelection();
    fetchStockItemsForRecipeSelection();

    if (recipe) {
      setEditingRecipe({
        ...recipe,
        menu_urun_id: recipe.menu_urun_id || "",
        bilesenler: recipe.bilesenler?.map(b => ({
          id: b.id, // Eğer backend'den bileşen ID'si geliyorsa ve düzenleme için önemliyse
          stok_kalemi_id: b.stok_kalemi_id || "",
          miktar: b.miktar || "",
          birim: b.birim || "",
        })) || []
      });
    } else {
      setEditingRecipe(initialEditingRecipeState);
    }
    setShowRecipeModal(true);
  }, [initialEditingRecipeState, fetchMenuItemsForRecipeSelection, fetchStockItemsForRecipeSelection]);

  const handleRecipeFormChange = (e) => {
    const { name, value } = e.target;
    setEditingRecipe(prev => ({ ...prev, [name]: value }));
  };

  const handleRecipeBilesenChange = (index, field, value) => {
    setEditingRecipe(prev => ({
      ...prev,
      bilesenler: prev.bilesenler.map((b, i) => i === index ? { ...b, [field]: value } : b)
    }));
  };

  const addRecipeBilesen = () => {
    setEditingRecipe(prev => ({
      ...prev,
      bilesenler: [...prev.bilesenler, { stok_kalemi_id: "", miktar: "", birim: "" }]
    }));
  };

  const removeRecipeBilesen = (index) => {
    setEditingRecipe(prev => ({
      ...prev,
      bilesenler: prev.bilesenler.filter((_, i) => i !== index)
    }));
  };

  const handleSaveRecipe = useCallback(async (e) => {
    e.preventDefault();
    const { id, menu_urun_id, aciklama, porsiyon_birimi, porsiyon_miktari, bilesenler } = editingRecipe;

    if (!menu_urun_id) { alert("Lütfen reçetenin ait olduğu menü ürününü seçin."); return; }
    if (!porsiyon_birimi.trim()) { alert("Porsiyon birimi boş bırakılamaz."); return; }
    if (isNaN(parseFloat(porsiyon_miktari)) || parseFloat(porsiyon_miktari) <= 0) { alert("Lütfen geçerli bir pozitif porsiyon miktarı girin."); return; }
    if (bilesenler.length === 0) { alert("Reçete en az bir bileşen içermelidir."); return; }

    for (const bilesen of bilesenler) {
      if (!bilesen.stok_kalemi_id) { alert("Tüm bileşenler için stok kalemi seçilmelidir."); return; }
      const stokKalemiAdi = stockItemsForRecipe.find(s=>s.id === parseInt(bilesen.stok_kalemi_id))?.ad || `ID: ${bilesen.stok_kalemi_id}`;
      if (isNaN(parseFloat(bilesen.miktar)) || parseFloat(bilesen.miktar) <= 0) { alert(`'${stokKalemiAdi}' bileşeni için geçerli bir miktar girin.`); return; }
      if (!bilesen.birim.trim()) { alert(`'${stokKalemiAdi}' bileşeni için birim belirtin.`); return; }
    }

    setLoadingRecipes(true); setError(null);

    const payload = {
      menu_urun_id: parseInt(menu_urun_id, 10),
      aciklama: aciklama?.trim() || null,
      porsiyon_birimi: porsiyon_birimi.trim(),
      porsiyon_miktari: parseFloat(porsiyon_miktari),
      bilesenler: bilesenler.map(b => ({
        stok_kalemi_id: parseInt(b.stok_kalemi_id, 10),
        miktar: parseFloat(b.miktar),
        birim: b.birim.trim(),
      })),
    };

    try {
      if (id) {
        await apiClient.put(`/admin/receteler/${id}`, payload);
        alert("Reçete başarıyla güncellendi.");
      } else {
        await apiClient.post("/admin/receteler", payload);
        alert("Reçete başarıyla eklendi.");
      }
      setShowRecipeModal(false);
      setEditingRecipe(initialEditingRecipeState);
      await fetchMenuUrunReceteleri();
    } catch (err) {
      handleApiError(err, id ? "Reçete güncellenemedi" : "Reçete eklenemedi", "Reçete Kayıt");
    } finally {
      setLoadingRecipes(false);
    }
  }, [editingRecipe, stockItemsForRecipe, fetchMenuUrunReceteleri, handleApiError, initialEditingRecipeState]);

  const openDeleteRecipeModal = (recete) => { setRecipeToDelete(recete); };
  const confirmDeleteRecipe = useCallback(async () => {
    if (!recipeToDelete) return;
    setLoadingRecipes(true); setError(null);
    try {
      await apiClient.delete(`/admin/receteler/${recipeToDelete.id}`);
      alert(`'${recipeToDelete.menu_urun_ad || `ID: ${recipeToDelete.menu_urun_id}`}' ürününün reçetesi silindi.`);
      setRecipeToDelete(null);
      await fetchMenuUrunReceteleri();
    } catch (err) { handleApiError(err, "Reçete silinemedi", "Reçete Silme"); }
    finally { setLoadingRecipes(false); }
  }, [recipeToDelete, fetchMenuUrunReceteleri, handleApiError]);
  // YENİ EKLENEN KISIM SONU


  const filtrelenmisSiparisler = orders.filter((o) => {
    if (!o || typeof o !== "object") return false;
    const aramaLower = arama.toLowerCase();
    let sepetText = "";
    if (Array.isArray(o.sepet)) {
      sepetText = o.sepet.map(item => item && typeof item === "object" ? `${item.adet || "?"}x ${item.urun || "?"}` : "").filter(Boolean).join(" ");
    } else if (typeof o.sepet === "string" && o.sepet.trim() && o.sepet !== "[]") {
      try {
        const parsedSepet = JSON.parse(o.sepet);
        if (Array.isArray(parsedSepet)) {
          sepetText = parsedSepet.map(item => item && typeof item === "object" ? `${item.adet || "?"}x ${item.urun || "?"}` : "").filter(Boolean).join(" ");
        } else { sepetText = o.sepet; }
      } catch (e) { sepetText = o.sepet; }
    }
    const aranacakMetin = [
        String(o.id || ""),
        String(o.masa || ""),
        o.durum || "",
        o.istek || "",
        o.yanit || "",
        sepetText,
        o.zaman ? new Date(o.zaman).toLocaleString("tr-TR", { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : "",
        o.odeme_yontemi || ""
    ].join(" ").toLowerCase();
    return aranacakMetin.includes(aramaLower);
  });

  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-sky-100 p-4">
        <div className="bg-white shadow-xl p-8 rounded-lg text-center border border-slate-300">
          <RotateCw className="w-12 h-12 text-blue-500 mx-auto mb-4 animate-spin" />
          <h2 className="text-xl font-semibold mb-2 text-slate-700">Yükleniyor...</h2>
          <p className="text-slate-500">Admin paneli yetkileri kontrol ediliyor, lütfen bekleyin.</p>
        </div>
      </div>
    );
  }

  const anyLoading = loadingDashboardStats || loadingUsers || loadingMenu || loadingStok || loadingRecipes; // YENİ: loadingRecipes eklendi

  return (
    <div className="p-4 md:p-6 bg-gradient-to-br from-slate-100 via-gray-100 to-slate-200 min-h-screen text-slate-800 font-['Nunito',_sans-serif] relative">
      {error && (
        <div className="sticky top-4 left-1/2 -translate-x-1/2 max-w-2xl w-auto z-[1000] bg-red-100 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded-md mb-6 shadow-lg flex justify-between items-center" role="alert">
          <div><strong className="font-bold">Hata: </strong><span className="block sm:inline text-sm">{error}</span></div>
          <button
            onClick={() => { setError(null); refreshAllAdminData(); }}
            className="ml-4 px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-semibold transition-colors flex items-center gap-1"
            disabled={anyLoading}
            title="Verileri Yeniden Yükle"
          >
            <RotateCw size={14} className={`${anyLoading ? 'animate-spin' : ''}`}/>
            Tekrar Dene
          </button>
        </div>
      )}
      {anyLoading && !error && (
        <div className="fixed inset-0 bg-slate-700/30 backdrop-blur-sm flex flex-col items-center justify-center z-[9999]">
          <RotateCw className="w-10 h-10 text-blue-500 animate-spin mb-2" />
          <p className="text-white/90 text-sm font-medium">Veriler Yükleniyor...</p>
        </div>
      )}

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

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6 md:mb-8">
        <div className="bg-white p-4 sm:p-5 rounded-xl shadow-lg border-t-4 border-blue-500 hover:shadow-xl transition-shadow">
          <h3 className="text-xs sm:text-sm font-semibold mb-1 flex items-center gap-2 text-slate-500">
            <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" /> Günlük Satılan Ürün
          </h3>
          <CountUp end={gunluk?.satilan_urun_adedi || 0} separator="." className="text-2xl sm:text-3xl font-bold text-blue-600 block"/>
        </div>

        <div
          className="bg-white p-4 sm:p-5 rounded-xl shadow-lg border-t-4 border-green-500 hover:shadow-xl transition-shadow relative group"
          onMouseEnter={() => setDailyIncomeDetailsVisible(true)}
          onMouseLeave={() => setDailyIncomeDetailsVisible(false)}
          onClick={(e) => { e.stopPropagation(); setDailyIncomeDetailsVisible(prev => !prev);}}
        >
          <h3 className="text-xs sm:text-sm font-semibold mb-1 flex items-center justify-between text-slate-500">
            <span><DollarSign className="w-4 h-4 sm:w-5 sm:h-5 inline-block mr-1.5 text-green-500" /> Günlük Gelir</span>
            <ChevronDown size={16} className={`text-slate-400 transition-transform duration-200 ${dailyIncomeDetailsVisible ? 'rotate-180' : ''}`}/>
          </h3>
          <CountUp end={gunluk?.toplam_gelir || 0} separator="." decimal="," decimals={2} prefix="₺" className="text-2xl sm:text-3xl font-bold text-green-600 block"/>
          <div className={`absolute left-0 top-full mt-1 w-full min-w-[180px] bg-white border border-slate-200 shadow-xl p-2.5 rounded-md z-20 text-xs text-slate-600 space-y-1 transition-all duration-300 ease-out origin-top
                           ${dailyIncomeDetailsVisible ? 'opacity-100 transform scale-y-100 visible' : 'opacity-0 transform scale-y-95 invisible pointer-events-none'}`}>
            <p>Nakit: <span className="font-semibold text-green-700">₺{(gunluk?.nakit_gelir || 0).toFixed(2)}</span></p>
            <p>K. Kartı: <span className="font-semibold text-blue-700">₺{(gunluk?.kredi_karti_gelir || 0).toFixed(2)}</span></p>
            {gunluk?.diger_odeme_yontemleri_gelir > 0 && <p>Diğer: <span className="font-semibold">₺{(gunluk?.diger_odeme_yontemleri_gelir || 0).toFixed(2)}</span></p>}
          </div>
        </div>
         <div className="bg-white p-4 sm:p-5 rounded-xl shadow-lg border-t-4 border-purple-500 hover:shadow-xl transition-shadow">
          <h3 className="text-xs sm:text-sm font-semibold mb-1 flex items-center gap-2 text-slate-500">
            <UserCheck className="w-4 h-4 sm:w-5 sm:h-5 text-purple-500" /> Aktif Masa Sayısı
          </h3>
          <CountUp end={aktifMasaOzetleri?.length || 0} separator="." className="text-2xl sm:text-3xl font-bold text-purple-600 block"/>
        </div>
        <div className="bg-white p-4 sm:p-5 rounded-xl shadow-lg border-t-4 border-orange-500 hover:shadow-xl transition-shadow">
          <h3 className="text-xs sm:text-sm font-semibold mb-1 flex items-center gap-2 text-slate-500">
            <Coffee className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500" /> En Popüler Ürün
          </h3>
          {populer?.[0] ? (
            <p className="text-base sm:text-lg font-bold text-orange-600 truncate" title={populer[0].urun}>
              {populer[0].urun}{" "}
              <span className="text-xs sm:text-sm font-normal text-slate-500 ml-1">({populer[0].adet || 0} adet)</span>
            </p>
          ) : ( <p className="text-slate-400 text-xs sm:text-sm">{loadingDashboardStats ? "Yükleniyor..." : "Veri yok"}</p> )}
        </div>
      </section>

      <section className="bg-white p-5 sm:p-6 rounded-xl shadow-lg mb-6 md:mb-8">
        <h3 className="text-lg sm:text-xl font-semibold mb-4 text-slate-700 flex items-center gap-2 sm:gap-3">
            <ListChecks className="w-5 h-5 sm:w-6 sm:h-6 text-cyan-600" /> Aktif Masaların Ödenmemiş Hesapları
        </h3>
        {loadingDashboardStats && aktifMasaOzetleri.length === 0 && <p className="text-sm text-slate-500 py-2">Aktif masa özetleri yükleniyor...</p>}
        {!loadingDashboardStats && aktifMasaOzetleri.length === 0 && <p className="text-sm text-slate-500 py-2">Şu anda aktif ve ödenmemiş hesabı olan masa bulunmuyor.</p>}
        {aktifMasaOzetleri.length > 0 && (
            <div className="overflow-x-auto max-h-80 text-xs sm:text-sm">
                <table className="min-w-full divide-y divide-slate-200 border border-slate-200 rounded-md">
                    <thead className="bg-cyan-50 sticky top-0 z-10">
                        <tr>
                            <th className="px-3 py-2.5 text-left font-medium text-cyan-700 uppercase tracking-wider">Masa ID</th>
                            <th className="px-3 py-2.5 text-right font-medium text-cyan-700 uppercase tracking-wider">Aktif Sipariş Sayısı</th>
                            <th className="px-3 py-2.5 text-right font-medium text-cyan-700 uppercase tracking-wider">Ödenmemiş Tutar (₺)</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-100">
                        {aktifMasaOzetleri.sort((a,b) => parseFloat(b.odenmemis_tutar) - parseFloat(a.odenmemis_tutar)).map(masa => (
                            <tr key={masa.masa_id} className="hover:bg-cyan-50/40 transition-colors">
                                <td className="px-3 py-2 whitespace-nowrap font-medium text-slate-800">{masa.masa_id}</td>
                                <td className="px-3 py-2 whitespace-nowrap text-right text-slate-600">{masa.aktif_siparis_sayisi}</td>
                                <td className="px-3 py-2 whitespace-nowrap text-right font-semibold text-red-600">
                                    {Number(masa.odenmemis_tutar).toFixed(2)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )}
      </section>


      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 md:mb-8">
        <div className="bg-white p-5 sm:p-6 rounded-xl shadow-lg">
          <h3 className="text-base sm:text-lg font-semibold mb-4 text-slate-700">Yıllık Satış Adetleri (Aylık Kırılım)</h3>
          {loadingDashboardStats && yillikChartData.length === 0 && <p className="text-sm text-slate-500 py-10 text-center">Grafik verileri yükleniyor...</p>}
          {!loadingDashboardStats && yillikChartData.length === 0 && <p className="text-sm text-slate-500 py-10 text-center">Bu yıl için satış verisi bulunmuyor.</p>}
          {yillikChartData.length > 0 && (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={yillikChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="tarih" tick={{ fontSize: 10 }} stroke="#64748b" />
                <YAxis tick={{ fontSize: 10 }} stroke="#64748b" />
                <Tooltip contentStyle={{ backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: '0.5rem', borderColor: '#cbd5e1' }} itemStyle={{ color: '#334155' }} labelStyle={{ color: '#0f172a', fontWeight: 'bold' }} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="adet" fill="#3b82f6" name="Satılan Ürün Adedi" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="bg-white p-5 sm:p-6 rounded-xl shadow-lg">
          <h3 className="text-base sm:text-lg font-semibold mb-4 text-slate-700">En Çok Satılan 5 Ürün</h3>
          {loadingDashboardStats && populer.length === 0 && <p className="text-sm text-slate-500 py-10 text-center">Veriler yükleniyor...</p>}
          {!loadingDashboardStats && populer.length === 0 && <p className="text-sm text-slate-500 py-10 text-center">Satış verisi bulunmuyor.</p>}
          {populer.length > 0 && (
             <ResponsiveContainer width="100%" height={300}>
                <BarChart data={populer.slice(0,5)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0"/>
                    <XAxis type="number" tick={{ fontSize: 10 }} stroke="#64748b" />
                    <YAxis dataKey="urun" type="category" width={100} tick={{ fontSize: 10, fill: '#475569' }} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}/>
                    <Tooltip contentStyle={{ backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: '0.5rem', borderColor: '#cbd5e1' }} itemStyle={{ color: '#334155' }} labelStyle={{ color: '#0f172a', fontWeight: 'bold' }}/>
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Bar dataKey="adet" fill="#f97316" name="Adet" radius={[0, 4, 4, 0]} barSize={20}/>
                </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      <section className="bg-white p-5 sm:p-6 rounded-xl shadow-lg mb-6 md:mb-8">
        <h3 className="text-xl font-semibold mb-6 text-slate-700 flex items-center gap-3">
          <MenuSquare className="w-6 h-6 text-teal-600" /> Menü Yönetimi
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-4 space-y-6 p-4 bg-teal-50/50 rounded-lg border border-teal-200/70">
            <div>
                <h4 className="font-medium mb-2 text-teal-700 flex items-center gap-1.5"><FilePlus size={18}/>Yeni Ürün Ekle</h4>
                <button
                  onClick={() => { setYeniUrun(initialYeniUrunState); setShowAddMenuItemModal(true); }}
                  disabled={loadingMenu}
                  title={"Yeni menü ürünü ekle"}
                  className="w-full bg-teal-600 hover:bg-teal-700 text-white py-2 px-3 rounded-md shadow-sm font-semibold text-sm flex items-center justify-center gap-2 transition-colors disabled:bg-slate-400"
                >
                  <PlusCircle size={16} /> Yeni Ürün Ekle
                </button>
            </div>
            <div>
              <h4 className="font-medium mb-2 text-red-700 flex items-center gap-1.5"><Trash2 size={18}/>Ürün Sil</h4>
              <form onSubmit={urunSil} className="space-y-2">
                <div>
                  <label htmlFor="silUrunAdi" className="sr-only">Silinecek Ürün Adı</label>
                  <input type="text" id="silUrunAdi" value={silUrunAdi} onChange={(e) => setSilUrunAdi(e.target.value)} placeholder="Silinecek ürünün tam adı"
                         className="w-full p-2 border border-slate-300 rounded-md shadow-sm focus:ring-1 focus:ring-red-500 focus:border-red-500 text-sm" required/>
                </div>
                <button type="submit" disabled={loadingMenu}
                        className="w-full bg-red-600 hover:bg-red-700 text-white py-2 px-3 rounded-md shadow-sm font-semibold text-sm flex items-center justify-center gap-2 transition-colors disabled:bg-slate-400">
                  <Trash2 size={16} /> Ürünü Sil
                </button>
              </form>
            </div>
          </div>
          <div className="md:col-span-5">
            <h4 className="font-medium mb-3 text-gray-600">Mevcut Menü</h4>
            {(loadingDashboardStats || loadingMenu) && (!menu || menu.length === 0) && (
              <div className="text-center py-10 text-gray-400 italic">Menü yükleniyor...</div>
            )}
            {!(loadingDashboardStats || loadingMenu) && (!menu || menu.length === 0) && (
              <div className="text-center py-10 text-gray-500">Menü boş veya yüklenemedi.</div>
            )}
            {menu?.length > 0 && (
              <div className="grid grid-cols-1 gap-4 max-h-[450px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 border border-gray-200 rounded-md p-2">
                {menu.map((kategori) => (
                  <div key={kategori.kategori} className="bg-gray-50 p-4 rounded-lg border border-gray-200 shadow-sm">
                    <h5 className="font-semibold mb-2 text-teal-700 capitalize">{kategori.kategori}</h5>
                    <ul className="space-y-1 text-sm">
                      {(!kategori.urunler || kategori.urunler.length === 0) && (
                        <li className="text-xs text-gray-400 italic">Bu kategoride ürün yok.</li>
                      )}
                      {kategori.urunler?.sort((a,b) => a.ad.localeCompare(b.ad)).map((urun) => (
                        <li
                          key={`${kategori.kategori}-${urun.ad}`}
                          className="flex justify-between items-center border-b border-gray-100 py-1.5 last:border-b-0 hover:bg-gray-100 px-1 rounded"
                        >
                          <span
                            className={`${urun.stok_durumu === 0 ? 'text-red-500 line-through opacity-70' : 'text-gray-800'} truncate max-w-[60%]`}
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
          <div className="md:col-span-3 space-y-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
            <h4 className="text-sm font-medium text-slate-600 flex items-center gap-1.5">
              <ClipboardList size={16} className="text-cyan-600"/>Menü Kategorileri
            </h4>
            {loadingMenu && menuKategorileri.length === 0 && <p className="text-xs text-slate-400 py-1">Kategoriler yükleniyor...</p>}
            {!loadingMenu && menuKategorileri.length === 0 && <p className="text-xs text-slate-500 py-1">Mevcut menü kategorisi bulunmuyor.</p>}
            {menuKategorileri.length > 0 && (
              <ul className="space-y-1.5 max-h-72 overflow-y-auto pr-1 text-xs">
                {menuKategorileri.sort((a,b) => a.isim.localeCompare(b.isim)).map(kat => (
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
            <p className="text-xs text-slate-500 pt-2 border-t border-slate-200 mt-2">Not: Yeni kategoriler, menüye o kategoride ilk ürün eklendiğinde otomatik olarak oluşturulur.</p>
          </div>
        </div>
      </section>

      <section className="bg-white p-5 sm:p-6 rounded-xl shadow-lg mb-6 md:mb-8">
        <h3 className="text-xl font-semibold mb-6 text-slate-700 flex items-center gap-3">
          <ClipboardEdit size={22} className="text-lime-600" /> Stok Yönetimi
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1 p-4 border border-lime-200/70 rounded-lg bg-lime-50/40">
            <div className="flex justify-between items-center mb-3 pb-2 border-b border-lime-200">
              <h4 className="text-base font-medium text-lime-700 flex items-center gap-2"><Archive size={18}/>Stok Kategorileri</h4>
              <button
                onClick={() => openStokKategoriModal()}
                className="bg-lime-600 hover:bg-lime-700 text-white px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1 shadow-sm hover:shadow-md transition-all"
                disabled={loadingStok}
              >
                {loadingStok && <RotateCw size={14} className="animate-spin mr-1"/>} <PlusCircle size={14}/>Ekle
              </button>
            </div>
            {loadingStok && stokKategorileri.length === 0 && <p className="text-xs text-lime-600 py-2">Stok kategorileri yükleniyor...</p>}
            {!loadingStok && stokKategorileri.length === 0 && <p className="text-xs text-slate-500 py-2">Stok kategorisi bulunmuyor.</p>}
            <ul className="space-y-1.5 max-h-80 overflow-y-auto text-sm pr-1">
              {stokKategorileri.sort((a,b) => a.ad.localeCompare(b.ad)).map(kat => (
                <li key={kat.id} className="flex justify-between items-center p-1.5 bg-white rounded border border-lime-300/80 hover:shadow-sm transition-shadow">
                  <span className="text-lime-800 truncate pr-1" title={kat.ad}>{kat.ad}</span>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button onClick={() => openStokKategoriModal(kat)} className="text-blue-600 p-0.5 rounded hover:bg-blue-100" title="Düzenle" disabled={loadingStok}><Edit3 size={15}/></button>
                    <button onClick={() => openStokKategoriSilModal(kat)} disabled={loadingStok} className="text-red-600 p-0.5 rounded hover:bg-red-100 disabled:opacity-50" title="Sil"><Trash2 size={15}/></button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="md:col-span-2 p-4 border border-lime-200/70 rounded-lg">
            <div className="flex flex-wrap justify-between items-center mb-3 pb-2 border-b border-lime-200 gap-2">
              <h4 className="text-base font-medium text-lime-700 flex items-center gap-2"><Boxes size={18}/>Stok Kalemleri</h4>
              <button
                onClick={() => openStokKalemiModal()}
                disabled={stokKategorileri.length === 0 || loadingStok}
                title={stokKategorileri.length === 0 ? "Önce stok kategorisi ekleyin" : "Yeni Stok Kalemi"}
                className="bg-lime-600 hover:bg-lime-700 text-white px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1 shadow-sm hover:shadow-md transition-all disabled:bg-slate-400"
              >
                 {loadingStok && <RotateCw size={14} className="animate-spin mr-1"/>} <PlusCircle size={14}/>Yeni Kalem
              </button>
            </div>
            <div className="mb-3">
              <select
                id="stokKategoriFilter"
                value={selectedStokKategoriFilter}
                onChange={(e) => setSelectedStokKategoriFilter(e.target.value)}
                className="p-1.5 border border-slate-300 rounded-md text-xs focus:ring-1 focus:ring-lime-500 focus:border-lime-500 w-full sm:w-auto shadow-sm"
                disabled={loadingStok}
              >
                <option value="">Tüm Stok Kategorileri</option>
                {stokKategorileri.sort((a,b) => a.ad.localeCompare(b.ad)).map(kat => <option key={kat.id} value={kat.id}>{kat.ad}</option>)}
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
                      <th className="px-2 sm:px-3 py-2 text-right font-medium text-lime-800 tracking-wider">Alış F. (₺)</th>
                      <th className="px-2 sm:px-3 py-2 text-center font-medium text-lime-800 tracking-wider">İşlem</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-100">
                    {stokKalemleri.sort((a,b) => a.ad.localeCompare(b.ad)).map(item => {
                      const isLowStock = item.mevcut_miktar < item.min_stok_seviyesi && item.min_stok_seviyesi > 0;
                      return (
                        <tr key={item.id} className={`hover:bg-lime-50/60 transition-colors ${isLowStock ? 'bg-red-50 hover:bg-red-100' : ''}`}>
                            <td className={`px-2 sm:px-3 py-1.5 whitespace-nowrap font-medium ${isLowStock ? 'text-red-700' : 'text-slate-800'}`} title={item.ad}>{item.ad}</td>
                            <td className="px-2 sm:px-3 py-1.5 whitespace-nowrap text-slate-600" title={item.stok_kategori_ad}>{item.stok_kategori_ad || 'Bilinmiyor'}</td>
                            <td className="px-2 sm:px-3 py-1.5 whitespace-nowrap text-slate-600">{item.birim}</td>
                            <td className={`px-2 sm:px-3 py-1.5 whitespace-nowrap text-right font-semibold ${isLowStock ? 'text-red-600' : 'text-slate-700'}`}>{Number(item.mevcut_miktar).toFixed(2)}</td>
                            <td className="px-2 sm:px-3 py-1.5 whitespace-nowrap text-right text-slate-500">{Number(item.min_stok_seviyesi).toFixed(2)}</td>
                            <td className="px-2 sm:px-3 py-1.5 whitespace-nowrap text-right text-slate-500">{item.son_alis_fiyati ? `${Number(item.son_alis_fiyati).toFixed(2)}` : '-'}</td>
                            <td className="px-2 sm:px-3 py-1.5 whitespace-nowrap text-center">
                                <button onClick={() => openStokKalemiModal(item)} className="text-blue-600 p-0.5 rounded hover:bg-blue-100 mr-1" title="Düzenle" disabled={loadingStok}><Edit3 size={14}/></button>
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

      {/* YENİ EKLENEN: Reçete Yönetimi Bölümü */}
      <section className="bg-white p-5 sm:p-6 rounded-xl shadow-lg mb-6 md:mb-8">
        <div className="flex flex-wrap justify-between items-center mb-4 gap-2">
          <h3 className="text-xl font-semibold text-slate-700 flex items-center gap-3">
            <BookOpenText size={22} className="text-amber-600" /> Reçete Yönetimi
          </h3>
          <button
            onClick={() => openRecipeModal()}
            disabled={loadingRecipes || menuItemsForRecipe.length === 0 || stockItemsForRecipe.length === 0}
            title={menuItemsForRecipe.length === 0 || stockItemsForRecipe.length === 0 ? "Önce menü ve stok kalemleri yüklenmeli/eklenmeli" : "Yeni Reçete Ekle"}
            className="bg-amber-500 hover:bg-amber-600 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold transition shadow-sm active:scale-95 flex items-center gap-1.5 sm:gap-2 disabled:bg-slate-400"
          >
            {loadingRecipes && <RotateCw size={16} className="animate-spin mr-1"/>}
            <ClipboardPlus size={16} /> Yeni Reçete Ekle
          </button>
        </div>

        {loadingRecipes && menuUrunReceteleri.length === 0 && <p className="text-sm text-slate-500 py-2">Reçeteler yükleniyor...</p>}
        {!loadingRecipes && menuUrunReceteleri.length === 0 && <p className="text-sm text-slate-500 py-2">Henüz hiç ürün reçetesi eklenmemiş.</p>}

        {menuUrunReceteleri.length > 0 && (
          <div className="overflow-x-auto max-h-[500px] text-xs sm:text-sm">
            <table className="min-w-full divide-y divide-slate-200 border border-slate-200 rounded-md">
              <thead className="bg-amber-50 sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-2.5 text-left font-medium text-amber-700 uppercase tracking-wider">Menü Ürünü</th>
                  <th className="px-3 py-2.5 text-left font-medium text-amber-700 uppercase tracking-wider">Porsiyon</th>
                  <th className="px-3 py-2.5 text-left font-medium text-amber-700 uppercase tracking-wider">Bileşen Sayısı</th>
                  <th className="px-3 py-2.5 text-left font-medium text-amber-700 uppercase tracking-wider">Son Güncelleme</th>
                  <th className="px-3 py-2.5 text-center font-medium text-amber-700 uppercase tracking-wider">İşlemler</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {menuUrunReceteleri.sort((a,b) => (a.menu_urun_ad || "").localeCompare(b.menu_urun_ad || "")).map(recete => (
                  <tr key={recete.id} className="hover:bg-amber-50/40 transition-colors">
                    <td className="px-3 py-2 whitespace-nowrap font-medium text-slate-800" title={recete.menu_urun_ad || `ID: ${recete.menu_urun_id}`}>{recete.menu_urun_ad || `Menü Ürün ID: ${recete.menu_urun_id}`}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-slate-600">{`${recete.porsiyon_miktari} ${recete.porsiyon_birimi}`}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-slate-600">{recete.bilesenler?.length || 0}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-slate-500">{recete.guncellenme_tarihi ? new Date(recete.guncellenme_tarihi).toLocaleDateString("tr-TR") : "-"}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-center">
                      <button onClick={() => openRecipeModal(recete)} className="text-blue-600 p-0.5 rounded hover:bg-blue-100 mr-1.5" title="Düzenle" disabled={loadingRecipes}><Edit3 size={15}/></button>
                      <button onClick={() => openDeleteRecipeModal(recete)} disabled={loadingRecipes} className="text-red-600 p-0.5 rounded hover:bg-red-100 disabled:opacity-50" title="Sil"><Trash2 size={15}/></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {/* YENİ EKLENEN KISIM SONU */}

      <section className="bg-white p-5 sm:p-6 rounded-xl shadow-lg mb-6 md:mb-8">
        <div className="flex flex-wrap justify-between items-center mb-4 gap-2"> <h3 className="text-lg sm:text-xl font-semibold text-slate-700 flex items-center gap-2 sm:gap-3"> <Users className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600" /> Kullanıcı Yönetimi </h3> <button onClick={() => { setShowAddUserForm(prev => !prev); if(!showAddUserForm) { setYeniKullanici(initialYeniKullaniciState); setEditingUser(null); } }} className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold transition shadow-sm active:scale-95 flex items-center gap-1.5 sm:gap-2 ${ showAddUserForm ? "bg-orange-500 hover:bg-orange-600 text-white" : "bg-indigo-600 hover:bg-indigo-700 text-white" }`}> {showAddUserForm ? <><X size={16}/> Formu Kapat</> : <><UserPlus size={16}/> Yeni Kullanıcı</>} </button> </div>
        {showAddUserForm && ( <form onSubmit={yeniKullaniciEkle} className="mb-6 p-4 border border-slate-200 rounded-lg bg-slate-50/70 space-y-3 text-sm"> <h4 className="text-base font-medium text-slate-600 mb-2">Yeni Personel Kaydı</h4> <div> <label htmlFor="yeni_kullanici_adi_form" className="block text-xs font-medium text-slate-700">Kullanıcı Adı</label> <input type="text" name="kullanici_adi" id="yeni_kullanici_adi_form" value={yeniKullanici.kullanici_adi} onChange={handleYeniKullaniciChange} className="mt-1 block w-full p-2 border border-slate-300 rounded-md shadow-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500" required minLength="3"/> </div> <div> <label htmlFor="yeni_sifre_form" className="block text-xs font-medium text-slate-700">Şifre</label> <input type="password" name="sifre" id="yeni_sifre_form" value={yeniKullanici.sifre} onChange={handleYeniKullaniciChange} className="mt-1 block w-full p-2 border border-slate-300 rounded-md shadow-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500" required minLength="6"/> </div> <div> <label htmlFor="yeni_rol_form" className="block text-xs font-medium text-slate-700">Rol</label> <select name="rol" id="yeni_rol_form" value={yeniKullanici.rol} onChange={handleYeniKullaniciChange} className="mt-1 block w-full p-2 border border-slate-300 rounded-md shadow-sm bg-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"> {KULLANICI_ROLLER.map(rol => <option key={rol} value={rol}>{rol.charAt(0).toUpperCase() + rol.slice(1).replace("_personeli", " Personeli")}</option>)} </select> </div> <div className="flex items-center pt-1"> <input id="yeni_aktif_mi_form" name="aktif_mi" type="checkbox" checked={yeniKullanici.aktif_mi} onChange={handleYeniKullaniciChange} className="h-4 w-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"/> <label htmlFor="yeni_aktif_mi_form" className="ml-2 block text-xs text-slate-700">Aktif Kullanıcı</label> </div> <button type="submit" disabled={loadingUsers} className="w-full bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-md shadow-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"> {loadingUsers ? <RotateCw size={16} className="animate-spin" /> : <UserPlus size={16} /> } Kullanıcıyı Ekle </button> </form> )}
        <h4 className="text-base font-medium text-slate-600 mb-3 mt-4">Mevcut Kullanıcılar</h4> {loadingUsers && kullanicilar.length === 0 && <p className="text-sm text-slate-500 py-2">Kullanıcılar yükleniyor...</p>} {!loadingUsers && kullanicilar.length === 0 && <p className="text-sm text-slate-500 py-2">Kayıtlı kullanıcı yok.</p>} {kullanicilar.length > 0 && ( <div className="overflow-x-auto text-sm"> <table className="min-w-full divide-y divide-slate-200 border border-slate-200 rounded-md"> <thead className="bg-indigo-50"> <tr> <th className="px-3 py-2.5 text-left text-xs font-medium text-indigo-700 uppercase tracking-wider">ID</th> <th className="px-3 py-2.5 text-left text-xs font-medium text-indigo-700 uppercase tracking-wider">Kullanıcı Adı</th> <th className="px-3 py-2.5 text-left text-xs font-medium text-indigo-700 uppercase tracking-wider">Rol</th> <th className="px-3 py-2.5 text-left text-xs font-medium text-indigo-700 uppercase tracking-wider">Durum</th> <th className="px-3 py-2.5 text-center text-xs font-medium text-indigo-700 uppercase tracking-wider">İşlemler</th> </tr> </thead> <tbody className="bg-white divide-y divide-slate-100"> {kullanicilar.sort((a,b) => a.kullanici_adi.localeCompare(b.kullanici_adi)).map(k => ( <tr key={k.id} className="hover:bg-indigo-50/40 transition-colors"> <td className="px-3 py-2 whitespace-nowrap text-slate-600">{k.id}</td> <td className="px-3 py-2 whitespace-nowrap font-medium text-slate-800">{k.kullanici_adi}</td> <td className="px-3 py-2 whitespace-nowrap text-slate-600">{k.rol.charAt(0).toUpperCase() + k.rol.slice(1).replace("_personeli", " P.")}</td> <td className="px-3 py-2 whitespace-nowrap"> <span className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${ k.aktif_mi ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}> {k.aktif_mi ? 'Aktif' : 'Pasif'} </span> </td> <td className="px-3 py-2 whitespace-nowrap text-center"> <button onClick={() => openEditUserModal(k)} className="text-blue-600 p-0.5 rounded hover:bg-blue-100 mr-1.5" title="Düzenle" disabled={loadingUsers}><Edit3 size={15}/></button> <button onClick={() => openDeleteUserModal(k)} disabled={currentUser?.id === k.id || loadingUsers} className={`text-red-600 p-0.5 rounded hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed ${currentUser?.id === k.id ? 'opacity-40 cursor-not-allowed' : ''}`} title={currentUser?.id === k.id ? "Kendinizi silemezsiniz" : "Sil"}><Trash2 size={15}/></button> </td> </tr> ))} </tbody> </table> </div> )}
      </section>

      <section className="bg-white p-5 sm:p-6 rounded-xl shadow-lg">
        <h3 className="text-lg sm:text-xl font-semibold mb-4 text-slate-700 flex items-center gap-2 sm:gap-3">
            <CreditCardIcon className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600" /> Tüm Siparişler ({filtrelenmisSiparisler.length})
        </h3>
        <input type="text" placeholder="Siparişlerde ara (ID, masa, durum, ürün, tarih...)" value={arama} onChange={(e) => setArama(e.target.value)}
               className="w-full p-2.5 mb-4 border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-purple-400 focus:border-purple-500 transition text-sm"/>
        {loadingDashboardStats && filtrelenmisSiparisler.length === 0 && <p className="text-sm text-slate-500 py-2">Siparişler yükleniyor...</p>}
        {!loadingDashboardStats && filtrelenmisSiparisler.length === 0 && arama === "" && <p className="text-sm text-slate-500 py-2">Henüz hiç sipariş yok.</p>}
        {!loadingDashboardStats && filtrelenmisSiparisler.length === 0 && arama !== "" && <p className="text-sm text-slate-500 py-2">Aramanızla eşleşen sipariş bulunamadı.</p>}

        {filtrelenmisSiparisler.length > 0 && (
            <div className="overflow-x-auto max-h-[600px] text-xs sm:text-sm">
                <table className="min-w-full divide-y divide-slate-200 border border-slate-200 rounded-md">
                    <thead className="bg-purple-50 sticky top-0 z-10">
                        <tr>
                            {["ID", "Masa", "İstek/Sepet", "Durum", "Tarih", "Ödeme"].map(header => (
                                <th key={header} className="px-3 py-2.5 text-left font-medium text-purple-700 uppercase tracking-wider whitespace-nowrap">{header}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-100">
                        {filtrelenmisSiparisler.map(o => {
                            let sepetDetayi = "Sepet bilgisi yok veya hatalı.";
                            let toplamTutar = 0;
                            if (Array.isArray(o.sepet)) {
                                sepetDetayi = o.sepet.map(item => {
                                    const itemTutar = (item.adet || 0) * (item.fiyat || 0);
                                    toplamTutar += itemTutar;
                                    return `${item.adet}x ${item.urun} (${item.kategori || '?'}) - ${itemTutar.toFixed(2)} TL`;
                                }).join(", ");
                            } else if (typeof o.sepet === 'string' && o.sepet.trim() && o.sepet !== "[]") {
                                try {
                                    const parsed = JSON.parse(o.sepet);
                                    if (Array.isArray(parsed)) {
                                        sepetDetayi = parsed.map(item => {
                                            const itemTutar = (item.adet || 0) * (item.fiyat || 0);
                                            toplamTutar += itemTutar;
                                            return `${item.adet}x ${item.urun} (${item.kategori || '?'}) - ${itemTutar.toFixed(2)} TL`;
                                        }).join(", ");
                                    } else { sepetDetayi = "Sepet JSON formatı hatalı."; }
                                } catch (e) { sepetDetayi = "Sepet JSON parse hatası."; }
                            }

                            return (
                                <tr key={o.id} className="hover:bg-purple-50/40 transition-colors">
                                    <td className="px-3 py-2 whitespace-nowrap font-semibold text-purple-800">{o.id}</td>
                                    <td className="px-3 py-2 whitespace-nowrap text-slate-700">{o.masa}</td>
                                    <td className="px-3 py-2">
                                        <div className="max-w-xs truncate" title={sepetDetayi || o.istek}>{sepetDetayi || o.istek || "-"}</div>
                                        {o.yanit && <div className="text-xs text-slate-400 max-w-xs truncate" title={`AI Yanıtı: ${o.yanit}`}>AI: {o.yanit}</div>}
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap">
                                        <span className={`px-2 py-0.5 inline-flex text-[11px] leading-4 font-semibold rounded-full capitalize ${
                                            o.durum === "odendi" ? "bg-green-100 text-green-800" :
                                            o.durum === "iptal" ? "bg-red-100 text-red-800" :
                                            o.durum === "hazir" ? "bg-blue-100 text-blue-800" :
                                            o.durum === "hazirlaniyor" ? "bg-yellow-100 text-yellow-800" :
                                            "bg-slate-100 text-slate-800"
                                        }`}>{o.durum}</span>
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap text-slate-500">{o.zaman ? new Date(o.zaman).toLocaleString("tr-TR", {dateStyle:"short", timeStyle:"short"}) : "-"}</td>
                                    <td className="px-3 py-2 whitespace-nowrap text-slate-600">
                                        {o.odeme_yontemi || (o.durum === 'odendi' ? 'Bilinmiyor' : 'Ödenmedi')}
                                        {o.durum === 'odendi' && <span className="ml-1 font-bold text-green-700">({toplamTutar > 0 ? toplamTutar.toFixed(2) + " TL" : ""})</span>}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        )}
      </section>

      <div className="bg-white p-6 rounded-lg shadow-lg mt-8 text-center">
        <p className="text-xs text-gray-500">
          Neso Sipariş Asistanı Admin Paneli v1.4.0 &copy; {new Date().getFullYear()} Fıstık Kafe
        </p>
        <button
            onClick={async () => {
                if (!window.confirm("Tüm menü, fiyat ve stok önbelleklerini temizleyip sistem mesajını güncellemek istediğinize emin misiniz? Bu işlem biraz zaman alabilir.")) return;
                setLoadingDashboardStats(true);
                setError(null);
                try {
                    await apiClient.get("/admin/clear-menu-caches");
                    alert("Önbellekler temizlendi ve sistem mesajı güncellendi. Değişikliklerin yansıması için verileri yenileyin.");
                    refreshAllAdminData();
                } catch (err) {
                    handleApiError(err, "Önbellek temizlenemedi.", "Cache Temizleme");
                } finally {
                    setLoadingDashboardStats(false);
                }
            }}
            className="mt-2 bg-blue-500 hover:bg-blue-600 text-white text-xs px-3 py-1.5 rounded-md shadow-sm flex items-center gap-1.5 mx-auto"
            disabled={anyLoading}
        >
            <RotateCw size={14} className={anyLoading ? "animate-spin" : ""} />
            AI Önbelleğini ve Sistem Mesajını Yenile
        </button>
      </div>

      <Modal isOpen={showAddMenuItemModal} onClose={() => {setShowAddMenuItemModal(false); setYeniUrun(initialYeniUrunState);}} title="Yeni Menü Ürünü Ekle">
          <form onSubmit={urunEkle} className="space-y-3 text-sm">
              <div>
                  <label htmlFor="yeniUrunAd_modal" className="block text-xs font-medium text-slate-700">Ürün Adı</label>
                  <input type="text" name="ad" id="yeniUrunAd_modal" value={yeniUrun.ad} onChange={(e) => setYeniUrun({...yeniUrun, ad: e.target.value})}
                         className="mt-1 block w-full p-2 border border-slate-300 rounded-md shadow-sm focus:ring-1 focus:ring-teal-500 focus:border-teal-500" required />
              </div>
              <div>
                  <label htmlFor="yeniUrunFiyat_modal" className="block text-xs font-medium text-slate-700">Fiyat (₺)</label>
                  <input type="number" name="fiyat" id="yeniUrunFiyat_modal" value={yeniUrun.fiyat} onChange={(e) => setYeniUrun({...yeniUrun, fiyat: e.target.value})}
                         className="mt-1 block w-full p-2 border border-slate-300 rounded-md shadow-sm focus:ring-1 focus:ring-teal-500 focus:border-teal-500" required step="0.01" min="0.01"/>
              </div>
              <div>
                  <label htmlFor="yeniUrunKategori_modal" className="block text-xs font-medium text-slate-700">Kategori Adı</label>
                  <input type="text" name="kategori" id="yeniUrunKategori_modal" value={yeniUrun.kategori} onChange={(e) => setYeniUrun({...yeniUrun, kategori: e.target.value})}
                         className="mt-1 block w-full p-2 border border-slate-300 rounded-md shadow-sm focus:ring-1 focus:ring-teal-500 focus:border-teal-500" required placeholder="Mevcut kategori veya yeni kategori adı"/>
                   <p className="text-xs text-slate-500 mt-1">Var olan bir kategoriyi yazabilir veya yeni bir kategori adı girebilirsiniz. Yeni girilirse otomatik oluşacaktır.</p>
              </div>
              <div className="flex justify-end gap-2 pt-3">
                  <button type="button" onClick={() => {setShowAddMenuItemModal(false); setYeniUrun(initialYeniUrunState);}} className="px-3 py-1.5 text-xs bg-slate-200 hover:bg-slate-300 rounded-md font-medium">İptal</button>
                  <button type="submit" disabled={loadingMenu} className="px-3 py-1.5 text-xs bg-teal-600 hover:bg-teal-700 text-white rounded-md font-medium disabled:bg-slate-400 flex items-center gap-1">
                      {loadingMenu && <RotateCw size={14} className="animate-spin"/>} Ekle
                  </button>
              </div>
          </form>
      </Modal>

      <Modal isOpen={showEditUserModal} onClose={() => {setShowEditUserModal(false); setEditingUser(null);}} title="Kullanıcı Bilgilerini Düzenle">
          {editingUser && (
            <form onSubmit={guncelleKullanici} className="space-y-3 text-sm">
                <div>
                    <label htmlFor="edit_kullanici_adi_form_modal" className="block text-xs font-medium text-slate-700">Kullanıcı Adı</label>
                    <input type="text" name="kullanici_adi" id="edit_kullanici_adi_form_modal" value={editingUser.kullanici_adi} onChange={handleEditingUserChange}
                           className="mt-1 block w-full p-2 border border-slate-300 rounded-md shadow-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500" required minLength="3"/>
                </div>
                <div>
                    <label htmlFor="edit_sifre_form_modal" className="block text-xs font-medium text-slate-700">Yeni Şifre (Değişmeyecekse boş bırakın)</label>
                    <input type="password" name="sifre" id="edit_sifre_form_modal" value={editingUser.sifre || ""} onChange={handleEditingUserChange} placeholder="Yeni şifre (en az 6 karakter)"
                           className="mt-1 block w-full p-2 border border-slate-300 rounded-md shadow-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500" autoComplete="new-password"/>
                </div>
                <div>
                    <label htmlFor="edit_rol_form_modal" className="block text-xs font-medium text-slate-700">Rol</label>
                    <select name="rol" id="edit_rol_form_modal" value={editingUser.rol} onChange={handleEditingUserChange}
                            className="mt-1 block w-full p-2 border border-slate-300 rounded-md shadow-sm bg-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500">
                        {KULLANICI_ROLLER.map(rol => <option key={rol} value={rol}>{rol.charAt(0).toUpperCase() + rol.slice(1).replace("_personeli", " Personeli")}</option>)}
                    </select>
                </div>
                <div className="flex items-center pt-1">
                    <input id="edit_aktif_mi_form_modal" name="aktif_mi" type="checkbox" checked={editingUser.aktif_mi} onChange={handleEditingUserChange}
                           className="h-4 w-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"/>
                    <label htmlFor="edit_aktif_mi_form_modal" className="ml-2 block text-xs text-slate-700">Aktif Kullanıcı</label>
                </div>
                <div className="flex justify-end gap-2 pt-3">
                    <button type="button" onClick={() => {setShowEditUserModal(false); setEditingUser(null);}} className="px-3 py-1.5 text-xs bg-slate-200 hover:bg-slate-300 rounded-md font-medium">İptal</button>
                    <button type="submit" disabled={loadingUsers} className="px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-medium disabled:bg-slate-400 flex items-center gap-1">
                        {loadingUsers && <RotateCw size={14} className="animate-spin"/>} Kaydet
                    </button>
                </div>
            </form>
          )}
      </Modal>
      <Modal isOpen={showDeleteUserModal} onClose={() => {setShowDeleteUserModal(false); setUserToDelete(null);}} title="Kullanıcı Silme Onayı">
          {userToDelete && (
            <div className="text-sm">
                <p className="text-slate-600 mb-4">'{userToDelete.kullanici_adi}' adlı kullanıcıyı silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.</p>
                <div className="flex justify-end gap-2">
                    <button onClick={() => {setShowDeleteUserModal(false); setUserToDelete(null);}} className="px-3 py-1.5 text-xs bg-slate-200 hover:bg-slate-300 rounded-md font-medium">Vazgeç</button>
                    <button onClick={confirmDeleteUser} disabled={loadingUsers} className="px-3 py-1.5 text-xs bg-red-600 hover:bg-red-700 text-white rounded-md font-medium disabled:bg-slate-400 flex items-center gap-1">
                        {loadingUsers && <RotateCw size={14} className="animate-spin"/>} Sil
                    </button>
                </div>
            </div>
          )}
      </Modal>
      <Modal isOpen={showDeleteCategoryModal} onClose={() => {setShowDeleteCategoryModal(false); setCategoryToDelete(null);}} title="Menü Kategorisi Silme Onayı">
          {categoryToDelete && (
            <div className="text-sm">
                <p className="text-slate-700 mb-1"><strong className="text-red-600">UYARI:</strong> '{categoryToDelete.isim}' kategorisini silmek üzeresiniz.</p>
                <p className="text-slate-600 mb-4">Bu kategoriye ait <strong className="text-red-600">TÜM MENÜ ÜRÜNLERİ</strong> de kalıcı olarak silinecektir. Bu işlem geri alınamaz. Emin misiniz?</p>
                <div className="flex justify-end gap-2">
                    <button onClick={() => {setShowDeleteCategoryModal(false); setCategoryToDelete(null);}} className="px-3 py-1.5 text-xs bg-slate-200 hover:bg-slate-300 rounded-md font-medium">Vazgeç</button>
                    <button onClick={confirmDeleteMenuKategori} disabled={loadingMenu} className="px-3 py-1.5 text-xs bg-red-600 hover:bg-red-700 text-white rounded-md font-medium disabled:bg-slate-400 flex items-center gap-1">
                        {loadingMenu && <RotateCw size={14} className="animate-spin"/>} Evet, Sil
                    </button>
                </div>
            </div>
          )}
      </Modal>

      <Modal isOpen={showStokKategoriModal} onClose={() => {setShowStokKategoriModal(false); setEditingStokKategori(initialEditingStokKategori);}} title={editingStokKategori?.id ? "Stok Kategorisi Düzenle" : "Yeni Stok Kategorisi Ekle"}>
          {editingStokKategori && (
            <form onSubmit={handleStokKategoriFormSubmit} className="space-y-3 text-sm">
                <div>
                    <label htmlFor="stok_kat_ad_modal" className="block text-xs font-medium text-slate-700 mb-0.5">Kategori Adı</label>
                    <input type="text" id="stok_kat_ad_modal" placeholder="Kategori Adı" value={editingStokKategori.ad || ""}
                           onChange={(e) => setEditingStokKategori({...editingStokKategori, ad: e.target.value})}
                           className="w-full p-2 border border-slate-300 rounded-md focus:ring-1 focus:ring-lime-500 focus:border-lime-500" required />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                    <button type="button" onClick={() => {setShowStokKategoriModal(false); setEditingStokKategori(initialEditingStokKategori);}} className="px-3 py-1.5 text-xs bg-slate-200 hover:bg-slate-300 rounded-md font-medium">İptal</button>
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

      <Modal isOpen={showStokKalemiModal} onClose={() => {setShowStokKalemiModal(false); setEditingStokKalemi(initialEditingStokKalemi);}} title={editingStokKalemi?.id ? "Stok Kalemi Düzenle" : "Yeni Stok Kalemi Ekle"} size="max-w-xl">
          {editingStokKalemi && (
            <form onSubmit={handleStokKalemiFormSubmit} className="space-y-3 text-sm">
                <div>
                    <label htmlFor="stok_kalem_ad_form_modal" className="block text-xs font-medium text-slate-700 mb-0.5">Kalem Adı</label>
                    <input type="text" name="ad" id="stok_kalem_ad_form_modal" placeholder="Kalem Adı" value={editingStokKalemi.ad || ""} onChange={handleStokKalemiFormChange} className="w-full p-2 border border-slate-300 rounded-md" required />
                </div>
                <div>
                    <label htmlFor="stok_kalem_kat_form_modal" className="block text-xs font-medium text-slate-700 mb-0.5">Kategori</label>
                    <select name="stok_kategori_id" id="stok_kalem_kat_form_modal" value={editingStokKalemi.stok_kategori_id || ""} onChange={handleStokKalemiFormChange} className="w-full p-2 border border-slate-300 rounded-md bg-white" required>
                        <option value="">Kategori Seçin...</option>
                        {stokKategorileri.sort((a,b) => a.ad.localeCompare(b.ad)).map(kat => <option key={kat.id} value={kat.id}>{kat.ad}</option>)}
                    </select>
                </div>
                <div>
                    <label htmlFor="stok_kalem_birim_form_modal" className="block text-xs font-medium text-slate-700 mb-0.5">Birim</label>
                    <input type="text" name="birim" id="stok_kalem_birim_form_modal" placeholder="Birim (örn: kg, lt, adet)" value={editingStokKalemi.birim || ""} onChange={handleStokKalemiFormChange} className="w-full p-2 border border-slate-300 rounded-md" required />
                </div>
                {!editingStokKalemi.id && (
                    <>
                        <div>
                            <label htmlFor="stok_kalem_mevcut_form_modal" className="block text-xs font-medium text-slate-700 mb-0.5">Mevcut Miktar (Opsiyonel)</label>
                            <input type="number" name="mevcut_miktar" id="stok_kalem_mevcut_form_modal" placeholder="Mevcut Miktar" value={editingStokKalemi.mevcut_miktar || 0} onChange={handleStokKalemiFormChange} className="w-full p-2 border border-slate-300 rounded-md" step="any" min="0" />
                        </div>
                        <div>
                            <label htmlFor="stok_kalem_alis_form_modal" className="block text-xs font-medium text-slate-700 mb-0.5">Son Alış Fiyatı (₺ - Opsiyonel)</label>
                            <input type="number" name="son_alis_fiyati" id="stok_kalem_alis_form_modal" placeholder="Son Alış Fiyatı" value={editingStokKalemi.son_alis_fiyati || ""} onChange={handleStokKalemiFormChange} className="w-full p-2 border border-slate-300 rounded-md" step="any" min="0" />
                        </div>
                    </>
                )}
                 <div>
                    <label htmlFor="stok_kalem_min_form_modal" className="block text-xs font-medium text-slate-700 mb-0.5">Minimum Stok Seviyesi</label>
                    <input type="number" name="min_stok_seviyesi" id="stok_kalem_min_form_modal" placeholder="Minimum Stok Seviyesi" value={editingStokKalemi.min_stok_seviyesi || 0} onChange={handleStokKalemiFormChange} className="w-full p-2 border border-slate-300 rounded-md" step="any" min="0" />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                    <button type="button" onClick={() => {setShowStokKalemiModal(false); setEditingStokKalemi(initialEditingStokKalemi);}} className="px-3 py-1.5 text-xs bg-slate-200 hover:bg-slate-300 rounded-md font-medium">İptal</button>
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
      {/* YENİ EKLENEN: Reçete Modalı */}
      <Modal isOpen={showRecipeModal} onClose={() => {setShowRecipeModal(false); setEditingRecipe(initialEditingRecipeState);}} title={editingRecipe?.id ? "Reçete Düzenle" : "Yeni Reçete Ekle"} size="max-w-3xl">
        {editingRecipe && (
          <form onSubmit={handleSaveRecipe} className="space-y-4 text-sm">
            <div>
              <label htmlFor="recipe_menu_urun_id" className="block text-xs font-medium text-slate-700 mb-0.5">Menü Ürünü (*)</label>
              <select
                name="menu_urun_id"
                id="recipe_menu_urun_id"
                value={editingRecipe.menu_urun_id}
                onChange={handleRecipeFormChange}
                className="w-full p-2 border border-slate-300 rounded-md bg-white"
                required
                disabled={!!editingRecipe.id || loadingRecipes || menuItemsForRecipe.length === 0}
              >
                <option value="">Menü Ürünü Seçin...</option>
                {menuItemsForRecipe.sort((a,b) => a.ad.localeCompare(b.ad)).map(item => (
                  <option key={item.id} value={item.id} title={item.ad + (item.kategori_ad ? ` (${item.kategori_ad})` : '')}>
                    {item.ad} {item.kategori_ad ? `(${item.kategori_ad})` : ''}
                  </option>
                ))}
              </select>
              {editingRecipe.id && <p className="text-xs text-slate-500 mt-1">Reçete düzenlenirken ait olduğu menü ürünü değiştirilemez.</p>}
              {menuItemsForRecipe.length === 0 && !loadingMenu && <p className="text-xs text-red-500 mt-1">Reçete eklenecek menü ürünü bulunamadı/yüklenemedi. Lütfen önce menüye ürün ekleyin.</p>}
            </div>

            <div>
              <label htmlFor="recipe_aciklama" className="block text-xs font-medium text-slate-700 mb-0.5">Açıklama / Hazırlama Notları</label>
              <textarea
                name="aciklama"
                id="recipe_aciklama"
                value={editingRecipe.aciklama || ""}
                onChange={handleRecipeFormChange}
                placeholder="Örn: Malzemeler karıştırılır ve 180 derecede 20 dakika pişirilir."
                rows="3"
                className="w-full p-2 border border-slate-300 rounded-md"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="recipe_porsiyon_miktari" className="block text-xs font-medium text-slate-700 mb-0.5">Porsiyon Miktarı (*)</label>
                <input type="number" name="porsiyon_miktari" id="recipe_porsiyon_miktari" placeholder="1" value={editingRecipe.porsiyon_miktari} onChange={handleRecipeFormChange} className="w-full p-2 border border-slate-300 rounded-md" required step="any" min="0.01"/>
              </div>
              <div>
                <label htmlFor="recipe_porsiyon_birimi" className="block text-xs font-medium text-slate-700 mb-0.5">Porsiyon Birimi (*)</label>
                <input type="text" name="porsiyon_birimi" id="recipe_porsiyon_birimi" placeholder="adet" value={editingRecipe.porsiyon_birimi} onChange={handleRecipeFormChange} className="w-full p-2 border border-slate-300 rounded-md" required />
              </div>
            </div>

            <div className="pt-2">
              <h5 className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-1.5">
                <ListOrdered size={16} className="text-amber-700"/>Reçete Bileşenleri (*)
              </h5>
              {editingRecipe.bilesenler.length === 0 && (
                <p className="text-xs text-slate-500 text-center py-2 border border-dashed border-slate-300 rounded-md">
                  Henüz bileşen eklenmedi. Lütfen aşağıdaki butonu kullanarak ekleyin.
                </p>
              )}
              {editingRecipe.bilesenler.map((bilesen, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-end mb-2 p-2 border border-slate-200 rounded-md bg-slate-50/50">
                  <div className="col-span-5">
                    <label htmlFor={`bilesen_stok_id_${index}`} className="block text-[11px] font-medium text-slate-600 mb-0.5">Stok Kalemi</label>
                    <select
                      id={`bilesen_stok_id_${index}`}
                      value={bilesen.stok_kalemi_id}
                      onChange={(e) => handleRecipeBilesenChange(index, "stok_kalemi_id", e.target.value)}
                      className="w-full p-1.5 text-xs border border-slate-300 rounded-md bg-white"
                      required
                      disabled={stockItemsForRecipe.length === 0}
                    >
                      <option value="">Seçin...</option>
                      {stockItemsForRecipe.sort((a,b) => a.ad.localeCompare(b.ad)).map(item => (
                        <option key={item.id} value={item.id} title={`${item.ad} (Ana Birim: ${item.birim})`}>{item.ad}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-3">
                    <label htmlFor={`bilesen_miktar_${index}`} className="block text-[11px] font-medium text-slate-600 mb-0.5">Miktar</label>
                    <input type="number" id={`bilesen_miktar_${index}`} value={bilesen.miktar} onChange={(e) => handleRecipeBilesenChange(index, "miktar", e.target.value)} className="w-full p-1.5 text-xs border border-slate-300 rounded-md" required step="any" min="0.001"/>
                  </div>
                  <div className="col-span-3">
                    <label htmlFor={`bilesen_birim_${index}`} className="block text-[11px] font-medium text-slate-600 mb-0.5">Birim</label>
                    <input type="text" id={`bilesen_birim_${index}`} value={bilesen.birim} onChange={(e) => handleRecipeBilesenChange(index, "birim", e.target.value)} placeholder={stockItemsForRecipe.find(s => s.id === parseInt(bilesen.stok_kalemi_id))?.birim || "örn: gr, ml, adet"} className="w-full p-1.5 text-xs border border-slate-300 rounded-md" required />
                  </div>
                  <div className="col-span-1 flex items-center justify-center">
                    <button type="button" onClick={() => removeRecipeBilesen(index)} className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-100 rounded-md" title="Bileşeni Sil">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={addRecipeBilesen}
                disabled={stockItemsForRecipe.length === 0}
                className="mt-2 text-xs bg-sky-500 hover:bg-sky-600 text-white px-2.5 py-1.5 rounded-md font-medium flex items-center gap-1 disabled:bg-slate-400"
                title={stockItemsForRecipe.length === 0 ? "Önce stok kalemi ekleyin veya yüklenmesini bekleyin" : ""}
              >
                <ListPlus size={14}/> Bileşen Ekle
              </button>
              {stockItemsForRecipe.length === 0 && !loadingStok && <p className="text-xs text-red-500 mt-1">Bileşen eklenecek stok kalemi bulunamadı/yüklenemedi. Lütfen önce stok kalemi ekleyin.</p>}
            </div>

            <div className="flex justify-end gap-2 pt-3">
                <button type="button" onClick={() => {setShowRecipeModal(false); setEditingRecipe(initialEditingRecipeState);}} className="px-3 py-1.5 text-xs bg-slate-200 hover:bg-slate-300 rounded-md font-medium">İptal</button>
                <button type="submit" disabled={loadingRecipes} className="px-3 py-1.5 text-xs bg-amber-500 hover:bg-amber-600 text-white rounded-md font-medium disabled:bg-slate-400 flex items-center gap-1">
                    {loadingRecipes && <RotateCw size={14} className="animate-spin"/>}
                    {editingRecipe.id ? "Reçeteyi Güncelle" : "Reçeteyi Kaydet"}
                </button>
            </div>
          </form>
        )}
      </Modal>
      <Modal isOpen={!!recipeToDelete} onClose={() => setRecipeToDelete(null)} title="Reçete Silme Onayı">
          {recipeToDelete && (
            <div className="text-sm">
                <p className="text-slate-600 mb-3">'{recipeToDelete.menu_urun_ad || `ID: ${recipeToDelete.menu_urun_id}`}' ürününün reçetesini silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.</p>
                <div className="flex justify-end gap-2">
                    <button onClick={() => setRecipeToDelete(null)} className="px-3 py-1.5 text-xs bg-slate-200 hover:bg-slate-300 rounded-md font-medium">Vazgeç</button>
                    <button onClick={confirmDeleteRecipe} disabled={loadingRecipes} className="px-3 py-1.5 text-xs bg-red-600 hover:bg-red-700 text-white rounded-md font-medium disabled:bg-slate-400 flex items-center gap-1">
                        {loadingRecipes && <RotateCw size={14} className="animate-spin"/>}
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