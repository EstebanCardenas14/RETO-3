import { beforeEach, describe, expect, it } from "vitest";
import { rm } from "node:fs/promises";
import { oc_crear, oc_validar } from "@/src/tools/oc";

const parse = <T>(value: string) => JSON.parse(value) as T;

describe("controles de órdenes de compra", () => {
  beforeEach(async () => { await rm("out", { recursive: true, force: true }); });
  it("crea una OC e impide duplicados para sol-001", async () => {
    const first = parse<{ ok: boolean; data: { numero_oc: string; idempotente: boolean } }>(await oc_crear({ caso: "sol-001", confirmado: false }));
    const second = parse<{ ok: boolean; data: { numero_oc: string; idempotente: boolean } }>(await oc_crear({ caso: "sol-001", confirmado: false }));
    expect(first.ok).toBe(true); expect(first.data.numero_oc).toBe("4500000001"); expect(second.data.idempotente).toBe(true);
  });
  it("bloquea proveedor inexistente y autoridad insuficiente", async () => {
    const supplier = parse<{ data: { bloqueos: { codigo: string }[] } }>(await oc_validar({ caso: "sol-002" }));
    const approval = parse<{ data: { bloqueos: { codigo: string }[] } }>(await oc_validar({ caso: "sol-003" }));
    expect(supplier.data.bloqueos.map((item) => item.codigo)).toContain("RC1");
    expect(approval.data.bloqueos.map((item) => item.codigo)).toEqual(expect.arrayContaining(["RC2", "RC3"]));
  });
  it("identifica confirmaciones de diferencia, retroactividad e IVA derivado", async () => {
    const quotation = parse<{ data: { confirmaciones: { codigo: string }[] } }>(await oc_validar({ caso: "sol-004" }));
    const retroactive = parse<{ data: { retroactiva: boolean; confirmaciones: { codigo: string }[] } }>(await oc_validar({ caso: "sol-005" }));
    const iva = parse<{ data: { confirmaciones: { codigo: string }[] } }>(await oc_validar({ caso: "sol-006" }));
    expect(quotation.data.confirmaciones.map((item) => item.codigo)).toContain("RC5");
    expect(retroactive.data.retroactiva).toBe(true); expect(retroactive.data.confirmaciones.map((item) => item.codigo)).toContain("RC8");
    expect(iva.data.confirmaciones.map((item) => item.codigo)).toContain("RC6");
  });
});
