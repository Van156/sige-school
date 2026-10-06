import {
  BackButton,
  FormCard,
  FormLayout,
  HelpCard,
  HelpList,
} from "../../-components/form-layout";
import { TextField } from "../../-components/form-fields";
import { NotFoundBlock } from "../../-components/not-found-block";
import { ScopedPage } from "../../-components/scoped-page";
import { useGoToScreen } from "../../-lib/use-go-to-screen";
import { useSimpleForm, type FormErrors } from "../../-lib/use-form";
import { useIdParam } from "../../-lib/use-search-params";
import { blankToUndefined } from "../../-lib/user-options";
import { mockAction, subjectStore, useMockCollection } from "../../-mock";
import type { Institution, Subject } from "../../-mock/types";

interface Values {
  name: string;
  code: string;
}

/** INS-14: create or edit a subject. */
export function SubjectFormScreen() {
  const id = useIdParam();
  const subjectList = useMockCollection(subjectStore);
  const existing = id === undefined ? undefined : subjectList.find((subject) => subject.id === id);

  return (
    <ScopedPage
      screenId="INS-14"
      title={id === undefined ? "Nueva Asignatura" : "Editar Asignatura"}
      description="Complete los datos de la asignatura"
      back={<BackButton screenId="INS-13" />}
      target="Asignaturas"
      banner={false}
    >
      {(institution) =>
        id !== undefined && existing?.institutionId !== institution.id ? (
          <NotFoundBlock entity="Asignatura" feminine backScreenId="INS-13" />
        ) : (
          <SubjectForm key={existing?.id ?? "new"} institution={institution} subject={existing} />
        )
      }
    </ScopedPage>
  );
}

function SubjectForm({ institution, subject }: { institution: Institution; subject?: Subject }) {
  const subjectList = useMockCollection(subjectStore);
  const goTo = useGoToScreen();

  const form = useSimpleForm<Values>(
    { name: subject?.name ?? "", code: subject?.code ?? "" },
    (values) => {
      const errors: FormErrors<Values> = {};
      if (!values.name.trim()) errors.name = "El nombre de la asignatura es obligatorio.";
      const code = values.code.trim().toUpperCase();
      if (
        code &&
        subjectList.some(
          (entry) =>
            entry.id !== subject?.id &&
            entry.institutionId === institution.id &&
            entry.code?.toUpperCase() === code,
        )
      ) {
        errors.code = "Ya existe una asignatura con este código.";
      }
      return errors;
    },
  );

  const submit = form.handleSubmit((values) => {
    const data = { name: values.name.trim(), code: blankToUndefined(values.code)?.toUpperCase() };
    if (subject) subjectStore.update(subject.id, data);
    else subjectStore.add({ ...data, institutionId: institution.id });
    mockAction(
      subject ? "Asignatura actualizada" : "Asignatura creada",
      "Los cambios no se guardan en el prototipo.",
    );
    goTo("INS-13");
  });

  return (
    <FormLayout
      form={
        <FormCard
          title="Datos de la Asignatura"
          onSubmit={submit}
          submitLabel={subject ? "Actualizar Asignatura" : "Crear Asignatura"}
          cancelScreenId="INS-13"
        >
          <TextField
            label="Nombre de la Asignatura"
            required
            hint="Nombre descriptivo de la asignatura (ej: Matemáticas, Ciencias Naturales)"
            {...form.bind("name")}
          />
          <TextField
            label="Código"
            hint="Código interno de la asignatura (opcional)"
            {...form.bind("code")}
          />
        </FormCard>
      }
      help={
        <HelpCard title="Información">
          <HelpList
            items={[
              "Son las materias que se imparten en la institución.",
              "Se asignan a grados específicos.",
              "Pueden tener múltiples profesores.",
              "Se usan para el sistema de notas.",
            ]}
          />
        </HelpCard>
      }
    />
  );
}
