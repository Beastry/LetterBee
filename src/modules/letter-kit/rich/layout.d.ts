import type { JournalItem } from "./model";
export type Box = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
  bx: number;
  by: number;
  bw: number;
  bh: number;
};
export type Layout = {
  height: number;
  lines: {
    pi: number;
    y: number;
    segs: { x: number; w: number; text: string }[];
  }[];
  items: Box[];
  paras: { pi: number; y: number; h: number; x?: number; w?: number }[];
};
export function createJournalLayout(): {
  layout(
    paras: { text: string; hidden?: boolean; collapsed?: boolean }[],
    items: JournalItem[],
    opt: {
      W: number;
      L: number;
      gap?: number;
      minW?: number;
      indent?: number;
      edit?: boolean;
      lastId?: string;
    },
    measure: (s: string) => number,
  ): Layout;
  boxOf(it: JournalItem, W: number, L: number): Box;
  breakText(
    s: string,
    w: number,
    m: (s: string) => number,
  ): { text: string; rest: string };
  rotatedIntersects(a: Box, b: Box): boolean;
  rectIntersects(a: DOMRect, b: DOMRect): boolean;
  freeSpot(b: Box, placed: Box[], L: number): { x: number; y: number };
};
