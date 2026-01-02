/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_POST_HOST: string
  readonly VITE_SYNC_DEBOUNCE_MS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
