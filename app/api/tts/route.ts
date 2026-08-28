import { NextRequest, NextResponse } from "next/server";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const text = searchParams.get("text");

  if (!text) {
    return new NextResponse("Text parameter is required", { status: 400 });
  }

  const cleanText = text.trim().slice(0, 400);

  try {
    const tts = new MsEdgeTTS();
    // Use Indonesian Female Neural voice (id-ID-GadisNeural)
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

    if (!audioBuffer || audioBuffer.length === 0) {
      throw new Error("Empty audio buffer generated from Neural TTS");
    }

    return new NextResponse(new Uint8Array(audioBuffer), {
      headers: {
        "Content-Type": "audio/mpeg",
        "Accept-Ranges": "bytes",
        "Content-Length": audioBuffer.byteLength.toString(),
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=43200",
      },
    });
  } catch (error) {
    console.error("Neural TTS generation error:", error);
    return new NextResponse("Failed to generate Indonesian TTS audio", {
      status: 500,
    });
  }
}
