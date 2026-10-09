import { useQuery } from "@tanstack/react-query";

import { orpc } from "@/app/orpc";
import { USER_OPTIONS_MAX_LIMIT } from "@base-template/api/sige/schemas/user";

/**
 * The active teachers INS-12's "Director de Grupo" offers (`user.options`, role `teacher`),
 * ordered by name. `user.options` is capped at `USER_OPTIONS_MAX_LIMIT`.
 */
export function useDirectorTeachers() {
  return useQuery(
    orpc.user.options.queryOptions({ input: { role: "teacher", limit: USER_OPTIONS_MAX_LIMIT } }),
  );
}
