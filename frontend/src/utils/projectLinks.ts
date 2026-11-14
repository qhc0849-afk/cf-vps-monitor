// Default repository used for agent install commands and GitHub links.
// Fork deployments override it at build time with VITE_CF_MONITOR_REPOSITORY
// (for example a Workers Builds build variable); the fallback keeps the
// upstream default when the variable is unset or blank. The `?.` guard keeps
// this module importable outside Vite (plain Node test imports), where
// import.meta.env does not exist.
const configuredRepository = import.meta.env?.VITE_CF_MONITOR_REPOSITORY?.trim();
export const CF_MONITOR_REPOSITORY = configuredRepository ? configuredRepository : 'kadidalax/cf-vps-monitor';
export const CF_MONITOR_GITHUB_URL = `https://github.com/${CF_MONITOR_REPOSITORY}`;
