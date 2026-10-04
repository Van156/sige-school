import { createFileRoute } from "@tanstack/react-router";

import { GradesUploadScreen } from "../-screens/grades/grades-upload-screen";

/** GRD-03 */
export const Route = createFileRoute("/prototype/sige/_shell/notas/carga-masiva")({
  component: GradesUploadScreen,
});
