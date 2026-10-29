export const BLOCK_TYPES = [
  "hero",
  "letter",
  "photos",
  "voice",
  "video",
  "timeline",
  "ending",
  "easter",
] as const;

export type BlockType = (typeof BLOCK_TYPES)[number];

export const BLOCK_TYPE_LABEL: Record<BlockType, string> = {
  hero: "扉页",
  letter: "信纸",
  photos: "照片",
  voice: "声音",
  video: "影像",
  timeline: "邮路",
  ending: "结尾",
  easter: "暗记",
};

export type Envelope = {
  to: string;
  from: string;
  postmark: string;
};

export type GateConfig = {
  hint: string;
  dials: number;
  charset: string;
  passphraseHash: string;
};

export type BgmTrack = {
  id: string;
  title: string;
  src: string;
};

export type BgmPlaylist = {
  mode: "sequence" | "shuffle";
  crossfadeMs: number;
  tracks: BgmTrack[];
};

export type LetterParagraph = {
  id: string;
  text: string;
  hidden?: boolean;
  unlockAt?: string;
};

export type PhotoItem = {
  id: string;
  src: string;
  alt: string;
  caption: string;
  unlockAt?: string;
};

export type TimelineEvent = {
  id: string;
  dateLabel: string;
  title: string;
  body: string;
  unlockAt?: string;
};

type BlockBase = {
  id: string;
  unlockAt?: string;
};

export type HeroBlock = BlockBase & {
  type: "hero";
  kicker: string;
  title: string;
  subtitle: string;
};

export type LetterBlock = BlockBase & {
  type: "letter";
  dateline: string;
  salutation: string;
  paragraphs: LetterParagraph[];
  signoff: string;
};

export type PhotosBlock = BlockBase & {
  type: "photos";
  title: string;
  items: PhotoItem[];
};

export type VoiceBlock = BlockBase & {
  type: "voice";
  title: string;
  caption: string;
  src: string;
};

export type VideoBlock = BlockBase & {
  type: "video";
  title: string;
  caption: string;
  src: string;
  poster: string;
};

export type TimelineBlock = BlockBase & {
  type: "timeline";
  title: string;
  events: TimelineEvent[];
};

export type EndingBlock = BlockBase & {
  type: "ending";
  title: string;
  text: string;
};

export type EasterBlock = BlockBase & {
  type: "easter";
  hint: string;
  text: string;
};

export type Block =
  | HeroBlock
  | LetterBlock
  | PhotosBlock
  | VoiceBlock
  | VideoBlock
  | TimelineBlock
  | EndingBlock
  | EasterBlock;

export type LetterDocument = {
  slug: string;
  title: string;
  timezone: string;
  envelope: Envelope;
  gate: GateConfig;
  bgm: BgmPlaylist;
  blocks: Block[];
};

export type LockedStub = {
  id: string;
  locked: true;
  unlockAt: string;
};

export type FilteredParagraph =
  | { id: string; locked: true; unlockAt: string }
  | { id: string; text: string; hidden?: boolean };

export type FilteredPhotoItem =
  | { id: string; locked: true; unlockAt: string }
  | { id: string; src: string; alt: string; caption: string };

export type FilteredTimelineEvent =
  | { id: string; locked: true; unlockAt: string }
  | { id: string; dateLabel: string; title: string; body: string };

export type FilteredLetterBlock = {
  id: string;
  type: "letter";
  dateline: string;
  salutation: string;
  signoff: string;
  paragraphs: FilteredParagraph[];
  unlockAt?: string;
};

export type FilteredPhotosBlock = {
  id: string;
  type: "photos";
  title: string;
  items: FilteredPhotoItem[];
  unlockAt?: string;
};

export type FilteredTimelineBlock = {
  id: string;
  type: "timeline";
  title: string;
  events: FilteredTimelineEvent[];
  unlockAt?: string;
};

export type OpenBlock =
  | HeroBlock
  | FilteredLetterBlock
  | FilteredPhotosBlock
  | VoiceBlock
  | VideoBlock
  | FilteredTimelineBlock
  | EndingBlock
  | EasterBlock;

export type FilteredBlock = (LockedStub & { type: BlockType }) | OpenBlock;

export type LetterView = {
  slug: string;
  title: string;
  timezone: string;
  envelope: Envelope;
  bgm: BgmPlaylist;
  blocks: FilteredBlock[];
};

export function isLockedStub<T extends { id: string; locked?: boolean; unlockAt?: string }>(
  value: T,
): value is Extract<T, { locked: true }> {
  return value.locked === true;
}
