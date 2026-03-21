#!/usr/bin/env node
export {}
/**
 * Schedule runner — checks and executes due schedules.
 *
 * Run this on a cron (e.g. every minute via crontab) or as a background
 * loop. Reads schedules.yaml, checks which are due, and sends the
 * prompt as a Discord message to the assigned bot's channel.
 *
 * The bot's MCP server picks up the message and processes it normally.
 *
 * Usage:
 *   bun src/schedules/runner.ts              # Check and run due schedules
 *   bun src/schedules/runner.ts --loop       # Run continuously (check every 60s)
 *   bun src/schedules/runner.ts <schedule-id> # Run a specific schedule now
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { parse as parseYaml, stringify as toYaml } from 'yaml'

const BASE = join(homedir(), '.disclaw-team')
const SCHEDULES_FILE = join(BASE, 'schedules.yaml')
const LAST_RUN_FILE = join(BASE, 'schedules-last-run.json')

interface Schedule {
  id: string
  name: string
  prompt: string
  bot_id: string
  cron: string
  enabled: boolean
}

function loadSchedules(): Schedule[] {
  if (!existsSync(SCHEDULES_FILE)) return []
  try {
    const raw = parseYaml(readFileSync(SCHEDULES_FILE, 'utf-8'))
    return (raw.schedules || []) as Schedule[]
  } catch {
    return []
  }
}

function loadLastRuns(): Record<string, number> {
  if (!existsSync(LAST_RUN_FILE)) return {}
  try {
    return JSON.parse(readFileSync(LAST_RUN_FILE, 'utf-8'))
  } catch {
    return {}
  }
}

function saveLastRuns(runs: Record<string, number>): void {
  mkdirSync(BASE, { recursive: true })
  writeFileSync(LAST_RUN_FILE, JSON.stringify(runs, null, 2))
}

function parseCron(cron: string): { minute: number[]; hour: number[]; dom: number[]; month: number[]; dow: number[] } | null {
  const parts = cron.trim().split(/\s+/)
  if (parts.length !== 5) return null

  function parseField(field: string, min: number, max: number): number[] {
    if (field === '*') return Array.from({ length: max - min + 1 }, (_, i) => i + min)
    if (field.startsWith('*/')) {
      const step = parseInt(field.slice(2), 10)
      const values: number[] = []
      for (let i = min; i <= max; i += step) values.push(i)
      return values
    }
    if (field.includes(',')) return field.split(',').map(Number).filter(n => n >= min && n <= max)
    if (field.includes('-')) {
      const [start, end] = field.split('-').map(Number)
      const values: number[] = []
      for (let i = start; i <= end; i++) values.push(i)
      return values
    }
    const n = parseInt(field, 10)
    return isNaN(n) ? [] : [n]
  }

  return {
    minute: parseField(parts[0], 0, 59),
    hour: parseField(parts[1], 0, 23),
    dom: parseField(parts[2], 1, 31),
    month: parseField(parts[3], 1, 12),
    dow: parseField(parts[4], 0, 6),
  }
}

function isDue(schedule: Schedule, lastRun: number | undefined): boolean {
  const now = new Date()
  const parsed = parseCron(schedule.cron)
  if (!parsed) return false

  // Check if current time matches the cron expression
  if (!parsed.minute.includes(now.getMinutes())) return false
  if (!parsed.hour.includes(now.getHours())) return false
  if (!parsed.dom.includes(now.getDate())) return false
  if (!parsed.month.includes(now.getMonth() + 1)) return false
  if (!parsed.dow.includes(now.getDay())) return false

  // Don't run if already ran this minute
  if (lastRun) {
    const lastRunDate = new Date(lastRun)
    if (lastRunDate.getMinutes() === now.getMinutes() &&
        lastRunDate.getHours() === now.getHours() &&
        lastRunDate.getDate() === now.getDate()) {
      return false
    }
  }

  return true
}

async function sendToDiscord(schedule: Schedule): Promise<boolean> {
  // Load bot token and channel from config
  const assignmentFile = join(BASE, 'assignment.yaml')
  const envFile = join(BASE, '.env')

  if (!existsSync(assignmentFile) || !existsSync(envFile)) return false

  const assignment = parseYaml(readFileSync(assignmentFile, 'utf-8'))
  const channelId = assignment.discord?.channel_id
  if (!channelId) return false

  // Find the bot's token
  const botsConfig = parseYaml(readFileSync(join(BASE, 'bots.yaml'), 'utf-8'))
  const botEntry = botsConfig.bots?.[schedule.bot_id]
  if (!botEntry) return false

  // Load token from .env
  const envContent = readFileSync(envFile, 'utf-8')
  let token = ''
  for (const line of envContent.split('\n')) {
    const m = line.match(/^(\w+)=(.+)$/)
    if (m && m[1] === botEntry.token_env) {
      token = m[2].trim()
      break
    }
  }
  if (!token) return false

  // Send the scheduled prompt as a Discord message
  // We send it TO the channel where the bot is listening
  // The bot's MCP server picks it up as an inbound message
  const API = 'https://discord.com/api/v10'
  const headers = {
    'Authorization': `Bot ${token}`,
    'Content-Type': 'application/json',
  }

  try {
    const res = await fetch(`${API}/channels/${channelId}/messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        content: `📅 **Scheduled Task** — ${schedule.name}\n\n${schedule.prompt}`,
      }),
    })
    return res.ok
  } catch {
    return false
  }
}

async function runSchedules(): Promise<void> {
  const schedules = loadSchedules()
  const lastRuns = loadLastRuns()
  const enabled = schedules.filter(s => s.enabled)

  if (enabled.length === 0) return

  let anyRan = false

  for (const schedule of enabled) {
    if (isDue(schedule, lastRuns[schedule.id])) {
      process.stderr.write(`disclaw-team: running schedule "${schedule.name}" (${schedule.id})\n`)
      const success = await sendToDiscord(schedule)
      if (success) {
        lastRuns[schedule.id] = Date.now()
        anyRan = true
        process.stderr.write(`disclaw-team: schedule "${schedule.name}" sent successfully\n`)
      } else {
        process.stderr.write(`disclaw-team: schedule "${schedule.name}" failed to send\n`)
      }
    }
  }

  if (anyRan) saveLastRuns(lastRuns)
}

async function runSpecific(scheduleId: string): Promise<void> {
  const schedules = loadSchedules()
  const schedule = schedules.find(s => s.id === scheduleId)
  if (!schedule) {
    console.error(`Schedule "${scheduleId}" not found`)
    process.exit(1)
  }
  console.log(`Running schedule: ${schedule.name}`)
  const success = await sendToDiscord(schedule)
  console.log(success ? 'Sent successfully' : 'Failed to send')
}

// --- Main ---

const args = process.argv.slice(2)

if (args[0] === '--loop') {
  // Continuous mode — check every 60 seconds
  process.stderr.write('disclaw-team: schedule runner started (checking every 60s)\n')
  setInterval(runSchedules, 60_000)
  await runSchedules() // Run immediately too
} else if (args[0]) {
  // Run specific schedule
  await runSpecific(args[0])
} else {
  // Single check
  await runSchedules()
}
