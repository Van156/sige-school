# API authorization

How `packages/api` authorizes requests. Requirements live in [`docs/specs/auth-multitenant-rbac.md`](../specs/auth-multitenant-rbac.md) (§4.1, §4.5, R4 to R6); this page explains the code.

Code: `packages/api/src/{index,authorization,platform-admin,context}.ts` and `routers/platform.ts`.

## Procedures

| Procedure                                    | Guarantees                                                                                             |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `publicProcedure`                            | Nothing.                                                                                               |
| `protectedProcedure`                         | A session user exists, else `UNAUTHORIZED`.                                                            |
| `orgProcedure`                               | Protected, plus an active organization the caller belongs to. Adds `context.org` and `context.member`. |
| `orgProcedure.use(requirePermission({...}))` | The caller holds every listed org permission, else `FORBIDDEN`.                                        |
| `platformProcedure({...})`                   | Protected, plus every listed platform permission, else `FORBIDDEN`.                                    |

## Org procedures

`orgProcedure` resolves the tenant from the session only. `context.org.id` comes from the caller's membership, never from client input (R5.1). Handlers and list queries must scope by it.

Two distinct failures:

- No organization selected on the session: `NO_ACTIVE_ORGANIZATION`, HTTP 409. It is a client-fixable state ("pick an organization first"), so it stays apart from a real denial (R5.2).
- Organization selected but the caller is no longer a member (for example removed after the session was issued): `FORBIDDEN`.

`activeOrganizationId` is read straight from the session row. That separates the two cases without a second port call for the same fact.

## Permission checks

`requirePermission` and `platformProcedure` take typed permission objects. `OrgPermissions` and `PlatformPermissions` are derived from `orgStatements` and `platformStatements`, so a misspelled feature or action is a compile error, not a silent no-op.

Org checks must honor custom roles stored in `organizationRole` (R4, R5.1). The adapter therefore calls better-auth's server-side `hasPermission`, never the client-side `checkRolePermission`, which only knows the built-in roles.

Platform permissions are layer-isolated: an org `owner` holds none merely by owning organizations (R6.5).

## SIGE roles and catalog

`packages/sige-core` owns the SIGE permission features and the role to grant table as pure data (spec sige/00 §4.2). `packages/auth/src/permissions/org.ts` spreads it into `orgStatements` and builds the built-in roles `coordinator`, `teacher`, `student`, `parent`, `viewer` (and extends `owner`/`admin`); `platform.ts` adds `institution` and `qr:simulate` for `superadmin`. Row-level scope is not part of the grants; it belongs to `ScopePolicy`.

## SIGE procedures

Code: `packages/api/src/sige/{procedure,scope}.ts`, routers in `packages/api/src/routers/sige/`. Spec: sige/00 §4.3 and §6.1, sige/01 AUTH-R1/AUTH-R2.

`sigeProcedure` = `orgProcedure` plus `requireActivePerson`. It reuses the authorization port (session, active-organization membership, custom roles); nothing is forked. After the org checks it loads the caller's `person` by `(context.org.id, session.user.id)` and rejects, in order:

| Condition                           | Error (status 403)         |
| ----------------------------------- | -------------------------- |
| no `person` row in this institution | `NO_PERSON`                |
| `is_active = false`                 | `ACCOUNT_DISABLED`         |
| `must_change_password = true`       | `PASSWORD_CHANGE_REQUIRED` |

It then injects `context.person` (`id`, `userId`, `kind`, `roleName`, names, `mustChangePassword`) and `context.scope`. `kind` comes from `resolveCallerKind(member.role)`: a built-in SIGE role name maps to itself and a name that is no built-in role is `custom` (institution-wide, R1.10). better-auth stores several roles comma-separated, so the value is split first and it fails closed: if any listed role is teacher, student or parent, `kind` is the most restrictive of them (student, then parent, then teacher) and the row scope applies whatever else is listed; otherwise the first built-in name wins, and only a value with no built-in name is `custom`. A second role therefore never lifts a row scope, while permissions stay the union better-auth computes. The kind list is `SIGE_KINDS` in `@base-template/sige-core` (the `CallerKind` type and the test fixture roles derive from it). Add the permission check as usual: `sigeProcedure.use(requirePermission({ grade: ["read"] }))`. Only `me.get` uses `sigePasswordGateExemptProcedure`, which skips the third gate so the web can route to AUTH-03; every other procedure uses `sigeProcedure`. The exemption is a separate builder rather than a path allowlist so it cannot drift when routers are renamed.

