import { Form, redirect } from "react-router";
import { PageHeader, SubmitButton, cardClass, inputClass, labelClass } from "../components/ui";

export function meta() {
  return [{ title: "disclaw-team — Create Role" }];
}

export async function action({ request }: { request: Request }) {
  const { join } = await import("path");
  const { homedir } = await import("os");
  const { existsSync, writeFileSync, mkdirSync } = await import("fs");
  const { stringify: toYaml } = await import("yaml");

  const ROLES_DIR = join(homedir(), ".disclaw-team", "roles");
  const form = await request.formData();
  const roleId = (form.get("roleId") as string || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  if (!roleId) return null;

  const destPath = join(ROLES_DIR, `${roleId}.yaml`);
  if (existsSync(destPath)) return null;

  mkdirSync(ROLES_DIR, { recursive: true });

  const role = {
    name: form.get("name") || roleId,
    type: form.get("type") || "specialist",
    description: form.get("description") || "",
    responsibilities: [],
    engagement: {
      respond_to_all_teammates: (form.get("type") === "orchestrator"),
      require_mention_from_humans: (form.get("type") !== "orchestrator"),
      require_mention_from_bots: (form.get("type") !== "orchestrator"),
    },
    delegation: {
      can_delegate_to: (form.get("type") === "orchestrator") ? ["specialist", "executor"] : [],
      reports_to: (form.get("type") !== "orchestrator") ? ["orchestrator"] : ["owner"],
    },
    execution: { use_subagents: true, keep_main_thread_free: true },
    presentation: { use_visuals: false, frame_with_conviction: (form.get("type") === "orchestrator") },
    personality: {
      tagline: form.get("tagline") || "",
      tone: form.get("tone") || "Professional",
      instructions: "",
      domain: [],
    },
    model_config: {
      model: form.get("model") || "sonnet",
      reasoning: form.get("reasoning") || "medium",
    },
  };

  writeFileSync(destPath, toYaml(role, { lineWidth: 0 }));
  return redirect(`/roles/${roleId}`);
}

export default function NewRole() {
  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Create New Role"
        subtitle="Define a custom role for your team."
        backTo="/roles"
        backLabel="Roles"
      />

      <Form method="post">
        <div className={`${cardClass} p-4 mb-4`}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Role ID (kebab-case)</label>
                <input className={inputClass} name="roleId" placeholder="my-custom-role" required />
              </div>
              <div>
                <label className={labelClass}>Display Name</label>
                <input className={inputClass} name="name" placeholder="My Custom Role" required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Type</label>
                <select name="type" className={inputClass} defaultValue="specialist">
                  <option value="orchestrator">Orchestrator — leads and delegates</option>
                  <option value="specialist">Specialist — domain expert</option>
                  <option value="executor">Executor — builds and implements</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Tagline</label>
                <input className={inputClass} name="tagline" placeholder="One-line description" />
              </div>
            </div>
            <div>
              <label className={labelClass}>Description</label>
              <input className={inputClass} name="description" placeholder="What this role does" />
            </div>
            <div>
              <label className={labelClass}>Tone</label>
              <input className={inputClass} name="tone" placeholder="e.g. Thorough and methodical" defaultValue="Professional" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Model</label>
                <select name="model" className={inputClass} defaultValue="sonnet">
                  <option value="opus">Opus</option>
                  <option value="sonnet">Sonnet</option>
                  <option value="haiku">Haiku</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Reasoning</label>
                <select name="reasoning" className={inputClass} defaultValue="medium">
                  <option value="max">Max</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <SubmitButton>Create Role</SubmitButton>
          <a href="/roles" className="px-5 py-2 border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-surface-hover)] text-sm flex items-center transition-colors">
            Cancel
          </a>
        </div>
      </Form>
    </div>
  );
}
