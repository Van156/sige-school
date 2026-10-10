import type { SlotCell } from "@base-template/sige-core";
import { useMutation } from "@tanstack/react-query";

import { orpc } from "@/app/orpc";
import { useDeleteEntity } from "@/features/institution";

import { REMOVE_SLOT_SUCCESS, slotDeleteName } from "../lib/schedule-view";

/** A grid class awaiting removal; `name` is what the shared delete flow reports. */
type SlotTarget = SlotCell & { id: string; name: string };

/**
 * Container logic of the grid's per-class "x" (SCH-11, `schedule.deleteSlot`): remembers the class
 * awaiting confirmation and runs the shared delete flow, so a server refusal toasts its own
 * message. Spread `dialog` into `ConfirmDelete`.
 */
export function useRemoveSlot() {
  const deleteSlot = useMutation(orpc.schedule.deleteSlot.mutationOptions());
  const deletion = useDeleteEntity<SlotTarget>({
    remove: (slot) => deleteSlot.mutateAsync({ slotId: slot.slotId }),
    invalidate: orpc.schedule.key(),
    successMessage: () => REMOVE_SLOT_SUCCESS,
  });
  return {
    requestRemove: (cell: SlotCell) =>
      deletion.requestDelete({ ...cell, id: cell.slotId, name: slotDeleteName(cell) }),
    dialog: deletion.dialog,
  };
}
