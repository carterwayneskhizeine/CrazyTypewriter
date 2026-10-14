import { useState, useEffect, useCallback } from 'react';
import { User, Workspace } from '../types';

const STORAGE_KEY = 'crazytypewriter_v1_selected_workspace_id';

interface UseWorkspacesOptions {
  user: User | null;
}

// Fetch the logged-in user's WhiteNote workspaces and track the send target.
// Selection persists per-device in localStorage; falls back to the account's
// default workspace, then to the first entry, then to server-side defaulting.
export function useWorkspaces({ user }: UseWorkspacesOptions) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedWorkspaceId, setSelectedWorkspaceIdState] = useState<string | null>(null);

  const setSelectedWorkspaceId = useCallback((id: string | null) => {
    setSelectedWorkspaceIdState(id);
    if (id) {
      localStorage.setItem(STORAGE_KEY, id);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/workspaces', {
        credentials: 'include',
      });
      if (!response.ok) {
        // 401 etc: leave list empty; App handles session expiry globally
        setWorkspaces([]);
        return;
      }
      const json = await response.json();
      const list: Workspace[] = Array.isArray(json?.data) ? json.data : [];
      setWorkspaces(list);
    } catch (err) {
      console.error('Failed to fetch workspaces:', err);
      setError('Failed to load workspaces');
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Fetch workspaces on login
  useEffect(() => {
    if (!user) {
      setWorkspaces([]);
      setSelectedWorkspaceIdState(null);
      setError(null);
      setLoading(false);
      return;
    }
    refresh();
  }, [user, refresh]);

  // Resolve default selection once the list arrives
  useEffect(() => {
    if (!user || workspaces.length === 0) return;
    setSelectedWorkspaceIdState((current) => {
      if (current && workspaces.some((w) => w.id === current)) return current;
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && workspaces.some((w) => w.id === stored)) return stored;
      const fallback = workspaces.find((w) => w.isDefault) ?? workspaces[0];
      return fallback ? fallback.id : null;
    });
  }, [user, workspaces]);

  return {
    workspaces,
    loading,
    error,
    selectedWorkspaceId,
    setSelectedWorkspaceId,
    refresh,
  };
}
