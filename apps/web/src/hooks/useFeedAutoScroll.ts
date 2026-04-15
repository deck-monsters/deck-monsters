import { useCallback, useRef } from 'react';

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

  return {
    shouldFollowRef,
    onAtBottomChange,
    resetToBottom,
    enable,
  };
}

