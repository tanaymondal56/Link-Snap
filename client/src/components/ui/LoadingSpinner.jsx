export const GlobalLoadingFallback = ({ text = 'Loading...' }) => (
  <div
    className="min-h-[70dvh] flex items-center justify-center"
    role="status"
    aria-live="polite"
  >
    <div className="flex flex-col items-center gap-4">
      <div className="animate-spin rounded-full h-10 w-10 border-2 border-white/10 border-t-violet-500"></div>
      <div className="skeleton h-2.5 w-28 rounded-full bg-white/5"></div>
      <span className="sr-only">{text}</span>
    </div>
  </div>
);

export const DashboardLoadingFallback = ({ text = 'Loading...' }) => (
  <div className="flex items-center justify-center h-64">
    <div className="flex flex-col items-center gap-4">
      <div className="animate-spin rounded-full h-10 w-10 border-2 border-white/10 border-t-violet-500"></div>
      <span className="sr-only">{text}</span>
    </div>
  </div>
);
