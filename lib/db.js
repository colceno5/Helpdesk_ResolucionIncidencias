import { sql } from '@vercel/postgres';

// Se ejecuta una sola vez por instancia de función serverless (se resetea en cada
// cold start, pero CREATE TABLE IF NOT EXISTS es idempotente, así que no hay problema).
let schemaReady = false;

export async function ensureSchema() {
  if (schemaReady) return;

  await sql`
    CREATE TABLE IF NOT EXISTS tickets (
      ticket TEXT PRIMARY KEY,
      estado TEXT,
      servicio TEXT,
      categoria TEXT,
      especialista TEXT,
      asunto TEXT,
      descripcion TEXT,
      fecha_cierre TIMESTAMPTZ,
      fecha_registro TIMESTAMPTZ,
      solucion TEXT,
      tipo_registro TEXT,
      tiempo TEXT,
      progreso_raw TEXT,
      pct DOUBLE PRECISION,
      cumple BOOLEAN,
      updated_at TIMESTAMPTZ DEFAULT now()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS tasks (
      tarea TEXT PRIMARY KEY,
      caso TEXT,
      tipo_caso TEXT,
      proyecto TEXT,
      estado TEXT,
      fecha_registro TIMESTAMPTZ,
      asunto TEXT,
      razon TEXT,
      responsable TEXT,
      grupo_responsable TEXT,
      receptor TEXT,
      fecha_cierre TIMESTAMPTZ,
      updated_at TIMESTAMPTZ DEFAULT now()
    );
  `;

  schemaReady = true;
}
