import { orpc } from "@/app/orpc";
import type { UsernamePreviewQuery } from "@/features/users";

import { platformPreviewInput } from "../lib/platform-username-preview";

/**
 * The `platformUser.previewUsername` source for the live username preview. INS-05 passes the
 * institution; INS-02 previews the rector before the institution exists, so it passes none.
 */
export function platformUsernamePreview(institutionId?: string): UsernamePreviewQuery {
  return (input) =>
    orpc.platformUser.previewUsername.queryOptions({
      input: platformPreviewInput(input, institutionId),
    });
}
