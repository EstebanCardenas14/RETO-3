import { z } from "zod";
import { failure, result, type OrdenCompra } from "@/src/contracts/domain";
import { createOrder, createPayload, evidenceFor, loadPackage, validatePackage, writeTrace } from "@/src/services/procurement";

const CasoSchema = z.object({ caso: z.string().describe("Identificador del caso, por ejemplo sol-001") });
const PayloadSchema = z.object({ caso: z.string().describe("Identificador del caso"), confirmado: z.boolean().default(false).describe("Confirmación explícita de excepciones") });

export async function oc_leer_paquete(input: unknown): Promise<string> {
  const parsed = CasoSchema.safeParse(input); if (!parsed.success) return failure("ARGUMENTOS_INVALIDOS", parsed.error.message);
  try { return result(await loadPackage(parsed.data.caso)); } catch (error) { return failure("LECTURA_PAQUETE", error instanceof Error ? error.message : "Error desconocido"); }
}
export async function oc_validar(input: unknown): Promise<string> {
  const parsed = CasoSchema.safeParse(input); if (!parsed.success) return failure("ARGUMENTOS_INVALIDOS", parsed.error.message);
  try { const paquete = await loadPackage(parsed.data.caso); return result(await validatePackage(paquete)); } catch (error) { return failure("VALIDACION", error instanceof Error ? error.message : "Error desconocido"); }
}
export async function oc_construir_payload(input: unknown): Promise<string> {
  const parsed = CasoSchema.safeParse(input); if (!parsed.success) return failure("ARGUMENTOS_INVALIDOS", parsed.error.message);
  try { const paquete = await loadPackage(parsed.data.caso); const validation = await validatePackage(paquete); const payload = await createPayload(paquete, validation, parsed.data.caso); const trace = await writeTrace(parsed.data.caso, paquete, validation, payload); return result({ payload, trazabilidad: trace }); } catch (error) { return failure("PAYLOAD", error instanceof Error ? error.message : "Error desconocido"); }
}
export async function oc_generar_evidencia(input: unknown): Promise<string> {
  const parsed = CasoSchema.safeParse(input); if (!parsed.success) return failure("ARGUMENTOS_INVALIDOS", parsed.error.message);
  try { const paquete = await loadPackage(parsed.data.caso); return result(await evidenceFor(parsed.data.caso, paquete)); } catch (error) { return failure("EVIDENCIA", error instanceof Error ? error.message : "Error desconocido"); }
}
export async function oc_crear(input: unknown): Promise<string> {
  const parsed = PayloadSchema.safeParse(input); if (!parsed.success) return failure("ARGUMENTOS_INVALIDOS", parsed.error.message);
  try { const paquete = await loadPackage(parsed.data.caso); const validation = await validatePackage(paquete); const payload: OrdenCompra = await createPayload(paquete, validation, parsed.data.caso); await writeTrace(parsed.data.caso, paquete, validation, payload); return result(await createOrder(payload, validation, parsed.data.confirmado)); } catch (error) { return failure("CREACION_OC", error instanceof Error ? error.message : "Error desconocido"); }
}
