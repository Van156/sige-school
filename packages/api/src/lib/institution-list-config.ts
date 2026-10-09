// Allowlists of the platform institution list input (sige/02 §3.1, INS-01). Pure data shared by
// the oRPC procedure (`createListInput`) and the web table (columns, route search).
import type { ListInputConfig } from "./list-input";

/**
 * Institutions (`institutionAdmin.list`). The text filters are case-insensitive searches over the
 * organization name and the profile's NIT and municipality. `campuses` and `students` sort by
 * their counts; they are not filterable. Default order: newest first.
 */
export const institutionListConfig = {
  sortableColumns: [
    "name",
    "nit",
    "municipality",
    "academicYear",
    "campuses",
    "students",
    "createdAt",
  ],
  filterableColumns: {
    name: "text",
    nit: "text",
    municipality: "text",
  },
  defaultSort: [{ id: "createdAt", desc: true }],
} as const satisfies ListInputConfig<string, string>;
