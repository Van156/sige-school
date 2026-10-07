# Spec: SIGE — QR access (QR)

- **Status:** Draft
- **Date:** 2026-10-07
- **Stack:** Hono + oRPC (server, Bun; plain Hono route for the reader), TanStack Router + Query (web), Drizzle + Postgres, `qrcode` (QR encoding, QR-D1), `bun:test`
- **Depends on:** [`00-foundation.md`](./00-foundation.md) (§4.2 `qr` grants and platform `qr: ["simulate"]`, §4.4 root inside an institution, §5.2 `qr_token` / `qr_access_log`, R3.13, R3.27, R3.33–R3.34, §6.9 `qr.regenerated`, OD-13, OD-24), [`04-scheduling.md`](./04-scheduling.md) (`schedule_slot`, `classroom`, `teacher_assignment`, `enrollment`), [`03-users.md`](./03-users.md) (`person`, deactivation), [`02-institution.md`](./02-institution.md) (`institution_profile.current_academic_year`, impersonation), [`01-auth-and-dashboards.md`](./01-auth-and-dashboards.md) (sidebar, `me.impersonating`), [`data-table.md`](../data-table.md).

Prototype sources: `apps/web/src/routes/prototype/sige/-screens/qr/*`, `-components/qr-code.tsx` (a decorative pseudo-QR, not a real encoder), `-lib/qr.ts`, `-mock/engagement.ts` (`simulateQrScan`, `regenerateQrToken`). Inventory §3.15, F11. Requirement ids: `QR-R<n>`. Phase P9.

## 1. Objective and scope

Every member has one personal QR token shown as a digital ID ("Identidad Digital"). A reader at a classroom posts the token; the server decides, in the institution's time zone, whether that person may enter that room right now and logs every attempt. Staff monitor the log; root can simulate a reader. The module also owns the reader endpoint and the reader keys that authenticate it (OD-13).

### In scope

| Screen | Title                                | Roles             | Real route            |
| ------ | ------------------------------------ | ----------------- | --------------------- |
| QR-01  | "Mi Código QR" / "Identidad Digital" | all members       | `/qr`                 |
| QR-02  | "Simulador de Hardware QR"           | R (platform area) | `/admin/qr-simulador` |
| QR-03  | "Monitoreo de Accesos QR"            | R, A, C           | `/qr/monitoreo`       |

Also in scope: tables `qr_token`, `qr_reader_key`, `qr_access_log`; the access evaluator in `packages/sige-core/src/qr.ts`; the reader endpoint `POST /api/qr/validate`; the log retention job; the "Lectores QR" card of QR-03.

### Out of scope

- Physical readers, door hardware and their firmware; offline readers; signed or rotating tokens (a later hardening, OD-13).
- Access rules for guardians, viewers, custom roles or visitors (they are denied by role, QR-R4); entry/exit pairing or presence reports.
- Attendance integration (a scan never creates an attendance row).

## 2. Data

Conventions R2.1–R2.6. Tenant-safe composite FKs to `person`, `classroom`, `campus`.

| Table           | Columns and constraints                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Indexes                                                                               |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `qr_token`      | `person_id` unique, `token text not null` (128-bit random, base64url, 22 characters), `is_active bool default true`, `last_used_at` null, `created_at`, `updated_at`. `unique(token)` (global: a lookup by token never needs the tenant to find the row). Regenerate = replace `token` in place.                                                                                                                                                                                                    | `unique(token)`, `unique(person_id)`                                                  |
| `qr_reader_key` | `name` ≤ 80, `key_hash text not null unique` (SHA-256 hex of the key), `key_prefix` (first 8 characters shown in the UI), `campus_id` null (optional binding), `created_by`, `created_at`, `last_used_at` null, `revoked_at` null, `revoked_by` null. The plain key is shown once at creation and never stored (G-QR-1).                                                                                                                                                                            | `unique(key_hash)`, `(organization_id, revoked_at)`                                   |
| `qr_access_log` | `person_id` null, `classroom_id` null, `reader_key_id` null, `scanned_at timestamptz not null`, `status` enum `qr_log_status` (`authorized`, `denied`, `invalid_token`, `wrong_schedule`), `message text`, `source` text null (client IP, or `SIM-{ip}` for simulated scans), `created_at`. Unknown tokens carry no person; unknown rooms no classroom. FKs `restrict` (R2.6): a classroom referenced by logs cannot be deleted (`HAS_DEPENDENTS`, module 04) until retention purges them (G-QR-5). | `(organization_id, scanned_at desc)`, `(organization_id, person_id, scanned_at desc)` |

