/** Travel limits account for contain letterboxing, so inspection never loses the image. */
export function inspectionBounds(width: number, height: number, aspect: number, scale: number) {
  'worklet';
  const imageWidth = Math.min(width, height * aspect);
  const imageHeight = imageWidth / aspect;
  return { x: Math.max(0, (imageWidth * scale - width) / 2), y: Math.max(0, (imageHeight * scale - height) / 2) };
}
