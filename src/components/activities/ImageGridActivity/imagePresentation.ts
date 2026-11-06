export function imageGridImageShouldContain(fileName?: string | null) {
  const normalized = fileName?.trim() ?? "";
  return /_cropped(?:_\d+)?(?:\.[^.]+)?$/iu.test(normalized);
}
