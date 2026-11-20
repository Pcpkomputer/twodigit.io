export interface SfxItem {
  id: string;
  name: string;
  command: string; // e.g. "!klakson"
  description: string;
  emoji: string;
  url: string;
}

export const SFX_CATALOG: SfxItem[] = [
  {
    id: "klakson",
    name: "Klakson Mobil",
    command: "!klakson",
    description: "Klakson mobil klasik untuk memberi tahu streamer",
    emoji: "🚗",
    url: "/sfx/klakson.mp3",
  },
  {
    id: "kaget",
    name: "Jeritan Kaget",
    command: "!kaget",
    description: "Efek suara kaget / screamer lucu",
    emoji: "😱",
    url: "/sfx/kaget.mp3",
  },
  {
    id: "wasted",
    name: "GTA Wasted",
    command: "!wasted",
    description: "Efek suara kematian GTA saat streamer kalah/gagal",
    emoji: "💀",
    url: "/sfx/wasted.mp3",
  },
  {
    id: "bruh",
    name: "Meme Bruh",
    command: "!bruh",
    description: "Efek suara Bruh saat momen awkward atau blunder",
    emoji: "🗿",
    url: "/sfx/bruh.mp3",
  },
  {
    id: "error",
    name: "Windows Error",
    command: "!error",
    description: "Efek suara error Windows klasik",
    emoji: "⚠️",
    url: "/sfx/error.mp3",
  },
];

export function findSfxByCommand(text: string): SfxItem | undefined {
  const clean = text.trim().toLowerCase();
  return SFX_CATALOG.find(
    (item) =>
      item.command.toLowerCase() === clean ||
      item.command.replace(/^!/, "").toLowerCase() === clean
  );
}
