# SIGE legacy inventory (for the clickable prototype)

Source: legacy Flask + Jinja app `SISTEMA_ESCOLAR` ("SIGE - Sistema Integral de Gestión Escolar").
Purpose: let a frontend developer rebuild every screen of the prototype from this file alone.
Prose is English; original Spanish UI labels are kept in "quotes" because the prototype copy will be Spanish.

How to read this file:

- Screen IDs (e.g. `AUTH-01`, `INS-05`) are stable references used by the flows (section 4) and the mock dataset (section 5).
- "Legacy URL" is the Flask route (blueprint prefix applied). The prototype does not need to keep these URLs; it only needs equivalent screens.
- Allowed roles are the ones enforced by `@role_required` in `routes/*.py`. `any auth` = `@login_required` only.
- Icons in the legacy app are Bootstrap Icons (`bi-*`); the prototype may use any icon set, the intent is given where useful.
- Where the legacy code is buggy or inconsistent, a "Legacy quirk" note says so and gives the recommended prototype behaviour. Prototype = clean intended behaviour, not bug-for-bug.
- Every list screen in the legacy app is a DataTables table (client-side search box, column sort, page-size selector, pagination, Spanish i18n: "Buscar", "Mostrar N registros", "Anterior/Siguiente"). Treat "table" as "searchable, sortable, paginated table" unless stated otherwise.

---

## 0. Global conventions

### 0.1 Product shell

- Product name: "SIGE", tagline "Sistema Integral de Gestión Escolar" (sidebar subtitle "Sistema de Gestión Escolar").
- Language: Spanish (`lang="es"`), Colombian school context (DANE, NIT, EPS, estrato, jornada, acudiente, boletín, "ganada/perdida").
- Layout when authenticated: fixed left **sidebar** (collapsible via hamburger button; overlay on mobile) + top **navbar** + flash-message area + content (`container-fluid`) + footer ("© {year} SIGE - Sistema Integral de Gestión Escolar").
- Sidebar header: building icon + "SIGE" (links to dashboard) + subtitle. Sidebar footer: avatar circle, full name, role badge.
- Top navbar: hamburger toggle, "Inicio" button (to dashboard), user dropdown showing avatar + full name (hidden on small screens) + role badge. Dropdown items: "Dashboard", "Mi Perfil", divider, "Cerrar Sesión" (red).
- Role badge colours: root = primary(blue), admin = success(green), coordinator = info(cyan), teacher = warning(yellow), others (student, parent, viewer) = secondary(grey). Legacy prints `role|title` (English: "Root", "Admin", "Teacher", ...). Prototype should show Spanish labels: "Root", "Administrador", "Coordinador", "Profesor", "Estudiante", "Acudiente", "Consulta (viewer)".
- Unauthenticated layout: only the content block + footer (login page).
- Flash messages (top of content, dismissible alert with icon): categories `success` (green, check), `info`, `warning` (amber), `error`/`danger` (red). Used for every POST outcome.
- Common feedback strings: "Bienvenido/a, {nombre}!", "Ha cerrado sesión exitosamente.", "Por favor inicia sesión para acceder a esta página.", "Usuario o contraseña incorrectos.", "Su cuenta está desactivada. Contacte al administrador.".

### 0.2 Reusable UI patterns (macros in `templates/macros/ui_components.html`)

| Macro                                                         | Shows                                                                                                                                      |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `page_header(title, subtitle, icon, action_button)`           | H1 with icon, grey subtitle line, optional right-aligned action button                                                                     |
| `info_banner(text, icon, type)`                               | Coloured info strip with icon and one paragraph                                                                                            |
| `stat_card(title, value, icon, color)`                        | KPI card: coloured icon tile, small grey label, large number; animated fade-in with delay                                                  |
| `quick_link_card(title, subtitle, icon, color, url)`          | Clickable card with big icon, title, subtitle (used for dashboards)                                                                        |
| `config_link(title, subtitle, icon, color, url)`              | Compact clickable row-card with icon, bold title, small subtitle                                                                           |
| `empty_state(icon, title, subtitle, button_text, button_url)` | Centered large icon + H4 + sub-text + optional primary button. Defaults: "No hay datos disponibles" / "Aún no se han registrado registros" |
| `card_modern(title, icon, color)`                             | Card with coloured header + body (call block)                                                                                              |
| `btn_group(links)`                                            | Row of buttons from `[{url,icon,text}]`                                                                                                    |
| `status_badge(text, color)`                                   | Pill badge                                                                                                                                 |

### 0.3 Cross-cutting behaviours

- **Institution context.** Every non-root user belongs to exactly one institution (`user.institution_id`); all data is scoped to it. **Root** has no institution and works inside an "active institution" kept in session (`active_institution_id`), chosen via the institution selector (`INS-03`). Most root screens in the Institution module show a **root selector card** ("Selecciona una institución: Como administrador del sistema, debes seleccionar una institución para gestionar ...") when none is active, listing radio cards (name, "municipio, departamento", "NIT: ...", "Año: ...") and a primary button "Seleccionar y Gestionar {Sedes|Grados|...}". When one is active the page header shows a button "Cambiar Institución" and a banner card with the institution name, location and a badge "Vista Root" (admin sees "Tu Institución").
- **Delete** actions are POST forms behind a browser `confirm()` / SweetAlert dialog: "¿Eliminar {entidad} {nombre}? Esta acción no se puede deshacer." Prototype: use a confirm dialog and remove the row (or show an error toast when the entity has dependents).
- **Form validation**: server-side; errors are shown inline under the field (red text) plus a flash "⚠️ Por favor corrige los errores marcados en el formulario". Required fields are marked with a red `*`.
- **Forms with side panels**: most create/edit forms are a 2/3-width form card plus a 1/3-width "Información" / "Consejos" help card (static text, given below only when informative).
- **Error pages** (`AUTH-05`): 400, 401, 403, 404, 413, 429, 500 share one layout.

### 0.4 Color semantics reused everywhere (keep consistent in the prototype)

| Meaning                                                                                     | Colour                              |
| ------------------------------------------------------------------------------------------- | ----------------------------------- |
| Score >= 4.5 / "ganada" with excellence / positive / low severity ("baja")                  | green                               |
| Score >= 3.0 (passing) / "ganada" / "presente"                                              | green or blue                       |
| Score < 3.0 / "perdida" / "ausente" / high severity ("alta") / negative observation         | red                                 |
| "justificado" / "excusado" / medium severity ("media") / warnings                           | amber (justificado often cyan/blue) |
| "tarde" does NOT exist as an attendance status (only presente/ausente/justificado/excusado) | -                                   |
| "no evaluado" / pending / inactive                                                          | grey                                |

---

## 1. Roles and navigation

### 1.1 Roles (confirmed from `models/user.py`, `User.role` values)

There are exactly **seven** roles: `root`, `admin`, `coordinator`, `teacher`, `student`, `parent`, `viewer`.

| Role          | Spanish label              | Scope                                               | Summary of capability                                                                                                                                                                                                                                                 |
| ------------- | -------------------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `root`        | Root (super-administrador) | All institutions; no own institution                | Creates institutions and their first admin, switches active institution, resets any user's password, simulates QR scans, sees everything admin sees. Cannot be deleted.                                                                                               |
| `admin`       | Administrador (Rector)     | Own institution                                     | Full management of own institution: structure (campuses, levels, courses, subjects, periods, criteria), users (all roles except root/admin creation), students, enrollment/scheduling, grades, attendance, observations, report cards, metrics, achievements, alerts. |
| `coordinator` | Coordinador                | Own institution                                     | Academic supervision: read structure (campuses/levels/courses/periods), manage students, enrollment & scheduling, view/lock grades, observations, report cards, metrics, alerts, achievements, QR monitoring. Cannot manage users or create structure.                |
| `teacher`     | Profesor                   | Own institution, only own subject-grade assignments | Enter grades, take attendance, create observations, see own metrics, students list, subjects/criteria read-only, "Dashboard Profesor".                                                                                                                                |
| `student`     | Estudiante                 | Self                                                | Sees own dashboard, schedule, grades, attendance history, observations, achievements, QR code.                                                                                                                                                                        |
| `parent`      | Acudiente (padre/madre)    | Linked children only (`ParentStudent`)              | "Portal de Padres": per child grades, attendance, observations, report cards, achievements.                                                                                                                                                                           |
| `viewer`      | Consulta                   | Own institution, read-only                          | Only a read-only dashboard with 4 KPIs and "Mi Código QR".                                                                                                                                                                                                            |

Role helper rules in `User`: `can_edit_grades` = root/admin/teacher; `can_view_all_grades` = root/admin/coordinator.
Default landing after login (`GET /` -> `/dashboard` redirects by role): root->`DASH-01`, admin->`DASH-02`, coordinator->`DASH-03`, teacher->`DASH-04`, student->`DASH-05`, parent->`PAR-01` (parent portal dashboard), viewer->`DASH-07`.

### 1.2 Navigation per role (`templates/base.html`)

Sidebar structure in order (an item appears only for the roles listed):

| #   | Section / item (Spanish)                                                                   | Target screen                                                    | Roles that see it                           |
| --- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- | ------------------------------------------- |
| 1   | "Dashboard"                                                                                | role dashboard                                                   | all authenticated                           |
| 2   | "Institución" (collapsible group)                                                          |                                                                  | root, admin                                 |
| 2a  | root: "Gestionar Instituciones" ; admin: "Datos Institución"                               | INS-01 (root) / INS-06 (admin)                                   | root / admin                                |
| 2b  | "Sedes"                                                                                    | INS-07                                                           | root, admin                                 |
| 2c  | "Niveles Académicos"                                                                       | INS-09                                                           | root, admin                                 |
| 2d  | "Cursos"                                                                                   | INS-11                                                           | root, admin                                 |
| 2e  | "Asignaturas"                                                                              | INS-13                                                           | root, admin                                 |
| 2f  | "Periodos"                                                                                 | INS-15                                                           | root, admin                                 |
| 2g  | "Criterios Evaluación"                                                                     | INS-17                                                           | root, admin                                 |
| 3   | "Usuarios" (group)                                                                         |                                                                  | root, admin                                 |
| 3a  | "Todos"                                                                                    | USR-01                                                           | root, admin                                 |
| 3b  | "Profesores" (`?role=teacher`)                                                             | USR-01 filtered                                                  | root, admin                                 |
| 3c  | "Coordinadores" (`?role=coordinator`)                                                      | USR-01 filtered                                                  | root, admin                                 |
| 3d  | "Estudiantes" (`?role=student`)                                                            | USR-01 filtered                                                  | root, admin                                 |
| 3e  | "Acudientes" (`?role=parent`)                                                              | USR-01 filtered                                                  | root, admin                                 |
| 3f  | "Nuevo Usuario"                                                                            | USR-02                                                           | root, admin                                 |
| 4   | "Matrícula y Programación" (group)                                                         |                                                                  | root, admin, coordinator                    |
| 4a  | "Matrículas"                                                                               | SCH-01                                                           | same                                        |
| 4b  | "Asignar Profesores"                                                                       | SCH-03                                                           | same                                        |
| 4c  | "Materias por Grado"                                                                       | SCH-05                                                           | same                                        |
| 4d  | "Salones"                                                                                  | SCH-07                                                           | same                                        |
| 4e  | "Horarios"                                                                                 | SCH-11                                                           | same                                        |
| 4f  | "Bloques Horarios"                                                                         | SCH-09                                                           | same                                        |
| 5   | "Estudiantes"                                                                              | STU-01                                                           | root, admin, coordinator, teacher           |
| 6   | "Notas"                                                                                    | GRD-01                                                           | root, admin, teacher, coordinator           |
| 7   | "Asistencia"                                                                               | ATT-01                                                           | root, admin, coordinator, teacher, student* |
| 8   | "Observaciones"                                                                            | OBS-01                                                           | root, admin, coordinator, teacher           |
| 9   | "Boletines"                                                                                | RPT-01                                                           | root, admin, coordinator                    |
| 10  | "Métricas"                                                                                 | MET-01 (teacher: MET-05, since MET-01 is forbidden for teachers) | root, admin, coordinator, teacher           |
| 11  | "Logros"                                                                                   | ACH-01                                                           | root, admin, coordinator, teacher, student* |
| 12  | "Alertas Tempranas" (red numeric badge from `/alerts/api/count`, hidden when 0, "99+" cap) | ALR-01                                                           | root, admin, coordinator                    |
| 13  | "Portal Padres"                                                                            | PAR-01                                                           | parent                                      |
| 14  | "Monitoreo QR"                                                                             | QR-03                                                            | root, admin, coordinator                    |
| 15  | "Mi Código QR"                                                                             | QR-01                                                            | all authenticated                           |

\* Legacy quirk: the `student` role sees "Asistencia" and "Logros" in the sidebar, but those routes are `@role_required` without `student`, so the click yields a 403. The student actually reaches their own data through dashboard cards (`DASH-05`) pointing to `GRD-08`, `ATT-02`, `OBS-05`. **Prototype recommendation:** student sidebar = Dashboard, "Mi Horario" (SCH-11 in student mode), "Mis Notas" (GRD-08), "Mi Asistencia" (ATT-02), "Mis Observaciones" (OBS-05), "Mis Logros" (ACH-02), "Mi Código QR".

Resulting menus (what each role sees):

- **root**: Dashboard · Institución[Gestionar Instituciones, Sedes, Niveles Académicos, Cursos, Asignaturas, Periodos, Criterios Evaluación] · Usuarios[Todos, Profesores, Coordinadores, Estudiantes, Acudientes, Nuevo Usuario] · Matrícula y Programación[6 items] · Estudiantes · Notas · Asistencia · Observaciones · Boletines · Métricas · Logros · Alertas Tempranas · Monitoreo QR · Mi Código QR.
- **admin**: identical to root except 2a is "Datos Institución" (no institution list/creation).
- **coordinator**: Dashboard · Matrícula y Programación[6 items] · Estudiantes · Notas · Asistencia · Observaciones · Boletines · Métricas · Logros · Alertas Tempranas · Monitoreo QR · Mi Código QR. (The structure screens Sedes/Niveles/Cursos/Periodos are routable for coordinators, but the sidebar group "Institución" is hidden; dashboard `DASH-03` links to Grados/Asignaturas/Periodos/Criterios.)
- **teacher**: Dashboard · Estudiantes · Notas · Asistencia · Observaciones · Métricas · Logros · Mi Código QR.
- **student**: Dashboard · Asistencia* · Logros* · Mi Código QR (see quirk).
- **parent**: Dashboard · Portal Padres · Mi Código QR.
- **viewer**: Dashboard · Mi Código QR.

Active-state rule: the item whose URL prefix matches the current path is highlighted; groups open when a child path is active.

---

## 2. Domain model

### 2.1 Entity hierarchy

```
Institution (1) ──< Campus (sede) ──< GradeLevel (nivel: "Sexto") ──< Grade (curso/grupo: "6-01")
Institution ──< AcademicPeriod (4 per year)
Institution ──< GradeCriteria (weights sum to 100)
Institution ──< Subject (asignatura)
Subject ──< SubjectGrade >── Grade        (a subject taught in a course by one teacher: "Materias por Grado")
SubjectGrade ── teacher (User role=teacher)
User(role=student) ── 1:1 ── AcademicStudent ──> Institution, Campus, Grade
User(role=parent) ──< ParentStudent >── AcademicStudent
AcademicStudent ──< StudentEnrollment >── SubjectGrade (per academic year)
Campus ──< Classroom (salón), Campus ──< ScheduleBlock (bloque horario)
SubjectGrade ──< Schedule >── Classroom (weekly slot)
GradeRecord (student × subject-grade × period × criterion → score) → FinalGrade (per period) → AnnualGrade (year)
Attendance (student × subject-grade × date)
Observation (student, author)
Alert (student) · Achievement (catalog) ──< StudentAchievement >── AcademicStudent
ReportCard (student × period) ──< ReportCardObservation (per subject-grade)
QRToken (1 per user) · QRAccessLog
```

Multi-tenancy: `Institution` is the tenant. `Campus.institution_id`; `Grade.campus_id`; `Subject.institution_id`; `AcademicPeriod.institution_id`; `GradeCriteria.institution_id`; `User.institution_id`; `AcademicStudent.institution_id`.

### 2.2 Entities and fields

Types: `str(n)` = string length n, `bool`, `int`, `float`, `date`, `datetime`, `time`. `*` = required. `FK->` = foreign key.

**Institution** (`institutions`): `name*` str(150) · `nit` str(20) unique · `address` str(200) · `phone` str(20) · `email` str(100) · `logo` str(200) file path · `municipality` str(100) · `department` str(100) · `resolution` str(100) ("Resolución de Aprobación", free text like "Resolución No. 1234 del 01/01/2025") · `academic_year` str(20) default "2026" · `created_at`.

**Campus / Sede** (`campuses`): `institution_id*` · `name*` str(150) · `code` str(20) (e.g. "SEDE-001"; DANE code in the spec) · `address` str(200) · `jornada` str(50): `manana` | `tarde` | `completa` (default completa; displayed title-cased "Manana/Tarde/Completa" -> prototype: "Mañana/Tarde/Completa") · `is_main_campus` bool (only one per institution) · `active` bool (default true) · `created_at`.

**GradeLevel / Nivel Académico** (`grade_levels`): `campus_id*` · `name*` str(50) ("Primero", "Sexto", "Once", "Transición") · `order_num` int default 0 (sorting; 0 = first). Unique(campus, name). Hierarchy Institution → Campus → GradeLevel → Grade.

**Grade / Curso (grupo)** (`grades`, shown as "Grados"/"Cursos"): `campus_id*` · `level_id` FK->GradeLevel (optional) · `director_id` FK->User(teacher) ("Director de Grupo", optional) · `name*` str(50) ("6-01", "11°B", "Transición A") · `academic_year*` str(20) · `shift` str(20): `Mañana` | `Tarde` | `Nocturna` | `Única` | `Sabatina` (default Mañana) · `max_students` int default 40 (form range 1–60). Unique(campus, name, year, shift). Derived: `student_count` = active students.

**Subject / Asignatura** (`subjects`): `institution_id*` · `name*` str(100) · `code` str(20) (unique per institution).

**SubjectGrade / Materia por Grado** (`subject_grades`): `subject_id*` · `grade_id*` · `teacher_id*` FK->User · `hours_per_week` int default 4. Unique(subject, grade, teacher). This is the central join: grades, attendance, enrollments, schedules, report-card observations all hang off `subject_grade_id`.

**AcademicPeriod / Periodo** (`academic_periods`): `institution_id*` · `name*` str(50) ("Primer Periodo"/"Periodo 1") · `short_name*` str(10) ("P1".."P4") · `start_date` · `end_date` · `is_active` bool (current period) · `academic_year*` · `order*` int (1..4). Unique(institution, short_name, year). **Period structure: 4 periods per academic year.**

**GradeCriteria / Criterio de Evaluación** (`grade_criteria`): `institution_id*` · `name*` str(100) · `weight*` float (percent, >0 and <=100) · `description` str(300) · `order*` int. **Default set:** "Seguimiento" 20% ("Tareas, quizzes, participación diaria"), "Formativo" 20%, "Cognitivo" 30% ("Pruebas escritas, evaluaciones de conocimiento"), "Procedimental" 30%. Weights are expected to sum to 100.

**User** (`users`): `username*` unique · `email` unique · `password_hash*` · `first_name*` · `last_name*` · `document_type` ("TI","CC","RC","CE","Pasaporte"; default CC) · `document_number` unique · `birth_date` · `gender` ("M","F","Otro") · `phone` · `address` · `country` · `department` · `municipality` · `role*` (7 values) · `institution_id` (null for root) · `photo` · `is_active` bool · `must_change_password` bool · `last_login` · `created_at`/`updated_at`. Username is auto-generated from first-name initial + last name + last 4 digits of document; **initial password = document number**; first login forces password change (`AUTH-03`).

**AcademicStudent / Estudiante** (`academic_students`): `user_id*` unique FK->User(role=student) · `institution_id*` · `campus_id*` · `grade_id` FK->Grade (nullable) · `neighborhood` ("barrio") · `stratum` int 1–6 ("estrato") · `blood_type` str(5) (O+, A-, ...) · `eps` ("EPS / Salud") · `guardian_name` · `guardian_phone` · `guardian_email` · `enrolled_year` · `status`: `activo` | `retirado` | `graduado`. (Name, document, birth date, gender, phone, address come from the linked `User`.)

**ParentStudent / Acudiente-Estudiante** (`parent_students`): `parent_id` FK->User(role=parent) · `student_id` FK->AcademicStudent · `relationship` str(50): "Padre", "Madre", "Acudiente", ... Unique(parent, student). A parent can have several children; a student several guardians.

**StudentEnrollment / Matrícula** (`student_enrollments`): `student_id` · `subject_grade_id` · `academic_year` · `enrollment_date` · `status`: `activa` | `cancelada` | `retirada` · `final_score` float · `status_note` text. Unique(student, subject-grade, year). Enrolls a student in a specific subject-of-a-course.

**TeacherSubjectAssignment / Asignación de Profesor** (`teacher_subject_assignments`): `subject_grade_id` unique · `teacher_id` · `academic_year` · `assignment_date` · `status`: `activo` | `inactivo` | `temporal` · `notes` text.

**Classroom / Salón** (`classrooms`): `campus_id*` · `name*` str(50) · `code` str(20) (unique per campus) · `capacity` int default 40 · `floor` int default 1 · `building` str(50) · `classroom_type`: `aula` | `laboratorio` | `auditorio` | `cancha` · `resources` text (JSON list of available resources).

**ScheduleBlock / Bloque Horario** (`schedule_blocks`): `campus_id*` · `name*` ("Bloque 1", "Recreo") · `start_time*` · `end_time*` · `is_break` bool · `order_num` int · `shift`: `Mañana` | `Tarde` | `Nocturna` | `Única` · `academic_year*`. Unique(campus, name, year, shift).

**Schedule / Horario** (`schedules`): `subject_grade_id*` · `classroom_id*` · `day_of_week*` int 0=Lunes … 4=Viernes · `start_time*` · `end_time*` · `academic_year*` · `is_active` bool. Unique(classroom, day, start_time, year) → no double booking of a room.

**GradeRecord / Registro de Nota** (`grade_records`): `student_id` · `subject_grade_id` · `period_id` · `criterion_id` · `score*` float **1.0–5.0** · `observation` str(500) · `created_by` FK->User · `locked` bool ("nota cerrada") · timestamps. One record per student × subject-grade × period × criterion.

**FinalGrade / Nota Final del Periodo** (`final_grades`): `student_id` · `subject_grade_id` · `period_id` · `final_score` float · `status`: `ganada` (>=3.0) | `perdida` (<3.0) | `no evaluado` · `observation` · `calculated_at`.

**AnnualGrade / Nota Anual (definitiva)** (`annual_grades`): `student_id` · `subject_grade_id` · `academic_year` · `annual_score` · `status`: `aprobado` (>=3.0) | `reprobado` | `no evaluado`.

**Attendance / Asistencia** (`attendance`): `student_id` · `subject_grade_id` · `date*` · `status*`: `presente` | `ausente` | `justificado` | `excusado` (default presente) · `observation` str(300) (justification) · `recorded_by` FK->User · `created_at`. `is_absent` = ausente; `is_justified` = justificado or excusado.

**Observation / Observación** (`observations`): `student_id` · `author_id` FK->User · `type*`: `positiva` | `negativa` | `seguimiento` | `convivencia` · `category` str(50) (select: "Disciplina", "Rendimiento", "Valores", "Convivencia", "Responsabilidad", "Participación", "Otro") · `description*` text · `date` datetime · `commitments` text ("compromisos") · `notified` bool (parent notified) · timestamps. `requires_notification` = type in (negativa, convivencia).

**Alert / Alerta Temprana** (`alerts`): `student_id` · `alert_type*` · `severity*`: `alta` | `media` | `baja` · `title` str(200) · `description` text · `triggered_at` · `resolved` bool · `resolved_at` · `resolved_by` FK->User · `notes` text. Alert types and rule engine:

| `alert_type`           | Label                  | Icon intent      | Rule                                            | Severity |
| ---------------------- | ---------------------- | ---------------- | ----------------------------------------------- | -------- |
| `riesgo_academico`     | "Riesgo Academico"     | book             | final score < 3.0 in any subject                | alta     |
| `tendencia_negativa`   | "Tendencia Negativa"   | down-arrow chart | score dropped > 0.5 between consecutive periods | media    |
| `inasistencia_critica` | "Inasistencia Critica" | calendar-x       | > 20% absences in last 30 days                  | media    |
| `grupo_riesgo`         | "Grupo en Riesgo"      | people           | > 30% of a group fails with the same teacher    | alta     |
| `riesgo_desercion`     | "Riesgo de Desercion"  | person-x         | absences + low grades combined                  | alta     |
| `mejora_destacable`    | "Mejora Destacable"    | up-arrow chart   | rose > 1.0 point between periods (positive)     | baja     |

Severity colours: alta = red (`danger`), media = amber (`warning`), baja = green (`success`). Icons: alta triangle-exclamation filled, media circle-exclamation, baja check-circle. One unresolved alert per (student, type) at a time. Typical description text: "El estudiante {nombre} tiene nota final de 2.4 en Matemáticas durante Periodo 2. La nota esta por debajo del minimo (3.0)."

**Achievement / Logro (catalog)** (`achievements`): `institution_id` · `name*` · `description*` str(300) · `icon` (emoji) · `criteria` (rule key) · `category` · `is_active`. Seeded rule set (rule key → name, emoji, category, description):

