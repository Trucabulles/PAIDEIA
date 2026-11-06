export { normalizeRecognition as normalizeDesignerText } from './designerRecognition.mjs';

export function designerEditDistance(left: string, right: string) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    let diagonal = previous[0];
    previous[0] = leftIndex;
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const above = previous[rightIndex];
      previous[rightIndex] = Math.min(previous[rightIndex] + 1, previous[rightIndex - 1] + 1, diagonal + Number(left[leftIndex - 1] !== right[rightIndex - 1]));
      diagonal = above;
    }
  }
  return previous[right.length];
}
