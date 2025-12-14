import { useState, useEffect } from 'react';

const QUOTES = [
  "It looks like you're trying to ignore me. Would you like some help with that?",
  "I see you're scrolling. Nice scrolling technique.",
  "Have you tried turning it off and on again?",
  "It looks like you're writing code. Would you like me to add some bugs?",
  "Don't worry, I'm not listening. *wink*",
  "I can help you shorten that URL, or I can just stare at you.",
  "Pro tip: Hydration is key. Go drink some water.",
  "ERROR 404: Motivation not found.",
  "Are you sure you want to do that? I wouldn't.",
];

const Clippy = ({ onClose }) => {
  const [quote, setQuote] = useState("Hi! I'm Clippy. Need a hand?");
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    // Random quote every 10 seconds
    const interval = setInterval(() => {
      setQuote(QUOTES[Math.floor(Math.random() * QUOTES.length)]);
      setIsAnimating(true);
      setTimeout(() => setIsAnimating(false), 500); // Bounce animation trigger
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-[99999] flex flex-col items-end animate-slide-up font-sans">
      {/* Speech Bubble */}
      <div className="bg-[#FFFFCC] border border-black rounded p-3 mb-2 relative max-w-[200px] shadow-lg text-sm text-black">
        {quote}
        <div className="absolute w-3 h-3 bg-[#FFFFCC] border-b border-r border-black rotate-45 bottom-[-6px] right-8"></div>
      </div>

      {/* Clippy SVG */}
      <div 
        className={`relative w-24 h-24 hover:scale-110 transition-transform cursor-pointer ${isAnimating ? 'animate-bounce' : ''}`}
        onClick={() => setQuote(QUOTES[Math.floor(Math.random() * QUOTES.length)])}
      >
        <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-lg">
           {/* Eyes */}
           <circle cx="35" cy="30" r="5" fill="black" />
           <circle cx="37" cy="28" r="1.5" fill="white" />
           
           <circle cx="65" cy="30" r="5" fill="black" />
           <circle cx="67" cy="28" r="1.5" fill="white" />

           {/* Eyebrows */}
           <path d="M 30 20 Q 35 15 40 20" stroke="black" strokeWidth="2" fill="none" />
           <path d="M 60 20 Q 65 15 70 20" stroke="black" strokeWidth="2" fill="none" />

           {/* Body (Paperclip shape) */}
           <path 
             d="M 20 80 L 20 40 Q 20 10 50 10 Q 80 10 80 40 L 80 80 Q 80 90 65 90 Q 50 90 50 80 L 50 45 Q 50 35 60 35 Q 70 35 70 45 L 70 70" 
             stroke="#C0C0C0" 
             strokeWidth="8" 
             fill="none" 
             strokeLinecap="round"
           />
           {/* Outline for definition */}
           <path 
             d="M 20 80 L 20 40 Q 20 10 50 10 Q 80 10 80 40 L 80 80 Q 80 90 65 90 Q 50 90 50 80 L 50 45 Q 50 35 60 35 Q 70 35 70 45 L 70 70" 
             stroke="black" 
             strokeWidth="2" 
             fill="none" 
             strokeLinecap="round"
             style={{ opacity: 0.5 }}
           />
        </svg>

        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600 font-bold"
        >
          ×
        </button>
      </div>

      <style>{`
        @keyframes slide-up {
          from { transform: translateY(100px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default Clippy;
