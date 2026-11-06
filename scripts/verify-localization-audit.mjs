import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const result = spawnSync(process.execPath, ["scripts/audit-localization.mjs",
  "scripts/fixtures/localization-audit.tsx"], { encoding: "utf8" });
assert.equal(result.status, 1);
for (const text of ["Tooltip fixture", "Caption fixture", "Conditional fixture", "Message fixture", "Error fixture"]) {
  assert.ok(result.stderr.includes(text), `audit must detect ${text}`);
}
assert.ok(!result.stderr.includes("Ignored localized fallback"));
assert.ok(!result.stderr.includes("technical-comparison"));
console.log("Localization audit: conditional attributes/text, templates and errors detected; translations and comparisons excluded.");
