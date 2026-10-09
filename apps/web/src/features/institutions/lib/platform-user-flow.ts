import { platformCreatedNotice } from "./platform-user";
import type { CreatedUser } from "@/features/users";

/** The calls INS-05 makes around `platformUser.create`, injected so the flow stays testable. */
export type PlatformUserCreateEffects<TCreated extends CreatedUser> = {
  create: () => Promise<TCreated>;
  notifySuccess: (notice: { title: string; description: string }) => void;
  refresh: () => Promise<unknown>;
  goToList: () => Promise<unknown>;
};

/**
 * INS-05 submit. A failed create rejects, so the form maps the error. Once the user exists the
 * flow never rejects: a failed list refresh or navigation must not be reported as "could not
 * create" (a resubmit would then hit the taken-document conflict). The toast comes first, the
 * refresh is best effort, and the list is reached even when the refresh failed.
 */
export async function runPlatformUserCreate<TCreated extends CreatedUser>(
  effects: PlatformUserCreateEffects<TCreated>,
): Promise<void> {
  const created = await effects.create();
  effects.notifySuccess(platformCreatedNotice(created));
  try {
    await effects.refresh();
  } catch {
    // The list refetches when opened; the user already exists.
  }
  try {
    await effects.goToList();
  } catch {
    // Same: the success toast is already shown and the form stays usable.
  }
}
