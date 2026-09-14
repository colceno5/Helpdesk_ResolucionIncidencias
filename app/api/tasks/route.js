import { sql } from '@vercel/postgres';
import { ensureSchema } from '../../../lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await ensureSchema();
    const { rows } = await sql`SELECT * FROM tasks ORDER BY fecha_registro ASC NULLS LAST;`;
    const tasks = rows.map((r) => ({
      tarea: r.tarea,
      caso: r.caso,
      tipoCaso: r.tipo_caso,
      proyecto: r.proyecto,
      estado: r.estado,
      fechaRegistro: r.fecha_registro,
      asunto: r.asunto,
      razon: r.razon,
      responsable: r.responsable,
      grupoResponsable: r.grupo_responsable,
      receptor: r.receptor,
      fechaCierre: r.fecha_cierre,
    }));
    return Response.json({ ok: true, count: tasks.length, tasks });
  } catch (err) {
    console.error('GET /api/tasks', err);
    return Response.json({ ok: false, error: String((err && err.message) || err) }, { status: 500 });
  }
}

// Igual que /api/tickets: upsert por número de Tarea, para poder subir el export de
// "abiertas" y luego el de "cerradas" (o repetir uno ya subido) sin duplicar filas.
export async function POST(req) {
  try {
    await ensureSchema();
    const body = await req.json();
    const items = Array.isArray(body?.tasks) ? body.tasks : [];
    if (!items.length) return Response.json({ ok: true, upserted: 0 });

    const client = await sql.connect();
    let upserted = 0;
    try {
      await client.query('BEGIN');
      for (const t of items) {
        if (!t || !t.tarea) continue;
        await client.query(
          `INSERT INTO tasks (
             tarea, caso, tipo_caso, proyecto, estado, fecha_registro, asunto, razon,
             responsable, grupo_responsable, receptor, fecha_cierre, updated_at
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, now())
           ON CONFLICT (tarea) DO UPDATE SET
             caso = EXCLUDED.caso,
             tipo_caso = EXCLUDED.tipo_caso,
             proyecto = EXCLUDED.proyecto,
             estado = EXCLUDED.estado,
             fecha_registro = EXCLUDED.fecha_registro,
             asunto = EXCLUDED.asunto,
             razon = EXCLUDED.razon,
             responsable = EXCLUDED.responsable,
             grupo_responsable = EXCLUDED.grupo_responsable,
             receptor = EXCLUDED.receptor,
             fecha_cierre = EXCLUDED.fecha_cierre,
             updated_at = now();`,
          [
            String(t.tarea),
            t.caso ?? null,
            t.tipoCaso ?? null,
            t.proyecto ?? null,
            t.estado ?? null,
            t.fechaRegistro ?? null,
            t.asunto ?? null,
            t.razon ?? null,
            t.responsable ?? null,
            t.grupoResponsable ?? null,
            t.receptor ?? null,
            t.fechaCierre ?? null,
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
    console.error('POST /api/tasks', err);
    return Response.json({ ok: false, error: String((err && err.message) || err) }, { status: 500 });
  }
}
