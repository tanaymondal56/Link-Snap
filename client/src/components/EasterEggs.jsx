import { useEffect, useCallback, useRef, useState } from 'react';
import Clippy from './EasterEggs/Clippy';

// Konami Code sequence (defined outside component to avoid dependency issues)
const KONAMI_CODE = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA'];

// ========================================
// EASTER EGGS COMPONENT
// ========================================

const EasterEggs = () => {
  // Guard to prevent console logs from running twice (React StrictMode)
  const hasLoggedRef = useRef(false);
  const [showCredits, setShowCredits] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const typedKeys = useRef('');
  const konamiIndex = useRef(0);
  const tildeCount = useRef(0);
  const logoClickCount = useRef(0);
  const [overlay, setOverlay] = useState(null);
  const [showClippy, setShowClippy] = useState(false);

  // ========================================
  // EFFECTS
  // ========================================

  // Confetti explosion
  const triggerConfetti = useCallback(() => {
    const colors = ['#ff0', '#f0f', '#0ff', '#0f0', '#f00', '#00f'];
    for (let i = 0; i < 150; i++) {
      const confetti = document.createElement('div');
      confetti.style.cssText = `
        position: fixed;
        width: 10px;
        height: 10px;
        background: ${colors[Math.floor(Math.random() * colors.length)]};
        left: ${Math.random() * 100}vw;
        top: -10px;
        border-radius: ${Math.random() > 0.5 ? '50%' : '0'};
        z-index: 99999;
        pointer-events: none;
        animation: confetti-fall ${2 + Math.random() * 3}s linear forwards;
      `;
      document.body.appendChild(confetti);
      setTimeout(() => confetti.remove(), 5000);
    }
  }, []);

  // Matrix rain effect
  const triggerMatrix = useCallback(() => {
    const canvas = document.createElement('canvas');
    canvas.id = 'matrix-canvas';
    canvas.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:99998;pointer-events:none;';
    document.body.appendChild(canvas);
    
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    const chars = 'LINKSNAP01アイウエオカキクケコサシスセソタチツテトナニヌネノ';
    const fontSize = 14;
    const columns = canvas.width / fontSize;
    const drops = Array(Math.floor(columns)).fill(1);
    
    const draw = () => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#0f0';
      ctx.font = `${fontSize}px monospace`;
      
      for (let i = 0; i < drops.length; i++) {
        const text = chars[Math.floor(Math.random() * chars.length)];
        ctx.fillText(text, i * fontSize, drops[i] * fontSize);
        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      }
    };
    
    const interval = setInterval(draw, 33);
    setTimeout(() => { clearInterval(interval); canvas.remove(); }, 8000);
  }, []);

  // Disco mode
  const triggerDisco = useCallback(() => {
    document.body.classList.add('disco-mode');
    setTimeout(() => document.body.classList.remove('disco-mode'), 10000);
  }, []);

  // Party mode (same as confetti but more)
  const triggerParty = useCallback(() => {
    triggerConfetti();
    document.body.classList.add('party-mode');
    setTimeout(() => document.body.classList.remove('party-mode'), 5000);
  }, [triggerConfetti]);

  // Snow effect
  const triggerSnow = useCallback(() => {
    for (let i = 0; i < 50; i++) {
      const snow = document.createElement('div');
      snow.innerHTML = '❄';
      snow.style.cssText = `
        position: fixed;
        left: ${Math.random() * 100}vw;
        top: -20px;
        font-size: ${10 + Math.random() * 20}px;
        color: white;
        z-index: 99999;
        pointer-events: none;
        animation: snow-fall ${5 + Math.random() * 10}s linear forwards;
        opacity: ${0.5 + Math.random() * 0.5};
      `;
      document.body.appendChild(snow);
      setTimeout(() => snow.remove(), 15000);
    }
  }, []);

  // Play beep sound
  const playBeep = useCallback(() => {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 800;
    gain.gain.value = 0.1;
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  }, []);

  // Play startup sound (tilde 3x)
  const playStartupSound = useCallback(() => {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      gain.gain.value = 0.1;
      osc.start(ctx.currentTime + i * 0.15);
      osc.stop(ctx.currentTime + i * 0.15 + 0.2);
    });
  }, []);

  // ========================================
  // KEYBOARD HANDLER
  // ========================================

  const handleKeyDown = useCallback((e) => {
    // Escape key closes overlay
    if (e.key === 'Escape' && overlay) {
      setOverlay(null);
      return;
    }

    // Track typed characters
    typedKeys.current += e.key.toLowerCase();
    if (typedKeys.current.length > 20) {
      typedKeys.current = typedKeys.current.slice(-20);
    }

    // Konami Code detection
    if (e.code === KONAMI_CODE[konamiIndex.current]) {
      konamiIndex.current++;
      if (konamiIndex.current === KONAMI_CODE.length) {
        console.log('%c🎮 KONAMI CODE ACTIVATED!', 'color: gold; font-size: 24px; font-weight: bold;');
        triggerConfetti();
        triggerParty();
        konamiIndex.current = 0;
      }
    } else {
      konamiIndex.current = 0;
    }

    // Tilde key counter
    if (e.key === '`' || e.key === '~') {
      tildeCount.current++;
      if (tildeCount.current >= 3) {
        playStartupSound();
        tildeCount.current = 0;
      }
    } else if (e.key !== 'Shift') {
      tildeCount.current = 0;
    }

    // Word triggers
    const typed = typedKeys.current;
    if (typed.endsWith('matrix')) {
      triggerMatrix();
      typedKeys.current = '';
    } else if (typed.endsWith('clippy') || typed.endsWith('help')) {
      setShowClippy(prev => !prev);
      typedKeys.current = '';
    } else if (typed.endsWith('disco')) {
      triggerDisco();
      typedKeys.current = '';
    } else if (typed.endsWith('party')) {
      triggerParty();
      typedKeys.current = '';
    } else if (typed.endsWith('beep')) {
      playBeep();
      typedKeys.current = '';
    } else if (typed.endsWith('42')) {
      setOverlay({
        title: '🌌 The Answer',
        message: 'The Answer to the Ultimate Question of Life, the Universe, and Everything is... 42.',
        type: 'mystical'
      });
      typedKeys.current = '';
    } else if (typed.endsWith('404')) {
      setOverlay({
        title: '🔍 Error 404',
        message: 'Easter egg not fo— wait, you found it! Nice detective work.',
        type: 'info'
      });
      typedKeys.current = '';
    } else if (typed.endsWith('500')) {
      document.body.style.transform = 'rotate(2deg)';
      setOverlay({
        title: '💥 KERNEL PANIC',
        message: 'CRITICAL SYSTEM FAILURE... Just kidding! 😄',
        type: 'danger'
      });
      setTimeout(() => document.body.style.transform = '', 2000);
      typedKeys.current = '';
    } else if (typed.endsWith('snow')) {
      triggerSnow();
      typedKeys.current = '';
    } else if (typed.endsWith('credits')) {
      setShowCredits(true);
      setTimeout(() => setShowCredits(false), 5000);
      typedKeys.current = '';
    }
  }, [triggerConfetti, triggerMatrix, triggerDisco, triggerParty, playBeep, playStartupSound, triggerSnow, overlay]);

  // ========================================
  // CONSOLE EASTER EGGS
  // ========================================

  useEffect(() => {
    // Prevent double-execution in React StrictMode
    if (hasLoggedRef.current) return;
    hasLoggedRef.current = true;

    // ASCII Art Logo
    console.log(`
%c
██╗     ██╗███╗   ██╗██╗  ██╗    ███████╗███╗   ██╗ █████╗ ██████╗ 
██║     ██║████╗  ██║██║ ██╔╝    ██╔════╝████╗  ██║██╔══██╗██╔══██╗
██║     ██║██╔██╗ ██║█████╔╝     ███████╗██╔██╗ ██║███████║██████╔╝
██║     ██║██║╚██╗██║██╔═██╗     ╚════██║██║╚██╗██║██╔══██║██╔═══╝ 
███████╗██║██║ ╚████║██║  ██╗    ███████║██║ ╚████║██║  ██║██║     
╚══════╝╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝    ╚══════╝╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝     
`, 'color: #8b5cf6; font-family: monospace;');
    
    console.log('%c🔗 Link-Snap - URL Shortener', 'color: #3b82f6; font-size: 16px; font-weight: bold;');
    console.log('%c⚠️ Warning: This app is highly addictive!', 'color: #f59e0b; font-size: 12px;');
    console.log('%c☕ Built with love and lots of coffee', 'color: #6b7280; font-size: 11px;');
    console.log('%c💼 We\'re NOT hiring! But if you insist... apply at /dev/null', 'color: #10b981; font-size: 11px;');
    console.log('%c   📧 Send your resume to /dev/null', 'color: #6b7280; font-size: 10px;');
    console.log('%c   📝 Include a 500-word essay on why tabs > spaces', 'color: #6b7280; font-size: 10px;');
    console.log('%c   🧪 Solve P=NP and attach proof', 'color: #6b7280; font-size: 10px;');
    console.log('%c   🎯 Recite π to 1000 digits in the interview', 'color: #6b7280; font-size: 10px;');
    console.log('%c   💰 Salary: Exposure and high-fives', 'color: #6b7280; font-size: 10px;');
    console.log('%c🎮 Try typing: matrix, disco, party, beep, 42, 404, 500, clippy', 'color: #ec4899; font-size: 11px;');
    console.log('%c🎯 Or try the Konami Code: ↑↑↓↓←→←→BA', 'color: #8b5cf6; font-size: 11px;');

    // Hidden window functions
    window.secret = () => {
      console.log('%c🥚 You found the secret!', 'color: gold; font-size: 20px;');
      triggerConfetti();
      return '🎉 Congratulations! You are a true developer!';
    };

    window.credits = () => {
      console.log('%c👨‍💻 Link-Snap Team', 'color: #8b5cf6; font-size: 16px; font-weight: bold;');
      console.log('Built by passionate developers');
      console.log('Special thanks to all contributors!');
      return '❤️ Thank you for using Link-Snap!';
    };

    window.party = () => {
      triggerParty();
      return '🎉 Party mode activated!';
    };
  }, [triggerConfetti, triggerParty]);

  // ========================================
  // KEYBOARD LISTENER
  // ========================================

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // ========================================
  // LOGO CLICK HANDLER (expose globally)
  // ========================================

  useEffect(() => {
    window.handleLogoClick = () => {
      logoClickCount.current++;
      if (logoClickCount.current >= 4) {
        setShowCredits(true);
        setCountdown(4);
        logoClickCount.current = 0;
        
        // Start countdown
        let remaining = 4;
        const interval = setInterval(() => {
          remaining--;
          setCountdown(remaining);
          if (remaining <= 0) {
            clearInterval(interval);
            setShowCredits(false);
          }
        }, 1000);
        
        return '🎉 Credits unlocked!';
      }
      return `Click ${4 - logoClickCount.current} more times...`;
    };
  }, []);

  return (
    <>
      {/* Styles for Overlay */}
      <style>{`
        .easter-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.85);
          backdrop-filter: blur(5px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100000;
          animation: overlay-fade 0.3s ease;
          font-family: 'Courier New', monospace;
        }

        .easter-card {
          background: #000;
          border: 2px solid #333;
          padding: 2rem;
          max-width: 500px;
          width: 90%;
          border-radius: 8px;
          box-shadow: 0 0 20px rgba(0,0,0,0.5);
          position: relative;
          overflow: hidden;
        }

        .easter-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0; height: 100%;
          background: repeating-linear-gradient(
            0deg,
            rgba(0, 0, 0, 0.15),
            rgba(0, 0, 0, 0.15) 1px,
            transparent 1px,
            transparent 2px
          );
          pointer-events: none;
        }

        .type-mystical { border-color: #8b5cf6; box-shadow: 0 0 30px rgba(139, 92, 246, 0.3); }
        .type-mystical h2 { color: #c4b5fd; text-shadow: 0 0 10px #8b5cf6; }

        .type-info { border-color: #3b82f6; box-shadow: 0 0 30px rgba(59, 130, 246, 0.3); }
        .type-info h2 { color: #93c5fd; text-shadow: 0 0 10px #3b82f6; }

        .type-danger { border-color: #ef4444; box-shadow: 0 0 30px rgba(239, 68, 68, 0.3); animation: shake 0.5s; }
        .type-danger h2 { color: #fca5a5; text-shadow: 0 0 10px #ef4444; }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
      `}</style>

      {/* Credits Modal */}
      {showCredits && (
        <div className="credits-modal">
          <div className="text-center text-white">
            <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
              🔗 Link-Snap
            </h1>
            <p className="text-xl mb-2">Built with ❤️ and ☕</p>
            <p className="text-gray-400 mb-4">You found the secret!</p>
            <div className="text-6xl font-bold text-purple-400 mb-2">{countdown}</div>
            <p className="text-sm text-gray-500">Closing in {countdown}s...</p>
          </div>
        </div>
      )}

      {/* Clippy */}
      {showClippy && <Clippy onClose={() => setShowClippy(false)} />}

      {/* New Custom Overlay */}
      {overlay && (
        <div className="easter-overlay" onClick={() => setOverlay(null)}>
          <div className={`easter-card type-${overlay.type}`} onClick={e => e.stopPropagation()}>
            <h2 className="text-2xl font-bold mb-4 uppercase tracking-wider">{overlay.title}</h2>
            <div className="text-gray-300 mb-6 text-lg leading-relaxed">
              {overlay.message}
            </div>
            <div className="text-center">
              <button 
                className="px-6 py-2 bg-gray-800 hover:bg-gray-700 text-white border border-gray-600 rounded transition-colors font-mono text-sm uppercase"
                onClick={() => setOverlay(null)}
              >
                [ Close ]
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default EasterEggs;
