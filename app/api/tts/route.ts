import { NextRequest, NextResponse } from "next/server";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

async function fetchGoogleTTS(text: string): Promise<Buffer> {
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=id&client=tw-ob`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    },
  });

  if (!res.ok) {
    throw new Error(`Google TTS failed with status ${res.status}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const text = searchParams.get("text");

  if (!text) {
    return new NextResponse("Text parameter is required", { status: 400 });
  }

  const cleanText = text.trim().slice(0, 400);

  // 1. Try Microsoft Edge Neural Voice (High Quality id-ID-GadisNeural)
  try {
    const tts = new MsEdgeTTS();
    await tts.setMetadata(
      "id-ID-GadisNeural",
      OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3
    );

    const streamResult = await tts.toStream(cleanText);

    const audioBuffer = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      streamResult.audioStream.on("data", (chunk: Buffer) => chunks.push(chunk));
      streamResult.audioStream.on("end", () => resolve(Buffer.concat(chunks)));
      streamResult.audioStream.on("error", (err: Error) => reject(err));
    });

    if (audioBuffer && audioBuffer.length > 0) {
      return new NextResponse(new Uint8Array(audioBuffer), {
        headers: {
          "Content-Type": "audio/mpeg",
          "Accept-Ranges": "bytes",
          "Content-Length": audioBuffer.byteLength.toString(),
          "Cache-Control": "public, max-age=86400, stale-while-revalidate=43200",
        },
      });
    }
  } catch (edgeError) {
    console.warn("Edge TTS failed, falling back to Google Indonesian TTS:", edgeError);
  }

  // 2. Resilient Fallback to Google Indonesian TTS
  try {
    const googleAudioBuffer = await fetchGoogleTTS(cleanText);
    return new NextResponse(new Uint8Array(googleAudioBuffer), {
      headers: {
        "Content-Type": "audio/mpeg",
        "Accept-Ranges": "bytes",
        "Content-Length": googleAudioBuffer.byteLength.toString(),
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=43200",
      },
    });
  } catch (googleError) {
    console.error("All TTS generation methods failed:", googleError);
    return new NextResponse("Failed to generate TTS audio", {
      status: 500,
    });
  }
}
