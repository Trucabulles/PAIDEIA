const RESPONSIVE_TABLE_WRAPPER_CLASS = "paideia-responsive-table-scroll";

export function wrapResponsiveRichTextTables(html: string) {
  if (!html || !/<table[\s>]/i.test(html)) return html;

  const template = document.createElement("template");
  template.innerHTML = html;

  template.content.querySelectorAll<HTMLTableElement>("table").forEach((table) => {
    if (table.dataset.paideiaLayout === "columns" || table.getAttribute("role") === "presentation") return;

    table.dataset.paideiaResponsiveTable = "true";
    const existingWrapper = table.parentElement?.matches(
      ".paideia-rich-table-wrapper, .paideia-responsive-table-scroll"
    ) ? table.parentElement : null;
    if (existingWrapper) {
      existingWrapper.classList.add(RESPONSIVE_TABLE_WRAPPER_CLASS);
      existingWrapper.tabIndex = 0;
      existingWrapper.setAttribute("role", "region");
      existingWrapper.setAttribute("aria-label", "Tableau défilable horizontalement");
      return;
    }

    const wrapper = document.createElement("div");
    wrapper.className = RESPONSIVE_TABLE_WRAPPER_CLASS;
    wrapper.tabIndex = 0;
    wrapper.setAttribute("role", "region");
    wrapper.setAttribute("aria-label", "Tableau défilable horizontalement");
    table.before(wrapper);
    wrapper.append(table);
  });

  return template.innerHTML;
}
