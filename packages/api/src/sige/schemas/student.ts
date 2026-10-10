import {
  DEFAULT_STUDENT_DOCUMENT_TYPE,
  DOCUMENT_NUMBER_MAX,
  DOCUMENT_NUMBER_MIN,
  GUARDIAN_RELATIONSHIPS,
  NAME_MAX,
  STRATUM_MAX,
  STRATUM_MIN,
  STUDENT_DOCUMENT_TYPES,
  STUDENT_FIELD_MAX,
  STUDENT_STATUSES,
  studentMessages,
} from "@base-template/sige-core";
import { z } from "zod";

import { birthDateField, emailField, genderField } from "./user";

/**
 * Input fragments for module 05 (sige/05 §3.1, §4.1). Messages are the verbatim Spanish strings
 * the UI shows; the server returns the same text as field issues. No fragment carries
 * `organizationId` (R3.2). Course/campus consistency, uniqueness and role checks need the
 * database and live in the services (`checkCourseCampus`).
 */

const tooLong = (max: number) => `No puede superar ${max} caracteres.`;
const blankToUndefined = (value: string) => (value === "" ? undefined : value);

const requiredName = (message: string) =>
  z.string({ error: message }).trim().min(1, message).max(NAME_MAX, tooLong(NAME_MAX));

const optionalText = (max: number) =>
  z.string().trim().max(max, tooLong(max)).transform(blankToUndefined).optional();

const id = z.string().min(1);

export const studentStatusSchema = z.enum(STUDENT_STATUSES, {
  error: "Debes seleccionar un estado.",
});

export const studentDocumentTypeSchema = z
  .enum(STUDENT_DOCUMENT_TYPES, { error: "Tipo de documento inválido." })
  .default(DEFAULT_STUDENT_DOCUMENT_TYPE);

const DOCUMENT_MIN_MESSAGE = `El documento debe tener al menos ${DOCUMENT_NUMBER_MIN} dígitos.`;

export const studentDocumentNumberSchema = z
  .string({ error: DOCUMENT_MIN_MESSAGE })
  .trim()
  .min(DOCUMENT_NUMBER_MIN, { error: DOCUMENT_MIN_MESSAGE, abort: true })
  .max(DOCUMENT_NUMBER_MAX, `El documento no puede superar ${DOCUMENT_NUMBER_MAX} caracteres.`)
  .regex(/^[A-Za-z0-9]+$/, "El documento solo admite letras y números.");

export const guardianRelationshipSchema = z.enum(GUARDIAN_RELATIONSHIPS, {
  error: "Debes seleccionar un parentesco.",
});

const stratumMessage = studentMessages.stratumRange;

/** "Información Académica" + "Información del Acudiente" (STU-03, every mode). */
export const studentAcademicInput = z.object({
  campusId: z
    .string({ error: "Debes seleccionar una sede." })
    .min(1, "Debes seleccionar una sede."),
  courseId: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : value))
    .nullable(),
  neighborhood: optionalText(STUDENT_FIELD_MAX.neighborhood),
  stratum: z
    .number({ error: stratumMessage })
    .int(stratumMessage)
    .min(STRATUM_MIN, stratumMessage)
    .max(STRATUM_MAX, stratumMessage)
    .nullish(),
  bloodType: optionalText(STUDENT_FIELD_MAX.bloodType),
  eps: optionalText(STUDENT_FIELD_MAX.eps),
  guardianName: optionalText(STUDENT_FIELD_MAX.guardianName),
  guardianPhone: optionalText(STUDENT_FIELD_MAX.guardianPhone),
  guardianEmail: emailField,
});

/** "Información del Usuario" fields editable in new and edit modes. */
const personalFields = {
  firstName: requiredName("El nombre es obligatorio."),
  lastName: requiredName("El apellido es obligatorio."),
  phone: optionalText(30),
  birthDate: birthDateField,
  gender: genderField,
  address: optionalText(200),
};

/** STU-03 new (path A): the document is fixed here and immutable afterwards. */
export const studentCreateInput = studentAcademicInput.extend({
  ...personalFields,
  documentType: studentDocumentTypeSchema,
  documentNumber: studentDocumentNumberSchema,
});

/** STU-03 complete (path B): personal data already exists and is untouched. */
export const studentCompleteInput = studentAcademicInput.extend({
  personId: z.string({ error: "Falta la persona." }).min(1, "Falta la persona."),
});

/** STU-03 edit: personal + academic + status; no document fields (STU-R4, §4.1). */
export const studentEditInput = studentAcademicInput.extend({
  ...personalFields,
  status: studentStatusSchema,
});

export const studentUpdateInput = studentEditInput.extend({ id });

export const studentIdInput = z.object({ id });

export const STUDENT_PICK_MAX_LIMIT = 100;
export const STUDENT_PICK_DEFAULT_LIMIT = 50;

const searchField = z.string().trim().max(100, tooLong(100)).transform(blankToUndefined).optional();

export const studentPickInput = z.object({
  courseId: id.optional(),
  search: searchField,
  limit: z.number().int().min(1).max(STUDENT_PICK_MAX_LIMIT).default(STUDENT_PICK_DEFAULT_LIMIT),
});

export const GUARDIAN_CANDIDATES_MAX_LIMIT = 50;

export const guardianCandidatesInput = z.object({
  studentId: id,
  search: searchField,
  limit: z
    .number()
    .int()
    .min(1)
    .max(GUARDIAN_CANDIDATES_MAX_LIMIT)
    .default(GUARDIAN_CANDIDATES_MAX_LIMIT),
});

const guardianPersonId = z
  .string({ error: "Selecciona un acudiente." })
  .min(1, "Selecciona un acudiente.");

/** STU-04 link (STU-R6); role, activity and duplicates are checked by the service. */
export const guardianLinkInput = z.object({
  studentId: id,
  guardianPersonId,
  relationship: guardianRelationshipSchema,
});

export const guardianUnlinkInput = z.object({ studentId: id, guardianPersonId });
