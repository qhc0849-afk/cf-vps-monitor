import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const modulePath = fileURLToPath(import.meta.url);
const defaultRoot = dirname(dirname(modulePath));

const CONFIG_FILES = [
  { label: 'root wrangler.toml', path: 'wrangler.toml' },
  { label: 'worker wrangler.toml', path: 'worker/wrangler.toml' },
  { label: 'worker wrangler.example.toml', path: 'worker/wrangler.example.toml' },
];

// Minimal TOML reader for the shapes these three configs use: sections,
// dotted section paths, arrays of tables, strings, numbers, booleans and
// arrays. It is a consistency check, not a general TOML parser: anything
// outside those shapes is a parse problem, not a silent pass.
function stripComment(line) {
  let quote = null;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (quote) {
      if (char === '\\' && quote === '"') i += 1;
      else if (char === quote) quote = null;
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === '#') {
      return line.slice(0, i);
    }
  }
  return line;
}

function logicalLines(source) {
  const lines = [];
  let current = '';
  let depth = 0;
  let quote = null;
  for (const raw of source.split(/\r?\n/)) {
    const line = stripComment(raw);
    if (current) current += '\n';
    current += line;
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if (quote) {
        if (char === '\\' && quote === '"') i += 1;
        else if (char === quote) quote = null;
      } else if (char === '"' || char === "'") {
        quote = char;
      } else if (char === '[') {
        depth += 1;
      } else if (char === ']') {
        depth -= 1;
      }
    }
    if (depth <= 0 && !quote) {
      lines.push(current);
      current = '';
      depth = 0;
    }
  }
  if (current.trim()) lines.push(current);
  return lines;
}

function parseString(raw, label) {
  if (raw.startsWith("'") && raw.endsWith("'")) return raw.slice(1, -1);
  if (raw.startsWith('"') && raw.endsWith('"')) {
    return raw.slice(1, -1).replace(/\\(.)/g, (_, escaped) => {
      if (escaped === 'n') return '\n';
      if (escaped === 't') return '\t';
      if (escaped === 'r') return '\r';
      return escaped;
    });
  }
  throw new Error(`${label}: unsupported string value ${raw}`);
}

