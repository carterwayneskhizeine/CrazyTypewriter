export interface PowerConfig {
  gravity: number;
  particleCount: number;
  baseRadius: number;
  velocity: number;
  life: number;
  shakeIntensity: number;
  spawnHeightOffset: number;
}

export enum PowerLevel {
  None = 0,
  Power = 1,
  SuperPower = 2,
  ManyPower = 3
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
}

export interface Coordinates {
  top: number;
  left: number;
  height: number;
}

export interface User {
  id: string;
  name?: string;
  email: string;
}

export interface LoginResponse {
  message?: string;
  user?: User;
}

// Sync types
export interface SyncStatus {
  connected: boolean;
  syncing: boolean;
  lastSyncedAt: Date | null;
  pendingChanges: boolean;
  conflictDetected: boolean;
}

export interface DocumentVersion {
  version: number;
  content: string;
  lastModified: Date;
}