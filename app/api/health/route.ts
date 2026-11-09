export async function GET() {
  return Response.json({ ok: true, mode: process.env.AGENT_MODE ?? "deterministic", provider: "disabled", model: null });
}
