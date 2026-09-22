"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RegistroPage() {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/auth/registro", {
      method: "POST",
      body: JSON.stringify({ nombre, email, password }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Error al registrarse");
      return;
    }
    router.push("/login");
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="text-xl font-semibold">Crear cuenta</h1>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <input
          placeholder="Nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          className="rounded-md border border-border bg-background p-2"
          required
        />
        <input
          type="email"
          placeholder="Mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-md border border-border bg-background p-2"
          required
        />
        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-md border border-border bg-background p-2"
          required
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" className="rounded-md bg-primary p-2 text-primary-foreground">
          Crear cuenta
        </button>
      </form>
    </main>
  );
}
