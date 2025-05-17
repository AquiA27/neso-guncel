// src/pages/Login.jsx
import React, { useState, useEffect, useContext } from 'react'; // useContext eklendi
import axios from 'axios'; // Sadece /token isteği için, diğerleri apiClient ile
import { useNavigate, useLocation, Link } from 'react-router-dom';
import NesoLogo from '../NesoLogo.svg';
import { AuthContext } from '../context/AuthContext'; // AuthContext import edildi
import apiClient from '../services/apiClient'; // apiClient import edildi

const API_BASE = process.env.REACT_APP_API_BASE;

function Login() {
  const [kullaniciAdi, setKullaniciAdi] = useState('');
  const [sifre, setSifre] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated, userRole } = useContext(AuthContext); // AuthContext'ten fonksiyonlar ve durumlar alındı

  const from = location.state?.from?.pathname || "/";

  useEffect(() => {
    document.title = "Giriş Yap - Neso Asistan";
    if (isAuthenticated) { // AuthContext'ten gelen isAuthenticated durumu kontrol ediliyor
      // Rolüne göre yönlendirme AuthContext veya App.js içinde yapılabilir.
      // Şimdilik burada temel bir yönlendirme bırakalım.
      // Daha merkezi bir yönlendirme için App.js'deki ProtectedRoute'a güvenebiliriz.
      console.log("Login.jsx: Zaten giriş yapılmış, rol:", userRole, "Yönlendiriliyor:", from);
      if (userRole === 'admin') navigate('/admin', { replace: true });
      else if (userRole === 'kasiyer') navigate('/kasa', { replace: true });
      else if (userRole === 'mutfak_personeli' || userRole === 'barista') navigate('/mutfak', { replace: true });
      else navigate(from === '/login' ? '/' : from , { replace: true }); // Eğer from login ise ana sayfaya
    }
  }, [isAuthenticated, navigate, from, userRole]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!API_BASE) {
      setError('API adresi yapılandırılmamış.');
      setLoading(false);
      return;
    }

    try {
      const formData = new URLSearchParams();
      formData.append('username', kullaniciAdi);
      formData.append('password', sifre);

      // /token isteği için doğrudan axios kullanıyoruz çünkü henüz apiClient interceptor'ı (eğer token yoksa) devreye girmeyebilir.
      // Ya da apiClient'ı /token isteği için de kullanabiliriz, interceptor token yoksa bir şey yapmayacaktır.
      // Şimdilik doğrudan axios ile devam edelim.
      const response = await axios.post(`${API_BASE}/token`, formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });

      if (response.data.access_token) {
        const token = response.data.access_token;
        // AuthContext üzerinden login fonksiyonunu çağırıyoruz.
        // Bu fonksiyon token'ı ve kullanıcı detaylarını alıp state'i güncelleyecek.
        const loginSuccess = await login(token); // login fonksiyonu AuthContext'te tanımlanacak

        if (loginSuccess && loginSuccess.rol) {
          // Yönlendirme AuthContext'teki useEffect veya buradaki useEffect ile yapılabilir.
          // login fonksiyonu başarılı olursa, yukarıdaki useEffect zaten yönlendirmeyi tetikleyecektir.
          // İsteğe bağlı olarak burada da spesifik bir yönlendirme yapılabilir.
          // Örneğin:
          // switch (loginSuccess.rol) {
          //   case 'admin': navigate('/admin', { replace: true }); break;
          //   case 'kasiyer': navigate('/kasa', { replace: true }); break;
          //   // ... diğer roller
          //   default: navigate(from === '/login' ? '/' : from, { replace: true });
          // }
        } else if (!loginSuccess) {
            setError(loginSuccess.error || 'Giriş başarılı ancak kullanıcı detayları alınamadı veya rol bulunamadı.');
        }
      } else {
        setError('Giriş başarısız. Token alınamadı.');
      }
    } catch (err) {
      console.error("Giriş hatası:", err);
      if (err.response) {
        if (err.response.status === 401) {
          setError('Kullanıcı adı veya şifre hatalı.');
        } else if (err.response.status === 400 && err.response.data?.detail?.toLowerCase().includes("pasif kullanıcı") ) {
            setError('Hesabınız aktif değil. Lütfen yönetici ile iletişime geçin.');
        } else {
          setError(err.response.data?.detail || 'Giriş sırasında bir hata oluştu.');
        }
      } else if (err.request) {
        setError('Sunucuya ulaşılamadı. Bağlantınızı kontrol edin.');
      } else {
        setError('Beklenmedik bir hata oluştu.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Eğer zaten giriş yapılmışsa bu sayfanın içeriğini göstermeyebiliriz veya farklı bir mesaj gösterebiliriz.
  // Bu kontrol yukarıdaki useEffect ile zaten yapılıyor ve yönlendirme sağlanıyor.
  if (isAuthenticated && !loading) {
      return (
          <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-100 to-sky-100 p-4">
              <img src={NesoLogo} alt="Neso Asistan Logo" className="h-20 w-20 mx-auto mb-6" />
              <p className="text-slate-700 text-lg mb-4">Zaten giriş yaptınız.</p>
              <Link to="/" className="text-sky-600 hover:text-sky-700 font-semibold">Ana Sayfaya Dön</Link>
          </div>
      );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-sky-100 p-4">
      <div className="bg-white shadow-2xl p-8 rounded-xl text-center border border-slate-200 max-w-md w-full">
        <img src={NesoLogo} alt="Neso Asistan Logo" className="h-20 w-20 mx-auto mb-6" />
        <h2 className="text-3xl font-bold mb-2 text-slate-700">Personel Girişi</h2>
        <p className="text-slate-500 mb-6">Lütfen devam etmek için giriş yapın.</p>

        {error && (
          <div className="bg-red-100 border border-red-300 text-red-600 px-4 py-3 rounded-lg mb-4 text-sm" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label htmlFor="kullaniciAdi" className="block text-sm font-medium text-slate-600 text-left mb-1">
              Kullanıcı Adı
            </label>
            <input
              id="kullaniciAdi"
              type="text"
              placeholder="Kullanıcı adınız"
              value={kullaniciAdi}
              onChange={(e) => setKullaniciAdi(e.target.value)}
              className="w-full p-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 transition-colors"
              required
              disabled={loading}
            />
          </div>
          <div>
            <label htmlFor="sifre" className="block text-sm font-medium text-slate-600 text-left mb-1">
              Şifre
            </label>
            <input
              id="sifre"
              type="password"
              placeholder="Şifreniz"
              value={sifre}
              onChange={(e) => setSifre(e.target.value)}
              className="w-full p-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 transition-colors"
              required
              disabled={loading}
            />
          </div>
          <button
            type="submit"
            className={`w-full bg-sky-600 hover:bg-sky-700 text-white px-4 py-3 rounded-lg font-semibold shadow-md flex items-center justify-center gap-2 transition duration-200 ease-in-out active:scale-95 ${
              loading ? 'opacity-70 cursor-not-allowed' : ''
            }`}
            disabled={loading}
          >
            {loading ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Giriş Yapılıyor...
              </>
            ) : (
              'Giriş Yap'
            )}
          </button>
        </form>
        <p className="text-xs text-slate-400 mt-6">
          Fıstık Kafe &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}

export default Login;