import { describe, expect, test } from "bun:test";

import {
  OBSERVATION_CATEGORIES,
  OBSERVATION_QUICK_CATEGORIES,
  OBSERVATION_TYPES,
  OBSERVATION_TYPE_CODES,
  countObservations,
  isPending,
  observationMessages,
  requiresNotification,
} from "./observations";
import { SIGE_RULES } from "./rules";

describe("OBSERVATION_TYPES (08 §3)", () => {
  test("the four codes of the `observation_type` enum, in form order", () => {
    expect(OBSERVATION_TYPE_CODES).toEqual(["positiva", "negativa", "seguimiento", "convivencia"]);
    expect(OBSERVATION_TYPES.map((type) => type.code)).toEqual([...OBSERVATION_TYPE_CODES]);
  });

  test("labels, glyphs, tones and the four OBS-04 hints, verbatim", () => {
    expect(OBSERVATION_TYPES).toEqual([
      {
        code: "positiva",
        label: "Positiva",
        glyph: "👍",
        tone: "success",
        hint: "Reconocimiento de buen comportamiento o logro",
      },
      {
        code: "negativa",
        label: "Negativa",
        glyph: "⚠️",
        tone: "destructive",
        hint: "Comportamiento inadecuado o falta grave",
      },
      {
        code: "seguimiento",
        label: "Seguimiento",
        glyph: "📋",
        tone: "info",
        hint: "Monitoreo de progreso o situación",
      },
      {
        code: "convivencia",
        label: "Convivencia",
        glyph: "🤝",
        tone: "warning",
        hint: "Aspectos relacionados con la convivencia escolar",
      },
    ]);
  });
});

describe("OBSERVATION_CATEGORIES (08 §3)", () => {
  test("the seven values", () => {
    expect(OBSERVATION_CATEGORIES).toEqual([
      "Disciplina",
      "Rendimiento",
      "Valores",
      "Convivencia",
      "Responsabilidad",
      "Participación",
      "Otro",
    ]);
  });

  test('OBS-04 offers the first six (without "Otro")', () => {
    expect(OBSERVATION_QUICK_CATEGORIES).toEqual([
      "Disciplina",
      "Rendimiento",
      "Valores",
      "Convivencia",
      "Responsabilidad",
      "Participación",
    ]);
  });
});

describe("requiresNotification / isPending (OBS-R4)", () => {
  test("negativa and convivencia require notification", () => {
    expect(requiresNotification("negativa")).toBe(true);
    expect(requiresNotification("convivencia")).toBe(true);
    expect(requiresNotification("positiva")).toBe(false);
    expect(requiresNotification("seguimiento")).toBe(false);
  });

  test("pending = requires notification and not notified", () => {
    expect(isPending({ type: "negativa", notified: false })).toBe(true);
    expect(isPending({ type: "convivencia", notified: false })).toBe(true);
    expect(isPending({ type: "negativa", notified: true })).toBe(false);
    expect(isPending({ type: "positiva", notified: false })).toBe(false);
    expect(isPending({ type: "seguimiento", notified: true })).toBe(false);
  });
});

describe("countObservations (08 §3, OBS-R8)", () => {
  test("counts per type plus notified and pending", () => {
    expect(
      countObservations([
        { type: "positiva", notified: false },
        { type: "positiva", notified: false },
        { type: "negativa", notified: true },
        { type: "negativa", notified: false },
        { type: "seguimiento", notified: false },
        { type: "convivencia", notified: false },
      ]),
    ).toEqual({
      total: 6,
      positiva: 2,
      negativa: 2,
      seguimiento: 1,
      convivencia: 1,
      notified: 1,
      pending: 2,
    });
  });

  test("empty list", () => {
    expect(countObservations([])).toEqual({
      total: 0,
      positiva: 0,
      negativa: 0,
      seguimiento: 0,
      convivencia: 0,
      notified: 0,
      pending: 0,
    });
  });

  test('"notified" counts every notified row, whatever its type (OBS-R5)', () => {
    expect(
      countObservations([
        { type: "positiva", notified: true },
        { type: "negativa", notified: true },
      ]),
    ).toMatchObject({ notified: 2, pending: 0 });
  });
});

describe("observationMessages (OBS-R2…R6, verbatim)", () => {
  test("every message character for character", () => {
    expect(observationMessages).toEqual({
      studentRequired: "Debes seleccionar un estudiante.",
      typeRequired: "Debes seleccionar un tipo.",
      quickTypeRequired: "Selecciona el tipo de observación.",
      descriptionRequired: "La descripción es obligatoria.",
      descriptionTooLong: "La descripción no puede superar 2000 caracteres.",
      commitmentsTooLong: "Los compromisos no pueden superar 1000 caracteres.",
      invalidCategory: "Categoría inválida.",
      invalidDate: "Fecha inválida",
      studentNotActive: "El estudiante no está activo.",
      futureDate: "No se puede registrar una observación con fecha futura.",
      studentNotFound: "Estudiante no encontrado.",
      notFound: "Observación no encontrada.",
      notificationNotRequired: "Esta observación no requiere notificación.",
      onlyAuthorCanEdit: "Solo el autor puede editar esta observación.",
      studentImmutable: "No se puede cambiar el estudiante de una observación existente",
      createdToastTitle: "Observación creada exitosamente",
      createdToastNotice: "El director de grupo será notificado.",
      updatedToast: "Observación actualizada",
      deletedToast: "Observación eliminada",
      notifiedToast: "Observación marcada como notificada",
    });
  });

  test("the length limits behind the messages live in SIGE_RULES", () => {
    expect(SIGE_RULES.OBSERVATION_DESCRIPTION_MAX).toBe(2000);
    expect(SIGE_RULES.OBSERVATION_COMMITMENTS_MAX).toBe(1000);
    expect(SIGE_RULES.OBSERVATION_RECENT_MAX).toBe(20);
    expect(SIGE_RULES.OBSERVATION_RECENT_DEFAULT).toBe(10);
    expect(SIGE_RULES.OBSERVATION_HISTORY_MAX).toBe(500);
    expect(observationMessages.descriptionTooLong).toContain(
      String(SIGE_RULES.OBSERVATION_DESCRIPTION_MAX),
    );
    expect(observationMessages.commitmentsTooLong).toContain(
      String(SIGE_RULES.OBSERVATION_COMMITMENTS_MAX),
    );
  });
});
