import { GraduationCap } from "lucide-react";
import { useMemo } from "react";

import type { DataTableSearchChange } from "@/shared/hooks/use-data-table";

import { SimpleListTable } from "@/shared/components/data-table/simple-list-table";

import { courseSearchConfig, type CourseSearch } from "../lib/course-list";
import type { CourseRow } from "../types";
import {
  getCourseColumns,
  HIDDEN_FILTER_COLUMNS,
  type CourseFilterOptions,
} from "./course-columns";

/**
 * INS-11 listing in a URL-driven server table. Presentational: the caller owns the `course.list`
 * query state; row actions are shown only when `canManage`, and `onDelete` just asks the caller
 * to confirm.
 */
export default function CoursesTable({
  search,
  onSearchChange,
  list,
  filterOptions,
  canManage,
  onDelete,
}: {
  search: CourseSearch;
  onSearchChange: DataTableSearchChange;
  list: {
    rows: CourseRow[] | undefined;
    total: number | undefined;
    isPending: boolean;
    isFetching: boolean;
    isPlaceholderData: boolean;
    errorMessage: string | null;
    onRetry: () => void;
  };
  filterOptions: CourseFilterOptions;
  canManage: boolean;
  onDelete: (course: CourseRow) => void;
}) {
  const columns = useMemo(
    () => getCourseColumns({ canManage, filterOptions, onDelete }),
    [canManage, filterOptions, onDelete],
  );
  return (
    <SimpleListTable
      search={search}
      searchConfig={courseSearchConfig}
      onSearchChange={onSearchChange}
      columns={columns}
      initialState={{ columnVisibility: HIDDEN_FILTER_COLUMNS }}
      emptyTitle="Sin resultados"
      emptyIcon={<GraduationCap />}
      list={list}
    />
  );
}
