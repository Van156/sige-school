import { BackButton, FormCard, FormLayout, HelpCard } from "../../-components/form-layout";
import { SelectField, TextField } from "../../-components/form-fields";
import { NotFoundBlock } from "../../-components/not-found-block";
import { ScopedPage } from "../../-components/scoped-page";
import { useGoToScreen } from "../../-lib/use-go-to-screen";
import { useSimpleForm, type FormErrors } from "../../-lib/use-form";
import { useIdParam } from "../../-lib/use-search-params";
import { campusStore, gradeLevelStore, mockAction, useMockCollection } from "../../-mock";
import type { GradeLevel, Institution } from "../../-mock/types";

interface Values {
  campusId: string;
  name: string;
  orderNum: string;
}

/** INS-10: create or edit an academic level. */
export function LevelFormScreen() {
  const id = useIdParam();
  const levelList = useMockCollection(gradeLevelStore);
  const campusList = useMockCollection(campusStore);
  const existing = id === undefined ? undefined : levelList.find((level) => level.id === id);

  return (
    <ScopedPage
      screenId="INS-10"
      title={id === undefined ? "Nuevo Nivel Académico" : "Editar Nivel Académico"}
      description={
        id === undefined
          ? "Define un nuevo nivel académico (ej: Primero, Sexto, Once)"
          : "Modifica los datos del nivel"
      }
      back={<BackButton screenId="INS-09" />}
      target="Niveles"
      banner={false}
    >
      {(institution) => {
        const own =
          existing &&
          campusList.some(
            (campus) => campus.id === existing.campusId && campus.institutionId === institution.id,
          );
        return id !== undefined && !own ? (
          <NotFoundBlock entity="Nivel" backScreenId="INS-09" />
        ) : (
          <LevelForm key={existing?.id ?? "new"} institution={institution} level={existing} />
        );
      }}
    </ScopedPage>
  );
}

function LevelForm({ institution, level }: { institution: Institution; level?: GradeLevel }) {
  const campusList = useMockCollection(campusStore);
  const levelList = useMockCollection(gradeLevelStore);
  const goTo = useGoToScreen();
  const campuses = campusList.filter((campus) => campus.institutionId === institution.id);

  const form = useSimpleForm<Values>(
    {
      campusId: level ? String(level.campusId) : "",
      name: level?.name ?? "",
      orderNum: String(level?.orderNum ?? 0),
    },
    (values) => {
      const errors: FormErrors<Values> = {};
      if (!values.campusId) errors.campusId = "Debes seleccionar una sede.";
      const name = values.name.trim();
      if (!name) errors.name = "El nombre del nivel es obligatorio.";
      else if (
        levelList.some(
          (entry) =>
            entry.id !== level?.id &&
            String(entry.campusId) === values.campusId &&
            entry.name.toLowerCase() === name.toLowerCase(),
        )
      ) {
        errors.name = "Ya existe un nivel con este nombre en la sede.";
      }
      const order = Number(values.orderNum);
      if (!Number.isInteger(order) || order < 0)
        errors.orderNum = "El orden debe ser un entero desde 0.";
      return errors;
    },
  );

  const submit = form.handleSubmit((values) => {
    const data = {
      campusId: Number(values.campusId),
      name: values.name.trim(),
      orderNum: Number(values.orderNum),
    };
    if (level) gradeLevelStore.update(level.id, data);
    else gradeLevelStore.add(data);
    mockAction(
      level ? "Nivel actualizado" : "Nivel creado",
      "Los cambios no se guardan en el prototipo.",
    );
    goTo("INS-09");
  });

  return (
    <FormLayout
      form={
        <FormCard
          title="Datos del Nivel"
          onSubmit={submit}
          submitLabel={level ? "Actualizar Nivel" : "Crear Nivel"}
          cancelScreenId="INS-09"
        >
          <SelectField
            label="Sede"
            required
            placeholder="Seleccione una sede..."
            disabled={level !== undefined}
            options={campuses.map((campus) => ({
              value: String(campus.id),
              label: campus.isMainCampus ? `${campus.name} (Principal)` : campus.name,
            }))}
            {...form.bind("campusId")}
          />
          <TextField
            label="Nombre del Nivel"
            required
            placeholder="Ej: Primero, Sexto, Once, Transición"
            hint="Nombre general del nivel"
            {...form.bind("name")}
          />
          <TextField
            label="Orden"
            type="number"
            min={0}
            hint="Número para ordenar los niveles (0 = primero)"
            {...form.bind("orderNum")}
          />
        </FormCard>
      }
      help={
        <HelpCard title="¿Qué es un Nivel Académico?">
          <p>Agrupa los cursos de una sede. Jerarquía de ejemplo:</p>
          <pre className="overflow-x-auto rounded-md bg-muted/50 p-2 font-mono text-xs leading-5 text-foreground">
            {`Sede Central
├── Nivel: Sexto
│   ├── Curso: 6-01 (Mañana)
│   └── Curso: 6-02 (Tarde)
└── Nivel: Once
    └── Curso: 11-01 (Mañana)`}
          </pre>
        </HelpCard>
      }
    />
  );
}
