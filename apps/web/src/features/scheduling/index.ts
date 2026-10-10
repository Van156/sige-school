/** Public API of the scheduling feature (SIGE module 04: offerings, classrooms and time blocks, SCH-05…10). */
export { default as ClassroomFormPage } from "./components/classroom-form-page";
export { default as ClassroomsPage } from "./components/classrooms-page";
export { classroomSearchDefaults, classroomSearchSchema } from "./lib/classroom-list";
export { default as TimeBlockFormPage } from "./components/time-block-form-page";
export { default as TimeBlocksPage } from "./components/time-blocks-page";
export { default as OfferingBulkFormPage } from "./components/offering-bulk-form-page";
export { default as OfferingsPage } from "./components/offerings-page";
export { offeringSearchDefaults, offeringSearchSchema } from "./lib/offering-list";
