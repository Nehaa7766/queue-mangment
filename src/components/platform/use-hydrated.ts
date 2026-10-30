import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

// False during the server render and until React hydrates, then true. Forms
// keep their submit buttons disabled until then: an early click would do a
// native GET submit and put the field values in the URL.
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
