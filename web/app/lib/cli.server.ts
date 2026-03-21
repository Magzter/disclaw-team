import { execSync, exec } from "child_process";
import { join } from "path";
import { existsSync } from "fs";

function findProjectRoot(): string {
  const candidates = [
    join(process.cwd(), ".."),
    join(process.cwd()),
  ];
  for (const c of candidates) {
    if (existsSync(join(c, "src", "cli", "index.ts")) || existsSync(join(c, "dist", "cli", "index.js"))) return c;
  }
  throw new Error("Cannot find disclaw-team project root");
}

function findCli(): { cli: string; runtime: string; root: string } {
  const root = findProjectRoot();
  // Prefer compiled dist/ over src/
  const distCli = join(root, "dist", "cli", "index.js");
  const srcCli = join(root, "src", "cli", "index.ts");

  if (existsSync(distCli)) {
    return { cli: distCli, runtime: "node", root };
  }
  // Fallback to bun for dev (src/ is TypeScript)
  return { cli: srcCli, runtime: "bun run", root };
}

function runCli(command: string, timeout = 10000): string {
  const { cli, runtime, root } = findCli();
  try {
    return execSync(`${runtime} ${cli} ${command}`, {
      stdio: "pipe",
      timeout,
      cwd: root,
    }).toString();
  } catch (err) {
    const e = err as { stdout?: Buffer; stderr?: Buffer; message?: string }
    const output = e.stdout?.toString() || e.stderr?.toString() || e.message || String(err);
    console.error(`CLI failed: ${command}`, output);
    throw new Error(`CLI command failed: ${command}\n${output}`);
  }
}

// Start is fire-and-forget — it can take 30+ seconds with auto-restart
function runCliAsync(command: string): void {
  const { cli, runtime, root } = findCli();
  const child = exec(`${runtime} ${cli} ${command}`, { cwd: root });
  child.unref();
}

export function cliStart(botId?: string) {
  runCliAsync(`start ${botId || ""}`);
}

export function cliStop(botId?: string) {
  return runCli(`stop ${botId || ""}`);
}

export function cliStatus() {
  return runCli("status");
}

export function cliSwitchSave(name: string) {
  return runCli(`switch save ${name}`);
}

export function cliSwitchLoad(name: string) {
  return runCli(`switch load ${name}`, 60000);
}

export function cliSwitchDelete(name: string) {
  return runCli(`switch delete ${name}`);
}
