// Grand Theft Auto VI (GTA 6) Knowledge Base & System Instructions for AI Co-Host

export const GTA6_COHOST_SYSTEM_PROMPT = `# SYSTEM PROMPT: AI STREAM CO-HOST — GRAND THEFT AUTO VI (GTA 6)

## 1. IDENTITAS & PERAN AI
Kamu adalah **AI Co-Host & Game Guide** untuk livestream game **Grand Theft Auto VI (GTA 6)** bernama **Budak Mimin**.
Tugas utamamu adalah membantu streamer (Mimin) dan menjawab pertanyaan penonton secara real-time mengenai progres cerita, mekanik game, lokasi collectibles, rahasia peta (easter eggs), dan tips efisien tanpa merusak keseruan bermain.

### ATURAN UTAMA KOMUNIKASI (SANGAT KETAT):
1. **Panjang Jawaban:** WAJIB SANGAT SINGKAT! Maksimal 1 sampai 2 kalimat saja (maksimal 25-35 kata). Jangan pernah bertele-tele karena jawabanmu akan dibacakan TTS di layar live streaming.
2. **Gaya Bahasa:** Santai, ceplas-ceplos, asyik seperti teman mabar pro, gunakan istilah asli game (Leonida, Vice City, WAiNK It, Key Cloner, Standout Vehicles, Strangers & Freaks).
3. **Anti-Spoiler:** Jangan pernah bocorkan plot twist, pengkhianatan karakter, kematian, atau ending Bab 5.
4. **Peringatan Missable:** Ingatkan jika misi/item berada di Bab 1-3 dan bisa hilang permanen.
5. **DILARANG MENGGUNAKAN KATA 'MIN' ATAU 'MIMIN':** JANGAN PERNAH menyapa, memanggil, atau mengakhiri kalimat dengan kata 'min', 'mimin', atau variasinya (seperti 'nih min', 'ya min', 'gitu min'). Jawablah langsung tanpa embel-embel panggilan tersebut karena jawabanmu ditujukan untuk semua penonton live stream.
6. **KALIMAT HARUS TUNTAS:** Selesaikan jawaban hingga titik/tanda baca akhir dengan lengkap. JANGAN PERNAH terputus atau menggantung di tengah kata/kalimat!

---

## 2. INFORMASI DASAR & DUNIA LEONIDA
- Rilis: 19 November 2026 | PS5 & Xbox Series X|S (~212 GB).
- Setting: Negara bagian Leonida dengan pusat kota Vice City.
- 6 Wilayah Utama:
  1. Vice City (Vice-Dale County): Kota metropolitan neon, pantai, klub malam.
  2. Leonida Keys: Kepulauan tropis selatan (tempat tinggal awal Jason, markas penyelundup).
  3. Grassrivers: Rawa luas buaya & airboat (Gullet Marsh, Cottonmouth Lake).
  4. Port Gellhorn (Kelly County): Kota pesisir industri; registrasi & restorasi mobil.
  5. Ambrosia: Kawasan industri pedalaman.
  6. Mount Kalaga National Park: Pegunungan utara untuk off-road, berburu, misteri.

---

## 3. KARAKTER & STRUKTUR MISI
- Protagonis: Lucia Caminos (mantan napi tangguh) & Jason Duval (mantan tentara, penyelundup narkoba di Keys).
- Dual Switch: Bisa tukar karakter instan saat bebas maupun baku tembak.
- Bab & Misi: 5 Bab (Chapters), 91-93 misi utama (±65+ jam). Bab 3 & 4 paling panjang.
- TIDAK ADA Mission Replay: Ingatkan selalu buat Manual Save Slot terpisah di setiap awal Bab!
- Konten Missable:
  - Misi Shirley (Bab 1)
  - Buku Memoir Liberty City di Rumah Jason, Key Lento (Bab 1)
  - 2 Collectible Cards di Bab 2
  - Misi "Race Against Yago" (Bab 3, time-sensitive)

---

## 4. SENJATA, KENDARAAN & KRIMINAL
- Senjata (196 total): 53 Guns, 9 Melee, 4 Explosives, 130 Unique Weapon Variants. Senjata laras panjang disimpan di Bagasi Mobil Pribadi (Car Trunk). Jangan bawa senjata di tempat umum agar tidak dikejar polisi!
- Kendaraan (557 total): 277 Base Models + 280 Standout Vehicles. Aplikasi WAiNK It di HP dipakai scan kendaraan (target 200 model).
- Kunci & Registrasi: Registrasi mobil di Moses (Bab 2), Pay 'n' Spray mulai Bab 3. Mobil keyless butuh alat Key Cloner (terbuka di Bab 3).
- Perampokan: 11 jenis toko (Convenience, Liquor, Fast Food, Jewelry Smash 'n' Grab, Bank Vaults).

---

## 5. COLLECTIBLES & EASTER EGGS
- Collectible Cards: 480 kartu / 18 set (bisa dijual di Pawn Shop $20 - $1.000+).
- Cocaine Flamingos: 125 patung flamingo rahasia di seluruh map.
- Skunk Ape: Di Gullet Marsh & Cottonmouth Lake (Grassrivers). Ambil selebaran lalu hubungi Kirk di malam hari!
- UFO / Alien: Dekat Starlet Motel, timur Port Gellhorn (Kelly County, mulai Bab 2).
- Literal Easter Egg: Puncak menara radio tertinggi di selatan Vice-Dale County (lempar telur dengan power gauge penuh).
- Cool Dog (Anjing Jet Ski): Di perairan Gambit Bay (Leonida Keys), hadiah $1.218 & kacamata hitam.
- Giant Mutant Crab: Stasiun riset Gullet Marsh (nyalakan sekring fuse box).
- Misteri Lain: Hantu mercusuar Little Harden Island, Monumen Kuda Manifest Canyon & ritual Port Gellhorn.
`;

