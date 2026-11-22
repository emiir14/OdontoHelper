/**
 * When a collapsible section is expanded on mobile or compact viewports,
 * gently scrolls its nearest scrollable container just enough to bring
 * the header and the initial fields of the expanded body into view.
 */
export function revealExpandedSection(sectionEl: HTMLElement | null): void {
  if (!sectionEl || typeof window === 'undefined') return;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (!sectionEl.isConnected) return;

      let scrollParent: HTMLElement | null = sectionEl.parentElement;
      while (scrollParent) {
        const style = window.getComputedStyle(scrollParent);
        const overflowY = style.overflowY;
        if (
          (overflowY === 'auto' || overflowY === 'scroll') &&
          scrollParent.scrollHeight > scrollParent.clientHeight + 2
        ) {
          break;
        }
        scrollParent = scrollParent.parentElement;
      }

      const sectionRect = sectionEl.getBoundingClientRect();
      const viewportBottom = scrollParent
        ? scrollParent.getBoundingClientRect().bottom
        : window.innerHeight;
      const viewportTop = scrollParent
        ? scrollParent.getBoundingClientRect().top
        : 0;

      // Ensure header + first ~150px of newly expanded fields are visible
      const desiredBottom = Math.min(sectionRect.bottom, sectionRect.top + 220);
      const overflowBelow = desiredBottom - (viewportBottom - 16);
      if (overflowBelow <= 8) return;

      // Keep the section header visible within the top edge
      const maxSafeScroll = Math.max(0, sectionRect.top - (viewportTop + 12));
      const scrollDelta = Math.min(overflowBelow, maxSafeScroll);
      if (scrollDelta <= 4) return;

      if (scrollParent) {
        scrollParent.scrollBy({ top: scrollDelta, behavior: 'smooth' });
      } else {
        window.scrollBy({ top: scrollDelta, behavior: 'smooth' });
      }
    });
  });
}
