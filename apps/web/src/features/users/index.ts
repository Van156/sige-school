/** Public API of the users feature (SIGE module 03, USR-01…04) and the kit INS-04/05 reuse. */
export { default as UserCreatePage } from "./components/user-create-page";
export { default as UserEditPage } from "./components/user-edit-page";
export { default as UserImportPage } from "./components/user-import-page";
export { default as UsersPage } from "./components/users-page";
export { default as ResetPasswordDialog } from "./components/reset-password-dialog";
export { LiveUsernamePreview } from "./components/live-user-hints";
export { default as UsernamePreviewBox } from "./components/username-preview-box";
export {
  getUserDataColumns,
  HIDDEN_COLUMNS as USER_HIDDEN_COLUMNS,
  type UserColumn,
} from "./components/users-columns";
export { useActivationConfirm } from "./hooks/use-user-activation";
export type { UsernamePreviewQuery } from "./hooks/use-username-preview";
export type { UsernamePreviewParts } from "./lib/username-preview";
export { createdUserNotice, type CreatedUser } from "./lib/user-create-flow";
export {
  hasActiveFilters,
  statTileDisplay,
  toUserListInput,
  USERS_LOAD_ERROR,
  userSearchConfig,
  userSearchDefaults,
  userSearchSchema,
  type UserSearch,
} from "./lib/user-list";
export { resetSuccessMessage, type ResetPasswordRequest } from "./lib/reset-password";
export { isProtectedRole } from "./lib/user-roles";
export { userCreateSearchSchema } from "./lib/user-form";
export type { UserRow, UserStats, UserTableRow } from "./types";
