// A small line-height or relative leading can paint glyphs outside the normal
// line box. Reserve that overflow on the editor frame, without changing the
// authored paragraphs, line-height, selection or persisted innerHTML.
export function observeRichTextFieldBounds(editor: HTMLElement) {
  const view = editor.ownerDocument.defaultView;
  if (!view) return () => {};
  const original = {
    top: editor.style.paddingTop,
    bottom: editor.style.paddingBottom,
  };
  let frame = 0;
  let disposed = false;
  const fit = () => {
    frame = 0;
    if (disposed || !editor.isConnected) return;
    editor.style.paddingTop = original.top;
    editor.style.paddingBottom = original.bottom;
    const box = editor.getBoundingClientRect();
    if (!box.width || !box.height) return;
    const style = view.getComputedStyle(editor);
    // Fixed, clipped title/card viewports have their own fit-to-box behavior.
    if (style.overflowY === 'hidden' || style.overflowY === 'clip') return;
    const baseTop = parseFloat(style.paddingTop) || 0;
    const baseBottom = parseFloat(style.paddingBottom) || 0;
    let top = box.top;
    let bottom = box.bottom;
    const walker = editor.ownerDocument.createTreeWalker(editor, 4);
    while (walker.nextNode()) {
      const text = walker.currentNode;
      if (!text.textContent?.trim()) continue;
      const range = editor.ownerDocument.createRange();
      range.selectNodeContents(text);
      for (const rect of Array.from(range.getClientRects())) {
        if (!rect.width || !rect.height) continue;
        top = Math.min(top, rect.top);
        bottom = Math.max(bottom, rect.bottom);
      }
    }
    const extraTop = Math.ceil(box.top - top);
    const extraBottom = Math.ceil(bottom - box.bottom);
    if (extraTop > 0) editor.style.paddingTop = `${baseTop + extraTop}px`;
    if (extraBottom > 0) editor.style.paddingBottom = `${baseBottom + extraBottom}px`;
  };
  const schedule = () => {
    if (!frame && !disposed) frame = view.requestAnimationFrame(fit);
  };
  const observer = new view.MutationObserver(records => {
    // Frame padding is our own output. Only content mutations need a new fit.
    if (records.some(record => record.target !== editor || record.type !== 'attributes')) schedule();
  });
  observer.observe(editor, { subtree: true, childList: true, characterData: true, attributes: true });
  view.addEventListener('resize', schedule);
  editor.ownerDocument.fonts?.addEventListener('loadingdone', schedule);
  let width = editor.getBoundingClientRect().width;
  const resize = new view.ResizeObserver(entries => {
    const nextWidth = entries[0]?.contentRect.width ?? width;
    if (nextWidth !== width) { width = nextWidth; schedule(); }
  });
  resize.observe(editor);
  fit();
  return () => {
    disposed = true;
    if (frame) view.cancelAnimationFrame(frame);
    observer.disconnect();
    resize.disconnect();
    view.removeEventListener('resize', schedule);
    editor.ownerDocument.fonts?.removeEventListener('loadingdone', schedule);
    editor.style.paddingTop = original.top;
    editor.style.paddingBottom = original.bottom;
  };
}
