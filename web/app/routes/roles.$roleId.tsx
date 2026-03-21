import { Form, redirect, useLoaderData } from "react-router";
import { PageHeader, SubmitButton, cardClass, inputClass, labelClass } from "../components/ui";
import type { Route } from "./+types/roles.$roleId";

export function meta({ params }: Route.MetaArgs) {
  return [{ title: `disclaw-team — Edit Role: ${params.roleId}` }];
}

export async function loader({ params }: Route.LoaderArgs) {
  const { join } = await import("path");
  const { homedir } = await import("os");
  const { existsSync, readFileSync } = await import("fs");
  const { parse: parseYaml } = await import("yaml");

  const { roleId } = params;
  const ROLES_DIR = join(homedir(), ".disclaw-team", "roles");
  const path = join(ROLES_DIR, `${roleId}.yaml`);
  if (!existsSync(path)) throw new Response("Role not found", { status: 404 });
  const role = parseYaml(readFileSync(path, "utf-8"));
  return { roleId, role };
}

export async function action({ request, params }: Route.ActionArgs) {
  const { join } = await import("path");
  const { homedir } = await import("os");
  const { existsSync, readFileSync, writeFileSync, copyFileSync } = await import("fs");
  const { parse: parseYaml, stringify: toYaml } = await import("yaml");

  const ROLES_DIR = join(homedir(), ".disclaw-team", "roles");
  const { roleId } = params;
  const form = await request.formData();
  const intent = form.get("intent") as string;

  if (intent === "save") {
    const path = join(ROLES_DIR, `${roleId}.yaml`);
    const existing = parseYaml(readFileSync(path, "utf-8"));

    // Update from form
    existing.name = form.get("name") || existing.name;
    existing.description = form.get("description") || existing.description;
    existing.type = form.get("type") || existing.type;
    existing.personality = existing.personality || {};
    existing.personality.tagline = form.get("tagline") || existing.personality.tagline;
    existing.personality.tone = form.get("tone") || existing.personality.tone;
    existing.personality.instructions = form.get("instructions") || existing.personality.instructions;

    const domainStr = form.get("domain") as string;
    existing.personality.domain = domainStr ? domainStr.split(",").map((s: string) => s.trim()).filter(Boolean) : existing.personality.domain;

    const respStr = form.get("responsibilities") as string;
    existing.responsibilities = respStr ? respStr.split("\n").map((s: string) => s.trim()).filter(Boolean) : existing.responsibilities;

    // Model config
    existing.model_config = existing.model_config || {};
    existing.model_config.model = form.get("model") || existing.model_config.model || "sonnet";
    existing.model_config.reasoning = form.get("reasoning") || existing.model_config.reasoning || "medium";

    writeFileSync(path, toYaml(existing, { lineWidth: 0 }));
    return redirect(`/roles/${roleId}`);
  }

  if (intent === "duplicate") {
    const newId = form.get("newId") as string;
    if (!newId) return null;
    const srcPath = join(ROLES_DIR, `${roleId}.yaml`);
    const destPath = join(ROLES_DIR, `${newId}.yaml`);
    if (existsSync(destPath)) return null;
    copyFileSync(srcPath, destPath);
    // Update name in the copy
    const copy = parseYaml(readFileSync(destPath, "utf-8"));
    copy.name = `${copy.name} (copy)`;
    writeFileSync(destPath, toYaml(copy, { lineWidth: 0 }));
    return redirect(`/roles/${newId}`);
  }

  return null;
}

// inputClass and labelClass imported from ../components/ui

