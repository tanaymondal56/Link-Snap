import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Heart, Coffee, Star, Sparkles } from 'lucide-react';

// ========================================
// CREDITS PAGE - Easter Egg
// ========================================

export const CreditsPage = () => {
  const navigate = useNavigate();
  const [showConfetti, setShowConfetti] = useState(true);

  useEffect(() => {
    setTimeout(() => setShowConfetti(false), 5000);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center p-4">
      {showConfetti && <Confetti />}
      <div className="text-center text-white max-w-lg">
        <Sparkles className="w-16 h-16 mx-auto mb-6 text-yellow-400 animate-pulse" />
        <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">
          Link-Snap
        </h1>
        <p className="text-xl text-gray-300 mb-8">URL Shortener with Superpowers ⚡</p>
        
        <div className="space-y-4 mb-8">
          <p className="text-gray-400">Built with ❤️ and ☕</p>
          <p className="text-gray-500 text-sm">By passionate developers who love clean code</p>
        </div>
        
        <div className="flex justify-center gap-4 mb-8">
          <Star className="w-6 h-6 text-yellow-400" />
          <Heart className="w-6 h-6 text-red-400" />
          <Coffee className="w-6 h-6 text-amber-400" />
        </div>
        
        <p className="text-gray-500 text-sm mb-8">🥚 You found the secret credits page!</p>
        
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors"
        >
          <ArrowLeft size={18} />
          Back to App
        </button>
      </div>
    </div>
  );
};

// ========================================
// TIMELINE PAGE - Easter Egg
// ========================================

export const TimelinePage = () => {
  const navigate = useNavigate();
  
  const timeline = [
    { date: 'Day 1', event: '💡 The idea was born', color: 'purple' },
    { date: 'Week 1', event: '🎨 Design & wireframes', color: 'blue' },
    { date: 'Week 2', event: '⚡ Core functionality', color: 'yellow' },
    { date: 'Week 3', event: '🔐 Auth & security', color: 'green' },
    { date: 'Week 4', event: '📊 Analytics dashboard', color: 'pink' },
    { date: 'Week 5', event: '🎉 Easter eggs added!', color: 'red' },
    { date: 'Now', event: '🚀 You found this page!', color: 'purple' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 flex items-center justify-center p-4">
      <div className="text-center text-white max-w-lg">
        <h1 className="text-4xl font-bold mb-8 bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
          📅 Project Timeline
        </h1>
        
        <div className="space-y-4 mb-8 text-left">
          {timeline.map((item, i) => (
            <div key={i} className="flex items-center gap-4 p-3 bg-gray-800/50 rounded-lg">
              <div className={`w-3 h-3 rounded-full bg-${item.color}-400`} />
              <span className="text-gray-400 font-mono text-sm w-20">{item.date}</span>
              <span className="text-white">{item.event}</span>
            </div>
          ))}
        </div>
        
        <p className="text-gray-500 text-sm mb-8">🥚 Secret timeline unlocked!</p>
        
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
        >
          <ArrowLeft size={18} />
          Back to App
        </button>
      </div>
    </div>
  );
};

// ========================================
// THANKS PAGE - Easter Egg
// ========================================

export const ThanksPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-green-900 to-gray-900 flex items-center justify-center p-4">
      <div className="text-center text-white max-w-lg">
        <Heart className="w-16 h-16 mx-auto mb-6 text-red-400 animate-pulse" />
        <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
          Thank You! 💚
        </h1>
        
        <div className="space-y-4 mb-8 text-gray-300">
          <p>Thank you for using Link-Snap!</p>
          <p>Thank you for exploring and finding this easter egg!</p>
          <p>Thank you for being awesome! 🌟</p>
        </div>
        
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="p-4 bg-gray-800/50 rounded-lg">
            <div className="text-2xl">🔗</div>
            <div className="text-xs text-gray-500 mt-1">Links</div>
          </div>
          <div className="p-4 bg-gray-800/50 rounded-lg">
            <div className="text-2xl">📊</div>
            <div className="text-xs text-gray-500 mt-1">Analytics</div>
          </div>
          <div className="p-4 bg-gray-800/50 rounded-lg">
            <div className="text-2xl">❤️</div>
            <div className="text-xs text-gray-500 mt-1">Love</div>
          </div>
        </div>
        
        <p className="text-gray-500 text-sm mb-8">🥚 You found the gratitude page!</p>
        
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-500 rounded-lg transition-colors"
        >
          <ArrowLeft size={18} />
          Back to App
        </button>
      </div>
    </div>
  );
};

