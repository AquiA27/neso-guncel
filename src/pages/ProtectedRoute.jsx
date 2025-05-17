// src/components/ProtectedRoute.jsx
import React, { useContext } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { AuthContext } from './AuthContext';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { isAuthenticated, userRole, loadingAuth } = useContext(AuthContext);
  const location = useLocation();

  if (loadingAuth) {
    // Auth durumu yüklenirken bir yükleme göstergesi gösterilebilir
    // veya null döndürülerek render'ın beklemesi sağlanabilir.
    // Daha iyi bir UX için merkezi bir yükleme ekranı da düşünülebilir.
    return (
        <div className="min-h-screen flex items-center justify-center">
            Yükleniyor...
        </div>
    );
  }

  if (!isAuthenticated) {
    // Kullanıcı giriş yapmamışsa login sayfasına yönlendir.
    // Yönlendirme sonrası geri dönebilmesi için mevcut konumu state ile gönder.
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
    // Kullanıcının rolü izin verilen roller arasında değilse,
    // yetkisiz erişim sayfasına veya ana sayfaya yönlendir.
    console.warn(`Yetkisiz erişim denemesi: ${location.pathname}, Kullanıcı Rolü: ${userRole}, İzin Verilen Roller: ${allowedRoles}`);
    return <Navigate to="/unauthorized" replace />; // Ya da ana sayfaya: <Navigate to="/" replace />;
  }

  return children; // Kullanıcı giriş yapmış ve (eğer belirtilmişse) yetkili ise istenen sayfayı göster.
};

export default ProtectedRoute;