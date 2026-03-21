#!/usr/bin/env bun
/**
 * Build script — compiles TypeScript to JavaScript for npm publishing.
 * Uses bun build with --target=node for Node.js compatibility.
 */

import { execSync } from 'child_process'
import { cpSync, mkdirSync, writeFileSync, readFileSync } from 'fs'
import { join } from 'path'

const ROOT = join(new URL('.', import.meta.url).pathname, '..')
const DIST = join(ROOT, 'dist')

console.log('Building disclaw-team...')

// Clean
execSync(`rm -rf ${DIST}`)
mkdirSync(DIST, { recursive: true })

// 1. Compile TypeScript → JavaScript with tsc (preserves module structure)
execSync('bunx tsc --outDir dist --declaration --sourceMap', {
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

console.log('Build complete → dist/')
