#!/usr/bin/env node
/* Live smoke test: researches a known public professional through the running
   app's API and prints the sources returned. Usage:
     npm run build && npm start   (in another terminal)
     npm run smoke:live -- "Full Name" "Company"
   This makes real, billable OpenAI calls. */

const base = process.env.BASE_URL || "http://localhost:3000";
const [fullName = "David A. Ricks", company = "Eli Lilly and Company"] = process.argv.slice(2);

async function post(path, body) {
  const res = await fetch(base + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json();
  if (!res.ok) throw new Error(`${path} → ${res.status} ${json?.error?.code}: ${json?.error?.message}`);
  return json;
}

const input = { fullName, company };
console.log(`Identifying ${fullName} (${company}) via ${base} …`);
const id = await post("/api/research/identify", { input });
console.log(`Identity status: ${id.status}; ${id.candidates.length} candidate(s); ${id.sources.length} source(s)`);
for (const c of id.candidates) console.log(`  - ${c.name} — ${c.role ?? "?"}, ${c.organization ?? "?"} [${c.sourceIds.join(", ")}]`);
if (!id.candidates.length) process.exit(1);

const brief = await post("/api/research/brief", {
  input,
  candidate: id.candidates[0],
  identityStatus: id.status === "ambiguous" ? "selected-by-user" : "single-match",
  identitySources: id.sources.filter((s) => id.candidates[0].sourceIds.includes(s.id)),
  shareCustomerDetails: false,
});
console.log(`\n${brief.professionalProfile.name}: ${brief.professionalProfile.summary}\n`);
for (const f of brief.findings) console.log(`  [${f.id}] (${f.verificationStatus}) ${f.claim} ${f.sourceIds.join(",")}`);
console.log("\nSources:");
for (const s of brief.sources) console.log(`  ${s.id} ${s.cited ? "cited" : "consulted"}  ${s.url}`);
console.log(`\nOptions: ${brief.suggestedActions.map((a) => a.title).join(" | ")}`);
const u = [id.usage, brief.usage];
console.log(`Usage: ${u.reduce((a, x) => a + x.calls, 0)} model calls, ${u.reduce((a, x) => a + x.webSearchCalls, 0)} web searches, ${u.reduce((a, x) => a + x.totalTokens, 0)} tokens`);
