import { NextResponse } from "next/server";
import { sql } from "./db";

const VENTANA_MINUTOS = 15;
const MAX_INTENTOS = 5;

// true si el identificador (mail, normalizado) ya superó el máximo de
// intentos fallidos dentro de la ventana de tiempo
export async function demasiadosIntentos(identificador: string): Promise<boolean> {
  const rows = await sql`
    SELECT COUNT(*)::int AS c FROM intentos_auth
    WHERE identificador = ${identificador} AND creado_en > CURRENT_TIMESTAMP - (${VENTANA_MINUTOS} * INTERVAL '1 minute')
  `;
  return Number((rows[0] as { c: number }).c) >= MAX_INTENTOS;
}

export async function registrarIntentoFallido(identificador: string) {
  await sql`INSERT INTO intentos_auth (identificador) VALUES (${identificador})`;
  // limpio de paso las filas viejas de este identificador (fuera de la
  // ventana que ya mira demasiadosIntentos) para que la tabla no crezca sin
  // límite con identificadores que no se repiten (ej. ips distintas)
  await sql`
    DELETE FROM intentos_auth
    WHERE identificador = ${identificador} AND creado_en <= CURRENT_TIMESTAMP - (${VENTANA_MINUTOS} * INTERVAL '1 minute')
  `;
}

// ip real del request — x-forwarded-for puede traer varias, separadas por
// coma; el primer valor lo controla el cliente (lo puede spoofear), el que
// vale es el último que agrega el proxy de confianza (Vercel)
export function ipDelRequest(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const partes = forwarded.split(",").map((p) => p.trim());
    return partes[partes.length - 1] || "desconocida";
  }
  return request.headers.get("x-real-ip") || "desconocida";
}

// se llama tras un login exitoso, para no arrastrar intentos viejos
export async function limpiarIntentos(identificador: string) {
  await sql`DELETE FROM intentos_auth WHERE identificador = ${identificador}`;
}

const VENTANA_API_MS = 10_000;
const MAX_REQ_API = 40;
// contador en memoria del proceso, para las rutas mutantes de la app (no las
// de auth, que ya tienen su propio límite contra la base más arriba). lo
// dejo en memoria a propósito y no contra postgres: es "best effort" (no
// persiste entre cold starts ni se comparte entre instancias) pero no le
// suma carga a la base justo en el momento en que más importa frenar, que
// es cuando hay una ráfaga
const contadorApi = new Map<string, number[]>();

// true si el identificador (normalmente `api:${usuarioId}`) ya superó el
// máximo de requests dentro de la ventana
export function demasiadasRequests(identificador: string): boolean {
  const ahora = Date.now();
  const marcas = (contadorApi.get(identificador) ?? []).filter((t) => ahora - t < VENTANA_API_MS);
  marcas.push(ahora);
  contadorApi.set(identificador, marcas);
  return marcas.length > MAX_REQ_API;
}

export function demasiadasPeticiones() {
  return NextResponse.json(
    { error: "Demasiadas peticiones. Esperá un momento y volvé a intentar." },
    { status: 429 }
  );
}