| Key                   | Name                  | Emoji         | Category       | Description                                   |
| --------------------- | --------------------- | ------------- | -------------- | --------------------------------------------- |
| `superador`           | "Superador"           | chart-up      | mejora         | "Subió 1+ punto entre periodos consecutivos"  |
| `excelencia`          | "Excelencia"          | star          | académico      | "Nota >= 4.5 en un periodo"                   |
| `asistencia_perfecta` | "Asistencia Perfecta" | check         | asistencia     | "0 inasistencias en un periodo"               |
| `todo_terreno`        | "Todo Terreno"        | medal         | académico      | "Todas las materias ganadas en el periodo"    |
| `resiliente`          | "Resiliente"          | flexed biceps | mejora         | "Recuperó una materia perdida entre periodos" |
| `constancia`          | "Constancia"          | fire          | académico      | "3 periodos seguidos con promedio >= 4.0"     |
| `companero`           | "Compañero"           | handshake     | comportamiento | "Recibió una observación positiva"            |

**StudentAchievement** (`student_achievements`): `student_id` · `achievement_id` · `earned_at` · `period_id` · `awarded_by` FK->User (null = automatic engine).

**ReportCard / Boletín** (`report_cards`): `student_id` · `period_id` · `generated_at` · `pdf_path` · `general_observation` text · `generated_by` · `delivery_status`: `pendiente` | `entregado` · `delivery_date`. Unique(student, period). **ReportCardObservation** (`report_card_observations`): `report_card_id` · `subject_grade_id` · `observation` str(500) (teacher comment per subject).

**QRToken** (`qr_tokens`): `user_id` unique · `token` UUID string · `is_active` · `created_at` · `last_used_at`. **QRAccessLog** (`qr_access_logs`): `user_id` · `classroom_id` · `timestamp` · `status`: `authorized` | `denied` | `invalid_token` | `wrong_schedule` · `message` · `ip_address`.

### 2.3 Grading scale, rules and structure

- **Scale 1.0 – 5.0**, two decimals (`MIN_GRADE=1.0`, `MAX_GRADE=5.0`).
- **Passing grade 3.0**: score >= 3.0 → `ganada`; < 3.0 → `perdida`. Annual: `aprobado` / `reprobado` with the same threshold.
- **Period final grade** = Σ(score × weight/100) over criteria (default 20/20/30/30). If only some criteria have scores, it is re-normalised: Σ(score×w/100) / Σ(w applied) × 100. Result clamped to 1.0–5.0 and rounded to 2 decimals. Saved as `FinalGrade` with status.
- **Annual grade** = arithmetic mean of the period final grades available (4 periods), rounded to 2 decimals.
- **Locking:** grades can be entered while `GradeRecord.locked` is false. The grade sheet (`GRD-02`) offers "Guardar y Bloquear" and, when locked, "Desbloquear" to whoever can open it; admin/coordinator/root also lock/unlock per subject-grade + period from the lock panel (`GRD-04`). Locked grades are read-only in the sheet.
- **Excellence** threshold used by achievements = 4.5; "good" = 4.0; risk threshold = 3.0. Teacher analytics: failing rate > 30% → "Riesgo Alto"; average < 3.5 → "Atención Necesaria"; else "Óptimo".
- **Performance levels (niveles de desempeño)** are implemented (`get_grade_performance_level`) and printed in grade tables, report cards and the parent portal: **Superior 4.6–5.0**, **Alto 4.0–4.5**, **Básico 3.0–3.9**, **Bajo 1.0–2.9**. Badge colours: Superior green, Alto cyan, Básico amber, Bajo red. (Note the legacy gap: 4.5 < score < 4.6 is unassigned in the printed ranges; implement with `>= 4.6 / >= 4.0 / >= 3.0 / else`.)
- **Academic year**: string "2026". **Periods**: P1..P4 with start/end dates; exactly one `is_active`.
- **Shifts (jornadas)**: Mañana, Tarde, Nocturna, Única, Sabatina (grades); Mañana, Tarde, Nocturna, Única (blocks). Campus jornada: mañana, tarde, completa.
- **Weekly schedule grid**: Monday–Friday (0–4), rows = `ScheduleBlock`s ordered by `order_num` (breaks flagged "Descanso").
- **Document types**: TI (Tarjeta de Identidad), CC (Cédula de Ciudadanía), RC (Registro Civil), CE (Cédula de Extranjería), Pasaporte.

### 2.4 Services / derived metrics (for the metrics screens)

- Teacher stats per subject-grade: average of `FinalGrade.final_score`, failing rate = % with score < 3.0, total students with final grades.
- "Sugerencias IA" (teacher dashboard) are rule-based: (a) same subject code across groups with average difference > 0.7 → warning "Disparidad en {code}" ("Existe una diferencia de X puntos entre {mejor} y {peor}." + action "Revisar si el factor jornada (...) influye en el rendimiento y aplicar técnicas de refuerzo usadas en {mejor}."); (b) failing rate > 25% → danger "Alerta Crítica: {curso}" ("La tasa de reprobación en {materia} es del N%." + action "Implementar plan de nivelación inmediato y revisar la carga académica del grupo.").

---

## 3. Screen inventory

Module index (detailed counts in 3.16; create/edit variants of one form count once):

| Module                                 | Prefix | Screens | Section |
| -------------------------------------- | ------ | ------- | ------- |
| Authentication, profile, errors        | AUTH   | 5       | 3.1     |
| Dashboards (per role)                  | DASH   | 7       | 3.2     |
| Institution configuration (root/admin) | INS    | 18      | 3.3     |
| User management                        | USR    | 4       | 3.4     |
| Matrícula y Programación               | SCH    | 12      | 3.5     |
| Students                               | STU    | 5       | 3.6     |
| Grades                                 | GRD    | 8       | 3.7     |
| Attendance                             | ATT    | 4       | 3.8     |
| Observations                           | OBS    | 5       | 3.9     |
| Report cards                           | RPT    | 4       | 3.10    |
| Metrics                                | MET    | 7       | 3.11    |
| Achievements                           | ACH    | 3       | 3.12    |
| Alerts                                 | ALR    | 3       | 3.13    |
| Parent portal                          | PAR    | 6       | 3.14    |
| QR access                              | QR     | 3       | 3.15    |

### 3.1 Authentication, profile, errors (AUTH)

#### AUTH-01 Login

- Template `templates/login.html` (public layout, no sidebar). Legacy `GET|POST /login`. Roles: public (authenticated users are redirected to the dashboard).
- Purpose: sign in with username or email.
- Layout: centered card on a gradient background. Top: round logo icon, H2 "SIGE", sub "Sistema Integral de Gestión Escolar". Form, then a small footer line "¿Problemas para acceder? Contacte al administrador".
- Form (POST, CSRF, hidden `next`):
  - "Usuario o Correo" text, required, autofocus, placeholder "Ingrese su usuario".
  - "Contraseña" password, required, placeholder "Ingrese su contraseña".
  - "Recordarme" checkbox (remember session).
  - Button "Iniciar Sesión" (full width).
- Behaviour/errors: empty fields → warning "Por favor ingrese usuario y contraseña."; wrong credentials → error "Usuario o contraseña incorrectos."; inactive user → error "Su cuenta está desactivada. Contacte al administrador."; success → "Bienvenido/a, {nombre}!" and redirect to `next` or the role dashboard; if `must_change_password` → warning "⚠️ Debe cambiar su contraseña antes de continuar." and redirect to AUTH-03.

#### AUTH-02 Logout (action, not a screen)

- `GET /logout`. Flash info "Ha cerrado sesión exitosamente." and redirect to AUTH-01. In the prototype this is the user-dropdown item "Cerrar Sesión".

#### AUTH-03 Forced password change (first login)

- Template `templates/auth/force_password_change.html` (standalone page, no sidebar). Legacy `GET|POST /change-password-first-time`. Roles: any auth with `must_change_password = true` (otherwise redirected to the dashboard).
- Layout: centered card. Header with warning icon, H2 "Cambiar Contraseña", sub "Es obligatorio cambiar su contraseña antes de continuar". User box: full name (bold) + username. Footer line "Esta contraseña será su acceso permanente al sistema".
- Form fields (all password inputs with show/hide eye toggle):
  - "Contraseña Actual" required, autofocus, helper "Es su número de documento: {documento}".
  - "Nueva Contraseña" required, min 6 chars, placeholder "Mínimo 6 caracteres". Under it a **strength bar** (5 levels by length>=6, >=8, uppercase, digit, symbol): "Ingrese una contraseña" (0%), "Muy débil" (red 20%), "Débil" (orange 40%), "Regular" (yellow 60%), "Fuerte" (green 80%), "Muy fuerte" (dark green 100%).
  - "Confirmar Nueva Contraseña" required, min 6; live message "Las contraseñas coinciden" (green) / "Las contraseñas no coinciden" (red).
  - Button "Actualizar Contraseña" — **disabled** until current filled, new >= 6 chars and new = confirm.
- Server errors: "La contraseña actual es incorrecta.", "La nueva contraseña debe tener al menos 6 caracteres.", "Las contraseñas nuevas no coinciden.", "La nueva contraseña debe ser diferente a la actual." Success: "✅ Contraseña actualizada exitosamente. Ahora puede acceder al sistema." → dashboard.

#### AUTH-04 My profile ("Mi Perfil")

- Template `templates/profile.html`. Legacy `GET /profile`; posts to `POST /update_profile` and `POST /change_password`. Roles: any auth.
- Layout: H2 "Mi Perfil"; two columns.
  - Left card "Información Personal": form with "Nombre *", "Apellido *" (side by side), "Correo Electrónico *" (email), "Teléfono", "Dirección"; button "Actualizar Información".
  - Right top card "Información de Cuenta": read-only table rows — "Usuario:", "Rol:" (badge), "Documento:" (`{tipo} {número}`), "Último Acceso:" (`YYYY-MM-DD HH:MM` or "Nunca").
  - Right bottom card "Cambiar Contraseña": "Contraseña Actual *", "Nueva Contraseña *" (min 6, hint "Mínimo 6 caracteres"), "Confirmar Contraseña *"; button "Cambiar Contraseña".

#### AUTH-05 Error pages

- Templates `templates/error.html` (generic; also `400/401/403/404/413/429/500.html`, 15 lines each, extend base). Rendered by error handlers. Roles: any.
- Layout: centered, large icon (per code), big code number, title H2, message paragraph, two buttons: "Volver Atrás" (history back) and "Ir al Dashboard"; for codes >= 500 an extra note "**Nota:** Si el problema persiste, contacta al administrador del sistema."
- Specific copy: 403 → "403 / Acceso Prohibido / No tienes permiso para acceder a esta página." with a single button "Volver al Inicio"; 500 → "500 / Error Interno del Servidor / Ha ocurrido un error inesperado. Por favor intente nuevamente."; 404 → not found; 401 → unauthorized; 413 → file too large; 429 → too many requests; 400 → bad request.

### 3.2 Dashboards (DASH)

All dashboard URLs are `GET /dashboard/{role}`; `GET /` and `GET /dashboard` redirect by role. Note: the `@login_required` is the only guard (no role check), but the sidebar only links to the user's own.

#### DASH-01 Root dashboard — "Panel de Administración General"

- Template `templates/dashboard/root.html`. Legacy `GET /dashboard/root`. Roles: root.
- Header: H1 "Panel de Administración General", sub "Gestión centralizada de todas las instituciones educativas"; primary button "Nueva Institución" (→ INS-02).
- KPI row (5 stat cards): "Instituciones", "Usuarios", "Estudiantes" (active), "Profesores", "Admins" — values are global counts.
- Section "Instituciones Registradas": grid of cards, one per institution: name (H4), "NIT: ...", "{municipio}, {departamento}", badge with academic year; "Distribución de Usuarios" **stacked horizontal bar** with 3 segments + legend ("Estudiantes {x}%", "Profesores {y}%", "Admins {z}%"), or text "Sin usuarios registrados aún" when total is 0; 4 mini counters ("Admins", "Sedes", "Profesores", "Estudiantes Activos"); action buttons "Usuarios" (→ INS-04), "Editar" (→ INS-02 edit), "Gestionar Sedes" (selects that institution as active, → INS-07).
- Empty state: "No hay instituciones creadas / Comience creando la primera institución educativa del sistema." + "Crear Primera Institución".
- Section "Accesos Rápidos": 4 link cards — "Gestionar Usuarios" ("Crear, editar y eliminar usuarios", → USR-01), "Lista Instituciones" ("Ver todas las instituciones", → INS-01), "Ver Admins" ("Gestionar administradores", → USR-01 `?role=admin`), "Cambiar Institución" ("Alternar contexto activo", → INS-03).

#### DASH-02 Admin dashboard — "Dashboard Administrador"

- Template `templates/dashboard/admin.html`. Legacy `GET /dashboard/admin`. Roles: admin (root can open it too).
- Header: H1 "Dashboard Administrador", sub "Gestión integral de tu institución educativa". Institution banner (name + "{municipio}, {departamento}").
- KPI row: "Estudiantes" (active), "Profesores", "Grados" (courses), "Asignaturas".
- Card "Acciones Rápidas" (buttons): "Gestionar Estudiantes" (STU-01), "Matrícula y Programación" (SCH-01), "Ingresar Notas" (GRD-01), "Generar Boletines" (RPT-01), "Ver Métricas" (MET-01).
- Card "Configuración del Sistema" (6 `config_link` rows): "Datos Institución" ("Nombre, NIT, contacto" → INS-06), "Gestión de Sedes" ("Crear y editar sedes" → INS-07), "Gestión de Grados" ("Grados y grupos" → INS-11), "Asignaturas" ("Materias y códigos" → INS-13), "Periodos Académicos" ("Periodos y fechas" → INS-15), "Criterios Evaluación" ("Ponderación de notas" → INS-17).
- Data passed: `total_students, total_teachers, total_grades, total_subjects, total_campuses` (campuses is passed but not displayed as a KPI).

#### DASH-03 Coordinator dashboard — "Dashboard Coordinador"

- Template `templates/dashboard/coordinator.html`. Legacy `GET /dashboard/coordinator`. Roles: coordinator.
- Header: H1 "Dashboard Coordinador", sub "Supervisión académica y seguimiento institucional". Institution banner.
- KPI row: "Estudiantes", "Profesores", "Grados", "Asignaturas". (Legacy quirk: route only supplies `total_students` and `recent_observations`, so the other three show 0/blank; prototype should populate all four. `recent_observations` — last 10 — is passed but not rendered; optional widget "Observaciones recientes".)
- Card "Acciones Rápidas": "Ver Estudiantes" (STU-01), "Matrícula y Programación" (SCH-01), "Observaciones" (OBS-01), "Métricas" (MET-01), "Alertas" (ALR-01).
- Card "Resumen Académico" (4 link cards): "Grados — Gestión académica" (INS-11), "Asignaturas — Materias" (INS-13), "Periodos — Periodos académicos" (INS-15), "Criterios — Evaluación" (INS-17).

#### DASH-04 Teacher dashboard — "Dashboard Profesor"

- Template `templates/dashboard/teacher.html`. Legacy `GET /dashboard/teacher`. Roles: teacher.
- Header: H1 "Dashboard Profesor", sub "Bienvenido/a, {nombre completo}".
- KPI row: "Asignaturas" (count of own subject-grades), "Estudiantes a Cargo" (sum of active students across own groups), "Grados" (distinct groups).
- Card "Analítica de Desempeño" with chip "Longitudinal por Materia": table columns **Materia / Grado** (subject name bold + grade name small), **Jornada** (badge), **Promedio** (2 decimals), **Reprobación** (small progress bar coloured by rate + "{n}%"), **Estado** (icon: "Riesgo Alto" red if rate > 30; "Atención Necesaria" amber if average < 3.5; otherwise "Óptimo" green).
- Card "Sugerencias IA": list of plans; each = coloured alert (warning/danger), title (H6), message, "**Sugerencia:** {acción}". Empty: "¡Excelente trabajo! No se detectan anomalías críticas en el rendimiento de tus grupos." (rules in 2.4).
- Card "Gestión de Clases": table **Asignatura** (name + code small), **Grado** (badge), **Acciones**: buttons "Notas" (→ GRD-02 for that subject-grade and the first period), "Asistencia" (→ ATT-01), "Observaciones" (→ OBS-03). Empty: "No tienes asignaturas asignadas aún / Contacta al administrador para que te asigne materias y grados."

#### DASH-05 Student dashboard — "Mi Dashboard"

- Template `templates/dashboard/student.html`. Legacy `GET /dashboard/student`. Roles: student.
- Header: H1 "Mi Dashboard", sub "Bienvenido/a, {nombre}".
- Profile card: avatar, full name, "Grado: **{curso}**" (or "No asignado"), document number, badge with course name ("Sin grado" if none).
- 3 big link cards: "Mis Notas" ("Ver calificaciones por periodo" → GRD-08), "Mi Asistencia" ("Historial de asistencia" → ATT-02), "Mis Observaciones" ("Seguimiento de comportamiento" → OBS-05).
- Card "Mi Horario de Clases": weekly grid table. Header row **Hora**, **Lunes, Martes, Miércoles, Jueves, Viernes**. One row per schedule block of the student's campus+shift+year, first cell "HH:MM - HH:MM" (+ badge "Descanso" for breaks). Slot cell: subject name (bold), teacher first name, classroom name; empty slots show "-" ("--" on break rows). Empty: "No se ha generado el horario para tu grado todavía."
- Fallback (no academic profile): "Perfil académico no configurado / Contacta al administrador para que asigne tu grado y grupo."
- Data also passed but not rendered: last 10 `final_grades`.

#### DASH-06 Parent dashboard (generic)

- Template `templates/dashboard/parent.html` (34 lines, legacy/duplicate) — superseded by **PAR-01** (route `parent.parent_dashboard`). `GET /dashboard/parent` lists children as cards (name, "Grado", "Documento", button "Ver Notas"; empty "No tienes estudiantes asignados. Contacta al administrador."). **Prototype: do not build separately; use PAR-01.** (Counted as the same screen.)

#### DASH-07 Viewer dashboard — "Dashboard de Consulta"

- Template `templates/dashboard/viewer.html`. Legacy `GET /dashboard/viewer`. Roles: viewer.
- Header: H1 "Dashboard de Consulta", sub "Bienvenido/a, {nombre} - Modo solo lectura". Institution banner.
- KPI row: "Estudiantes", "Profesores", "Grados", "Asignaturas".
- Info callout "Modo Solo Lectura": "Tienes acceso de consulta a la información del sistema. Contacta al administrador si necesitas permisos adicionales."

(Note: `GET /alerts` in the dashboard blueprint, template `alerts.html` (1 line, empty) is dead/legacy; the real alerts module is ALR.)

### 3.3 Institution configuration (INS)

Common to INS-07, INS-09, INS-11 (lists): header with title + subtitle + primary create button; for root, the **root selector** pattern (0.3); an institution banner card; KPI mini-cards; a table card "Listado de ..." ; empty state with create button; row actions = pencil "Editar" link + trash "Eliminar" (POST + confirm).

#### INS-01 Institutions list — "Gestión de Instituciones"

- Template `templates/institution/institutions_list.html`. Legacy `GET /institution/list`. Roles: root.
- Header: H1 "Gestión de Instituciones", sub "Administra todas las instituciones educativas del sistema"; button "Nueva Institución" (→ INS-02).
- KPI row: "Total Instituciones", "Total Sedes", "Total Estudiantes", "Total Admins".
- Table "Listado de Instituciones" (id `institutionsTable`): **Logo** (image or building icon), **Nombre** (bold + email small), **NIT** (badge or "-"), **Ubicación** ("municipio, departamento" or "-"), **Año Lectivo** (badge), **Sedes** (count badge), **Estudiantes** (count badge), **Acciones**: eye "Ver datos completos" (opens detail modal), building "Gestionar sedes" (opens campus management modal), pencil "Editar" (→ INS-02), trash "Eliminar" (POST, confirm "¿Estás seguro de eliminar la institución {nombre}? Esta acción no se puede deshacer.").
- Empty: "No hay instituciones creadas / Comienza creando la primera institución educativa del sistema." + "Crear Primera Institución".
- **Detail modal** "Datos de la Institución": logo (or large building icon), name, "Año {año}", location ("No especificada" when empty); fields NIT, Teléfono, Email, Dirección, Resolución; three stats "Sedes", "Estudiantes", "Año Lectivo"; buttons "Cerrar", "Editar Institución".
- **Campus management modal** "Gestión de Sedes" (loads via JSON API `GET /institution/api/campuses/{id}`): institution name; 4 stats "Total Sedes", "Activas", "Principal" (name or "-"), "Inactivas"; list of campus cards (name + badge "Principal", badge "Activa"/"Inactiva", jornada badge, address, "Código: X", "{n} grado(s)", created date, dropdown "Editar"/"Eliminar"); empty "No hay sedes registradas / Crea la primera sede para esta institución" + "Crear Primera Sede"; error "Error al cargar sedes". Footer buttons "Cerrar", "Nueva Sede".
- **Campus form modal** ("Nueva Sede"/"Editar Sede"): "Nombre de la Sede *" (placeholder "Ej: Sede Principal, Sede Norte..."), "Código" (placeholder "Ej: SEDE-001", help "Código único identificador (opcional)"), "Jornada *" select ("Seleccionar jornada...", Mañana, Tarde, Completa [default]), "Dirección", switch "Sede Activa" (default on; "Las sedes inactivas no aparecerán en listados"), switch "Sede Principal" ("Solo puede haber una sede principal"); buttons "Cancelar", "Guardar Sede". Alerts: "El nombre de la sede es obligatorio", "Debes seleccionar una jornada", "Sede guardada exitosamente", "¿Estás seguro de eliminar la sede "{x}"? Esta acción no se puede deshacer y no debe tener grados asociados."

#### INS-02 Institution form — "Nueva Institución" / "Editar Institución"

- Template `templates/institution/institution_form.html`. Legacy `GET|POST /institution/new`, `GET|POST /institution/{id}/edit`. Roles: root.
- Header: H1 "Nueva Institución" / "Editar Institución", sub "Complete los datos para crear la institución educativa" / "Modifique los datos de la institución educativa"; "Volver" (→ INS-01).
- Card "Datos Institucionales" (multipart form): "Nombre de la Institución _" (placeholder "Ej: Institución Educativa Simón Bolívar"), "NIT" ("900.123.456-7"), "Teléfono" (tel, "(601) 234 5678"), "Correo Electrónico" ("contacto@inst.edu.co"), "Dirección" ("Calle 123 # 45-67, Barrio Centro"), "Municipio" ("Ej: Bogotá"), "Departamento" ("Ej: Cundinamarca"), "Año Lectivo" (default "2026"), "Resolución de Aprobación" ("Resolución No. 1234 del 01/01/2025"), "Logo de la Institución" (file, image/_, help "Formatos: PNG, JPG, JPEG, GIF, WEBP"; on edit shows "Logo actual:" thumbnail).
- **Create only** — card "Crear Administrador (Obligatorio)" with callout "**Requerido:** Cada institución debe tener un administrador (Rector) que la gestione." A live preview box: "Username auto-generado:" + generated username (fetched while typing name/last name) and "Contraseña inicial: Nº de documento". Subsection "📋 Datos Básicos del Admin": "Nombres *" ("Ej: Juan Carlos"), "Apellidos *" ("Ej: Pérez García"), "Tipo Doc. *" (CC, TI, CE), "Nº Documento *" (min 5, help "Se usará como contraseña inicial"), "Email *" ("rector@inst.edu.co"), "Teléfono" ("3001234567"). Helper "El username se genera automáticamente al escribir los datos".
- Buttons: "Crear Institución con Admin" / "Actualizar Institución", "Cancelar".
- Side cards: on edit "Información" (ID, Creada dd/mm/yyyy, Sedes count); always "¿Qué es una Institución?" (agrupa sedes, estudiantes, profesores y datos académicos; puede tener múltiples sedes; gestiona grados y asignaturas; configura periodos; administra criterios) and (create only) "Seguridad del Admin" (username auto from name+document; password = document; must change on first login).
- Errors inline per field (name, nit unique, admin_* fields) + general error banner.

#### INS-03 Select active institution — "Seleccionar Institución"

- Template `templates/institution/select_institution.html`. Legacy `GET /institution/institutions/select`, `POST /institution/switch`, `GET /institution/select-institution/{id}`. Roles: root.
- Header: H1 "Seleccionar Institución", sub "Como administrador del sistema, seleccione la institución donde desea trabajar"; "Volver al Dashboard".
- Callout: "**Importante:** Debe seleccionar una institución para gestionar sedes, grados y otros elementos. Esta selección determina el contexto de trabajo."
- If one is active: card "Institución Actualmente Seleccionada" with name (or "Ninguna").
- Card "Instituciones Disponibles": radio cards (name H6, location, "NIT: x", "Año: y", email); submit "Seleccionar y Continuar"; when a context is active a second button "Ver Todas las Instituciones" (clears context). Empty state "No hay instituciones creadas / Comienza creando tu primera institución educativa del sistema." + "Crear Primera Institución".
- Footer shortcut cards: "Lista Completa" ("Ver todas las instituciones"), "Nueva Institución" ("Crear una nueva institución"), "Dashboard Root" ("Volver al panel principal").
- Prototype: this can double as a header-level "institution switcher" for root.

#### INS-04 Institution users — "Usuarios de {institución}"

- Template `templates/institution/institution_users.html`. Legacy `GET /institution/{id}/users`, `POST /institution/users/{user_id}/change-password`. Roles: root.
- Header: H1 "Usuarios de {nombre}", sub "Gestión de usuarios asignados a esta institución"; buttons "Nuevo Admin" (→ INS-05), "Volver" (→ INS-01).
- Institution banner (name, "municipio, departamento | NIT: x", badge "Root Admin").
- KPI row: "Administradores", "Coordinadores", "Profesores", "Estudiantes".
- Table "Lista de Usuarios" (chip "{n} usuarios"): **Usuario** (role-coloured icon + username + email small), **Nombre Completo**, **Email**, **Rol** (badge: Admin, Coordinador, Profesor, Estudiante, Acudiente, Viewer), **Estado** (Activo/Inactivo), **Acciones**: pencil (→ USR-03), key "Cambiar contraseña" (modal), trash (not for root users; SweetAlert "¿Eliminar usuario?").
- Empty: "No hay usuarios en esta institución / Comienza creando un administrador para esta institución" + "Crear Primer Admin".
- Modal "Cambiar Contraseña": "Usuario" (readonly), "Nueva Contraseña *" (min 6, help "La contraseña debe tener al menos 6 caracteres"), callout "El usuario deberá cambiar esta contraseña en su próximo inicio de sesión."; "Cancelar" / "Actualizar Contraseña".

