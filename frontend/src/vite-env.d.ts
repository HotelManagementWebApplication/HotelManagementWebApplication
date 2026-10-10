/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Public backend origin in production, e.g. https://api.example.com. */
  readonly VITE_API_BASE_URL?: string;
  /** Explicitly exposes demo account shortcuts in hosted demo builds. */
  readonly VITE_SHOW_DEMO_ACCOUNTS?: string;
}
