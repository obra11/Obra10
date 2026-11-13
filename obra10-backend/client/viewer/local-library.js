export async function cachedDrawing(_file, parse) {
  return parse();
}
export async function cachedDrawingFromBuffer(_file, _buffer, parse) {
  return parse();
}
export async function saveFile() {}
export async function listFiles() {
  return [];
}
export function fileKey() {
  return '';
}
export async function fontRecords() {
  return [];
}
export async function saveFont() {}