### ScopePolicy

`createScopePolicy(subject, resolvers)` returns the per-request row scope. Role grants say what; the policy says which rows.

- `unrestricted` kinds (owner, admin, coordinator, viewer, custom): `studentWhere()` and `offeringWhere()` return `undefined`.
- Restricted kinds (teacher, student, parent): they return a predicate to AND into the query; with no resolver registered they return `sql\`false\`` (fail closed: empty result).
- `inTenant(column)` is `organization_id = <caller org>`; every tenant query starts from it (R3.3). `isSelf(personId)` is the self rule that needs no module table.
- `assertStudent(id)` / `assertOffering(id)` throw `NOT_FOUND`, never `FORBIDDEN` (R1.15). Until a module supplies `studentVisible` / `offeringVisible` they always throw (no such rows exist yet).

Seams for later modules (`ScopeResolvers`, defaults in `DEFAULT_SCOPE_RESOLVERS`, all fail closed): `studentWhere[teacher|student|parent]`, `offeringWhere[teacher|student|parent]` (a `(subject) => SQL` over the module's own table) and `studentVisible` / `offeringVisible` (one tenant-filtered select that also applies the predicate). The enrollment/offering module fills the offering and teacher entries (OD-21); the students module fills the student and parent entries (`student_guardian`). To wire one, replace the entry in `DEFAULT_SCOPE_RESOLVERS` and add a `ScopePolicy` unit test for that kind. `scope-resolvers.ts` (`createSigeScopeResolvers`, wired in `sigeProcedure`) is where the entries live: P3 fills `offeringWhere.teacher` (own offerings whose assignment is `activo` or `temporal`) and `offeringVisible`; student, parent and every student entry stay fail closed until P4.

### Test harnesses

Import from `packages/api/src/sige/testing`. Both run against the test database (they skip locally when it is unreachable and fail loudly in CI) and provision institutions through `provisionUser`. One call per router:

- `testPermissionMatrix({ name, procedures })`: one test per SIGE role x procedure. Each procedure declares its `permissions` (or `null` for any member) and a `run(context)`. The expected verdict comes from the sige-core grant table (`grantedActions`): a role holding every permission must pass the gate, any other must get `FORBIDDEN`. Calls go through the real better-auth roles, so drift between the table and the wired statements fails here.
- `testTenantIsolation({ name, cases })`: provisions tenants Alfa and Beta and runs each `isolationCase` as a tenant Alfa caller. `expectation: "notFound"` requires `NOT_FOUND` for Beta's ids; `"noLeak"` requires that no Beta identifier (org, user, person, username, document, plus `foreignIds(seed)`) appears in the result. Beta's `person` and `member` rows are snapshotted and must not change; `verifyForeignUnchanged` covers module tables. A case can `seed` module rows per tenant.
- `sigeSuite(name, body)` is the shared fixture (`provisionTenant`, `contextFor`) for module tests that need more than the two harnesses.

`routers/sige/me.integration.test.ts` is the pilot, and `sige/testing/harness.integration.test.ts` proves the harnesses catch a forbidden call and a leaky query.

### Institution creation

`institutionAdmin.create` (`routers/sige/institution-admin.ts`, `platformProcedure({ institution: ["create"] })`, so only superadmin) delegates to `createInstitution` in `sige/create-institution.ts`: insert the organization (slug from the name, `-2`, `-3` on collision; the unique constraint arbitrates concurrent creates of one name, so a collision recomputes the slug and retries, bounded, with a random suffix after a few attempts, then `CONFLICT`), provision the rector with `provisionUser` (role `owner`, actor = root, `impersonatorUserId` when the root session is impersonated), cap `user.maxOrganizations` at 1, then record `organization.created`. `user.created` is written by `provisionUser`. Any failure after the organization insert compensates in reverse (organization delete cascades member and person, then the rector user). USR-R3 is structural: the procedure only ever provisions `owner`. P0 slice: `institution_profile` and default seeding belong to module 02. `institutionAdmin.list` (`listInstitutions`) is a bounded list of at most 200 institutions (the limit applies before owners are joined), newest first, each with its rector: the oldest `owner` member by `member.created_at`, gated on `institution:update`. Mapped errors: `BAD_REQUEST` (validation), `CONFLICT` (rector email or document taken).

## Authorization port

`AuthorizationPort` (`authorization.ts`) is the only thing the procedure builders depend on:

- `getActiveMembership(headers)`
- `hasOrgPermission(headers, permissions)`
- `hasPlatformPermission(userId, permissions)`

Procedures never import better-auth, so they are unit tested with a fake port. `createBetterAuthAuthorization` is the production adapter. It takes a narrow structural type (`AuthorizationAuthApi`), which any real `Auth` instance satisfies, so `packages/api` needs no better-auth dependency.

The port reaches the procedures through `Context` (`context.ts`): `authorization`, `platformAdmin`, `headers`. Ports re-derive session and organization from the request headers rather than trusting precomputed values.

## Platform procedures

`platformProcedure(permissions)` checks `hasPlatformPermission(session.user.id, permissions)`. Actor identity comes from the session, never from input.

## User-scoped audit reads

Security-log rows (`scope = "user"`) have no organization, so no org permission reads them and organization admins never see them. `audit.listSelf` is a `protectedProcedure` that takes the user from the session, never from input. `audit.listUser` is `platformProcedure({ audit: ["read"] })`, so superadmin only, and takes `{ userId, ...listInput }`; the platform activity list excludes the user scope. See [audit-log.md](./audit-log.md#user-reads).

## Account deletion and the last owner

Deleting an account is refused with `409 USER_IS_LAST_OWNER` while the user is the only `owner` of any organization (account-settings R6.1). The check runs when the deletion is requested and again when the emailed link is opened (`beforeDelete`); it is an authorization-style guard in `packages/auth`, not a procedure. The response lists the blocking organizations so the user can transfer ownership or delete them first.

## Owner promotion limit and ownership transfer

Becoming an owner counts against the R1.1b limit: promoting a member to `owner` is refused with `403 TARGET_REACHED_MAXIMUM_NUMBER_OF_ORGANIZATIONS` when the target already owns their effective maximum (account-settings R9). The `beforeUpdateMemberRole` hook and `organization.transferOwnership` share one helper, `hasReachedOwnedOrgLimit` (`packages/auth/src/org-limit.ts`), and one error code, so the web maps both the same way.

`organization.transferOwnership` (`orgProcedure`; `organizationId` must equal the active organization) guards, in order: caller is an owner (`FORBIDDEN`), target is not the caller (`BAD_REQUEST`), target is a member of this organization (`NOT_FOUND`). In one transaction it locks both member rows (`FOR UPDATE`), re-checks the caller's owner role (`CONFLICT`) and the target's role and limit under the lock, then sets target to `owner` and caller to `admin`.

## Platform admin port

`PlatformAdminPort` (`platform-admin.ts`) wraps better-auth's admin actions behind the same pattern: `getUser`, `banUser`, `unbanUser`, `setOrganizationLimit`. `routers/platform.ts` depends on the port only.

Impersonation (R6.4) is intentionally not in the port. better-auth's `/admin/impersonate-user` and `/admin/stop-impersonating` change the caller's own session cookie. oRPC here does not forward that `Set-Cookie` (no `ResponseHeadersPlugin` wiring), so the session row would change while the browser cookie did not. The convention:

- Session and identity actions use better-auth's client (`authClient.admin.impersonateUser`, `authClient.admin.stopImpersonating`, in `apps/web/src/lib/auth-client.ts`).
- App-domain platform actions (ban, unban, get, org limit) go through the port and oRPC.

better-auth enforces R6.4 itself whichever client calls it (see `packages/auth/src/admin-impersonation.integration.test.ts`).

`PlatformAdminAuthApi` types each endpoint as `(input: any) => Promise<any>`. better-auth exposes every endpoint as an overloaded `StrictEndpoint`, and TypeScript checks an overloaded value against a single-signature type using its first overload (the `asResponse: true` one). Typing the real input shape would make a real `Auth` instance fail to satisfy the type. The adapter builds each input from the port's own typed parameters and casts the result, so port callers keep full type safety. Only this boundary is loose.

Result shapes differ: `banUser` and `unbanUser` return `{ user }`; `getUser` and `adminUpdateUser` return the user directly.

## Error mapping

Only documented denials become a "no" answer; everything else is a server fault.

| Call                | Treated as denial                                                    | Result  |
| ------------------- | -------------------------------------------------------------------- | ------- |
| `getActiveMember`   | `NO_ACTIVE_ORGANIZATION`, `MEMBER_NOT_FOUND`                         | `null`  |
| `hasPermission`     | `NO_ACTIVE_ORGANIZATION`, `USER_IS_NOT_A_MEMBER_OF_THE_ORGANIZATION` | `false` |
| `userHasPermission` | message `"user not found"` (no `code`)                               | `false` |

Lacking a permission is a normal `{ success: false }` return, never a throw.

Anything else (a DB failure, an `APIError` with an unrecognized code, an unexpected shape) is logged once and rethrown, so oRPC returns a 500 instead of a silent `FORBIDDEN`. The log carries the operation name and the error's name and message only, never request headers (session cookie) or the permissions payload.

Errors are recognized structurally (`name === "APIError"`, then `body.code`, or `body.message` for the few code-less errors). That mirrors better-auth's own `isAPIError` fallback and avoids a runtime dependency on `better-auth`.

`PlatformAdminPort` applies the same policy through `rethrowMapped`. A known code becomes an `ORPCError`; anything else propagates unchanged.

| better-auth code          | oRPC error    |
| ------------------------- | ------------- |
| `USER_NOT_FOUND`          | `NOT_FOUND`   |
| `YOU_CANNOT_BAN_YOURSELF` | `BAD_REQUEST` |

## Web permission checks

The web app mirrors permissions for UX only (R5.3). Hiding or disabling an action never replaces the server check above, which re-validates every request.

Code: `apps/web/src/features/access-control/{hooks,lib}`.

### `useCan` and `usePlatformCan`

- `useCan(permission)` asks the server's `organization.hasPermission`, not the client-only `checkRolePermission`. The client check evaluates the statically known roles only and excludes an organization's custom roles (better-auth's own caveat), so it would under-report what a custom-role member can do (R4).
- Results are cached per active organization, member role and permission, with `staleTime` 60 s. It is not a live subscription. The roles and members pages invalidate the `["active-member-role"]` and `["can"]` keys after their own role-changing mutations. A change made by someone else, in another tab or straight against the API shows up within the 60 s window, not instantly.
- `deriveCanState` settles to `{ can: false, isPending: false, error }` as soon as either backing query fails. Without it the `can` query stays disabled, and so pending forever, whenever the member-role query never produces data. `refetch` re-runs both queries so a page gate can offer Retry instead of a permanent "No access".
- `usePlatformCan` calls `admin.hasPermission` with no `userId` or `role`: better-auth 1.7.5 then resolves both from the caller's own session, never from client input (R6.5, layer isolation). Today's platform catalog has two roles (`superadmin` with everything, `user` with nothing), so it mostly guards a future narrower platform role.
- `hasPermissionLoadError`: a query that has resolved once keeps its card rendered when a later background refetch fails. Replacing an authorized, possibly mid-edit card with a full-card error on a transient failure is worse than showing stale but correct data. Only a first load that failed reports an error.
- `decideOrgLayoutGuard` (R1.4): a failed `organization.list()` surfaces an error. It is never treated as "zero organizations", which would send someone with real organizations to the onboarding screen.

### Role catalog (`role-catalog.ts`)

- `buildRoleCatalog` lists the built-in roles first in fixed order, then custom roles as fetched. The built-in `statements` are readonly literal tuples that do not structurally match `PermissionsRecord`; the UI only reads them, so the cast is safe at runtime (the same generic-variance friction as the `orgAc`/`orgRoles` cast in `app/auth-client.ts`).
- `isPermissionSubset` backs the no-escalation rule for invites (R2.2), role changes (R3.2) and custom roles (R4.2). It is UX only.
- `assignableRoles` returns `[]` when the caller's permissions could not be resolved: fail closed, offer nothing rather than guess.
- `resolveCallerPermission` unions the permissions of a comma-separated multi-role string. Unknown role names are skipped and `null` means none resolved.
- `findRoleDefinition` compares names case-sensitively, as better-auth stores them. `isDuplicateRoleName` is case-insensitive: better-auth 1.7.5 lowercases the incoming name (`normalizeRoleName`) before both the built-in collision check and the database uniqueness check on `create-role` and `update-role`, and stores the lowercased value. So "Admin" and "admin" are the same name (`crud-access-control.mjs`).
- `groupCatalogByFeature` reads the code catalog, so a feature added in `packages/auth/src/permissions/org.ts` appears in the roles editor with no change here.
