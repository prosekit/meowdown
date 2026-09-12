interface ViteTypeOptions {
  strictImportMetaEnv: unknown
}

interface ImportMetaEnv {
  readonly VITE_MEOWDOWN_PERF: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
