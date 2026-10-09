import { cn } from "@base-template/ui/lib/utils";

import { emailAvailabilityText, type EmailAvailability } from "../lib/email-availability";

/**
 * One-line result of the live email check under the email field (USR-02). Presentational: the
 * caller owns the debounced `user.checkEmail` query. Renders nothing while idle.
 */
export default function EmailAvailabilityLine({
  availability,
}: {
  availability: EmailAvailability;
}) {
  const text = emailAvailabilityText(availability);
  if (text === null) {
    return null;
  }
  return (
    <span
      role="status"
      className={cn(
        availability.status === "available" && "text-success",
        (availability.status === "taken" || availability.status === "unknown") &&
          "text-destructive",
      )}
    >
      {text}
    </span>
  );
}
