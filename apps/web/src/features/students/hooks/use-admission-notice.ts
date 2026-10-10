import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { orpc } from "@/app/orpc";

import { admissionNotice, overCapacityWarning, type AdmissionEnrolled } from "../lib/student-form";

/**
 * STU-R3 after a successful `student.create` / `student.complete`: the "Matrícula completada"
 * toast, then the over-capacity warning with the course capacity (`course.get`; the generic
 * warning when it cannot be read). Never blocks: the student is already admitted.
 */
export function useAdmissionNotice() {
  const queryClient = useQueryClient();

  return async (enrolled: AdmissionEnrolled, courseId: string | null) => {
    const notice = admissionNotice(enrolled);
    toast.success(notice.title, { description: notice.description });
    if (!enrolled?.overCapacity || courseId === null) {
      return;
    }
    const maxStudents = await queryClient
      .fetchQuery(orpc.course.get.queryOptions({ input: { id: courseId } }))
      .then((course) => course.maxStudents)
      .catch(() => null);
    const warning = overCapacityWarning(enrolled, maxStudents);
    if (warning) {
      toast.warning(warning);
    }
  };
}
