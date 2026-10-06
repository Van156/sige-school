import {
  BackButton,
  FormCard,
  FormLayout,
  HelpCard,
  HelpList,
  UsernamePreview,
} from "../../-components/form-layout";
import { Callout } from "../../-components/callout";
import { SelectField, TextField } from "../../-components/form-fields";
import { NotFoundBlock } from "../../-components/not-found-block";
import { ScreenPage } from "../../-components/scoped-page";
import { formatDate } from "../../-lib/format";
import { generateUsername } from "../../-lib/usernames";
import { useGoToScreen } from "../../-lib/use-go-to-screen";
import { useIdParam } from "../../-lib/use-search-params";
import { useSimpleForm, type FormErrors } from "../../-lib/use-form";
import {
  STAFF_DOC_TYPE_OPTIONS,
  blankToUndefined,
  isDocType,
  isValidEmail,
  newUserRecord,
} from "../../-lib/user-options";
import {
  REFERENCE_DATE,
  campusStore,
  institutionStore,
  mockAction,
  useMockCollection,
  userStore,
} from "../../-mock";
import type { DocType, Institution } from "../../-mock/types";
import {
  InstitutionFields,
  emptyInstitutionValues,
  institutionToValues,
  validateInstitution,
  valuesToInstitution,
  type InstitutionValues,
} from "./institution-fields";

interface FormValues extends InstitutionValues {
  adminFirstName: string;
  adminLastName: string;
  adminDocumentType: string;
  adminDocumentNumber: string;
  adminEmail: string;
  adminPhone: string;
}

const emptyAdmin = {
  adminFirstName: "",
  adminLastName: "",
  adminDocumentType: "CC",
  adminDocumentNumber: "",
  adminEmail: "",
  adminPhone: "",
};

/** INS-02: create (with its mandatory admin) or edit an institution (root). */
export function InstitutionFormScreen() {
  const id = useIdParam();
  const institutions = useMockCollection(institutionStore);
  const existing = id === undefined ? undefined : institutions.find((entry) => entry.id === id);

  return (
    <ScreenPage
      screenId="INS-02"
      title={id === undefined ? "Nueva Institución" : "Editar Institución"}
      description={
        id === undefined
          ? "Complete los datos para crear la institución educativa"
          : "Modifique los datos de la institución educativa"
      }
      back={<BackButton screenId="INS-01" />}
    >
      {id !== undefined && !existing ? (
        <NotFoundBlock entity="Institución" feminine backScreenId="INS-01" />
      ) : (
        <InstitutionForm key={existing?.id ?? "new"} institution={existing} />
      )}
    </ScreenPage>
  );
}

function InstitutionForm({ institution }: { institution?: Institution }) {
  const institutions = useMockCollection(institutionStore);
  const campusList = useMockCollection(campusStore);
  const userList = useMockCollection(userStore);
  const goTo = useGoToScreen();
  const isEdit = institution !== undefined;

  const form = useSimpleForm<FormValues>(
    { ...(institution ? institutionToValues(institution) : emptyInstitutionValues), ...emptyAdmin },
    (values) => {
      const errors: FormErrors<FormValues> = validateInstitution(
        values,
        institutions.filter((other) => other.id !== institution?.id),
      );
      if (!isEdit) {
        if (!values.adminFirstName.trim()) errors.adminFirstName = "Los nombres son obligatorios.";
        if (!values.adminLastName.trim()) errors.adminLastName = "Los apellidos son obligatorios.";
        if (values.adminDocumentNumber.trim().length < 5) {
          errors.adminDocumentNumber = "El documento debe tener al menos 5 dígitos.";
        }
        if (!isValidEmail(values.adminEmail)) errors.adminEmail = "Ingresa un correo válido.";
      }
      return errors;
    },
  );

  const taken = new Set(userList.map((user) => user.username));
  const username = generateUsername(
    form.values.adminFirstName,
    form.values.adminLastName,
    form.values.adminDocumentNumber,
    taken,
  );

  const submit = form.handleSubmit((values) => {
    if (institution) {
      institutionStore.update(institution.id, valuesToInstitution(values));
      mockAction("Institución actualizada", "Los cambios no se guardan en el prototipo.");
    } else {
      const created = institutionStore.add({
        ...valuesToInstitution(values),
        createdAt: REFERENCE_DATE,
      });
      const documentType: DocType = isDocType(values.adminDocumentType)
        ? values.adminDocumentType
        : "CC";
      userStore.add(
        newUserRecord({
          username,
          firstName: values.adminFirstName.trim(),
          lastName: values.adminLastName.trim(),
          documentType,
          documentNumber: values.adminDocumentNumber.trim(),
          role: "admin",
          institutionId: created.id,
          email: values.adminEmail.trim(),
          phone: blankToUndefined(values.adminPhone),
          createdAt: REFERENCE_DATE,
        }),
      );
      mockAction(
        "Institución creada",
        `Administrador ${username} · contraseña inicial: Nº de documento.`,
      );
    }
    goTo("INS-01");
  });

  return (
    <FormLayout
      form={
        <FormCard
          title="Datos Institucionales"
          onSubmit={submit}
          submitLabel={isEdit ? "Actualizar Institución" : "Crear Institución con Admin"}
          cancelScreenId="INS-01"
        >
          <InstitutionFields form={form} />
          {isEdit ? null : (
            <>
              <Callout tone="info" title="Administrador obligatorio">
                Cada institución debe tener un administrador (Rector) que la gestione.
              </Callout>
              <UsernamePreview username={username} />
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  label="Nombres"
                  required
                  placeholder="Ej: Juan Carlos"
                  {...form.bind("adminFirstName")}
                />
                <TextField
                  label="Apellidos"
                  required
                  placeholder="Ej: Pérez García"
                  {...form.bind("adminLastName")}
                />
                <SelectField
                  label="Tipo Doc."
                  required
                  options={STAFF_DOC_TYPE_OPTIONS}
                  {...form.bind("adminDocumentType")}
                />
                <TextField
                  label="Nº Documento"
                  required
                  hint="Se usará como contraseña inicial"
                  {...form.bind("adminDocumentNumber")}
                />
                <TextField
                  label="Email"
                  required
                  type="email"
                  placeholder="rector@inst.edu.co"
                  {...form.bind("adminEmail")}
                />
                <TextField
                  label="Teléfono"
                  type="tel"
                  placeholder="3001234567"
                  {...form.bind("adminPhone")}
                />
              </div>
            </>
          )}
        </FormCard>
      }
      help={
        <>
          {institution ? (
            <HelpCard title="Información">
              <p>ID: {institution.id}</p>
              <p>Creada: {formatDate(institution.createdAt)}</p>
              <p>
                Sedes:{" "}
                {campusList.filter((campus) => campus.institutionId === institution.id).length}
              </p>
            </HelpCard>
          ) : null}
          <HelpCard title="¿Qué es una Institución?">
            <HelpList
              items={[
                "Agrupa sedes, estudiantes, profesores y datos académicos.",
                "Puede tener múltiples sedes.",
                "Gestiona grados y asignaturas.",
                "Configura periodos y administra criterios de evaluación.",
              ]}
            />
          </HelpCard>
          {isEdit ? null : (
            <HelpCard title="Seguridad del Admin">
              <HelpList
                items={[
                  "El username se genera con el nombre y el documento.",
                  "La contraseña inicial es el número de documento.",
                  "Deberá cambiarla en su primer inicio de sesión.",
                ]}
              />
            </HelpCard>
          )}
        </>
      }
    />
  );
}
