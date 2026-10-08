/** Public API of the institution feature (SIGE module 02 tenant screens, INS-06…18). */
export { default as ActiveInstitutionBanner } from "./components/active-institution-banner";
export { default as ActiveInstitutionGuard } from "./components/active-institution-guard";
export { default as ConfirmDelete } from "./components/confirm-delete";
export { default as InstitutionBanner } from "./components/institution-banner";
export { useCanManage } from "./hooks/use-can-manage";
export { useDeleteEntity } from "./hooks/use-delete-entity";
export { describeDeleteFailure, isHasDependentsError } from "./lib/delete-failure";
