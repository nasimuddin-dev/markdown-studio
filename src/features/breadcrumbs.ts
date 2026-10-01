import { currentHeadingIndex, type Heading } from "./outline";

/**
 * Each heading's parent: the nearest heading above it with a lower level,
 * or -1 for a top-level heading. One pass with a stack.
 */
export function headingParents(headings: Heading[]): number[] {
  const parents: number[] = [];
  const stack: number[] = [];
  headings.forEach((h, i) => {
    while (stack.length && headings[stack[stack.length - 1]].level >= h.level) stack.pop();
    parents.push(stack.length ? stack[stack.length - 1] : -1);
    stack.push(i);
  });
  return parents;
}

/**
 * The headings around a line, outermost first: the section the line is in,
 * then its parent, grandparent… (as indexes into `headings`). Empty before
 * the first heading.
 */
export function headingPath(headings: Heading[], parents: number[], line: number): number[] {
  const path: number[] = [];
  for (let i = currentHeadingIndex(headings, line); i >= 0; i = parents[i]) path.push(i);
  return path.reverse();
}

/**
 * The headings a breadcrumb offers to jump to: those with the same parent as
 * heading `i` (its siblings, itself included), in document order. With
 * `i = -1`, the top-level headings.
 */
export function siblingHeadings(parents: number[], i: number): number[] {
  const parent = i < 0 ? -1 : parents[i];
  const out: number[] = [];
  parents.forEach((p, j) => p === parent && out.push(j));
  return out;
}
