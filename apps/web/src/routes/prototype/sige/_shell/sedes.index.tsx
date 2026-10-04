import { createFileRoute } from "@tanstack/react-router";

import { CampusesScreen } from "../-screens/institution/campuses-screen";

/** INS-07 */
export const Route = createFileRoute("/prototype/sige/_shell/sedes/")({
  component: CampusesScreen,
});
