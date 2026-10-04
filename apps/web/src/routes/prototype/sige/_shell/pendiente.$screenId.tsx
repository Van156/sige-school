import { createFileRoute } from "@tanstack/react-router";

import { PendingScreen } from "../-components/pending-screen";

/** Placeholder for every screen still marked `pending` in `-screens.ts`. */
export const Route = createFileRoute("/prototype/sige/_shell/pendiente/$screenId")({
  component: PendingRoute,
});

function PendingRoute() {
  const { screenId } = Route.useParams();
  return <PendingScreen screenId={screenId} />;
}
