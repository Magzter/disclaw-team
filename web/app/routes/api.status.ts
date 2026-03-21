export async function loader() {
  const { getTeamStatus } = await import("../lib/status.server");
  const status = getTeamStatus();
  return Response.json({
    sessionRunning: status.sessionRunning,
    needsRestart: status.needsRestart,
  });
}
