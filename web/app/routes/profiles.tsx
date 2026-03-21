import { Form, redirect } from "react-router";
import { PageHeader, SubmitButton, EmptyState, cardClass, inputClass } from "../components/ui";
import type { Route } from "./+types/profiles";

export function meta() {
  return [{ title: "disclaw-team — Profiles" }];
}

export async function loader() {
  const { getTeamStatus } = await import("../lib/status.server");
  const status = getTeamStatus();
  return {
    profiles: status.profiles,
    activeProfile: status.activeProfile,
    sessionRunning: status.sessionRunning,
  };
}

export async function action({ request }: { request: Request }) {
  const form = await request.formData();
  const intent = form.get("intent") as string;
  const name = form.get("name") as string;

  try {
    const { cliSwitchSave, cliSwitchLoad, cliSwitchDelete } = await import("../lib/cli.server");
    switch (intent) {
      case "save": cliSwitchSave(name); break;
      case "load": cliSwitchLoad(name); break;
      case "delete": cliSwitchDelete(name); break;
    }
  } catch (err) {
    console.error(`Profile action "${intent}" failed:`, err);
  }

  return redirect("/profiles");
}

export default function Profiles({ loaderData }: Route.ComponentProps) {
  const { profiles, activeProfile, sessionRunning } = loaderData;

  return (
    <div className="max-w-2xl">
      <PageHeader title="Profiles" subtitle="Save and switch between team configurations." />

      <div className={`${cardClass} p-5 mb-6`}>
        <h3 className="text-sm font-medium mb-3">Save current config as profile</h3>
        <Form method="post" className="flex gap-2">
          <input type="hidden" name="intent" value="save" />
          <input type="text" name="name" placeholder="Profile name" required className={inputClass + " flex-1"} />
          <SubmitButton>Save</SubmitButton>
        </Form>
      </div>

      {profiles.length === 0 ? (
        <EmptyState icon="↔" title="No saved profiles" description="Save your current team configuration to switch between setups." />
      ) : (
        <div className="space-y-2">
          {profiles.map((name) => (
            <div key={name} className={`flex items-center justify-between ${cardClass} px-5 py-4 ${name === activeProfile ? "border-[var(--color-accent)] bg-[var(--color-accent)]/5" : ""}`}>
              <div className="flex items-center gap-3">
                <span className="font-medium">{name}</span>
                {name === activeProfile && (
                  <span className="text-xs bg-[var(--color-accent)]/15 text-[var(--color-accent)] px-2 py-0.5 rounded-full">active</span>
                )}
              </div>
              <div className="flex gap-2">
                {name !== activeProfile && (
                  <Form method="post">
                    <input type="hidden" name="intent" value="load" />
                    <input type="hidden" name="name" value={name} />
                    <button type="submit" className="px-3 py-1.5 text-xs bg-[var(--color-accent)]/15 text-[var(--color-accent)] rounded-lg hover:bg-[var(--color-accent)]/25">Load</button>
                  </Form>
                )}
                <Form method="post">
                  <input type="hidden" name="intent" value="delete" />
                  <input type="hidden" name="name" value={name} />
                  <button type="submit" className="px-3 py-1.5 text-xs text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 rounded-lg" onClick={(e) => { if (!confirm(`Delete "${name}"?`)) e.preventDefault(); }}>Delete</button>
                </Form>
              </div>
            </div>
          ))}
        </div>
      )}

      {sessionRunning && (
        <p className="mt-4 text-xs text-[var(--color-warning)] flex items-center gap-1.5">
          <span>⚠</span> Loading a profile will stop the running team.
        </p>
      )}
    </div>
  );
}
