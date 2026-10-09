import type { UsernamePreviewParts } from "@/features/users";

/**
 * The `platformUser.previewUsername` input. INS-05 scopes it to the institution; INS-02 previews
 * the rector before the institution exists, so it passes none and sends the bare names.
 */
export function platformPreviewInput(parts: UsernamePreviewParts, institutionId?: string) {
  return institutionId === undefined ? parts : { ...parts, institutionId };
}
