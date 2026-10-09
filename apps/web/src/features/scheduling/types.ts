import type { z } from "zod";

import type {
  classroomTypeSchema,
  timeBlockShiftSchema,
} from "@base-template/api/sige/schemas/scheduling";

/** `classroom_type` values (sige/04 §2). */
export type ClassroomType = z.infer<typeof classroomTypeSchema>;

/** Time block jornada values (sige/04 §4.1). */
export type TimeBlockShift = z.infer<typeof timeBlockShiftSchema>;

/** A row of `classroom.list` / the result of `classroom.get` (sige/04 §3.4). */
export type ClassroomRow = {
  id: string;
  campusId: string;
  campusName: string;
  name: string;
  code: string;
  capacity: number;
  floor: number;
  building: string | null;
  classroomType: ClassroomType;
  resources: Record<string, unknown> | null;
};

/** `classroom.stats` (sige/04 §3.4). */
export type ClassroomStats = { total: number; aulas: number; laboratorios: number };

/** A row of `timeBlock.list` / the result of `timeBlock.get`; times are `HH:MM` (sige/04 §3.4). */
export type TimeBlockRow = {
  id: string;
  campusId: string;
  campusName: string;
  name: string;
  shift: TimeBlockShift;
  startTime: string;
  endTime: string;
  isBreak: boolean;
  orderNum: number;
  academicYear: string;
  inUse: boolean;
};
