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
  id: number;
  username: string;
}

export interface LoginResponse {
  message: string;
  user: User;
}