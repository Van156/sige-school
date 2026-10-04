import { Avatar, AvatarFallback } from "@base-template/ui/components/avatar";
import { Badge } from "@base-template/ui/components/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@base-template/ui/components/tabs";
import {
  CalendarCheck,
  FileText,
  MessageSquarePlus,
  NotebookPen,
  Pencil,
  UsersRound,
} from "lucide-react";

import { ActionLink } from "../../-components/action-link";
import { DetailList } from "../../-components/detail-list";
import { EmptyBlock } from "../../-components/empty-block";
import { BackButton } from "../../-components/form-layout";
import { ScreenLinkButton } from "../../-components/link-button";
import { NotFoundBlock } from "../../-components/not-found-block";
import { ScopedPage } from "../../-components/scoped-page";
import { SectionCard } from "../../-components/section-card";
import { ToneBadge } from "../../-components/tone-badge";
import { WeeklySchedule } from "../../-components/weekly-schedule";
import { formatDate } from "../../-lib/format";
import { STUDENT_STATUS_LABEL, STUDENT_STATUS_TONE } from "../../-lib/school-options";
import { useRole } from "../../-lib/use-role";
import { useSchool, type School } from "../../-lib/use-school";
import { useIdParam } from "../../-lib/use-search-params";
import type { AcademicStudent, Institution } from "../../-mock/types";

const GENDER_LABEL = { M: "Masculino", F: "Femenino", Otro: "Otro" } as const;

/** STU-02: student profile (`?id=`) with information, weekly schedule and guardians tabs. */
export function StudentProfileScreen() {
  const id = useIdParam();
  const role = useRole();
  const canManage = role === "root" || role === "admin";

  return (
    <ScopedPage
      screenId="STU-02"
      title="Perfil del Estudiante"
      description="Información académica, horario y acudientes"
      target="Estudiantes"
      banner={false}
      actions={
        <>
          {canManage && id !== undefined ? (
            <>
              <ScreenLinkButton screenId="STU-03" search={{ id: String(id) }}>
                <Pencil data-icon="inline-start" />
                Editar
              </ScreenLinkButton>
              <ScreenLinkButton screenId="STU-04" search={{ id: String(id) }}>
                <UsersRound data-icon="inline-start" />
                Asignar Acudientes
              </ScreenLinkButton>
            </>
          ) : null}
          <BackButton screenId="STU-01" />
        </>
      }
    >
      {(institution) => <ProfileLoader institution={institution} id={id} canManage={canManage} />}
    </ScopedPage>
  );
}

function ProfileLoader({
  institution,
  id,
  canManage,
}: {
  institution: Institution;
  id?: number;
  canManage: boolean;
}) {
  const school = useSchool(institution.id);
  const student = id === undefined ? undefined : school.students.find((entry) => entry.id === id);
  return student ? (
    <Profile student={student} school={school} canManage={canManage} />
  ) : (
    <NotFoundBlock entity="El estudiante" backScreenId="STU-01" />
  );
}

