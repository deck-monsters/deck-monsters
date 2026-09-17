import { useCallback, useMemo, useRef } from 'react';

export function useFeedAutoScroll() {
  const shouldFollowRef = useRef(true);

  const onAtBottomChange = useCallback((atBottom: boolean) => {
    shouldFollowRef.current = atBottom;
  }, []);

  const resetToBottom = useCallback(() => {
    shouldFollowRef.current = true;
  }, []);

  const enable = useCallback(() => {
    shouldFollowRef.current = true;
  }, []);

  /*
   * Memoised, because consumers put this object in effect dependency arrays. Returning a
   * fresh object literal each render made `[isActive, autoScroll]` in ConsolePane re-run on
   * *every* render — and since appending a console event renders, an active console that the
   * reader had scrolled up was re-pinned to the bottom by the next event. That is the same
   * symptom #129 fixed in the append path, arriving through the "became active" path
   * instead, which is why removing the one imperative scroll was not enough.
   * See 10b-bugs-fixed.md #132.
   */
  return useMemo(
    () => ({
      shouldFollowRef,
      onAtBottomChange,
      resetToBottom,
      enable,
    }),
    [onAtBottomChange, resetToBottom, enable]
  );
}