`qr_access_log` is a high-volume operational table, not audit rows (R3.27). Retention (OD-24): a daily job modelled on `audit/retention-job.ts` deletes rows older than `QR_LOG_RETENTION_DAYS` (default 365), in batches. Migration: enum + three tables. The seed creates tokens for every seeded person and about 40 log rows, simulated at `--as-of` (R4.4).

## 3. Rules (`packages/sige-core/src/qr.ts`)

Pure evaluator over plain inputs; the service loads the few rows it needs.

```ts
type ScanInput = {
  person: {
    id: string;
    roleKind:
      "owner" | "admin" | "coordinator" | "teacher" | "student" | "parent" | "viewer" | "custom";
    isActive: boolean;
  } | null; // null = unknown or inactive token
  classrooms: { id: string }[]; // resolved from labID: 0 = unknown, >1 = ambiguous
  now: { dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6; time: string }; // Bogotá; 0 = Lunes … 6 = Domingo
  slots: { offeringId: string; teacherPersonId: string | null; teacherAssignmentOk: boolean }[]; // active slots in that room covering `now`
  studentEnrolledOfferingIds: ReadonlySet<string>; // active enrollments of the person (current year)
  studentActive: boolean;
};
type ScanResult = {
  logStatus: LogStatus;
  message: string;
  responseStatus: "success" | "unauthorized" | "error";
};
```

Evaluation order (first match wins; messages verbatim from the prototype):

| #   | Condition                                                                                                                                       | `logStatus`      | Message                                  | `responseStatus` |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ---------------------------------------- | ---------------- |
| 1   | `person` null (token unknown, inactive, or person deactivated)                                                                                  | `invalid_token`  | "Token inválido o inactivo"              | `error`          |
| 2   | no classroom matches `labID`                                                                                                                    | `denied`         | "Ubicación no reconocida"                | `error`          |
| 3   | more than one classroom matches `labID` and the key is not bound to a campus (QR-R3)                                                            | `denied`         | "Ubicación ambigua"                      | `error`          |
| 4   | `roleKind` is owner, admin or coordinator                                                                                                       | `authorized`     | "Acceso autorizado (personal directivo)" | `success`        |
| 5   | `roleKind` is neither teacher nor student                                                                                                       | `denied`         | "Su rol no tiene acceso a salones"       | `unauthorized`   |
| 6   | student with `studentActive = false`                                                                                                            | `denied`         | "Estudiante no activo"                   | `unauthorized`   |
| 7   | teacher: a slot with `teacherPersonId = person.id` and `teacherAssignmentOk`; student: a slot whose offering is in `studentEnrolledOfferingIds` | `authorized`     | "Acceso autorizado"                      | `success`        |
| 8   | otherwise                                                                                                                                       | `wrong_schedule` | "Fuera de horario de clase"              | `unauthorized`   |

A slot "covers now" when `schedule_slot.is_active`, `academic_year` equals the institution's current year, `day_of_week = now.dayOfWeek` (Saturday and Sunday cover nothing) and `start_time ≤ now.time < end_time`. `teacherAssignmentOk` = the offering's assignment is `activo` or `temporal` (foundation R3.34 "active assignment"). The log status shown to staff is "ÉXITO" (`authorized`), "HORARIO" (`wrong_schedule`) and "ERROR" (`denied` and `invalid_token`); the person-facing labels (QR-01) are "Autorizado", "Fuera de Horario" and "Denegado" (both `denied` and `invalid_token`).