function initials(first: string, last: string): string {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

function Profile({
  student,
  school,
  canManage,
}: {
  student: AcademicStudent;
  school: School;
  canManage: boolean;
}) {
  const user = school.userOfStudent(student);
  if (!user) return <NotFoundBlock entity="El estudiante" backScreenId="STU-01" />;
  const search = { student: String(student.id) };

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="flex flex-col gap-4">
        <SectionCard title="Identidad">
          <div className="flex items-center gap-3">
            <Avatar size="lg">
              <AvatarFallback>{initials(user.firstName, user.lastName)}</AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-col items-start gap-1">
              <span className="font-medium">
                {user.firstName} {user.lastName}
              </span>
              <span className="text-[13px] text-muted-foreground">
                {user.documentType} {user.documentNumber}
              </span>
              <ToneBadge tone={STUDENT_STATUS_TONE[student.status]}>
                {STUDENT_STATUS_LABEL[student.status]}
              </ToneBadge>
            </div>
          </div>
          <DetailList
            items={[
              ["Usuario", <span className="font-mono">{user.username}</span>],
              ["Email", user.email],
              ["Teléfono", user.phone],
            ]}
          />
        </SectionCard>
        <SectionCard title="Acciones">
          <div className="flex flex-col gap-2">
            <ActionLink
              screenId="OBS-04"
              icon={MessageSquarePlus}
              title="Observación"
              search={search}
            />
            <ActionLink screenId="GRD-08" icon={NotebookPen} title="Notas" search={search} />
            <ActionLink screenId="ATT-02" icon={CalendarCheck} title="Asistencia" search={search} />
            <ActionLink screenId="RPT-03" icon={FileText} title="Boletines" search={search} />
          </div>
        </SectionCard>
      </div>

      <div className="lg:col-span-2">
        <Tabs defaultValue="info">
          <TabsList>
            <TabsTrigger value="info">Información</TabsTrigger>
            <TabsTrigger value="schedule">Horario</TabsTrigger>
            <TabsTrigger value="guardians">Acudientes</TabsTrigger>
          </TabsList>
          <TabsContent value="info" className="flex flex-col gap-4">
            <InfoTab student={student} school={school} />
          </TabsContent>
          <TabsContent value="schedule">
            <ScheduleTab student={student} school={school} />
          </TabsContent>
          <TabsContent value="guardians" className="flex flex-col gap-4">
            <GuardiansTab student={student} school={school} canManage={canManage} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function InfoTab({ student, school }: { student: AcademicStudent; school: School }) {
  const user = school.userOfStudent(student);
  return (
    <>
      <SectionCard title="Información Académica">
        <DetailList
          items={[
            ["Sede", school.campusName(student.campusId)],
            [
              "Curso / Grado",
              student.gradeId === undefined ? (
                <span className="text-muted-foreground">Sin curso asignado</span>
              ) : (
                <Badge variant="outline">{school.gradeName(student.gradeId)}</Badge>
              ),
            ],
            ["Fecha de Nacimiento", user?.birthDate ? formatDate(user.birthDate) : undefined],
            ["Género", user?.gender ? GENDER_LABEL[user.gender] : undefined],
            ["Tipo de Sangre", student.bloodType],
          ]}
        />
      </SectionCard>
      <SectionCard title="Información de Contacto y Salud">
        <DetailList
          items={[
            ["Dirección de Residencia", user?.address],
            ["Barrio / Sector", student.neighborhood],
            ["Estrato", student.stratum],
            ["EPS", student.eps],
          ]}
        />
      </SectionCard>
    </>
  );
}

function ScheduleTab({ student, school }: { student: AcademicStudent; school: School }) {
  const grade = student.gradeId === undefined ? undefined : school.gradeById.get(student.gradeId);
  if (!grade) {
    return (
      <EmptyBlock
        title="El estudiante no está asignado a ningún curso."
        description="Asigne un curso en la pestaña de edición para ver el horario."
      />
    );
  }
  const rows = school.gradeScheduleRows(grade);
  const hasClasses = rows.some((row) => row.cells.some((cell) => cell !== null));

  return (
    <SectionCard
      title={`Horario Semanal: ${grade.name}`}
      action={
        <ScreenLinkButton screenId="SCH-11" size="sm" search={{ grade: String(grade.id) }}>
          Ver en pantalla completa
        </ScreenLinkButton>
      }
    >
      {hasClasses ? (
        <WeeklySchedule rows={rows} />
      ) : (
        <EmptyBlock
          title="No hay un horario generado para este curso todavía."
          description="Contacta con coordinación académica."
        />
      )}
    </SectionCard>
  );
}

function GuardiansTab({
  student,
  school,
  canManage,
}: {
  student: AcademicStudent;
  school: School;
  canManage: boolean;
}) {
  const links = school.parentLinks.filter((link) => link.studentId === student.id);

  return (
    <SectionCard
      title="Información de Acudientes"
      action={
        canManage ? (
          <ScreenLinkButton screenId="STU-04" size="sm" search={{ id: String(student.id) }}>
            Gestionar
          </ScreenLinkButton>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3">
        <span className="text-sm font-medium">Acudiente Principal</span>
        <DetailList
          items={[
            ["Nombre", student.guardianName],
            ["Teléfono", student.guardianPhone],
            ["Email", student.guardianEmail],
          ]}
        />
      </div>
      {links.map((link) => {
        const parent = school.userById.get(link.parentId);
        return (
          <div key={link.id} className="flex flex-col gap-3 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">{school.userName(link.parentId)}</span>
              <Badge variant="info">{link.relationship}</Badge>
            </div>
            <DetailList
              items={[
                [
                  "Usuario",
                  parent ? <span className="font-mono">{parent.username}</span> : undefined,
                ],
                ["Teléfono", parent?.phone],
                ["Email", parent?.email],
              ]}
            />
          </div>
        );
      })}
      {links.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">
          No hay acudientes vinculados con cuenta de usuario.
        </p>
      ) : null}
    </SectionCard>
  );
}
