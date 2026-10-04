import { CheckList } from "../../-components/check-list";
import { SelectField, TextField } from "../../-components/form-fields";
import {
  BackButton,
  FormCard,
  FormLayout,
  HelpCard,
  HelpList,
} from "../../-components/form-layout";
import { ScopedPage } from "../../-components/scoped-page";
import { teacherOptions } from "../../-lib/school-options";
import { useGoToScreen } from "../../-lib/use-go-to-screen";
import { useSimpleForm, type FormErrors } from "../../-lib/use-form";
import { useSchool } from "../../-lib/use-school";
import { assignSubjects, mockAction, mockInfo } from "../../-mock";
import type { Institution } from "../../-mock/types";

/** SCH-06: bulk-assign subjects to courses (one subject-grade per course x subject). */
export function SubjectGradesFormScreen() {
  return (
    <ScopedPage
      screenId="SCH-06"
      title="Asignar Materias a Grados"
      description="Asigna varias materias a uno o más grados a la vez"
      actions={<BackButton screenId="SCH-05" />}
      target="Materias por Grado"
    >
      {(institution) => <SubjectGradesForm institution={institution} />}
    </ScopedPage>
  );
}

interface Values {
  gradeIds: string[];
  subjectIds: string[];
  teacherId: string;
  hoursPerWeek: string;
}

function SubjectGradesForm({ institution }: { institution: Institution }) {
  const school = useSchool(institution.id);
  const goTo = useGoToScreen();

  const form = useSimpleForm<Values>(
    { gradeIds: [], subjectIds: [], teacherId: "", hoursPerWeek: "4" },
    (values) => {
      const errors: FormErrors<Values> = {};
      if (values.gradeIds.length === 0) errors.gradeIds = "Seleccione al menos un grado.";
      if (values.subjectIds.length === 0) errors.subjectIds = "Seleccione al menos una materia.";
      const hours = Number(values.hoursPerWeek);
      if (!Number.isInteger(hours) || hours < 1 || hours > 20) {
        errors.hoursPerWeek = "La intensidad debe estar entre 1 y 20 horas.";
      }
      return errors;
    },
  );

  const submit = form.handleSubmit((values) => {
    const { created, skipped } = assignSubjects({
      gradeIds: values.gradeIds.map(Number),
      subjectIds: values.subjectIds.map(Number),
      teacherId: values.teacherId ? Number(values.teacherId) : undefined,
      hoursPerWeek: Number(values.hoursPerWeek),
      academicYear: institution.academicYear,
    });
    if (created > 0) {
      mockAction(
        `${created} materia(s) asignada(s)`,
        skipped > 0 ? `${skipped} ya estaban asignadas y se omitieron.` : undefined,
      );
    } else {
      mockInfo("Sin cambios", "Todas las combinaciones ya estaban asignadas.");
    }
    goTo("SCH-05");
  });

  return (
    <FormLayout
      form={
        <FormCard
          title="Asignar Materias"
          onSubmit={submit}
          submitLabel="Asignar Materias"
          cancelScreenId="SCH-05"
        >
          <CheckList
            legend="Grados"
            required
            items={school.grades.map((grade) => ({
              value: String(grade.id),
              label: grade.name,
              hint: `${school.campusName(grade.campusId)} · ${grade.shift}`,
            }))}
            empty="No hay grados registrados en la institución."
            {...form.bind("gradeIds")}
          />
          <CheckList
            legend="Materias"
            required
            items={school.subjects.map((subject) => ({
              value: String(subject.id),
              label: subject.name,
              hint: subject.code,
            }))}
            empty="No hay materias registradas en la institución."
            {...form.bind("subjectIds")}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label="Profesor (opcional)"
              placeholder="Sin asignar"
              options={teacherOptions(school.teachers)}
              {...form.bind("teacherId")}
            />
            <TextField
              label="Intensidad Horaria (Horas/Semana)"
              required
              type="number"
              min={1}
              max={20}
              hint="¿Cuántas horas de esta materia recibe el grado a la semana?"
              {...form.bind("hoursPerWeek")}
            />
          </div>
        </FormCard>
      }
      help={
        <HelpCard title="Información">
          <HelpList
            items={[
              "Se crea una materia por cada combinación de grado y materia.",
              "Las combinaciones que ya existen se omiten.",
              "El profesor es opcional y se puede asignar luego en Asignación de Profesores.",
              "La intensidad define cuántos bloques semanales ocupa en el horario.",
            ]}
          />
        </HelpCard>
      }
    />
  );
}
