import React, { createContext, useContext, useSyncExternalStore, ReactNode } from 'react';
import { DocuReviewData } from '../types';
import { subscribe, getSnapshot, loadFromLocalStorage } from '../services/localStore';

const StoreContext = createContext<DocuReviewData | undefined>(undefined);

export function StoreProvider({ children }: { children: ReactNode }) {
    // Load from localStorage on first mount
    React.useEffect(() => {
        loadFromLocalStorage();
    }, []);

    const data = useSyncExternalStore(subscribe, getSnapshot);

    return (
        <StoreContext.Provider value={data}>
            {children}
        </StoreContext.Provider>
    );
}

export function useStore(): DocuReviewData {
    const ctx = useContext(StoreContext);
    if (!ctx) throw new Error('useStore must be used within StoreProvider');
    return ctx;
}
