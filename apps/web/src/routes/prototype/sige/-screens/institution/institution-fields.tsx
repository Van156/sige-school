import { Field, FieldDescription, FieldLabel } from "@base-template/ui/components/field";
import { Input } from "@base-template/ui/components/input";

import { TextField } from "../../-components/form-fields";
import { blankToUndefined } from "../../-lib/user-options";
import type { FormErrors, SimpleForm } from "../../-lib/use-form";
import { ACADEMIC_YEAR } from "../../-mock";
import type { Institution } from "../../-mock/types";

/** Institution data shared by INS-02 (create / edit) and INS-06 (configuration). */
export interface InstitutionValues {
  name: string;
  nit: string;
  phone: string;
  email: string;
  address: string;
  municipality: string;
  department: string;
  academicYear: string;
  resolution: string;
}

export const emptyInstitutionValues: InstitutionValues = {
  name: "",
  nit: "",
  phone: "",
  email: "",
  address: "",
  municipality: "",
  department: "",
  academicYear: ACADEMIC_YEAR,
  resolution: "",
};

export function institutionToValues(institution: Institution): InstitutionValues {
  return {
    name: institution.name,
    nit: institution.nit ?? "",
    phone: institution.phone ?? "",
    email: institution.email ?? "",
    address: institution.address ?? "",
    municipality: institution.municipality ?? "",
    department: institution.department ?? "",
    academicYear: institution.academicYear,
    resolution: institution.resolution ?? "",
  };
}

export function valuesToInstitution(
  values: InstitutionValues,
): Omit<Institution, "id" | "createdAt"> {
  return {
    name: values.name.trim(),
    nit: blankToUndefined(values.nit),
    phone: blankToUndefined(values.phone),
    email: blankToUndefined(values.email),
    address: blankToUndefined(values.address),
    municipality: blankToUndefined(values.municipality),
    department: blankToUndefined(values.department),
    academicYear: values.academicYear.trim() || ACADEMIC_YEAR,
    resolution: blankToUndefined(values.resolution),
  };
}

export function validateInstitution(
  values: InstitutionValues,
  others: readonly Institution[],
): FormErrors<InstitutionValues> {
  const errors: FormErrors<InstitutionValues> = {};
  if (!values.name.trim()) errors.name = "El nombre de la institución es obligatorio.";
  const nit = values.nit.trim();
  if (nit && others.some((other) => other.nit === nit)) {
    errors.nit = "Ya existe una institución con este NIT.";
  }
  if (!values.academicYear.trim()) errors.academicYear = "El año lectivo es obligatorio.";
  return errors;
}

/** Field grid of the institution data card; `form` must hold at least `InstitutionValues`. */
export function InstitutionFields({ form }: { form: Pick<SimpleForm<InstitutionValues>, "bind"> }) {
  return (
    <>
      <TextField
        label="Nombre de la Institución"
        required
        placeholder="Ej: Institución Educativa Simón Bolívar"
        {...form.bind("name")}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="NIT"
          placeholder="900.123.456-7"
          hint="Número de Identificación Tributaria"
          {...form.bind("nit")}
        />
        <TextField
          label="Teléfono"
          type="tel"
          placeholder="(601) 234 5678"
          {...form.bind("phone")}
        />
      </div>
      <TextField
        label="Correo Electrónico"
        type="email"
        placeholder="contacto@inst.edu.co"
        {...form.bind("email")}
      />
      <TextField
        label="Dirección"
        placeholder="Calle 123 # 45-67, Barrio Centro"
        {...form.bind("address")}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField label="Municipio" placeholder="Ej: Bogotá" {...form.bind("municipality")} />
        <TextField
          label="Departamento"
          placeholder="Ej: Cundinamarca"
          {...form.bind("department")}
        />
        <TextField label="Año Lectivo" required {...form.bind("academicYear")} />
      </div>
      <TextField
        label="Resolución de Aprobación"
        placeholder="Resolución No. 1234 del 01/01/2025"
        {...form.bind("resolution")}
      />
      <Field>
        <FieldLabel htmlFor="logo">Logo de la Institución</FieldLabel>
        <Input id="logo" type="file" accept="image/*" />
        <FieldDescription>
          Formatos: PNG, JPG, JPEG, GIF, WEBP. El archivo no se guarda en el prototipo.
        </FieldDescription>
      </Field>
    </>
  );
}
