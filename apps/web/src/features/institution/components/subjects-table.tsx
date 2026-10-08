import { BookOpen } from "lucide-react";
import { useMemo } from "react";

import { SimpleListTable } from "@/shared/components/data-table/simple-list-table";
import { useLocalTableSearch } from "@/shared/hooks/use-local-table-search";
import { applyClientList } from "@/shared/lib/data-table/client-list";

import {
  subjectAccessors,
  subjectSearchConfig,
  subjectSearchSchema,
  toSubjectListState,
} from "../lib/subject-list";
import type { SubjectRow } from "../types";
import { getSubjectColumns } from "./subject-columns";

/**
 * INS-13 listing in a client-side data table (the whole bounded list is in memory). Presentational:
 * row actions are shown only when `canManage`; `onDelete` just asks the caller to confirm.
 */
export default function SubjectsTable({
  subjects,
  canManage,
  isPending,
  errorMessage,
  onRetry,
  onDelete,
}: {
  subjects: SubjectRow[];
  canManage: boolean;
  isPending: boolean;
  errorMessage: string | null;
  onRetry: () => void;
  onDelete: (subject: SubjectRow) => void;
}) {
  const { search, onSearchChange } = useLocalTableSearch(subjectSearchSchema);
  const { rows, total } = applyClientList(subjects, toSubjectListState(search), subjectAccessors);
  const columns = useMemo(() => getSubjectColumns({ canManage, onDelete }), [canManage, onDelete]);

  return (
    <SimpleListTable
      search={search}
      searchConfig={subjectSearchConfig}
      onSearchChange={onSearchChange}
      columns={columns}
      emptyTitle="Sin resultados"
      emptyIcon={<BookOpen />}
      list={{
        rows,
        total,
        isPending,
        isFetching: false,
        isPlaceholderData: false,
        errorMessage,
        onRetry,
      }}
    />
  );
}
