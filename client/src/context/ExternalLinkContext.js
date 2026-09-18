import { createContext, useContext } from 'react';

export const ExternalLinkContext = createContext(null);

export const useExternalLink = () => {
  const context = useContext(ExternalLinkContext);
  if (!context) {
    throw new Error('useExternalLink must be used within an ExternalLinkProvider');
  }
  return context;
};
