import { createFileRoute } from "@tanstack/react-router";

import { SubjectsScreen } from "../-screens/institution/subjects-screen";

/** INS-13 */
export const Route = createFileRoute("/prototype/sige/_shell/asignaturas/")({
  component: SubjectsScreen,
});
