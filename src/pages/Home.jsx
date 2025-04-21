import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

function Home() {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Neso Asistan";
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-800 via-purple-600 to-pink-500 flex flex-col items-center justify-center text-white px-4">
      <div className="backdrop-blur-sm bg-white/10 border border-white/20 rounded-3xl shadow-lg p-10 w-full max-w-lg text-center">
        <h1 className="text-4xl font-extrabold mb-4 drop-shadow">☕ Neso Asistan</h1>
        <p className="text-md text-white/80 mb-8">Sipariş vermek veya menüyü görmek için seçim yapın.</p>
        
        <div className="flex flex-col gap-4">
          <button
            onClick={() => navigate("/masa/1")}
            className="bg-white/20 hover:bg-white/40 px-6 py-3 rounded-xl text-lg font-semibold transition"
          >
            🎙️ Asistanı Başlat
          </button>
          <button
            onClick={() => navigate("/menu")}
            className="bg-white/20 hover:bg-white/40 px-6 py-3 rounded-xl text-lg font-semibold transition"
          >
            📋 Menüye Göz At
          </button>
        </div>
      </div>
    </div>
  );
}

export default Home;
