import { NextResponse, connection } from "next/server";
import { usageSummary } from "@/lib/server/usage";


export async function GET() {
  await connection(); // always evaluated per request, never prerendered
  return NextResponse.json(usageSummary());
}
