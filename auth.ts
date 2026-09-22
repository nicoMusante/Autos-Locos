import NextAuth, { CredentialsSignin } from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { authConfig } from "./auth.config";
import { sql } from "@/lib/db";
import { demasiadosIntentos, registrarIntentoFallido, limpiarIntentos } from "@/lib/rateLimit";

// la tiro cuando un mail viene bloqueado por demasiados intentos fallidos
// seguidos — el code queda expuesto en la url de redirect, por eso uso uno
// genérico que no confirma si el mail existe o no
class DemasiadosIntentos extends CredentialsSignin {
  code = "rate_limited";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  session: { strategy: "jwt" },
  providers: [
    // sólo se agrega el provider de Google si están las env vars completas,
    // así el login con mail/contraseña funciona igual sin tenerlas configuradas
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [Google({ clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET })]
      : []),
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const identificador = email.trim().toLowerCase();
        if (await demasiadosIntentos(identificador)) {
          throw new DemasiadosIntentos();
        }

        const rows = await sql`SELECT id, email, nombre, password_hash FROM usuarios WHERE email = ${identificador}`;
        const usuario = rows[0] as { id: number; email: string; nombre: string; password_hash: string | null } | undefined;
        if (!usuario?.password_hash) {
          await registrarIntentoFallido(identificador);
          return null;
        }

        const valido = await bcrypt.compare(password, usuario.password_hash);
        if (!valido) {
          await registrarIntentoFallido(identificador);
          return null;
        }

        await limpiarIntentos(identificador);
        return { id: String(usuario.id), email: usuario.email, name: usuario.nombre };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    // login con Google: si el mail todavía no tiene cuenta, la creo sola
    async signIn({ user, account }) {
      if (account?.provider === "google" && user.email) {
        const existente = await sql`SELECT id FROM usuarios WHERE email = ${user.email}`;
        if (existente.length === 0) {
          await sql`
            INSERT INTO usuarios (email, nombre, google_id)
            VALUES (${user.email}, ${user.name ?? user.email}, ${account.providerAccountId})
          `;
        }
      }
      return true;
    },
    // en el primer login (con o sin Google) resuelvo el usuario_id interno
    // por email y lo guardo en el token, para no pegarle a la base en cada request
    async jwt({ token, user }) {
      if (user?.email) {
        const rows = await sql`SELECT id FROM usuarios WHERE email = ${user.email}`;
        if (rows[0]) token.usuarioId = rows[0].id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.usuarioId) {
        session.user.id = String(token.usuarioId);
      }
      return session;
    },
  },
});
