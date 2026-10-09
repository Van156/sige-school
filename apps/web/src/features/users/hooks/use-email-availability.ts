import { useQuery } from "@tanstack/react-query";

import { orpc } from "@/app/orpc";
import { useDebouncedValue } from "@/shared/hooks/use-debounced-value";

import {
  EMAIL_CHECK_DEBOUNCE_MS,
  emailAvailability,
  emailCheckCandidate,
  type EmailAvailability,
} from "../lib/email-availability";

/**
 * USR-02 live email availability: asks `user.checkEmail` once the debounced address is valid.
 * The endpoint is rate-limited (30/min), so a failed call is shown, not retried.
 */
export function useEmailAvailability(email: string): EmailAvailability {
  const candidate = emailCheckCandidate(email);
  const settled = useDebouncedValue(candidate, EMAIL_CHECK_DEBOUNCE_MS);
  const query = useQuery({
    ...orpc.user.checkEmail.queryOptions({ input: { email: settled ?? "" } }),
    enabled: settled !== null,
    retry: false,
  });

  return emailAvailability({
    candidate,
    pending: candidate !== settled,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    data: query.data,
  });
}
