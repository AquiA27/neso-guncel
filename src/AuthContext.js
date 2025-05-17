// src/context/AuthContext.js
import React, { createContext, useState, useEffect, useCallback } from 'react';
import apiClient, {
  setAuthTokenToLocalStorage,
  getAuthTokenFromLocalStorage,
  removeAuthTokenFromLocalStorage,
  fetchUserDetails
} from '../services/apiClient'; // apiClient ve localStorage fonksiyonları import edildi
import { useNavigate } from 'react-router-dom';


export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [authToken, setAuthTokenState] = useState(getAuthTokenFromLocalStorage());
  const [currentUser, setCurrentUser] = useState(null); // Kullanıcı adı, id, rol vb.
  const [userRole, setUserRole] = useState(localStorage.getItem('neso_user_role')); // Rolü de localStorage'dan alabiliriz
  const [isAuthenticated, setIsAuthenticated] = useState(!!authToken);
  const [loadingAuth, setLoadingAuth] = useState(true); // Auth durumu yükleniyor mu?
  const [authError, setAuthError] = useState(null);
  const navigate = useNavigate(); // navigate hook'unu burada tanımlayalım

  // Token değiştiğinde apiClient header'ını güncelle
  useEffect(() => {
    if (authToken) {
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
      localStorage.setItem('neso_auth_token', authToken); // localStorage'ı da senkronize et
    } else {
      delete apiClient.defaults.headers.common['Authorization'];
      removeAuthTokenFromLocalStorage(); // localStorage'ı temizle
    }
  }, [authToken]);

  // Uygulama yüklendiğinde veya token değiştiğinde kullanıcı bilgilerini çek
  const loadUser = useCallback(async () => {
    if (authToken && !currentUser) { // Eğer token var ama kullanıcı bilgisi yoksa
      setLoadingAuth(true);
      setAuthError(null);
      const userData = await fetchUserDetails();
      if (userData) {
        setCurrentUser(userData);
        setUserRole(userData.rol);
        setIsAuthenticated(true);
        localStorage.setItem('neso_user_role', userData.rol); // Rolü localStorage'a kaydet
        localStorage.setItem('neso_user_name', userData.kullanici_adi);
      } else {
        // Token var ama kullanıcı bilgisi alınamadıysa (örn: token süresi dolmuş, backendde silinmiş)
        setAuthTokenState(null); // Token'ı state'den ve localStorage'dan kaldır
        setCurrentUser(null);
        setUserRole(null);
        setIsAuthenticated(false);
        setAuthError("Oturumunuz sonlanmış veya geçersiz. Lütfen tekrar giriş yapın.");
      }
      setLoadingAuth(false);
    } else if (!authToken) {
      setCurrentUser(null);
      setUserRole(null);
      setIsAuthenticated(false);
      setLoadingAuth(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken]); // currentUser bağımlılığını kaldırdık, sonsuz döngüyü engellemek için

  useEffect(() => {
    loadUser();
  }, [loadUser]);


  const login = async (token) => { // Login.jsx'ten gelen token'ı alır
    setLoadingAuth(true);
    setAuthError(null);
    setAuthTokenState(token); // Bu useEffect'i tetikleyerek apiClient header'ını ve localStorage'ı günceller
    setAuthTokenToLocalStorage(token); // Ekstra güvenlik için hemen localStorage'a yazalım

    // Token set edildikten sonra kullanıcı bilgilerini çekelim
    // apiClient header'ı useEffect ile güncellenmiş olmalı
    const userData = await fetchUserDetails();
    if (userData) {
      setCurrentUser(userData);
      setUserRole(userData.rol);
      setIsAuthenticated(true);
      localStorage.setItem('neso_user_role', userData.rol);
      localStorage.setItem('neso_user_name', userData.kullanici_adi);
      setLoadingAuth(false);
      return { success: true, rol: userData.rol }; // Başarılı giriş ve rol bilgisi döndür
    } else {
      setAuthTokenState(null); // Token var ama kullanıcı bilgisi alınamadıysa
      setCurrentUser(null);
      setUserRole(null);
      setIsAuthenticated(false);
      setAuthError("Kullanıcı bilgileri alınamadı.");
      setLoadingAuth(false);
      removeAuthTokenFromLocalStorage();
      return { success: false, error: "Kullanıcı bilgileri alınamadı." };
    }
  };

  const logout = useCallback(() => {
    setAuthTokenState(null);
    setCurrentUser(null);
    setUserRole(null);
    setIsAuthenticated(false);
    setAuthError(null);
    removeAuthTokenFromLocalStorage(); // localStorage'dan her şeyi temizle
    // İsteğe bağlı: navigate('/login') burada da çağrılabilir veya App.js'de handle edilir.
    // Genellikle ProtectedRoute içinde kontrol edilir ve yönlendirme yapılır.
    // Ancak doğrudan logout sonrası login'e yönlendirmek de iyi bir pratiktir.
    if (navigate) { // navigate'in tanımlı olup olmadığını kontrol et
        navigate('/login');
    }
    console.log("Çıkış yapıldı.");
  }, [navigate]);


  return (
    <AuthContext.Provider
      value={{
        authToken,
        currentUser,
        userRole,
        isAuthenticated,
        loadingAuth,
        authError,
        login,
        logout,
        setAuthError // Hata mesajını dışarıdan set etmek için
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};