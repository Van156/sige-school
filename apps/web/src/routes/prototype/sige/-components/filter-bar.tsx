import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@base-template/ui/components/input-group";
import { Search } from "lucide-react";
import type { ReactNode } from "react";

/** Search box plus a slot for extra filters (selects, toggles) above a list. */
export function FilterBar({
  query,
  onQueryChange,
  placeholder = "Buscar",
  children,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  placeholder?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <InputGroup className="sm:max-w-xs">
        <InputGroupAddon>
          <Search />
        </InputGroupAddon>
        <InputGroupInput
          aria-label={placeholder}
          placeholder={placeholder}
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
      </InputGroup>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}
