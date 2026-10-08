// Allowlists and SQL for the user list (sige/03 §3.3, USR-01). The config is pure data shared by
// the oRPC procedure (`createListInput`) and the web table; `buildUserListQuery` turns a parsed
// input into SQL over `person` joined with `user` and `member`.
import { buildListQuery, buildListWhere } from "@base-template/db/lib/list-query";
import type { ListColumns, ListFilter, ListQueryInput } from "@base-template/db/lib/list-query";
import * as schema from "@base-template/db/schema";
import { and, eq, not, or, sql } from "drizzle-orm";
import type { AnyColumn, SQL } from "drizzle-orm";

import type { ListInputConfig } from "./list-input";

/** Role filter tokens (sige/03 §3.3). `admin` stands for both `owner` and `admin` (D3). */
export const USER_ROLE_FILTERS = [
  "admin",
  "coordinator",
  "teacher",
  "student",
  "parent",
  "viewer",
] as const;

export const USER_STATUS_FILTERS = ["active", "inactive"] as const;

export const userListConfig = {
  sortableColumns: ["username", "name", "role", "status", "createdAt", "lastLoginAt"],
  filterableColumns: {
    name: "text",
    username: "text",
    role: { variant: "select", options: USER_ROLE_FILTERS },
    status: { variant: "select", options: USER_STATUS_FILTERS },
  },
  defaultSort: [{ id: "createdAt", desc: true }],
} as const satisfies ListInputConfig<string, string>;

export type UserListInput = ListQueryInput<
  (typeof userListConfig.sortableColumns)[number],
  keyof typeof userListConfig.filterableColumns
>;

/** Roles stored in `member.role`: one name, or several separated by commas (better-auth). */
const memberRoleTokens = sql`regexp_split_to_array(trim(${schema.member.role}), '\\s*,\\s*')`;

/** SQL: the member holds `token` among its comma-separated roles. */
export const hasRoleToken = (token: string): SQL => sql`${token} = any(${memberRoleTokens})`;

/** Tokens a role filter value stands for (D3). */
const tokensOf = (value: string): string[] => (value === "admin" ? ["owner", "admin"] : [value]);

export const hasAnyRoleToken = (value: string): SQL =>
  or(...tokensOf(value).map(hasRoleToken)) as SQL;

const fullName = sql`${schema.person.firstName} || ' ' || ${schema.person.lastName}`;

/** The text "name" filter searches these; the full name also matches "first last". */
const NAME_SEARCH_COLUMNS: Record<string, AnyColumn | SQL> = {
  firstName: schema.person.firstName,
  lastName: schema.person.lastName,
  fullName,
  username: schema.user.username,
  email: schema.user.email,
};

const POSITIVE_TEXT_OPERATORS = new Set(["iLike", "eq", "isNotEmpty"]);

function nameCondition(filter: ListFilter, joinOperator: "and" | "or"): SQL {
  const parts = Object.entries(NAME_SEARCH_COLUMNS).map(([key, column]) =>
    buildListWhere({
      columns: { [key]: column as AnyColumn } satisfies ListColumns,
      filters: [{ ...filter, id: key }],
      joinOperator,
    }),
  ) as SQL[];
  // A user matches a positive search when any field does, and a negative one when no field does.
  return (POSITIVE_TEXT_OPERATORS.has(filter.operator) ? or(...parts) : and(...parts)) as SQL;
}

function roleCondition(filter: ListFilter, joinOperator: "and" | "or"): SQL {
  const value = Array.isArray(filter.value) ? "" : filter.value;
  switch (filter.operator) {
    case "eq":
      return hasAnyRoleToken(value);
    case "ne":
      return not(hasAnyRoleToken(value));
    default:
      return buildListWhere({
        columns: { role: schema.member.role },
        filters: [filter],
        joinOperator,
      }) as SQL;
  }
}

function statusCondition(filter: ListFilter): SQL {
  const value = Array.isArray(filter.value) ? "" : filter.value;
  const active = eq(schema.person.isActive, true);
  switch (filter.operator) {
    case "eq":
      return value === "active" ? active : not(active);
    case "ne":
      return value === "active" ? not(active) : active;
    case "isEmpty":
      return sql`false`; // a person is always either active or inactive
    case "isNotEmpty":
      return sql`true`;
    default:
      throw new Error(`Operator "${filter.operator}" is not supported for status filters`);
  }
}

const FILTER_COLUMNS = {
  username: schema.user.username,
} as const satisfies ListColumns;

/**
 * Column ids to sortable expressions. `name` sorts by last then first name; `role` by the raw
 * `member.role`; `status` by `is_active` (inactive first when ascending).
 */
const SORT_COLUMNS = {
  username: schema.user.username,
  name: sql`${schema.person.lastName} || ' ' || ${schema.person.firstName}` as unknown as AnyColumn,
  role: schema.member.role,
  status: schema.person.isActive,
  createdAt: schema.person.createdAt,
  lastLoginAt: schema.person.lastLoginAt,
} as const satisfies ListColumns;

function filterCondition(filter: ListFilter, joinOperator: "and" | "or"): SQL {
  switch (filter.id) {
    case "name":
      return nameCondition(filter, joinOperator);
    case "role":
      return roleCondition(filter, joinOperator);
    case "status":
      return statusCondition(filter);
    default:
      return buildListWhere({ columns: FILTER_COLUMNS, filters: [filter], joinOperator }) as SQL;
  }
}

/**
 * `where`, `orderBy`, `limit` and `offset` for the user list. `name` searches first name, last
 * name, "first last", username and email (an OR of per-field conditions evaluated by the shared
 * adapter); `role` and `status` need SQL the generic adapter cannot express (token match over
 * `member.role`, boolean state), so they are evaluated here. The caller adds the tenant scope.
 */
export function buildUserListQuery(input: UserListInput) {
  const base = buildListQuery({
    columns: SORT_COLUMNS,
    input: { ...input, filters: [] },
    tieBreakers: [schema.person.id],
  });
  const conditions = input.filters.map((filter) => filterCondition(filter, "and"));
  const where =
    conditions.length === 0
      ? undefined
      : input.joinOperator === "or"
        ? or(...conditions)
        : and(...conditions);
  return { ...base, where };
}
