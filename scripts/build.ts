#!/usr/bin/env node
/**
 * Build script — compiles TypeScript to JavaScript for npm publishing.
 * Works with both Node.js (npx) and Bun (bunx).
 */

import { execSync } from 'child_process'
import { cpSync, existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs'
import { join } from 'path'

const ROOT = join(new URL('.', import.meta.url).pathname, '..')
const DIST = join(ROOT, 'dist')

/** Find npx or bunx — whichever is available */
function findRunner(): string {
  try { execSync('bunx --version', { stdio: 'pipe' }); return 'bunx' } catch {}
  try { execSync('npx --version', { stdio: 'pipe' }); return 'npx' } catch {}
  throw new Error('Neither bunx nor npx found. Install Node.js or Bun.')
}

const runner = findRunner()
console.log(`Building disclaw-team... (using ${runner})`)

// Clean
execSync(`rm -rf ${DIST}`)
mkdirSync(DIST, { recursive: true })

// 1. Compile TypeScript → JavaScript with tsc (preserves module structure)
execSync(`${runner} tsc --outDir dist --declaration --sourceMap`, {
  cwd: ROOT,
  stdio: 'inherit',
})

// 2. Ensure shebangs are present in entry points
const shebangFiles = [
  'dist/cli/index.js',
  'dist/server/server.js',
  'dist/hooks/permission-request.js',
  'dist/schedules/runner.js',
]

for (const file of shebangFiles) {
  const fullPath = join(ROOT, file)
  try {
    const content = readFileSync(fullPath, 'utf-8')
    if (!content.startsWith('#!')) {
      writeFileSync(fullPath, `#!/usr/bin/env node\n${content}`)
    }
  } catch {}
}

// Make entry points executable
for (const file of shebangFiles) {
  try { execSync(`chmod +x ${join(ROOT, file)}`) } catch {}
}

// 3. Copy static assets
console.log('Copying static assets...')
cpSync(join(ROOT, 'src', 'roles'), join(DIST, 'roles'), { recursive: true })
cpSync(join(ROOT, 'src', 'templates'), join(DIST, 'templates'), { recursive: true })

// 4. Build web dashboard (pre-built so npx users get a working dashboard)
const webDir = join(ROOT, 'web')
if (existsSync(join(webDir, 'package.json'))) {
  console.log('Building web dashboard...')
  if (!existsSync(join(webDir, 'node_modules'))) {
    execSync('npm install', { cwd: webDir, stdio: 'inherit' })
  }
  execSync('npm run build', { cwd: webDir, stdio: 'inherit' })
  cpSync(join(webDir, 'build'), join(DIST, 'web', 'build'), { recursive: true })
  console.log('Web dashboard built → dist/web/build/')
}

console.log('Build complete → dist/')
