import { NextResponse } from "next/server";

export const runtime = "nodejs";

const maxAudioBytes = 25 * 1024 * 1024;

export async function GET() {
  return NextResponse.json({ available: Boolean(process.env.OPENAI_API_KEY) });
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error: "Server transcription is not configured yet. Add OPENAI_API_KEY to enable multilingual transcription.",
        fallback: "browser",
      },
      { status: 503 },
    );
  }

  const formData = await request.formData();
  const audio = formData.get("audio");
  const language = String(formData.get("language") || "").trim();

  if (!(audio instanceof File)) {
    return NextResponse.json({ error: "No audio file was provided." }, { status: 400 });
  }

  if (audio.size > maxAudioBytes) {
    return NextResponse.json({ error: "Audio is too large. Keep recordings under 25MB." }, { status: 413 });
  }

  const outbound = new FormData();
  outbound.set("file", audio, audio.name || "speech-draft.webm");
  outbound.set("model", "gpt-4o-mini-transcribe");
  if (language) outbound.set("language", language);

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: outbound,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("OpenAI transcription failed", errorText);
    return NextResponse.json({ error: "The transcription service could not process this recording right now." }, { status: 502 });
  }

  const payload = (await response.json()) as { text?: string };
  return NextResponse.json({ text: payload.text || "" });
}
