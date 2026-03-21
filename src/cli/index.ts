#!/usr/bin/env node
export {}

const command = process.argv[2]

switch (command) {
  case 'init': {
    const { init } = await import('./commands/init.js')
    await init(process.argv.slice(3))
    break
  }
  case 'start': {
    const { start } = await import('./commands/start.js')
    await start(process.argv.slice(3))
    break
  }
  case 'stop': {
    const { stop } = await import('./commands/stop.js')
    await stop(process.argv.slice(3))
    break
  }
  case 'attach': {
    const { attach } = await import('./commands/attach.js')
    await attach(process.argv.slice(3))
    break
  }
  case 'switch': {
    const { switchCommand } = await import('./commands/switch.js')
    await switchCommand(process.argv.slice(3))
    break
  }
  case 'status': {
    const { status } = await import('./commands/status.js')
    await status()
    break
  }
  case 'assign': {
    const { assign } = await import('./commands/assign.js')
    await assign(process.argv.slice(3))
    break
  }
  case 'roles': {
    const { roles } = await import('./commands/roles.js')
    await roles(process.argv.slice(3))
    break
  }
  default:
    console.log(`disclaw-team — Multi-bot AI team manager for Discord

Usage:
  disclaw-team init                       Create bots and assign roles
  disclaw-team start [bot-id] [--safe]    Launch all bots (or one) in tmux
  disclaw-team stop [bot-id]              Stop all bots (or one)
  disclaw-team attach [bot-id]            Attach to the tmux session
  disclaw-team status                     Show team status
  disclaw-team assign <bot-id> <role>     Assign a role to a bot
  disclaw-team roles <subcommand>         Manage the role library
  disclaw-team switch <subcommand>        Manage team config profiles

Run 'disclaw-team init' to get started.`)
    if (command && command !== 'help' && command !== '--help') {
      process.exit(1)
    }
}
