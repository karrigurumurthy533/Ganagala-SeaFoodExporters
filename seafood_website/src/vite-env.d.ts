/// <reference types="vite/client" />

declare module '*.css';

interface ImportMetaEnv {
  readonly VITE_PAYMENTS_API_URL?: string;
  readonly VITE_CASHFREE_ENV?: string;
  readonly VITE_CASHFREE_SDK_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
