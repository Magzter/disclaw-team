import { join } from "path";
import { existsSync, readdirSync, readFileSync } from "fs";
import { parse as parseYaml } from "yaml";

function findTemplatesDir(): string {
  const root = process.env.DISCLAW_ROOT || process.cwd();
  const candidates = [
    join(root, "dist", "templates"),
    join(root, "src", "templates"),
    join(root, "..", "src", "templates"),
    join(process.cwd(), "src", "templates"),
  ];
  return candidates.find(p => existsSync(p)) || candidates[0];
}

export interface TemplateInfo {
  name: string;
  description: string;
  botCount: number;
  bots: Array<{ key: string; name: string; role: string }>;
}

export function listTemplates(): TemplateInfo[] {
  const dir = findTemplatesDir();
  const templates: TemplateInfo[] = [];
  try {
    for (const file of readdirSync(dir)) {
      if (!file.endsWith(".yaml")) continue;
      const raw = readFileSync(join(dir, file), "utf-8");
      const parsed = parseYaml(raw);
      templates.push({
        name: file.replace(".yaml", ""),
        description: parsed.description || "",
        botCount: Object.keys(parsed.bots || {}).length,
        bots: Object.entries(parsed.bots || {}).map(([key, bot]) => {
          const b = bot as { name_suggestion?: string; role?: string };
          return {
            key,
            name: b.name_suggestion || key,
            role: b.role || "unknown",
          };
        }),
      });
    }
  } catch {}
  return templates;
}
