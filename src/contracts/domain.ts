import { z } from "zod";

export const SolicitudSchema = z.object({
  solicitud_id: z.string(),
  solicitante: z.string(),
  proveedor_nombre: z.string(),
  proveedor_nit: z.string().optional(),
  descripcion: z.string(),
  centro_costo: z.string(),
  subarea: z.string(),
  cantidad: z.number().positive(),
  valor_unitario: z.number().nonnegative(),
  valor_total: z.number().nonnegative(),
  moneda: z.enum(["COP", "USD"]),
  indicador_iva: z.string().optional(),
  condiciones_pago: z.string().optional(),
  fecha_solicitud: z.string(),
});

export const CorreoSchema = z.object({
  correo_id: z.string().optional(),
  id: z.string().optional(),
  de: z.string(),
  para: z.string(),
  fecha: z.string(),
  asunto: z.string(),
  cuerpo: z.string(),
  adjuntos: z.array(z.string()).default([]),
}).transform((correo) => ({ ...correo, correo_id: correo.correo_id ?? correo.id ?? "sin-correo" }));

export const AprobacionSchema = z.object({
  de: z.string(),
  para: z.string(),
  fecha: z.string(),
  asunto: z.string(),
  cuerpo: z.string(),
});

export const ProveedorSchema = z.object({
  codigo_sap: z.string(),
  nit: z.string(),
  nombre: z.string(),
  condiciones_pago_default: z.string(),
  indicador_iva_default: z.string(),
  activo: z.boolean(),
});

export const CentroCostoSchema = z.object({
  codigo: z.string().optional(),
  centro_costo: z.string().optional(),
  nombre: z.string(),
  subareas_permitidas: z.array(z.string()).optional(),
  subareas: z.array(z.string()).optional(),
  aprobadores: z.array(z.object({ email: z.string(), nombre: z.string(), tope: z.number().nonnegative() })),
}).transform((centro) => ({ ...centro, codigo: centro.codigo ?? centro.centro_costo ?? "", subareas_permitidas: centro.subareas_permitidas ?? centro.subareas ?? [] }));

export const CotizacionSchema = z.object({
  referencia: z.string().nullable(),
  proveedor_nombre: z.string().nullable(),
  proveedor_nit: z.string().nullable(),
  total: z.number().nullable(),
  moneda: z.string().nullable(),
  texto: z.string(),
});

export const FacturaSchema = z.object({ fecha: z.string().nullable(), referencia: z.string().nullable(), texto: z.string() });

export const PaqueteSchema = z.object({
  solicitud: SolicitudSchema,
  correo: CorreoSchema,
  aprobacion: AprobacionSchema.nullable(),
  cotizacion: CotizacionSchema.nullable(),
  factura: FacturaSchema.nullable(),
});

export const ExcepcionSchema = z.object({ codigo: z.string(), detalle: z.string(), confirmado_por: z.string().nullable() });
export const OrdenCompraSchema = z.object({
  referencia: z.object({ solicitud_id: z.string(), correo_id: z.string(), cotizacion_ref: z.string().nullable() }),
  sociedad: z.literal("1000"),
  organizacion_compras: z.literal("1000"),
  proveedor: z.object({ codigo_sap: z.string(), nit: z.string(), nombre: z.string() }),
  moneda: z.enum(["COP", "USD"]),
  condiciones_pago: z.string(),
  aprobador: z.object({ email: z.string(), fecha_aprobacion: z.string(), evidencia_sha256: z.string() }),
  posiciones: z.array(z.object({ numero: z.number().int().positive(), descripcion: z.string().max(40), cantidad: z.number().positive(), unidad: z.enum(["UN", "H", "MES"]), precio_unitario: z.number().nonnegative(), centro_costo: z.string(), subarea: z.string(), indicador_iva: z.string() })).min(1),
  excepciones: z.array(ExcepcionSchema),
});

export type Solicitud = z.infer<typeof SolicitudSchema>;
export type Paquete = z.infer<typeof PaqueteSchema>;
export type Proveedor = z.infer<typeof ProveedorSchema>;
export type CentroCosto = z.infer<typeof CentroCostoSchema>;
export type OrdenCompra = z.infer<typeof OrdenCompraSchema>;
export type Excepcion = z.infer<typeof ExcepcionSchema>;

export type ItemControl = { codigo: string; mensaje: string; accion_sugerida: string };
export type Validacion = { apta: boolean; bloqueos: ItemControl[]; confirmaciones: ItemControl[]; derivados: { proveedor?: Proveedor; indicador_iva?: string; condiciones_pago?: string; unidad: "UN" | "H" | "MES" }; retroactiva: boolean };

export type ToolResult<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } };
export const result = <T>(data: T): string => JSON.stringify({ ok: true, data } satisfies ToolResult<T>);
export const failure = (code: string, message: string): string => JSON.stringify({ ok: false, error: { code, message } } satisfies ToolResult<never>);
