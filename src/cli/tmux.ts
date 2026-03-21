import { execSync } from 'child_process'
import { createInterface } from 'readline'

export const TMUX_SESSION = 'disclaw-team'

export function tmuxExists(): boolean {
  try { execSync('which tmux', { stdio: 'pipe' }); return true } catch { return false }
}

function detectPlatform(): 'macos' | 'debian' | 'fedora' | 'unknown' {
  if (process.platform === 'darwin') return 'macos'
  try {
    const release = execSync('cat /etc/os-release 2>/dev/null', { stdio: 'pipe', encoding: 'utf-8' })
    if (/debian|ubuntu/i.test(release)) return 'debian'
    if (/fedora|rhel|centos/i.test(release)) return 'fedora'
  } catch {}
  return 'unknown'
}

export async function ensureTmux(): Promise<boolean> {
  if (tmuxExists()) return true

  const platform = detectPlatform()
  const installCmd: Record<string, string> = {
    macos: 'brew install tmux',
    debian: 'sudo apt install -y tmux',
    fedora: 'sudo dnf install -y tmux',
  }

  const cmd = installCmd[platform]
  if (!cmd) {
    console.error('Error: tmux is required but not installed.')
    console.error('Install it manually: https://github.com/tmux/tmux/wiki/Installing')
    return false
  }

  console.log(`tmux is required but not installed.`)
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const answer = await new Promise<string>(resolve => {
    rl.question(`Install now with \`${cmd}\`? [Y/n] `, resolve)
  })
  rl.close()

  if (answer && answer.toLowerCase() !== 'y' && answer !== '') {
    console.error(`tmux is required. Install manually: ${cmd}`)
    return false
  }

  console.log(`Running: ${cmd}`)
  try {
    execSync(cmd, { stdio: 'inherit' })
    if (tmuxExists()) {
      console.log('tmux installed successfully.')
      return true
    }
  } catch {
    console.error(`Failed to install tmux. Try manually: ${cmd}`)
  }
  return false
}

export function tmuxSessionExists(): boolean {
  try { execSync(`tmux has-session -t ${TMUX_SESSION} 2>/dev/null`, { stdio: 'pipe' }); return true } catch { return false }
}

/** Build the tmux window name for a bot: botId-roleName */
export function tmuxWindowName(botId: string, roleName: string): string {
  const rolePart = roleName.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 15)
  return `${botId}-${rolePart}`
}

/** List all tmux window names in the session */
export function tmuxWindows(): string[] {
  try {
    const out = execSync(`tmux list-windows -t ${TMUX_SESSION} -F "#{window_name}"`, { stdio: 'pipe' }).toString().trim()
    return out ? out.split('\n') : []
  } catch {
    return []
  }
}

/** Find a bot's window name from the running tmux windows */
export function findBotWindow(botId: string): string | null {
  const windows = tmuxWindows()
  return windows.find(w => w.startsWith(`${botId}-`)) || null
}
