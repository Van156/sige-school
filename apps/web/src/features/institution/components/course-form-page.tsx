import { buttonVariants } from "@base-template/ui/components/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { GraduationCap } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { orpc } from "@/app/orpc";
import { CanGate } from "@/features/access-control";
import EmptyState from "@/shared/components/feedback/empty-state";
import Loader from "@/shared/components/feedback/loader";
import LoadError from "@/shared/components/feedback/load-error";
import PageHeader from "@/shared/components/layout/page-header";
import { isNotFoundError } from "@/shared/lib/orpc-error";

import {
  courseToFormValues,
  directorStatus,
  emptyCourseForm,
  type CourseInput,
} from "../lib/course-form";
import { useDirectorTeachers } from "../hooks/use-director-teachers";
import { INVALID_FORM_MESSAGE } from "../lib/form-messages";
import { campusChoices } from "../lib/level-form";
import ActiveInstitutionGuard from "./active-institution-guard";
import CourseForm from "./course-form";
import FormPageLayout, { HelpCard } from "./form-page-layout";

const BREADCRUMB_ROOT = { label: "Grados", to: "/cursos" } as const;

/**
 * INS-12 `/cursos/nuevo` and `/cursos/$id/editar` (container): create when `courseId` is omitted,
 * else edit. Forms are unreachable without the mutation permission (INS-R1).
 */
export default function CourseFormPage({ courseId }: { courseId?: string }) {
  const title = courseId === undefined ? "Nuevo Grado" : "Editar Grado";
  return (
    <ActiveInstitutionGuard pageName="sus grados">
      <CanGate
        permission={courseId === undefined ? "course:create" : "course:update"}
        message="No tienes permiso para gestionar los grados de esta institución."
      >
        <PageHeader
          title={title}
          description="Grupo específico de estudiantes en un año lectivo y sede"
          breadcrumbs={[BREADCRUMB_ROOT, { label: title }]}
        />
        <CourseFormLoader courseId={courseId} />
      </CanGate>
    </ActiveInstitutionGuard>
  );
}

function CourseFormLoader({ courseId }: { courseId?: string }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const isEdit = courseId !== undefined;
  const profileQuery = useQuery(orpc.institution.get.queryOptions());
  const campusesQuery = useQuery(orpc.campus.options.queryOptions());
  const levelsQuery = useQuery(orpc.level.list.queryOptions({ input: {} }));
  const [directorSearch, setDirectorSearch] = useState("");
  const { query: teachersQuery, term: teachersTerm } = useDirectorTeachers(directorSearch);
  const courseQuery = useQuery({
    ...orpc.course.get.queryOptions({ input: { id: courseId ?? "" } }),
    enabled: isEdit,
  });
  const createMutation = useMutation(orpc.course.create.mutationOptions());
  const updateMutation = useMutation(orpc.course.update.mutationOptions());

  if (isEdit && courseQuery.isError && isNotFoundError(courseQuery.error)) {
    return (
      <EmptyState
        icon={<GraduationCap />}
        title="Grado no encontrado"
        description="El grado no existe o ya fue eliminado."
        action={
          <Link to="/cursos" className={buttonVariants()}>
            Volver a Grados
          </Link>
        }
      />
    );
  }
  if (
    profileQuery.isError ||
    campusesQuery.isError ||
    levelsQuery.isError ||
    (isEdit && courseQuery.isError)
  ) {
    return (
      <LoadError
        message="No se pudo cargar el formulario."
        onRetry={() => {
          void profileQuery.refetch();
          void campusesQuery.refetch();
          void levelsQuery.refetch();
          if (isEdit) {
            void courseQuery.refetch();
          }
        }}
      />
    );
  }
  if (profileQuery.isPending || campusesQuery.isPending || levelsQuery.isPending) {
    return <Loader />;
  }
  if (isEdit && courseQuery.isPending) {
    return <Loader />;
  }

  const course = isEdit ? courseQuery.data : undefined;
  const save = async (run: () => Promise<unknown>, message: string) => {
    await run();
    toast.success(message);
    await queryClient.invalidateQueries({ queryKey: orpc.course.key() });
    await navigate({ to: "/cursos" });
  };

  return (
    <CourseFormFrame>
      <CourseForm
        mode={isEdit ? "edit" : "create"}
        initialValues={
          course
            ? courseToFormValues(course)
            : emptyCourseForm(profileQuery.data.currentAcademicYear)
        }
        campuses={campusChoices(campusesQuery.data, course)}
        levels={levelsQuery.data}
        directors={{
          teachers: teachersQuery.data ?? [],
          current: course,
          status: directorStatus(teachersQuery, teachersTerm),
          onSearchChange: setDirectorSearch,
          onRetry: () => void teachersQuery.refetch(),
        }}
        onInvalid={() => toast.error(INVALID_FORM_MESSAGE)}
        onSubmit={(input: CourseInput) =>
          course
            ? save(
                () => updateMutation.mutateAsync({ id: course.id, ...input }),
                "Grado actualizado",
              )
            : save(() => createMutation.mutateAsync(input), "Grado creado")
        }
      />
    </CourseFormFrame>
  );
}

function CourseFormFrame({ children }: { children: ReactNode }) {
  return (
    <FormPageLayout
      form={children}
      help={
        <HelpCard title="Información">
          <p className="font-medium text-foreground">¿Qué es un grado?</p>
          <p>Un grupo específico de estudiantes en un año lectivo y sede.</p>
          <p className="font-medium text-foreground">Nivel Académico</p>
          <p>Opcional. Solo se ofrecen los niveles de la sede elegida.</p>
          <p className="font-medium text-foreground">Director de Grupo</p>
          <p>Opcional. Solo profesores activos de la institución.</p>
          <p className="font-medium text-foreground">Capacidad</p>
          <p>Entre 1 y 60 estudiantes; evita el sobrecupo.</p>
        </HelpCard>
      }
    />
  );
}
