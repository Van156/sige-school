import { achievementStore, studentAchievementStore, useMockCollection } from "../-mock";
import type { Achievement, AchievementCategory, Role } from "../-mock/types";
import type { BadgeTone } from "./roles";

export const ACHIEVEMENT_CATEGORIES: readonly AchievementCategory[] = [
  "académico",
  "mejora",
  "asistencia",
  "comportamiento",
];

export const ACHIEVEMENT_CATEGORY_LABEL: Record<AchievementCategory, string> = {
  académico: "Académico",
  mejora: "Mejora",
  asistencia: "Asistencia",
  comportamiento: "Comportamiento",
};

export const ACHIEVEMENT_CATEGORY_TONE: Record<AchievementCategory, BadgeTone> = {
  académico: "info",
  mejora: "success",
  asistencia: "warning",
  comportamiento: "secondary",
};

/** Root, admin and coordinator award achievements and run the engine; teachers only read. */
export function canManageAchievements(role: Role): boolean {
  return role === "root" || role === "admin" || role === "coordinator";
}

/** Live catalogue and earned achievements with the per-achievement and per-student counters. */
export function useAchievementData() {
  const catalog = useMockCollection(achievementStore).filter((item) => item.isActive);
  const earned = useMockCollection(studentAchievementStore);
  const catalogById = new Map<number, Achievement>(catalog.map((item) => [item.id, item]));

  return {
    catalog,
    earned,
    catalogById,
    timesAwarded: (achievementId: number) =>
      earned.filter((row) => row.achievementId === achievementId).length,
    earnedBy: (studentId: number) => earned.filter((row) => row.studentId === studentId),
  };
}

export type AchievementData = ReturnType<typeof useAchievementData>;
