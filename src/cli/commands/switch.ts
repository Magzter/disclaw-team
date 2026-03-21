import { join, resolve } from 'path'
import { homedir } from 'os'
import { existsSync, mkdirSync, copyFileSync, readFileSync, readdirSync, rmSync } from 'fs'
import { findConfigPath } from '../../config/loader.js'
import { tmuxSessionExists } from '../tmux.js'
import { stop } from './stop.js'

const PROFILES_DIR = join(homedir(), '.disclaw-team', 'profiles')
const ACTIVE_CONFIG = join(homedir(), '.disclaw-team', 'team.yaml')

function validateProfileName(name: string): void {
  if (/[/\\]/.test(name) || name === '.' || name === '..' || name.includes('..')) {
    throw new Error(`Invalid profile name "${name}": must not contain "/", "\\", "..", or be "."`)
  }
  const resolved = resolve(PROFILES_DIR, name)
  if (!resolved.startsWith(PROFILES_DIR)) {
    throw new Error(`Invalid profile name "${name}": resolved path escapes profiles directory`)
  }
}

function profileDir(name: string): string {
  validateProfileName(name)
  return join(PROFILES_DIR, name)
}

function profileConfigPath(name: string): string {
  return join(profileDir(name), 'team.yaml')
}

function profileExists(name: string): boolean {
  return existsSync(profileConfigPath(name))
}

function activeConfigContent(): string | null {
  if (!existsSync(ACTIVE_CONFIG)) return null
  return readFileSync(ACTIVE_CONFIG, 'utf-8')
}

async function save(name: string) {
  if (!name) {
    console.error('Usage: disclaw-team switch save <name>')
    process.exit(1)
  }

  // Find and validate the current config
  let configPath: string
  try {
    configPath = findConfigPath()
  } catch (err) {
    console.error(`Error: ${(err as Error).message}`)
    process.exit(1)
  }

  if (profileExists(name)) {
    // Prompt-free overwrite warning — CLI is non-interactive, just warn and proceed
    console.log(`Profile "${name}" already exists, overwriting.`)
  }

  mkdirSync(profileDir(name), { recursive: true })
  copyFileSync(configPath, profileConfigPath(name))
  console.log(`Saved current team config as profile "${name}".`)
}

async function load(name: string) {
  if (!name) {
    console.error('Usage: disclaw-team switch load <name>')
    process.exit(1)
  }

  if (!profileExists(name)) {
    console.error(`Profile "${name}" not found. Run 'disclaw-team switch list' to see available profiles.`)
    process.exit(1)
  }

  if (tmuxSessionExists()) {
    console.log('Warning: A team is currently running.')
    console.log('Stopping running team before switching...')
    try {
      await stop([])
    } catch {
      console.error('Failed to stop running team. Stop it manually with: disclaw-team stop')
      process.exit(1)
    }
  }

  mkdirSync(join(homedir(), '.disclaw-team'), { recursive: true })
  copyFileSync(profileConfigPath(name), ACTIVE_CONFIG)
  console.log(`Switched to profile "${name}".`)
  console.log('Run `disclaw-team start` to launch the team.')
}

async function list() {
  if (!existsSync(PROFILES_DIR)) {
    console.log('No saved profiles. Use `disclaw-team switch save <name>` to save one.')
    return
  }

  const entries = readdirSync(PROFILES_DIR, { withFileTypes: true })
    .filter(e => e.isDirectory() && existsSync(join(PROFILES_DIR, e.name, 'team.yaml')))
    .map(e => e.name)

  if (entries.length === 0) {
    console.log('No saved profiles. Use `disclaw-team switch save <name>` to save one.')
    return
  }

  const activeContent = activeConfigContent()

  console.log('Saved profiles:\n')
  for (const name of entries.sort()) {
    let marker = '  '
    if (activeContent) {
      const profileContent = readFileSync(profileConfigPath(name), 'utf-8')
      if (profileContent === activeContent) {
        marker = '* '
      }
    }
    console.log(`  ${marker}${name}`)
  }
  console.log('')
  if (entries.some(name => {
    if (!activeContent) return false
    return readFileSync(profileConfigPath(name), 'utf-8') === activeContent
  })) {
    console.log('  * = active profile')
  }
}

async function del(name: string) {
  if (!name) {
    console.error('Usage: disclaw-team switch delete <name>')
    process.exit(1)
  }

  if (!profileExists(name)) {
    console.error(`Profile "${name}" not found.`)
    process.exit(1)
  }

  rmSync(profileDir(name), { recursive: true })
  console.log(`Deleted profile "${name}".`)
}

export async function switchCommand(args: string[]) {
  const subcommand = args[0]
  const name = args[1]

  switch (subcommand) {
    case 'save':
      await save(name)
      break
    case 'load':
      await load(name)
      break
    case 'list':
      await list()
      break
    case 'delete':
      await del(name)
      break
    default:
      console.log(`disclaw-team switch — Manage team config profiles

Usage:
  disclaw-team switch save <name>      Save current team.yaml as a named profile
  disclaw-team switch load <name>      Switch to a saved profile (stops running team)
  disclaw-team switch list             List saved profiles
  disclaw-team switch delete <name>    Delete a saved profile`)
      if (subcommand) process.exit(1)
  }
}
