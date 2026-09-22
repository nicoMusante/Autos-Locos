-- Snapshot manual e idempotente del esquema en Neon. No se corre automático
-- ni queda sincronizado solo: si se cambia algo en Neon, actualizar acá a mano.

CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  nombre TEXT NOT NULL,
  google_id TEXT UNIQUE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- intentos fallidos de login, usados por lib/rateLimit.ts para bloquear
-- tras 5 intentos en 15 minutos. sin limpieza automática: son pocas filas y
-- la query sólo mira los últimos 15 minutos.
CREATE TABLE IF NOT EXISTS intentos_auth (
  id SERIAL PRIMARY KEY,
  identificador TEXT NOT NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_intentos_auth_identificador ON intentos_auth (identificador);

-- fechas ancladas a Argentina: Neon corre en GMT y un ALTER DATABASE ...
-- SET timezone no alcanza (el driver HTTP abre una sesión nueva por query y
-- no hereda ese default). usar hoy_ar() en vez de CURRENT_DATE en cualquier
-- función/default nuevo que necesite "hoy".
CREATE OR REPLACE FUNCTION hoy_ar() RETURNS DATE AS $$
  SELECT (NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date;
$$ LANGUAGE sql STABLE;

-- ejemplo de tabla de datos multiusuario: toda tabla que no sea puramente
-- de auth lleva usuario_id, y cada función PL/pgSQL que la toca recibe
-- p_usuario_id como primer parámetro y filtra por él (no hay row-level
-- security de Postgres, el aislamiento se hace a mano en cada función/vista).
--
-- CREATE TABLE IF NOT EXISTS autos (
--   id SERIAL PRIMARY KEY,
--   usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
--   nombre TEXT NOT NULL,
--   creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
-- );
