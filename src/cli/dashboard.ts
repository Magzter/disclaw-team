/**
 * Shared dashboard serve logic for init and start commands.
 * Finds pre-built web dashboard or falls back to dev mode (vite).
 *
 * Sets DISCLAW_ROOT env var so the web app's server-side code can
 * reliably find the CLI, roles, and templates regardless of cwd.
 */

import { join } from 'path'
import { existsSync, readFileSync } from 'fs'
import { createRequire } from 'module'
import { packageRoot } from '../runtime.js'

export interface DashboardInfo {
  /** tmux command to launch the dashboard */
  cmd: string
  /** Port the dashboard will listen on */
  port: number
  /** 'production' (pre-built) or 'development' (vite) */
  mode: 'production' | 'development'
}

/**
 * Find and return the command to serve the dashboard.
 * Returns null if no dashboard is available.
 */
export function findDashboard(): DashboardInfo | null {
  const root = packageRoot()
  // Pass project root so web server-side code can find CLI, roles, templates
  const envPrefix = `export DISCLAW_ROOT="${root}" &&`

  // 1. Check for pre-built dashboard (npm-published package)
  const prebuiltDir = join(root, 'dist', 'web')
  const prebuiltServer = join(prebuiltDir, 'build', 'server', 'index.js')
  if (existsSync(prebuiltServer)) {
    const serveBin = findServeBin()
    if (serveBin) {
      return {
        cmd: `${envPrefix} cd "${prebuiltDir}" && node "${serveBin}" ./build/server/index.js`,
        port: 3000,
        mode: 'production',
      }
    }
  }

  // 2. Check for dev web directory (source repo)
  const devCandidates = [
    join(root, 'web'),
    join(process.cwd(), 'web'),
  ]
  const devWebDir = devCandidates.find(p => existsSync(join(p, 'package.json')))
  if (devWebDir) {
    const npmCmd = existsSync(join(devWebDir, 'node_modules')) ? 'npm run dev' : 'npm install && npm run dev'
    return {
      cmd: `${envPrefix} cd "${devWebDir}" && ${npmCmd}`,
      port: 5173,
      mode: 'development',
    }
  }

  return null
}

/** Resolve the react-router-serve binary path */
function findServeBin(): string | null {
  try {
    const require = createRequire(import.meta.url)
    const servePkgPath = require.resolve('@react-router/serve/package.json')
    const servePkgDir = join(servePkgPath, '..')
    const servePkg = JSON.parse(readFileSync(servePkgPath, 'utf-8'))
    const binEntry = typeof servePkg.bin === 'string'
      ? servePkg.bin
      : servePkg.bin?.['react-router-serve']
    if (binEntry) {
      return join(servePkgDir, binEntry)
    }
  } catch {}
  return null
}
