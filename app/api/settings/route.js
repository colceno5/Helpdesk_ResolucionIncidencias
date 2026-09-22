import { sql } from '@vercel/postgres';
import { ensureSchema } from '../../../lib/db';

// Nunca cachear: el rango guardado debe reflejarse de inmediato para todos.
export const dynamic = 'force-dynamic';

// Devuelve el rango de fechas (Desde/Hasta) guardado por el último que lo
// haya cambiado, los umbrales de exceso SLA de "Análisis y Mejora"
// (slaThresholds), y si el switch "Corregir -5h en fechas de tickets" está
// activo (ticketOffset: '1' o '0'), para que los tres se mantengan igual sin
// importar quién o desde dónde (navegador/dispositivo) abra la app.
export async function GET() {
  try {
    await ensureSchema();
    const { rows } = await sql`
      SELECT key, value FROM app_settings WHERE key IN ('dateFrom', 'dateTo', 'slaThresholds', 'ticketOffset');
    `;
    const out = { dateFrom: null, dateTo: null, slaThresholds: null, ticketOffset: null };
    rows.forEach((r) => { out[r.key] = r.value; });
    return Response.json({ ok: true, ...out });
  } catch (err) {
    console.error('GET /api/settings', err);
    return Response.json({ ok: false, error: String((err && err.message) || err) }, { status: 500 });
  }
}

// Guarda cualquiera de los ajustes recibidos (dateFrom/dateTo, slaThresholds
// y/o ticketOffset) para que persistan para cualquiera que abra la app
// después, desde cualquier navegador. Los que no vengan en el body no se tocan.
export async function POST(req) {
  try {
    await ensureSchema();
    const body = await req.json();
    const { dateFrom, dateTo, slaThresholds, ticketOffset } = body || {};

    if (dateFrom !== undefined) {
      await sql`
        INSERT INTO app_settings (key, value, updated_at) VALUES ('dateFrom', ${dateFrom ?? null}, now())
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
      `;
    }
    if (dateTo !== undefined) {
      await sql`
        INSERT INTO app_settings (key, value, updated_at) VALUES ('dateTo', ${dateTo ?? null}, now())
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
      `;
    }
    if (slaThresholds !== undefined) {
      await sql`
        INSERT INTO app_settings (key, value, updated_at) VALUES ('slaThresholds', ${slaThresholds ?? null}, now())
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
      `;
    }
    if (ticketOffset !== undefined) {
      await sql`
        INSERT INTO app_settings (key, value, updated_at) VALUES ('ticketOffset', ${ticketOffset ?? null}, now())
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
      `;
    }

    return Response.json({ ok: true });
  } catch (err) {
    console.error('POST /api/settings', err);
    return Response.json({ ok: false, error: String((err && err.message) || err) }, { status: 500 });
  }
}
