import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import NesoLogo from '../NesoLogo.svg'; // Logo doğru yolda olmalı

// İkonlar (SVG olarak veya bir kütüphaneden)
const MicIconHome = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
  </svg>
);

const MenuIconHome = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12H12m-8.25 5.25h16.5" />
  </svg>
);


function Home() {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Neso Asistan | Fıstık Kafe";
  }, []);

  return (
    // Ana Kapsayıcı: Sıcak ve davetkar bir gradient arka plan
    <div className="min-h-screen bg-gradient-to-br from-amber-300 via-orange-400 to-red-400 flex flex-col items-center justify-center text-white p-4 font-['Nunito',_sans-serif]">
      {/* İçerik Kartı: Yumuşak, organik form ve glassmorphism etkisi */}
      <div className="relative backdrop-blur-xl bg-black/20 border border-white/25 rounded-3xl shadow-2xl p-8 sm:p-12 w-full max-w-md text-center overflow-hidden">
        {/* Üst Kısım - Dekoratif Desen (Opsiyonel) */}
        <div className="absolute -top-10 -left-10 w-32 h-32 bg-white/10 rounded-full opacity-50 animate-pulse delay-100"></div>
        <div className="absolute -bottom-12 -right-8 w-40 h-40 bg-white/5 rounded-full opacity-40 animate-pulse delay-300"></div>
        
        {/* Logo ve Başlık */}
        <img 
          src={NesoLogo} 
          alt="Neso Asistan Logo" 
          className="h-24 w-24 sm:h-28 sm:w-28 mx-auto mb-5 drop-shadow-lg animate-bounce [animation-duration:3s]" 
        />
        <h1 className="text-4xl sm:text-5xl font-extrabold mb-3 text-white drop-shadow-[0_2px_3px_rgba(0,0,0,0.4)]">
          Neso Asistan
        </h1>
        <p className="text-md sm:text-lg text-white/80 mb-8 drop-shadow-[0_1px_1px_rgba(0,0,0,0.3)]">
          Fıstık Kafe'nin akıllı yardımcısıyla tanışın!
        </p>
        
        {/* Butonlar */}
        <div className="flex flex-col gap-5">
          <button
            onClick={() => navigate("/masa/1")} // Varsayılan olarak Masa 1'e yönlendiriyor
            className="group flex items-center justify-center gap-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 px-6 py-4 rounded-xl text-lg font-bold text-white shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-emerald-300 focus:ring-opacity-50"
          >
            <MicIconHome />
            Asistanı Başlat
          </button>
          <button
            onClick={() => navigate("/menu")}
            className="group flex items-center justify-center gap-3 bg-white/25 hover:bg-white/40 backdrop-blur-md px-6 py-4 rounded-xl text-lg font-semibold text-white shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-white/50 focus:ring-opacity-50"
          >
            <MenuIconHome />
            Menüye Göz At
          </button>
        </div>

        {/* Alt Bilgi */}
        <p className="text-center text-xs text-white/60 mt-10 drop-shadow-[0_1px_1px_rgba(0,0,0,0.2)]">
          ☕ Keyifli bir deneyim dileriz!
        </p>
      </div>

      {/* Ekstra Stil Elemanı (Opsiyonel - Sayfanın altına küçük bir marka vurgusu) */}
      <div className="mt-8 text-center">
        <p className="text-sm text-white/70">
          Fıstık Kafe & Neso Asistan &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}

export default Home;