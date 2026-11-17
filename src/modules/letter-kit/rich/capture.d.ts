export function createCaptureTools(): {
  dispose(): void;
  prepareImage(
    f: File,
    o?: { max?: number; quality?: number; alpha?: boolean },
  ): Promise<{ file: File; w?: number; h?: number }>;
  takePhoto(o?: object): Promise<File | null>;
  recorder(o: {
    onSave: (file: File, progress: (n: number) => void) => Promise<boolean>;
    maxSec?: number;
    title?: string;
  }): Promise<unknown>;
};
