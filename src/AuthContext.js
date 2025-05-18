import React, { createContext, useState, useEffect, useCallback } from 'react';
import apiClient, {
  // Bu fonksiyonların apiClient.js veya benzeri bir yardımcı dosyada
  // sessionStorage kullanacak şekilde güncellendiğini varsayıyoruz.
  // İsimlerini de bu şekilde değiştirebilirsiniz veya mevcut isimleri koruyup
  // içlerindeki localStorage'ı sessionStorage ile değiştirebilirsiniz.
  setAuthTokenToSessionStorage, // Eskiden: setAuthTokenToLocalStorage
  getAuthTokenFromSessionStorage, // Eskiden: getAuthTokenFromLocalStorage
  removeAuthTokenFromSessionStorage, // Eskiden: removeAuthTokenFromLocalStorage
  fetchUserDetails
} from './services/apiClient'; // apiClient ve storage fonksiyonları import edildi
import { useNavigate } from 'react-router-dom';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  // 1. State'leri sessionStorage'dan okuyacak şekilde güncelle
  const [authToken, setAuthTokenState] = useState(getAuthTokenFromSessionStorage());
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(sessionStorage.getItem('neso_user_role')); // sessionStorage'dan rolü al
  const [isAuthenticated, setIsAuthenticated] = useState(!!authToken);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);
  const navigate = useNavigate();

  // Token değiştiğinde apiClient header'ını güncelle ve sessionStorage'a yaz
  useEffect(() => {
    if (authToken) {
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
      // sessionStorage'a yazmak için yardımcı fonksiyonu kullan veya doğrudan yaz
      // Eğer setAuthTokenToSessionStorage helper'ı sadece token'ı saklıyorsa:
      sessionStorage.setItem('neso_auth_token', authToken);
    } else {
      delete apiClient.defaults.headers.common['Authorization'];
      removeAuthTokenFromSessionStorage(); // Bu fonksiyon tüm neso_* anahtarlarını sessionStorage'dan silmeli
    }
  }, [authToken]);

  // Uygulama yüklendiğinde veya token değiştiğinde kullanıcı bilgilerini çek
  const loadUser = useCallback(async () => {
    // Token sessionStorage'dan okunmuştu.
    const currentTokenInStorage = getAuthTokenFromSessionStorage();

    if (currentTokenInStorage && !currentUser) { // Eğer token var ama kullanıcı bilgisi yoksa (veya state'deki token ile storage'daki tutarlıysa)
      setLoadingAuth(true);
      setAuthError(null);

      // apiClient header'ının güncel olduğundan emin ol (yukarıdaki useEffect bunu yapar)
      // Eğer authToken state'i henüz güncellenmemişse, header'ı burada geçici olarak set et
      if (!apiClient.defaults.headers.common['Authorization'] && currentTokenInStorage) {
         apiClient.defaults.headers.common['Authorization'] = `Bearer ${currentTokenInStorage}`;
      }

      const userData = await fetchUserDetails();
      if (userData) {
        setCurrentUser(userData);
        setUserRole(userData.rol);
        setIsAuthenticated(true);
        sessionStorage.setItem('neso_user_role', userData.rol);
        sessionStorage.setItem('neso_user_name', userData.kullanici_adi);
        // authToken'u zaten useEffect saklıyor, ayrıca burada neso_auth_token yazmaya gerek yok.
      } else {
        setAuthTokenState(null);
        setCurrentUser(null);
        setUserRole(null);
        setIsAuthenticated(false);
        setAuthError("Oturumunuz sonlanmış veya geçersiz. Lütfen tekrar giriş yapın.");
        // removeAuthTokenFromSessionStorage() zaten authToken null olunca useEffect'te çağrılacak.
      }
      setLoadingAuth(false);
    } else if (!currentTokenInStorage) { // Storage'da token yoksa her şeyi sıfırla
      setAuthTokenState(null); // Bu useEffect'i tetikler ve storage'ı temizler
      setCurrentUser(null);
      setUserRole(null);
      setIsAuthenticated(false);
      setLoadingAuth(false);
    } else if (currentUser && currentTokenInStorage) { // Token var, kullanıcı da var, bir şey yapma
        setLoadingAuth(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]); // Bağımlılığı currentUser olarak değiştirdik, çünkü token'ı zaten state'ten alıyoruz.
                     // authToken değiştiğinde bu fonksiyonun mantığı zaten yeniden değerlendirilmeli.
                     // Daha iyisi, loadUser'ı sadece component mount olduğunda ve manuel logout'ta çağırmak.

  useEffect(() => {
    // Sadece component ilk yüklendiğinde kullanıcıyı yükle
    // Eğer authToken state'i (sessionStorage'dan gelen) varsa loadUser çağrılır.
    // Bu, sayfa yenilemelerinde oturumu geri yükler.
    const initialToken = getAuthTokenFromSessionStorage();
    if (initialToken) {
        setAuthTokenState(initialToken); // Bu, yukarıdaki useEffect'i ve loadUser'ı tetikleyebilir.
        loadUser(); // Token varsa kullanıcıyı yüklemeyi dene
    } else {
        setLoadingAuth(false); // Token yoksa yüklemeyi bitir
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Sadece mount olduğunda çalışsın. loadUser bağımlılığını kaldırdık.

  // loadUser'ı authToken değiştiğinde de çağırmak için ayrı bir useEffect
  // Bu, login sonrası token state'i güncellendiğinde loadUser'ı tetikler.
  useEffect(() => {
    if (authToken) { // Yeni bir token set edildiğinde (login sonrası)
      loadUser();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken]);


  const login = async (token) => {
    setLoadingAuth(true);
    setAuthError(null);

    // 1. Token'ı sessionStorage'a ve state'e kaydet
    // setAuthTokenToSessionStorage(token); // apiClient.js içindeki helper bunu yapabilir
    sessionStorage.setItem('neso_auth_token', token); // Doğrudan yazalım
    setAuthTokenState(token); // Bu, header'ı güncelleyen ve sessionStorage'a yazan useEffect'i tetikler

    // 2. Kullanıcı bilgilerini çek (apiClient header'ı yukarıdaki useEffect ile güncellenmiş olmalı)
    const userData = await fetchUserDetails(); // fetchUserDetails'in token'ı doğru kullandığından emin olun
    
    if (userData) {
      setCurrentUser(userData);
      setUserRole(userData.rol);
      setIsAuthenticated(true);
      sessionStorage.setItem('neso_user_role', userData.rol);
      sessionStorage.setItem('neso_user_name', userData.kullanici_adi);
      setLoadingAuth(false);
      return { success: true, rol: userData.rol };
    } else {
      // Başarısız kullanıcı çekme durumunda oturumu temizle
      setAuthTokenState(null); // Bu, header ve sessionStorage temizliğini tetikler
      setCurrentUser(null);
      setUserRole(null);
      setIsAuthenticated(false);
      setAuthError("Kullanıcı bilgileri alınamadı veya token geçersiz.");
      setLoadingAuth(false);
      // removeAuthTokenFromSessionStorage(); // Zaten setAuthTokenState(null) ile tetiklenecek
      return { success: false, error: "Kullanıcı bilgileri alınamadı veya token geçersiz." };
    }
  };

  const logout = useCallback(() => {
    setAuthTokenState(null); // Bu, header ve sessionStorage temizliğini tetikler
    setCurrentUser(null);
    setUserRole(null);
    setIsAuthenticated(false);
    setAuthError(null);
    // removeAuthTokenFromSessionStorage(); // Yukaridaki setAuthTokenState(null) ile zaten tetiklenir.
                                        // Ancak emin olmak için yine de çağrılabilir.
                                        // Önemli olan removeAuthTokenFromSessionStorage'ın tüm neso_* anahtarlarını silmesi.
    if (typeof removeAuthTokenFromSessionStorage === 'function') {
        removeAuthTokenFromSessionStorage();
    } else { // Eğer helper import edilmediyse veya farklıysa, manuel temizlik
        sessionStorage.removeItem('neso_auth_token');
        sessionStorage.removeItem('neso_user_role');
        sessionStorage.removeItem('neso_user_name');
    }

    if (navigate) {
        navigate('/login', { replace: true });
    }
    console.log("Çıkış yapıldı ve oturum temizlendi.");
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
        setAuthError
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};