export type Appearance = {
  seal?: {
    color: "wine" | "green" | "navy" | "gold" | "black";
    shape: "round" | "drip";
    gloss: number;
    emblem: "rings" | "letter" | "image";
    letter: string;
    image: string;
    invert: boolean;
    gilt: boolean;
  };
  paper?: {
    tex: "linen" | "handmade" | "lined" | "plain";
    color: string;
    font: "serif" | "kai" | "sans";
    lh: number;
  };
  envelope?: {
    mat: "linen" | "cotton" | "kraft" | "laid";
    color: string;
    liner: "lozenge" | "damask" | "stripe" | "dots" | "none";
    linerColor: "wine" | "green" | "navy" | "gold" | "black";
  };
};
export function cleanStyle(s: unknown): Appearance | undefined;
export const PRESETS: {
  sealColors: Record<string, { name: string; c: string }>;
  shapes: Record<string, string>;
  emblems: Record<string, string>;
  paperTex: Record<string, string>;
  paperColors: Record<string, string>;
  fonts: Record<string, string>;
  envMat: Record<string, string>;
  envColors: Record<string, string>;
  liners: Record<string, string>;
};
export const appearance: {
  styleVars(s: Appearance): Record<string, string>;
  makeSeal(s: Appearance["seal"], seed: string, size?: number): Promise<string>;
  SEAL_DEFAULT: NonNullable<Appearance["seal"]>;
  PAPER_DEFAULT: NonNullable<Appearance["paper"]>;
  ENV_DEFAULT: NonNullable<Appearance["envelope"]>;
};
