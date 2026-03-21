import { loadAssignment, saveAssignment, loadRole, listRoles } from '../../config/role-loader.js'

export async function assign(args: string[]) {
  const botId = args[0]
  const roleId = args[1]

  if (!botId || !roleId) {
    console.log(`Usage: disclaw-team assign <bot-id> <role-id>

Assign a role to a bot. The bot will restart with the new personality.

Available roles:`)
    for (const { id, role } of listRoles()) {
      console.log(`  ${id.padEnd(25)} ${role.type.padEnd(15)} ${role.name}`)
    }
    return
  }

  // Validate role exists
  try {
    const role = loadRole(roleId)
    console.log(`Assigning "${role.name}" (${role.type}) to bot "${botId}"...`)
  } catch (err) {
    console.error(`Error: ${(err as Error).message}`)
    console.log('\nAvailable roles:')
    for (const { id, role } of listRoles()) {
      console.log(`  ${id.padEnd(25)} ${role.type.padEnd(15)} ${role.name}`)
    }
    process.exit(1)
  }

  // Update assignment
  const assignment = loadAssignment()
  if (!(botId in assignment.assignments)) {
    console.error(`Bot "${botId}" not found in assignments. Available: ${Object.keys(assignment.assignments).join(', ')}`)
    process.exit(1)
  }

  const oldRole = assignment.assignments[botId]
  assignment.assignments[botId] = roleId
  saveAssignment(assignment)

  console.log(`  ${botId}: ${oldRole} → ${roleId}`)
  console.log('\nRun `disclaw-team start` to restart with the new role.')
}
