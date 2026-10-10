/** Public API of the scheduling feature (SIGE module 04: offerings, assignments, classrooms, time blocks and schedules, SCH-03…12). */
export { default as AssignmentFormPage } from "./components/assignment-form-page";
export { default as AssignmentsPage } from "./components/assignments-page";
export { assignmentSearchDefaults, assignmentSearchSchema } from "./lib/assignment-list";
export { default as ClassroomFormPage } from "./components/classroom-form-page";
export { default as ClassroomsPage } from "./components/classrooms-page";
export { classroomSearchDefaults, classroomSearchSchema } from "./lib/classroom-list";
export { default as TimeBlockFormPage } from "./components/time-block-form-page";
export { default as TimeBlocksPage } from "./components/time-blocks-page";
export { default as OfferingBulkFormPage } from "./components/offering-bulk-form-page";
export { default as OfferingsPage } from "./components/offerings-page";
export { offeringSearchDefaults, offeringSearchSchema } from "./lib/offering-list";
export { default as SchedulesPage } from "./components/schedules-page";
export { hasScheduledClasses, scheduleSearchSchema } from "./lib/schedule-view";
export { default as ScheduleGeneratePage } from "./components/schedule-generate-page";
