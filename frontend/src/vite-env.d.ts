/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Public backend origin in production, e.g. https://api.example.com. */
  readonly VITE_API_BASE_URL?: string;
}
