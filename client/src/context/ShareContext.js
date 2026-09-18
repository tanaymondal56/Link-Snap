import { createContext, useContext } from 'react';

export const ShareContext = createContext(null);

export const useShare = () => {
  const context = useContext(ShareContext);
  if (!context) {
    throw new Error('useShare must be used within a ShareModalProvider');
  }
  return context;
};
