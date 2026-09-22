import { redirect } from "next/navigation";
import { auth } from "@/auth";
import Calendario from "@/components/calendario/Calendario";

export default async function Home() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return <Calendario usuarioActual={session.user.name ?? "Nico"} />;
}
