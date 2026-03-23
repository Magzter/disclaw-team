import { redirect } from "react-router";

export async function action({ request }: { request: Request }) {
  const form = await request.formData();
  const actionType = form.get("action") as string;
  const rawBotId = form.get("botId") as string | null;
  const botId = rawBotId && /^[a-zA-Z0-9_-]+$/.test(rawBotId) ? rawBotId : undefined;

  console.log(`[api.action] ${actionType} ${botId || "all"}`);

  try {
    const { cliStart, cliStop } = await import("../lib/cli.server");

    switch (actionType) {
      case "start":
        try {
          const { regenerateAllState } = await import("../lib/regenerate.server");
          console.log("[api.action] regenerating state...");
          await regenerateAllState();
          console.log("[api.action] state regenerated");
        } catch (err) {
          console.error("[api.action] regenerate failed:", err);
        }
        console.log("[api.action] calling cliStart...");
        cliStart(botId);
        console.log("[api.action] cliStart called (async)");
        break;
      case "stop":
        cliStop(botId);
        break;
      case "restart":
        cliStop(botId);
        try {
          const { regenerateAllState } = await import("../lib/regenerate.server");
          await regenerateAllState();
        } catch {}
        cliStart(botId);
        break;
    }
  } catch (err) {
    console.error(`[api.action] ${actionType} failed:`, err);
  }

  const referer = request.headers.get("Referer");
  const url = referer ? new URL(referer).pathname : "/";
  return redirect(url);
}
