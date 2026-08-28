import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const text = searchParams.get("text");

  if (!text) {
    return new NextResponse("Text parameter is required", { status: 400 });
  }

  const cleanText = text.trim().slice(0, 350);
  const encodedText = encodeURIComponent(cleanText);

  // Upstream endpoints in priority order (all providing Indonesian voice)
  const sources: { url: string; headers: Record<string, string> }[] = [
    {
      url: `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodedText}&tl=id&total=1&idx=0&textlen=${cleanText.length}&client=tw-ob&prev=input`,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Referer: "https://translate.google.com/",
        Accept: "*/*",
      },
    },
    {
      url: `https://translate.google.com.hk/translate_tts?ie=UTF-8&q=${encodedText}&tl=id&client=gtx`,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "*/*",
      },
    },
    {
      url: `https://translate.googleapis.com/translate_tts?client=gtx&ie=UTF-8&tl=id&q=${encodedText}`,
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "*/*",
      },
    },
  ];

  for (const source of sources) {
    try {
      const res = await fetch(source.url, {
        headers: source.headers,
      });

      if (res.ok) {
        const audioBuffer = await res.arrayBuffer();
        if (audioBuffer.byteLength > 0) {
          return new NextResponse(audioBuffer, {
            headers: {
              "Content-Type": "audio/mpeg",
              "Accept-Ranges": "bytes",
              "Content-Length": audioBuffer.byteLength.toString(),
              "Cache-Control": "public, max-age=86400, stale-while-revalidate=43200",
            },
          });
        }
      }
    } catch (err) {
      console.warn("Upstream TTS source error:", err);
    }
  }

  return new NextResponse("Failed to fetch TTS audio from all providers", { status: 502 });
}

