/**
 * Public surface of the SIGE mock dataset. Screens import from here; the dataset is built once at
 * module load from static definitions plus seeded PRNGs, so every render sees identical data.
 */
export * from "./academics";
export * from "./admin";
export * from "./base";
export * from "./dates";
export * from "./helpers";
export * from "./people";
export * from "./records";
export * from "./school";
export * from "./school-actions";
export * from "./selectors";
export * from "./store";
export type * from "./types";
