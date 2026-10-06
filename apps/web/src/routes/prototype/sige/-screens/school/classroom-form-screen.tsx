import { SelectField, TextareaField, TextField } from "../../-components/form-fields";
import {
  BackButton,
  FormCard,
  FormLayout,
  HelpCard,
  HelpList,
} from "../../-components/form-layout";
import { NotFoundBlock } from "../../-components/not-found-block";
import { ScopedPage } from "../../-components/scoped-page";
import { CLASSROOM_TYPE_OPTIONS, campusOptions, toClassroomType } from "../../-lib/school-options";
import { useGoToScreen } from "../../-lib/use-go-to-screen";
import { useSimpleForm, type FormErrors } from "../../-lib/use-form";
import { useSchool, type School } from "../../-lib/use-school";
import { useIdParam } from "../../-lib/use-search-params";
import { blankToUndefined } from "../../-lib/user-options";
import { classroomStore, mockAction } from "../../-mock";
import type { Classroom, Institution } from "../../-mock/types";

/** SCH-08: create or edit a classroom (`?id=`). */
export function ClassroomFormScreen() {
  const id = useIdParam();

  return (
    <ScopedPage
      screenId="SCH-08"
      title={id === undefined ? "Nuevo Salón" : "Editar Salón"}
      description="Salón o espacio físico donde se dictan las clases"
      actions={<BackButton screenId="SCH-07" />}
      target="Salones"
    >
      {(institution) => <ClassroomFormLoader institution={institution} id={id} />}
    </ScopedPage>
  );
}

function ClassroomFormLoader({ institution, id }: { institution: Institution; id?: number }) {
  const school = useSchool(institution.id);
  const classroom = id === undefined ? undefined : school.classrooms.find((room) => room.id === id);
  return id !== undefined && !classroom ? (
    <NotFoundBlock entity="Salón" backScreenId="SCH-07" />
  ) : (
    <ClassroomForm key={classroom?.id ?? "new"} classroom={classroom} school={school} />
  );
}

interface Values {
  campusId: string;
  name: string;
  code: string;
  capacity: string;
  classroomType: string;
  building: string;
  floor: string;
  resources: string;
}

function isJson(value: string): boolean {
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
}

function ClassroomForm({ classroom, school }: { classroom?: Classroom; school: School }) {
  const goTo = useGoToScreen();

  const form = useSimpleForm<Values>(
    {
      campusId: classroom ? String(classroom.campusId) : "",
      name: classroom?.name ?? "",
      code: classroom?.code ?? "",
      capacity: String(classroom?.capacity ?? 40),
      classroomType: classroom?.classroomType ?? "aula",
      building: classroom?.building ?? "",
      floor: String(classroom?.floor ?? 1),
      resources: classroom?.resources ?? "",
    },
    (values) => {
      const errors: FormErrors<Values> = {};
      if (!values.campusId) errors.campusId = "Debes seleccionar una sede.";
      if (!values.name.trim()) errors.name = "El nombre es obligatorio.";
      const code = values.code.trim();
      if (!code) errors.code = "El código es obligatorio.";
      else if (
        values.campusId &&
        school.classrooms.some(
          (room) =>
            room.id !== classroom?.id &&
            String(room.campusId) === values.campusId &&
            room.code?.toLowerCase() === code.toLowerCase(),
        )
      ) {
        errors.code = "Ya existe un salón con este código en la sede.";
      }
      const capacity = Number(values.capacity);
      if (!Number.isInteger(capacity) || capacity < 10 || capacity > 100) {
        errors.capacity = "La capacidad debe estar entre 10 y 100.";
      }
      const floor = Number(values.floor);
      if (!Number.isInteger(floor) || floor < 1) errors.floor = "El piso debe ser 1 o mayor.";
      if (values.resources.trim() && !isJson(values.resources)) {
        errors.resources = "El formato JSON no es válido.";
      }
      return errors;
    },
  );

  const submit = form.handleSubmit((values) => {
    const data = {
      campusId: Number(values.campusId),
      name: values.name.trim(),
      code: values.code.trim(),
      capacity: Number(values.capacity),
      classroomType: toClassroomType(values.classroomType),
      building: blankToUndefined(values.building),
      floor: Number(values.floor),
      resources: blankToUndefined(values.resources),
    };
    if (classroom) classroomStore.update(classroom.id, data);
    else classroomStore.add(data);
    mockAction(
      classroom ? "Salón actualizado" : "Salón creado",
      "Los cambios no se guardan en el prototipo.",
    );
    goTo("SCH-07");
  });

  return (
    <FormLayout
      form={
        <FormCard
          title="Datos del Salón"
          onSubmit={submit}
          submitLabel={classroom ? "Guardar Cambios" : "Crear Salón"}
          cancelScreenId="SCH-07"
        >
          <SelectField
            label="Sede"
            required
            placeholder="Seleccione una sede..."
            options={campusOptions(school.campuses)}
            {...form.bind("campusId")}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Nombre" required placeholder="Ej: Aula 101" {...form.bind("name")} />
            <TextField
              label="Código"
              required
              placeholder="AULA-101"
              hint="Ej: AULA-101, LAB-CIENCIAS (único por sede)"
              {...form.bind("code")}
            />
            <TextField
              label="Capacidad"
              type="number"
              min={10}
              max={100}
              {...form.bind("capacity")}
            />
            <SelectField
              label="Tipo"
              options={CLASSROOM_TYPE_OPTIONS}
              {...form.bind("classroomType")}
            />
            <TextField label="Edificio" placeholder="Ej: A" {...form.bind("building")} />
            <TextField label="Piso" type="number" min={1} {...form.bind("floor")} />
          </div>
          <TextareaField
            label="Recursos (JSON)"
            rows={3}
            placeholder='{"proyector": true, "computadoras": 30}'
            hint="Lista de recursos disponibles en formato JSON"
            {...form.bind("resources")}
          />
        </FormCard>
      }
      help={
        <HelpCard title="Información">
          <p className="font-medium text-foreground">Tipos de salón</p>
          <HelpList
            items={[
              "Aula: clases regulares.",
              "Laboratorio: ciencias y sistemas.",
              "Auditorio: eventos y reuniones.",
              "Cancha: educación física.",
            ]}
          />
          <p className="font-medium text-foreground">Consejos</p>
          <HelpList
            items={[
              "El generador de horarios usa el tipo para elegir el salón de cada materia.",
              "La capacidad evita sobrecupo en la asignación.",
            ]}
          />
        </HelpCard>
      }
    />
  );
}
