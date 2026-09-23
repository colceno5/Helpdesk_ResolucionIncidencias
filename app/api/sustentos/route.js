import { sql } from '@vercel/postgres';
import { ensureSchema } from '../../../lib/db';

// Nunca cachear: un sustento guardado debe verse de inmediato desde cualquier equipo.
export const dynamic = 'force-dynamic';

function mapRow(r) {
  return {
    ticket: r.ticket,          // 'REQ-1234' para tickets · 'T:<n° de tarea>' para tareas
    fechaReal: r.fecha_real,   // 'YYYY-MM-DDTHH:mm' (hora de Perú) o 'YYYY-MM-DD' en registros antiguos
    sustento: r.sustento,
    accion: r.accion,
    aplicado: r.aplicado,      // candado activo
    updatedAt: r.updated_at,
  };
}

// Devuelve todos los sustentos guardados (independiente de la tabla `tickets`, para que no
// se pierdan cuando se vuelve a subir el mismo periodo de Aranda).
export async function GET() {
  try {
    await ensureSchema();
    const { rows } = await sql`
      SELECT ticket, fecha_real, sustento, accion, aplicado, updated_at
      FROM sustentos ORDER BY updated_at DESC;
    `;
    return Response.json({ ok: true, sustentos: rows.map(mapRow) });
  } catch (err) {
    console.error('GET /api/sustentos', err);
    return Response.json({ ok: false, error: String((err && err.message) || err) }, { status: 500 });
  }
}

// Guarda (o borra, si fechaReal, sustento y acción vienen vacíos) el sustento de un ticket/tarea.
// El cliente siempre manda el registro completo, así que es un upsert por `ticket`.
export async function POST(req) {
  try {
    await ensureSchema();
    const body = (await req.json()) || {};

    const ticket = String(body.ticket ?? '').trim();
    if (!ticket) return Response.json({ ok: false, error: 'Falta el ticket' }, { status: 400 });
    if (ticket.length > 100) return Response.json({ ok: false, error: 'Ticket demasiado largo' }, { status: 400 });

    const fechaReal = String(body.fechaReal ?? '').trim();
    const sustento = String(body.sustento ?? '');
    const accion = String(body.accion ?? '');
    if (fechaReal && !/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/.test(fechaReal)) {
      return Response.json({ ok: false, error: 'Fecha real inválida' }, { status: 400 });
    }
    if (sustento.length > 20000 || accion.length > 20000) {
      return Response.json({ ok: false, error: 'Texto demasiado largo' }, { status: 400 });
    }

    if (!fechaReal && !sustento.trim() && !accion.trim()) {
      await sql`DELETE FROM sustentos WHERE ticket = ${ticket};`;
      return Response.json({ ok: true, deleted: true });
    }

    // El candado solo tiene sentido en un registro completo (fecha real + sustento).
    const aplicado = body.aplicado === true && !!fechaReal && !!sustento.trim();

    const { rows } = await sql`
      INSERT INTO sustentos (ticket, fecha_real, sustento, accion, aplicado, updated_at)
      VALUES (${ticket}, ${fechaReal || null}, ${sustento || null}, ${accion || null}, ${aplicado}, now())
      ON CONFLICT (ticket) DO UPDATE SET
        fecha_real = EXCLUDED.fecha_real,
        sustento = EXCLUDED.sustento,
        accion = EXCLUDED.accion,
        aplicado = EXCLUDED.aplicado,
        updated_at = now()
      RETURNING ticket, fecha_real, sustento, accion, aplicado, updated_at;
    `;
    return Response.json({ ok: true, sustento: mapRow(rows[0]) });
  } catch (err) {
    console.error('POST /api/sustentos', err);
    return Response.json({ ok: false, error: String((err && err.message) || err) }, { status: 500 });
  }
}
