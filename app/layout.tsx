import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "OC Control", description: "Agente de órdenes de compra SAP" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="es"><body>{children}</body></html>; }
