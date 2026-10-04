import {
  BackButton,
  FormCard,
  FormLayout,
  HelpCard,
  HelpList,
} from "../../-components/form-layout";
import { SelectField, TextField } from "../../-components/form-fields";
import { NotFoundBlock } from "../../-components/not-found-block";
import { ScopedPage } from "../../-components/scoped-page";
import { useGoToScreen } from "../../-lib/use-go-to-screen";
import { useSimpleForm, type FormErrors } from "../../-lib/use-form";
import { useIdParam } from "../../-lib/use-search-params";
import {
  ACADEMIC_YEAR,
  campusStore,
  fullName,
  gradeLevelStore,
  gradeStore,
  mockAction,
  useMockCollection,
  userStore,
} from "../../-mock";
import type { Grade, Institution, Shift } from "../../-mock/types";

const SHIFTS: readonly Shift[] = ["Mañana", "Tarde", "Nocturna", "Única", "Sabatina"];
const SHIFT_OPTIONS = SHIFTS.map((shift) => ({ value: shift, label: shift }));

interface Values {
  name: string;
  campusId: string;
  levelId: string;
  directorId: string;
  academicYear: string;
  shift: string;
  maxStudents: string;
}

function toShift(value: string): Shift {
  return SHIFTS.find((shift) => shift === value) ?? "Mañana";
}

/** INS-12: create or edit a course. */
export function CourseFormScreen() {
  const id = useIdParam();
  const gradeList = useMockCollection(gradeStore);
  const campusList = useMockCollection(campusStore);
  const existing = id === undefined ? undefined : gradeList.find((grade) => grade.id === id);

  return (
    <ScopedPage
      screenId="INS-12"
      title={id === undefined ? "Nuevo Grado" : "Editar Grado"}
      description="Grupo específico de estudiantes en un año lectivo y sede"
      actions={<BackButton screenId="INS-11" />}
      target="Grados"
    >
      {(institution) => {
        const own =
          existing &&
          campusList.some(
            (campus) => campus.id === existing.campusId && campus.institutionId === institution.id,
          );
        return id !== undefined && !own ? (
          <NotFoundBlock entity="El grado" backScreenId="INS-11" />
        ) : (
          <CourseForm key={existing?.id ?? "new"} institution={institution} grade={existing} />
        );
      }}
    </ScopedPage>
  );
}

function CourseForm({ institution, grade }: { institution: Institution; grade?: Grade }) {
  const campusList = useMockCollection(campusStore);
  const levelList = useMockCollection(gradeLevelStore);
  const gradeList = useMockCollection(gradeStore);
  const userList = useMockCollection(userStore);
  const goTo = useGoToScreen();

  const campuses = campusList.filter((campus) => campus.institutionId === institution.id);
  const teachers = userList.filter(
    (user) => user.role === "teacher" && user.institutionId === institution.id,
  );

  const form = useSimpleForm<Values>(
    {
      name: grade?.name ?? "",
      campusId: grade ? String(grade.campusId) : "",
      levelId: grade?.levelId ? String(grade.levelId) : "",
      directorId: grade?.directorId ? String(grade.directorId) : "",
      academicYear: grade?.academicYear ?? ACADEMIC_YEAR,
      shift: grade?.shift ?? "Mañana",
      maxStudents: String(grade?.maxStudents ?? 40),
    },
    (values) => {
      const errors: FormErrors<Values> = {};
      const name = values.name.trim();
      if (!name) errors.name = "El nombre del grado es obligatorio.";
      if (!values.campusId) errors.campusId = "Debes seleccionar una sede.";
      if (!values.academicYear.trim()) errors.academicYear = "El año lectivo es obligatorio.";
      const capacity = Number(values.maxStudents);
      if (!Number.isInteger(capacity) || capacity < 1 || capacity > 60) {
        errors.maxStudents = "La capacidad debe estar entre 1 y 60.";
      }
      if (
        name &&
        values.campusId &&
        gradeList.some(
          (entry) =>
            entry.id !== grade?.id &&
            String(entry.campusId) === values.campusId &&
            entry.name.toLowerCase() === name.toLowerCase() &&
            entry.academicYear === values.academicYear.trim() &&
            entry.shift === values.shift,
        )
      ) {
        errors.name = "Ya existe un grado con la misma sede, nombre, año y jornada.";
      }
      return errors;
    },
  );

  // Levels offered depend on the chosen campus (legacy client-side filter).
  const levels = levelList.filter((level) => String(level.campusId) === form.values.campusId);

  const submit = form.handleSubmit((values) => {
    const levelId = levels.some((level) => String(level.id) === values.levelId)
      ? Number(values.levelId)
      : undefined;
    const data = {
      name: values.name.trim(),
      campusId: Number(values.campusId),
      levelId,
      directorId: values.directorId ? Number(values.directorId) : undefined,
      academicYear: values.academicYear.trim(),
      shift: toShift(values.shift),
      maxStudents: Number(values.maxStudents),
    };
    if (grade) gradeStore.update(grade.id, data);
    else gradeStore.add(data);
    mockAction(
      grade ? "Grado actualizado" : "Grado creado",
      "Los cambios no se guardan en el prototipo.",
    );
    goTo("INS-11");
  });

  return (
    <FormLayout
      form={
        <FormCard
          title="Datos del Grado"
          onSubmit={submit}
          submitLabel={grade ? "Actualizar Grado" : "Crear Grado"}
          cancelScreenId="INS-11"
        >
          <TextField
            label="Nombre del Grado"
            required
            placeholder="Ej: 6-1, 11°B, Transición A"
            hint="Nombre del grupo educativo"
            {...form.bind("name")}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label="Sede"
              required
              placeholder="Seleccione una sede..."
              options={campuses.map((campus) => ({
                value: String(campus.id),
                label: campus.isMainCampus ? `${campus.name} (Principal)` : campus.name,
              }))}
              {...form.bind("campusId")}
            />
            <SelectField
              label="Nivel Académico"
              placeholder="Sin nivel (opcional)"
              options={levels.map((level) => ({ value: String(level.id), label: level.name }))}
              {...form.bind("levelId")}
            />
          </div>
          <SelectField
            label="Director de Grupo"
            placeholder="Sin director asignado"
            options={teachers.map((teacher) => ({
              value: String(teacher.id),
              label: fullName(teacher),
            }))}
            {...form.bind("directorId")}
          />
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField label="Año Lectivo" required {...form.bind("academicYear")} />
            <SelectField label="Jornada" required options={SHIFT_OPTIONS} {...form.bind("shift")} />
            <TextField
              label="Capacidad Máxima"
              type="number"
              min={1}
              max={60}
              {...form.bind("maxStudents")}
            />
          </div>
        </FormCard>
      }
      help={
        <HelpCard title="Información">
          <p className="font-medium text-foreground">¿Qué es un grado?</p>
          <p>Un grupo específico de estudiantes en un año lectivo y sede.</p>
          <p className="font-medium text-foreground">Director de Grupo</p>
          <p>
            Profesor responsable; puede tomar asistencia y registrar observaciones. Es opcional.
          </p>
          <p className="font-medium text-foreground">Consejos</p>
          <HelpList
            items={[
              "Usa nombres claros para cada grupo.",
              "La sede determina dónde se imparten las clases.",
              "La capacidad evita el sobrecupo.",
              "El director puede asignarse después.",
            ]}
          />
        </HelpCard>
      }
    />
  );
}
