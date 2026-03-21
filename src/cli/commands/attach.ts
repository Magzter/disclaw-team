import { execSync } from 'child_process'
import { TMUX_SESSION, findBotWindow, tmuxWindows } from '../tmux.js'

export async function attach(args: string[]) {
  const targetBotId = args[0]

  try {
    execSync(`tmux has-session -t ${TMUX_SESSION} 2>/dev/null`, { stdio: 'pipe' })
  } catch {
    console.error('No running team session. Run "disclaw-team start" first.')
    process.exit(1)
  }

  if (targetBotId) {
    const windowName = findBotWindow(targetBotId)
    if (windowName) {
      try {
        execSync(`tmux select-window -t ${TMUX_SESSION}:${windowName}`, { stdio: 'pipe' })
      } catch {
        console.error(`Failed to select bot "${targetBotId}".`)
        process.exit(1)
      }
    } else {
      console.error(`Bot "${targetBotId}" not found. Available:`)
      tmuxWindows().forEach(w => console.log(`  ${w}`))
      process.exit(1)
    }
  }

  execSync(`tmux attach -t ${TMUX_SESSION}`, { stdio: 'inherit' })
}
