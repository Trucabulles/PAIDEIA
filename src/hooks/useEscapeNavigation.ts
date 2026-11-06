import { useEffect, useRef } from "react";

function isEditingTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && Boolean(
    target.closest("input, textarea, select, [contenteditable='true']")
  );
}

type EscapeNavigationOptions = {
  capture?: boolean;
  consume?: boolean;
};

export function useEscapeNavigation(
  active: boolean,
  onBack: () => void,
  options: EscapeNavigationOptions = {}
) {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;
  const capture = options.capture ?? false;
  const consume = options.consume ?? false;

  useEffect(() => {
    if (!active) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (
        event.key !== "Escape" ||
        event.defaultPrevented ||
        event.ctrlKey ||
        event.altKey ||
        event.metaKey ||
        isEditingTarget(event.target) ||
        document.querySelector("[aria-modal='true'], .paideia-modal-backdrop")
      ) return;

      event.preventDefault();
      if (consume) {
        event.stopPropagation();
        event.stopImmediatePropagation();
      }
      onBackRef.current();
    };

    window.addEventListener("keydown", handleEscape, capture);
    return () => window.removeEventListener("keydown", handleEscape, capture);
  }, [active, capture, consume]);
}