// ========================================
// DEV/NULL PAGE - Funny Job Application
// ========================================

export const DevNullPage = () => {
  const navigate = useNavigate();
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
    // Play error sound
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 150;
      gain.gain.value = 0.2;
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch {
      // AudioContext not available
    }
  };

  return (
    <div className="min-h-screen bg-black text-green-400 font-mono p-4 flex flex-col items-center justify-center">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">$ /dev/null</h1>
          <p className="text-green-600">Link-Snap Career Portal™</p>
        </div>

        {!submitted ? (
          <div className="bg-gray-900 border border-green-800 rounded-lg p-6">
            <h2 className="text-xl mb-4 text-green-300">📝 Job Application Form</h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-green-600 mb-1">Full Name *</label>
                <input type="text" placeholder="Your name (we won't read it)" 
                  className="w-full bg-black border border-green-800 rounded px-3 py-2 text-green-400 focus:border-green-500 focus:outline-none" />
              </div>
              
              <div>
                <label className="block text-sm text-green-600 mb-1">Resume *</label>
                <div className="border-2 border-dashed border-green-800 rounded p-4 text-center text-green-700">
                  Drag your resume here<br/>
                  <span className="text-xs">(It will be sent directly to /dev/null)</span>
                </div>
              </div>
              
              <div>
                <label className="block text-sm text-green-600 mb-1">P=NP Proof *</label>
                <textarea placeholder="Attach your proof here..." rows={3}
                  className="w-full bg-black border border-green-800 rounded px-3 py-2 text-green-400 focus:border-green-500 focus:outline-none" />
              </div>
              
              <div>
                <label className="block text-sm text-green-600 mb-1">First 1000 digits of π *</label>
                <textarea placeholder="3.14159265358979323846..." rows={2}
                  className="w-full bg-black border border-green-800 rounded px-3 py-2 text-green-400 focus:border-green-500 focus:outline-none" />
              </div>
              
              <div>
                <label className="block text-sm text-green-600 mb-1">Tabs vs Spaces Essay (500 words) *</label>
                <textarea placeholder="Explain why tabs are superior..." rows={3}
                  className="w-full bg-black border border-green-800 rounded px-3 py-2 text-green-400 focus:border-green-500 focus:outline-none" />
              </div>
              
              <div className="text-xs text-green-800 mt-4">
                * All fields are required and will be carefully reviewed by our /dev/null team
              </div>
              
              <button type="submit"
                className="w-full bg-green-900 hover:bg-green-800 text-green-400 py-3 rounded font-bold transition-colors">
                Submit to Void →
              </button>
            </form>
          </div>
        ) : (
          <div className="bg-gray-900 border border-red-800 rounded-lg p-6 text-center">
            <div className="text-6xl mb-4">🕳️</div>
            <h2 className="text-2xl text-red-400 mb-2">Application Received!</h2>
            <p className="text-green-600 mb-4">Your resume has been successfully sent to /dev/null</p>
            <div className="text-xs text-gray-600 space-y-1">
              <p>Status: <span className="text-red-500">DISCARDED</span></p>
              <p>Response time: Never</p>
              <p>Hiring probability: 0.00%</p>
            </div>
            <p className="text-green-700 mt-6 text-sm">
              Thank you for your interest in Link-Snap!<br/>
              (We're not actually hiring, but we appreciate the effort 😄)
            </p>
          </div>
        )}
        
        <button
          onClick={() => navigate('/')}
          className="mt-6 text-green-700 hover:text-green-500 text-sm flex items-center gap-2 mx-auto"
        >
          <ArrowLeft size={14} />
          Back to reality
        </button>
      </div>
    </div>
  );
};

