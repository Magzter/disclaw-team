import { execSync } from 'child_process'
import { join } from 'path'
import { homedir } from 'os'
import { existsSync } from 'fs'

let _resolved: string | null = null

/**
 * Find the best available JS runtime (bun preferred, node fallback).
 * Result is cached for the process lifetime.
 */
export function runtime(): string {
  if (_resolved) return _resolved

  // 1. Check for bun
  const bunInstall = process.env.BUN_INSTALL || join(homedir(), '.bun')
  const bunBin = join(bunInstall, 'bin', 'bun')
  if (existsSync(bunBin)) {
    _resolved = bunBin
    return _resolved
  }
  try {
    const p = execSync('which bun', { stdio: 'pipe', encoding: 'utf-8' }).trim()
    if (p) { _resolved = p; return _resolved }
  } catch {}

  // 2. Fall back to node
  try {
    const p = execSync('which node', { stdio: 'pipe', encoding: 'utf-8' }).trim()
    if (p) { _resolved = p; return _resolved }
  } catch {}

  // 3. Last resort
  _resolved = 'node'
  return _resolved
}

/**
 * Resolve a path relative to the package root.
 * Works whether running from src/ (development) or dist/ (published).
 */
export function packageRoot(): string {
  // import.meta.url points to this file — go up to package root
  const thisDir = new URL('.', import.meta.url).pathname
  // In dist/: dist/runtime.js → go up 1
  // In src/: src/runtime.ts → go up 1
  return join(thisDir, '..')
}
