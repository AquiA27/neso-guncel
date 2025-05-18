import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_BASE;

// --- sessionStorage Helper Fonksiyonları ---
export const setAuthTokenToSessionStorage = (token) => {
  if (typeof window !== 'undefined') {
    if (token) {
      sessionStorage.setItem('neso_auth_token', token);
    } else {
      // Eğer token null veya undefined ise, anahtarı kaldır.
      // Bu, logout durumlarında veya token geçersiz olduğunda temizlik sağlar.
      sessionStorage.removeItem('neso_auth_token');
    }
  }
};

export const getAuthTokenFromSessionStorage = () => {
  if (typeof window !== 'undefined') {
    return sessionStorage.getItem('neso_auth_token');
  }
  return null;
};

export const removeAuthTokenFromSessionStorage = () => {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem('neso_auth_token');
    sessionStorage.removeItem('neso_user_role'); // AuthContext'te bu anahtarlar kullanılıyordu
    sessionStorage.removeItem('neso_user_name'); // AuthContext'te bu anahtarlar kullanılıyordu
    // Uygulamanızda kullanıcıya ait başka oturum verileri sessionStorage'da tutuluyorsa onları da temizleyebilirsiniz.
    console.log("Oturum verileri sessionStorage'dan temizlendi.");
  }
};
// --- Bitiş: sessionStorage Helper Fonksiyonları ---

const apiClient = axios.create({
  baseURL: API_BASE,
});

// İstek interceptor'ı: Her istekte sessionStorage'dan token'ı alıp Authorization header'ına ekle
apiClient.interceptors.request.use(
  (config) => {
    const token = getAuthTokenFromSessionStorage(); // sessionStorage'dan token'ı oku
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// API'den kullanıcı bilgilerini ve rolünü almak için bir fonksiyon
export const fetchUserDetails = async () => {
  try {
    // Token zaten interceptor tarafından header'a ekleniyor olmalı.
    // Eğer getAuthTokenFromSessionStorage() burada çağrılıp token yoksa null dönülebilir,
    // ama interceptor olduğu için apiClient.get direkt token ile gider.
    // Token'ın varlığını AuthContext zaten kontrol ediyor olmalı.
    const response = await apiClient.get('/users/me'); // Backend'deki endpoint
    return response.data;
  } catch (error) {
    console.error("Kullanıcı detayları alınırken hata (fetchUserDetails):", error);
    // Token geçersiz veya süresi dolmuş olabilir.
    // AuthContext bu durumu ele alıp logout'u tetikleyecektir.
    // Burada ayrıca token temizlemeye gerek yok, çünkü AuthContext hatayı yakalayıp logout'u çağırır
    // ve logout fonksiyonu removeAuthTokenFromSessionStorage'ı çağırır.
    // Ancak, eğer 401 veya 403 hatası alırsak ve bu fonksiyon AuthContext dışında da kullanılıyorsa,
    // burada token temizlemek düşünülebilir, ama AuthContext'in merkezi kontrolü daha iyi.
    // if (error.response && (error.response.status === 401 || error.response.status === 403)) {
    //   removeAuthTokenFromSessionStorage(); // Bu satır AuthContext'teki merkezi hata yönetimi ile çakışabilir.
    // }
    return null;
  }
};

export default apiClient;