// Default repository used for agent install commands and GitHub links.
// Fork deployments override it at build time with VITE_CF_MONITOR_REPOSITORY
// (for example a Workers Builds build variable), which vite.config.ts injects
// as the __CF_MONITOR_REPOSITORY__ define; the fallback keeps the upstream
// default when the variable is unset or blank.
//
// This module must not use import.meta: frontend/test/helpers/production-module.mjs
// loads it through vm.runInNewContext as a classic script, where import.meta
// is a parse-time error (a `?.` guard cannot help). The typeof guard keeps
// this module importable when the define is absent (plain Node test imports),
// where the global does not exist.
const configuredRepository = (typeof __CF_MONITOR_REPOSITORY__ !== 'undefined' ? __CF_MONITOR_REPOSITORY__ : '').trim();
export const CF_MONITOR_REPOSITORY = configuredRepository ? configuredRepository : 'kadidalax/cf-vps-monitor';
export const CF_MONITOR_GITHUB_URL = `https://github.com/${CF_MONITOR_REPOSITORY}`;