Token helpers: `generateToken()` (16 random bytes, base64url) and `generateReaderKey()` (`sige_qr_` + 32 random bytes base64url); both use the platform CSPRNG.

## 4. API

### 4.1 Reader endpoint (no session)

`POST /api/qr/validate`, a plain Hono route mounted outside oRPC; the only SIGE route that does not use a user session (R3.1). Authentication: `Authorization: Bearer <reader key>` (never a query parameter); the server hashes the key and looks it up among non-revoked keys.

| Request                                             | Response (JSON)                                                                                        | HTTP                                                |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------- |
| `{ "labID": string (1–100), "qr": string (1–200) }` | `{ status: "success" \| "unauthorized" \| "error", labID, message, user_name: string \| null }`        | 200 for every evaluated attempt (including denials) |
| malformed body or fields out of bounds              | `{ status: "error", message: "Solicitud inválida" }`                                                   | 400                                                 |
| missing, unknown or revoked key                     | `{ status: "error", message: "Lector no autorizado" }` (nothing is logged: the institution is unknown) | 401                                                 |
| rate limit exceeded                                 | `{ status: "error", message: "Demasiadas solicitudes" }` and `Retry-After`                             | 429                                                 |

`labID` is matched against `classroom.code` first, then `classroom.name` (case-insensitive, trimmed) inside the key's institution, restricted to the key's campus when bound. `user_name` is the person's full name when the token is valid, otherwise `null`. Body ≤ 1 KB. The service resolves "now" itself in `America/Bogota`; readers never send time (R3.13). **Every authenticated request writes exactly one `qr_access_log` row** with `source` = client IP (from the trusted proxy header configured for the deployment) and the key id; `last_used_at` of the key and, on `authorized`, of the token are updated.

Rate limits (OD-13): per key `QR_READER_RATE_LIMIT_PER_MIN` (default 120); per IP 30/min for failed key lookups; in-memory token buckets (single server instance assumed; a shared store is needed before scaling out, OQ-QR-5).

### 4.2 oRPC procedures

Router `routers/sige/qr.ts` (`qrRouter`) with `sigeProcedure` unless stated; errors per R3.5; lists use the shared list contract (R3.8).

| Procedure             | Permission                                   | Input                                                                                                                                                                                                                                                                               | Output                                                                                                       | Notes                                                                                     |
| --------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `qr.my`               | any active member (no extra permission)      | –                                                                                                                                                                                                                                                                                   | `{ person: { name, roleLabel, username }, institutionName, token: string \| null, activity: ActivityRow[] }` | QR-01; own person only; `activity` = last 10 logs of the person                           |
| `qr.regenerate`       | any active member                            | –                                                                                                                                                                                                                                                                                   | `{ token: string, created: boolean }`                                                                        | creates the first token or replaces the current one atomically; QR-R2                     |
| `qr.logs`             | `qr:monitor`                                 | list input (`qr-log-list-config.ts`: sort `scannedAt`, `user`, `role`, `classroom`, `status`; filters `search` text (user, room, message), `status` select `authorized` \| `wrong_schedule` \| `error`, `classroomId` select, `scannedAt` dateRange; default sort `scannedAt` desc) | `{ rows: LogRow[], total }`                                                                                  | QR-03 (R3.8)                                                                              |
| `qr.readerList`       | `qr:manage_readers`                          | –                                                                                                                                                                                                                                                                                   | `{ id, name, keyPrefix, campusName: string \| null, createdAt, lastUsedAt, revoked: boolean }[]`             | "Lectores QR" card (QR-R7)                                                                |
| `qr.readerCreate`     | `qr:manage_readers`                          | `{ name: string (1–80), campusId?: string \| null }`                                                                                                                                                                                                                                | `{ id, key: string }`                                                                                        | `key` is returned **once**                                                                |
| `qr.readerRevoke`     | `qr:manage_readers`                          | `{ id }`                                                                                                                                                                                                                                                                            | `{ revoked: true }`                                                                                          | immediate; later requests with that key get 401                                           |
| `qr.simulatorOptions` | platform `qr:simulate` (`platformProcedure`) | `{ institutionId?: string }`                                                                                                                                                                                                                                                        | `{ institutions: { id, name }[], classrooms: { id, name, code: string \| null }[] }`                         | QR-02; classrooms only when `institutionId` is given                                      |
| `qr.simulate`         | platform `qr:simulate` (`platformProcedure`) | `{ institutionId, classroomId, token, at?: { dayOfWeek: 0 \| 1 \| 2 \| 3 \| 4, time: string } }`                                                                                                                                                                                    | `{ logStatus, responseStatus, message, userName: string \| null }`                                           | QR-02; same evaluator, `source` = `SIM-{ip}`, no reader key; default `at` = now in Bogotá |

