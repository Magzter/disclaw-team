import { writeFileSync, mkdirSync, chmodSync } from 'fs'
import { dirname } from 'path'
import { stringify as toYaml } from 'yaml'
import type { TeamConfig } from './schema.js'

export function writeConfig(config: TeamConfig, path: string): void {
  mkdirSync(dirname(path), { recursive: true })
  const yaml = toYaml(config, { lineWidth: 0 })
  writeFileSync(path, yaml, 'utf-8')
}

export function writeEnvFile(tokens: Record<string, string>, path: string): void {
  mkdirSync(dirname(path), { recursive: true })
  const lines = Object.entries(tokens)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')
  writeFileSync(path, lines + '\n', { mode: 0o600 })
}
