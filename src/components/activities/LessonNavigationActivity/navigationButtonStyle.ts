import type { CSSProperties } from "react";
import type { PaideiaBlock } from "../../../types/project";

export function defaultButtonBackgroundColor(_blockType: string) {
  return "#123a7a";
}

export function defaultButtonTextColor(_blockType: string) {
  return "#ffffff";
}

export function blockButtonStyle(block: PaideiaBlock): CSSProperties {
  return {
    backgroundColor: block.buttonBackgroundColor ?? defaultButtonBackgroundColor(block.type),
    color: block.buttonTextColor ?? defaultButtonTextColor(block.type)
  };
}