// ========================================
// CONFETTI COMPONENT
// ========================================

const Confetti = () => {
  useEffect(() => {
    const colors = ['#ff0', '#f0f', '#0ff', '#0f0', '#f00', '#00f', '#ff8800'];
    for (let i = 0; i < 100; i++) {
      const confetti = document.createElement('div');
      confetti.style.cssText = `
        position: fixed;
        width: ${5 + Math.random() * 10}px;
        height: ${5 + Math.random() * 10}px;
        background: ${colors[Math.floor(Math.random() * colors.length)]};
        left: ${Math.random() * 100}vw;
        top: -20px;
        border-radius: ${Math.random() > 0.5 ? '50%' : '0'};
        z-index: 99999;
        pointer-events: none;
        animation: confetti-fall ${3 + Math.random() * 4}s linear forwards;
      `;
      document.body.appendChild(confetti);
      setTimeout(() => confetti.remove(), 7000);
    }
  }, []);
  
  return null;
};

// ========================================
// FUNNY 404 PAGE - Dedicated
// ========================================

export const Funny404Page = () => {
  const navigate = useNavigate();
  const [clicks, setClicks] = useState(0);
  const [fact, setFact] = useState(0);
  
  const funFacts = [
    "The 404 error code was named after Room 404 at CERN, where the original web servers were located. (Well, maybe... it's a fun legend!)",
    "The first website ever created is still online at info.cern.ch",
    "There are over 1.9 billion websites in the world, but only ~400 million are active.",
    "The @ symbol was almost replaced with the word 'at' in emails.",
    "The first domain ever registered was symbolics.com on March 15, 1985.",
    "Google's name comes from 'googol' - the number 1 followed by 100 zeros.",
    "The average webpage is now over 2MB in size. Remember dial-up?",
  ];
  
  const playTrombone = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const notes = [300, 280, 260, 200];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = 'sawtooth';
        gain.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.3);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.3 + 0.3);
        osc.start(ctx.currentTime + i * 0.3);
        osc.stop(ctx.currentTime + i * 0.3 + 0.35);
      });
    } catch {
      // AudioContext not available
    }
    setClicks(c => c + 1);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-red-900/20 to-gray-900 flex flex-col items-center justify-center p-4 text-white">
      <div className="max-w-2xl w-full text-center">
        {/* Big animated 404 */}
        <div 
          className="cursor-pointer mb-6 select-none"
          onClick={playTrombone}
        >
          <div className="text-9xl font-black text-red-500/80 hover:text-red-400 transition-colors animate-pulse">
            404
          </div>
          <p className="text-xs text-gray-600 mt-2">Click for sad trombone 🎺 ({clicks} plays)</p>
        </div>
        
        {/* Fun message */}
        <h1 className="text-3xl font-bold mb-4 bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">
          Oops! This page went on vacation 🏖️
        </h1>
        
        <p className="text-gray-400 mb-8">
          We looked everywhere: under the server, behind the database, even asked the cloud. 
          Nothing. This page is officially missing.
        </p>
        
        {/* What you can do section */}
        <div className="bg-gray-800/50 rounded-xl p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-300 mb-4">Here's what you can do:</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <button 
              onClick={() => navigate('/')}
              className="p-4 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 rounded-lg transition-colors"
            >
              <div className="text-2xl mb-2">🏠</div>
              <div className="text-sm">Go Home</div>
            </button>
            <button 
              onClick={() => navigate(-1)}
              className="p-4 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 rounded-lg transition-colors"
            >
              <div className="text-2xl mb-2">⬅️</div>
              <div className="text-sm">Go Back</div>
            </button>
            <button 
              onClick={() => navigate('/dashboard')}
              className="p-4 bg-green-600/20 hover:bg-green-600/30 border border-green-500/30 rounded-lg transition-colors"
            >
              <div className="text-2xl mb-2">📊</div>
              <div className="text-sm">Dashboard</div>
            </button>
          </div>
        </div>
        
        {/* Fun facts section */}
        <div className="bg-gray-800/30 rounded-xl p-6 mb-8">
          <h3 className="text-sm text-gray-500 mb-2">💡 While you're here, did you know?</h3>
          <p className="text-gray-300 text-sm mb-4">{funFacts[fact]}</p>
          <button 
            onClick={() => setFact((fact + 1) % funFacts.length)}
            className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
          >
            Another fact →
          </button>
        </div>
        
        {/* ASCII art */}
        <pre className="text-xs text-gray-700 font-mono mb-4 hidden sm:block">
{`
    ╭━━━━━━━━━━━━━━━━━━━━╮
    ┃   Page Not Found   ┃
    ┃      (╯°□°)╯︵ ┻━┻  ┃
    ╰━━━━━━━━━━━━━━━━━━━━╯
`}
        </pre>
        
        <p className="text-xs text-gray-600">
          Error Code: 404 • Time: {new Date().toLocaleTimeString()} • 
          <span className="text-purple-400 cursor-pointer hover:text-purple-300" onClick={() => navigate('/easter/credits')}> 🥚</span>
        </p>
      </div>
    </div>
  );
};

