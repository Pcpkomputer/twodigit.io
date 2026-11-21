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
      reject(new Error("Edge TTS timed out after 6000ms"));
    }, 6000);

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

  // If a specific Neural voice is requested (e.g. schoolgirl / young girl / gadis / ardi)
  if (voice === "schoolgirl" || voice === "remaja" || voice === "young-girl" || voice === "smp") {
    try {
      const edgeBuffer = await fetchEdgeTTS(
        cleanText,
        "id-ID-GadisNeural",
        customPitch || "+20%",
        customRate || "+5%"
      );
      return new NextResponse(new Uint8Array(edgeBuffer), {
        headers: {
          "Content-Type": "audio/mpeg",
          "Accept-Ranges": "bytes",
          "Content-Length": edgeBuffer.byteLength.toString(),
          "Cache-Control": "public, max-age=86400, stale-while-revalidate=43200",
        },
      });
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
      return new NextResponse(new Uint8Array(edgeBuffer), {
        headers: {
          "Content-Type": "audio/mpeg",
          "Accept-Ranges": "bytes",
          "Content-Length": edgeBuffer.byteLength.toString(),
          "Cache-Control": "public, max-age=86400, stale-while-revalidate=43200",
        },
      });
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
      return new NextResponse(new Uint8Array(edgeBuffer), {
        headers: {
          "Content-Type": "audio/mpeg",
          "Accept-Ranges": "bytes",
          "Content-Length": edgeBuffer.byteLength.toString(),
          "Cache-Control": "public, max-age=86400, stale-while-revalidate=43200",
        },
      });
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
      return new NextResponse(new Uint8Array(edgeBuffer), {
        headers: {
          "Content-Type": "audio/mpeg",
          "Accept-Ranges": "bytes",
          "Content-Length": edgeBuffer.byteLength.toString(),
          "Cache-Control": "public, max-age=86400, stale-while-revalidate=43200",
        },
      });
    } catch (edgeError) {
      console.warn("Ardi Neural TTS failed, falling back to Google:", edgeError);
    }
  }

  // Default / Google TTS (Ultra low latency ~300ms)
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

  // Final fallback to Edge Neural TTS
  try {
    const edgeBuffer = await fetchEdgeTTS(cleanText, "id-ID-GadisNeural", "+15%", "+5%");
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
