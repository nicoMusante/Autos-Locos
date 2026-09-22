import { NextRequest } from "next/server";
import { handlers } from "@/auth";

// en "next dev" el request que le llega a los route handlers siempre trae
// origin "localhost" aunque se entre por otra ip (ej: celular en la red
// local) — el host real sólo queda en x-forwarded-host, así que lo uso para
// reconstruir la url antes de pasarla a next-auth (si no, arma las urls de
// redirect de login/logout apuntando a localhost y el celular no puede
// resolverlas)
function conHostReal(req: NextRequest) {
  const hostReal = req.headers.get("x-forwarded-host");
  if (!hostReal || req.nextUrl.host === hostReal) return req;
  const proto = req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "");
  const urlCorregida = req.nextUrl.href.replace(req.nextUrl.origin, `${proto}://${hostReal}`);
  return new NextRequest(urlCorregida, req);
}

export async function GET(req: NextRequest) {
  return handlers.GET(conHostReal(req));
}

export async function POST(req: NextRequest) {
  return handlers.POST(conHostReal(req));
}
