import { UserRoundSearch } from "lucide-react";

import EmptyState from "@/shared/components/feedback/empty-state";

import type { StudentPickerMode } from "../types";

const COPY: Readonly<Record<StudentPickerMode, { title: string; description: string }>> = {
  staff: {
    title: "Selecciona un estudiante",
    description: "Elige un estudiante en el selector para ver su información.",
  },
  children: {
    title: "Sin estudiante disponible",
    description: "Tu cuenta no tiene un estudiante vinculado.",
  },
  self: {
    title: "Sin estudiante disponible",
    description: "Tu cuenta no tiene un estudiante vinculado.",
  },
};

/**
 * Empty state of a per-student screen (sige/05 §5.6): staff have not chosen a student yet; a
 * parent or student account has no student to show. Presentational.
 */
export default function NoStudentBlock({ mode }: { mode: StudentPickerMode }) {
  const copy = COPY[mode];
  return (
    <div className="rounded-lg border border-dashed">
      <EmptyState icon={<UserRoundSearch />} title={copy.title} description={copy.description} />
    </div>
  );
}
