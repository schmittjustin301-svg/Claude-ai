// Layout engine: the number of athletes decides the arrangement, so the
// operator never picks a layout manually.

export type LayoutKind = "hero" | "side_by_side" | "triple" | "grid" | "rows";

export interface LayoutPlan {
  kind: LayoutKind;
  label: string;
  columns: number;
  rows: number;
  /** Cards are laid out row by row; a short final row is centered. */
  perRow: number[];
}

export function planLayout(count: number): LayoutPlan {
  if (count <= 0) return { kind: "hero", label: "Hero", columns: 1, rows: 0, perRow: [] };

  if (count === 1) return { kind: "hero", label: "Hero Layout", columns: 1, rows: 1, perRow: [1] };
  if (count === 2) return { kind: "side_by_side", label: "Side by Side", columns: 2, rows: 1, perRow: [2] };
  if (count === 3) return { kind: "triple", label: "Triple Layout", columns: 3, rows: 1, perRow: [3] };

  if (count <= 6) {
    // 4 → 2×2, 5 → 3+2, 6 → 3×3(two rows)
    if (count === 4) return { kind: "grid", label: "Grid Layout", columns: 2, rows: 2, perRow: [2, 2] };
    if (count === 5) return { kind: "grid", label: "Grid Layout", columns: 3, rows: 2, perRow: [3, 2] };
    return { kind: "grid", label: "Grid Layout", columns: 3, rows: 2, perRow: [3, 3] };
  }

  // More than 6 — keep rows balanced rather than leaving a lone trailing card.
  const columns = count <= 12 ? 4 : Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / columns);
  const base = Math.floor(count / rows);
  const remainder = count % rows;
  const perRow = Array.from({ length: rows }, (_, i) => base + (i < remainder ? 1 : 0));
  return { kind: "rows", label: "Multiple Rows", columns, rows, perRow };
}
