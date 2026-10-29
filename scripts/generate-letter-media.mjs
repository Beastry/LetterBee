import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const directory = path.join(process.cwd(), "public", "letter-media", "sample");
mkdirSync(directory, { recursive: true });

const sampleRate = 22050;

function writeWav(filename, samples) {
  const dataSize = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let index = 0; index < samples.length; index += 1) {
    const value = Math.max(-1, Math.min(1, samples[index] ?? 0));
    buffer.writeInt16LE(Math.round(value * 32767), 44 + index * 2);
  }

  writeFileSync(path.join(directory, filename), buffer);
}

function midiFrequency(midi) {
  return 440 * 2 ** ((midi - 69) / 12);
}

function envelope(time, duration) {
  const attack = 0.03;
  const release = 0.12;
  if (time < attack) {
    return time / attack;
  }
  if (time > duration - release) {
    return Math.max(0, (duration - time) / release);
  }
  return 1;
}

function melody(notes) {
  const seconds = 8;
  const output = new Float64Array(sampleRate * seconds);

  for (const note of notes) {
    const frequency = midiFrequency(note.midi);
    const start = Math.floor(note.start * sampleRate);
    const length = Math.floor(note.duration * sampleRate);

    for (let index = 0; index < length && start + index < output.length; index += 1) {
      const time = index / sampleRate;
      const sample =
        Math.sin(2 * Math.PI * frequency * time) * 0.22 +
        Math.sin(2 * Math.PI * frequency * 2 * time) * 0.05;
      output[start + index] += sample * envelope(time, note.duration);
    }
  }

  const fade = Math.floor(sampleRate * 0.06);
  for (let index = 0; index < fade; index += 1) {
    const gain = index / fade;
    output[index] *= gain;
    output[output.length - 1 - index] *= gain;
  }

  return output;
}

function paperRustle() {
  const seconds = 2.4;
  const output = new Float64Array(Math.floor(sampleRate * seconds));
  let previous = 0;

  for (let index = 0; index < output.length; index += 1) {
    const white = Math.random() * 2 - 1;
    previous = previous * 0.86 + white * 0.14;
    const time = index / sampleRate;
    output[index] = previous * envelope(time, seconds) * 0.35;
  }

  return output;
}

writeWav(
  "room-tone.wav",
  melody([
    { midi: 69, start: 0.2, duration: 1.4 },
    { midi: 72, start: 1.5, duration: 1.2 },
    { midi: 76, start: 2.8, duration: 1.6 },
    { midi: 74, start: 4.4, duration: 1.2 },
    { midi: 72, start: 5.8, duration: 1.8 },
  ]),
);
writeWav(
  "night-road.wav",
  melody([
    { midi: 64, start: 0.1, duration: 1.6 },
    { midi: 67, start: 1.6, duration: 1.4 },
    { midi: 71, start: 3.0, duration: 1.5 },
    { midi: 67, start: 4.6, duration: 1.3 },
    { midi: 64, start: 6.0, duration: 1.7 },
  ]),
);
writeWav("paper.wav", paperRustle());

const video = path.join(directory, "window.mp4");
const poster = path.join(directory, "window-poster.png");
const font = "/usr/share/fonts/truetype/wqy/wqy-microhei.ttc";
const rendered = spawnSync(
  "ffmpeg",
  [
    "-y",
    "-f",
    "lavfi",
    "-i",
    "color=c=0xE7D3B4:s=640x360:d=4",
    "-f",
    "lavfi",
    "-i",
    "color=c=0x8FB8C9:s=260x160:d=4",
    "-filter_complex",
    `[0:v][1:v]overlay=(W-w)/2:(H-h)/2-20:format=auto,drawtext=fontfile=${font}:text='样例画面':fontcolor=0x6F432A:fontsize=42:x=(w-text_w)/2:y=h-78`,
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    video,
  ],
  { stdio: "inherit" },
);

if (rendered.status !== 0) {
  process.exit(rendered.status ?? 1);
}

const frame = spawnSync("ffmpeg", ["-y", "-i", video, "-frames:v", "1", poster], { stdio: "inherit" });

if (frame.status !== 0) {
  process.exit(frame.status ?? 1);
}
