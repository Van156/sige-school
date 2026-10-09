/** Public API of the institution feature (SIGE module 02 tenant screens, INS-06…18). */
export { default as ActiveInstitutionBanner } from "./components/active-institution-banner";
export { default as ActiveInstitutionGuard } from "./components/active-institution-guard";
export { default as ConfirmDelete } from "./components/confirm-delete";
export { default as InstitutionBanner } from "./components/institution-banner";
export { useCanManage } from "./hooks/use-can-manage";
export { useDeleteEntity } from "./hooks/use-delete-entity";
export { describeDeleteFailure, isHasDependentsError } from "./lib/delete-failure";
export { default as CampusFormPage } from "./components/campus-form-page";
export { default as CampusesPage } from "./components/campuses-page";
export { default as CourseFormPage } from "./components/course-form-page";
export { default as CoursesPage } from "./components/courses-page";
export { courseSearchDefaults, courseSearchSchema } from "./lib/course-list";
export { default as LevelFormPage } from "./components/level-form-page";
export { default as LevelsPage } from "./components/levels-page";
export { default as CriteriaPage } from "./components/criteria-page";
export { default as CriterionFormPage } from "./components/criterion-form-page";
export { default as PeriodFormPage } from "./components/period-form-page";
export { default as PeriodsPage } from "./components/periods-page";
export { default as SubjectFormPage } from "./components/subject-form-page";
export { default as SubjectsPage } from "./components/subjects-page";
export { default as FormPageLayout, HelpCard } from "./components/form-page-layout";
export { default as InstitutionProfilePage } from "./components/institution-profile-page";
export { INVALID_FORM_MESSAGE } from "./lib/form-messages";
export { mapSubmitError, type SubmitFailure } from "./lib/server-form-error";
export { default as LogoField } from "./components/logo-field";
export {
  PROFILE_FIELDS,
  PROFILE_FIELD_BY_MESSAGE,
  profileFormSchema,
  profileToFormValues,
  type ProfileFormValues,
  type ProfileInput,
} from "./lib/profile-form";
export { INSTITUTION_SELECTOR_PATH } from "./lib/institution-scope";
