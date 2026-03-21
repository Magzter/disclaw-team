import { execSync } from "child_process";
import { join } from "path";
import { homedir } from "os";
import { existsSync, readFileSync, readdirSync } from "fs";
import { parse as parseYaml } from "yaml";

const BASE = join(homedir(), ".disclaw-team");
const CONFIG_PATH = join(BASE, "team.yaml");
const ENV_PATH = join(BASE, ".env");
const BOTS_DIR = join(BASE, "bots");
const ROLES_DIR = join(BASE, "roles");
const ASSIGNMENT_FILE = join(BASE, "assignment.yaml");
const REGISTRY_DIR = join(BASE, "registry");
const PROFILES_DIR = join(BASE, "profiles");
const TMUX_SESSION = "disclaw-team";

export interface BotStatus {
  id: string;
  name: string;
  role: string;
  roleId: string;
  tagline: string;
  hasToken: boolean;
  hasState: boolean;
  hasRegistry: boolean;
  isRunning: boolean;
}

export interface RoleInfo {
  id: string;
  name: string;
  type: string;
  tagline: string;
}

export interface TeamStatus {
  configured: boolean;
  teamName: string;
  guildId: string;
  sessionRunning: boolean;
  needsRestart: boolean;
  activeProfile: string | null;
  profiles: string[];
  bots: BotStatus[];
  humans: Array<{ name: string; role: string; discordId?: string }>;
  availableRoles: RoleInfo[];
}

function tmuxSessionExists(): boolean {
  try {
    execSync(`tmux has-session -t ${TMUX_SESSION} 2>/dev/null`, { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function tmuxWindows(): string[] {
  try {
    const out = execSync(`tmux list-windows -t ${TMUX_SESSION} -F "#{window_name}"`, { stdio: "pipe" })
      .toString()
      .trim();
    return out ? out.split("\n") : [];
  } catch {
    return [];
  }
}

function loadEnvTokens(): Set<string> {
  const tokens = new Set<string>();
  try {
    for (const line of readFileSync(ENV_PATH, "utf-8").split("\n")) {
      const m = line.match(/^(\w+)=(.+)$/);
      if (m) tokens.add(m[1]);
    }
  } catch {}
  return tokens;
}

function findActiveProfile(): string | null {
  if (!existsSync(CONFIG_PATH) || !existsSync(PROFILES_DIR)) return null;
  try {
    const active = readFileSync(CONFIG_PATH, "utf-8");
    for (const entry of readdirSync(PROFILES_DIR, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const pf = join(PROFILES_DIR, entry.name, "team.yaml");
      if (existsSync(pf) && readFileSync(pf, "utf-8") === active) return entry.name;
    }
  } catch {}
  return null;
}

function listProfiles(): string[] {
  if (!existsSync(PROFILES_DIR)) return [];
  try {
    return readdirSync(PROFILES_DIR, { withFileTypes: true })
      .filter((e) => e.isDirectory() && existsSync(join(PROFILES_DIR, e.name, "team.yaml")))
      .map((e) => e.name);
  } catch {
    return [];
  }
}

function loadAvailableRoles(): RoleInfo[] {
  if (!existsSync(ROLES_DIR)) return [];
  const roles: RoleInfo[] = [];
  try {
    for (const file of readdirSync(ROLES_DIR)) {
      if (!file.endsWith(".yaml")) continue;
      const raw = readFileSync(join(ROLES_DIR, file), "utf-8");
      const role = parseYaml(raw);
      roles.push({
        id: file.replace(".yaml", ""),
        name: role.name || file.replace(".yaml", ""),
        type: role.type || "unknown",
        tagline: role.personality?.tagline || role.description || "",
      });
    }
  } catch {}
  return roles.sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
}

function loadAssignmentMap(): Record<string, string> {
  if (!existsSync(ASSIGNMENT_FILE)) return {};
  try {
    const raw = parseYaml(readFileSync(ASSIGNMENT_FILE, "utf-8"));
    return raw.assignments || {};
  } catch {
    return {};
  }
}

export function getTeamStatus(): TeamStatus {
  const configured = existsSync(join(BASE, "bots.yaml")) && existsSync(ASSIGNMENT_FILE);
  const availableRoles = loadAvailableRoles();

  if (!configured) {
    return {
      configured: false,
      teamName: "",
      guildId: "",
      sessionRunning: false,
      needsRestart: false,
      activeProfile: null,
      profiles: listProfiles(),
      bots: [],
      humans: [],
      availableRoles,
    };
  }

  const assignmentMap = loadAssignmentMap();
  const envTokens = loadEnvTokens();
  const running = tmuxWindows();
  const sessionRunning = tmuxSessionExists();

  const botsConfig = parseYaml(readFileSync(join(BASE, "bots.yaml"), "utf-8"));
  const assignment = parseYaml(readFileSync(ASSIGNMENT_FILE, "utf-8"));
  const guildId = assignment.discord?.guild_id || "";
  const botEntries = Object.keys(botsConfig.bots || {});
  const assignedCount = Object.values(assignment.assignments || {}).filter(Boolean).length;

  // Read active team name
  const activeTeamFile = join(BASE, "active-team.txt");
  const activeTeamName = existsSync(activeTeamFile) ? readFileSync(activeTeamFile, "utf-8").trim() : "";
  const teamName = activeTeamName
    ? `${activeTeamName.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())} (${assignedCount}/${botEntries.length})`
    : `Team (${assignedCount} assigned, ${botEntries.length} total)`;

  type RawBotEntry = { token_env?: string }
  const bots: BotStatus[] = [];
  for (const [id, botEntry] of Object.entries(botsConfig.bots || {}) as [string, RawBotEntry][]) {
    const roleId = assignmentMap[id] || "";
    const role = roleId ? availableRoles.find(r => r.id === roleId) : null;
    const roleName = role?.name || id;
    // Match tmux window name format: botId-roleName
    const rolePart = roleName.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 15);
    const windowName = `${id}-${rolePart}`;
    bots.push({
      id,
      name: roleName,
      role: role?.type || "unassigned",
      roleId,
      tagline: role?.tagline || "No role assigned",
      hasToken: envTokens.has(botEntry.token_env || ""),
      hasState: existsSync(join(BOTS_DIR, id, "access.json")),
      hasRegistry: existsSync(join(REGISTRY_DIR, `${id}.json`)),
      isRunning: running.includes(windowName),
    });
  }

  type RawHuman = { name?: string; role?: string; discord_id?: string }
  const humans = Object.entries(assignment.humans || {}).map(([, h]) => {
    const human = h as RawHuman;
    return { name: human.name || "", role: human.role || "owner", discordId: human.discord_id };
  });

  // Detect if running bots differ from configured assignments
  // Compare expected window names against actual tmux windows
  let needsRestart = false;
  if (sessionRunning) {
    const expectedWindows = new Set(
      bots.filter(b => b.roleId).map(b => {
        const rolePart = b.name.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 15);
        return `${b.id}-${rolePart}`;
      })
    );
    const runningSet = new Set(running);
    needsRestart = expectedWindows.size !== runningSet.size ||
      [...expectedWindows].some(w => !runningSet.has(w));
  }

  return {
    configured: true,
    teamName,
    guildId,
    sessionRunning,
    needsRestart,
    activeProfile: findActiveProfile(),
    profiles: listProfiles(),
    bots,
    humans,
    availableRoles,
  };
}
