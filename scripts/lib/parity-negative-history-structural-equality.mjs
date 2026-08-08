export function structuralEqual(left, right) {
  if (left === right) return true;
  if (typeof left !== typeof right) return false;
  if (left === null || right === null) return false;
  const leftArray = Array.isArray(left);
  const rightArray = Array.isArray(right);
  if (leftArray !== rightArray) return false;
  if (leftArray) {
    if (left.length !== right.length) return false;
    return left.every((value, index) => structuralEqual(value, right[index]));
  }
  if (typeof left !== "object") return false;
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  for (const key of leftKeys) {
    if (!Object.prototype.hasOwnProperty.call(right, key)) return false;
    if (!structuralEqual(left[key], right[key])) return false;
  }
  return true;
}
