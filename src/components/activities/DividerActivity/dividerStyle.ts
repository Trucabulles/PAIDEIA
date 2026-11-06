import type { CSSProperties } from "react";
import type { PaideiaBlock } from "../../../types/project";

export function blockDividerStyle(block: PaideiaBlock): CSSProperties {
  return {
    borderTopColor: block.dividerColor ?? "rgba(18, 58, 122, 0.22)",
    borderTopWidth: block.dividerWidth ?? "2px",
    borderTopStyle: (block.dividerStyle ?? "solid") as CSSProperties["borderTopStyle"]
  };
}
