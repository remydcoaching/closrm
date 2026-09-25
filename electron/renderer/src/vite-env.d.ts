/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_CLOSRM_API_BASE_URL: string
  readonly VITE_CLOSRM_WEB_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
