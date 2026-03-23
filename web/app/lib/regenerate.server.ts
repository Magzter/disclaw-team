import { join } from "path";
import { homedir } from "os";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { parse as parseYaml, stringify as toYaml } from "yaml";

const BASE = join(homedir(), ".disclaw-team");

/**
 * Find the role-loader module. Works from both dev (web/) and production (dist/web/build/).
 * Uses DISCLAW_ROOT env var set by the CLI when launching the dashboard.
 */
async function importRoleLoader() {
  const root = process.env.DISCLAW_ROOT || join(process.cwd(), "..");
  // Only try .js — Node can't import .ts without a loader
  const candidates = [
    join(root, "dist", "config", "role-loader.js"),
    join(root, "config", "role-loader.js"),
  ];
  const modulePath = candidates.find(p => existsSync(p));
  if (!modulePath) throw new Error("Cannot find role-loader module. Is DISCLAW_ROOT set?");
  return import(modulePath);
}

async function importGenerator(name: string) {
  const root = process.env.DISCLAW_ROOT || join(process.cwd(), "..");
  const candidates = [
    join(root, "dist", "generator", `${name}.js`),
    join(root, "generator", `${name}.js`),
  ];
  const modulePath = candidates.find(p => existsSync(p));
  if (!modulePath) throw new Error(`Cannot find generator module: ${name}. Is DISCLAW_ROOT set?`);
  return import(modulePath);
}

/**
 * Regenerate team.yaml and all per-bot state files (CLAUDE.md, system-prompt.txt, access.json)
 * from the current bots.yaml + assignment.yaml + roles.
 *
 * Call this whenever bots, assignments, or roles change.
 */
export async function regenerateAllState(): Promise<void> {
  const botsFile = join(BASE, "bots.yaml");
  const assignFile = join(BASE, "assignment.yaml");

  if (!existsSync(botsFile) || !existsSync(assignFile)) return;

  try {
    const { loadBots, loadAssignment, generateTeamConfig, resolveTokensFromEnv } = await importRoleLoader();
    const { generateAccessJson } = await importGenerator("access-json");
    const { generateClaudeMd } = await importGenerator("claude-md");

    const bots = loadBots();
    const assignment = loadAssignment();
    const tokens = resolveTokensFromEnv(bots);
    const config = generateTeamConfig(bots, assignment, tokens);

    // Write derived team.yaml
    writeFileSync(join(BASE, "team.yaml"), toYaml(config, { lineWidth: 0 }));

    // Regenerate per-bot state
    for (const [botId, bot] of Object.entries(config.bots)) {
      const stateDir = join(BASE, "bots", botId);
      mkdirSync(stateDir, { recursive: true, mode: 0o700 });

      const accessJson = generateAccessJson(config, botId);
      writeFileSync(
        join(stateDir, "access.json"),
        JSON.stringify(accessJson, null, 2) + "\n",
        { mode: 0o600 },
      );

      const claudeMd = generateClaudeMd(config, botId);
      writeFileSync(join(stateDir, "CLAUDE.md"), claudeMd);
      writeFileSync(join(stateDir, "system-prompt.txt"), claudeMd);

      const token = tokens.get(botId);
      if (token) {
        writeFileSync(
          join(stateDir, ".env"),
          `DISCORD_BOT_TOKEN=${token}\n`,
          { mode: 0o600 },
        );
      }
    }
  } catch (err) {
    console.error("Failed to regenerate state:", err);
  }
}
