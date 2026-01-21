import { lazy, Suspense, useState, useEffect } from 'react';

// Lazy load the heavy component
const PullToRefresh = lazy(() => import('./PullToRefresh'));

const LazyPullToRefresh = (props) => {
  const [isPWA, setIsPWA] = useState(false);

  useEffect(() => {
    const checkPWA = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                           window.navigator.standalone === true ||
                           document.referrer.includes('android-app://');
      setIsPWA(isStandalone);
    };
    
    checkPWA();
  }, []);

  // Don't even load or render the component if not PWA
  if (!isPWA) {
    return props.children;
  }

  return (
    <Suspense fallback={props.children}>
      <PullToRefresh {...props} />
    </Suspense>
  );
};

export default LazyPullToRefresh;
