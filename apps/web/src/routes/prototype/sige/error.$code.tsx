import { createFileRoute } from "@tanstack/react-router";

import { ErrorScreen } from "./-screens/error-screen";

/** `/prototype/sige/error/404` ... one parameterized screen for 400, 401, 403, 404, 413, 429, 500. */
export const Route = createFileRoute("/prototype/sige/error/$code")({
  component: ErrorRoute,
});

function ErrorRoute() {
  const { code } = Route.useParams();
  return <ErrorScreen code={code} />;
}
