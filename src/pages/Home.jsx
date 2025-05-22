import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import NesoLogo from '../NesoLogo.svg'; // Logo doğru yolda olmalı
import { Mic, BookOpen, Zap } from 'lucide-react'; // EKLENDİ: Lucide ikonları

// Nunito fontunun projenizin ana CSS dosyasında veya index.html'de yüklü olduğundan emin olun.
// @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');

function Home() {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Neso Asistan | Fıstık Kafe";
  }, []);

  return (
    // Ana Kapsayıcı: Sofistike ve modern bir koyu tema
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-purple-900 flex flex-col items-center justify-center text-white p-4 font-['Nunito',_sans-serif] overflow-hidden">
      {/* Dekoratif Arka Plan Elementleri - Daha Soyut ve Ortama Uygun */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
        <div className="absolute -top-1/4 -left-1/4 w-1/2 h-1/2 bg-purple-600/20 rounded-full filter blur-3xl animate-pulse opacity-70"></div>
        <div className="absolute bottom-0 -right-1/4 w-1/2 h-1/2 bg-indigo-500/20 rounded-full filter blur-3xl animate-pulse delay-1000 opacity-60"></div>
        <div className="absolute top-1/3 left-1/3 w-1/3 h-1/3 bg-pink-500/10 rounded-full filter blur-2xl animate-pulse delay-500 opacity-50"></div>
      </div>

      {/* İçerik Kartı: Gelişmiş glassmorphism etkisi */}
      <div className="relative z-10 backdrop-blur-2xl bg-slate-800/40 border border-slate-700/80 rounded-3xl shadow-2xl p-8 sm:p-12 w-full max-w-lg text-center transform transition-all duration-500 hover:scale-[1.01]">
        
        {/* Logo ve Başlık */}
        <img 
          src={NesoLogo} 
          alt="Neso Asistan Logo" 
          className="h-28 w-28 sm:h-32 sm:w-32 mx-auto mb-6 drop-shadow-lg transition-transform duration-500 ease-out group-hover:scale-110 animate-fade-in-slow" // Daha yumuşak bir giriş animasyonu
        />
        <h1 className="text-4xl sm:text-5xl font-extrabold mb-3 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-orange-300 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
          Neso Asistan
        </h1>
        <p className="text-md sm:text-lg text-slate-300/90 mb-10 drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]">
          Fıstık Kafe'nin akıllı yardımcısıyla çalışma deneyiminizi bir üst seviyeye taşıyın!
        </p>
        
        {/* Butonlar - Diğer ekranlarla uyumlu stil */}
        <div className="flex flex-col gap-5">
          <button
            onClick={() => navigate("/masa/1")} // Varsayılan olarak Masa 1'e yönlendiriyor
            className="group flex items-center justify-center gap-3 bg-gradient-to-r from-purple-600 via-pink-600 to-red-500 hover:from-purple-700 hover:via-pink-700 hover:to-red-600 px-6 py-4 rounded-xl text-lg font-bold text-white shadow-xl hover:shadow-pink-500/30 transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-pink-400 focus:ring-opacity-50"
          >
            <Mic className="w-6 h-6 transition-transform duration-300 group-hover:rotate-12" />
            Asistanı Başlat
          </button>
          <button
            onClick={() => navigate("/menu")}
            className="group flex items-center justify-center gap-3 bg-slate-700/70 hover:bg-slate-600/90 backdrop-blur-md border border-slate-600/80 px-6 py-4 rounded-xl text-lg font-semibold text-slate-100 shadow-lg hover:shadow-slate-500/20 transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-slate-500 focus:ring-opacity-50"
          >
            <BookOpen className="w-6 h-6 transition-transform duration-300 group-hover:scale-110" />
            Menüye Göz At
          </button>
        </div>

        {/* Alt Bilgi */}
        <p className="text-center text-xs text-slate-400/70 mt-12 drop-shadow-[0_1px_1px_rgba(0,0,0,0.2)]">
          ☕ Fıstık Kafe & Neso Asistan ile keyifli ve verimli anlar!
        </p>
      </div>

      {/* Ekstra Stil Elemanı (Sayfanın altına küçük bir marka vurgusu) */}
      <div className="relative z-10 mt-10 text-center">
        <p className="text-sm text-slate-400/80 flex items-center justify-center gap-1.5">
            <Zap className="w-4 h-4 text-yellow-400" /> Destekleyen Neso Tech &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}

export default Home;