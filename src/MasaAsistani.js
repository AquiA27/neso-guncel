import React, { useState, useRef } from "react";
import { useParams } from "react-router-dom";

function MasaAsistani() {
  const { masaId } = useParams();
  const [text, setText] = useState("");
  const [reply, setReply] = useState("");
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);

  const startListening = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Tarayıcınız ses tanımayı desteklemiyor.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "tr-TR";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = (e) => console.error("Hata:", e);

    recognition.onresult = (event) => {
      const spokenText = event.results[0][0].transcript;
      setText(spokenText);
      sendToBackend(spokenText);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const sendToBackend = async (spokenText) => {
    try {
      const response = await fetch("https://neso-backend-clean.onrender.com/sesli-siparis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: spokenText, masa: masaId }),
      });

      const data = await response.json();
      setReply(data.reply);
    } catch (err) {
      console.error("Backend hatası:", err);
      setReply("Sunucuya ulaşılamadı.");
    }
  };

  return (
    <div style={{ textAlign: "center", padding: 50 }}>
    <h1 className="text-3xl text-center text-blue-600 font-bold">
  🎙️ Sesli Sipariş Asistanı
</h1>

      <p><strong>Masa No:</strong> {masaId}</p>
      <button onClick={startListening} disabled={listening}>
        {listening ? "Dinleniyor..." : "Mikrofona Bas ve Konuş"}
      </button>
      <p><strong>🗣️ Algılanan:</strong> {text}</p>
      <p><strong>🤖 Neso'nun Yanıtı:</strong> {reply}</p>
    </div>
  );
}

export default MasaAsistani;
