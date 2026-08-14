// https://github.com/vitejs/vite/blob/v8.0.0/docs/guide/env-and-mode.md?plain=1#L125-L146

interface ViteTypeOptions {
  // By adding this line, you can make the type of ImportMetaEnv strict
  // to disallow unknown keys.
  strictImportMetaEnv: unknown
}

interface ImportMetaEnv {
  readonly VITE_FUZZ_SEED: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
