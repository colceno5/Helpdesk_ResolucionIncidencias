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
      fecha_modificacion TIMESTAMPTZ,
      solucion TEXT,
      tipo_registro TEXT,
      tiempo TEXT,
      progreso_raw TEXT,
      pct DOUBLE PRECISION,
      cumple BOOLEAN,
      updated_at TIMESTAMPTZ DEFAULT now()
    );
  `;

  // Migración para bases creadas antes de que existiera esta columna. El CREATE TABLE
  // de arriba no toca una tabla que ya existe, así que el ALTER es lo que la agrega en
  // producción. Es idempotente, así que puede quedarse aquí de forma permanente.
  await sql`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS fecha_modificacion TIMESTAMPTZ;`;

  // Igual que arriba: columnas para la hoja "Dashboard" (rankings de Cliente Final /
  // Autor Ticket, y volúmenes por Prioridad / Impacto / Urgencia). Opcionales por
  // diseño — si un archivo cargado no las trae, quedan en NULL sin romper nada.
  await sql`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS cliente_final TEXT;`;
  await sql`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS autor_ticket TEXT;`;
  await sql`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS prioridad TEXT;`;
  await sql`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS impacto TEXT;`;
  await sql`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS urgencia TEXT;`;

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

  // Configuración compartida entre todos los que abren la app (ej. el rango de
  // fechas Desde/Hasta seleccionado), para que no se pierda al cambiar de
  // navegador o dispositivo. Es un simple key-value: una fila por ajuste.
  await sql`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TIMESTAMPTZ DEFAULT now()
    );
  `;

  schemaReady = true;
}
