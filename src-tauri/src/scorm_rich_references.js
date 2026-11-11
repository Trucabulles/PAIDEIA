function setupRichReferences() {
  const tooltip = document.createElement("aside");
  tooltip.id = "paideia-rich-reference-tooltip-active";
  tooltip.className = "paideia-rich-reference-tooltip";
  tooltip.setAttribute("role", "tooltip");
  tooltip.hidden = true;

  const scroll = document.createElement("div");
  scroll.className = "paideia-reference-scroll";
  const content = document.createElement("div");
  content.className = "rich-content";
  scroll.append(content);
  const hint = document.createElement("span");
  hint.className = "paideia-reference-scroll-hint";
  hint.setAttribute("aria-hidden", "true");
  tooltip.append(scroll, hint);
  document.body.append(tooltip);

  let activeTrigger = null;
  let pinnedTrigger = null;
  let closeTimer;
  function cancelScheduledClose() { window.clearTimeout(closeTimer); }
  function scheduleClose() {
    cancelScheduledClose();
    closeTimer = window.setTimeout(close, 160);
  }
  function setExpanded(trigger, expanded) {
    if (!trigger) return;
    trigger.setAttribute("aria-expanded", String(expanded));
    if (expanded) trigger.setAttribute("aria-describedby", tooltip.id);
    else trigger.removeAttribute("aria-describedby");
  }
  function close() {
    cancelScheduledClose();
    setExpanded(activeTrigger, false);
    tooltip.hidden = true;
    activeTrigger = null;
    pinnedTrigger = null;
  }
  function updateHint() {
    hint.hidden = scroll.scrollHeight - scroll.clientHeight - scroll.scrollTop <= 2;
  }
  function position() {
    if (!activeTrigger || tooltip.hidden) return;
    const savedScroll = scroll.scrollTop;
    const rect = activeTrigger.getBoundingClientRect();
    const margin = 16;
    const gap = 8;
    const height = tooltip.offsetHeight + scroll.scrollHeight - scroll.clientHeight;
    const below = Math.max(0, window.innerHeight - rect.bottom - gap - margin);
    const above = Math.max(0, rect.top - gap - margin);
    const placeBelow = height <= below || (height > above && below >= above);
    const available = placeBelow ? below : above;
    const left = Math.max(margin, Math.min(rect.left, window.innerWidth - tooltip.offsetWidth - margin));
    const top = placeBelow ? rect.bottom + gap : rect.top - gap - Math.min(available, height);
    tooltip.style.left = left + "px";
    tooltip.style.top = Math.max(margin, top) + "px";
    tooltip.style.maxHeight = available + "px";
    scroll.tabIndex = height > available ? 0 : -1;
    scroll.scrollTop = savedScroll;
    updateHint();
  }
  function open(trigger) {
    cancelScheduledClose();
    if (activeTrigger === trigger) return;
    setExpanded(activeTrigger, false);
    const target = trigger.getAttribute("data-paideia-bookmark-target") || "";
    const source = Array.from(document.querySelectorAll("[data-paideia-bookmark-id]")).find(node =>
      node.getAttribute("data-paideia-bookmark-id") === target);
    const definition = trigger.getAttribute("data-paideia-reference-definition");
    if (source || definition) content.innerHTML = source ? source.innerHTML : definition;
    else content.textContent = "Renvoi cassé : balise introuvable.";
    activeTrigger = trigger;
    tooltip.hidden = false;
    scroll.scrollTop = 0;
    setExpanded(trigger, true);
    position();
  }
  function pin(trigger) {
    if (pinnedTrigger === trigger) close();
    else { pinnedTrigger = trigger; open(trigger); }
  }
  document.querySelectorAll("[data-paideia-reference-id]").forEach(trigger => {
    trigger.setAttribute("role", "button");
    trigger.tabIndex = 0;
    trigger.addEventListener("pointerenter", event => {
      if (!pinnedTrigger && event.pointerType !== "touch" && event.pointerType !== "pen") open(trigger);
    });
    trigger.addEventListener("pointerleave", event => {
      if (!pinnedTrigger && activeTrigger === trigger && !tooltip.contains(event.relatedTarget)) scheduleClose();
    });
    trigger.addEventListener("focus", () => { if (!pinnedTrigger) open(trigger); });
    trigger.addEventListener("blur", event => {
      if (!pinnedTrigger && activeTrigger === trigger && !tooltip.contains(event.relatedTarget)) close();
    });
    trigger.addEventListener("click", event => { event.preventDefault(); event.stopPropagation(); pin(trigger); });
    trigger.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); pin(trigger); }
    });
  });
  tooltip.addEventListener("pointerenter", cancelScheduledClose);
  tooltip.addEventListener("pointerleave", event => {
    if (!pinnedTrigger && !activeTrigger?.contains(event.relatedTarget)) scheduleClose();
  });
  document.addEventListener("click", event => {
    if (activeTrigger && !tooltip.contains(event.target)) close();
  });
  document.addEventListener("keydown", event => { if (event.key === "Escape") close(); });
  scroll.addEventListener("scroll", updateHint);
  window.addEventListener("resize", position);
  window.addEventListener("scroll", event => { if (event.target !== scroll) position(); }, true);
  if (typeof ResizeObserver !== "undefined") new ResizeObserver(position).observe(content);
}
