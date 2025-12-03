import { createContext, useContext } from 'react';

// Context for the confirm dialog
export const ConfirmContext = createContext(null);

// Hook to use the confirm dialog
export const useConfirm = () => {
    const context = useContext(ConfirmContext);
    if (!context) {
        throw new Error('useConfirm must be used within a ConfirmDialogProvider');
    }
    return context.confirm;
};
