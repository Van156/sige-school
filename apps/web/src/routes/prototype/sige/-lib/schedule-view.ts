import type { ScheduleCell, ScheduleRow } from "../-mock";
import type { DayOfWeek, ScheduleBlock } from "../-mock/types";

export interface ScheduleEntry {
  dayOfWeek: DayOfWeek;
  startTime: string;
  cell: ScheduleCell;
}

/**
 * Weekly grid rows: one per distinct time slot of `blocks` (sorted by start time, breaks flagged)
 * with the entry that starts at that slot on each weekday. Used by the live SCH-11 and STU-02 views.
 */
export function buildScheduleRows(
  blocks: readonly ScheduleBlock[],
  entries: readonly ScheduleEntry[],
): ScheduleRow[] {
  const slots = new Map<string, ScheduleBlock>();
  for (const block of blocks) {
    const key = `${block.startTime}-${block.endTime}`;
    const known = slots.get(key);
    // A slot is a break only when every block sharing it is a break.
    if (!known) slots.set(key, block);
    else if (!block.isBreak && known.isBreak) slots.set(key, block);
  }
  return [...slots.values()]
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
    .map((block) => ({
      blockId: block.id,
      label: `${block.startTime} - ${block.endTime}`,
      isBreak: block.isBreak,
      cells: ([0, 1, 2, 3, 4] as DayOfWeek[]).map(
        (day) =>
          entries.find((entry) => entry.dayOfWeek === day && entry.startTime === block.startTime)
            ?.cell ?? null,
      ),
    }));
}
