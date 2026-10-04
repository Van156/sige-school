import { createFileRoute } from "@tanstack/react-router";

import { StudentsImportScreen } from "../-screens/students/students-import-screen";

/** STU-05 */
export const Route = createFileRoute("/prototype/sige/_shell/estudiantes/importar")({
  component: StudentsImportScreen,
});
