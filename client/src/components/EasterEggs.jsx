import { useEffect, useCallback, useRef, useState } from 'react';

// Konami Code sequence (defined outside component to avoid dependency issues)
const KONAMI_CODE = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA'];

// ========================================
// EASTER EGGS COMPONENT
// ========================================

const EasterEggs = () => {
  const [showCredits, setShowCredits] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const typedKeys = useRef('');
  const konamiIndex = useRef(0);
  const tildeCount = useRef(0);
  const logoClickCount = useRef(0);

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

  // Spooky mode (disabled - uncomment if needed)
  // const triggerSpooky = useCallback(() => {
  //   document.body.classList.add('spooky-mode');
  //   console.log('%c👻 Welcome to the midnight zone...', 'color: purple; font-size: 20px;');
  // }, []);

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
      alert('🌌 The Answer to the Ultimate Question of Life, the Universe, and Everything!');
      typedKeys.current = '';
    } else if (typed.endsWith('404')) {
      alert('🔍 Error 404: Easter egg not fo— wait, you found it!');
      typedKeys.current = '';
    } else if (typed.endsWith('500')) {
      document.body.style.transform = 'rotate(2deg)';
      alert('💥 OH NO! Server crashed! Just kidding 😄');
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
  }, [triggerConfetti, triggerMatrix, triggerDisco, triggerParty, playBeep, playStartupSound, triggerSnow]);

  // ========================================
  // CONSOLE EASTER EGGS
  // ========================================

  useEffect(() => {
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
    console.log('%c🎮 Try typing: matrix, disco, party, beep, 42, 404, 500', 'color: #ec4899; font-size: 11px;');
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

    // Seasonal effects are DISABLED by default
    // Uncomment below to enable automatic seasonal effects:
    
    // const now = new Date();
    // const hour = now.getHours();
    // const month = now.getMonth();
    // const day = now.getDate();

    // Midnight spooky mode (11 PM - 1 AM)
    // if (hour >= 23 || hour <= 1) {
    //   triggerSpooky();
    // }

    // Christmas snow (December 20-31)
    // if (month === 11 && day >= 20) {
    //   setTimeout(() => triggerSnow(), 2000);
    // }
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

  // ========================================
  // STYLES
  // ========================================

  useEffect(() => {
    const style = document.createElement('style');
    style.id = 'easter-egg-styles';
    style.textContent = `
      @keyframes confetti-fall {
        0% { transform: translateY(0) rotate(0deg); opacity: 1; }
        100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
      }
      
      @keyframes snow-fall {
        0% { transform: translateY(0) translateX(0); }
        100% { transform: translateY(100vh) translateX(${Math.random() * 100 - 50}px); }
      }
      
      .disco-mode {
        animation: disco-colors 0.5s infinite;
      }
      
      @keyframes disco-colors {
        0% { filter: hue-rotate(0deg); }
        100% { filter: hue-rotate(360deg); }
      }
      
      .party-mode {
        animation: party-shake 0.1s infinite;
      }
      
      @keyframes party-shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-2px); }
        75% { transform: translateX(2px); }
      }
      
      .spooky-mode {
        filter: sepia(20%) saturate(80%);
      }
      
      .credits-modal {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 99999;
        animation: fade-in 0.3s ease;
      }
      
      @keyframes fade-in {
        from { opacity: 0; }
        to { opacity: 1; }
      }
    `;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  // ========================================
  // RENDER
  // ========================================

  return (
    <>
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
    </>
  );
};

export default EasterEggs;