`ActivityRow` = `{ scannedAt, classroomName: string | null, logStatus }`; `LogRow` = `{ id, scannedAt, userName: string | null, roleLabel: string | null, classroomName: string | null, logStatus, message: string | null, source: string | null }`. Platform procedures take `institutionId` because they run without a tenant context (R3.2 governs tenant routers).

### 4.3 Audit

| Procedure         | Action              | Metadata                                 |
| ----------------- | ------------------- | ---------------------------------------- |
| `qr.regenerate`   | `qr.regenerated`    | `{ created: boolean }` (never the token) |
| `qr.readerCreate` | `qr.reader_created` | `{ readerId, name, campusId }` (G-QR-1)  |
| `qr.readerRevoke` | `qr.reader_revoked` | `{ readerId }` (G-QR-1)                  |

Scans are logged in `qr_access_log`, not in the audit log.

## 5. Business rules and validation

Messages verbatim from the prototype and inventory (accents restored).

- QR-R1 **Evaluation.** The evaluator of §3 is the single implementation used by the reader endpoint and the simulator. It runs against the institution of the reader key (or `institutionId` for the simulator); a token that belongs to another institution is "Token inválido o inactivo" (no cross-tenant disclosure).
- QR-R2 **Tokens.** One token per person (`unique(person_id)`), created lazily by the first "Generar Código" (the seed creates them for demo users). `qr.regenerate` replaces the token in one statement, so the old value stops working immediately, resets `last_used_at` to null and returns the new value; deactivating a person (module 03) makes their token resolve as invalid without deleting it; reactivating restores it. Superadmins have no person and no token (QR-01 is hidden for them).
- QR-R3 **Room resolution.** `labID` matches `classroom.code` (exact, case-insensitive) first and, if none, `classroom.name`. Classroom codes are unique per campus, not per institution, so the same code may exist twice; a reader key bound to a campus resolves inside it, an unbound key facing more than one match is denied "Ubicación ambigua" (OQ-QR-2).
- QR-R4 **Who may enter.** Owner, admin and coordinator: any room at any time. Teachers: only when a slot of an offering they teach (`activo`/`temporal` assignment) covers the current Bogotá weekday and time in that room. Students: only an `activo` student with an `activa` enrollment (current year) in an offering whose slot covers now in that room. Parents, viewers and custom roles: "Su rol no tiene acceso a salones". Weekends cover no slots.
- QR-R5 **Logging.** One `qr_access_log` row per authenticated reader request and per simulation, including denials; `person_id` null for unknown tokens, `classroom_id` null for unknown or ambiguous rooms. The record is written before the response is sent; a logging failure returns HTTP 500 `{ status: "error", message: "Error del servidor" }` and the door must stay closed.
- QR-R6 **QR-01 content.** Header "Mi Código QR" / "Identidad Digital". Card "Identidad Digital": the QR (real encoder, QR-D1), green pill **"Token Activo y Seguro"**, full name, role label, the token text in monospace, buttons "Descargar Carnet" and "Regenerar Código". Confirm **"¿Seguro que desea regenerar su QR?"** / "El código anterior dejará de funcionar instantáneamente."; toast **"Su código QR ha sido regenerado exitosamente."** (first generation: "Código QR generado"). Without token: empty block **"Aún no tienes un código"** / "Genera tu código para presentarlo en los lectores." and "Generar Código". "Descargar Carnet" renders a PNG client-side (canvas: institution name, full name, role label, QR) named `carnet-{username}.png`; no server call.
- QR-R7 **Reader keys.** Created and revoked by callers with `qr:manage_readers` (owner, admin; OQ-QR-1, resolved in foundation §4.2) from the card "Lectores QR" of QR-03. The key is displayed once in a dialog with a copy button and the warning "Guárdela ahora; no se mostrará de nuevo."; afterwards only `key_prefix` is visible. Revoking asks "¿Revocar este lector? Dejará de funcionar de inmediato." A revoked key stays listed as "Revocado".
- QR-R8 **Monitoring.** `qr.logs` is institution-wide for `qr:monitor` (owner, admin, coordinator; root through impersonation). Role badge = the person's current member role (a role change is reflected retroactively; the log stores no role snapshot). Filters and search are server-side; the 50-row cap of the prototype ("últimos 50") becomes ordinary pagination.
- QR-R9 **Simulator.** `qr.simulate` mirrors a reader without a key: it needs a classroom and a token (pasted by hand: root cannot read other users' tokens, so the prototype's "Rellenar con el token de" role shortcut is not built), and optionally a weekday/time override (the prototype fixed the reference Monday). Result callout: **"ÉXITO: {mensaje}"** when `logStatus = authorized`, otherwise **"DENEGADO: {mensaje}"**, with "Usuario: {nombre}" or "Usuario no identificado".
- QR-R10 **Retention.** Logs older than `QR_LOG_RETENTION_DAYS` (default 365, OD-24) are purged by the daily job; QR-01 and QR-03 never show more than what exists.