#### INS-05 Add user to institution — "Crear Usuario en {institución}"

- Template `templates/institution/add_admin_form.html`. Legacy `GET|POST /institution/{id}/users/add-admin`. Roles: root.
- Header "Crear Usuario en {nombre}", sub "Crear nuevo usuario para {nombre}"; "Volver" (→ INS-04). Institution mini banner.
- Callout "**Automático:** El nombre de usuario se genera automáticamente con la inicial del nombre + apellido + últimos 4 dígitos del documento." + preview box "Username auto-generado" / "Contraseña: La establecida arriba".
- Card "Datos del Usuario": "Nombres *", "Apellidos *", "Tipo Documento" (CC - Cédula de Ciudadanía, TI - Tarjeta de Identidad, CE - Cédula de Extranjería), "Nº Documento *" (help "Número de identificación"), "Teléfono" ("3001234567"), "Email *" ("admin@ejemplo.com", help "Correo válido para notificaciones"); callout "**Contraseña automática:** La contraseña inicial será el número de documento ingresado arriba. El usuario deberá cambiarla en su primer inicio de sesión."; "Rol del Usuario *" select: "🔵 Administrador - Gestiona toda la institución", "🟣 Coordinador - Supervisión académica", "🟡 Profesor - Notas, asistencia, observaciones" (default), "🟢 Estudiante - Consulta sus datos", "🔵 Acudiente - Portal de padres", "⚪ Viewer - Solo lectura". Buttons "✅ Crear Usuario", "Cancelar".
- Side cards: "Información" (username auto, password = document, access limited to this institution, must change on first login) and "Roles del Sistema" (Root: "Super-admin: acceso total a todas las instituciones"; Admin: "Administrador: gestiona toda su institución (sedes, grados, usuarios, estudiantes, notas)"; Coordinador: "Supervisión académica: ve notas, boletines, métricas y alertas"; Profesor: "Gestiona notas, asistencia y observaciones de sus grupos"; Estudiante: "Consulta sus notas, asistencia y boletines"; Acudiente: "Portal de padres: ve información de sus acudidos"; Viewer: "Solo lectura: consulta general").

#### INS-06 Institution data — "Configuración de Institución"

