import { createFileRoute } from "@tanstack/react-router";

import { CoursesScreen } from "../-screens/institution/courses-screen";

/** INS-11 */
export const Route = createFileRoute("/prototype/sige/_shell/cursos/")({
  component: CoursesScreen,
});
