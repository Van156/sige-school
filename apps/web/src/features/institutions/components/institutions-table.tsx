import { useMemo } from "react";
import { Building2 } from "lucide-react";

import { SimpleListTable } from "@/shared/components/data-table/simple-list-table";
import { useLocalTableSearch } from "@/shared/hooks/use-local-table-search";
import { applyClientList } from "@/shared/lib/data-table/client-list";

import {
  institutionsAccessors,
  institutionsSearchConfig,
  institutionsSearchSchema,
  toInstitutionsListState,
} from "../lib/institutions-list";
import type { InstitutionRow } from "../types";
import { getInstitutionsColumns } from "./institutions-columns";

/** INS-01 listing in a client-side data table (the whole list is in memory). */
export default function InstitutionsTable({
  institutions,
  isPending,
  errorMessage,
  onRetry,
}: {
  institutions: InstitutionRow[];
  isPending: boolean;
  errorMessage: string | null;
  onRetry: () => void;
}) {
  const { search, onSearchChange } = useLocalTableSearch(institutionsSearchSchema);
  const { rows, total } = applyClientList(
    institutions,
    toInstitutionsListState(search),
    institutionsAccessors,
  );
  const columns = useMemo(() => getInstitutionsColumns(), []);

  return (
    <SimpleListTable
      search={search}
      searchConfig={institutionsSearchConfig}
      onSearchChange={onSearchChange}
      columns={columns}
      emptyTitle="Sin resultados"
      emptyIcon={<Building2 />}
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