## 6. Web

Feature folder `apps/web/src/features/qr`; routes `routes/_auth/_org/qr/` (QR-01, QR-03) and `routes/_auth/admin/qr-simulador.tsx` (QR-02, platform area, superadmin only). QR rendering uses a real encoder (`qrcode`, error correction M, payload = token) inside `QrCode` (the prototype's pseudo-QR is replaced). `ToneBadge`, `SectionCard`, `EntityList`/`DataTable`, `ConfirmAction` from the shared kit. Every screen has loading, error-with-retry, empty and permission states.

### 6.1 QR-01 `/qr`

Layout of QR-R6 (left card) and, on the right, card **"Actividad Reciente"** (last 10 scans: "Fecha y Hora" `dd/mm/yyyy HH:MM`, "Ubicación" ("Desconocida" when null), "Estado" badge "Autorizado" green / "Fuera de Horario" amber / "Denegado" red; empty **"Aún no se registran escaneos con su código QR."**) and card **"Instrucciones de Uso"**: "Presente este código en el lector ubicado a la entrada de cada salón o laboratorio." / "El acceso solo se habilitará durante su horario de clase programado." / "No comparta su código QR; cada acceso queda registrado a su nombre."

### 6.2 QR-02 `/admin/qr-simulador`

Header "Simulador de Hardware QR" / "Herramienta de desarrollo - Solo ROOT"; back "Volver al monitoreo" (→ QR-03 when impersonating, else the platform home). Card "Simular escaneo": "Institución" (additive: required select, preselected by `?institution=`; the prototype was already inside one), "1. Seleccionar Ubicación (Lector)" ("Seleccione un salón/laboratorio...", options "{nombre} ({código o 'Sin código'})"), "2. Token del Usuario (Simular Escaneo)" (placeholder "Pegue el token aquí...", help 'Puede encontrar su propio token en la sección "Mi QR".' — shown only when the root has a person; otherwise "Pida el token al usuario desde su sección «Mi Código QR»."), "3. Día y hora simulados" (day select "Hoy" or Lunes…Viernes, time input default now). Errors: "Selecciona la ubicación del lector.", "El token es obligatorio.", "Indica la hora simulada." Button "Simular Pulso de Escaneo". Result callout per QR-R9. Help card "¿Cómo funciona?": "Emite una señal idéntica a la de un lector físico." / "El sistema valida el token contra el horario de clases." / "Se genera un registro en los logs de acceso (QR-03)."

### 6.3 QR-03 `/qr/monitoreo`

Header "Monitoreo de Accesos QR" / "Intentos de acceso registrados, los más recientes primero"; for impersonating root, action "Ir al Simulador" (stops impersonation and opens QR-02 for this institution, OQ-QR-3). Card **"Registro de Accesos QR"** with chip "{n} registros", search "Buscar por usuario, salón o mensaje" and filters "Estado" ("Todos", "ÉXITO", "HORARIO", "ERROR"), "Salón", date range. Columns: "Timestamp" (`dd/mm/yyyy HH:MM:SS`, Bogotá), "Usuario" ("Anónimo"), "Rol" (badge or "N/A"), "Ubicación" ("Desconocida"), "Estado" ("ÉXITO" green, "HORARIO" amber, "ERROR" red), "Mensaje" ("-"), "Origen" (monospace, "---"). 15 rows per page. Empty: **"Sin registros"** / "Aún no hay intentos de acceso registrados." Card **"Lectores QR"** (only with `institution:update`): table "Nombre", "Prefijo", "Sede", "Creado", "Último uso", "Estado" ("Activo"/"Revocado"), action "Revocar"; button "Crear lector" (dialog "Nombre *", "Sede (opcional)"); empty "Aún no hay lectores. Cree uno para conectar un lector físico."

## 7. Flows and audit

- **F11** QR access: QR-01 shows the personal QR and "Descargar Carnet"; "Regenerar Código" invalidates the old token; a reader posts `{labID, qr}`, the server evaluates and logs; QR-03 lists the attempts and QR-01 "Actividad Reciente" the person's last ten; root simulates through QR-02.
- Audit: §4.3; scans are in `qr_access_log`.

## 8. Testing and acceptance

### 8.1 Tests

- **Unit** (`sige-core`): the evaluator table (each of the eight rows, including row order: invalid token before unknown room, staff before role check), slot coverage boundaries (`start_time` inclusive, `end_time` exclusive, 1 s before/after), Saturday/Sunday, `temporal` vs `inactivo` assignment, student not enrolled / enrollment `retirada` / retired student, labID resolution (code before name, case, whitespace, ambiguity with and without campus binding), token and key generators (length, alphabet, uniqueness over 10,000 draws).
- **API integration** (Postgres): reader endpoint — valid key + authorized teacher/student/staff, wrong schedule, parent denied, unknown token, token of another tenant, unknown room, ambiguous room, deactivated person, regenerated token (old fails immediately, new works), revoked key (401, nothing logged), missing/garbled key, malformed body (400), oversized body, rate limit (429 with `Retry-After`), response shape and `user_name`, **one log row per authenticated request** with source and key id, Bogotá clock boundary (Sunday 23:59 UTC-5 vs Monday UTC), logging failure keeps the door closed (500); `qr.my`/`qr.regenerate` (lazy creation, own person only, activity last 10, audit without token); `qr.logs` filters/sort/pagination, role badge, tenant isolation (other tenant's logs never appear), permission matrix per role (`qr:monitor` owner/admin/coordinator; teacher, student, parent, viewer `FORBIDDEN`); `qr.reader*` (`institution:update` only, key shown once, hash stored, revoke); simulator (superadmin only, rejects an impersonated owner session, logs `SIM-` source); retention job deletes only rows past the cutoff; no `organizationId` in tenant schemas.
- **Web**: QR-01 empty/first-generation/regenerate flows, token and status copy, PNG carnet generation, QR encodes the token (decode round-trip in test); QR-02 field errors and result callout; QR-03 columns, "Anónimo"/"Desconocida"/"N/A" fallbacks, status filter mapping (ERROR = denied + invalid), reader card key-once dialog; stories for `QrCode`, status badges and the reader dialog.

### 8.2 Acceptance

- A scan at the right room and time is `authorized`; otherwise `wrong_schedule`, `denied` or `invalid_token`; every attempt is logged (P9 exit criterion of foundation §8).
- Regenerating invalidates the previous token instantly; the root simulator reproduces reader outcomes.
- QR validation evaluates the schedule in `America/Bogota` (foundation §10).

## 9. Decisions, open questions and notes

### 9.1 Decisions

- QR-D1 **Real QR encoding.** The prototype's `QrCode` draws a deterministic pseudo-pattern that no scanner can read; production uses the `qrcode` package (pure JS, client side) with the token as payload.

### 9.2 New open questions

| ID      | Question                                                                                     | Recommended default                                                                                                                                                                                                                                       |
| ------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OQ-QR-1 | Where do reader keys live and who manages them (no screen in the 94, no permission in §4.2)? | A "Lectores QR" card on QR-03 gated by `institution:update` (owner, admin). Better: add `qr: ["monitor", "manage_readers"]` to the catalog for owner and admin and move the gate.                                                                         |
| OQ-QR-2 | Classroom codes are only unique per campus; how does a reader name its room?                 | Optional campus binding per reader key; unbound keys get "Ubicación ambigua" on duplicates. Recommend binding keys to a campus in multi-campus institutions.                                                                                              |
| OQ-QR-3 | The simulator is root-only but QR-03 is reached through impersonation (session = the rector) | QR-02 lives under `/admin` (platform session). QR-03's "Ir al Simulador" stops impersonation and opens `/admin/qr-simulador?institution=…`. Alternative: allow `qr.simulate` for an impersonated session whose `impersonatedBy` user holds `qr:simulate`. |
| OQ-QR-4 | Show the raw token under the QR (prototype) or hide it behind a toggle?                      | Show it as in the prototype (root's simulator and debugging need it); a "Mostrar token" toggle is a one-line change if schools consider it shoulder-surfing risk.                                                                                         |
| OQ-QR-5 | Rate limiting state for the reader endpoint                                                  | In-memory buckets are enough for one server instance; move to the database or a shared store before running several instances.                                                                                                                            |

### 9.3 Gaps found in 00-foundation.md

- G-QR-1 §5.2 has no table for the per-institution reader key required by OD-13/R3.34, no permission to manage it, no `reader_key_id` on `qr_access_log`, and §6.9 has no `qr.reader_created`/`qr.reader_revoked` events; added here (§2, §4.3, OQ-QR-1). **Resolved in 00-foundation (§5.2 `qr_reader_key`, `qr_access_log.reader_key_id`; §4.2 `qr:manage_readers`; §6.9 reader audit events; §6.12).**
- G-QR-2 R3.33 specifies a 128-bit random token while the inventory/prototype use a UUID; this spec uses 128 random bits as 22 base64url characters. The prototype QR image is not a real QR code (QR-D1). **Noted in 00-foundation: R3.33 (128-bit random token) stands; the prototype UUID is not carried over.**
- G-QR-3 §6.12 says the evaluation uses "the current Bogotá weekday/time" but not the clock source or inclusive bounds; fixed in §3 (`start ≤ t < end`, server clock only). **Resolved in 00-foundation (§6.12 server clock, `start <= t < end`).**
- G-QR-4 §4.4 makes QR-02 a `platformProcedure`, but root reaches institution screens through impersonation, where the session is the rector's; hence OQ-QR-3 and the `/admin` route. **Noted in 00-foundation: QR-02 stays a `platformProcedure` under `/admin` (OQ-QR-3).**
- G-QR-5 §5.2 `qr_access_log` offers no way to keep the room of a deleted classroom; classroom deletion is blocked while logs reference it (module 04 `HAS_DEPENDENTS`) until retention purges them. A `classroom_name` snapshot column would remove the coupling. **Noted in 00-foundation: classroom deletion blocked while logs reference it; a name snapshot column remains optional.**
