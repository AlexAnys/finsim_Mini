/**
 * Deterministic hash → HSL color for course badges.
 * Same courseId always maps to the same hue so blocks stay stable across
 * renders, months, and devices.
 */
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export interface CourseColorStyle {
  backgroundColor: string;
  color: string;
  borderColor: string;
}

/**
 * Given a courseId, returns CSS background/foreground/border colors that work
 * in both light and dark themes (70% lightness on light bg, dark text).
 */
export function getCourseColor(courseId: string): CourseColorStyle {
  const hue = hashString(courseId) % 360;
  return {
    backgroundColor: `hsl(${hue}, 70%, 88%)`,
    color: `hsl(${hue}, 70%, 25%)`,
    borderColor: `hsl(${hue}, 60%, 70%)`,
  };
}
