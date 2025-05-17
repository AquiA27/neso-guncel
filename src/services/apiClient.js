import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_BASE;

export const setAuthTokenToLocalStorage = (token) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('neso_auth_token', token);
  }
};

export const getAuthTokenFromLocalStorage = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('neso_auth_token');
  }
  return null;
};

export const removeAuthTokenFromLocalStorage = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('neso_auth_token');
    localStorage.removeItem('neso_user_role');
    localStorage.removeItem('neso_user_name');
    // Uygulamanızda kullanıcıya ait başka veriler localStorage'da tutuluyorsa onları da temizleyebilirsiniz.
  }
};

const apiClient = axios.create({
  baseURL: API_BASE,
});

apiClient.interceptors.request.use(
  (config) => {
    const token = getAuthTokenFromLocalStorage();
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
    const response = await apiClient.get('/users/me'); // Backend'deki endpoint
    return response.data;
  } catch (error) {
    console.error("Kullanıcı detayları alınırken hata (fetchUserDetails):", error);
    // Token geçersiz veya süresi dolmuş olabilir, bu durumda token'ı temizle
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      removeAuthTokenFromLocalStorage();
    }
    return null;
  }
};

export default apiClient;