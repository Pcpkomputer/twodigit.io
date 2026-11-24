import { NextRequest, NextResponse } from "next/server";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

// In-memory LRU audio cache for ultra-fast repeated TTS (instant <1ms response)
const ttsMemoryCache = new Map<string, Buffer>();
const MAX_TTS_CACHE = 300;

function getCachedTTS(key: string): Buffer | null {
  const buf = ttsMemoryCache.get(key);
  if (!buf) return null;
  // Refresh LRU position
  ttsMemoryCache.delete(key);
  ttsMemoryCache.set(key, buf);
  return buf;
}

function setCachedTTS(key: string, buf: Buffer): void {
  if (ttsMemoryCache.size >= MAX_TTS_CACHE) {
    const oldest = ttsMemoryCache.keys().next().value;
    if (oldest) ttsMemoryCache.delete(oldest);
  }
  ttsMemoryCache.set(key, buf);
}

function createAudioResponse(buffer: Buffer, isCacheHit = false): NextResponse {
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "audio/mpeg",
      "Accept-Ranges": "bytes",
      "Content-Length": buffer.byteLength.toString(),
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=43200",
      "X-Cache": isCacheHit ? "HIT" : "MISS",
    },
  });
}

/**
 * Ultra-fast Google Indonesian TTS (typical response: ~150-300ms)
 * Standard familiar Indonesian streamer voice (same as Saweria/Sociabuzz)
 */
async function fetchGoogleTTS(text: string): Promise<Buffer> {
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=id&client=tw-ob`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    },
    signal: AbortSignal.timeout(2000), // Max 2s before falling back to Edge Neural
  });

  if (!res.ok) {
    throw new Error(`Google TTS returned status ${res.status}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Microsoft Edge Neural TTS with customizable pitch & rate
 * Perfect for young Indonesian girl / middle school voice (id-ID-GadisNeural + pitch)
 */
async function fetchEdgeTTS(
  text: string,
  voiceName: string = "id-ID-GadisNeural",
  pitch: string = "+20%",
  rate: string = "+5%"
): Promise<Buffer> {
  const tts = new MsEdgeTTS();
  await tts.setMetadata(
    voiceName,
    OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3
  );

  const streamResult = await tts.toStream(text, {
    pitch,
    rate,
  });

  return new Promise<Buffer>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Edge TTS timed out after 5000ms"));
    }, 5000);

    const chunks: Buffer[] = [];
    streamResult.audioStream.on("data", (chunk: Buffer) => chunks.push(chunk));
    streamResult.audioStream.on("end", () => {
      clearTimeout(timeout);
      resolve(Buffer.concat(chunks));
    });
    streamResult.audioStream.on("error", (err: Error) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const text = searchParams.get("text");
  const voice = (searchParams.get("voice") || "").toLowerCase().trim();
  const customPitch = searchParams.get("pitch");
  const customRate = searchParams.get("rate");

  if (!text) {
    return new NextResponse("Text parameter is required", { status: 400 });
  }

  const cleanText = text.trim().slice(0, 400);
  const cacheKey = `${voice || "google"}:${cleanText}:${customPitch || ""}:${customRate || ""}`;

  // 1. FAST PATH: In-memory cache hit (< 1ms instant response)
  const cached = getCachedTTS(cacheKey);
  if (cached) {
    return createAudioResponse(cached, true);
  }

  // 2. Specific Neural voices (schoolgirl / young girl / gadis / ardi)
  if (voice === "schoolgirl" || voice === "remaja" || voice === "young-girl" || voice === "smp") {
    try {
      const edgeBuffer = await fetchEdgeTTS(
        cleanText,
        "id-ID-GadisNeural",
        customPitch || "+20%",
        customRate || "+5%"
      );
      setCachedTTS(cacheKey, edgeBuffer);
      return createAudioResponse(edgeBuffer, false);
    } catch (edgeError) {
      console.warn("Schoolgirl Edge TTS failed, falling back to Google:", edgeError);
    }
  } else if (voice === "anime" || voice === "imut") {
    try {
      const edgeBuffer = await fetchEdgeTTS(
        cleanText,
        "id-ID-GadisNeural",
        customPitch || "+30%",
        customRate || "+8%"
      );
      setCachedTTS(cacheKey, edgeBuffer);
      return createAudioResponse(edgeBuffer, false);
    } catch (edgeError) {
      console.warn("Anime Edge TTS failed, falling back to Google:", edgeError);
    }
  } else if (voice === "gadis" || voice === "gadis-dewasa") {
    try {
      const edgeBuffer = await fetchEdgeTTS(
        cleanText,
        "id-ID-GadisNeural",
        customPitch || "+0%",
        customRate || "+0%"
      );
      setCachedTTS(cacheKey, edgeBuffer);
      return createAudioResponse(edgeBuffer, false);
    } catch (edgeError) {
      console.warn("Gadis Neural TTS failed, falling back to Google:", edgeError);
    }
  } else if (voice === "ardi" || voice === "male") {
    try {
      const edgeBuffer = await fetchEdgeTTS(
        cleanText,
        "id-ID-ArdiNeural",
        customPitch || "+0%",
        customRate || "+0%"
      );
      setCachedTTS(cacheKey, edgeBuffer);
      return createAudioResponse(edgeBuffer, false);
    } catch (edgeError) {
      console.warn("Ardi Neural TTS failed, falling back to Google:", edgeError);
    }
  }

  // 3. Default / Google TTS (Ultra low latency ~200-300ms)
  try {
    const audioBuffer = await fetchGoogleTTS(cleanText);
    setCachedTTS(cacheKey, audioBuffer);
    return createAudioResponse(audioBuffer, false);
  } catch (googleError) {
    console.warn("Google TTS failed, attempting Edge Neural TTS fallback:", googleError);
  }

  // 4. Final fallback to Edge Neural TTS
  try {
    const edgeBuffer = await fetchEdgeTTS(cleanText, "id-ID-GadisNeural", "+15%", "+5%");
    setCachedTTS(cacheKey, edgeBuffer);
    return createAudioResponse(edgeBuffer, false);
  } catch (edgeError) {
    console.error("All TTS generation methods failed:", edgeError);
    return new NextResponse("Failed to generate TTS audio", {
      status: 500,
    });
  }
}
