import { createFileRoute } from "@tanstack/react-router";

import { ProfileScreen } from "../-screens/profile-screen";

export const Route = createFileRoute("/prototype/sige/_shell/perfil")({
  component: ProfileScreen,
});