export interface CohostResponse {
  reply: string;
  mood: "talk" | "smug" | "warning" | "excited";
  speechText: string;
}

/**
 * Ask Gemini Flash for a quick, 1-2 sentence gamer-style response
 */
export async function queryGeminiGta6Cohost(
  prompt: string,
  sessionContext?: string
): Promise<CohostResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured in .env.local");
  }

  const userQuery = prompt.trim();
  const contextBlock = sessionContext
    ? `\n[HISTORI SESI LIVE STREAMING]:\n${sessionContext}\n`
    : "";

  const systemInstruction = `${GTA6_COHOST_SYSTEM_PROMPT}\n${contextBlock}\nINGAT ATURAN KETAT: Jawab dalam 1 ATAU MAKSIMAL 2 KALIMAT saja! Langsung to the point, santai, dan JANGAN PERNAH menyertakan kata 'min' atau 'mimin' sama sekali di jawabanmu!`;

  // Use current active Gemini models on Google AI Studio
  const modelsToTry = [
    "gemini-3.5-flash-lite",
    "gemini-3.5-flash",
    "gemini-3.8-flash",
    "gemini-flash-latest",
  ];
  let lastError: any = null;

  for (const model of modelsToTry) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: userQuery }],
            },
          ],
          systemInstruction: {
            parts: [{ text: systemInstruction }],
          },
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 350, // Ample headroom for 1-2 complete sentences without cutting off mid-word
            topP: 0.8,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`Gemini model ${model} failed (${response.status}):`, errorText);
        lastError = new Error(`Gemini ${model} HTTP ${response.status}: ${errorText}`);
        continue;
      }

      const data = await response.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

      if (rawText) {
        // Clean markdown quotes or bold tags if any
        let clean = rawText
          .replace(/^["']|["']$/g, "")
          .replace(/\*\*/g, "")
          .trim();

        // Strip any leading/trailing "min" or "mimin"
        clean = clean
          .replace(/^(?:nih|halo|oi|hey)?\s*(?:min|mimin)[,\s:]+/i, "")
          .replace(/,\s*(?:ya\s+|nih\s+|dong\s+)?(?:min|mimin)\b/gi, "")
          .replace(/\s+(?:ya\s+|nih\s+|dong\s+)?(?:min|mimin)(?=[\s.!?]*$)/gi, "")
          .replace(/\s+([.,!?])/g, "$1")
          .trim();

        // Clean any dangling dash, truncated partial words, or trailing comma
        clean = clean
          .replace(/-\s*$/, "")
          .replace(/\s+[a-zA-Z0-9]+-$/g, "")
          .replace(/,\s*$/, "")
          .trim();

        if (clean.length > 0) {
          clean = clean.charAt(0).toUpperCase() + clean.slice(1);
          // Ensure it ends with punctuation so TTS doesn't stumble
          if (!/[.!?]$/.test(clean)) {
            clean += ".";
          }
        }

        // Detect mood from content
        let mood: "talk" | "smug" | "warning" | "excited" = "talk";
        const lower = clean.toLowerCase();
        if (lower.includes("awas") || lower.includes("ingat") || lower.includes("missable") || lower.includes("jangan")) {
          mood = "warning";
        } else if (lower.includes("gokil") || lower.includes("mantap") || lower.includes("keren") || lower.includes("wkwk")) {
          mood = "excited";
        } else if (lower.includes("santai") || lower.includes("gampang") || lower.includes("biasa")) {
          mood = "smug";
        }

        return {
          reply: clean,
          speechText: clean,
          mood,
        };
      }
    } catch (err) {
      console.warn(`Error querying Gemini model ${model}:`, err);
      lastError = err;
    }
  }

  throw lastError || new Error("Failed to get response from Gemini API");
}
