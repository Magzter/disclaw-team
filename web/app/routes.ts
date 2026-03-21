import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("onboarding", "routes/onboarding.tsx"),
  route("teams", "routes/teams.tsx"),
  route("teams/:name", "routes/teams.$name.tsx"),
  route("roles", "routes/roles.tsx"),
  route("roles/new", "routes/roles.new.tsx"),
  route("roles/:roleId", "routes/roles.$roleId.tsx"),
  route("bots/new", "routes/bots.new.tsx"),
  route("bots/:botId", "routes/bots.$botId.tsx"),
  route("schedules", "routes/schedules.tsx"),
  route("settings", "routes/settings.tsx"),
  route("setup", "routes/setup.tsx"),
  route("api/action", "routes/api.action.ts"),
  route("api/assign", "routes/api.assign.ts"),
] satisfies RouteConfig;