function splitTopLevel(raw) {
  const parts = [];
  let depth = 0;
  let quote = null;
  let current = '';
  for (let i = 0; i < raw.length; i += 1) {
    const char = raw[i];
    if (quote) {
      current += char;
      if (char === '\\' && quote === '"') {
        current += raw[i + 1] ?? '';
        i += 1;
      } else if (char === quote) {
        quote = null;
      }
    } else if (char === '"' || char === "'") {
      quote = char;
      current += char;
    } else if (char === '[' || char === '{') {
      depth += 1;
      current += char;
    } else if (char === ']' || char === '}') {
      depth -= 1;
      current += char;
    } else if (char === ',' && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  parts.push(current);
  return parts;
}

function parseValue(raw, label) {
  const value = raw.trim();
  if (value.startsWith('[') && value.endsWith(']')) {
    const inner = value.slice(1, -1).trim();
    if (!inner) return [];
    return splitTopLevel(inner).map(part => parseValue(part, label));
  }
  if (value.startsWith('"') || value.startsWith("'")) return parseString(value, label);
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(value)) return Number(value);
  throw new Error(`${label}: unsupported value ${value}`);
}

function ensurePath(root, segments, label) {
  let current = root;
  for (const segment of segments) {
    if (current[segment] === undefined) current[segment] = {};
    if (typeof current[segment] !== 'object' || Array.isArray(current[segment])) {
      throw new Error(`${label}: conflicting table ${segments.join('.')}`);
    }
    current = current[segment];
  }
  return current;
}

export function parseWranglerToml(source, label) {
  const config = {};
  let current = config;
  for (const logical of logicalLines(source)) {
    const line = logical.trim();
    if (!line) continue;
    const arrayHeader = line.match(/^\[\[([A-Za-z0-9_.-]+)\]\]$/);
    if (arrayHeader) {
      const segments = arrayHeader[1].split('.');
      const parent = ensurePath(config, segments.slice(0, -1), label);
      const key = segments[segments.length - 1];
      if (parent[key] === undefined) parent[key] = [];
      if (!Array.isArray(parent[key])) throw new Error(`${label}: conflicting array table ${arrayHeader[1]}`);
      const entry = {};
      parent[key].push(entry);
      current = entry;
      continue;
    }
    const header = line.match(/^\[([A-Za-z0-9_.-]+)\]$/);
    if (header) {
      current = ensurePath(config, header[1].split('.'), label);
      continue;
    }
    const assignment = line.match(/^([A-Za-z0-9_-]+)\s*=\s*(.+)$/s);
    if (!assignment) throw new Error(`${label}: unrecognized line: ${line.slice(0, 80)}`);
    current[assignment[1]] = parseValue(assignment[2], label);
  }
  return config;
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function collectDifferences(left, right, path, problems, leftLabel, rightLabel) {
  if (Object.is(left, right)) return;
  if (isPlainObject(left) && isPlainObject(right)) {
    for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) {
      collectDifferences(left[key], right[key], path ? `${path}.${key}` : key, problems, leftLabel, rightLabel);
    }
    return;
  }
  if (Array.isArray(left) && Array.isArray(right)) {
    const length = Math.max(left.length, right.length);
    for (let i = 0; i < length; i += 1) {
      collectDifferences(left[i], right[i], `${path}[${i}]`, problems, leftLabel, rightLabel);
    }
    return;
  }
  const describe = value => (value === undefined ? 'missing' : JSON.stringify(value));
  problems.push(`${path}: ${leftLabel} has ${describe(left)}, ${rightLabel} has ${describe(right)}`);
}

// The root config lives one directory above the worker config, so entry and
// asset paths differ by construction, and only the root config declares the
// dev/preview keys. Everything else must match.
function normalizeForRootComparison(config) {
  const copy = JSON.parse(JSON.stringify(config));
  delete copy.main;
  delete copy.workers_dev;
  delete copy.preview_urls;
  if (isPlainObject(copy.assets)) delete copy.assets.directory;
  return copy;
}

export function checkWranglerConfigs({ root = defaultRoot, readFile = readFileSync } = {}) {
  const problems = [];
  const parsed = new Map();
  for (const file of CONFIG_FILES) {
    let source;
    try {
      source = readFile(join(root, file.path), 'utf8');
    } catch {
      problems.push(`${file.label} (${file.path}) could not be read.`);
      continue;
    }
    try {
      parsed.set(file.path, parseWranglerToml(source, file.label));
    } catch (error) {
      problems.push(error instanceof Error ? error.message : `${file.label} could not be parsed.`);
    }
  }
  if (problems.length) return { ok: false, problems };

  const rootConfig = parsed.get('wrangler.toml');
  const workerConfig = parsed.get('worker/wrangler.toml');
  const exampleConfig = parsed.get('worker/wrangler.example.toml');

  const rootProblems = [];
  collectDifferences(
    normalizeForRootComparison(rootConfig),
    normalizeForRootComparison(workerConfig),
    '', rootProblems, 'root wrangler.toml', 'worker/wrangler.toml',
  );
  for (const problem of rootProblems) {
    problems.push(`root wrangler.toml and worker/wrangler.toml differ at ${problem} (only main/assets paths and workers_dev/preview_urls may differ).`);
  }

  const exampleProblems = [];
  collectDifferences(workerConfig, exampleConfig, '', exampleProblems, 'worker/wrangler.toml', 'worker/wrangler.example.toml');
  for (const problem of exampleProblems) {
    problems.push(`worker/wrangler.toml and worker/wrangler.example.toml differ at ${problem}; the example must match exactly.`);
  }

  return { ok: problems.length === 0, problems };
}

if (process.argv[1] && resolve(process.argv[1]) === modulePath) {
  const { ok, problems } = checkWranglerConfigs();
  if (ok) {
    console.log('Wrangler configurations are consistent.');
  } else {
    console.error('Wrangler configuration drift detected:');
    for (const problem of problems) console.error(`- ${problem}`);
    console.error('Update wrangler.toml, worker/wrangler.toml, and worker/wrangler.example.toml together.');
    process.exitCode = 1;
  }
}
