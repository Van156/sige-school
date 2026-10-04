import { createFileRoute } from "@tanstack/react-router";

import { DashboardScreen } from "../-screens/dashboards/dashboard-screen";

/** `/prototype/sige/dashboard?role=...`: the dashboard of the active role (DASH-01..07). */
export const Route = createFileRoute("/prototype/sige/_shell/dashboard")({
  component: DashboardScreen,
});
