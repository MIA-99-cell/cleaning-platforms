import { useEffect } from 'react';

/** Prevent the page behind a modal/drawer from stealing scroll on mobile. */
export const useLockBodyScroll = (locked) => {
  useEffect(() => {
    if (!locked) return undefined;
    const prevHtml = document.documentElement.style.overflow;
    const prevBody = document.body.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = prevHtml;
      document.body.style.overflow = prevBody;
    };
  }, [locked]);
};

export default useLockBodyScroll;
