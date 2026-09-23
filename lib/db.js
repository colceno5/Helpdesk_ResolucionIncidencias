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
  // fechas Desde/Hasta seleccionado, y también la config de umbrales de exceso
  // SLA de la pestaña "Análisis y Mejora"), para que no se pierda al cambiar de
  // navegador o dispositivo. Es un simple key-value: una fila por ajuste.
  await sql`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TIMESTAMPTZ DEFAULT now()
    );
  `;

  // --- Pestaña "Análisis y Mejora" ---------------------------------------

  // Causa de demora asignada manualmente a un ticket vencido. Independiente de
  // la tabla `tickets` (que se sobrescribe por completo en cada carga de Aranda)
  // para no perder esta clasificación cuando se vuelve a subir el mismo periodo.
  await sql`
    CREATE TABLE IF NOT EXISTS causas_demora (
      ticket TEXT PRIMARY KEY,
      causa TEXT,
      nota TEXT,
      updated_at TIMESTAMPTZ DEFAULT now()
    );
  `;

  // Base de conocimientos: artículos creados a partir de problemas recurrentes
  // o manualmente por el gestor.
  await sql`
    CREATE TABLE IF NOT EXISTS kb_articulos (
      id SERIAL PRIMARY KEY,
      titulo TEXT,
      servicio TEXT,
      categoria TEXT,
      problema TEXT,
      sintomas TEXT,
      causa TEXT,
      solucion TEXT,
      pasos TEXT,
      palabras_clave TEXT,
      publico_objetivo TEXT,
      dificultad TEXT,
      estado TEXT DEFAULT 'Borrador',
      autor TEXT,
      tickets_relacionados TEXT,
      usos INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
  `;

  // Plan de acciones de mejora derivadas del análisis semanal, con seguimiento
  // de resultado (medición antes/después).
  await sql`
    CREATE TABLE IF NOT EXISTS acciones_mejora (
      id SERIAL PRIMARY KEY,
      accion TEXT,
      problema TEXT,
      causa TEXT,
      responsable TEXT,
      fecha_compromiso DATE,
      estado TEXT DEFAULT 'Pendiente',
      prioridad TEXT,
      resultado_esperado TEXT,
      fecha_cierre DATE,
      observaciones TEXT,
      metrica_antes TEXT,
      metrica_despues TEXT,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
  `;

  // --- Pestaña "Registro de vencidos" ------------------------------------

  // Sustento de atención de cada ticket vencido (clave 'REQ-1234') o de cada tarea (clave
  // 'T:<n° de tarea>'): fecha real, sustento, acción inmediata y si el candado está activo
  // (aplicado = recalcula cierre y progreso en todo el aplicativo). Independiente de `tickets`
  // y `tasks`, que guardan siempre los datos ORIGINALES de Aranda: así el "antes" nunca se
  // pierde y el sustento sobrevive a volver a subir el mismo periodo.
  // fecha_real es TEXT porque guarda la hora local de Perú tal como se digitó
  // ('YYYY-MM-DDTHH:mm'; los registros antiguos traen solo 'YYYY-MM-DD').
  await sql`
    CREATE TABLE IF NOT EXISTS sustentos (
      ticket TEXT PRIMARY KEY,
      fecha_real TEXT,
      sustento TEXT,
      accion TEXT,
      aplicado BOOLEAN DEFAULT false,
      updated_at TIMESTAMPTZ DEFAULT now()
    );
  `;

  schemaReady = true;
}
