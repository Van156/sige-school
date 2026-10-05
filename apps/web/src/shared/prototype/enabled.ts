/**
 * The prototype lab is dev-only by default. A preview deploy can opt in at build time with
 * `VITE_ENABLE_PROTOTYPE=true` so reviewers can open `/prototype` on a hosted build.
 */
export const isPrototypeEnabled =
  !import.meta.env.PROD || import.meta.env.VITE_ENABLE_PROTOTYPE === "true";