export default function RoleEditor({ loaderData }: Route.ComponentProps) {
  const { roleId, role } = loaderData;

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold">{role.name}</h2>
          <p className="text-sm text-[var(--color-text-secondary)]">{role.type} · {roleId}</p>
        </div>
        <a href="/roles" className="text-sm text-[var(--color-accent)] hover:underline">← Back to library</a>
      </div>

      <Form method="post">
        <input type="hidden" name="intent" value="save" />

        {/* Identity */}
        <div className="bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg p-4 mb-4">
          <h3 className="text-sm font-medium mb-3">Identity</h3>
          <div className="space-y-3">
            <div>
              <label className={labelClass}>Name</label>
              <input className={inputClass} name="name" defaultValue={role.name} />
            </div>
            <div>
              <label className={labelClass}>Type</label>
              <select name="type" defaultValue={role.type} className={inputClass}>
                <option value="orchestrator">Orchestrator</option>
                <option value="specialist">Specialist</option>
                <option value="executor">Executor</option>
                <option value="generalist">Generalist</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Description</label>
              <input className={inputClass} name="description" defaultValue={role.description} />
            </div>
          </div>
        </div>

        {/* Personality */}
        <div className="bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg p-4 mb-4">
          <h3 className="text-sm font-medium mb-3">Personality</h3>
          <div className="space-y-3">
            <div>
              <label className={labelClass}>Tagline</label>
              <input className={inputClass} name="tagline" defaultValue={role.personality?.tagline} />
            </div>
            <div>
              <label className={labelClass}>Tone</label>
              <input className={inputClass} name="tone" defaultValue={role.personality?.tone} placeholder="e.g. Professional and concise" />
            </div>
            <div>
              <label className={labelClass}>Instructions</label>
              <textarea
                className={`${inputClass} min-h-[120px] font-mono text-xs`}
                name="instructions"
                defaultValue={role.personality?.instructions}
                rows={6}
              />
            </div>
            <div>
              <label className={labelClass}>Domain (comma-separated)</label>
              <input className={inputClass} name="domain" defaultValue={(role.personality?.domain || []).join(", ")} placeholder="research, analysis, coding" />
            </div>
          </div>
        </div>

        {/* Responsibilities */}
        <div className="bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg p-4 mb-4">
          <h3 className="text-sm font-medium mb-3">Responsibilities</h3>
          <textarea
            className={`${inputClass} min-h-[100px] text-xs`}
            name="responsibilities"
            defaultValue={(role.responsibilities || []).join("\n")}
            rows={5}
            placeholder="One per line"
          />
        </div>

        {/* Model & Reasoning */}
        <div className="bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg p-4 mb-4">
          <h3 className="text-sm font-medium mb-3">Model & Reasoning</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Model</label>
              <select name="model" defaultValue={role.model_config?.model || "sonnet"} className={inputClass}>
                <option value="opus">Opus — most capable, strategic thinking</option>
                <option value="sonnet">Sonnet — balanced speed and quality</option>
                <option value="haiku">Haiku — fastest, simple tasks</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Reasoning Effort</label>
              <select name="reasoning" defaultValue={role.model_config?.reasoning || "medium"} className={inputClass}>
                <option value="max">Max — deep analysis, complex decisions</option>
                <option value="high">High — thorough, detailed work</option>
                <option value="medium">Medium — balanced (default)</option>
                <option value="low">Low — quick responses, simple tasks</option>
              </select>
            </div>
          </div>
          <p className="text-xs text-[var(--color-text-secondary)] mt-2">
            Orchestrators typically benefit from Opus + high reasoning. Specialists can use Sonnet for speed. QA/validation roles need high reasoning for thoroughness.
          </p>
        </div>

        <div className="flex gap-2">
          <button type="submit" className="px-6 py-2 bg-[var(--color-accent)] text-white rounded-lg hover:bg-[var(--color-accent-hover)] transition-colors">
            Save Changes
          </button>
          <a href="/roles" className="px-6 py-2 border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-surface-hover)] text-sm flex items-center">
            Cancel
          </a>
        </div>
      </Form>

      {/* Duplicate */}
      <div className="mt-6 pt-6 border-t border-[var(--color-border)]">
        <h3 className="text-sm font-medium mb-2">Duplicate Role</h3>
        <p className="text-xs text-[var(--color-text-secondary)] mb-3">Create a copy to customize without changing the original.</p>
        <Form method="post" className="flex gap-2">
          <input type="hidden" name="intent" value="duplicate" />
          <input className={inputClass + " max-w-xs"} name="newId" placeholder="new-role-id" />
          <button type="submit" className="px-4 py-2 text-sm border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-surface-hover)]">
            Duplicate
          </button>
        </Form>
      </div>
    </div>
  );
}
