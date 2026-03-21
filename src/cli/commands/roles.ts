import { listRoles, loadRole, installPreloadedRoles } from '../../config/role-loader.js'
import type { RoleFile } from '../../config/role-schema.js'

export async function roles(args: string[]) {
  const subcommand = args[0]

  switch (subcommand) {
    case 'list': {
      const allRoles = listRoles()
      if (allRoles.length === 0) {
        console.log('No roles installed. Run `disclaw-team roles install` to install preloaded roles.')
        return
      }

      console.log('\nAvailable roles:\n')

      // Group by type
      const grouped = new Map<string, Array<{ id: string; role: RoleFile }>>()
      for (const entry of allRoles) {
        const type = entry.role.type
        if (!grouped.has(type)) grouped.set(type, [])
        grouped.get(type)!.push(entry)
      }

      for (const [type, entries] of grouped) {
        console.log(`  ${type.toUpperCase()}S`)
        for (const { id, role } of entries) {
          console.log(`    ${id.padEnd(25)} ${role.name}`)
          console.log(`    ${''.padEnd(25)} ${role.personality.tagline}`)
        }
        console.log('')
      }
      break
    }

    case 'show': {
      const roleId = args[1]
      if (!roleId) {
        console.error('Usage: disclaw-team roles show <role-id>')
        process.exit(1)
      }
      try {
        const role = loadRole(roleId)
        console.log(`\n  ${role.name} (${role.type})`)
        console.log(`  ${role.description}\n`)
        console.log(`  Tagline: ${role.personality.tagline}`)
        console.log(`  Tone: ${role.personality.tone}`)
        if (role.personality.domain.length > 0) {
          console.log(`  Domain: ${role.personality.domain.join(', ')}`)
        }
        if (role.responsibilities.length > 0) {
          console.log(`\n  Responsibilities:`)
          for (const r of role.responsibilities) console.log(`    - ${r}`)
        }
        if (role.personality.instructions) {
          console.log(`\n  Instructions:\n    ${role.personality.instructions.trim().replace(/\n/g, '\n    ')}`)
        }
        console.log('')
      } catch (err) {
        console.error(`Error: ${(err as Error).message}`)
        process.exit(1)
      }
      break
    }

    case 'install': {
      console.log('Installing preloaded roles...')
      installPreloadedRoles()
      const count = listRoles().length
      console.log(`Done. ${count} roles available.`)
      break
    }

    default:
      console.log(`disclaw-team roles — Manage the role library

Usage:
  disclaw-team roles list              List all available roles
  disclaw-team roles show <role-id>    Show role details
  disclaw-team roles install           Install/update preloaded roles`)
  }
}
