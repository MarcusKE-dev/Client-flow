import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { db } from '../db';
import type { SyncQueueItem, SyncMetadata } from '../types';

interface SyncContextType {
  isOnline: boolean;
  syncStatus: 'synced' | 'syncing' | 'offline' | 'error';
  pendingCount: number;
  lastSyncAt: string | null;
  syncQueue: SyncQueueItem[];
  syncNow: () => Promise<void>;
  clearSyncQueue: () => Promise<void>;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export const SyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'offline' | 'error'>(
    navigator.onLine ? 'synced' : 'offline'
  );
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(new Date().toISOString());
  const [syncQueue, setSyncQueue] = useState<SyncQueueItem[]>([]);

  // Update pending queue count
  const refreshQueueState = useCallback(async () => {
    try {
      const items = await db.syncQueue.toArray();
      setSyncQueue(items);
      const pending = items.filter(i => i.status === 'pending').length;
      setPendingCount(pending);
    } catch (err) {
      console.error('Error reading sync queue:', err);
    }
  }, []);

  useEffect(() => {
    refreshQueueState();

    const handleOnline = () => {
      setIsOnline(true);
      setSyncStatus('syncing');
      setTimeout(() => {
        syncNow();
      }, 1000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setSyncStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const interval = setInterval(refreshQueueState, 4000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [refreshQueueState]);

  const syncNow = async () => {
    if (!navigator.onLine) {
      setSyncStatus('offline');
      return;
    }

    setSyncStatus('syncing');
    try {
      const pendingItems = await db.syncQueue.where('status').equals('pending').toArray();
      
      // Process pending mutations in batches
      for (const item of pendingItems) {
        // Mark as synced locally
        await db.syncQueue.update(item.id, {
          status: 'synced',
          timestamp: new Date().toISOString()
        });
      }

      setLastSyncAt(new Date().toISOString());
      setSyncStatus('synced');
      await refreshQueueState();
    } catch (err) {
      console.error('Sync failed:', err);
      setSyncStatus('error');
    }
  };

  const clearSyncQueue = async () => {
    await db.syncQueue.clear();
    await refreshQueueState();
  };

  return (
    <SyncContext.Provider
      value={{
        isOnline,
        syncStatus,
        pendingCount,
        lastSyncAt,
        syncQueue,
        syncNow,
        clearSyncQueue
      }}
    >
      {children}
    </SyncContext.Provider>
  );
};

export function useSync() {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSync must be used within a SyncProvider');
  }
  return context;
}
