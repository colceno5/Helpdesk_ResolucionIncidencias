import { sql } from '@vercel/postgres';
import { ensureSchema } from '../../../lib/db';

// Nunca cachear: cada carga de archivo debe reflejarse de inmediato para todos.
export const dynamic = 'force-dynamic';

// Devuelve TODOS los tickets acumulados hasta ahora (de cualquier archivo subido antes).
export async function GET() {
  try {
    await ensureSchema();
    const { rows } = await sql`SELECT * FROM tickets ORDER BY fecha_registro ASC NULLS LAST;`;
    const tickets = rows.map((r) => ({
      ticket: r.ticket,
      estado: r.estado,
      servicio: r.servicio,
      categoria: r.categoria,
      especialista: r.especialista,
      asunto: r.asunto,
      descripcion: r.descripcion,
      fechaCierre: r.fecha_cierre,
      fechaRegistro: r.fecha_registro,
      fechaModificacion: r.fecha_modificacion,
      solucion: r.solucion,
      tipoRegistro: r.tipo_registro,
      tiempo: r.tiempo,
      progresoRaw: r.progreso_raw,
      pct: r.pct,
      cumple: r.cumple,
    }));
    return Response.json({ ok: true, count: tickets.length, tickets });
  } catch (err) {
    console.error('GET /api/tickets', err);
    return Response.json({ ok: false, error: String((err && err.message) || err) }, { status: 500 });
  }
}

// Inserta o actualiza (por número de Ticket) los tickets que llegan del archivo recién
// cargado. Volver a subir un periodo ya cargado antes actualiza esos registros en vez
// de duplicarlos — así el histórico crece de forma incremental sin importar el orden
// ni cuántas veces se repita un mismo archivo.
export async function POST(req) {
  try {
    await ensureSchema();
    const body = await req.json();
    const items = Array.isArray(body?.tickets) ? body.tickets : [];
    if (!items.length) return Response.json({ ok: true, upserted: 0 });

    const client = await sql.connect();
    let upserted = 0;
    try {
      await client.query('BEGIN');
      for (const t of items) {
        if (!t || !t.ticket) continue;
        await client.query(
          `INSERT INTO tickets (
             ticket, estado, servicio, categoria, especialista, asunto, descripcion,
             fecha_cierre, fecha_registro, fecha_modificacion, solucion, tipo_registro,
             tiempo, progreso_raw, pct, cumple, updated_at
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16, now())
           ON CONFLICT (ticket) DO UPDATE SET
             estado = EXCLUDED.estado,
             servicio = EXCLUDED.servicio,
             categoria = EXCLUDED.categoria,
             especialista = EXCLUDED.especialista,
             asunto = EXCLUDED.asunto,
             descripcion = EXCLUDED.descripcion,
             fecha_cierre = EXCLUDED.fecha_cierre,
             fecha_registro = EXCLUDED.fecha_registro,
             fecha_modificacion = COALESCE(EXCLUDED.fecha_modificacion, tickets.fecha_modificacion),
             solucion = EXCLUDED.solucion,
             tipo_registro = EXCLUDED.tipo_registro,
             tiempo = EXCLUDED.tiempo,
             progreso_raw = EXCLUDED.progreso_raw,
             pct = EXCLUDED.pct,
             cumple = EXCLUDED.cumple,
             updated_at = now();`,
          [
            String(t.ticket),
            t.estado ?? null,
            t.servicio ?? null,
            t.categoria ?? null,
            t.especialista ?? null,
            t.asunto ?? null,
            t.descripcion ?? null,
            t.fechaCierre ?? null,
            t.fechaRegistro ?? null,
            t.fechaModificacion ?? null,
            t.solucion ?? null,
            t.tipoRegistro ?? null,
            t.tiempo ?? null,
            t.progresoRaw ?? null,
            typeof t.pct === 'number' ? t.pct : null,
            typeof t.cumple === 'boolean' ? t.cumple : null,
          ]
        );
        upserted++;
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    return Response.json({ ok: true, upserted });
  } catch (err) {
    console.error('POST /api/tickets', err);
    return Response.json({ ok: false, error: String((err && err.message) || err) }, { status: 500 });
  }
}
