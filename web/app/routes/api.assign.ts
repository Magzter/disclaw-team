import { redirect } from "react-router";

export async function action({ request }: { request: Request }) {
  const form = await request.formData();
  const botId = form.get("botId") as string;
  const roleId = form.get("roleId") as string;

  if (!botId || !roleId) return redirect("/");

  try {
    const { join } = await import("path");
    const { homedir } = await import("os");
    const { readFileSync, writeFileSync, existsSync } = await import("fs");
    const { parse: parseYaml, stringify: toYaml } = await import("yaml");
    const { regenerateAllState } = await import("../lib/regenerate.server");
    const { cliStop, cliStart } = await import("../lib/cli.server");

    const ASSIGNMENT_FILE = join(homedir(), ".disclaw-team", "assignment.yaml");
    if (existsSync(ASSIGNMENT_FILE)) {
      const raw = parseYaml(readFileSync(ASSIGNMENT_FILE, "utf-8"));
      raw.assignments = raw.assignments || {};
      raw.assignments[botId] = roleId;
      writeFileSync(ASSIGNMENT_FILE, toYaml(raw, { lineWidth: 0 }));

      // Regenerate ALL bots' state (team roster changes affect everyone)
      await regenerateAllState();

      // Restart the affected bot
      try { cliStop(botId); } catch {}
      try { cliStart(botId); } catch {}
    }
  } catch (err) {
    console.error("Assign failed:", err);
  }

  return redirect("/");
}
