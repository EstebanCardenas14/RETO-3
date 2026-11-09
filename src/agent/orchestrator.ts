import { randomUUID } from "node:crypto";
import { createOrder, createPayload, loadPackage, validatePackage, writeTrace } from "@/src/services/procurement";

export type ChatResponse = { sessionId: string; reply: string; toolCalls: { name: string; ok: boolean }[]; needsConfirmation: boolean; validation?: Awaited<ReturnType<typeof validatePackage>>; order?: { numero_oc: string; idempotente: boolean } };
type Session = { caso?: string; pending?: boolean };
const sessions = new Map<string, Session>();
const findCase = (text: string) => text.match(/sol-00[1-6]/i)?.[0].toLowerCase();

export async function processChat(input: { sessionId?: string; message?: string; action?: "confirm" | "cancel" }): Promise<ChatResponse> {
  const sessionId = input.sessionId ?? randomUUID(); const session = sessions.get(sessionId) ?? {}; sessions.set(sessionId, session);
  if (input.action === "cancel") { session.pending = false; return { sessionId, reply: "La creación fue cancelada. No se generó una orden de compra.", toolCalls: [], needsConfirmation: false }; }
  if (input.action === "confirm") {
    if (!session.pending || !session.caso) return { sessionId, reply: "No hay una confirmación pendiente para esta sesión.", toolCalls: [], needsConfirmation: false };
    const paquete = await loadPackage(session.caso); const validation = await validatePackage(paquete); const payload = await createPayload(paquete, validation, session.caso); await writeTrace(session.caso, paquete, validation, payload); const order = await createOrder(payload, validation, true); session.pending = false;
    return { sessionId, reply: `OC ${order.numero_oc} creada${order.idempotente ? " (resultado idempotente)" : ""}.`, toolCalls: [{ name: "oc_crear", ok: true }], needsConfirmation: false, validation, order };
  }
  const caso = findCase(input.message ?? "") ?? session.caso;
  if (!caso) return { sessionId, reply: "Indica un caso entre sol-001 y sol-006 para iniciar el análisis.", toolCalls: [], needsConfirmation: false };
  session.caso = caso;
  const paquete = await loadPackage(caso); const validation = await validatePackage(paquete);
  const toolCalls = [{ name: "oc_leer_paquete", ok: true }, { name: "oc_validar", ok: true }];
  if (!validation.apta) return { sessionId, reply: `El caso ${caso} está bloqueado: ${validation.bloqueos.map((item) => `${item.codigo} — ${item.mensaje}`).join(" ")}`, toolCalls, needsConfirmation: false, validation };
  if (validation.confirmaciones.length) { session.pending = true; return { sessionId, reply: `El caso ${caso} requiere confirmación: ${validation.confirmaciones.map((item) => `${item.codigo} — ${item.mensaje}`).join(" ")}`, toolCalls, needsConfirmation: true, validation }; }
  const payload = await createPayload(paquete, validation, caso); await writeTrace(caso, paquete, validation, payload); const order = await createOrder(payload, validation, false);
  return { sessionId, reply: `OC ${order.numero_oc} creada automáticamente para ${caso}${order.idempotente ? " (resultado idempotente)" : ""}.`, toolCalls: [...toolCalls, { name: "oc_crear", ok: true }], needsConfirmation: false, validation, order };
}