export const TeapotPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#F0E6D2] text-[#4A3B2A] flex flex-col items-center justify-center p-4 font-mono">
      <div className="max-w-md w-full text-center">
        <h1 className="text-6xl font-bold mb-4">418</h1>
        <h2 className="text-2xl font-bold mb-8 uppercase tracking-widest">I'm a teapot</h2>
        
        {/* Teapot Animation */}
        <div className="relative w-48 h-48 mx-auto mb-12 group cursor-pointer">
          <div className="text-9xl transform origin-bottom-right transition-transform duration-700 hover:rotate-[-45deg] relative z-10">
            🫖
          </div>
          {/* Steam */}
          <div className="absolute top-0 right-0 -mt-8 mr-4 opacity-0 group-hover:opacity-60 transition-opacity duration-1000 delay-300">
             <div className="w-4 h-12 bg-gray-400/30 rounded-full blur-md animate-steam-rise"></div>
          </div>
          <div className="absolute top-0 right-4 -mt-12 mr-4 opacity-0 group-hover:opacity-60 transition-opacity duration-1000 delay-500">
             <div className="w-4 h-12 bg-gray-400/30 rounded-full blur-md animate-steam-rise" style={{ animationDelay: '0.5s' }}></div>
          </div>
          
          {/* Coffee/Tea Drop */}
          <div className="absolute bottom-4 -left-8 text-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-700 animate-drop">
            💧
          </div>
        </div>

        <p className="text-lg mb-8 font-serif italic">
          "The requested entity body is short and stout. Tip me over and pour me out."
        </p>

        <div className="space-y-4">
          <p className="text-sm border-t border-[#4A3B2A]/20 pt-4">
            <span className="font-bold">Error:</span> Cannot brew coffee because I am a teapot.
          </p>
          <p className="text-xs opacity-75">Ref: HTCPCP/1.0 (RFC 2324)</p>
        </div>

        <button
          onClick={() => navigate('/')}
          className="mt-12 px-6 py-2 border-2 border-[#4A3B2A] rounded-full hover:bg-[#4A3B2A] hover:text-[#F0E6D2] transition-colors"
        >
          Return to Brewing
        </button>
      </div>

      <style>{`
        @keyframes steam-rise {
          0% { transform: translateY(0) scaleX(1); opacity: 0; }
          50% { opacity: 1; }
          100% { transform: translateY(-20px) scaleX(2); opacity: 0; }
        }
        @keyframes drop {
          0% { transform: translateY(0); opacity: 0; }
          50% { opacity: 1; }
          100% { transform: translateY(20px); opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default { CreditsPage, TimelinePage, ThanksPage, DevNullPage, Funny404Page, TeapotPage };

