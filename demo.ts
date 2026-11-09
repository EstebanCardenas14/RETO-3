import { rm } from "node:fs/promises";
import { oc_crear, oc_validar } from "./src/tools/oc";

async function run(caso: string, confirmado = false) {
  const validation = JSON.parse(await oc_validar({ caso }));
  if (!validation.ok) throw new Error(validation.error.message);
  const value = validation.data;
  if (!value.apta) return `${caso} | bloqueado | ${value.bloqueos.map((item: { codigo: string }) => item.codigo).join(",")}`;
  if (value.confirmaciones.length && !confirmado) return `${caso} | pendiente | ${value.confirmaciones.map((item: { codigo: string }) => item.codigo).join(",")}`;
  const order = JSON.parse(await oc_crear({ caso, confirmado }));
  if (!order.ok) throw new Error(order.error.message);
  return `${caso} | OC=${order.data.numero_oc}${order.data.idempotente ? " | idempotente" : ""}${value.retroactiva ? " | retroactiva" : ""}`;
}

async function main() {
  await rm("out", { recursive: true, force: true });
  console.log(await run("sol-001"));
  console.log(await run("sol-001"));
  console.log(await run("sol-002"));
  console.log(await run("sol-003"));
  console.log(await run("sol-004"));
  console.log(await run("sol-004", true));
  console.log(await run("sol-005"));
  console.log(await run("sol-006"));
}

void main();
