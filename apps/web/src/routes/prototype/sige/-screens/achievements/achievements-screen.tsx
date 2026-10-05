import { Button } from "@base-template/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@base-template/ui/components/dialog";
import { cn } from "@base-template/ui/lib/utils";
import { Medal, Settings2, Trophy } from "lucide-react";
import { useState } from "react";

import { AchievementCard } from "../../-components/achievement-card";
import { ConfirmActionButton } from "../../-components/confirm-action";
import { EmptyBlock } from "../../-components/empty-block";
import { SelectField } from "../../-components/form-fields";
import { ScreenLinkButton } from "../../-components/link-button";
import { ScopedPage } from "../../-components/scoped-page";
import { SectionCard } from "../../-components/section-card";
import {
  ACHIEVEMENT_CATEGORIES,
  ACHIEVEMENT_CATEGORY_LABEL,
  canManageAchievements,
  useAchievementData,
} from "../../-lib/achievements";
import { useGrading } from "../../-lib/use-grading";
import { useRole } from "../../-lib/use-role";
import { useSchool } from "../../-lib/use-school";
import { useSimpleForm, type FormErrors } from "../../-lib/use-form";
import {
  awardAchievement,
  currentUserFor,
  mockAction,
  mockInfo,
  runAchievementEngine,
} from "../../-mock";
import type { Achievement, Institution } from "../../-mock/types";

/** ACH-01: achievements catalogue by category, manual award and the automatic engine. */
export function AchievementsScreen() {
  const role = useRole();
  const canManage = canManageAchievements(role);
  return (
    <ScopedPage
      screenId="ACH-01"
      title="🏆 Logros y Gamificación"
      description="Catálogo de logros y reconocimientos estudiantiles"
      target="Logros"
      banner={false}
      actions={
        <>
          <ScreenLinkButton screenId="ACH-03">
            <Medal data-icon="inline-start" />
            Ranking
          </ScreenLinkButton>
          {canManage ? (
            <ConfirmActionButton
              variant="default"
              title="¿Ejecutar el motor de logros para todos los estudiantes?"
              description="Se evaluarán las siete reglas sobre las notas, la asistencia y las observaciones."
              confirmLabel="Ejecutar motor"
              onConfirm={() => {
                const awarded = runAchievementEngine();
                if (awarded > 0) mockAction(`${awarded} logros otorgados`);
                else mockInfo("No se encontraron nuevos logros para otorgar.");
              }}
            >
              <Settings2 data-icon="inline-start" />
              Ejecutar Motor Automático
            </ConfirmActionButton>
          ) : null}
        </>
      }
    >
      {(institution) => <Catalog institution={institution} canManage={canManage} />}
    </ScopedPage>
  );
}

function Catalog({ institution, canManage }: { institution: Institution; canManage: boolean }) {
  const data = useAchievementData();
  const [category, setCategory] = useState("");
  const [target, setTarget] = useState<Achievement | null>(null);
  const items = data.catalog.filter((item) => !category || item.category === category);

  return (
    <>
      <SectionCard title="Filtrar por categoría">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por categoría">
          {[
            { value: "", label: "Todos" },
            ...ACHIEVEMENT_CATEGORIES.map((value) => ({
              value,
              label: ACHIEVEMENT_CATEGORY_LABEL[value],
            })),
          ].map((chip) => (
            <Button
              key={chip.value}
              size="sm"
              variant={category === chip.value ? "default" : "outline"}
              aria-pressed={category === chip.value}
              className={cn(category === chip.value && "pointer-events-none")}
              onClick={() => setCategory(chip.value)}
            >
              {chip.label}
            </Button>
          ))}
        </div>
      </SectionCard>

      {items.length === 0 ? (
        <EmptyBlock
          icon={<Trophy />}
          title="Sin logros disponibles"
          description="No hay logros configurados para esta institución."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((item) => (
            <AchievementCard
              key={item.id}
              achievement={item}
              meta={`Otorgado ${data.timesAwarded(item.id)} veces`}
              footer={
                canManage ? (
                  <Button variant="outline" size="sm" onClick={() => setTarget(item)}>
                    🏆 Otorgar Manualmente
                  </Button>
                ) : undefined
              }
            />
          ))}
        </div>
      )}

      <Dialog open={target !== null} onOpenChange={(open) => (open ? undefined : setTarget(null))}>
        <DialogContent>
          {target ? (
            <AwardForm
              key={target.id}
              achievement={target}
              institution={institution}
              onClose={() => setTarget(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

interface AwardValues {
  studentId: string;
  periodId: string;
}

function AwardForm({
  achievement,
  institution,
  onClose,
}: {
  achievement: Achievement;
  institution: Institution;
  onClose: () => void;
}) {
  const role = useRole();
  const school = useSchool(institution.id);
  const grading = useGrading(institution.id);
  const form = useSimpleForm<AwardValues>({ studentId: "", periodId: "" }, (values) => {
    const errors: FormErrors<AwardValues> = {};
    if (!values.studentId) errors.studentId = "Debe seleccionar un estudiante.";
    return errors;
  });

  const submit = form.handleSubmit((values) => {
    const result = awardAchievement({
      studentId: Number(values.studentId),
      achievementId: achievement.id,
      periodId: values.periodId ? Number(values.periodId) : undefined,
      awardedBy: currentUserFor(role).id,
    });
    if (result.ok) {
      mockAction(
        `Logro "${achievement.name}" otorgado`,
        `Estudiante: ${school.studentName(Number(values.studentId))}`,
      );
      onClose();
    } else {
      mockInfo(result.reason);
    }
  });

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>🏆 Otorgar Logro</DialogTitle>
        <DialogDescription>
          Logro a otorgar:{" "}
          <strong>
            {achievement.icon} {achievement.name}
          </strong>
        </DialogDescription>
      </DialogHeader>
      <SelectField
        label="Estudiante"
        required
        placeholder="-- Seleccionar estudiante --"
        options={school.students
          .filter((student) => student.status === "activo")
          .map((student) => ({
            value: String(student.id),
            label: `${school.studentName(student.id)} - ${school.gradeName(student.gradeId) ?? "Sin grado"}`,
          }))
          .toSorted((a, b) => a.label.localeCompare(b.label, "es"))}
        {...form.bind("studentId")}
      />
      <SelectField
        label="Periodo (opcional)"
        placeholder="-- Sin periodo específico --"
        options={grading.periods.map((period) => ({
          value: String(period.id),
          label: period.name,
        }))}
        {...form.bind("periodId")}
      />
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit">Otorgar Logro</Button>
      </DialogFooter>
    </form>
  );
}
