import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// corre en el edge, sin providers ni acceso a la base (ver auth.config.ts).
// las rutas de /api se excluyen del matcher: cada una chequea su propia
// sesión y devuelve 401 en vez de redirigir (un fetch no puede seguir un
// redirect a una página HTML como si fuera la respuesta esperada).
export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
