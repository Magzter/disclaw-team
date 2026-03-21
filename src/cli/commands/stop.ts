import { execSync } from 'child_process'
import { TMUX_SESSION, findBotWindow } from '../tmux.js'

export async function stop(args: string[]) {
  const targetBotId = args[0]

  try {
    execSync(`tmux has-session -t ${TMUX_SESSION} 2>/dev/null`, { stdio: 'pipe' })
  } catch {
    console.log('No running team session found.')
    return
  }

  if (targetBotId) {
    // Find the window by bot ID prefix
    const windowName = findBotWindow(targetBotId)
    if (windowName) {
      try {
        execSync(`tmux kill-window -t ${TMUX_SESSION}:${windowName}`, { stdio: 'pipe' })
        console.log(`Stopped ${windowName}.`)
      } catch {
        console.error(`Failed to stop "${targetBotId}".`)
      }
    } else {
      console.error(`Bot "${targetBotId}" not found in running session.`)
    }

    try {
      execSync(`tmux has-session -t ${TMUX_SESSION} 2>/dev/null`, { stdio: 'pipe' })
    } catch {
      console.log('All bots stopped. Session closed.')
    }
  } else {
    execSync(`tmux kill-session -t ${TMUX_SESSION}`, { stdio: 'pipe' })
    console.log('All bots stopped.')
  }
}
