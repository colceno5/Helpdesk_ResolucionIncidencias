import { sql } from '@vercel/postgres';
import { ensureSchema } from '../../../lib/db';

export const dynamic = 'force-dynamic';

// Devuelve todas las causas de demora registradas manualmente, indexadas por
// ticket. Independiente de la tabla `tickets` para no perderse cuando se
// vuelve a subir el mismo periodo de Aranda.
export async function GET() {
  try {
    await ensureSchema();
    const { rows } = await sql`SELECT ticket, causa, nota FROM causas_demora;`;
    return Response.json({ ok: true, causas: rows });
  } catch (err) {
    console.error('GET /api/causas', err);
    return Response.json({ ok: false, error: String((err && err.message) || err) }, { status: 500 });
  }
}

// Guarda (o borra, si causa viene vacío) la causa de demora de un ticket.
export async function POST(req) {
  try {
    await ensureSchema();
    const body = await req.json();
    const { ticket, causa, nota } = body || {};
    if (!ticket) return Response.json({ ok: false, error: 'Falta el ticket' }, { status: 400 });

    if (!causa) {
      await sql`DELETE FROM causas_demora WHERE ticket = ${String(ticket)};`;
      return Response.json({ ok: true, deleted: true });
    }

    await sql`
      INSERT INTO causas_demora (ticket, causa, nota, updated_at)
      VALUES (${String(ticket)}, ${causa}, ${nota ?? null}, now())
      ON CONFLICT (ticket) DO UPDATE SET
        causa = EXCLUDED.causa,
        nota = EXCLUDED.nota,
        updated_at = now();
    `;
    return Response.json({ ok: true });
  } catch (err) {
    console.error('POST /api/causas', err);
    return Response.json({ ok: false, error: String((err && err.message) || err) }, { status: 500 });
  }
}
