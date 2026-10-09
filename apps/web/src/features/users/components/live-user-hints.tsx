import { useEmailAvailability } from "../hooks/use-email-availability";
import { useUsernamePreview } from "../hooks/use-username-preview";
import type { UsernamePreviewParts } from "../lib/username-preview";
import EmailAvailabilityLine from "./email-availability-line";
import UsernamePreviewBox from "./username-preview-box";

/** Container: the USR-02 username preview box fed by the debounced `user.previewUsername`. */
export function LiveUsernamePreview(parts: UsernamePreviewParts) {
  return <UsernamePreviewBox state={useUsernamePreview(parts)} />;
}

/** Container: the USR-02 email availability line fed by the debounced `user.checkEmail`. */
export function LiveEmailAvailability({ email }: { email: string }) {
  return <EmailAvailabilityLine availability={useEmailAvailability(email)} />;
}