- Template `templates/institution/config.html`. Legacy `GET|POST /institution/config`. Roles: root, admin (admin's own institution).
- Header: H1 "Configuración de Institución", sub "Datos principales de la institución educativa".
- Card "Datos de la Institución" (multipart): same fields as INS-02 without the admin block — "Nombre de la Institución *", "NIT" (help "Número de Identificación Tributaria"), "Teléfono", "Correo Electrónico", "Dirección", "Municipio", "Departamento", "Año Lectivo" (default 2026), "Resolución de Aprobación", "Logo" (file; "PNG, JPG, JPEG, GIF, WEBP"; "Logo actual:" preview). Button "Guardar Configuración".
- Side card "Enlaces Rápidos": "Gestionar Sedes", "Gestionar Grados", "Gestionar Asignaturas", "Gestionar Periodos", "Criterios de Evaluación". Side card "Información": "Estos datos aparecen en boletines, reportes y documentos oficiales de la institución."

#### INS-07 Campuses list — "Gestión de Sedes"

- Template `templates/institution/campuses.html`. Legacy `GET /institution/campuses` (+ `?change_institution=1`). Roles: root, admin, coordinator (create/edit/delete: root, admin).
- Header: H1 "Gestión de Sedes", sub "Administra las sedes de tu institución educativa" (root: "...de todas las instituciones (selecciona una para gestionar)"); buttons "Cambiar Institución" (root), "Nueva Sede" (→ INS-08).
- Root selector when no active institution (see 0.3; button "Seleccionar y Gestionar Sedes"). Institution banner with "Vista Root"/"Tu Institución".
- KPI mini-cards: "Total Sedes", "Sedes Activas", "Sede Principal", "Sedes Inactivas".
- Table "Listado de Sedes" (`campusesTable`): **Código** (badge or "-"), **Nombre** (bold), **Dirección** or "-", **Jornada** (badge), **Tipo** ("Principal" gold / "Secundaria"), **Estado** ("Activa" green / "Inactiva" grey), **Grados** (count badge), **Acciones** (edit → INS-08, delete with confirm "¿Eliminar sede {nombre}? Esta acción no se puede deshacer si tiene grados asociados.").
- Empty: "No hay sedes registradas / Crea la primera sede para esta institución" + "Crear Primera Sede".

#### INS-08 Campus form — "Nueva Sede" / "Editar Sede"

- Template `templates/institution/campus_form.html`. Legacy `GET|POST /institution/campuses/new`, `/institution/campuses/{id}/edit`. Roles: root, admin.
- Root without active institution: card "Seleccionar Institución" ("Como root, debe seleccionar la institución donde creará la sede.") with select "Institución" ("Seleccionar institución...", options "{nombre} (NIT: x)") and button "Seleccionar".
- Form card "Datos de la Sede": "Nombre de la Sede *" (placeholder "Ej: Sede Principal, Sede Norte, etc.", tip "💡 Nombre descriptivo de la ubicación física"), "Código" ("Ej: SEDE001", "💡 Código único identificador (opcional)"), "Dirección" ("Calle 123 # 45-67, Barrio", "💡 Ubicación física completa de la sede"), "Jornada" select (Mañana, Tarde, Completa [default], "💡 Horario de funcionamiento de la sede"), "Estado" switch "Sede Activa" (default on; "Las sedes inactivas no estarán disponibles para selección"), switch "🌟 Sede Principal" ("Solo puede haber una sede principal por institución"; error shown under it if another main exists). Buttons "Crear Sede"/"Actualizar Sede", "Cancelar".
- Side card "Información": "¿Qué es una sede?" (ubicación física...), "Sede Principal" (una por institución, generalmente la administrativa, se destaca visualmente en el listado), "Consejos" (código único; nombres descriptivos; la jornada determina los horarios de clase; desactive sedes en desuso en lugar de eliminarlas).

#### INS-09 Academic levels list — "Niveles Académicos"

- Template `templates/institution/grade_levels.html`. Legacy `GET /institution/grade-levels`. Roles: root, admin, coordinator (create/edit/delete: root, admin).
- Header: H1 "Niveles Académicos", sub "Gestiona los niveles académicos (Primero, Sexto, Once, etc.) por sede"; "Nuevo Nivel" (→ INS-10). Root without context: card "Selecciona una Institución" ("Necesitas seleccionar una institución para ver sus niveles académicos.") + "Ver Instituciones".
- KPI: "{n} Niveles Registrados".
- Table (`levelsTable`): **Orden** (badge `order_num`), **Nombre del Nivel** (bold), **Sede**, **Cursos Asociados** ("{n} curso(s)"), **Acciones** (edit, delete with confirm "¿Eliminar el nivel {nombre}?").
- Empty: "No hay niveles académicos / Crea niveles como "Primero", "Sexto", "Once" para agrupar tus cursos." + "Crear Primer Nivel".

#### INS-10 Academic level form — "Nuevo/Editar Nivel Académico"

- Template `templates/institution/grade_level_form.html`. Legacy `GET|POST /institution/grade-levels/new`, `/{id}/edit`. Roles: root, admin.
- Header sub "Define un nuevo nivel académico (ej: Primero, Sexto, Once)" / "Modifica los datos del nivel".
- Fields: "Sede *" select ("Seleccione una sede...", options "{nombre} (Principal)"; on edit shown disabled + hidden input), "Nombre del Nivel *" (placeholder "Ej: Primero, Sexto, Once, Transición", tip "Nombre general del nivel"), "Orden" number min 0 default 0 (tip "Número para ordenar los niveles (0=primero)"). Buttons "Crear Nivel"/"Actualizar Nivel", "Cancelar". Unique (sede, nombre) error inline.
- Side card "¿Qué es un Nivel Académico?" with the hierarchy example:
  ```
  Sede Central
  ├── Nivel: Sexto
  │   ├── Curso: 6-01 (Mañana)
  │   └── Curso: 6-02 (Tarde)
  └── Nivel: Once
      └── Curso: 11-01 (Mañana)
  ```

#### INS-11 Courses list — "Gestión de Grados" (nav: "Cursos")

- Template `templates/institution/grades.html`. Legacy `GET /institution/grades`. Roles: root, admin, coordinator (create/edit/delete: root, admin).
- Header: H1 "Gestión de Grados", sub "Administra los grados de tu institución educativa"; "Cambiar Institución" (root), "Nuevo Grado" (→ INS-12). Root selector ("Seleccionar y Gestionar Grados"). Institution banner.
- KPI mini-cards: "Total Grados", "Sedes Activas" (distinct campuses among courses), "Con Director".
- Table (`gradesTable`): **Nombre** (bold), **Sede** (badge), **Director de Grupo** (name or "Sin asignar"), **Año Lectivo** (badge), **Jornada** (badge), **Capacidad** (`max_students`), **Estudiantes** (current count), **Acciones** (edit, delete "¿Eliminar grado {nombre}? Esta acción no se puede deshacer si tiene estudiantes asociados.").
- Empty: "No hay grados registrados / Crea el primer grado para esta institución" + "Crear Primer Grado".

#### INS-12 Course form — "Nuevo/Editar Grado"

- Template `templates/institution/grade_form.html`. Legacy `GET|POST /institution/grades/new`, `/{id}/edit`. Roles: root, admin.
- Institution banner; card "Datos del Grado". Fields: "Nombre del Grado *" (placeholder "Ej: 6-1, 11°B, Transición A", tip "Nombre del grupo educativo"), "Sede *" select ("Seleccione una sede...", "(Principal)" suffix), "Nivel Académico" select ("Sin nivel (opcional)", options "{nivel} ({sede})", filtered client-side by the chosen campus), "Director de Grupo" select ("Sin director asignado", teachers by full name), "Año Lectivo *" (default "2026"), "Jornada *" select (Mañana, Tarde, Nocturna, Única, Sabatina), "Capacidad Máxima" number 1–60 default 40. Buttons "Crear Grado"/"Actualizar Grado", "Cancelar". Unique constraint error: same sede+nombre+año+jornada.
- Side card "Información": "¿Qué es un grado?" (grupo específico de estudiantes en un año y sede), "Director de Grupo" (profesor responsable; puede tomar asistencia y registrar observaciones; opcional), "Consejos" (nombres claros; la sede determina dónde se imparten clases; capacidad evita sobrecupo; el director puede asignarse después).

#### INS-13 Subjects list — "Asignaturas"

- Template `templates/institution/subjects.html`. Legacy `GET /institution/subjects`. Roles: root, admin, coordinator, teacher (create/edit/delete: root, admin).
- Header: H2 "Asignaturas"; button "Nueva Asignatura" (→ INS-14). Simple table: **Código**, **Nombre**, **Acciones** (edit; delete confirm "¿Eliminar asignatura {nombre}?"). No empty state in legacy (empty table); prototype: use the `empty_state` macro "No hay asignaturas".

#### INS-14 Subject form

- Template `templates/institution/subject_form.html`. Legacy `GET|POST /institution/subjects/new`, `/{id}/edit`. Roles: root, admin.
- Sub "Complete los datos de la asignatura". Fields: "Nombre de la Asignatura *" (tip "Nombre descriptivo de la asignatura (ej: Matemáticas, Ciencias Naturales)"), "Código" (tip "Código interno de la asignatura (opcional)"). Buttons "✅ Crear Asignatura"/"💾 Actualizar Asignatura", "Cancelar". Side card "Información": materias que se imparten; se asignan a grados específicos; pueden tener múltiples profesores; se usan para el sistema de notas. Duplicate code error inline.

#### INS-15 Periods list — "Periodos Académicos"

- Template `templates/institution/periods.html`. Legacy `GET /institution/periods`. Roles: root, admin, coordinator (create/edit/delete: root, admin).
- Header H2 "Periodos Académicos"; "Nuevo Periodo" (→ INS-16). Table: **Nombre**, **Nombre Corto**, **Fecha Inicio** (dd/mm/yyyy), **Fecha Fin**, **Año Académico**, **Activo** (badge "Activo"/"Inactivo"), **Acciones** (edit; delete confirm "¿Eliminar periodo {nombre}?").

#### INS-16 Period form

- Template `templates/institution/period_form.html`. Legacy `GET|POST /institution/periods/new`, `/{id}/edit`. Roles: root, admin.
- Sub "Complete los datos del periodo académico". Fields: "Nombre del Periodo *" (tip "Ej: Primer Periodo, Segundo Periodo"), "Nombre Corto *" (tip "Ej: P1, P2, P3, P4"), "Fecha de Inicio *" (date), "Fecha de Fin *" (date), "Año Académico *" (default 2026, tip "Ej: 2026"), "Orden" (number min 1, tip "Orden del periodo (1, 2, 3, 4)"), switch "Periodo Activo" (default on for new). Errors: "El nombre del periodo es obligatorio", "El nombre corto es obligatorio", "La fecha de inicio es obligatoria", "La fecha de fin es obligatoria". Buttons "✅ Crear Periodo"/"💾 Actualizar Periodo". Side card "Información": los periodos dividen el año lectivo; generalmente 4 periodos por año; las notas se cierran por periodo; se usan para boletines.

#### INS-17 Evaluation criteria list — "Criterios de Evaluación"

- Template `templates/institution/criteria.html`. Legacy `GET /institution/criteria`. Roles: root, admin, coordinator, teacher (create/edit/delete: root, admin).
- Header H2 "Criterios de Evaluación"; "Nuevo Criterio" (→ INS-18). Table: **Nombre**, **Peso (%)** ("{n}%"), **Descripción** (truncated to 50 chars + "..."), **Orden**, **Acciones** (edit; delete confirm "¿Eliminar criterio {nombre}?").
- Prototype addition recommended: footer row showing the weight total and a warning when it is not 100%.

#### INS-18 Criterion form

- Template `templates/institution/criteria_form.html`. Legacy `GET|POST /institution/criteria/new`, `/{id}/edit`. Roles: root, admin.
- Sub "Complete los datos del criterio". Fields: "Nombre del Criterio *" (tip "Nombre descriptivo (ej: Seguimiento, Formativo, Cognitivo)"), "Peso (%) *" (number step 0.01, 0–100; tip "Porcentaje del criterio (ej: 20, 30)"; errors "El peso es obligatorio", "El peso debe ser mayor a 0 y menor o igual a 100", "El peso debe ser un número válido"), "Descripción" (textarea 4 rows; tip "Descripción detallada del criterio de evaluación"), "Orden" (number min 1; tip "Orden de visualización en listas"). Buttons "✅ Crear Criterio"/"💾 Actualizar Criterio". Side card "Información": "Los criterios de evaluación definen cómo se calculan las notas." + default list Seguimiento 20%, Formativo 20%, Cognitivo 30%, Procedimental 30%.

### 3.4 User management (USR)

#### USR-01 Users list — "Gestión de Usuarios"

- Template `templates/users/list.html`. Legacy `GET /users/users` (`?role=&search=`). Roles: root, admin (admin sees only own institution; root sees all).
- Title is dynamic by filter: no filter "Gestión de Usuarios"; `role=teacher` "Profesores"; `coordinator` "Coordinadores"; `student` "Estudiantes"; `parent` "Acudientes"; `admin` "Administradores"; `root` "Usuarios Root". Sub: with filter "Mostrando {rol plural} · Ver todos"; root "Administración de todos los usuarios del sistema"; admin "Usuarios de {institución}".
- Header buttons: "Importar Excel" (→ USR-04) and "Nuevo {Rol|Usuario}" (→ USR-02, preselecting the role).
- Admin sees an institution banner (name, location, badge "Admin").
- KPI row: "Total Usuarios", "Profesores", "Estudiantes", "Activos".
- Card "Filtros de Búsqueda" (GET form): "Rol" select ("Todos los roles"; root sees Root, Administrador, Coordinador, Profesor, Estudiante, Acudiente, Viewer), "Búsqueda" text (placeholder "Buscar por nombre, apellido, email o username..."), button "Filtrar", clear link.
- Table "Lista de Usuarios" (chip "{n} usuarios", id `usersTable`): **Usuario** (role-coloured icon + username + email small), **Nombre Completo**, **Email**, **Rol** (badge Root/Admin/Coordinador/Profesor/Estudiante/Acudiente/Viewer), **Institución** (root only; truncated name or "-"), **Estado** (Activo/Inactivo), **Acciones**: pencil (→ USR-03), trash (hidden for self and root users; modal "Confirmar Eliminación": "¿Estás seguro que deseas eliminar al usuario:" {username} + warning "**Advertencia:** Esta acción no se puede deshacer."; buttons "Cancelar" / "Sí, Eliminar").
- Empty: "No hay usuarios registrados / Comienza creando el primer usuario del sistema" (root) or "No hay usuarios en tu institución. Crea el primer usuario." + "Crear {Rol}"/"Crear Primer Usuario".

#### USR-02 Create user — "Crear Nuevo Usuario"

- Template `templates/users/create.html`. Legacy `GET|POST /users/users/new` (`?role=` preselect). Roles: root, admin.
- Header sub "Complete los datos para registrar un nuevo usuario en el sistema"; "Volver a la Lista". Callout "**Automático:** El nombre de usuario se genera automáticamente. La contraseña inicial será el número de documento de identidad." Preview box "Username auto-generado" (from `GET /users/users/api/generate-username`) and "Contraseña inicial: Nº de documento". Username/email availability checked by `api/check-username`, `api/check-email`.
- Form in 3 numbered sections:
  1. **Información Personal** — "Nombres *" (tip "Nombre completo del usuario", "Ej: Juan Carlos"), "Apellidos *" ("Ej: Pérez García"), "Tipo Documento" select (TI - Tarjeta de Identidad, CC - Cédula de Ciudadanía [default], RC - Registro Civil, CE - Cédula de Extranjería), "Nº Documento *" (tip "Se usará como contraseña inicial"), "Fecha Nacimiento" (date), "Género" select (No especificado, Masculino=M, Femenino=F, Otro).
  2. **Información de Contacto** — "Correo Electrónico" (optional here; placeholder "usuario@ejemplo.com (Opcional)"), "Teléfono / Celular" ("3001234567"), "Dirección" ("Calle, Carrera, Número, Barrio"), "País" select (🇨🇴 Colombia [default], México, Venezuela, Ecuador, Perú, Otro), "Departamento" ("Ej: Cundinamarca"), "Municipio" ("Ej: Bogotá").
  3. **Información de la Cuenta** — "Rol *" select (root sees: 🔴 Root, 🔵 Administrador, 🟣 Coordinador, 🟡 Profesor, 🟢 Estudiante, 🔵 Acudiente, ⚪ Viewer; admin sees help "Como admin, puedes crear coordinadores, profesores, estudiantes, acudientes y viewers. Root crea admins."), root-only "Institución" select ("Sin institución asignada" + all institutions). Callout "**Seguridad:** La contraseña inicial será el número de documento. El usuario deberá cambiarla obligatoriamente en su primer inicio de sesión."
- Buttons "✅ Crear Usuario", "Cancelar". Side cards: "¿Cómo funciona?" (3 bullets) and "Roles del Sistema" (7 one-line descriptions: Root "Super-administrador, acceso total"; Admin "Gestiona su institución"; Coordinador "Supervisión académica"; Profesor "Notas, asistencia, observaciones"; Estudiante "Consulta sus datos"; Acudiente "Portal de padres"; Viewer "Solo lectura").
- Business rule: creating a user with role `student` normally continues to STU-03 (student academic profile) — see flow F-STU.

#### USR-03 Edit user — "Editar Usuario"

- Template `templates/users/edit.html`. Legacy `GET|POST /users/users/{id}/edit`, `POST /users/users/{id}/delete`. Roles: root, admin.
- Header "Editar Usuario", sub "Editando: **{username}** - {nombre completo}"; "Volver a la Lista". Summary strip: Username, Email, Rol (badge), Creado (dd/mm/yyyy).
- Same 3 sections as USR-02 prefilled (Información Personal; Información de Contacto; **Cuenta y Seguridad**): Rol (select editable only by root — "Solo root puede cambiar el rol"; admins see a disabled text + hidden input), Institución (root only), "Nueva Contraseña (opcional)" (min 6, "Dejar vacío para mantener la contraseña actual"), switch "Usuario activo"/"Usuario inactivo" (hidden for root users). Button "💾 Actualizar Usuario".
- Side card "Acciones Rápidas": for students "Ver Perfil Académico" (→ STU-02); disabled buttons "Resetear Contraseña" (tooltip "Funcionalidad no disponible - El usuario puede cambiar su contraseña desde su perfil"), "Deshabilitar Usuario"/"Habilitar Usuario". Side card "Información": Username, Email, Documento ("{tipo}: {número}" or "No registrado"), Último acceso (dd/mm/yyyy HH:MM or "Nunca"), "Cambiado contraseña" (badge "Pendiente" / "Sí").

#### USR-04 Import users from Excel — "Importar Usuarios desde Excel"

- Template `templates/users/import_excel.html`. Legacy `GET|POST /users/users/import-excel`. Roles: root, admin.
- Header sub "Carga masiva de usuarios desde archivo Excel"; "Volver".
- Form: "Archivo Excel" file input (`.xlsx,.xls`, required; help "Solo archivos .xlsx o .xls (máx 10MB)"); button "Importar Usuarios".
- Card "Formato Requerido": sample table with columns `username | email | password | first_name | last_name | role` and one example row (`juanperez | juan@inst.edu.co | 123456 | Juan | Pérez | teacher`); note "Roles válidos: root, admin, coordinator, teacher, student, parent, viewer".
- Result area after POST: success banner "{n} usuarios importados exitosamente"; error card "Errores ({n})" listing the first 10 messages and "... y {m} errores más".

### 3.5 Matrícula y Programación (SCH)

Roles for the whole module: root, admin, coordinator (only the schedule view `SCH-11` is also open to teacher and student, filtered to their own classes). Note: this module's legacy copy has **no accents** ("Matriculas", "Ano Academico"); the prototype should use proper Spanish ("Matrículas", "Año Académico"). The year shown is `institution.academic_year`. Every list has the same filter-card pattern: GET form with selects + "Filtrar" button.

#### SCH-01 Enrollments list — "Matriculas de Estudiantes"

- Template `templates/scheduling/enrollments/list.html`. Legacy `GET /scheduling/enrollments`.
- Header: H1 "Matriculas de Estudiantes", sub "Gestion de matriculas para el ano academico {año}"; buttons "Nueva Matricula" (→ SCH-02 create) and a secondary link to the students list (STU-01).
- KPI mini-cards: "Total Matriculas", "Matriculas Activas", "Ano Academico" ({año}).
- Filter card: "Grado" ("Todos los grados"), "Materia" ("Todas las materias"), "Estado" ("Todos", Activa, Cancelada, Retirada) + "Filtrar".
- Table (`enrollmentsTable`): **Estudiante** (full name + document number small), **Materia**, **Grado** (badge), **Fecha Matricula** (dd/mm/yyyy), **Estado** (badge Activa green / Cancelada / Retirada), **Nota Final** (`%.1f` badge or "-"), **Acciones** (pencil → SCH-02 edit, trash "¿Eliminar esta matricula?"). (Legacy quirk: Materia/Grado cells are swapped relative to headers — prototype: keep header order.)
- Empty: "No hay matriculas registradas / Matricule estudiantes en un grado. Seran inscritos automaticamente en todas las materias del grado." + "Crear Matricula".

#### SCH-02 Enrollment form — "Nueva Matricula" / "Editar Matricula"

- Template `templates/scheduling/enrollments/form.html`. Legacy `GET|POST /scheduling/enrollments/new`, `/enrollments/{id}/edit`; helper `GET /scheduling/api/students/by-grade/{grade_id}`.
- Header sub "Ano academico {año}"; back link.
- **Create mode:** "Grado *" select ("Seleccione un grado"); "Estudiantes *" **multi-select list** (size 8, placeholder option "Seleccione un grado primero"; populated by JSON when a grade is chosen; hint "Mantenga Ctrl presionado para seleccionar varios"); callout "**Nota:** Al matricular, los estudiantes seran inscritos en **todas las materias** asignadas a este grado." Validation alert "Seleccione al menos un estudiante". Button "Matricular Estudiantes". Effect: creates one `StudentEnrollment` per selected student × every subject-grade of the course and moves the student to that course (`grade_id`).
- **Edit mode:** read-only "Estudiante", "Materia", "Fecha Matricula"; editable "Estado" (Activa/Cancelada/Retirada), "Nota Final" (number 1.0–5.0 step 0.1, optional), "Observaciones" (textarea, `status_note`). Button "Guardar Cambios".

#### SCH-03 Teacher assignments list — "Asignacion de Profesores"

- Template `templates/scheduling/assignments/list.html`. Legacy `GET /scheduling/assignments`.
- Header: H1, sub "Asignar profesores a materias por grado - Ano {año}"; buttons "Nueva Asignacion" (→ SCH-04), "Ver Materias por Grado" (→ SCH-05).
- KPIs: "Total Asignaciones", "Asignaciones Activas", "Ano Academico". Filter: "Grado".
- Table (`assignmentsTable`): **Profesor** (name + username small), **Materia**, **Grado**, **Fecha Asignacion**, **Estado** (Activo / Inactivo; `temporal` also exists), **Acciones** (edit, delete "¿Eliminar esta asignacion?").
- Empty: "No hay asignaciones registradas / Asigne profesores a las materias por grado" + "Crear Asignacion".

#### SCH-04 Teacher assignment form

- Template `templates/scheduling/assignments/form.html`. Legacy `GET|POST /scheduling/assignments/new`, `/assignments/{id}/edit`.
- Create ("Nueva Asignacion de Profesor"): "Grado *", "Materia *", "Profesor *" selects (each with "Seleccione un …"); button "Asignar Profesor". (Saving creates/updates the `SubjectGrade` teacher and a `TeacherSubjectAssignment` row.)
- Edit ("Editar Asignacion"): read-only "Profesor", "Materia", "Grado", "Fecha Asignacion"; editable "Estado" (Activo, Inactivo, Temporal), "Observaciones" (`notes`). Button "Guardar Cambios".

#### SCH-05 Subjects per course — "Materias por Grado"

- Template `templates/scheduling/subject_grades/list.html`. Legacy `GET /scheduling/subject-grades`.
- Header: sub "Asignar materias a grados - Ano {año}"; buttons "Asignar Materias" (→ SCH-06), "Ver Asignaciones" (→ SCH-03). Filter: "Grado".
- Table (`subjectGradesTable`): **Materia** (bold), **Grado**, **Intensidad** (badge "{n}h"), **Profesor Asignado** (name badge or "Sin asignar"), **Acciones** (trash only; "¿Eliminar esta asignacion?").
- Empty: "No hay materias asignadas a grados / Asigne materias a los grados del ano academico" + "Asignar Materias".

#### SCH-06 Assign subjects to courses (bulk form) — "Asignar Materias a Grados"

- Template `templates/scheduling/subject_grades/form.html`. Legacy `GET|POST /scheduling/subject-grades/new`.
- Fields: "Grados *" multi-select (size 8, hint "Mantenga Ctrl presionado para seleccionar varios"), "Materias *" checkbox list (one checkbox per subject), "Profesor (opcional)" select ("Sin asignar" + teachers), "Intensidad Horaria (Horas/Semana) *" number 1–20 default 4 (hint "¿Cuántas horas de esta materia recibe el grado a la semana?"). Button "Asignar Materias". Creates one `SubjectGrade` per grade × subject.

#### SCH-07 Classrooms list — "Gestion de Salones"

- Template `templates/scheduling/classrooms/list.html`. Legacy `GET /scheduling/classrooms`.
- Header sub "Administracion de salones y aulas por sede"; "Nuevo Salon" (→ SCH-08). KPIs: "Total Salones", "Aulas", "Laboratorios". Filter: "Sede" ("Todas las sedes").
- Table (`classroomsTable`): **Nombre**, **Codigo** (monospace), **Sede**, **Tipo** (badge Aula / Laboratorio / Auditorio / Cancha), **Capacidad** ("{n} personas"), **Ubicacion** ("Edificio {x}, Piso {n}" or "Piso {n}"), **Acciones** (edit, delete "¿Eliminar este salon?").
- Empty: "No hay salones registrados / Registre los salones y aulas de la institucion" + "Crear Salon".

#### SCH-08 Classroom form — "Nuevo Salon" / "Editar Salon"

- Template `templates/scheduling/classrooms/form.html`. Legacy `GET|POST /scheduling/classrooms/new`, `/classrooms/{id}/edit`.
- Fields: "Sede *" select, "Nombre *", "Codigo *" (hint "Ej: AULA-101, LAB-CIENCIAS"; unique per campus), "Capacidad" (number 10–100, default 40), "Tipo" select (Aula, Laboratorio, Auditorio, Cancha), "Edificio", "Piso" (number min 1, default 1), "Recursos (JSON)" (textarea 3 rows, placeholder `{"proyector": true, "computadoras": 30}`, hint "Lista de recursos disponibles en formato JSON"). Button "Crear Salon"/"Guardar Cambios".

#### SCH-09 Time blocks list — "Bloques de Tiempo"

- Template `templates/scheduling/blocks/list.html`. Legacy `GET /scheduling/blocks`.
- Header sub "Definicion de bloques horarios para generacion de horarios - {año}"; "Nuevo Bloque" (→ SCH-10).
- Table (`blocksTable`): **Orden** (badge), **Nombre** (breaks highlighted), **Sede**, **Jornada** (badge), **Hora Inicio** / **Hora Fin** (monospace HH:MM), **Tipo** (badge "Recreo" / "Clase"), **Acciones** (edit, delete "¿Eliminar este bloque?").
- Empty: "No hay bloques de tiempo definidos / Defina los bloques horarios para cada sede" + "Crear Bloque".

#### SCH-10 Time block form — "Nuevo Bloque de Tiempo" / "Editar Bloque"

- Template `templates/scheduling/blocks/form.html`. Legacy `GET|POST /scheduling/blocks/new`, `/blocks/{id}/edit`.
- Fields: "Sede *" select, "Nombre *" (placeholder "Ej: Bloque 1, Recreo, Almuerzo"), "Jornada *" (Mañana, Tarde, Nocturna, Única, Sabatina), "Hora Inicio *" time (default 07:00), "Hora Fin *" time (default 08:00), "Orden" (number min 1, hint "Orden en el dia"), checkbox "**Es descanso/recreo**" (hint "Los bloques de descanso no se asignan con materias"). Button "Crear Bloque"/"Guardar Cambios".
- Side card "Ejemplo de bloques típicos": table Orden/Nombre/Inicio/Fin/Tipo with rows 1 Bloque 1 07:00–08:00 Clase; 2 Bloque 2 08:00–09:00 Clase; 3 Recreo 09:00–09:30 Descanso; 4 Bloque 3 09:30–10:30 Clase; 5 Bloque 4 10:30–11:30 Clase; 6 Almuerzo 11:30–12:30 Descanso; 7 Bloque 5 12:30–01:30 Clase; 8 Bloque 6 01:30–02:30 Clase.

#### SCH-11 Weekly schedule — "Horarios de Clases"

- Template `templates/scheduling/schedules/list.html`. Legacy `GET /scheduling/schedules` (optional `?grade_id=`). Roles: root, admin, coordinator (all, optionally filtered by course), teacher (own classes), student (own course).
- Header sub "Horarios para el ano academico {año}"; button "Generar Horario Automatico" (→ SCH-12; admin/coordinator only).
- Grid table (`scheduleTable`): column **Hora** (start time of each distinct slot, `HH:MM`) and **Lunes, Martes, Miercoles, Jueves, Viernes**. Cell content: subject name (H6), teacher full name, classroom name, course name (badge); empty cell blank. Delete per schedule is available through `POST /scheduling/schedules/{id}/delete` (admin/coordinator) — prototype: a small "x" on each cell for those roles. (The route supplies `grades` for a course filter that the legacy UI does not render; prototype: add a "Grado" filter for admin/coordinator, hidden for teacher/student.)
- Empty: "No hay horarios generados / Genere los horarios automaticamente o asigne manualmente" + "Generar Horario Automatico".

#### SCH-12 Generate schedule — "Generar Horario Automatico"

- Template `templates/scheduling/schedules/generate.html`. Legacy `GET /scheduling/schedules/generate`, `POST /scheduling/schedules/generate/run` (AJAX).
- Header sub "El sistema generara automaticamente los horarios evitando conflictos"; back to SCH-11.
- Info card "Como funciona": 4 bullets — asigna cada materia a un salón y horario disponible; evita conflictos de profesores y salones; respeta los bloques de tiempo de cada sede; permite ajustar manualmente después.
- Form: "Sede" select ("Todas las sedes"), "Grado (opcional)" select ("Todos los grados"); button "Generar Horario".
- On submit: progress card ("Generando..." spinner, "Generando horario...", "El sistema esta optimizando la asignacion de horarios"), button disabled. Result card "Resultado": success alert "Horario generado exitosamente — **{n}** clases asignadas — **{m}** conflictos encontrados | Sin conflictos" + button "Ver Horario"; error alert "Error al generar horario — No se pudieron generar horarios. Verifique que existan materias asignadas y salones disponibles."; network failure "Error de conexion. Intente nuevamente."
- Algorithm (for mock behaviour): for each subject-grade, place `hours_per_week` slots into non-break blocks of the course's campus/shift avoiding teacher and classroom double-booking (unique classroom+day+start).

### 3.6 Students (STU)

Blueprint prefix `/students`. A "student" is a `User(role=student)` plus an `AcademicStudent` profile. A user without profile appears in the "Perfiles Académicos Incompletos" table of STU-01.

#### STU-01 Students list — "Gestión de Estudiantes"

- Template `templates/students/list.html`. Legacy `GET /students/` (`?campus_id=&grade_id=&status=`). Roles: root, admin, coordinator, teacher (create/edit/delete/upload: root, admin, coordinator).
- Header: H1 "Gestión de Estudiantes", sub "Administra los estudiantes de la institución"; buttons "Cargar Excel" (→ STU-05), "Nuevo Estudiante" (→ STU-03).
- Card "Filtros" (GET): "Sede" ("Todas"), "Grado" ("Todos"), "Estado" (Activos [default], Retirados, Graduados, Todos); buttons "Filtrar", "Limpiar".
- Card "Lista de Estudiantes" (chip "{n} estudiantes"), table `studentsTable`: **Estudiante** (full name + "Acudiente: {nombre}" small), **Documento** (badge "{tipo} {número}"), **Grado** (badge or "-"), **Sede** (or "-"), **Estado** (badge Activo/Retirado/Graduado), **Acciones**: eye "Ver perfil" (STU-02), pencil "Editar" (STU-03), comment "Observación" (→ OBS-04 quick form), trash (confirm "¿Eliminar este estudiante? Esta acción no se puede deshacer."; roles with edit rights only).
- Empty: "No se encontraron estudiantes con perfil académico completo / Intenta cambiar los filtros o crea un nuevo estudiante." + "Crear Estudiante".
- Second card "Perfiles Académicos Incompletos" (chip "{n} pendientes"; shown only when there are such users), table `incompleteTable`: **Estudiante** (name + "Sin perfil académico"), **Documento**, **Username** (monospace), **Email**, **Institución** (or "Sin asignar"), **Acciones**: "Completar" (→ STU-03 in complete mode) and pencil (→ USR-03).

#### STU-02 Student profile — "Perfil del Estudiante"

- Template `templates/students/profile.html`. Legacy `GET /students/{id}`. Roles: root, admin, coordinator, teacher.
- Header H2 "Perfil del Estudiante"; buttons (admin/root only) "Editar" (STU-03), "Asignar Acudientes" (STU-04); "Volver" (STU-01).
- Left identity card: avatar, full name (H5), "{tipo doc} {número}", status badge (Activo/Retirado/Graduado), then "Usuario:", "Email:", "Teléfono:" (or "N/A"). Card "Acciones": "Observación" (OBS-04), "Asistencia" (ATT-02), "Boletines" (placeholder link in legacy; prototype → RPT-03 history).
- Right: Tabs **Información**, **Horario**, **Acudientes**.
  - Información: "Información Académica" — "Sede", "Curso / Grado" (badge or "Sin curso asignado"), "Fecha de Nacimiento" (dd/mm/yyyy), "Género", "Tipo de Sangre"; "Información de Contacto y Salud" — "Dirección de Residencia", "Barrio / Sector", "Estrato", "EPS" (each "N/A" when empty).
  - Horario: "Horario Semanal: {curso}" with link "Ver en pantalla completa" (SCH-11 filtered); grid Hora × Lunes–Viernes (cell: subject, teacher last name, classroom). Empty: "No hay un horario generado para este curso todavía. / Contacta con coordinación académica." or, without course, "El estudiante no está asignado a ningún curso. / Asigne un curso en la pestaña de edición para ver el horario."
  - Acudientes: "Información de Acudientes" with "Gestionar" (admin/root); card "Acudiente Principal" (Nombre, Teléfono, Email from the student record, "N/A" when empty); then one card per linked parent: name (H6), relationship badge, Usuario, Teléfono, Email.

#### STU-03 Student form — "Nuevo Estudiante" / "Completar Perfil Académico" / "Editar Estudiante"

- Template `templates/students/form.html`. Legacy `GET|POST /students/new`, `/students/new/{user_id}` (complete mode), `/students/{id}/edit`. Roles: root, admin, coordinator.
- Titles/subtitles: new "Nuevo Estudiante / Complete los datos para matricular un nuevo estudiante"; complete "Completar Perfil Académico / Complete la información académica de {nombre}"; edit "Editar Estudiante / Modifica los datos del estudiante".
- Complete mode shows a banner with the existing user (name, username | tipo: documento | email, badge "Usuario Creado") and callout "**Información personal ya registrada:** Nombre, documento, email y teléfono fueron creados. Ahora solo necesita completar la información académica y del acudiente." Personal fields are hidden inputs.
- Root without institution: card "Seleccionar Institución" with select + "Seleccionar". Otherwise an institution banner.
- New mode: preview box "Username auto-generado" (live) + "Contraseña inicial: estudiante123" and note "**Usuario automático:** Se generará automáticamente / **Contraseña por defecto:** estudiante123". (Legacy default password for students created here is `estudiante123`, unlike USR-02 where it is the document number; prototype may unify on document number.)
- Section **Información del Usuario** (new/edit only): "Nombre *", "Apellido *", "Tipo de Documento" (TI, RC, CC; disabled after creation, "No editable después de crear"), "Número de Documento *" (readonly on edit), "Teléfono", "Fecha de Nacimiento", "Género" ("Seleccionar...", Masculino, Femenino, Otro), "Dirección".
- Section **Información Académica**: "Sede *" ("Seleccionar sede..."), "Grado" ("Sin asignar"), "Barrio / Vereda" (placeholder "Ej: El Centro"), "Estrato" (number 1–6), "Tipo de Sangre" ("Ej: O+"), "EPS" ("Ej: Sanitas").
- Section **Información del Acudiente**: "Nombre del Acudiente", "Teléfono del Acudiente", "Email del Acudiente".
- Edit only, section **Estado del Estudiante**: "Estado" (Activo, Retirado, Graduado).
- Buttons: "✅ Completar Matrícula" (new/complete) / "Actualizar" (edit); "Cancelar" (→ USR-01 in complete mode, STU-01 otherwise).

#### STU-04 Assign guardians — "Asignar Acudientes"

- Template `templates/students/assign_parent.html`. Legacy `GET|POST /students/{id}/assign-parent`, `POST /students/{id}/remove-parent/{parent_id}`. Roles: root, admin, coordinator.
- Header H2 "Asignar Acudientes"; buttons "Volver al Perfil" (STU-02), "Lista de Estudiantes".
- Student banner: name (H4), "{documento} | {curso o 'Sin grado'} | {sede}".
- Card "Asignar Nuevo Acudiente": "Seleccionar Acudiente" select ("-- Seleccione un acudiente --", options "{nombre} ({username}) - {documento}", excluding already-assigned parents; empty-state text "No hay acudientes creados en la institución." + link "Crear acudiente primero" → USR-02 with role=parent), "Parentesco / Relación" select (Acudiente, Padre, Madre, Tío/a, Abuelo/a, Hermano/a, Otro), button "Asignar Acudiente".
- Card "Acudientes Asignados": one row per link: name (H6), relationship badge, "{email} | {teléfono o 'Sin teléfono'}", red trash button (confirm "Eliminar este acudiente?"). Empty: "No hay acudientes asignados a este estudiante".

#### STU-05 Import students from Excel — "Cargar Estudiantes desde Excel"

- Template `templates/students/upload.html`. Legacy `GET|POST /students/upload`. Roles: root, admin, coordinator.
- Root without institution: card "Seleccionar Institucion" (select + "Seleccionar").
- Card "Subir Archivo": "Archivo Excel (.xlsx, .xls) *" (file, required; "Tamano maximo: 10MB"); callout "**Importante:** Los estudiantes que ya existen (mismo documento) seran omitidos · Contrasena por defecto para todos: `estudiante123` · Se generara usuario automaticamente"; buttons "Cargar Estudiantes", "Cancelar".
- Card "Formato Requerido": table Columna / Obligatorio — `nombre` ✅, `apellido` ✅, `documento` ✅, `tipo_documento` ❌ (TI), `fecha_nacimiento`, `genero`, `grado`, `sede`, `acudiente`, `telefono_acudiente`, `email_acudiente`, `direccion`, `barrio`, `estrato`, `tipo_sangre`, `eps` (all optional); link "Descargar Plantilla".
- Result flashes: "{n} estudiantes importados exitosamente.", "{m} errores encontrados. Revisa el archivo de errores.", "Solo se permiten archivos Excel (.xlsx, .xls).", "No se seleccionó ningún archivo.".

### 3.7 Grades (GRD)

Blueprint prefix `/grades`. Core grading flow: **choose period → choose course + subject → grade sheet (matrix of students × criteria) → save / save & lock → period final grades → annual grades**. Teachers only reach their own subject-grades (otherwise flash "No tienes permiso para editar esta asignatura."); root/admin/coordinator reach all. Scale rules are in 2.3. The legacy copy here is mostly **without accents** ("Seleccion", "Periodo Academico"); the prototype should use accents.

Score colour classes used in sheets and tables (`getGradeClass`): >= 4.5 "excellent" (green), >= 4.0 "good" (blue/teal), >= 3.0 "average" (amber/yellow), >= 2.0 "below" (orange), < 2.0 "fail" (red). Performance levels (`get_grade_performance_level`, also printed as a legend "Escala de Calificacion"): **4.6–5.0 Superior**, **4.0–4.5 Alto**, **3.0–3.9 Básico**, **1.0–2.9 Bajo**; minimum passing 3.0. (Colours: Superior green, Alto cyan, Básico amber, Bajo red.)

#### GRD-01 Grade entry — selection ("Ingreso de Notas")

- Template `templates/grades/select.html`. Legacy `GET /grades/input` (`?period_id=`). Roles: root, admin, teacher, coordinator.
- Header H2 "Ingreso de Notas"; button "Cargar desde Excel" (→ GRD-03).
- Card "Seleccionar Periodo Academico": one pill button per period (`period.name`, badge "Activo" on the active one); the selected period is highlighted; default = active period (or first). Redirect with warning if there are no periods ("No hay periodos academicos configurados. Configure los periodos primero.").
- Card "Criterios de Evaluacion" (only when criteria exist): one mini-card per criterion — name (H6), weight badge "{n}%", description.
- Card "Seleccionar Grado y Asignatura": for each course the user may grade, a block "Grado: {nombre}" with badge "{n} estudiantes", then one row per subject-grade: subject name, teacher name (or "Sin docente"), buttons "Ingresar Notas" (→ GRD-02 with selected period) and "Ver Resumen" (→ GRD-07). Teachers see only their own subject-grades. Empty: "No hay grados disponibles para el ano academico actual."

#### GRD-02 Grade sheet — "Ingreso de Notas" (the main data-entry screen)

- Template `templates/grades/input.html`. Legacy `GET|POST /grades/input/{sg_id}/{period_id}`. Roles: root, admin, teacher (own), coordinator.
- Breadcrumb: "Notas" › {curso} › {asignatura} › {periodo}. Header button "Volver" (→ GRD-01). If locked, a "Desbloquear" button (POST `action=unlock`, confirm "Desbloquear notas para edicion?").
- Summary strip (4 cards): "Asignatura", "Grado", "Periodo", "Estudiantes" (count). Lock badge: "Notas Bloqueadas" (red) / "Notas Desbloqueadas" (green). Info line: "**Pesos:** {criterio}: {peso}% ..." and "| Escala: 1.0 - 5.0 | Minimo aprobacion: 3.0".
- Card "Planilla de Calificaciones" with action buttons (hidden when locked): "Guardar Todas" (`action=save`), "Guardar y Bloquear" (`action=lock`, confirm "Bloquear notas? Esta accion impedira futuras ediciones.", only if there is at least one grade), "Carga Masiva" (→ GRD-03).
- Table `gradeTable` with a two-row header:
  - Columns: **#** (row index), **Estudiante** (full name + document number small), then for each criterion a group "{criterio} ({peso}%)" split into **Nota** and **Observ.**, then **Final**, **Estado**, and (unlocked only) an eye action column.
  - Cells (unlocked): `Nota` = number input name `grade_{studentId}_{criterionId}`, min 1.0, max 5.0, step 0.1, validates on input (red border if out of range / non-numeric, green when valid) and is formatted to one decimal on blur; `Observ.` = text input (placeholder "Observacion", max 500). Locked: values rendered as plain text ("-" when empty; observation truncated to 20 chars). A record can also be individually `locked`.
  - **Final** is computed live in the browser: Σ(score×weight/100); when the entered weights total < 100 the result is normalised (÷ applied weight × 100); clamped 1.0–5.0, rounded; coloured by score class. **Estado** badge live: "Ganada" (>= 3.0, green), "Perdida" (red), "N/A" (grey) when nothing entered. Eye button opens GRD-08 for that student in a new tab.
  - Footer row "**Promedio del Grupo:**" — per-criterion average (1 decimal, coloured), average of Final, and "-" for status; updates live.
- Warn-on-leave: unsaved changes trigger the browser's beforeunload prompt.
- Empty/error states: "No hay estudiantes activos en este grado." (warning below table); redirect warnings "No hay criterios de evaluacion configurados. Configure los criterios primero."; flashes "Notas guardadas exitosamente.", "Notas bloqueadas exitosamente.", "Notas desbloqueadas exitosamente."
- Persistence rule: on save every filled cell writes a `GradeRecord`, then the `FinalGrade` for each student is recalculated (`GradeCalculatorService`).

#### GRD-03 Bulk upload — "Carga Masiva de Notas desde Excel"

- Template `templates/grades/upload.html`. Legacy `GET|POST /grades/upload`. Roles: root, admin, teacher, coordinator.
- Header H2; "Volver a Seleccion" (→ GRD-01).
- Card "Instrucciones" (ordered list): choose course+subject; choose period; prepare .xlsx/.xls with columns `documento` (required) and one column per criterion (scale 1.0 to 5.0); the system finds the student by document within the selected course; out-of-range scores are rejected; existing grades are updated unless locked.
- Card "Formato del Archivo Excel": sample table header `documento | {criterio_1} | {criterio_2} | ...` (criterion names lowercased) with example rows; button "Descargar Plantilla Excel" (client-side CSV download).
- Card "Cargar Archivo": select "Grado y Asignatura:" (grouped by `Grado: {nombre}`, options "{materia} - {docente o 'Sin docente'}"), select "Periodo Academico:" (periods), file "Archivo Excel:" (.xlsx/.xls); buttons "Cargar Notas", "Limpiar". Client dialogs (SweetAlert): "Archivo no valido — Solo se permiten archivos Excel (.xlsx, .xls)", "Campos incompletos — Por favor complete todos los campos requeridos.", "Confirmar carga masiva".
- Card "Escala de Calificacion": four chips — 4.6–5.0 Superior, 4.0–4.5 Alto, 3.0–3.9 Basico, 1.0–2.9 Bajo; "Nota minima de aprobacion: **3.0**".
- Result: flash with counts of updated/created rows and error list.

#### GRD-04 Period lock panel — "Panel de Bloqueo de Periodos"

- Template `templates/grades/lock_panel.html`. Legacy `GET|POST /grades/lock`. Roles: root, admin, coordinator.
- Header H2 "Panel de Bloqueo de Periodos". Callout: "Cuando un periodo esta **bloqueado**, no se pueden editar ni agregar notas. Solo los administradores pueden bloquear o desbloquear periodos."
- Card "Bloquear/Desbloquear Periodo": selects "Asignatura - Grado" ("-- Seleccionar --", options "{materia} - {grado}") and "Periodo"; buttons "Bloquear" (`action=lock`) and "Desbloquear" (`action=unlock`).
- Card "Estado de Periodos": table `lockTable`: **Grado**, **Asignatura**, **Periodo**, **Registros** (number of grade records), **Estado** (badge "Cerrado" / "Abierto" / "Sin datos"), **Acciones** (inline POST button "Desbloquear" when closed, "Bloquear" when open; none when no data). Empty: "No hay combinaciones de asignatura-grado y periodo disponibles."

#### GRD-05 Period final grades — "Notas Finales del Periodo"

- Template `templates/grades/final_view.html`. Legacy `GET|POST /grades/final/{sg_id}/{period_id}` (POST = recalculate all). Roles: root, admin, teacher, coordinator.
- Header H2 "Notas Finales del Periodo"; buttons "Volver a Planilla" (GRD-02) and "Recalcular Todas" (POST).
- Info strip: "Grado:", "Asignatura:", "Periodo:", "Docente:" (name or "N/A"); "Criterios y Ponderacion": chips "{criterio}: {peso}%".
- Card "Notas Finales por Estudiante": table `finalTable`: **#**, **Estudiante** (link → GRD-08), one column per criterion "{criterio} ({peso}%)" (score or "-"), **Nota Final** (2 decimals or "-"), **Estado** (badge "Ganada" / "Perdida" / "No evaluado" / "Sin nota"). Footer row "PROMEDIO GENERAL": per-criterion average (1 decimal) and final average (2 decimals) or "-". Empty: "No hay estudiantes activos en este grado."

#### GRD-06 Annual grades — "Notas Anuales"

- Template `templates/grades/annual_view.html`. Legacy `GET /grades/annual/{sg_id}`. Roles: root, admin, teacher, coordinator.
- Header H2 "Notas Anuales"; back button. Info strip "Grado:", "Asignatura:", "Docente:".
- Card "Tabla de Notas por Periodo y Definitiva": table `annualTable`: **#**, **Estudiante** (link → GRD-08), one column per period (`short_name`: P1…P4; score or "-"), **DEF** (annual score = mean of period finals, or "-"), **Estado Anual** (badge "Aprobado" / "Reprobado" / "No evaluado" / "Sin nota"). Footer "PROMEDIO GENERAL": per-period averages and DEF average (2 decimals). Empty: "No hay estudiantes activos en este grado."

#### GRD-07 Grade summary / analytics — "Resumen de Notas"

- Template `templates/grades/summary.html` (the file contains two near-duplicate versions; use this merged description). Legacy `GET /grades/summary/{sg_id}/{period_id}`. Roles: root, admin, teacher, coordinator.
- Header H1 "Resumen de Notas" (or "Resumen de Calificaciones"), sub "{materia} — {grado} — {periodo}"; button "Volver a Planilla" (GRD-02).
- KPI row (4 cards):
  1. "Promedio General" (1 decimal) with caption: >= 4.0 "Excelente", >= 3.0 "Aceptable", else "Requiere Atención".
  2. "Tasa de Aprobación" ("{n}%") with a progress bar.
  3. "Máx / Mín" ("{max} / {min}", caption "Rango de notas").
  4. "Evaluados / Total" ("{evaluados} / {total}", caption "{x}% completado"; variant shows "✅ {pasaron} ❌ {reprobaron}").
- Card "Resumen por Estudiante": table `summaryTable`: **#**, **Estudiante** (link → STU-02; "Apellido, Nombre"), one column per criterion (score or "-", badge coloured by performance level), **Final**/"Nota Final", **Estado** (Ganada/Perdida/No evaluado/Sin nota). Footer "PROMEDIOS" per criterion + final.
- Card "Distribución de Notas": **bar chart** (Chart.js), x = score bucket `1.0-1.9`, `2.0-2.9`, `3.0-3.9`, `4.0-4.9`, `5.0`, y = number of students (final grades); bar colours red, orange, amber, teal, blue; no legend, y starts at 0 with integer ticks.
- Card "Estadísticas por Criterio": per criterion a label, average (1 decimal or "N/A"), horizontal bar (width = average/5) and "{n} evaluaciones/estudiantes evaluados".
- Card "Estadísticas Rápidas" (when final grades exist): "Reprobados" count, "No evaluados" count, "Desviación Estándar" (1 decimal).
- Empty: "No hay estudiantes en este grado" + "Administrar Grados" (→ INS-11), or "No hay calificaciones registradas / Aún no se han ingresado notas para este grupo en el periodo actual." + "Ir a la Planilla de Notas".

#### GRD-08 Student grades — "Notas del Estudiante"

- Template `templates/grades/student_view.html`. Legacy `GET /grades/student/{student_id}`. Roles: root, admin, coordinator, teacher, **student** (own), **parent**.
- Breadcrumb: for staff "Estudiantes › {nombre} › Notas"; for student/parent "Dashboard › Notas". Header H2 "Notas del Estudiante"; staff button "Volver al Perfil".
- Identity strip: name (H4), "Grado: **{curso}** | Documento: **{doc}** | Sede: **{sede}**", status badge.
- KPI row (if grades exist): "Promedio General" (big number, 1 decimal), "Asignaturas Ganadas", "Asignaturas Perdidas", "Total Calificaciones".
- One card per period (header "{periodo}" + badge "Activo" + date range dd/mm/yyyy – dd/mm/yyyy): table `gradesTable_{periodId}`: **Asignatura** (name bold + course small), one column per criterion "{criterio} ({peso}%)", **Nota Final**, **Estado** (Ganada/Perdida/No Evaluado), **Nivel de Desempeno** (Superior/Alto/Básico/Bajo). Cells "-" when no score.
- Card "Escala de Calificacion" with the four bands and "Escala: 1.0 a 5.0 | Minimo aprobacion: 3.0".
- Empty: "No hay notas registradas para este estudiante aun."

### 3.8 Attendance (ATT)

Blueprint prefix `/attendance`. Attendance is **per subject-grade and date** (a class session), with four statuses: `presente`, `ausente`, `justificado`, `excusado`. Critical absence threshold: **> 20%** absence rate ("Critico"); every view uses the same bands: absence rate > 20% "Critico" (red), > 10% "Atencion" (amber), otherwise "Normal" (green). Roles for all ATT screens: root, admin, coordinator, teacher (teachers only their own subject-grades, otherwise "No tienes permiso para ver esta asignatura.").
Status buttons: "✓ Presente" (green), "✗ Ausente" (red), "⚑ Justificado" (amber), "ℹ Excusado" (blue/grey). Chart colours: Presentes #198754 (green), Ausentes #dc3545 (red), Justificados #ffc107 (amber).

#### ATT-01 Take attendance — "Tomar Asistencia"

- Template `templates/attendance/take.html`. Legacy `GET /attendance/` (`?grade_id=&sg_id=&date=`), `POST /attendance/save` (JSON `{sg_id, date, records:[{student_id,status,observation}]}`), `GET /attendance/get?sg_id=&date=` (JSON of existing records).
- Header H2 "Tomar Asistencia", sub "Registro diario de asistencia estudiantil"; button "Ver Resumen" (→ ATT-03 for the selected subject-grade).
- **Step 1 – selection card** "Seleccione Grado y Asignatura" (GET form): "Grado" select ("-- Seleccione un grado --"), "Asignatura" select (dependent: "-- Seleccione primero un grado --", then options "{materia} - {docente}" filtered by the grade), "Fecha" date (default today), submit button. Teachers only see their own subject-grades; admin/coordinator all.
- **Step 2 – roll sheet** (once a subject-grade is selected): title "{materia} - {curso}"; a date input + button "Cargar" (loads existing records; Swal "Datos Cargados — Se cargaron {n} registros existentes").
  - Live counters (4 tiles): "Presentes", "Ausentes", "Justificados", "Excusados".
  - "Acciones rapidas:" button "Todos Presentes" (Swal "Hecho — Todos marcados como presente"), button "Exportar" (CSV). "Filtrar:" buttons "Solo Ausentes", "Mostrar Todos".
  - Table `attendanceTable`: **#**, **Estudiante** (full name; fallback "Estudiante #id"), **Estado** (4 toggle buttons, exactly one active per row), **Observacion** (text input, placeholder "Observacion..."), **Acciones** (two quick icon buttons: marcar ausente / marcar presente).
  - Footer button "Guardar Asistencia ({n} estudiantes)" → Swal loading "Guardando... Registrando asistencia" then "Asistencia Guardada"; errors "Seleccione una asignatura y fecha", "No hay estudiantes para registrar", "Error de conexion", server errors ("Datos invalidos", "Faltan datos requeridos", "Fecha invalida", "No tienes permiso para esta asignatura").
  - Saving upserts one `Attendance` per student/subject-grade/date (existing record is updated).
  - Empty: "No hay estudiantes activos en este grado."

#### ATT-02 Student attendance history — "Historial de Asistencia"

- Template `templates/attendance/summary.html`. Legacy `GET /attendance/student/{student_id}`. Roles: root, admin, coordinator, teacher (teacher sees only own subjects). _(Legacy does not allow student/parent here; the parent portal uses PAR-03 instead. Prototype: allow the student to open it for themselves from DASH-05.)_
- Header: "Volver al Perfil" (STU-02); student strip: name, badge course, badge "{tipo}: {documento}"; button "Tomar Asistencia" (ATT-01).
- Alert banner by absence rate: > 20% red "¡Alerta de Inasistencia Critica! Este estudiante tiene una tasa de inasistencia del **{x}%**, que supera el umbral critico del 20%. Se recomienda notificar a coordinacion y al acudiente."; > 10% (up to 20%) amber "Atencion: Tendencia de Inasistencia — Este estudiante tiene una tasa de inasistencia del **{x}%**. Monitorear de cerca para evitar ausencias criticas."
- KPI row (4 tiles): "Total Registros", "Presentes" (+ "{%}"), "Ausentes" (+ "{%}"), "Justificados" (+ "{%}", justificado + excusado).
- Charts (when records exist): "Distribucion General" **doughnut** (Presentes / Ausentes / Justificados) and "Tendencia Mensual" **grouped bar** by month `YYYY-MM` with the three series.
- "Desglose Mensual": one row per month (newest first): "**{YYYY-MM}** ({n} registros)", counts presentes / ausentes / justificados, "**{x}% ausencias**".
- "Historial de Asistencia" with button "Exportar CSV"; table `attendanceTable`: **Fecha**, **Asignatura** ("N/A" if missing), **Estado** (badge with glyph), **Observacion**, **Registrado por** (name or "Usuario #id"). Empty: "No hay registros de asistencia para este estudiante."

#### ATT-03 Group attendance summary — "Resumen de Asistencia"

- Template `templates/attendance/summary_group.html`. Legacy `GET /attendance/summary?sg_id=`.
- Header H2 "Resumen de Asistencia", sub "{materia} - {curso}"; buttons "Tomar Asistencia" (ATT-01), "Reporte por Rango" (ATT-04), "Ver Estudiantes" (STU-01).
- KPI row: "Total Registros", "Presentes" (+%), "Ausentes" (+%), "Justificados" (+%).
- Card "Estudiantes en Riesgo por Inasistencia (>20%)" (only when any): list of students (link → ATT-02) with "{n} ausencias de {total}" and a "{x}%" badge.
- Card "Tendencia Mensual": **line chart**, x = month, three series Presentes / Ausentes / Justificados (green / red / amber with 10% fill).
- Card "Detalle por Estudiante" (button "Exportar CSV"), table `studentTable`: **#**, **Estudiante** (link → ATT-02), **Presentes**, **Ausentes**, **Justificados**, **% Asistencia** (value + small bar), **% Ausencia** (value + small bar), **Estado** (badge "Critico" red > 20%, "Atencion" amber, "Normal" green).

#### ATT-04 Attendance report by date range — "Reporte de Asistencia" (print view)

- Template `templates/attendance/report.html`. Legacy `GET /attendance/attendance/report?sg_id=&start_date=&end_date=`.
- Header H2 "Reporte de Asistencia", sub "{materia} - {curso}" and "{inicio} a {fin}"; buttons "Imprimir" (window.print), "CSV", back to ATT-03. (Legacy has no date pickers; the prototype should add "Desde" / "Hasta" date inputs defaulting to the current month.)
- Printable block: title "Reporte de Asistencia", subject/course, date range; 4 totals "Total Registros", "Presentes", "Ausentes", "Justificados".
- Card "Detalle por Estudiante": table `reportTable`: **#**, **Estudiante**, **Presentes**, **Ausentes**, **Justificados**, **% Asistencia** (= 100 − absence), **% Ausencia**, **Estado** (Critico / Atencion / Normal); footer row "Totales". Empty: "No hay registros de asistencia en el periodo seleccionado."

### 3.9 Observations (OBS)

Routes have **no URL prefix**: `/observations...`. Roles: root, admin, coordinator, teacher (teachers only see/create for students of their own courses; delete: root/admin/coordinator only; edit: author or any grade-editor role — root/admin/teacher). Types and badge colours: "Positiva" (green, 👍), "Negativa" (red, ⚠️), "Seguimiento" (blue/cyan, 📋), "Convivencia" (amber/purple, 🤝). Categories (select options): Disciplina, Rendimiento, Valores, Convivencia, Responsabilidad, Participación, Otro. Negative and convivencia observations "require notification" to the parents/guardians (the creation flash says "Observación creada exitosamente. El director de grupo será notificado."). Notification is manual: a "marcar como notificada" action sets `notified=true` (no real messaging).

#### OBS-01 Observations list — "Observaciones de Comportamiento"

- Template `templates/observations/list.html`. Legacy `GET /observations` (filters `type, category, author, student, date_from, date_to, page, per_page=20`).
- Header: H1 "Observaciones de Comportamiento", sub "Gestión y seguimiento de observaciones estudiantiles"; button "Nueva Observación" (→ OBS-03).
- KPI row (6 tiles): "Positivas", "Negativas", "Seguimiento", "Convivencia", "Notificadas", "Pendientes" (counts respect the user's visibility scope).
- Card "Filtros": "Tipo" ("Todos"; Positiva, Negativa, Seguimiento, Convivencia), "Categoría" ("Todas"; distinct categories in use), "Autor" ("Todos"; staff users), "Estudiante" (text, placeholder "Buscar por nombre..."), "Desde" (date), "Hasta" (date); buttons "Filtrar", "Limpiar", "Exportar CSV" (root/admin/coordinator).
- Card "Lista de Observaciones": table `observationsTable`: **Fecha** (dd/mm/yyyy), **Estudiante** (link → OBS-05), **Tipo** (badge), **Categoría**, **Descripción** (truncated at 100 chars + "...", full text as tooltip), **Autor**, **Estado** (check icon "Notificada", or button "Marcar como notificada" when pending and notification is required), **Acciones**: eye → OBS-02, pencil → OBS-03 edit (author/editor roles), trash (root/admin/coordinator; confirm "¿Eliminar esta observación?").
- Server pagination: "Anterior", page numbers with "…", "Siguiente", caption "Mostrando {a} a {b} de {n} observaciones". Mark-notified confirm: "¿Marcar esta observación como notificada?".
- Empty: "No hay observaciones / No se encontraron observaciones con los filtros aplicados." + "Crear primera observación".

#### OBS-02 Observation detail — "Detalle de Observación"

- Template `templates/observations/detail.html`. Legacy `GET /observations/{id}`.
- Header: "Detalle de Observación", "ID: #{id}"; buttons "Historial" (→ OBS-05), "Editar" (author/editor).
- Main card: type badge, category badge, student (name + course badge), "Descripción" paragraph, "Compromisos" paragraph (only if present).
- Side card: "Fecha" (dd/mm/yyyy HH:MM), "Autor" (name + role small), "Notificación a Acudientes" (badge "Notificada" green / "Pendiente" amber; badge "Requerida" when type is negativa/convivencia), "Creada" (timestamp). Actions: "Marcar como Notificada" (when pending; confirm "¿Marcar esta observación como notificada a los acudientes?") and "Eliminar" (root/admin/coordinator; confirm "¿Está seguro de eliminar esta observación?").

#### OBS-03 Observation form — "Nueva Observación" / "Editar Observación"

- Template `templates/observations/create.html`. Legacy `GET|POST /observations/new`, `/observations/{id}/edit`.
- Header sub "Complete el formulario para crear/actualizar la observación"; buttons back to detail (edit) and "Volver a la lista".
- Fields: "Estudiante *" (select "Seleccionar estudiante..." with "{nombre} - {curso o 'Sin grado'} ({documento})"; on edit disabled text with help "No se puede cambiar el estudiante de una observación existente"), "Tipo *" select ("Seleccionar tipo...", Positiva, Negativa, Seguimiento, Convivencia), "Categoría" select ("Seleccionar categoría..." + 7 options), "Descripción *" textarea 5 rows (placeholder "Describa la observación detalladamente...", help "Proporcione una descripción clara y detallada de la observación"), "Compromisos" textarea 3 rows (placeholder "Compromisos adquiridos (opcional)...", help "Opcional: acuerdos o compromisos derivados de la observación"), "Fecha" date (default today, help "Fecha en que ocurrió la observación (por defecto hoy)"). Buttons "Crear Observación"/"Actualizar Observación", "Cancelar".
- Info card "Información importante": "Las observaciones negativas y de convivencia requieren notificación automática a los acudientes del estudiante." (shown for new or notification-required).
- Errors: "Estudiante, tipo y descripción son obligatorios.", "Estudiante no encontrado.", "No tiene permiso para crear observaciones para este estudiante."

#### OBS-04 Quick observation — "Observación Rápida"

- Template `templates/observations/quick_form.html`. Legacy `GET|POST /observations/student/{student_id}/quick`. Reached from STU-01 / STU-02.
- Header H1 "Observación Rápida", sub "Crear observación para el estudiante"; "Volver al perfil" (STU-02). Student strip: name + "Grado: {curso}".
- Form: "Tipo de Observación *" as 4 **radio tiles** (👍 Positiva, ⚠️ Negativa, 📋 Seguimiento, 🤝 Convivencia), "Categoría" select ("Seleccionar..." + Disciplina, Rendimiento, Valores, Convivencia, Responsabilidad, Participación; help "Categoría opcional para clasificar la observación"), "Descripción *" textarea 4 rows (placeholder "Describa la observación con detalle...", help "Sea específico y objetivo en la descripción"), "Compromisos" textarea 2 rows (placeholder "Compromisos adquiridos (opcional)...", help "Compromisos que adquiere el estudiante (opcional)"). Buttons "Crear Observación", "Cancelar".
- Side card "Tipos de Observación": Positiva — "Reconocimiento de buen comportamiento o logro"; Negativa — "Comportamiento inadecuado o falta grave"; Seguimiento — "Monitoreo de progreso o situación"; Convivencia — "Aspectos relacionados con la convivencia escolar".

#### OBS-05 Student observation history — "Historial de Observaciones"

- Template `templates/observations/student_history.html`. Legacy `GET /observations/student/{student_id}`. Roles: root, admin, coordinator, teacher (the student dashboard links here as "Mis Observaciones"; legacy blocks student role — prototype should allow own history read-only).
- Header H1 "Historial de Observaciones", sub = student name; buttons "Nueva Observación" (→ OBS-04), "Ver Perfil" (STU-02). Student strip: name, "Grado: {curso} | Doc: {documento}".
- KPI row: "Total", "Positivas", "Negativas", "Pendientes" (= seguimiento + convivencia in legacy).
- Card "Línea de Tiempo": vertical timeline, one entry per observation (newest first): coloured dot by type; type pill ("👍 Positiva" / "⚠️ Negativa" / "📋 Seguimiento" / "🤝 Convivencia"), category pill, link "Ver detalle" (→ OBS-02), description, "Compromisos:" block (if any), footer with date (dd/mm/yyyy HH:MM), author name, notification status ("Notificada al acudiente" / "Pendiente de notificación"). Empty: "Sin observaciones / Este estudiante aún no tiene observaciones registradas." + "Crear primera observación".
- Side card "Acudientes" (if any): each guardian name (H6), phone, email.

### 3.10 Report cards — "Boletines" (RPT)

Blueprint prefix `/report-cards`. A report card (`ReportCard`) is one PDF per student per period; it contains the per-subject final scores of that period, performance level, status, teacher observations per subject, a general observation by the group director, attendance summary and signature lines. Delivery lifecycle: `pendiente` → `entregado` (with `delivery_date`). Roles: management screens root/admin/coordinator; student-level pages also teacher (generate) and the student themselves (own history/PDF); parents via PAR-05.

#### RPT-01 Report card management — "Gestion de Boletines de Calificaciones"

- Template `templates/report_cards/manage.html`. Legacy `GET /report-cards/` (redirects to `/report-cards/manage`). Roles: root, admin, coordinator. Data via JSON: `GET /report-cards/api/students/{grade_id}`, `GET /report-cards/api/report_cards`.
- Header H2 "Gestion de Boletines de Calificaciones". KPI row: "Total Generados", "Entregados", "Pendientes".
- Card "Generar Boletines" with two sub-forms side by side:
  - "Boletin Individual": selects "Grado" ("Seleccione un grado..."), "Estudiante" ("Seleccione un estudiante..."; loaded dynamically for the chosen grade), "Periodo Academico" ("Seleccione un periodo..." with "{periodo} ({año})"); button "Generar Boletin" (disabled until all three chosen) → POST `/report-cards/generate/{student}/{period}`.
  - "Generacion Masiva por Grado": selects "Grado", "Periodo Academico"; button "Generar Todos los Boletines" (disabled until both chosen); progress bar with text "Generando boletines..." → "Completado!" or "Error en la generacion.".
- Bulk result modal "Resultado de Generacion Masiva": 4 counters "Total", "Generados", "Omitidos", "Errores"; detail list (first 20 entries then "... y {n} mas") with icons ✓ generated / – skipped / ✗ error, each "{estudiante}: {status} ({reason})"; buttons "Cerrar", "Actualizar" (reload; auto-reload after 3 s). Skip reasons: student without grades for the period, etc.
- Card "Boletines Generados": table `reportCardsTable` (default sort ID desc, 10 per page): **ID**, **Estudiante**, **Grado** ("N/A"), **Periodo**, **Generado** (date-time), **Entrega** (badge "Entregado" green / "Pendiente" amber), **Acciones**: eye "Ver" (PDF in new tab → RPT-04), download "Descargar" (PDF), "Estado de entrega" (opens modal), clock "Historial" (→ RPT-03). Empty row: "No hay boletines generados aun."; load failure "No se pudieron cargar los boletines."
- Modal "Estado de Entrega": "Estudiante: **{nombre}**", "Estado actual: {badge}", "Cambiar estado a:" radio "Entregado" / "Pendiente"; buttons "Cancelar", "Guardar" (POST `/report-cards/{id}/deliver`).
- Server messages: "Boletin generado exitosamente.", "El estudiante no tiene un grado asignado.", "No hay asignaturas configuradas para este grado.", "No hay calificaciones registradas para este estudiante en este periodo.", "No hay estudiantes activos en este grado". Extra endpoints (no UI in legacy): `POST /report-cards/{id}/observation` (edit general observation), `POST /report-cards/observations` (teacher subject comment), `POST /report-cards/{id}/delete`. Prototype may expose "Observación general" as a textarea inside the delivery modal or RPT-02.

#### RPT-02 Generate report card for a student — "Generar Boletin de Calificaciones"

- Template `templates/report_cards/generate.html`. Legacy `GET /report-cards/student/{student_id}`. Roles: any auth with access (staff, or the student for themselves).
- Header H2 "Generar Boletin de Calificaciones"; sub "Estudiante: **{nombre}** - Grado: **{curso}**"; buttons "Ver Historial" (RPT-03), "Volver a Gestion" (RPT-01).
- Card "Seleccionar Periodo": one tile per period: name (H5), academic year, "dd/mm/yyyy - dd/mm/yyyy", badge "Activo". If a report card already exists for that period: "**Estado:** Entregado/Pendiente", "**Generado:** dd/mm/yyyy HH:MM", buttons "Ver" (new tab, when PDF exists) and "Regenerar" (POST); otherwise button "Generar Boletin" (POST).
- Empty: "No hay periodos academicos configurados / Contacte al administrador para configurar los periodos academicos."

#### RPT-03 Report card history — "Historial de Boletines"

- Template `templates/report_cards/history.html`. Legacy `GET /report-cards/history/{student_id}`. Roles: root, admin, coordinator, teacher; student for self.
- Header H2 "Historial de Boletines"; sub "Estudiante: **{nombre}** - Grado: **{curso}**"; buttons "Generar Nuevo Boletin" (RPT-02), "Volver a Gestion".
- Card "Informacion del Estudiante": "Nombre completo", "Documento" ("{tipo} {número}"), "Grado" ("N/A"), "Estado" (title-cased: Activo/Retirado/Graduado).
- Card "Boletines Generados": table `historyTable`: **Periodo** (short name, bold), **Anio Academico**, **Fecha Generacion** (or "N/A"), **Estado Entrega** ("Entregado" + date small / "Pendiente"), **Observacion General** (truncated at 50 chars or italic "Sin observaciones"), **Acciones** (eye "Ver PDF", download "Descargar PDF", or text "PDF no disponible"). Empty: "No hay boletines generados para este estudiante / Los boletines generados apareceran aqui." + "Generar Primer Boletin".
- Card "Todos los Periodos Academicos": grid of period chips (short name, year) with badge "Generado" (green) or "Sin generar" (grey), and "Activo" tag for the current period.

#### RPT-04 Report card document — print/PDF view (`pdf_template.html`)

- Template `templates/report_cards/pdf_template.html` (rendered to a PDF by the server; served by `GET /report-cards/{id}` inline and `/report-cards/{id}/download` as attachment). The prototype should render this as an on-screen A4 "print preview" page with a "Descargar PDF"/"Imprimir" action.
- Title tag: "Boletin de Calificaciones - {estudiante} - {P#}".
- Sections, top to bottom:
  1. **Header**: left placeholder "LOGO", centre: institution name (H1), "NIT: {nit}", "Resolucion: {resolución}", "{municipio}, {departamento}"; right placeholder "ESCUDO". Banner: "Boletin de Calificaciones - {P#} {año}".
  2. **"Datos del Estudiante"** (2-column key/values): "Nombre completo:", "Documento:" ("{tipo} {número}"), "Grado:", "Sede:", "Director de Grupo:" (if any), "Fecha de generacion:" (dd/mm/yyyy).
  3. **"Calificaciones por Asignatura"** table: **Asignatura**, **Nota Final** (1 decimal or "N/A"), **Desempeno** (Superior/Alto/Básico/Bajo), **Estado** (green "APROBADO" for `ganada`, red "REPROBADO" for `perdida`, "N/E").
  4. **"Escala Valorativa Institucional"** 4-column table: "Superior (4.6 - 5.0)" Minimo: 4.6 · "Alto (4.0 - 4.5)" Minimo: 4.0 · "Basico (3.0 - 3.9)" Minimo: 3.0 · "Bajo (1.0 - 2.9)" Maximo: 2.9.
  5. **"Observaciones por Asignatura"** (only if any): per subject "{asignatura} - {docente}" + observation text.
  6. **"Observacion General del Director de Grupo"**: text or italic "Sin observaciones generales registradas."
  7. **"Resumen de Asistencia - {P#}"** (if attendance exists): 4 tiles "Presentes", "Ausencias", "Justificadas", "Total Registros".
  8. **Signatures**: three lines "Director(a) de Grupo", "Coordinador(a) Academico(a)", "Rector(a)" each with label "Firma".
  9. **Footer**: "{institución} - Sistema Integral de Gestion Escolar (SIGE)" and "Documento generado el {d de mes de año a las HH:MM}. Este boletin es un documento oficial."

### 3.11 Metrics (MET)

Blueprint prefix `/metrics`. All metrics derive from `FinalGrade`, `Attendance`, `AcademicStudent`. Thresholds: pass >= 3.0; "en riesgo" = student average < 3.0 (risk screen has a configurable threshold); attendance "low" < 80%. Roles per screen below. **Legacy quirk:** the sidebar "Métricas" always links to MET-01, which teachers cannot open (403); teachers should land on MET-05. Chart palette used across the module: blue `#3b82f6` (averages), green `rgba(34,197,94)` (good), amber `rgba(234,179,8)` (warning), red `rgba(239,68,68)` (bad), cyan `#06b6d4` (attendance).

#### MET-01 Institutional metrics — "Metricas Institucionales"

- Template `templates/metrics/institution.html`. Legacy `GET /metrics/institution`. Roles: root, admin, coordinator.
- Header H2 "Metricas Institucionales", sub "Vista general del rendimiento academico"; buttons "Exportar Excel" (→ `GET /metrics/export`: .xlsx with 5 sheets "KPIs Generales", "Rendimiento por Sede", "Rendimiento por Grado", "Top 10 Estudiantes", "Estudiantes en Riesgo"), "Mapa de Calor" (MET-02), "Tendencias" (MET-03), "Comparativa Docentes" (MET-04).
- KPI row (4 cards): "Promedio Institucional" (avg of all final scores, 2 decimals), "% Aprobacion General" ("{n}%"), "Estudiantes en Riesgo" (count with avg < 3.0), "Tasa de Inasistencia" ("{n}%" = absences / attendance records).
- Card "Rendimiento por Sede": table `campusTable`: **Sede**, **Estudiantes** (badge), **Promedio**, **% Aprobacion** (value + progress bar coloured by rate), **En Riesgo** (red badge if > 0, else "0"). Empty: "No hay datos de sedes disponibles."
- Card "Rendimiento por Grado": table `gradeTable`: **Grado**, **Sede**, **Estudiantes**, **Promedio**, **% Aprobacion** (+bar). Empty: "No hay datos de grados disponibles."
- Card "Top 10 Mejores Estudiantes": table `topStudentsTable`: **#** (medal icons for 1–3), **Estudiante** (bold), **Grado**, **Promedio** (badge), **Estado** ("Sin perdidas" green or "{n} perdida(s)"). Empty: "No hay datos de estudiantes disponibles."
- Card "Top 10 Estudiantes en Riesgo": table `riskStudentsTable`: **Estudiante**, **Grado**, **Promedio** (red badge), **Materias Perdidas** (count badge). Empty: "No hay estudiantes en riesgo academico."

#### MET-02 Performance heatmap — "Mapa de Calor de Rendimiento"

- Template `templates/metrics/heatmap.html`. Legacy `GET /metrics/heatmap`. Roles: root, admin, coordinator.
- Header H2, sub "Matriz de porcentaje de perdida por grado y asignatura"; buttons "Volver a Metricas", "Exportar".
- Legend "Leyenda - Porcentaje de Perdida": 0–10% (Excelente), 10–20% (Bueno), 20–30% (Atencion), 30–40% (Riesgo), >40% (Critico), "Sin datos" — each a coloured swatch (green → yellow → orange → red → dark red; grey for none).
- Card "Matriz Grado x Asignatura": table `heatmapTable`, first column "Grado / Sede" (grade name bold + campus small), one column per subject (header = subject name, rotated/truncated). Cell = "{failure_rate}%" + small "Prom: {avg}" on a background by the legend; "-" for no data; tooltip "{asignatura} - {grado}: {x}% perdida | Promedio: {a} | Total: {n} | Perdidas: {m}". Click opens modal.
- Modal "Detalle de Celda": "Grado:", "Asignatura:", tiles "% Perdida", "Promedio", "Total Notas", "Perdidas"; button "Cerrar". Empty: "No hay datos disponibles para el mapa de calor."

#### MET-03 Academic trends — "Tendencias Academicas"

- Template `templates/metrics/trends.html`. Legacy `GET /metrics/trends`. Roles: root, admin, coordinator.
- Header H2, sub "Evolucion del rendimiento en los ultimos 2 anos"; buttons "Volver a Metricas", "Exportar".
- Callout "Analisis de Tendencia": "El rendimiento institucional muestra una tendencia de **{MEJORA|DETERIORO|ESTABILIDAD}** en los ultimos periodos analizados." (computed as second-half average of period averages minus first-half: >0 mejora, <0 deterioro, 0 estabilidad; callout colour green/red/blue).
- Charts: "Promedio Institucional por Periodo" **line** (blue, filled; x "Periodo Academico", y "Promedio", tooltip "Promedio: {v}"); "% Aprobacion por Periodo" **bar** (green >= 80, amber >= 60, red < 60; y "% Aprobacion", tooltip "{v}% aprobacion"); "Tendencia de Asistencia Mensual" **line** (cyan; x "Mes" `YYYY-MM`, y "% Asistencia"; empty "No hay registros de asistencia disponibles.").
- Card "Detalle por Periodo": table `periodTable`: **Periodo**, **Promedio** (coloured: >= 4.0 green, >= 3.0 amber, else red), **% Aprobacion** (+bar green/amber/red at 80/60), **Estado** (badge "Aceptable" >= 3.5, "Regular" >= 3.0, "Deficiente" < 3.0).
- Empty: "No hay datos de periodos disponibles / Se necesitan periodos academicos con calificaciones registradas."

#### MET-04 Anonymous teacher comparison — "Comparativa Anonima de Docentes"

- Template `templates/metrics/teacher_comparison.html`. Legacy `GET /metrics/teacher/comparison`. Roles: root, admin, coordinator.
- Header H2, sub "Rendimiento anonimizado por profesor (A, B, C...)"; buttons "Volver a Metricas", "Exportar".
- KPI row: "Total Docentes", "Promedio General", "Mejor Percentil" (value "{n}%", caption "Profesor A"), "Mejor % Aprobacion".
- Card "Tabla Comparativa Anonima": table `comparisonTable`: **Profesor** ("Profesor {A|B|C…}", trophy icon for the best), **Grupos** (badge), **Estudiantes** (badge), **Promedio** (coloured), **% Aprobacion** (+bar), **Percentil** (badge: green >= 75, amber mid, red low). Teachers are anonymised (letters ordered by average).
- Charts: "Comparativa de Promedios" **bar** (one bar per letter, coloured by band); "Distribucion de Aprobacion" **doughnut** (pass rate per letter; legend bottom, tooltip "{letra}: {v}% aprobacion").
- Empty: "No hay datos de docentes disponibles / Se necesitan docentes con grupos y calificaciones asignadas."

#### MET-05 Teacher metrics — "Métricas del Docente"

- Template `templates/metrics/teacher.html`. Legacy `GET /metrics/teacher` (`?teacher_id=` for management roles). Roles: root, admin, teacher (own), coordinator.
- Header H2 "Métricas del Docente"; sub "Analizando: **{docente}**"; for root/admin/coordinator a select "Seleccionar docente..." + button "Actualizar" (changing the select reloads with `teacher_id`).
- KPI row: "Promedio General", "% Aprobación", "Inasistencias" ("{n}%" + small "{x} totales"), "Estudiantes a Cargo".
- Card "Planes de Acción Sugeridos": cards each with subject (H6), course badge, suggestion text, metric chip ("Avg: 2.9 / Pass: 62.5%"). Rule messages: "Reforzar temas básicos de {materia}. Se observa una tasa de aprobación crítica ({x}%).", "El rendimiento en {curso} es notablemente inferior al promedio de otros grupos en {materia}. Revisar metodología específica.", "Realizar actividades de nivelación preventiva para subir el promedio del grupo ({avg})." Empty: "¡Todo en orden! No se han detectado desviaciones críticas que requieran intervención inmediata."
- Card "Análisis por Grupo": table `groupsTable`: **Grupo**, **Materia**, **Estudiantes**, **Promedio** (or "-"), **% Aprobación** (+bar), **En Riesgo** (red badge if > 0). Empty: "No hay datos de grupos disponibles."
- Chart "Distribución de Notas": **bar** with 7 bins — "Excelente (4.5-5.0)", "Muy Bien (4.0-4.4)", "Bien (3.5-3.9)", "Aceptable (3.0-3.4)", "Deficiente (2.5-2.9)", "Bajo (2.0-2.4)", "Muy Bajo (1.0-1.9)"; colours green for Excelente/Muy Bien, amber for Bien/Aceptable, red for the rest; y "Número de Estudiantes", tooltip "{n} estudiantes". Empty: "No hay datos de notas disponibles."
- Chart "Tendencia por Periodo": **line** "Promedio General" (blue) with a horizontal reference line "Mínimo aprobatorio (3.0)" (red); x "Periodo Académico", y "Promedio". Empty: "No hay datos de periodos disponibles."
- Card "Estudiantes en Riesgo" (chip "{n} estudiantes con promedio < 3.0"): table `riskTable`: **Estudiante** (bold), **Grado**, **Promedio** (red badge), **Materias Afectadas**. Empty: "No hay estudiantes en riesgo. ¡Excelente trabajo!"
- Footer cards: "Comparativa Anónima — Tu rendimiento vs. promedio institucional" (→ MET-04) and "Asistencia vs Rendimiento — Correlación asistencia-notas" (→ MET-06).

#### MET-06 Attendance vs performance — "Asistencia vs Rendimiento"

- Template `templates/metrics/teacher_attendance.html`. Legacy `GET /metrics/teacher/attendance` (`?teacher_id=`). Roles: root, admin, teacher, coordinator.
- Header H2, sub "Analizando: **{docente}**", teacher select + "Actualizar" (management roles), button "Volver al Dashboard" (MET-05).
- KPI row: "Estudiantes Analizados", "Asistencia Promedio" ("{n}%"), "Nota Promedio", "Correlación" (Pearson r with label: > 0.7 "Fuerte positiva", > 0.3 "Moderada positiva", > 0 "Débil positiva", > −0.3 "Débil negativa", > −0.7 "Moderada negativa", else "Fuerte negativa").
- Chart "Gráfico de Dispersión: Asistencia vs Notas": **scatter**, x = "% Asistencia", y = "Promedio de Notas", one point per student (tooltip name + course + both values), 4 coloured series by quadrant — "Óptimo (Asist. >= 80%, Nota >= 3.0)" green, "Refuerzo Académico (Asist. >= 80%, Nota < 3.0)" blue, "Atención Asistencia (Asist. < 80%, Nota >= 3.0)" amber, "Crítico (Asist. < 80%, Nota < 3.0)" red — plus a grey "Tendencia" regression line. Empty: "No hay datos de asistencia y notas disponibles."
- Card "Patrones Identificados": "Resumen" counts "Aproban + Buena Asistencia", "Aproban + Baja Asistencia", "Reprueban + Buena Asistencia", "Reprueban + Baja Asistencia"; list "Baja Asistencia (< 80%)" (first 5: name + "%" badge, then "+{n} más"); list "Críticos (Baja Asistencia + Notas Bajas)" (first 5: name, score, attendance, "+{n} más"). Empty: "No se identificaron patrones de riesgo." / "No hay datos suficientes para analizar patrones."
- Card "Detalle por Estudiante": table `attendanceTable`: **Estudiante** (bold), **Grado**, **% Asistencia** (+bar), **Promedio Notas** ("N/A" if 0), **Estado** (badge "Óptimo" / "Refuerzo Académico" / "Atención Asistencia" / "Crítico"). Empty: "No hay datos de estudiantes disponibles."

#### MET-07 At-risk students — "Estudiantes en Riesgo"

- Template `templates/metrics/risk_students.html`. Legacy `GET /metrics/risk-students` (`?threshold=`, default 3.0). Roles: root, admin, coordinator, teacher (teacher: only own subjects; sub "Estudiantes con rendimiento bajo en tus asignaturas" vs "…en la institución").
- Filter card: "Umbral de Riesgo (promedio menor a)" select — 1.0 "Solo desempeño muy bajo", 1.5 "Riesgo extremo", 2.0 "Riesgo alto", 2.5 "Riesgo medio-alto", 3.0 "Incluye desempeño básico bajo"; buttons "Aplicar Filtro", "Restablecer".
- No at-risk: celebratory empty "¡No hay estudiantes en riesgo! Todos los estudiantes tienen promedios iguales o superiores al umbral de {umbral}." + "Volver al Dashboard".
- Else KPI row: "Total en Riesgo", "Riesgo Alto (<2.0)", "Riesgo Medio (2.0-2.9)".
- Card "Lista de Estudiantes en Riesgo": table `riskTable`: **#**, **Estudiante**, **Grado**, **Promedio** (badge: < 2.0 red, else amber/orange), **Asignaturas** (count of failed subjects), **Estado** (badge "Crítico" < 2.0 / "Alerta"), **Acciones** (eye "Ver perfil" → STU-02).
- Chart "Distribución de Riesgo": **doughnut** "Riesgo Alto (<2.0)" red vs "Riesgo Medio (2.0+)" amber. Info card: "**Umbral actual:** {n}" ("Estudiantes con promedio menor a este valor se consideran en riesgo"), "Crítico — Promedio menor a 2.0 (Desempeño Bajo)", "Alerta — Promedio entre 2.0 y el umbral (Desempeño Básico bajo)".

### 3.12 Achievements — "Logros y Gamificación" (ACH)

Routes: `/achievements/achievements` (catalog), `/achievements/achievements/student/{id}`, `/achievements/leaderboard`, `POST /achievements/achievements/award`, `POST /achievements/achievements/run_engine`, JSON `api/student/{id}` and `api/list`. The catalog is seeded with the 7 rules in 2.2 and filled automatically by an **achievement engine** (rules: Superador, Excelencia, Asistencia Perfecta, Todo Terreno, Resiliente, Constancia, Compañero) that scans final grades, attendance and observations; admins/coordinators can also award manually. Emojis are used as icons (🏆 ⭐ ✅ 🏅 💪 🔥 🤝 📈).

#### ACH-01 Achievements catalog — "Logros y Gamificación"

- Template `templates/achievements/list.html`. Legacy `GET /achievements/achievements` (`?category=`). Roles: root, admin, coordinator, teacher (award/run engine: root, admin, coordinator).
- Header H2 "🏆 Logros y Gamificación"; button "⚙️ Ejecutar Motor Automático" (POST; confirm "¿Ejecutar el motor de logros para todos los estudiantes?"; spinner while running; result flash "{n} logros otorgados…" or info "No se encontraron nuevos logros para otorgar.").
- Filter chips "**Filtrar por categoría:**" — "Todos" + one chip per category (académico, mejora, asistencia, comportamiento).
- Grid of achievement cards: big emoji icon, name (H5), description, category badge, "Otorgado {n} veces", button "🏆 Otorgar Manualmente" (admin/coordinator/root) opening the modal.
- Empty: "Sin logros disponibles / No hay logros configurados para esta institución."
- Modal "🏆 Otorgar Logro": read-only "Logro a otorgar:", "Estudiante:" select ("-- Seleccionar estudiante --"; loaded from students API), "Periodo (opcional):" select ("-- Sin periodo específico --"); buttons "Cancelar", "Otorgar Logro". Flashes: 'Logro "{nombre}" otorgado a {estudiante}.', "El estudiante ya tiene este logro para el periodo seleccionado.", "Debe seleccionar un logro y un estudiante.", "No tienes permiso para otorgar logros a este estudiante."

#### ACH-02 Student achievements — "Logros de {estudiante}"

- Template `templates/achievements/student_achievements.html`. Legacy `GET /achievements/achievements/student/{student_id}`. Roles: any auth, but scoped: same institution; teachers only for their own students; (the student dashboard should link here for "Mis Logros"; parents see the same data in PAR-06).
- Header H2 "🏆 Logros de {nombre}"; "← Volver al Estudiante" (STU-02); admin/coordinator/root: button "⚙️ Ejecutar Motor" (this student only).
- Identity card: photo or 👤, name (H5), "Grado: {curso}"; 3 counters: total "Logros", "Académicos", "Mejora".
- Grid of earned achievements: emoji, name, description, category badge, optional "Periodo #{id}" (prototype: period short name), date `dd/mm/yyyy` and time `HH:MM`.
- Empty: "📋 Sin logros aún / Este estudiante aún no ha obtenido logros. Ejecuta el motor automático o otorga logros manualmente." + (admin) button "⚙️ Ejecutar Motor para este Estudiante".
- Side card (admin/coordinator/root) "🏆 Otorgar Logro Rápido": select "Logro:" ("-- Seleccionar --") + button "Otorgar".

#### ACH-03 Leaderboard — "Ranking Estudiantil"

- Template `templates/achievements/leaderboard.html`. Legacy `GET /achievements/leaderboard` (`?grade=&limit=`). Roles: any auth (not in the sidebar; linked from ACH-01/ACH-02 context — prototype: add a tab/button "Ranking").
- Header H2 "🏆 Ranking Estudiantil".
- **Podium** (when >= 3 entries): three cards — 2nd (🥈, left), 1st (🏆 with "👑 1° Lugar", centre, larger), 3rd (🥉, right); each: name, course, big count + "logros", link "Ver Logros" (→ ACH-02), caption "2° Lugar" / "3° Lugar".
- Filter form: "Grado:" select ("-- Todos los grados --"), "Mostrar:" select (Top 10, Top 25, Top 50 [default], Top 100), "Filtrar".
- Card "Ranking Completo": table `leaderboard-table`: **#**, **Medalla** (🏆 / 🥈 / 🥉 / ☆), **Estudiante** (small photo + name), **Grado**, **Logros** (count badge), **Acciones** ("Ver Logros"); top 3 rows tinted (gold, grey, light).
- Empty: "📋 Sin datos de ranking / Aún no hay estudiantes con logros. Ejecuta el motor automático para generar logros." + (admin) "⚙️ Ejecutar Motor Automático".

### 3.13 Early alerts — "Alertas Tempranas" (ALR)

Blueprint prefix `/alerts` (no extra prefix needed). Roles for the whole module: root, admin, coordinator. Alert model, 6 types, severities and the rule table are in 2.2. The sidebar item shows a red numeric badge = active (unresolved) alert count (`GET /alerts/api/count` → `{count}`), hidden at 0, "99+" cap.

#### ALR-01 Alerts panel — "Alertas Tempranas"

- Template `templates/alerts/list.html`. Legacy `GET /alerts` (`?type=&severity=&resolved=`), `GET /alerts/export` (CSV with the same filters). Roles: root, admin, coordinator.
- Header H2 "Alertas Tempranas"; buttons "Ejecutar Motor" (→ ALR-03), "Exportar CSV".
- KPI row (4 cards): "Alertas Activas", "Resueltas", "Total Historico", "Severidad Alta" (active alta count).
- Charts: "Alertas por Tipo" **bar** (label "Alertas Activas"; x = type label, y = count; one colour per type) and "Alertas por Severidad" **doughnut** (Alta red, Media amber, Baja green).
- Card "Filtros" (GET): "Tipo de Alerta" ("Todos los tipos" + 6 labels), "Severidad" ("Todas", Alta, Media, Baja), "Estado" ("Todas", Activas=`false`, Resueltas=`true`); buttons "Filtrar", "Limpiar".
- Card "Listado de Alertas" (chip "{n} alertas"): table `alertsTable`: **ID**, **Estudiante** (name or "Desconocido"), **Tipo** (badge with type icon + label), **Severidad** (badge Alta/Media/Baja in red/amber/green), **Titulo** (truncated, tooltip full), **Fecha** (triggered_at), **Estado** (badge "Activa" / "Resuelta"), **Acciones** (eye "Ver detalle" → ALR-02).

#### ALR-02 Alert detail — "Alerta #{id}"

- Template `templates/alerts/detail.html`. Legacy `GET /alerts/{alert_id}`, `POST /alerts/{alert_id}/resolve`.
- Header "Alerta #{id}" with badges (severity, type, status "Activa"/"Resuelta"); "Volver al listado".
- Main card: title (H5) + description paragraph. Card "Informacion" (table): "Fecha Deteccion", "Tipo" (badge), "Severidad" (badge). If resolved, card "Resolucion": "Fecha Resolucion", "Resuelto Por" (name or "Desconocido"), "Notas".
- Side card "Estudiante": name (H6), document number, "Grado: {curso}" (link to student profile in prototype).
- If active: card "Resolver Alerta": textarea "Notas de Resolucion" (4 rows, placeholder "Describe las acciones tomadas para resolver esta alerta...") and button "Marcar como Resuelta"; if notes are empty a confirm dialog "No has agregado notas de resolucion. Deseas continuar de todas formas?". Effect: `resolved=true`, `resolved_at=now`, `resolved_by=current user`, `notes`.

#### ALR-03 Run alert engine — "Ejecutar Motor de Alertas"

- Template `templates/alerts/run_panel.html`. Legacy `GET|POST /alerts/run`.
- Header H2 "Ejecutar Motor de Alertas"; "Volver al listado".
- Card "Reglas del Motor de Alertas": table **Alerta** / **Condicion** / **Severidad** with the 6 rules of 2.2 (Riesgo Académico — promedio < 3.0 en cualquier materia — alta; Tendencia Negativa — bajó > 0.5 puntos entre periodos — media; Inasistencia Crítica — > 20% inasistencias en el mes — media; Grupo en Riesgo — > 30% del grupo pierde con el mismo profesor — alta; Riesgo de Deserción — ausencias + notas bajas combinadas — alta; Mejora Destacable — subió > 1.0 punto entre periodos — baja).
- Card "Ejecutar Todas las Reglas": text "Ejecuta las 6 reglas de alerta simultaneamente"; button "Ejecutar Motor Completo" (confirm "Se ejecutaran todas las reglas de alerta. Esto puede tomar unos segundos. Deseas continuar?").
- Card "Ejecutar Regla Individual": select "Seleccionar Regla" ("-- Selecciona una regla --" + 6 labels) + button "Ejecutar Regla".
- After POST, card "Resultados de la Ejecucion": one row per rule — success: label + badge "{n} alertas"; error: label + red message. Button "Ver Alertas Generadas" (→ ALR-01). The engine never duplicates an unresolved alert of the same type for a student.

### 3.14 Parent portal — "Portal de Acudientes" (PAR)

Blueprint prefix `/parent`. Role: parent only, and only for students linked through `ParentStudent` (otherwise redirected with an access error). Every child page has a **breadcrumb/tab strip**: "Portal" › "Notas" · "Asistencia" · "Observaciones" · "Boletines" · "Logros" (the current one highlighted), a title "{Sección} de {nombre del estudiante}" and a back button to the portal dashboard. Language here is mostly accent-free in the legacy copy; use proper accents in the prototype.

#### PAR-01 Portal dashboard — "Portal de Acudientes"

- Template `templates/parent/dashboard.html`. Legacy `GET /parent/dashboard` (also the default landing page of a parent). Sidebar item "Portal Padres".
- Header H1 "Portal de Acudientes", sub "Seguimiento academico de tus hijos".
- One **card per linked child**: avatar with initials (first letters of name and last name), name (H5), course ("Sin grado" fallback), campus name; 2 stats "Promedio General" (1 decimal or "N/A") and "Asistencia (30 dias)" ("{n}%"); if there are recent negative/convivencia observations, a block "Alertas Activas" listing up to 3 (type capitalised + first 60 chars of the description + "..."); a button row "Ver Notas" (PAR-02), "Asistencia" (PAR-03), "Observaciones" (PAR-04), "Boletines" (PAR-05), "Logros" (PAR-06); a mini table "Ultimas Notas - Periodo Actual": **Materia**, **Nota**, **Estado** (badge "Aprobado" green / "Reprobado" red / "No evaluado"); empty row "No hay notas registradas aun".
- Empty: "No hay estudiantes asignados / Contacta al administrador para vincular a tus hijos."

#### PAR-02 Child grades

- Template `templates/parent/grades.html`. Legacy `GET /parent/grades/{student_id}`.
- Header "Notas de {nombre}", sub "{curso} - Sede: {sede}"; KPI "Promedio General" (2 decimals) with badge "Aprobado"/"Reprobado"/"Sin notas" (>= 3.0 passes).
- Card "Escala de Calificacion": four chips 4.6–5.0 Superior, 4.0–4.5 Alto, 3.0–3.9 Basico, 1.0–2.9 Bajo.
- Card "Calificaciones por Periodo": table `gradesTable`: **Materia**, one column per period (`P1…P4`: score 1 decimal, coloured by band >= 4.0 / >= 3.0 / < 3.0, with a small trend arrow up/down/flat versus the previous period's score; "-" when none), **Estado** (last known period: "Aprobado"/"Reprobado"/"No evaluado"/"Sin notas"). Empty: "No hay notas registradas / Las notas apareceran cuando los profesores las registren."

#### PAR-03 Child attendance

- Template `templates/parent/attendance.html`. Legacy `GET /parent/attendance/{student_id}?month=&year=`.
- Header "Asistencia de {nombre}". **Month navigator**: "Anterior" | "{Mes} {año}" | "Siguiente".
- Card "Estadisticas del Mes": counters "Presentes", "Ausentes", "Justificados", "% Asistencia" (+progress bar). Card "Estadisticas del Ano ({año})": same four with "% Asistencia Anual".
- Card "Calendario - {Mes}": month grid with day headers Lun, Mar, Mie, Jue, Vie, Sab, Dom; each day cell shows the day number coloured by status (green Presente, red Ausente, amber Justificado, none = no record; tooltip "{d}/{m}: {estado o 'Sin registro'}"); legend "Presente / Ausente / Justificado".
- Charts: "Distribucion del Mes" **doughnut** (Presentes/Ausentes/Justificados: #198754/#dc3545/#ffc107) and "Asistencia Mensual - {año}" **grouped bar** by month with the same three series.
- Card "Historial Detallado": table `attendanceHistoryTable`: **Fecha**, **Estado** (badge Presente/Ausente/Justificado/Excusado), **Observacion**; empty row "No hay registros de asistencia".

#### PAR-04 Child observations

- Template `templates/parent/observations.html`. Legacy `GET /parent/observations/{student_id}?type=`.
- Header "Observaciones de {nombre}". Counters "Total", "Positivas", "Negativas", "Seguimiento" (= seguimiento + convivencia). Filter chips "**Filtrar:**" "Todas", "Positivas", "Negativas", "Seguimiento", "Convivencia".
- List of observation cards: coloured left bar by type, type label (Positiva/Negativa/Seguimiento/Convivencia), category badge, badge "Notificada"/"Pendiente", date `dd/mm/yyyy HH:MM`, description, "**Compromisos:** …" (if any), "Por: {autor}". Empty: "No hay observaciones registradas / Las observaciones apareceran cuando los profesores las registren."

#### PAR-05 Child report cards

- Template `templates/parent/report_cards.html`. Legacy `GET /parent/report-cards/{student_id}`.
- Header "Boletines de {nombre}", sub "{curso} - Sede: {sede}".
- One card per generated report card: period name, date range, badge "Entregado"/"Pendiente"; "Generado: dd/mm/yyyy", "Entregado: dd/mm/yyyy" (or N/A); "Observacion General" block (if any); table "Observaciones por Materia" (**Materia**, **Observacion**) if any; buttons "Descargar PDF" (when the PDF exists; opens RPT-04) and "Ver Notas" (PAR-02). Empty: "No hay boletines generados / Los boletines apareceran cuando sean generados por el sistema."

#### PAR-06 Child achievements

- Template `templates/parent/achievements.html`. Legacy `GET /parent/achievements/{student_id}`.
- Header H2 "Logros Obtenidos"; "Volver al Dashboard"; student strip: name, "{documento} | {curso}", chip "{n} logros obtenidos".
- Grid of earned achievements (emoji, name, description, "Obtenido el dd/mm/yyyy"). Empty: "Aún no hay logros obtenidos / Este estudiante aún no ha desbloqueado ningún logro."
- Card "Catálogo Completo de Logros": every achievement of the institution (name + description), earned ones highlighted with a check, unearned dimmed.

### 3.15 QR access — "Control de acceso por QR" (QR)

Blueprint prefix `/qr`. Each user has one active **QR token** (UUID) rendered as a QR code on their "carnet digital". A reader at a classroom/laboratory posts the token; the server checks that the user is allowed in that room _right now_ according to the schedule: teachers need an active `TeacherSubjectAssignment` for the subject-grade scheduled in that room at the current time; students need an active `StudentEnrollment` for it; root/admin/coordinator may enter anywhere. Timezone `America/Bogota`. Every attempt is logged. External scanner API (not a screen): `POST /qr/validate` JSON `{"labID": "<room code or name>", "qr": "<token>"}` → `{status: "success"|"unauthorized"|"error", labID, message, user_name}`; messages include "Token inválido o inactivo", "Ubicación no reconocida". Log statuses: `authorized` ("ÉXITO"), `wrong_schedule` ("HORARIO", out of schedule), `denied`/`invalid_token` ("ERROR").

#### QR-01 My QR code — "Identidad Digital"

- Template `templates/qr/my_qr.html`. Legacy `GET /qr/my-qr`, `POST /qr/regenerate`. Roles: any auth (sidebar "Mi Código QR").
- Card "Identidad Digital": large QR code generated from the token, green pill "Token Activo y Seguro", button "Descargar Carnet" (downloads the QR/carnet as image), button "Regenerar Código" (POST; confirm "¿Seguro que desea regenerar su QR? El código anterior dejará de funcionar instantáneamente."; success flash "Su código QR ha sido regenerado exitosamente.").
- Card "Actividad Reciente" (last 10 logs): table **Fecha y Hora**, **Ubicación**, **Estado** (badge "Autorizado" green / "Fuera de Horario" amber / "Denegado" red). Empty: "Aún no se registran escaneos con su código QR."
- Card "Instrucciones de Uso:" — "Presente este código en el lector ubicado a la entrada de cada salón o laboratorio." / "El acceso solo se habilitará durante su horario de clase programado." / "No comparta su código QR; cada acceso queda registrado a su nombre."

#### QR-02 Scan simulator — "Simulador de Hardware QR"

- Template `templates/qr/simulator.html`. Legacy `GET /qr/simulator`, `POST /qr/simulate-scan`. Roles: root only (not in the sidebar; reached from QR-03 button "Ir al Simulador").
- Header "Simulador de Hardware QR", sub "Herramienta de desarrollo - Solo ROOT".
- Form: "1. Seleccionar Ubicación (Lector)" select ("Seleccione un salón/laboratorio..." + "{nombre} ({código o 'Sin código'})"), "2. Token del Usuario (Simular Escaneo)" text (placeholder "Pegue el UUID del token aquí...", help 'Puede encontrar su propio token en la sección "Mi QR".'), button "Simular Pulso de Escaneo". Result flash: success "ÉXITO: {mensaje}" / danger "DENEGADO: {mensaje}".
- Card "¿Cómo funciona?": ordered list — emite una señal idéntica a la de un lector físico; el sistema valida el token contra el horario actual del servidor; se genera un registro en los logs de acceso.

#### QR-03 Access monitoring — "Monitoreo de Accesos QR"

- Template `templates/qr/validate.html`. Legacy `GET /qr/validate` (title "Registro de Accesos QR"). Roles: root, admin, coordinator (sidebar "Monitoreo QR").
- Header "Monitoreo de Accesos QR"; for root a button "Ir al Simulador" (QR-02).
- Table `logs-table` (latest 50 logs): **Timestamp** (`YYYY-MM-DD HH:MM:SS`), **Usuario** (name or "Anonimo"), **Rol** (badge or "N/A"), **Ubicación** (classroom name or "Desconocida"), **Estado** (badge "ÉXITO" green / "HORARIO" amber / "ERROR" red), **Mensaje**, **Origen** (IP or "---"; "SIM-…" for simulated scans).

### 3.16 Screen counts

| Module                          | Screens                                                                                                                                                                                                                                                     | IDs               |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| Authentication, profile, errors | 5 (4 pages + logout action)                                                                                                                                                                                                                                 | AUTH-01 … AUTH-05 |
| Dashboards                      | 7 (DASH-06 duplicates PAR-01)                                                                                                                                                                                                                               | DASH-01 … DASH-07 |
| Institution                     | 18                                                                                                                                                                                                                                                          | INS-01 … INS-18   |
| Users                           | 4                                                                                                                                                                                                                                                           | USR-01 … USR-04   |
| Matrícula y Programación        | 12                                                                                                                                                                                                                                                          | SCH-01 … SCH-12   |
| Students                        | 5                                                                                                                                                                                                                                                           | STU-01 … STU-05   |
| Grades                          | 8                                                                                                                                                                                                                                                           | GRD-01 … GRD-08   |
| Attendance                      | 4                                                                                                                                                                                                                                                           | ATT-01 … ATT-04   |
| Observations                    | 5                                                                                                                                                                                                                                                           | OBS-01 … OBS-05   |
| Report cards                    | 4 (incl. print view)                                                                                                                                                                                                                                        | RPT-01 … RPT-04   |
| Metrics                         | 7                                                                                                                                                                                                                                                           | MET-01 … MET-07   |
| Achievements                    | 3                                                                                                                                                                                                                                                           | ACH-01 … ACH-03   |
| Alerts                          | 3                                                                                                                                                                                                                                                           | ALR-01 … ALR-03   |
| Parent portal                   | 6                                                                                                                                                                                                                                                           | PAR-01 … PAR-06   |
| QR access                       | 3                                                                                                                                                                                                                                                           | QR-01 … QR-03     |
| **Total**                       | **94 distinct screens** (legacy has 104 template files: 7 error templates collapse into AUTH-05, 5 are dead/duplicate: `alerts.html`, `report_cards/view.html`, `dashboard/parent.html`, `macros/ui_components.html`, `grades/summary.html` duplicate half) |                   |

Note on counting: create/edit variants of one form are one screen; modals (campus manager, detail modal, delivery modal, award modal, change-password modal) are components of their parent screens, not separate screens.

---

## 4. Cross-screen flows

Notation: `SCREEN-ID → SCREEN-ID` = navigation or submit that moves the user; **[state]** = data change that other screens must reflect in the prototype's in-memory store.

### F1 — First login and forced password change (all roles)

1. AUTH-01 login with `username` (or email) + password. Newly created users have `password = document number` and `must_change_password = true`.
2. On success with `must_change_password` → AUTH-03 (cannot reach any other screen until done). Fill current password (the document number), new password (>= 6 chars, strength meter), confirm → submit enabled only when valid.
3. **[state]** `must_change_password = false`; redirect to the role dashboard (DASH-0x / PAR-01) with flash "✅ Contraseña actualizada exitosamente. Ahora puede acceder al sistema."
4. Later, password can be changed from AUTH-04 (Mi Perfil); root can reset anyone's password from INS-04 (modal) which re-arms the forced change.

### F2 — Root onboards an institution (root)

1. DASH-01 → "Nueva Institución" → INS-02: institution data **plus mandatory admin (rector)**; username preview updates live (initial + last name + last 4 doc digits).
2. **[state]** Institution + admin `User(role=admin)` created (initial password = document). Back to INS-01 / DASH-01 (new card appears with 0 students/0 teachers/1 admin/0 sedes).
3. DASH-01 card "Gestionar Sedes" or INS-03 sets the **active institution context** (root only; session value) → INS-07 → INS-08 create campuses (one flagged "Sede Principal").
4. INS-04 "Usuarios" to add more admins/staff (INS-05) or reset passwords.

### F3 — Academic setup of an institution (admin; coordinator can view)

Order matters because later screens read the earlier data:

1. INS-06 institution data (year "2026") → INS-07/08 campuses → INS-09/10 levels per campus → INS-11/12 courses (campus, level, director, year, shift, capacity).
2. INS-15/16 four periods with dates, exactly one "Activo"; INS-17/18 criteria whose weights should sum to 100 (default 20/20/30/30); INS-13/14 subjects.
3. USR-02 create teachers/coordinators; SCH-05/06 "Asignar Materias" (courses × subjects × hours/week × optional teacher) → **[state]** `SubjectGrade` rows; SCH-03/04 assign/reassign teachers (status activo/inactivo/temporal).
4. SCH-07/08 classrooms per campus; SCH-09/10 time blocks per campus/shift (with recesos) → SCH-12 "Generar Horario Automatico" (all campuses or one course) → **[state]** `Schedule` rows, result card "{n} clases asignadas, {m} conflictos" → SCH-11 weekly grid.
5. Students then flow in via F4.

### F4 — Student admission, guardians and enrollment (admin/coordinator)

1. Path A: STU-01 "Nuevo Estudiante" → STU-03 (creates `User(role=student)` + `AcademicStudent`; sede required, curso optional, health/contact data, guardian text fields). Path B: USR-02 with role student → then STU-01 shows the user under "Perfiles Académicos Incompletos" → "Completar" → STU-03 (complete mode, personal data prefilled & hidden). Path C: STU-05 bulk Excel (skips existing documents).
2. STU-02 profile → "Asignar Acudientes" → STU-04: pick an existing parent user (create via USR-02 role parent if missing), choose relationship (Acudiente/Padre/Madre/Tío/a/Abuelo/a/Hermano/a/Otro) → **[state]** `ParentStudent` link → the parent's PAR-01 now lists this child.
3. SCH-02 "Matricular Estudiantes": choose course → multi-select its students → **[state]** one `StudentEnrollment (activa)` per subject-grade of that course; SCH-01 lists them (filter by grade/subject/status; edit status to cancelada/retirada or set final score).
4. Status changes (STU-03 "Estado del Estudiante": activo/retirado/graduado) remove the student from grade sheets, attendance sheets, metrics and alert scans (they only consider `activo`).

### F5 — Grading cycle (teacher → coordinator/admin)

1. Teacher: DASH-04 "Gestión de Clases" → "Notas" or sidebar "Notas" → GRD-01: pick period (active highlighted) → pick course/subject row → "Ingresar Notas".
2. GRD-02: type scores 1.0–5.0 per student and criterion (+ optional observation). Live: row Final (weighted, re-normalised if not all criteria filled), Estado Ganada/Perdida, group averages. "Guardar Todas" → **[state]** `GradeRecord` upsert + `FinalGrade` recalculated, flash "Notas guardadas exitosamente.".
3. Optional bulk: GRD-03 upload (match by `documento`, columns per criterion; out-of-range rejected; locked grades not updated).
4. Review: GRD-07 resumen (KPIs, distribution histogram, per-criterion averages) and GRD-05 finals ("Recalcular Todas").
5. Close the period: GRD-02 "Guardar y Bloquear" (confirm) or GRD-04 (admin/coordinator pick subject-grade + period → Bloquear/Desbloquear). **[state]** `locked = true` → GRD-02 shows read-only values and a "Desbloquear" button.
6. Year end: GRD-06 annual table (P1–P4 + DEF + Aprobado/Reprobado).
7. Downstream: finals feed MET-_, ALR engine (ALR-03), ACH engine (ACH-01), report cards (RPT-_), parent portal (PAR-02) and student view (GRD-08).

### F6 — Take attendance (teacher/coordinator/admin)

1. DASH-04 "Asistencia" or sidebar → ATT-01 step 1: grade → subject (filtered) → date (default today) → "Continuar".
2. Step 2 roll sheet: counters update live; "Todos Presentes" then mark exceptions with the status buttons; optional observation per student; "Cargar" re-loads an existing day; "Solo Ausentes" filter; "Exportar" CSV.
3. "Guardar Asistencia" → **[state]** upsert `Attendance(student, subject-grade, date)`; success dialog "Asistencia Guardada".
4. Follow-ups: ATT-03 group summary (risk list > 20%), ATT-02 per-student history, ATT-04 range report (print/CSV). Absence rate > 20% in the last 30 days later raises an "Inasistencia Critica" alert (F9).

### F7 — Behaviour observation and guardian notification

1. From STU-01/STU-02 "Observación" → OBS-04 quick form, or OBS-01 "Nueva Observación" → OBS-03 (choose student, type, category, description, commitments, date).
2. **[state]** `Observation` created. If type is negativa or convivencia: flash "El director de grupo será notificado." and the item shows as "Pendiente" notification (required).
3. Coordinator/teacher marks "Marcar como Notificada" (OBS-01 row or OBS-02) → **[state]** `notified = true`.
4. Visibility: OBS-05 timeline per student; PAR-04 for the guardians (type filters); positive observations feed the "Compañero" achievement; negative/convivencia ones appear in the parent dashboard "Alertas Activas" block (PAR-01) and the coordinator dashboard recent list.

### F8 — Report card generation, review, delivery

1. RPT-01: individual (grade → student → period → "Generar Boletin") or bulk (grade + period → "Generar Todos los Boletines", progress bar, result modal Generated/Skipped/Errors). Requires: student has a course, the course has subjects, and the student has grades for that period.
2. **[state]** `ReportCard(student, period)` (unique) with PDF; RPT-01 table lists it (Pendiente). View → RPT-04 print preview; Download PDF.
3. Delivery: RPT-01 "Estado de entrega" modal → Entregado/Pendiente → **[state]** `delivery_status` (+ date). RPT-03 shows history per student; RPT-02 lets staff regenerate ("Regenerar") when grades change.
4. Guardian view: PAR-05 (generated date, delivered date, general observation, per-subject observations, "Descargar PDF").

### F9 — Early alerts lifecycle (coordinator/admin)

1. ALR-01 shows active/resolved KPIs and charts; "Ejecutar Motor" → ALR-03: run all 6 rules or one rule → results card "{n} alertas" per rule → **[state]** new `Alert` rows (never duplicating an unresolved alert of same student+type).
2. ALR-01 filter by type/severity/status → ALR-02 detail → read description/student → write "Notas de Resolucion" → "Marcar como Resuelta" → **[state]** `resolved=true`, resolver and timestamp; the sidebar badge count decreases.
3. Typical drill-down: alert → student profile (STU-02) → OBS-04 or conversation with guardian; MET-07 lists at-risk students by configurable threshold.

### F10 — Achievements

1. ACH-01 "Ejecutar Motor Automático" (all students) or ACH-02 "Ejecutar Motor" (one student) → **[state]** `StudentAchievement` rows for satisfied rules (excellence >= 4.5, perfect attendance, all subjects won, improvement >= 1.0, recovered subject, 3 consecutive periods >= 4.0 average, positive observation).
2. Manual award: ACH-01 card → modal (student, optional period) or ACH-02 quick award → duplicate for same period is rejected with a warning.
3. Consumption: ACH-02 student view, ACH-03 leaderboard (podium top 3), PAR-06 for guardians.

### F11 — QR access

1. Any user: QR-01 shows personal QR (token UUID) → "Descargar Carnet"; "Regenerar Código" invalidates the old token → **[state]** new active token.
2. A reader posts `{labID: classroom code, qr: token}` (prototype: QR-02 simulator for root; pick classroom + paste token) → server evaluates: token valid? room exists? user allowed in that room at this weekday/time (teacher assigned / student enrolled; staff always)? → **[state]** `QRAccessLog` with `authorized` / `wrong_schedule` / `denied` / `invalid_token`.
3. Monitoring: QR-03 table of latest 50 attempts; the user's own QR-01 "Actividad Reciente" shows their last 10.

### F12 — Parent journey

1. AUTH-01 → (F1 if first login) → PAR-01: one card per child with average, 30-day attendance %, recent negative observations, latest period grades.
2. Navigate with the tab strip: PAR-02 grades (per period, trend arrows), PAR-03 attendance (month navigator + calendar + charts), PAR-04 observations (type filter), PAR-05 report cards (download), PAR-06 achievements (earned + catalog).
3. Everything is read-only and limited to linked children; any other student id → access error.

### F13 — Metrics drill-down (admin/coordinator)

1. MET-01 KPIs → by-campus / by-grade tables → Top 10 / At-risk lists.
2. MET-02 heatmap (grade × subject failure %) → click a cell → detail modal. MET-03 trends (period averages, pass rate, monthly attendance). MET-04 anonymous teacher ranking. MET-05 per-teacher analytics (select a teacher) → MET-06 attendance-vs-grades scatter. MET-07 at-risk list with configurable threshold → STU-02. Export: MET-01 "Exportar Excel" (5 sheets).

### F14 — Teacher daily route (teacher)

DASH-04 (KPIs, performance table, "Sugerencias IA") → "Gestión de Clases" row → Notas (F5) / Asistencia (F6) / Observaciones (F7) → STU-01 (only own students) → MET-05 own analytics → SCH-11 own weekly schedule → QR-01.

### F15 — Student daily route (student)

DASH-05 (profile card, weekly schedule) → "Mis Notas" GRD-08 → "Mi Asistencia" ATT-02 → "Mis Observaciones" OBS-05 → achievements ACH-02 → QR-01. (Own data only.)

---

## 5. Suggested mock dataset

Goal: one consistent "as of" snapshot for the prototype. **Reference date: Monday 2026-10-05.** Academic year "2026". P1–P3 are finished (grades locked, report cards generated for P1–P2, P3 partially), **P4 is active** with partial data (so alerts, trends and "Activo" badges are visible).

### 5.1 Institution and campuses

| Field                    | Value                                                                                                                                                                                                                                               |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Institution              | "Colegio San José" — NIT 900.456.789-1 — Calle 45 # 12-30, Bogotá D.C., Cundinamarca — tel (601) 234 5678 — email contacto@colegiosanjose.edu.co — Resolución "Resolución No. 4821 del 14/03/2019 de la Secretaría de Educación" — año lectivo 2026 |
| Campus 1                 | "Sede Principal" — code SEDE-001 — Calle 45 # 12-30 — jornada completa — **principal** — activa                                                                                                                                                     |
| Campus 2                 | "Sede Norte" — code SEDE-002 — Carrera 15 # 128-40 — jornada mañana — secundaria — activa                                                                                                                                                           |
| (Optional 3rd, inactive) | "Sede Antigua" — SEDE-003 — inactiva (to show the "Inactiva" badge)                                                                                                                                                                                 |

### 5.2 Levels and groups (6 groups)

| Campus         | Level (orden) | Group | Jornada | Capacidad | Director       | Students |
| -------------- | ------------- | ----- | ------- | --------- | -------------- | -------- |
| Sede Principal | Sexto (6)     | 6-01  | Mañana  | 40        | Laura Martínez | 8        |
| Sede Principal | Sexto (6)     | 6-02  | Tarde   | 40        | Andrés Gómez   | 7        |
| Sede Principal | Séptimo (7)   | 7-01  | Mañana  | 40        | Carolina Ruiz  | 7        |
| Sede Principal | Once (11)     | 11-01 | Mañana  | 35        | Jorge Herrera  | 7        |
| Sede Norte     | Primero (1)   | 1-01  | Mañana  | 30        | Marcela Ortiz  | 6        |
| Sede Norte     | Quinto (5)    | 5-01  | Mañana  | 35        | Diego Salazar  | 5        |

Total active students: **40** (+1 "retirado" and 1 "graduado" extra records to show status badges, optional). Level `order_num` follows the grade number; groups in the same level/shift unique per (campus, name, year, shift).

### 5.3 Subjects (10)

| Code | Name               | Code | Name                     |
| ---- | ------------------ | ---- | ------------------------ |
| MAT  | Matemáticas        | TEC  | Tecnología e Informática |
| LEN  | Lengua Castellana  | ART  | Educación Artística      |
| CNA  | Ciencias Naturales | EDF  | Educación Física         |
| SOC  | Ciencias Sociales  | ETI  | Ética y Valores          |
| ING  | Inglés             | REL  | Educación Religiosa      |

Subject-grades: secondary groups (6-01, 6-02, 7-01, 11-01) take all 10 subjects; primary groups (1-01, 5-01) take 9 (no ETI duplicates; 1-01 without ING). Hours per week: MAT 5, LEN 5, CNA 4, SOC 3, ING 3, TEC 2, ART 2, EDF 2, ETI 1, REL 1 (= 28 h). Total ≈ 58 `SubjectGrade` rows.

### 5.4 Periods and criteria

| Period          | Short | Start      | End        | Active  | Status in mock                                                                        |
| --------------- | ----- | ---------- | ---------- | ------- | ------------------------------------------------------------------------------------- |
| Primer Periodo  | P1    | 2026-01-26 | 2026-04-03 | no      | closed, grades locked, report cards generated + entregado                             |
| Segundo Periodo | P2    | 2026-04-13 | 2026-06-19 | no      | closed, locked, report cards generated (most entregado)                               |
| Tercer Periodo  | P3    | 2026-07-13 | 2026-09-18 | no      | closed, locked, report cards generated pendiente                                      |
| Cuarto Periodo  | P4    | 2026-09-28 | 2026-12-04 | **yes** | open, only 2 of 4 criteria graded (Seguimiento, Formativo), attendance for first week |

Criteria (weights sum 100): "Seguimiento" 20% ("Tareas, quizzes, participación diaria", orden 1), "Formativo" 20% ("Trabajo en clase, talleres y actitud", 2), "Cognitivo" 30% ("Pruebas escritas, evaluaciones de conocimiento", 3), "Procedimental" 30% ("Proyectos, laboratorios y prácticas", 4).

### 5.5 Staff

**Admin/rector:** "Ricardo Alarcón" (admin). **Coordinators (2):** "Patricia Vargas" (Sede Principal), "Hernán Castaño" (Sede Norte). **Root:** "Administrador Root" (no institution). **Viewer:** "Consultor Secretaría" (viewer).

**Teachers (12)** and subjects taught (one teacher per subject-grade; a teacher teaches several groups):

| #   | Teacher          | Director of | Subjects (groups)                                     |
| --- | ---------------- | ----------- | ----------------------------------------------------- |
| 1   | Laura Martínez   | 6-01        | MAT (6-01, 6-02, 7-01)                                |
| 2   | Andrés Gómez     | 6-02        | LEN (6-01, 6-02, 7-01)                                |
| 3   | Carolina Ruiz    | 7-01        | CNA (6-01, 6-02, 7-01)                                |
| 4   | Jorge Herrera    | 11-01       | MAT (11-01), CNA (11-01)                              |
| 5   | Marcela Ortiz    | 1-01        | MAT, LEN, CNA, SOC, TEC (1-01)                        |
| 6   | Diego Salazar    | 5-01        | MAT, LEN, CNA, SOC (5-01)                             |
| 7   | Sandra Pardo     | —           | SOC (6-01, 6-02, 7-01), ETI (6-01, 6-02, 7-01, 11-01) |
| 8   | Felipe Mora      | —           | ING (all groups)                                      |
| 9   | Natalia Cárdenas | —           | TEC, ART (6-01, 6-02, 7-01, 11-01), TEC (5-01)        |
| 10  | Óscar Beltrán    | —           | EDF (all groups)                                      |
| 11  | Juliana Ríos     | —           | LEN (11-01), SOC (11-01), ART (1-01, 5-01)            |
| 12  | Mauricio Zapata  | —           | REL (all groups), ETI (1-01, 5-01)                    |

(Adjust freely, constraint: every `SubjectGrade` has exactly one teacher; no teacher is double-booked in the generated schedule.)

### 5.6 Classrooms and time blocks

Sede Principal classrooms: AULA-101…AULA-106 (aula, cap 40, edificio A, pisos 1–2), LAB-CIENCIAS (laboratorio, cap 30, edificio B, piso 1, resources `{"microscopios": 12, "proyector": true}`), SALA-SISTEMAS (laboratorio, cap 35, `{"computadoras": 30}`), AUD-PRINCIPAL (auditorio, cap 200), CANCHA-1 (cancha). Sede Norte: AULA-N01, AULA-N02, SALA-N-ARTES (aula), CANCHA-N.

Blocks (campus × shift Mañana, 2026): Bloque 1 06:30–07:30, Bloque 2 07:30–08:30, Recreo 08:30–09:00 (descanso), Bloque 3 09:00–10:00, Bloque 4 10:00–11:00, Almuerzo 11:00–11:30 (descanso), Bloque 5 11:30–12:30, Bloque 6 12:30–13:30. Shift Tarde (Sede Principal, 6-02): Bloque 1 13:00–14:00, Bloque 2 14:00–15:00, Recreo 15:00–15:20, Bloque 3 15:20–16:20, Bloque 4 16:20–17:20, Bloque 5 17:20–18:20. `order_num` 1..n.

Seed the weekly `Schedule` so that every course has all its subject hours Monday–Friday without conflicts (generate programmatically; keep the "Generar Horario" screen able to show "{n} clases asignadas, 0 conflictos").

### 5.7 Users, students and guardians

- **Credential convention:** username = first-name initial + last name (lowercase, no accents) + last 4 digits of document (e.g. `lmartinez4410`); initial password = document number; for the prototype set `must_change_password = false` for all except two demo users (`demo.primer.login` teacher, `jlopez0001` student) to show AUTH-03. Quick-login shortcuts per role (document-based password omitted): `root`, `ralarcon…` (admin), `pvargas…` (coordinator), `lmartinez…` (teacher), `a student of 6-01` (student), `a parent` (parent), `viewer` (viewer).
- **Students (40):** document types TI (ages 10–17), RC for 1-01 (ages 6–7), CC for 11-01 adults >= 18 optional. Ages: 1-01: 6–7, 5-01: 10–11, 6-01/6-02: 11–12, 7-01: 12–13, 11-01: 16–17. Fill `neighborhood` (Chapinero, Usaquén, Suba, Engativá, Kennedy…), `stratum` 2–5, `blood_type` (O+, A+, B+, O-, AB+), `eps` (Sanitas, Compensar, Nueva EPS, Sura, Salud Total), guardian text fields consistent with the linked parent.
- **Guardians (~26 parent users):** most students have 1 linked parent; 8 students have 2 (Madre + Padre/Tío); **3 parents have 2 children** (siblings in different groups, e.g. one in 1-01 and one in 6-01) to show the multi-child card layout in PAR-01. Relationship labels from the select (Madre, Padre, Acudiente, Tío/a, Abuelo/a).
- **Featured students (storylines used by alerts/achievements/metrics)** — give them realistic Colombian names:

| Student                           | Group | Storyline                                                                                                                                                                                    |
| --------------------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Valentina Rojas Pineda            | 11-01 | Excelente: finals 4.6–5.0 in P1–P3; achievements Excelencia, Todo Terreno, Constancia (3 periods >= 4.0), Asistencia Perfecta; top of leaderboard and MET-01 Top 10                          |
| Santiago Duarte Mejía             | 7-01  | Riesgo académico: Matemáticas 2.4 (P2), 2.1 (P3), Ciencias 2.7, overall average ≈ 2.6; alert "Riesgo Academico" (alta) active; 3 failed subjects; in MET-07 badge "Alerta" (2.0 ≤ avg < 3.0) |
| Mariana López Sánchez             | 6-01  | Tendencia negativa: Lengua 4.2 → 3.5 (P2→P3), alert "Tendencia Negativa" (media), resolved with notes in the past + a new one active                                                         |
| Samuel Torres Quintero            | 6-02  | Inasistencia crítica: 28% absences in last 30 days (mix of ausente and justificado), alert "Inasistencia Critica" (media)                                                                    |
| Isabella Gómez Herrera            | 5-01  | Mejora destacable: Matemáticas 2.8 (P2) → 4.0 (P3); achievements Superador, Resiliente; alert "Mejora Destacable" (baja)                                                                     |
| Mateo Ramírez Cruz                | 11-01 | Riesgo de deserción: low grades (avg 2.8) + 22% absences; alert "Riesgo de Desercion" (alta); several negative observations and compromisos                                                  |
| Sofía Castro Vega                 | 1-01  | Perfect attendance + positive observations; achievement Compañero, Asistencia Perfecta                                                                                                       |
| Juan David Pérez Ortiz            | 6-01  | Convivencia observations (2) pending notification                                                                                                                                            |
| Camila Fernanda Ruiz Mora         | 7-01  | Her mother is also guardian of her brother Tomás Ruiz Mora (1-01) → multi-child card in PAR-01; all report cards delivered                                                                   |
| Extra record: Esteban Vélez Arias | 6-02  | status `retirado` (and one `graduado` record) to demo the status filters in STU-01                                                                                                           |

Also include a **group at risk** story: 6-02 Matemáticas (teacher Laura Martínez) with 36% failing in P3 → alert "Grupo en Riesgo" (alta) and a teacher-dashboard "Alerta Crítica" action plan; plus a disparity > 0.7 between 6-01 and 6-02 in MAT to trigger "Disparidad en MAT".

### 5.8 Grades, finals, annual (generate programmatically)

- Per student: `ability ~ N(3.8, 0.55)` clamped 2.0–4.9; per subject offset in [−0.4, +0.4]; per criterion noise in [−0.3, +0.3]; round to 0.1; clamp 1.0–5.0. Override featured students per 5.7.
- `GradeRecord`: students × subject-grades × criteria × closed periods = approx 40 × 8–10 × 4 × 3 ≈ 4,000 rows; P4: Seguimiento + Formativo only. All P1–P3 records `locked = true`; P4 `locked = false`. `created_by` = the subject-grade teacher. A few records with an observation text ("Entregó el taller incompleto", "Excelente participación").
- `FinalGrade`: computed with the weights; `ganada` if >= 3.0. For P4 compute with re-normalisation (only 40% weight applied). `AnnualGrade` only for the previous year-like preview (optional): mean of P1–P3 until P4 closes.
- Targets: institutional average ≈ 3.8; pass rate ≈ 88%; ~4 students at risk (avg < 3.0); distribution in 1.0–1.9: 1%, 2.0–2.9: 11%, 3.0–3.9: 33%, 4.0–4.9: 50%, 5.0: 5%.

### 5.9 Attendance

- Sessions: for each subject-grade, ~10 sessions per month since August; P4 first week recorded. Per-session status mix: presente 91%, ausente 5%, justificado 3%, excusado 1%. `recorded_by` = the teacher. Dates only Monday–Friday.
- Overrides per 5.7 (Samuel 28% absences in the last 30 days; Mateo 22%; Sofía and Valentina 0 absences in P3).

### 5.10 Observations (~35)

Mix: 14 positiva (category Valores/Participación/Rendimiento: "Lideró el trabajo en equipo con respeto y creatividad"), 10 negativa (Disciplina/Responsabilidad: "Interrumpió la clase en repetidas ocasiones"), 7 seguimiento (Rendimiento: "Se acordó plan de refuerzo en Matemáticas"), 4 convivencia (Convivencia: "Discusión con compañero durante el descanso"). Authors: teachers and coordinators; `notified = true` for 70% (all older than 2 weeks), pending for the latest negativa/convivencia ones; some with `commitments` ("El estudiante se compromete a entregar los talleres pendientes antes del viernes").

### 5.11 Alerts (~10)

Active (6): Riesgo Academico (Santiago, alta), Inasistencia Critica (Samuel, media), Grupo en Riesgo (6-02 MAT, alta — attached to the lowest-scoring student of the group), Riesgo de Desercion (Mateo, alta), Tendencia Negativa (Mariana, media), Mejora Destacable (Isabella, baja). Resolved (4): earlier alerts with `resolved_by` coordinator and notes ("Se citó al acudiente; acordó plan de refuerzo"). Sidebar badge = 6.

### 5.12 Achievements

Catalog = the 7 rule-based achievements of 2.2 (icon emoji, category). `StudentAchievement` ≈ 25 rows spread over P1–P3 (awarded_by null for engine-awarded; two manually awarded by the coordinator). Leaderboard top 3: Valentina (5), another 11-01/7-01 student (4), Sofía or Isabella (3).

### 5.13 Report cards

P1: 40 generated, 40 entregado (delivery dates in April). P2: 40 generated, 34 entregado / 6 pendiente. P3: 40 generated, 0–3 entregado. P4: none. Each has a `general_observation` (director's remark) and 2–6 `ReportCardObservation` rows (teacher comments per subject). `pdf_path` present for all (prototype can point to a static sample PDF/print view RPT-04).

### 5.14 Enrollments, assignments and QR

- `StudentEnrollment (activa)` for every student × the subject-grades of their group for 2026 (≈ 40 × 9 = 360 rows); 2 `cancelada`/`retirada` rows to show filters; `final_score` filled for closed periods optional.
- `TeacherSubjectAssignment (activo)` for every subject-grade; 1 `temporal` (substitute) and 1 `inactivo`.
- `QRToken` for every user (UUID v4); `QRAccessLog` ≈ 40 rows over the last week, mix: 70% `authorized`, 15% `wrong_schedule` ("Fuera de horario de clase"), 10% `denied` ("Ubicación no reconocida"), 5% `invalid_token`; origins "192.168.1.x" and a few "SIM-127.0.0.1" from root.

### 5.15 Volume summary

| Entity                                       | Count                                                                                    |
| -------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Institution / Campuses                       | 1 / 2 (+1 inactive)                                                                      |
| Levels / Groups                              | 5 / 6                                                                                    |
| Subjects / SubjectGrades                     | 10 / ≈ 58                                                                                |
| Periods / Criteria                           | 4 / 4                                                                                    |
| Users                                        | ≈ 82 (1 root, 1 admin, 2 coordinators, 12 teachers, 40 students, ≈ 26 parents, 1 viewer) |
| Classrooms / Blocks                          | ≈ 15 / ≈ 14                                                                              |
| Schedules                                    | ≈ 8 per day per group ≈ 240                                                              |
| GradeRecords / FinalGrades                   | ≈ 4,000 / ≈ 1,100                                                                        |
| Attendance rows                              | ≈ 12,000 (can be reduced to the last 8 weeks)                                            |
| Observations / Alerts / Achievements awarded | ≈ 35 / ≈ 10 / ≈ 25                                                                       |
| ReportCards                                  | ≈ 120                                                                                    |
| QR logs                                      | ≈ 40                                                                                     |

Tip for the frontend dev: generate the heavy tables (grades, attendance, enrollments, schedules) with a seeded PRNG at load time from the compact definitions above, and hand-author only institutions, campuses, groups, subjects, staff, featured students, observations, alerts and achievements so the storylines stay deterministic.

### 5.16 Legacy quirks to avoid in the prototype (summary)

1. Student sidebar shows "Asistencia" and "Logros" but the routes forbid students → give students their own entries (see 1.2).
2. Teacher sidebar "Métricas" points to a forbidden page → route teachers to MET-05.
3. Coordinator dashboard shows 0 for Profesores/Grados/Asignaturas (route does not supply them) → populate.
4. Enrollment list headers Materia/Grado are swapped in the cells.
5. Report-range attendance report has no date picker; schedule list has no course filter although the route supports one.
6. Mixed accent-free and accented Spanish across modules → use proper Spanish everywhere.
7. Initial password rules differ (users: document number; students created via STU-03/STU-05: `estudiante123`) → unify on document number.
8. Parent dashboard exists twice (`dashboard/parent.html` vs `parent/dashboard.html`) → build only PAR-01.
9. Leaderboard (ACH-03) is not linked from the sidebar → expose it as a tab inside "Logros".

---

## Appendix A — Spanish domain vocabulary (use verbatim in the prototype UI)

| Term                                                      | Meaning / usage                                                                                                                                     |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Institución (educativa)                                   | School / tenant; "Rector(a)" is the head, represented by the `admin` role                                                                           |
| Sede                                                      | Campus; "Sede Principal" flagged `is_main_campus`                                                                                                   |
| Jornada                                                   | Shift: Mañana, Tarde, Nocturna, Única, Sabatina; campuses also "Completa"                                                                           |
| Nivel académico                                           | Level/grade-year: Transición, Primero … Once                                                                                                        |
| Grado / Curso / Grupo                                     | A concrete class group like "6-01" or "11°B" (legacy uses "Grado" in titles and "Cursos" in the sidebar)                                            |
| Director de Grupo                                         | Homeroom teacher of a course                                                                                                                        |
| Asignatura / Materia                                      | Subject; "Materias por Grado" = subjects offered per course; "Intensidad horaria" = hours per week                                                  |
| Periodo (académico)                                       | One of 4 terms (P1–P4); "Año lectivo" = school year                                                                                                 |
| Criterios de evaluación                                   | Weighted grading components: Seguimiento, Formativo, Cognitivo, Procedimental                                                                       |
| Planilla de calificaciones                                | Grade sheet (student × criterion matrix)                                                                                                            |
| Nota / Nota final / Definitiva (DEF)                      | Score / period final score / annual score                                                                                                           |
| Ganada / Perdida                                          | Subject passed / failed in a period (>= 3.0 / < 3.0)                                                                                                |
| Aprobado / Reprobado                                      | Annual result                                                                                                                                       |
| Desempeño: Superior, Alto, Básico, Bajo                   | Performance level of a score                                                                                                                        |
| Boletín                                                   | Report card (per student and period); "Entregado / Pendiente" delivery                                                                              |
| Matrícula                                                 | Enrollment of a student in a subject-of-a-course; "Matricular"                                                                                      |
| Acudiente                                                 | Parent / guardian (role `parent`); "Parentesco" = relationship                                                                                      |
| Asistencia: Presente, Ausente, Justificado, Excusado      | Attendance statuses; "Inasistencia" = absence                                                                                                       |
| Observación: Positiva, Negativa, Seguimiento, Convivencia | Behaviour record types; "Compromisos" = commitments                                                                                                 |
| Alerta Temprana                                           | Early warning raised by rules (Riesgo Académico, Tendencia Negativa, Inasistencia Crítica, Grupo en Riesgo, Riesgo de Deserción, Mejora Destacable) |
| Logro                                                     | Achievement/badge (Superador, Excelencia, Asistencia Perfecta, Todo Terreno, Resiliente, Constancia, Compañero)                                     |
| Salón / Aula / Laboratorio / Auditorio / Cancha           | Classroom types                                                                                                                                     |
| Bloque horario / Recreo / Almuerzo                        | Time block; breaks are non-teaching blocks                                                                                                          |
| Horario                                                   | Weekly timetable (Lunes–Viernes)                                                                                                                    |
| Mapa de calor                                             | Heatmap (failure % by course × subject)                                                                                                             |
| Tipo de documento: TI, CC, RC, CE, Pasaporte              | ID types; "NIT" = institution tax ID; "EPS" = health provider; "Estrato" = socio-economic stratum 1–6; "Barrio/Vereda" = neighbourhood              |
| Resolución de aprobación                                  | Official school license resolution text                                                                                                             |

## Appendix B — Suggested TypeScript data contracts (derived from the models)

```ts
type Role = "root" | "admin" | "coordinator" | "teacher" | "student" | "parent" | "viewer";
type Shift = "Mañana" | "Tarde" | "Nocturna" | "Única" | "Sabatina";
type CampusJornada = "manana" | "tarde" | "completa";
type DocType = "TI" | "CC" | "RC" | "CE" | "Pasaporte";
type StudentStatus = "activo" | "retirado" | "graduado";
type FinalStatus = "ganada" | "perdida" | "no evaluado";
type AnnualStatus = "aprobado" | "reprobado" | "no evaluado";
type AttendanceStatus = "presente" | "ausente" | "justificado" | "excusado";
type ObservationType = "positiva" | "negativa" | "seguimiento" | "convivencia";
type AlertType =
  | "riesgo_academico"
  | "tendencia_negativa"
  | "inasistencia_critica"
  | "grupo_riesgo"
  | "riesgo_desercion"
  | "mejora_destacable";
type Severity = "alta" | "media" | "baja";
type EnrollmentStatus = "activa" | "cancelada" | "retirada";
type AssignmentStatus = "activo" | "inactivo" | "temporal";
type ClassroomType = "aula" | "laboratorio" | "auditorio" | "cancha";
type DeliveryStatus = "pendiente" | "entregado";
type QRLogStatus = "authorized" | "denied" | "invalid_token" | "wrong_schedule";
type PerformanceLevel = "Superior" | "Alto" | "Básico" | "Bajo";

interface Institution {
  id: number;
  name: string;
  nit?: string;
  address?: string;
  phone?: string;
  email?: string;
  logo?: string;
  municipality?: string;
  department?: string;
  resolution?: string;
  academicYear: string;
  createdAt: string;
}
interface Campus {
  id: number;
  institutionId: number;
  name: string;
  code?: string;
  address?: string;
  jornada: CampusJornada;
  isMainCampus: boolean;
  active: boolean;
  createdAt: string;
}
interface GradeLevel {
  id: number;
  campusId: number;
  name: string;
  orderNum: number;
}
interface Grade {
  id: number;
  campusId: number;
  levelId?: number;
  directorId?: number;
  name: string;
  academicYear: string;
  shift: Shift;
  maxStudents: number;
}
interface Subject {
  id: number;
  institutionId: number;
  name: string;
  code?: string;
}
interface SubjectGrade {
  id: number;
  subjectId: number;
  gradeId: number;
  teacherId: number;
  hoursPerWeek: number;
}
interface AcademicPeriod {
  id: number;
  institutionId: number;
  name: string;
  shortName: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  academicYear: string;
  order: number;
}
interface GradeCriteria {
  id: number;
  institutionId: number;
  name: string;
  weight: number;
  description?: string;
  order: number;
}
interface User {
  id: number;
  username: string;
  email?: string;
  firstName: string;
  lastName: string;
  documentType: DocType;
  documentNumber: string;
  birthDate?: string;
  gender?: "M" | "F" | "Otro";
  phone?: string;
  address?: string;
  country?: string;
  department?: string;
  municipality?: string;
  role: Role;
  institutionId?: number;
  photo?: string;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLogin?: string;
  createdAt: string;
}
interface AcademicStudent {
  id: number;
  userId: number;
  institutionId: number;
  campusId: number;
  gradeId?: number;
  neighborhood?: string;
  stratum?: 1 | 2 | 3 | 4 | 5 | 6;
  bloodType?: string;
  eps?: string;
  guardianName?: string;
  guardianPhone?: string;
  guardianEmail?: string;
  enrolledYear?: string;
  status: StudentStatus;
}
interface ParentStudent {
  id: number;
  parentId: number;
  studentId: number;
  relationship: string;
}
interface StudentEnrollment {
  id: number;
  studentId: number;
  subjectGradeId: number;
  academicYear: string;
  enrollmentDate: string;
  status: EnrollmentStatus;
  finalScore?: number;
  statusNote?: string;
}
interface TeacherSubjectAssignment {
  id: number;
  subjectGradeId: number;
  teacherId: number;
  academicYear: string;
  assignmentDate: string;
  status: AssignmentStatus;
  notes?: string;
}
interface Classroom {
  id: number;
  campusId: number;
  name: string;
  code?: string;
  capacity: number;
  floor: number;
  building?: string;
  classroomType: ClassroomType;
  resources?: string;
}
interface ScheduleBlock {
  id: number;
  campusId: number;
  name: string;
  startTime: string;
  endTime: string;
  isBreak: boolean;
  orderNum: number;
  shift: Shift;
  academicYear: string;
}
interface Schedule {
  id: number;
  subjectGradeId: number;
  classroomId: number;
  dayOfWeek: 0 | 1 | 2 | 3 | 4;
  startTime: string;
  endTime: string;
  academicYear: string;
  isActive: boolean;
}
interface GradeRecord {
  id: number;
  studentId: number;
  subjectGradeId: number;
  periodId: number;
  criterionId: number;
  score: number;
  observation?: string;
  createdBy: number;
  locked: boolean;
}
interface FinalGrade {
  id: number;
  studentId: number;
  subjectGradeId: number;
  periodId: number;
  finalScore: number;
  status: FinalStatus;
  observation?: string;
  calculatedAt: string;
}
interface AnnualGrade {
  id: number;
  studentId: number;
  subjectGradeId: number;
  academicYear: string;
  annualScore: number;
  status: AnnualStatus;
}
interface Attendance {
  id: number;
  studentId: number;
  subjectGradeId: number;
  date: string;
  status: AttendanceStatus;
  observation?: string;
  recordedBy: number;
}
interface Observation {
  id: number;
  studentId: number;
  authorId: number;
  type: ObservationType;
  category?: string;
  description: string;
  date: string;
  commitments?: string;
  notified: boolean;
}
interface Alert {
  id: number;
  studentId: number;
  alertType: AlertType;
  severity: Severity;
  title: string;
  description: string;
  triggeredAt: string;
  resolved: boolean;
  resolvedAt?: string;
  resolvedBy?: number;
  notes?: string;
}
interface Achievement {
  id: number;
  institutionId?: number;
  name: string;
  description: string;
  icon: string;
  criteria: string;
  category: "académico" | "mejora" | "asistencia" | "comportamiento";
  isActive: boolean;
}
interface StudentAchievement {
  id: number;
  studentId: number;
  achievementId: number;
  earnedAt: string;
  periodId?: number;
  awardedBy?: number;
}
interface ReportCard {
  id: number;
  studentId: number;
  periodId: number;
  generatedAt: string;
  pdfPath?: string;
  generalObservation?: string;
  generatedBy: number;
  deliveryStatus: DeliveryStatus;
  deliveryDate?: string;
}
interface ReportCardObservation {
  id: number;
  reportCardId: number;
  subjectGradeId: number;
  observation: string;
}
interface QRToken {
  id: number;
  userId: number;
  token: string;
  isActive: boolean;
  createdAt: string;
  lastUsedAt?: string;
}
interface QRAccessLog {
  id: number;
  userId?: number;
  classroomId?: number;
  timestamp: string;
  status: QRLogStatus;
  message?: string;
  ipAddress?: string;
}
```

Core calculations to implement as pure functions: `finalScore(records, criteria)` (weighted, re-normalised when partial, clamp 1–5, round 2), `statusFromScore(score)` (>= 3.0 ganada), `performanceLevel(score)` (>= 4.6 / 4.0 / 3.0), `scoreClass(score)` (4.5 / 4.0 / 3.0 / 2.0), `absenceBand(rate)` (> 20 crítico, > 10 atención), `annualScore(periodFinals)` (mean), `alertRules` (table in 2.2), `achievementRules` (table in 2.2).

## Appendix C — Screen × role matrix

Legend: ● full access (incl. create/edit where the screen has them), ○ read-only / own data only, – no access. Roles: R root, A admin, C coordinator, T teacher, S student, P parent, V viewer. "Edit" distinctions are noted in the screen sections.

| Screen                                                      | R   | A   | C   | T                           | S       | P                        | V   |
| ----------------------------------------------------------- | --- | --- | --- | --------------------------- | ------- | ------------------------ | --- |
| AUTH-01…05                                                  | ●   | ●   | ●   | ●                           | ●       | ●                        | ●   |
| DASH-01 root                                                | ●   | –   | –   | –                           | –       | –                        | –   |
| DASH-02 admin                                               | ●   | ●   | –   | –                           | –       | –                        | –   |
| DASH-03 coordinator                                         | –   | –   | ●   | –                           | –       | –                        | –   |
| DASH-04 teacher                                             | –   | –   | –   | ●                           | –       | –                        | –   |
| DASH-05 student                                             | –   | –   | –   | –                           | ●       | –                        | –   |
| DASH-07 viewer                                              | –   | –   | –   | –                           | –       | –                        | ●   |
| INS-01…05 (institutions, switch, users)                     | ●   | –   | –   | –                           | –       | –                        | –   |
| INS-06 institution data                                     | ●   | ●   | –   | –                           | –       | –                        | –   |
| INS-07/09/11/15 (lists: campuses, levels, courses, periods) | ●   | ●   | ○   | –                           | –       | –                        | –   |
| INS-08/10/12/16 (forms)                                     | ●   | ●   | –   | –                           | –       | –                        | –   |
| INS-13/17 (lists: subjects, criteria)                       | ●   | ●   | ○   | ○                           | –       | –                        | –   |
| INS-14/18 (forms)                                           | ●   | ●   | –   | –                           | –       | –                        | –   |
| USR-01…04                                                   | ●   | ●   | –   | –                           | –       | –                        | –   |
| SCH-01…10, SCH-12                                           | ●   | ●   | ●   | –                           | –       | –                        | –   |
| SCH-11 weekly schedule                                      | ●   | ●   | ●   | ○ (own)                     | ○ (own) | –                        | –   |
| STU-01, STU-02                                              | ●   | ●   | ●   | ○ (read)                    | –       | –                        | –   |
| STU-03…05                                                   | ●   | ●   | ●   | –                           | –       | –                        | –   |
| GRD-01…03, 05…07                                            | ●   | ●   | ●   | ● (own subject-grades)      | –       | –                        | –   |
| GRD-04 lock panel                                           | ●   | ●   | ●   | –                           | –       | –                        | –   |
| GRD-08 student grades                                       | ●   | ●   | ●   | ●                           | ○ (own) | ○ (children)             | –   |
| ATT-01…04                                                   | ●   | ●   | ●   | ● (own)                     | –       | –                        | –   |
| OBS-01…05                                                   | ●   | ●   | ●   | ● (own students; no delete) | –       | –                        | –   |
| RPT-01 management                                           | ●   | ●   | ●   | –                           | –       | –                        | –   |
| RPT-02/03                                                   | ●   | ●   | ●   | ●                           | ○ (own) | –                        | –   |
| RPT-04 document                                             | ●   | ●   | ●   | –                           | ○ (own) | ○ (via PAR-05)           | –   |
| MET-01…04                                                   | ●   | ●   | ●   | –                           | –       | –                        | –   |
| MET-05, MET-06                                              | ●   | ●   | ●   | ● (own)                     | –       | –                        | –   |
| MET-07                                                      | ●   | ●   | ●   | ● (own)                     | –       | –                        | –   |
| ACH-01                                                      | ●   | ●   | ●   | ○ (read)                    | –       | –                        | –   |
| ACH-02, ACH-03                                              | ●   | ●   | ●   | ○                           | ○ (own) | ○ (children, via PAR-06) | –   |
| ALR-01…03                                                   | ●   | ●   | ●   | –                           | –       | –                        | –   |
| PAR-01…06                                                   | –   | –   | –   | –                           | –       | ●                        | –   |
| QR-01 my QR                                                 | ●   | ●   | ●   | ●                           | ●       | ●                        | ●   |
| QR-02 simulator                                             | ●   | –   | –   | –                           | –       | –                        | –   |
| QR-03 monitoring                                            | ●   | ●   | ●   | –                           | –       | –                        | –   |
