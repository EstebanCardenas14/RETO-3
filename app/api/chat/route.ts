import { z } from "zod";
import { processChat } from "@/src/agent/orchestrator";

const RequestSchema = z.object({ sessionId: z.string().optional(), message: z.string().optional(), action: z.enum(["confirm", "cancel"]).optional() });

export async function POST(request: Request) {
  const parsed = RequestSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
  try { return Response.json({ ok: true, data: await processChat(parsed.data) }); }
  catch (error) { return Response.json({ ok: false, error: error instanceof Error ? error.message : "Error interno" }, { status: 500 }); }
}
