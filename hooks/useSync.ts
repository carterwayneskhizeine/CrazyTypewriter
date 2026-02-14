import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { User, SyncStatus } from '../types';

interface UseSyncOptions {
  user: User | null;
  text: string;
  onContentReceived: (content: string) => void;
  onConflict?: (serverContent: string) => void;
  debounceMs?: number;
}

export function useSync({
  user,
  text,
  onContentReceived,
  onConflict,
  debounceMs = 5000
}: UseSyncOptions) {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    connected: false,
    syncing: false,
    lastSyncedAt: null,
    pendingChanges: false,
    conflictDetected: false
  });

  const socketRef = useRef<Socket | null>(null);
  const syncTimeoutRef = useRef<number | null>(null);
  const clientVersionRef = useRef<number>(0);
  const isUpdatingRef = useRef<boolean>(false); // Prevent update loops

  // Generate or retrieve device ID from localStorage
  const getDeviceId = useCallback(() => {
    let deviceId = localStorage.getItem('sync_device_id');
    if (!deviceId) {
      deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('sync_device_id', deviceId);
    }
    return deviceId;
  }, []);

  // Sync content to server
  const syncContent = useCallback((content: string) => {
    if (!socketRef.current?.connected || !user) return;

    setSyncStatus(prev => ({ ...prev, syncing: true }));

    socketRef.current.emit('content:update', {
      content,
      version: clientVersionRef.current,
      deviceId: getDeviceId()
    });
  }, [user, getDeviceId]);

  // Manual sync trigger
  const manualSync = useCallback(() => {
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }
    syncContent(text);
  }, [text, syncContent]);

  // Initialize WebSocket connection
  useEffect(() => {
    if (!user) {
      socketRef.current?.disconnect();
      setSyncStatus({
        connected: false,
        syncing: false,
        lastSyncedAt: null,
        pendingChanges: false,
        conflictDetected: false
      });
      return;
    }

    const socket = io({
      path: '/socket.io/',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      withCredentials: true,
      auth: {
        userId: parseInt(user.id, 10) || 1,
        username: user.email
      }
    });

    socket.on('connect', () => {
      console.log('[Sync] Connected to server');
      setSyncStatus(prev => ({ ...prev, connected: true }));
    });

    socket.on('disconnect', () => {
      console.log('[Sync] Disconnected from server');
      setSyncStatus(prev => ({ ...prev, connected: false }));
    });

    socket.on('connect_error', (error) => {
      console.error('[Sync] Connection error:', error);
    });

    socket.on('content:loaded', ({ content, version }: { content: string; version: number }) => {
      console.log('[Sync] Initial content loaded, version:', version);
      clientVersionRef.current = version;
      isUpdatingRef.current = true;
      onContentReceived(content);
      // Delay resetting flag to prevent triggering sync
      setTimeout(() => { isUpdatingRef.current = false; }, 100);
      setSyncStatus(prev => ({
        ...prev,
        lastSyncedAt: new Date(),
        pendingChanges: false
      }));
    });

    socket.on('content:updated', ({ content, version, fromDeviceId }: { content: string; version: number; fromDeviceId: string }) => {
      // Ignore if it's from this device
      if (fromDeviceId === getDeviceId()) {
        console.log('[Sync] Received update from this device, ignoring');
        return;
      }

      console.log('[Sync] Received content update from device:', fromDeviceId);
      clientVersionRef.current = version;
      isUpdatingRef.current = true;
      onContentReceived(content);
      // Delay resetting flag to prevent triggering sync
      setTimeout(() => { isUpdatingRef.current = false; }, 100);
      setSyncStatus(prev => ({
        ...prev,
        lastSyncedAt: new Date(),
        pendingChanges: false
      }));
    });

    socket.on('sync:success', ({ version, timestamp }: { version: number; timestamp: string }) => {
      console.log('[Sync] Sync successful, version:', version);
      clientVersionRef.current = version;
      setSyncStatus(prev => ({
        ...prev,
        syncing: false,
        lastSyncedAt: new Date(timestamp),
        pendingChanges: false
      }));
    });

    socket.on('sync:conflict', ({ serverVersion, serverContent, clientVersion }: { serverVersion: number; serverContent: string; clientVersion: number }) => {
      console.warn('[Sync] Conflict detected! Server version:', serverVersion, 'Client version:', clientVersion);
      setSyncStatus(prev => ({ ...prev, conflictDetected: true, syncing: false }));
      if (onConflict) {
        onConflict(serverContent);
      }
    });

    socket.on('sync:error', ({ message }: { message: string }) => {
      console.error('[Sync] Sync error:', message);
      setSyncStatus(prev => ({ ...prev, syncing: false, conflictDetected: true }));
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, [user, onContentReceived, onConflict, getDeviceId]);

  // Request initial content load
  useEffect(() => {
    if (!user || !socketRef.current?.connected) return;

    // Request current content from server
    socketRef.current.emit('sync:request');
  }, [user]);

  // Debounced sync on text change
  useEffect(() => {
    if (!user || !syncStatus.connected || isUpdatingRef.current) return;

    setSyncStatus(prev => ({ ...prev, pendingChanges: true }));

    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    syncTimeoutRef.current = window.setTimeout(() => {
      syncContent(text);
    }, debounceMs);

    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [text, user, syncStatus.connected, debounceMs, syncContent]);

  return {
    syncStatus,
    manualSync
  };
}
