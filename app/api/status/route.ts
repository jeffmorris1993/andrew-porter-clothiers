import { NextResponse, connection } from "next/server";


/** Tells the UI whether Live Mode is configured, without revealing anything about the key. */
export async function GET() {
  await connection(); // always evaluated per request, never prerendered
  return NextResponse.json({
    liveConfigured: Boolean(process.env.OPENAI_API_KEY),
    model: process.env.OPENAI_MODEL || "gpt-5.4-mini",
  });
}
