import { describe, expect, it } from "vitest";
import { nextOpenTask, taskCounts } from "../src/features/taskCount";

describe("task progress", () => {
  it("counts open and done tasks, in lists, ordered lists and quotes, but not in code", () => {
    const text = ["# Plan", "- [x] one", "- [ ] two", "  * [X] nested", "1. [ ] numbered", "> - [ ] quoted", "", "```", "- [ ] in code", "```", "- [link](x.md)", "[ ] not a list"].join("\n");
    expect(taskCounts(text)).toEqual({ total: 5, done: 2, open: [3, 5, 6] });
    expect(taskCounts("no tasks")).toEqual({ total: 0, done: 0, open: [] });
  });

  it("finds the next open task after the cursor, wrapping around", () => {
    expect(nextOpenTask([3, 5, 6], 3)).toBe(5);
    expect(nextOpenTask([3, 5, 6], 6)).toBe(3);
    expect(nextOpenTask([], 1)).toBeNull();
  });
});
