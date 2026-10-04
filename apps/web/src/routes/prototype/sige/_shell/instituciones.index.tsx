import { createFileRoute } from "@tanstack/react-router";

import { InstitutionsListScreen } from "../-screens/institution/institutions-list-screen";

/** INS-01 */
export const Route = createFileRoute("/prototype/sige/_shell/instituciones/")({
  component: InstitutionsListScreen,
});
