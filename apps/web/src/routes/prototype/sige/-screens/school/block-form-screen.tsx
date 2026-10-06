import { SelectField, SwitchField, TextField } from "../../-components/form-fields";
import { BackButton, FormCard, FormLayout, HelpCard } from "../../-components/form-layout";
import { NotFoundBlock } from "../../-components/not-found-block";
import { ScopedPage } from "../../-components/scoped-page";
import { SimpleTable, type TableColumn } from "../../-components/simple-table";
import { ToneBadge } from "../../-components/tone-badge";
import { SHIFT_OPTIONS, campusOptions, toShift } from "../../-lib/school-options";
import { useGoToScreen } from "../../-lib/use-go-to-screen";
import { useSimpleForm, type FormErrors } from "../../-lib/use-form";
import { useSchool, type School } from "../../-lib/use-school";
import { useIdParam } from "../../-lib/use-search-params";
import { blockStore, mockAction } from "../../-mock";
import type { Institution, ScheduleBlock } from "../../-mock/types";

/** SCH-10: create or edit a time block (`?id=`). */
export function BlockFormScreen() {
  const id = useIdParam();

  return (
    <ScopedPage
      screenId="SCH-10"
      title={id === undefined ? "Nuevo Bloque de Tiempo" : "Editar Bloque"}
      description="Período de clase o descanso dentro de la jornada"
      actions={<BackButton screenId="SCH-09" />}
      target="Bloques"
    >
      {(institution) => <BlockFormLoader institution={institution} id={id} />}
    </ScopedPage>
  );
}

function BlockFormLoader({ institution, id }: { institution: Institution; id?: number }) {
  const school = useSchool(institution.id);
  const block = id === undefined ? undefined : school.blocks.find((entry) => entry.id === id);
  return id !== undefined && !block ? (
    <NotFoundBlock entity="Bloque" backScreenId="SCH-09" />
  ) : (
    <BlockForm key={block?.id ?? "new"} institution={institution} block={block} school={school} />
  );
}

interface Values {
  campusId: string;
  name: string;
  shift: string;
  startTime: string;
  endTime: string;
  orderNum: string;
  isBreak: boolean;
}

function BlockForm({
  institution,
  block,
  school,
}: {
  institution: Institution;
  block?: ScheduleBlock;
  school: School;
}) {
  const goTo = useGoToScreen();

  const form = useSimpleForm<Values>(
    {
      campusId: block ? String(block.campusId) : "",
      name: block?.name ?? "",
      shift: block?.shift ?? "Mañana",
      startTime: block?.startTime ?? "07:00",
      endTime: block?.endTime ?? "08:00",
      orderNum: String(block?.orderNum ?? school.blocks.length + 1),
      isBreak: block?.isBreak ?? false,
    },
    (values) => {
      const errors: FormErrors<Values> = {};
      const name = values.name.trim();
      if (!values.campusId) errors.campusId = "Debes seleccionar una sede.";
      if (!name) errors.name = "El nombre es obligatorio.";
      if (!values.startTime) errors.startTime = "La hora de inicio es obligatoria.";
      if (!values.endTime) errors.endTime = "La hora de fin es obligatoria.";
      else if (values.startTime && values.endTime <= values.startTime) {
        errors.endTime = "La hora de fin debe ser posterior a la de inicio.";
      }
      const order = Number(values.orderNum);
      if (!Number.isInteger(order) || order < 1) errors.orderNum = "El orden debe ser 1 o mayor.";
      if (
        name &&
        values.campusId &&
        school.blocks.some(
          (entry) =>
            entry.id !== block?.id &&
            String(entry.campusId) === values.campusId &&
            entry.name.toLowerCase() === name.toLowerCase() &&
            entry.shift === values.shift,
        )
      ) {
        errors.name = "Ya existe un bloque con este nombre en la sede y jornada.";
      }
      return errors;
    },
  );

  const submit = form.handleSubmit((values) => {
    const data = {
      campusId: Number(values.campusId),
      name: values.name.trim(),
      shift: toShift(values.shift),
      startTime: values.startTime,
      endTime: values.endTime,
      orderNum: Number(values.orderNum),
      isBreak: values.isBreak,
      academicYear: institution.academicYear,
    };
    if (block) blockStore.update(block.id, data);
    else blockStore.add(data);
    mockAction(
      block ? "Bloque actualizado" : "Bloque creado",
      "Los cambios no se guardan en el prototipo.",
    );
    goTo("SCH-09");
  });

  return (
    <FormLayout
      form={
        <FormCard
          title="Datos del Bloque"
          onSubmit={submit}
          submitLabel={block ? "Guardar Cambios" : "Crear Bloque"}
          cancelScreenId="SCH-09"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label="Sede"
              required
              placeholder="Seleccione una sede..."
              options={campusOptions(school.campuses)}
              {...form.bind("campusId")}
            />
            <SelectField label="Jornada" required options={SHIFT_OPTIONS} {...form.bind("shift")} />
          </div>
          <TextField
            label="Nombre"
            required
            placeholder="Ej: Bloque 1, Recreo, Almuerzo"
            {...form.bind("name")}
          />
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField label="Hora Inicio" required type="time" {...form.bind("startTime")} />
            <TextField label="Hora Fin" required type="time" {...form.bind("endTime")} />
            <TextField
              label="Orden"
              type="number"
              min={1}
              hint="Orden en el día"
              {...form.bind("orderNum")}
            />
          </div>
          <SwitchField
            label="Es descanso/recreo"
            hint="Los bloques de descanso no se asignan con materias"
            {...form.bind("isBreak")}
          />
        </FormCard>
      }
      help={
        <HelpCard title="Ejemplo de bloques típicos">
          <SimpleTable
            columns={EXAMPLE_COLUMNS}
            rows={EXAMPLE_BLOCKS}
            getRowId={(row) => row.order}
          />
        </HelpCard>
      }
    />
  );
}

interface ExampleBlock {
  order: number;
  name: string;
  start: string;
  end: string;
  isBreak: boolean;
}

const EXAMPLE_BLOCKS: readonly ExampleBlock[] = [
  { order: 1, name: "Bloque 1", start: "07:00", end: "08:00", isBreak: false },
  { order: 2, name: "Bloque 2", start: "08:00", end: "09:00", isBreak: false },
  { order: 3, name: "Recreo", start: "09:00", end: "09:30", isBreak: true },
  { order: 4, name: "Bloque 3", start: "09:30", end: "10:30", isBreak: false },
  { order: 5, name: "Bloque 4", start: "10:30", end: "11:30", isBreak: false },
  { order: 6, name: "Almuerzo", start: "11:30", end: "12:30", isBreak: true },
  { order: 7, name: "Bloque 5", start: "12:30", end: "13:30", isBreak: false },
  { order: 8, name: "Bloque 6", start: "13:30", end: "14:30", isBreak: false },
];

const EXAMPLE_COLUMNS: TableColumn<ExampleBlock>[] = [
  { key: "order", header: "#", cell: (row) => row.order },
  { key: "name", header: "Nombre", cell: (row) => row.name },
  { key: "start", header: "Inicio", cell: (row) => row.start },
  { key: "end", header: "Fin", cell: (row) => row.end },
  {
    key: "type",
    header: "Tipo",
    cell: (row) => (
      <ToneBadge tone={row.isBreak ? "warning" : "success"}>
        {row.isBreak ? "Descanso" : "Clase"}
      </ToneBadge>
    ),
  },
];
