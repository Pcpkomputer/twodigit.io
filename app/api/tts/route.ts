import { NextRequest, NextResponse } from "next/server";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

/**
 * Ultra-fast Google Indonesian TTS (typical response: ~200-300ms)
 * Standard familiar Indonesian streamer voice (same as Saweria/Sociabuzz)
 */
async function fetchGoogleTTS(text: string): Promise<Buffer> {
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=id&client=tw-ob`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    },
    signal: AbortSignal.timeout(3500),
  });

  if (!res.ok) {
    throw new Error(`Google TTS returned status ${res.status}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Microsoft Edge Neural TTS fallback (slower ~3-4s due to WS handshake)
 */
async function fetchEdgeTTS(text: string): Promise<Buffer> {
  const tts = new MsEdgeTTS();
  await tts.setMetadata(
    "id-ID-GadisNeural",
    OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3
  );

  const streamResult = await tts.toStream(text);

  return new Promise<Buffer>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Edge TTS timed out after 4500ms"));
    }, 4500);

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

  if (!text) {
    return new NextResponse("Text parameter is required", { status: 400 });
  }

  const cleanText = text.trim().slice(0, 400);

  // 1. Primary: Google TTS (Ultra low latency ~300ms, no WebSocket overhead)
  try {
    const audioBuffer = await fetchGoogleTTS(cleanText);
    return new NextResponse(new Uint8Array(audioBuffer), {
      headers: {
        "Content-Type": "audio/mpeg",
        "Accept-Ranges": "bytes",
        "Content-Length": audioBuffer.byteLength.toString(),
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=43200",
      },
    });
  } catch (googleError) {
    console.warn("Google TTS failed, attempting Edge Neural TTS fallback:", googleError);
  }

  // 2. Secondary: Edge Neural TTS fallback
  try {
    const edgeBuffer = await fetchEdgeTTS(cleanText);
    return new NextResponse(new Uint8Array(edgeBuffer), {
      headers: {
        "Content-Type": "audio/mpeg",
        "Accept-Ranges": "bytes",
        "Content-Length": edgeBuffer.byteLength.toString(),
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=43200",
      },
    });
  } catch (edgeError) {
    console.error("All TTS generation methods failed:", edgeError);
    return new NextResponse("Failed to generate TTS audio", {
      status: 500,
    });
  }
}
