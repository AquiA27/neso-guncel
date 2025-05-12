import React, { useState, useEffect, useRef, useCallback } from "react";
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
  TrendingUp,
  Settings,
  LogOut,
  AlertCircle,
  MenuSquare,
  Trash2,
  PlusCircle,
  RotateCw,
} from "lucide-react";
import axios from "axios";

const API_BASE = process.env.REACT_APP_API_BASE || "";
const ADMIN_USERNAME = process.env.REACT_APP_ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.REACT_APP_ADMIN_PASSWORD || "admin123";

function AdminPaneli() {
  const [orders, setOrders] = useState([]);
  const [arama, setArama] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(
    () =>
      typeof window !== "undefined" &&
      localStorage.getItem("adminGiris") === "true"
  );
  const [gunluk, setGunluk] = useState({
    siparis_sayisi: 0,
    gelir: 0,
    satilan_urun_adedi: 0,
  });
  const [aylik, setAylik] = useState({
    siparis_sayisi: 0,
    gelir: 0,
    satilan_urun_adedi: 0,
  });
  const [yillikChartData, setYillikChartData] = useState([]);
  const [populer, setPopuler] = useState([]);
  const [aktifMasaSayisi, setAktifMasaSayisi] = useState(0);
  const [menu, setMenu] = useState([]);
  const [yeniUrun, setYeniUrun] = useState({
    ad: "",
    fiyat: "",
    kategori: "",
  });
  const [silUrunAdi, setSilUrunAdi] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(() => isLoggedIn);
  const [loginCredentials, setLoginCredentials] = useState({
    username: "",
    password: "",
  });
  const wsRef = useRef(null);

  const logInfo = useCallback((message) => console.log(`[Admin Paneli] INFO: ${message}`), []);
  const logError = useCallback(
    (message, error) => console.error(`[Admin Paneli] ERROR: ${message}`, error || ""),
    []
  );
  const logWarn = useCallback((message) => console.warn(`[Admin Paneli] WARN: ${message}`), []);

  useEffect(() => {
    document.title = "Admin Paneli - Neso";
  }, []);

  const verileriGetir = useCallback(async (isRetry = false, customAuthHeader = null) => {
    if (!isLoggedIn && !isRetry && !customAuthHeader) {
      logWarn("Giriş yapılmamış, veri çekme atlanıyor.");
      setLoading(false);
      return;
    }

    logInfo(`🔄 Veriler getiriliyor... (Retry: ${isRetry})`);
    setLoading(true);
    setError(null);

    if (!API_BASE) {
      logError("API_BASE tanımlı değil.");
      setError("API adresi yapılandırılmamış. Lütfen yöneticiyle iletişime geçin.");
      setLoading(false);
      return;
    }

    try {
      const headers =
        customAuthHeader ||
        { Authorization: "Basic " + btoa(`${ADMIN_USERNAME}:${ADMIN_PASSWORD}`) };

      const [
        siparisRes,
        gunlukRes,
        aylikRes,
        yillikRes,
        populerRes,
        aktifMasalarRes,
        menuRes,
      ] = await Promise.all([
        axios.get(`${API_BASE}/siparisler`, { headers }),
        axios.get(`${API_BASE}/istatistik/gunluk`, { headers }),
        axios.get(`${API_BASE}/istatistik/aylik`, { headers }),
        axios.get(`${API_BASE}/istatistik/yillik-aylik-kirilim`, { headers }),
        axios.get(`${API_BASE}/istatistik/en-cok-satilan`, { headers }),
        axios.get(`${API_BASE}/aktif-masalar`, { headers }), // backend'de count dönüyor
        axios.get(`${API_BASE}/menu`, { headers }),
      ]);

      if (typeof window !== "undefined") {
        localStorage.setItem("adminGiris", "true");
      }
      if (!isLoggedIn && (siparisRes.status === 200 || isRetry)) {
        setIsLoggedIn(true);
      }

      setOrders(siparisRes?.data?.orders || []);
      setGunluk(
        gunlukRes?.data || { siparis_sayisi: 0, gelir: 0, satilan_urun_adedi: 0 }
      );
      setAylik(
        aylikRes?.data || { siparis_sayisi: 0, gelir: 0, satilan_urun_adedi: 0 }
      );
      setPopuler(populerRes?.data || []);
      // Burada artık .count alanını kullanıyoruz
      setAktifMasaSayisi(aktifMasalarRes?.data?.count || 0);

      // Yıllık chart data işleme
      const yillikHamVeri = yillikRes?.data?.aylik_kirilim || {};
      const formatlanmisYillikVeri = Object.entries(yillikHamVeri)
        .map(([tarih, veri]) => ({
          tarih,
          adet: Number(veri?.satilan_urun_adedi) || 0,
        }))
        .sort((a, b) => a.tarih.localeCompare(b.tarih));
      setYillikChartData(formatlanmisYillikVeri);

      setMenu(menuRes?.data?.menu || []);
      logInfo("✅ Veriler başarıyla getirildi.");
    } catch (err) {
      logError("❌ Veriler alınamadı:", err);
      const errorDetail =
        err.response?.data?.detail || err.message || "Bilinmeyen bir hata oluştu.";
      if (err.response?.status === 401) {
        setError("Geçersiz kullanıcı adı veya şifre. Lütfen tekrar deneyin.");
        if (typeof window !== "undefined") {
          localStorage.removeItem("adminGiris");
        }
        setIsLoggedIn(false);
      } else {
        setError(
          `Veriler alınamadı: ${errorDetail} (URL: ${err.config?.url || "Bilinmiyor"})`
        );
      }
    } finally {
      setLoading(false);
    }
  }, [isLoggedIn, logInfo, logError, logWarn]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const authHeader = {
      Authorization: "Basic " + btoa(`${loginCredentials.username}:${loginCredentials.password}`),
    };
    if (!API_BASE) {
      logError("API_BASE tanımlı değil, giriş yapılamıyor.");
      setError("API adresi yapılandırılmamış.");
      setLoading(false);
      return;
    }
    await verileriGetir(true, authHeader);
    setLoginCredentials({ username: "", password: "" });
  };

  useEffect(() => {
    if (!isLoggedIn) {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        logInfo("Çıkış yapıldı, WebSocket bağlantısı kapatılıyor.");
        wsRef.current.close(1000, "User logged out");
        wsRef.current = null;
      }
      return;
    }

    let reconnectTimeoutId = null;
    const connectWebSocket = () => {
      if (
        wsRef.current &&
        (wsRef.current.readyState === WebSocket.OPEN ||
          wsRef.current.readyState === WebSocket.CONNECTING)
      ) {
        logInfo("Admin WebSocket zaten açık veya bağlanıyor.");
        return;
      }
      if (!API_BASE) {
        logError("API_BASE tanımlı değil, WS kurulamıyor.");
        setError("Sunucu bağlantısı kurulamıyor.");
        return;
      }

      try {
        const wsProtocol = API_BASE.startsWith("https") ? "wss:" : "ws:";
        const wsHost = API_BASE.replace(/^https?:\/\//, "");
        const wsUrl = `${wsProtocol}//${wsHost}/ws/admin`;
        logInfo(`📡 Admin WebSocket bağlantısı deneniyor: ${wsUrl}`);
        wsRef.current = new WebSocket(wsUrl);

        wsRef.current.onopen = () => {
          logInfo("✅ Admin WebSocket bağlantısı başarılı.");
          if (reconnectTimeoutId) {
            clearTimeout(reconnectTimeoutId);
            reconnectTimeoutId = null;
          }
        };

        wsRef.current.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            logInfo(`📥 Admin WS mesajı alındı: Tip: ${message.type}`);
            if (
              ["siparis", "durum", "masa_durum", "menu_guncellendi"].includes(
                message.type
              )
            ) {
              logInfo(`⚡ WS: ${message.type} alındı, veriler yenileniyor...`);
              verileriGetir(true);
            }
          } catch (err) {
            logError("Admin WS mesaj işleme hatası:", err);
          }
        };

        wsRef.current.onerror = (errorEvent) => {
          logError("❌ Admin WebSocket hatası:", errorEvent);
        };

        wsRef.current.onclose = (event) => {
          logInfo(
            `🔌 Admin WebSocket bağlantısı kapandı. Kod: ${event.code}, Sebep: ${
              event.reason || "Yok"
            }`
          );
          wsRef.current = null;
          const stillLoggedIn =
            typeof window !== "undefined" &&
            localStorage.getItem("adminGiris") === "true";
          if (
            stillLoggedIn &&
            event.code !== 1000 &&
            event.code !== 1001 &&
            !event.wasClean
          ) {
            logInfo("Admin WS beklenmedik şekilde kapandı, 3sn sonra tekrar denenecek...");
            reconnectTimeoutId = setTimeout(connectWebSocket, 3000 + Math.random() * 1000);
          }
        };
      } catch (error) {
        logError("❌ Admin WebSocket başlatılırken hata:", error);
        setError("Sunucu bağlantısı (WebSocket) kurulamıyor.");
      }
    };

    const pingIntervalId = setInterval(() => {
      const stillLoggedIn =
        typeof window !== "undefined" &&
        localStorage.getItem("adminGiris") === "true";
      if (stillLoggedIn && wsRef.current?.readyState === WebSocket.OPEN) {
        try {
          wsRef.current.send(JSON.stringify({ type: "ping" }));
        } catch (err) {
          logError("Admin Ping gönderilemedi:", err);
          if (wsRef.current) wsRef.current.close(1006, "Ping failed, closing connection");
        }
      }
    }, 30000);

    if (isLoggedIn) {
      connectWebSocket();
    }

    return () => {
      clearInterval(pingIntervalId);
      if (reconnectTimeoutId) clearTimeout(reconnectTimeoutId);
      if (wsRef.current) {
        logInfo("Admin Paneli: Component kaldırılıyor, WebSocket kapatılıyor.");
        wsRef.current.close(1000, "Component unmounting");
        wsRef.current = null;
      }
    };
  }, [isLoggedIn, logInfo, logError, logWarn, verileriGetir]);

  useEffect(() => {
    const initialLoggedIn =
      typeof window !== "undefined" &&
      localStorage.getItem("adminGiris") === "true";
    if (initialLoggedIn) {
      logInfo("İlk yükleme: Giriş yapılmış, veriler çekiliyor...");
      verileriGetir();
    } else {
      logInfo("İlk yükleme: Giriş yapılmamış.");
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const urunEkle = useCallback(async () => {
    if (!yeniUrun.ad || !yeniUrun.fiyat || !yeniUrun.kategori) {
      alert("Lütfen ürün adı, fiyatı ve kategorisini girin.");
      return;
    }
    const fiyatNum = parseFloat(yeniUrun.fiyat);
    if (isNaN(fiyatNum) || fiyatNum < 0) {
      alert("Lütfen geçerli bir fiyat girin.");
      return;
    }

    logInfo(`➕ Ürün ekleniyor: ${JSON.stringify({ ...yeniUrun, fiyat: fiyatNum })}`);
    setLoading(true);
    setError(null);
    if (!API_BASE) {
      logError("API_BASE tanımlı değil, ürün eklenemiyor.");
      setError("API adresi yapılandırılmamış.");
      setLoading(false);
      return;
    }
    try {
      await axios.post(
        `${API_BASE}/menu/ekle`,
        { ...yeniUrun, fiyat: fiyatNum },
        {
          headers: {
            Authorization:
              "Basic " + btoa(`${ADMIN_USERNAME}:${ADMIN_PASSWORD}`),
            "Content-Type": "application/json",
          },
        }
      );
      logInfo("✅ Ürün başarıyla eklendi.");
      setYeniUrun({ ad: "", fiyat: "", kategori: "" });
      await verileriGetir(true);
      alert("Ürün başarıyla eklendi.");
    } catch (err) {
      logError("❌ Ürün eklenemedi:", err);
      const errorDetail =
        err.response?.data?.detail || err.message || "Bilinmeyen bir hata.";
      setError(`Ürün eklenirken hata: ${errorDetail}`);
      alert(`Ürün eklenemedi: ${errorDetail}`);
    } finally {
      setLoading(false);
    }
  }, [yeniUrun, verileriGetir, logInfo, logError]);

  const urunSil = useCallback(async () => {
    if (!silUrunAdi) {
      alert("Lütfen silinecek ürünün adını girin.");
      return;
    }
    const urunAdiTrimmed = silUrunAdi.trim();
    if (!urunAdiTrimmed) {
      alert("Lütfen silinecek ürünün adını girin.");
      return;
    }
    const urunAdiTrimmedLower = urunAdiTrimmed.toLowerCase();

    const urunVarMi = menu?.some((kategori) =>
      kategori?.urunler?.some(
        (urun) => urun?.ad?.trim().toLowerCase() === urunAdiTrimmedLower
      )
    );
    if (!urunVarMi) {
      alert(`'${urunAdiTrimmed}' adında bir ürün menüde bulunamadı.`);
      return;
    }

    if (!window.confirm(`'${urunAdiTrimmed}' adlı ürünü silmek istediğinize emin misiniz?`)) {
      return;
    }

    logInfo(`➖ Ürün siliniyor: ${urunAdiTrimmed}`);
    setLoading(true);
    setError(null);
    if (!API_BASE) {
      logError("API_BASE tanımlı değil, ürün silinemiyor.");
      setError("API adresi yapılandırılmamış.");
      setLoading(false);
      return;
    }
    try {
      await axios.delete(`${API_BASE}/menu/sil`, {
        params: { urun_adi: urunAdiTrimmed },
        headers: {
          Authorization:
            "Basic " + btoa(`${ADMIN_USERNAME}:${ADMIN_PASSWORD}`),
        },
      });
      logInfo("🗑️ Ürün başarıyla silindi.");
      setSilUrunAdi("");
      await verileriGetir(true);
      alert("Ürün başarıyla silindi.");
    } catch (err) {
      logError("❌ Ürün silinemedi:", err);
      const errorDetail =
        err.response?.data?.detail || err.message || "Bilinmeyen bir hata.";
      setError(`Ürün silinirken hata: ${errorDetail}`);
      alert(`Ürün silinemedi: ${errorDetail}`);
    } finally {
      setLoading(false);
    }
  }, [silUrunAdi, menu, verileriGetir, logInfo, logError]);

  const cikisYap = () => {
    logInfo("🚪 Çıkış yapılıyor...");
    if (typeof window !== "undefined") {
      localStorage.removeItem("adminGiris");
    }
    setIsLoggedIn(false);
    setError(null);
    setOrders([]);
    setMenu([]);
    setGunluk({ siparis_sayisi: 0, gelir: 0, satilan_urun_adedi: 0 });
    setAylik({ siparis_sayisi: 0, gelir: 0, satilan_urun_adedi: 0 });
    setYillikChartData([]);
    setPopuler([]);
    setAktifMasaSayisi(0);
  };

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
    } else if (typeof o.sepet === "string" && o.sepet.trim()) {
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
        ? new Date(o.zaman).toLocaleString("tr-TR")
        : "",
    ]
      .join(" ")
      .toLowerCase();
    return aranacakMetin.includes(aramaLower);
  });

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-100 to-orange-100 p-4">
        <div className="bg-white shadow-xl p-8 rounded-lg text-center border border-red-300 max-w-md w-full">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-4 text-red-700">Admin Girişi</h2>
          {loading ? (
            <p className="text-gray-600 mb-4 animate-pulse">Giriş deneniyor...</p>
          ) : (
            <>
              <p className="text-gray-600 mb-4">
                {error || "Lütfen admin kullanıcı adı ve şifrenizi girin."}
              </p>
              <form onSubmit={handleLogin} className="space-y-4">
                <input
                  type="text"
                  placeholder="Kullanıcı Adı"
                  value={loginCredentials.username}
                  onChange={(e) =>
                    setLoginCredentials({
                      ...loginCredentials,
                      username: e.target.value,
                    })
                  }
                  className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                  required
                />
                <input
                  type="password"
                  placeholder="Şifre"
                  value={loginCredentials.password}
                  onChange={(e) =>
                    setLoginCredentials({
                      ...loginCredentials,
                      password: e.target.value,
                    })
                  }
                  className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                  required
                />
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-md flex items-center justify-center gap-2 transition duration-200 ease-in-out active:scale-95 mx-auto"
                  disabled={loading}
                >
                  <RotateCw
                    className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
                  />
                  {loading ? "Giriş Yapılıyor..." : "Giriş Yap"}
                </button>
              </form>
            </>
          )}
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
            onClick={() => verileriGetir(true)}
            className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-semibold transition duration-200 ease-in-out ml-4"
            disabled={loading}
          >
            {loading ? "Yükleniyor..." : "Tekrar Dene"}
          </button>
        </div>
      )}

      {loading && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500"></div>
          <p className="text-white text-lg ml-4">Yükleniyor...</p>
        </div>
      )}

      <div className="flex flex-wrap justify-between items-center mb-8 gap-4">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-800 flex items-center gap-3">
          <Settings className="w-8 h-8 text-blue-600" /> Admin Paneli (
          {ADMIN_USERNAME})
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
            ₺ Günlük Gelir
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
            <UserCheck className="w-5 h-5 text-purple-500" /> Aktif Masalar
          </h3>
          <CountUp
            end={aktifMasaSayisi || 0}
            separator="."
            className="text-3xl font-bold text-purple-700 block"
          />
        </div>
        <div className="bg-white p-5 rounded-lg shadow-lg border-t-4 border-orange-500 hover:shadow-xl transition-shadow">
          <h3 className="text-base font-semibold mb-2 flex items-center gap-2 text-gray-600">
            🏆 En Çok Satan
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
            <p className="text-gray-500 text-sm">Veri yok</p>
          )}
        </div>
      </div>

      {/* Grafikler */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-lg">
          <h3 className="text-lg font-semibold mb-4 text-gray-700">
            📈 Aylık Satılan Ürün Adedi (Yıllık Kırılım)
          </h3>
          <div className="h-64">
            {yillikChartData?.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={yillikChartData}
                  margin={{ top: 5, right: 25, left: -10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis
                    dataKey="tarih"
                    fontSize={12}
                    tickFormatter={(value) => value.substring(5)}
                  />
                  <YAxis fontSize={12} allowDecimals={false} />
                  <Tooltip
                    formatter={(value, name, props) => [
                      `${value} Adet`,
                      `Dönem: ${props.payload.tarih}`,
                    ]}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="adet"
                    name="Aylık Ürün Adedi"
                    stroke="#4F46E5"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                Yıllık veri bulunamadı veya yükleniyor...
              </div>
            )}
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-lg">
          <h3 className="text-lg font-semibold mb-4 text-gray-700">
            📊 En Çok Satan 5 Ürün (Adet)
          </h3>
          <div className="h-64">
            {populer?.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={populer.slice(0, 5)}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 50, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis type="number" fontSize={12} allowDecimals={false} />
                  <YAxis
                    dataKey="urun"
                    type="category"
                    fontSize={12}
                    width={120}
                    tick={{ textAnchor: "end", width: 115, fontSize: "11px" }}
                    interval={0}
                  />
                  <Tooltip formatter={(value) => [`${value} Adet`, "Satış Adedi"]} />
                  <Bar dataKey="adet" name="Satış Adedi" fill="#FB923C" barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                Popüler ürün verisi bulunamadı veya yükleniyor...
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
          {/* Yeni Ürün Ekle Formu */}
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
                  />
                  <button
                    type="submit"
                    disabled={
                      loading || !yeniUrun.ad || !yeniUrun.fiyat || !yeniUrun.kategori
                    }
                    className={`w-full text-white py-2 rounded shadow transition duration-200 ease-in-out active:scale-95 flex items-center justify-center gap-2 ${
                      loading || !yeniUrun.ad || !yeniUrun.fiyat || !yeniUrun.kategori
                        ? "bg-gray-400 cursor-not-allowed"
                        : "bg-teal-600 hover:bg-teal-700"
                    }`}
                  >
                    <PlusCircle className="w-4 h-4" /> Ürün Ekle
                  </button>
                </div>
              </form>
            </div>
            {/* Ürün Sil Formu */}
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
                  />
                  <button
                    type="submit"
                    disabled={!silUrunAdi.trim() || loading}
                    className={`w-full text-white py-2 rounded shadow transition duration-200 ease-in-out active:scale-95 flex items-center justify-center gap-2 ${
                      !silUrunAdi.trim() || loading
                        ? "bg-gray-400 cursor-not-allowed"
                        : "bg-red-600 hover:bg-red-700"
                    }`}
                  >
                    <Trash2 className="w-4 h-4" /> Ürün Sil
                  </button>
                </div>
              </form>
            </div>
          </div>
          {/* Mevcut Menü Gösterimi */}
          <div className="md:col-span-2">
            <h4 className="font-medium mb-3 text-gray-600">Mevcut Menü</h4>
            {loading && (!menu || menu.length === 0) && (
              <div className="text-center py-10 text-gray-400 italic">Menü yükleniyor...</div>
            )}
            {!loading && (!menu || menu.length === 0) && (
              <div className="text-center py-10 text-gray-500">Menü boş veya yüklenemedi. Lütfen bağlantıyı kontrol edin.</div>
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

      {/* Sipariş Geçmişi */}
      <div className="bg-white p-6 rounded-lg shadow-lg">
        <h3 className="text-lg font-semibold mb-4 text-gray-700">📋 Sipariş Geçmişi</h3>
        <input
          type="text"
          placeholder="Sipariş Ara (ID, Masa, Durum, İçerik, Not, Tarih...)"
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
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Tarih</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading && (!orders || orders.length === 0) && (
                <tr>
                  <td colSpan="5" className="text-center py-10 text-gray-400 italic">Siparişler yükleniyor...</td>
                </tr>
              )}
              {!loading && filtrelenmisSiparisler.length === 0 && (
                <tr>
                  <td colSpan="5" className="text-center py-10 text-gray-500">
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
                      <span className={`px-2.5 py-1 text-xs font-semibold rounded-full leading-tight ${
                        siparis.durum === "hazir"
                          ? "bg-green-100 text-green-800"
                          : siparis.durum === "hazirlaniyor"
                          ? "bg-blue-100 text-blue-800"
                          : siparis.durum === "iptal"
                          ? "bg-red-100 text-red-800 line-through opacity-70"
                          : "bg-yellow-100 text-yellow-800"
                      }`}>
                        {siparis.durum
                          ? siparis.durum.charAt(0).toUpperCase() + siparis.durum.slice(1)
                          : "Bilinmiyor"}
                      </span>
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

      {/* Ayarlar Bölümü */}
      <div className="bg-white p-6 rounded-lg shadow-lg mt-8">
        <h3 className="text-lg font-semibold mb-4 text-gray-700">⚙️ Ayarlar</h3>
        <div className="text-sm text-gray-600 space-y-2">
          <p>Admin kullanıcı adı ve şifresi sunucu tarafında ortam değişkenleri ile yönetilmektedir.</p>
          <p>Frontend tarafında kimlik bilgileri, <code>.env</code> dosyasındaki <code>REACT_APP_ADMIN_USERNAME</code> ve <code>REACT_APP_ADMIN_PASSWORD</code> değişkenlerinden okunur.</p>
          <p>Değişiklik için <code>.env</code> dosyalarını güncelleyin ve uygulamayı yeniden başlatın/deploy edin.</p>
          <p className="mt-3 text-xs text-gray-500">
            Mevcut Frontend Kullanıcısı: <strong>{ADMIN_USERNAME}</strong>
          </p>
        </div>
      </div>
    </div>
  );
}

export default AdminPaneli;
