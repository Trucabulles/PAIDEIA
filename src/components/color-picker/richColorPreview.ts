// A CSS Highlight previews text color without modifying contentEditable HTML,
// native undo history, table topology or persisted lesson content.
export function createRichColorPreview(trigger: HTMLElement | null, range: Range | null, variant: string) {
  if (!trigger?.closest('.rich-toolbar') || !range || variant === 'swatch') return null;
  const document = trigger.ownerDocument;
  const element = range.commonAncestorContainer.nodeType === 1
    ? range.commonAncestorContainer as Element : range.commonAncestorContainer.parentElement;
  const editor = element?.closest<HTMLElement>('[contenteditable="true"]');
  if (!editor) return null;
  const view = document.defaultView!;
  const registry = (view.CSS as typeof CSS & { highlights?: Map<string, unknown> }).highlights;
  const HighlightClass = (view as unknown as { Highlight?: new (...ranges: Range[]) => unknown }).Highlight;
  if (!registry || !HighlightClass) return null;
  const ranges: Range[] = [];
  const cells = editor.querySelectorAll('td.paideia-rich-table-cell-selected,th.paideia-rich-table-cell-selected');
  if (cells.length) cells.forEach(cell => { const r = document.createRange(); r.selectNodeContents(cell); ranges.push(r); });
  else if (!range.collapsed) ranges.push(range.cloneRange());
  const name = `paideia-hsv-${Math.random().toString(36).slice(2)}`;
  const style = document.createElement('style');
  document.head.append(style);
  registry.set(name, new HighlightClass(...ranges));
  const selectorFor = (node: Element): string => {
    if (node === document.documentElement) return 'html';
    const parent = node.parentElement;
    return parent ? `${selectorFor(parent)} > :nth-child(${Array.from(parent.children).indexOf(node) + 1})` : '';
  };
  const selector = selectorFor(editor);
  return {
    update(color: string) {
      style.textContent = variant === 'field-fill'
        ? `${selector}{background-color:${color}!important;}`
        : `::highlight(${name}){${variant === 'highlight' ? 'background-color' : 'color'}:${color};}
          ${selector}::selection,${selector} *::selection{${variant === 'highlight' ? 'background-color' : 'color'}:${color};${variant === 'font-color' ? 'background-color:rgba(37,107,220,.15);' : ''}}`;
    },
    finish() {
      style.remove(); registry.delete(name);
      if (editor.isConnected) {
        const selection = view.getSelection();
        selection?.removeAllRanges(); selection?.addRange(range);
      }
    }
  };
}
