import type { NextAuthConfig } from "next-auth";

// config "edge-safe": sin providers ni acceso a la base, la usa el
// middleware (corre en el edge) para decidir si redirige a /login.
export const authConfig = {
  // confío en el header host de la petición para armar las urls de redirect
  // (login, signout) — sin esto Auth.js usa localhost como fallback y rompe
  // el acceso desde otra ip/host (ej: celular en la red local)
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const logueado = !!auth?.user;
      const esPaginaPublica = ["/login", "/registro"].includes(nextUrl.pathname);
      if (esPaginaPublica) return true;
      return logueado;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
