import { NextResponse } from "next/server";
import { auth } from "@/auth";

// usuario_id de la sesión actual, o null si no hay sesión — cada ruta decide
// qué responder en ese caso (normalmente noAutenticado())
export async function getUsuarioId(): Promise<number | null> {
  const session = await auth();
  return session?.user?.id ? Number(session.user.id) : null;
}

export function noAutenticado() {
  return NextResponse.json({ error: "No autenticado" }, { status: 401 });
}
