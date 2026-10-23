/* Plan codes for GCSE Plan & Pass.
   POST /api/plans            body {settings, plan}  -> {code}   (creates a new code)
   PUT  /api/plans?code=XXX   body {settings, plan}  -> {code}   (updates that plan)
   GET  /api/plans?code=XXX                          -> {settings, plan, saved}
   Plans are kept in Netlify Blobs. A code is the only key: anyone with it can open or update that plan,
   so plans must not contain personal information beyond what students type into commitment names. */
import { getStore } from "@netlify/blobs";

const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"; // no 0/O, 1/I/L
const MAX_BYTES = 60000;

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
});
const normalise = c => String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const isCode = c => c.length === 6 && [...c].every(ch => ALPHABET.includes(ch));
function newCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return [...bytes].map(b => ALPHABET[b % ALPHABET.length]).join("");
}
// Keep only the fields the planner uses, with sensible limits.
function clean(body) {
  if (!body || typeof body !== "object" || typeof body.settings !== "object" || !Array.isArray(body.plan)) return null;
  if (body.plan.length > 120) return null;
  return { settings: body.settings, plan: body.plan, saved: new Date().toISOString() };
}

export default async (req) => {
  const store = getStore({ name: "plans", consistency: "strong" });
  const url = new URL(req.url);

  if (req.method === "GET") {
    const code = normalise(url.searchParams.get("code"));
    if (!isCode(code)) return json({ error: "That isn't a valid plan code." }, 400);
    const data = await store.get(code, { type: "json" });
    return data ? json(data) : json({ error: "No plan has that code." }, 404);
  }

  if (req.method === "POST" || req.method === "PUT") {
    const text = await req.text();
    if (text.length > MAX_BYTES) return json({ error: "Plan is too large." }, 413);
    let body; try { body = JSON.parse(text); } catch (e) { return json({ error: "Plan data is not valid." }, 400); }
    const data = clean(body);
    if (!data) return json({ error: "Plan data is not valid." }, 400);
    let code;
    if (req.method === "PUT") {
      code = normalise(url.searchParams.get("code"));
      if (!isCode(code)) return json({ error: "That isn't a valid plan code." }, 400);
      if (!(await store.get(code))) return json({ error: "No plan has that code." }, 404);
    } else {
      for (let i = 0; i < 8 && !code; i++) { const c = newCode(); if (!(await store.get(c))) code = c; }
      if (!code) return json({ error: "Couldn't make a new code. Try again." }, 503);
    }
    await store.setJSON(code, data);
    return json({ code });
  }

  return json({ error: "Method not allowed" }, 405);
};

export const config = { path: "/api/plans" };
