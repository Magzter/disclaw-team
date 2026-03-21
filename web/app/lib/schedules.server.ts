import { join } from "path";
import { homedir } from "os";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { parse as parseYaml, stringify as toYaml } from "yaml";
import { randomBytes } from "crypto";

const SCHEDULES_FILE = join(homedir(), ".disclaw-team", "schedules.yaml");

export interface Schedule {
  id: string;
  name: string;
  prompt: string;
  bot_id: string;
  cron: string;
  enabled: boolean;
}

interface SchedulesFile {
  schedules: Schedule[];
}

function loadFile(): SchedulesFile {
  if (!existsSync(SCHEDULES_FILE)) return { schedules: [] };
  try {
    const raw = parseYaml(readFileSync(SCHEDULES_FILE, "utf-8"));
    return { schedules: raw.schedules || [] };
  } catch {
    return { schedules: [] };
  }
}

function saveFile(data: SchedulesFile): void {
  mkdirSync(join(homedir(), ".disclaw-team"), { recursive: true });
  writeFileSync(SCHEDULES_FILE, toYaml(data, { lineWidth: 0 }));
}

export function listSchedules(): Schedule[] {
  return loadFile().schedules;
}

export function createSchedule(schedule: Omit<Schedule, "id">): Schedule {
  const data = loadFile();
  const newSchedule: Schedule = { ...schedule, id: randomBytes(4).toString("hex") };
  data.schedules.push(newSchedule);
  saveFile(data);
  return newSchedule;
}

export function updateSchedule(id: string, patch: Partial<Schedule>): void {
  const data = loadFile();
  const idx = data.schedules.findIndex((s) => s.id === id);
  if (idx === -1) return;
  data.schedules[idx] = { ...data.schedules[idx], ...patch };
  saveFile(data);
}

export function deleteSchedule(id: string): void {
  const data = loadFile();
  data.schedules = data.schedules.filter((s) => s.id !== id);
  saveFile(data);
}

export function toggleSchedule(id: string): void {
  const data = loadFile();
  const schedule = data.schedules.find((s) => s.id === id);
  if (schedule) {
    schedule.enabled = !schedule.enabled;
    saveFile(data);
  }
}

// Human-readable cron description
export function describeCron(cron: string): string {
  const parts = cron.split(" ");
  if (parts.length !== 5) return cron;
  const [min, hour, dom, mon, dow] = parts;

  if (min.startsWith("*/")) return `Every ${min.slice(2)} minutes`;
  if (hour === "*" && min !== "*") return `Every hour at :${min.padStart(2, "0")}`;
  if (dow === "1-5" && hour !== "*") return `Weekdays at ${hour}:${min.padStart(2, "0")}`;
  if (dow === "*" && dom === "*" && mon === "*" && hour !== "*") return `Daily at ${hour}:${min.padStart(2, "0")}`;
  return cron;
}
