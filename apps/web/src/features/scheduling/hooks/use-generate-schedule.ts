import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { orpc } from "@/app/orpc";

import {
  EXISTING_CHECK_LIMIT,
  targetCourses,
  toGenerateInput,
  type GenerationCourse,
  type GenerationParams,
  type GenerationPhase,
} from "../lib/schedule-generation";
import { hasScheduledClasses } from "../lib/schedule-view";

/**
 * Container logic of SCH-12: a run first probes whether the target courses already have classes
 * (`schedule.get`) and asks to replace them, then calls `schedule.generate`. A probe that fails or
 * covers too many courses asks for confirmation too, the safe side of "replace".
 */
export function useGenerateSchedule(courses: readonly GenerationCourse[]) {
  const queryClient = useQueryClient();
  const generate = useMutation(orpc.schedule.generate.mutationOptions());
  const [phase, setPhase] = useState<GenerationPhase>({ name: "idle" });

  async function hasExistingClasses(targets: readonly GenerationCourse[]): Promise<boolean> {
    if (targets.length === 0) {
      return false;
    }
    if (targets.length > EXISTING_CHECK_LIMIT) {
      return true;
    }
    try {
      const schedules = await Promise.all(
        targets.map((course) =>
          queryClient.fetchQuery({
            ...orpc.schedule.get.queryOptions({ input: { view: "course", courseId: course.id } }),
            staleTime: 0,
          }),
        ),
      );
      return schedules.some(hasScheduledClasses);
    } catch {
      return true;
    }
  }

  async function run(params: GenerationParams) {
    const targets = targetCourses(courses, params);
    setPhase({ name: "running" });
    try {
      const result = await generate.mutateAsync(toGenerateInput(params));
      await queryClient.invalidateQueries({ queryKey: orpc.schedule.key() });
      setPhase({ name: "done", result, viewCourseId: targets[0]?.id });
    } catch {
      setPhase({ name: "failed" });
    }
  }

  return {
    phase,
    /** Starts a run: straight to generation, or to the replace confirmation. */
    async request(params: GenerationParams) {
      setPhase({ name: "checking" });
      if (await hasExistingClasses(targetCourses(courses, params))) {
        setPhase({ name: "confirming", params });
        return;
      }
      await run(params);
    },
    /** Replace confirmed: runs without awaiting, so the dialog closes and the progress card shows. */
    confirm() {
      if (phase.name === "confirming") {
        void run(phase.params);
      }
    },
    /** Dialog dismissed; a no-op once the run has started (the dialog also closes on confirm). */
    cancel() {
      setPhase((current) => (current.name === "confirming" ? { name: "idle" } : current));
    },
  };
}
