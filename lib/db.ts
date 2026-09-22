import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  throw new Error("Falta la variable de entorno DATABASE_URL");
}

// `sql` es una función "tagged template": sql`SELECT * FROM tabla WHERE id = ${id}`
// arma la query parametrizada sola, protegiendo contra SQL injection.
export const sql = neon(process.env.DATABASE_URL);
