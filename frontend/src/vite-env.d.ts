/// <reference types="vite/client" />

declare const __BUILD_TIME__: string;

interface ImportMetaEnv {
  /** Build-time override for the repository used in install commands; see projectLinks.ts. */
  readonly VITE_CF_MONITOR_REPOSITORY?: string;
}
