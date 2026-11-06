// Deliberately unlocalized fixture: never imported by the application.
const fixture = <div
  title={enabled ? "Tooltip fixture" : undefined}
  aria-label={`Caption fixture ${count}`}>
  {enabled ? "Conditional fixture" : t("common.cancel", undefined, "Ignored localized fallback")}
  {mode === "technical-comparison" && <span>{t("common.close")}</span>}
</div>;
const message = "Message fixture";
throw new Error("Error fixture");
