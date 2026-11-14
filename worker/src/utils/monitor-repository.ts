/**
 * The GitHub repository used for agent install-script redirects and update
 * checks. Fork deployments override it with the CF_MONITOR_REPOSITORY Worker
 * variable; anything else falls back to the upstream default so a missing or
 * malformed value can never break install links or update checks.
 */
export const DEFAULT_MONITOR_REPOSITORY = 'kadidalax/cf-vps-monitor';

const REPOSITORY_SEGMENT = /^[A-Za-z0-9_.-]+$/;

export function resolveMonitorRepository(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_MONITOR_REPOSITORY;
  const repository = value.trim();
  const parts = repository.split('/');
  if (parts.length !== 2
      || parts.some(part => !REPOSITORY_SEGMENT.test(part) || part === '.' || part === '..')) {
    return DEFAULT_MONITOR_REPOSITORY;
  }
  return repository;
}

/** Raw GitHub URL of an agent install script in the configured repository. */
export function agentScriptRawUrl(repository: string, scriptFile: string): string {
  return `https://raw.githubusercontent.com/${repository}/main/agent/${scriptFile}`;
}
