import { useEmailAvailability } from "../hooks/use-email-availability";
import { useUsernamePreview, type UsernamePreviewQuery } from "../hooks/use-username-preview";
import type { UsernamePreviewParts } from "../lib/username-preview";
import EmailAvailabilityLine from "./email-availability-line";
import UsernamePreviewBox from "./username-preview-box";

/**
 * Container: the username preview box fed by the debounced preview procedure. USR-02 uses the
 * default `user.previewUsername`; the platform screens pass `queryFor` for
 * `platformUser.previewUsername`.
 */
export function LiveUsernamePreview({
  queryFor,
  ...parts
}: UsernamePreviewParts & { queryFor?: UsernamePreviewQuery }) {
  return <UsernamePreviewBox state={useUsernamePreview(parts, queryFor)} />;
}

/** Container: the USR-02 email availability line fed by the debounced `user.checkEmail`. */
export function LiveEmailAvailability({ email }: { email: string }) {
  return <EmailAvailabilityLine availability={useEmailAvailability(email)} />;
}
