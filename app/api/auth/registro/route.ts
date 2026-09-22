import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";
import { demasiadosIntentos, registrarIntentoFallido, ipDelRequest } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const identificadorIp = `registro:${ipDelRequest(request)}`;
  if (await demasiadosIntentos(identificadorIp)) {
    return NextResponse.json({ error: "Demasiados intentos. Esperá unos minutos." }, { status: 429 });
  }

  const { email, password, nombre } = await request.json();
  if (!email || !password || !nombre) {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }

  const identificador = String(email).trim().toLowerCase();
  const existente = await sql`SELECT id FROM usuarios WHERE email = ${identificador}`;
  if (existente.length > 0) {
    await registrarIntentoFallido(identificadorIp);
    return NextResponse.json({ error: "Ese mail ya está registrado" }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await sql`
    INSERT INTO usuarios (email, password_hash, nombre)
    VALUES (${identificador}, ${passwordHash}, ${nombre})
  `;

  return NextResponse.json({ ok: true });
}
