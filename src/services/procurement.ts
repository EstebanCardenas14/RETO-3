import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  AprobacionSchema, CentroCostoSchema, CorreoSchema, CotizacionSchema, FacturaSchema, OrdenCompraSchema, PaqueteSchema, ProveedorSchema, SolicitudSchema,
  type CentroCosto, type OrdenCompra, type Paquete, type Proveedor, type Validacion,
} from "@/src/contracts/domain";

const root = () => path.resolve(process.cwd(), process.env.FIXTURES_ROOT ?? "reto-03");
const out = () => path.resolve(process.cwd(), process.env.OUT_ROOT ?? "out");
const readJson = async (file: string): Promise<unknown> => JSON.parse(await fs.readFile(file, "utf8"));
const normalized = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const nitBase = (value: string) => value.replace(/\D/g, "").slice(0, 9);
const sha = (value: string) => createHash("sha256").update(value).digest("hex");

function parseQuotation(text: string) {
  const reference = text.match(/(?:cotizaci[oó]n|ref(?:erencia)?)[\s:#-]*([A-Z0-9-]+)/i)?.[1] ?? null;
  const nit = text.match(/nit[\s:]*([\d.\-]+)/i)?.[1] ?? null;
  const totalMatch = text.match(/total[^\d]*\$?\s*([\d.,]+)/i);
  const total = totalMatch ? Number(totalMatch[1].replace(/\./g, "").replace(",", ".")) : null;
  const name = text.match(/(?:proveedor|señores)[\s:]*([^\n]+)/i)?.[1]?.trim() ?? null;
  return CotizacionSchema.parse({ referencia: reference, proveedor_nombre: name, proveedor_nit: nit, total, moneda: text.match(/\b(COP|USD)\b/i)?.[1]?.toUpperCase() ?? "COP", texto: text });
}

function parseInvoice(text: string) {
  const date = text.match(/(?:fecha(?:\s+de\s+emisi[oó]n)?)[\s:]*([0-9]{4}-[0-9]{2}-[0-9]{2})/i)?.[1] ?? null;
  const reference = text.match(/(?:factura|ref(?:erencia)?)[\s:#-]*([A-Z0-9-]+)/i)?.[1] ?? null;
  return FacturaSchema.parse({ fecha: date, referencia: reference, texto: text });
}

export async function loadPackage(caso: string): Promise<Paquete> {
  const dir = path.join(root(), "solicitudes", caso);
  const solicitud = SolicitudSchema.parse(await readJson(path.join(dir, "solicitud.json")));
  const correo = CorreoSchema.parse(await readJson(path.join(dir, "correo.json")));
  let aprobacion = null;
  let cotizacion = null;
  let factura = null;
  try { aprobacion = AprobacionSchema.parse(await readJson(path.join(dir, "aprobacion.json"))); } catch { }
  try { cotizacion = parseQuotation(await fs.readFile(path.join(dir, "cotizacion.txt"), "utf8")); } catch { }
  try { factura = parseInvoice(await fs.readFile(path.join(dir, "factura.txt"), "utf8")); } catch { }
  return PaqueteSchema.parse({ solicitud, correo, aprobacion, cotizacion, factura });
}

async function masters() {
  const base = path.join(root(), "maestros");
  const providers = ProveedorSchema.array().parse(await readJson(path.join(base, "proveedores.json")));
  const centers = CentroCostoSchema.array().parse(await readJson(path.join(base, "centros-costo.json")));
  return { providers, centers };
}

export async function validatePackage(paquete: Paquete): Promise<Validacion> {
  const { providers, centers } = await masters();
  const { solicitud, aprobacion, cotizacion, factura } = paquete;
  const bloqueos: Validacion["bloqueos"] = [];
  const confirmaciones: Validacion["confirmaciones"] = [];
  const provider = providers.find((item) => solicitud.proveedor_nit ? nitBase(item.nit) === nitBase(solicitud.proveedor_nit) : normalized(item.nombre) === normalized(solicitud.proveedor_nombre));
  if (!provider || !provider.activo) bloqueos.push({ codigo: "RC1", mensaje: "Proveedor inexistente o inactivo.", accion_sugerida: "Solicite creación o activación en maestro de proveedores." });
  const center = centers.find((item) => item.codigo === solicitud.centro_costo);
  if (!center) bloqueos.push({ codigo: "RC4", mensaje: "Centro de costo inexistente.", accion_sugerida: "Corrija el centro de costo." });
  else if (!center.subareas_permitidas.includes(solicitud.subarea)) bloqueos.push({ codigo: "RC4", mensaje: "La subárea no pertenece al centro de costo.", accion_sugerida: "Corrija la subárea o el centro." });
  const approver = aprobacion && center?.aprobadores.find((item) => normalized(item.email) === normalized(aprobacion.de));
  const approved = aprobacion && /\baprobado\b/i.test(aprobacion.cuerpo) && !/no\s+aprobado/i.test(aprobacion.cuerpo);
  if (!approved || !approver) bloqueos.push({ codigo: "RC2", mensaje: "Aprobación ausente, inválida o no autorizada.", accion_sugerida: "Obtenga aprobación del autorizador del centro." });
  const maximumApprovalLimit = center ? Math.max(...center.aprobadores.map((item) => item.tope)) : 0;
  if ((approver && solicitud.valor_total > approver.tope) || (!approver && center && solicitud.valor_total > maximumApprovalLimit)) bloqueos.push({ codigo: "RC3", mensaje: "El valor supera el tope de aprobación disponible para el centro.", accion_sugerida: "Solicite aprobación con facultad suficiente." });
  if (Math.abs(solicitud.cantidad * solicitud.valor_unitario - solicitud.valor_total) > 1) bloqueos.push({ codigo: "RC10", mensaje: "Cantidad por valor unitario no coincide con total.", accion_sugerida: "Corrija los valores de solicitud." });
  if (!cotizacion || cotizacion.total === null || Math.abs(cotizacion.total - solicitud.valor_total) / solicitud.valor_total > 0.02) confirmaciones.push({ codigo: "RC5", mensaje: "Cotización ausente o diferencia superior a 2%.", accion_sugerida: "Confirme la excepción comercial." });
  const indicador_iva = solicitud.indicador_iva ?? provider?.indicador_iva_default;
  if (!solicitud.indicador_iva && indicador_iva) confirmaciones.push({ codigo: "RC6", mensaje: `IVA derivado desde maestro: ${indicador_iva}.`, accion_sugerida: "Confirme el indicador IVA derivado." });
  const condiciones_pago = solicitud.condiciones_pago ?? provider?.condiciones_pago_default;
  if (factura?.fecha && factura.fecha < solicitud.fecha_solicitud) confirmaciones.push({ codigo: "RC8", mensaje: "La factura es previa a la solicitud; OC retroactiva.", accion_sugerida: "Confirme la creación retroactiva." });
  if (aprobacion && aprobacion.fecha.slice(0, 10) < solicitud.fecha_solicitud) confirmaciones.push({ codigo: "RC9", mensaje: "Aprobación previa a la solicitud.", accion_sugerida: "Confirme la excepción de fecha." });
  const unit = /\bhoras?\b/i.test(solicitud.descripcion) ? "H" : /\bmes(?:es)?\b/i.test(solicitud.descripcion) && /servicio/i.test(solicitud.descripcion) ? "MES" : "UN";
  return { apta: bloqueos.length === 0, bloqueos, confirmaciones, derivados: { proveedor: provider, indicador_iva, condiciones_pago, unidad: unit }, retroactiva: Boolean(factura?.fecha && factura.fecha < solicitud.fecha_solicitud) };
}

const short = (text: string) => text.replace(/\s+/g, " ").trim().slice(0, 40);
export async function createPayload(paquete: Paquete, validation: Validacion, caseName: string): Promise<OrdenCompra> {
  if (!validation.apta || !validation.derivados.proveedor || !validation.derivados.indicador_iva || !validation.derivados.condiciones_pago || !paquete.aprobacion) throw new Error("No hay información suficiente para construir payload.");
  const evidence = await evidenceFor(caseName, paquete);
  return OrdenCompraSchema.parse({
    referencia: { solicitud_id: paquete.solicitud.solicitud_id, correo_id: paquete.correo.correo_id, cotizacion_ref: paquete.cotizacion?.referencia ?? null },
    sociedad: "1000", organizacion_compras: "1000",
    proveedor: { codigo_sap: validation.derivados.proveedor.codigo_sap, nit: validation.derivados.proveedor.nit, nombre: validation.derivados.proveedor.nombre },
    moneda: paquete.solicitud.moneda, condiciones_pago: validation.derivados.condiciones_pago,
    aprobador: { email: paquete.aprobacion.de, fecha_aprobacion: paquete.aprobacion.fecha, evidencia_sha256: evidence.hash },
    posiciones: [{ numero: 10, descripcion: short(paquete.solicitud.descripcion), cantidad: paquete.solicitud.cantidad, unidad: validation.derivados.unidad, precio_unitario: paquete.solicitud.valor_unitario, centro_costo: paquete.solicitud.centro_costo, subarea: paquete.solicitud.subarea, indicador_iva: validation.derivados.indicador_iva }],
    excepciones: validation.confirmaciones.map((item) => ({ codigo: item.codigo, detalle: item.mensaje, confirmado_por: null })),
  });
}

export async function evidenceFor(caso: string, paquete: Paquete) {
  if (!paquete.aprobacion) throw new Error("No hay aprobación disponible.");
  const content = ["EVIDENCIA DE APROBACIÓN", `de: ${paquete.aprobacion.de}`, `para: ${paquete.aprobacion.para}`, `fecha: ${paquete.aprobacion.fecha}`, `asunto: ${paquete.aprobacion.asunto}`, "", paquete.aprobacion.cuerpo].join("\n");
  const hash = sha(content);
  const target = path.join(out(), caso, "aprobacion.txt");
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, `${content}\n\nSHA-256: ${hash}\n`, "utf8");
  return { hash, path: target };
}

export async function writeTrace(caso: string, paquete: Paquete, validation: Validacion, payload: OrdenCompra) {
  const target = path.join(out(), caso, "trazabilidad.json");
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, JSON.stringify({ solicitud_id: paquete.solicitud.solicitud_id, descripcion_original: paquete.solicitud.descripcion, descripcion_sap: payload.posiciones[0].descripcion, proveedor: "maestro.proveedores", precio_unitario: "solicitud", indicador_iva: paquete.solicitud.indicador_iva ? "solicitud" : "derivado", condiciones_pago: paquete.solicitud.condiciones_pago ? "solicitud" : "derivado", unidad: "derivado", confirmaciones: validation.confirmaciones }, null, 2));
  return target;
}

export async function createOrder(payload: OrdenCompra, validation: Validacion, confirmed: boolean) {
  if (!validation.apta) throw new Error("La solicitud tiene bloqueos.");
  if (validation.confirmaciones.length && !confirmed) throw new Error("La solicitud requiere confirmación explícita.");
  const sapDir = path.join(out(), "sap"); const ordersFile = path.join(sapDir, "ordenes.jsonl");
  await fs.mkdir(sapDir, { recursive: true });
  let lines: string[] = []; try { lines = (await fs.readFile(ordersFile, "utf8")).split("\n").filter(Boolean); } catch { }
  const existing = lines.map((line) => JSON.parse(line) as { payload: OrdenCompra; numero_oc: string }).find((row) => row.payload.referencia.solicitud_id === payload.referencia.solicitud_id);
  const record = existing ?? { numero_oc: String(4500000001 + lines.length), payload };
  if (!existing) await fs.appendFile(ordersFile, `${JSON.stringify(record)}\n`);
  const control = path.join(out(), "control.csv");
  try { await fs.access(control); } catch { await fs.mkdir(out(), { recursive: true }); await fs.writeFile(control, "solicitud_id,resultado,numero_oc,retroactiva,bloqueos,confirmaciones,ts\n"); }
  await fs.appendFile(control, `${payload.referencia.solicitud_id},creada,${record.numero_oc},${validation.retroactiva},,${validation.confirmaciones.map((item) => item.codigo).join("|")},${new Date().toISOString()}\n`);
  return { ...record, idempotente: Boolean(existing) };
}
