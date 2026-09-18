import { sql } from '@vercel/postgres';
import { ensureSchema } from '../../../lib/db';

export const dynamic = 'force-dynamic';

function mapRow(r) {
  return {
    id: r.id,
    accion: r.accion,
    problema: r.problema,
    causa: r.causa,
    responsable: r.responsable,
    fechaCompromiso: r.fecha_compromiso,
    estado: r.estado,
    prioridad: r.prioridad,
    resultadoEsperado: r.resultado_esperado,
    fechaCierre: r.fecha_cierre,
    observaciones: r.observaciones,
    metricaAntes: r.metrica_antes,
    metricaDespues: r.metrica_despues,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function GET() {
  try {
    await ensureSchema();
    const { rows } = await sql`SELECT * FROM acciones_mejora ORDER BY created_at DESC;`;
    return Response.json({ ok: true, acciones: rows.map(mapRow) });
  } catch (err) {
    console.error('GET /api/acciones', err);
    return Response.json({ ok: false, error: String((err && err.message) || err) }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await ensureSchema();
    const a = (await req.json()) || {};

    if (a.id) {
      const { rows } = await sql`
        UPDATE acciones_mejora SET
          accion = ${a.accion ?? null}, problema = ${a.problema ?? null}, causa = ${a.causa ?? null},
          responsable = ${a.responsable ?? null}, fecha_compromiso = ${a.fechaCompromiso ?? null},
          estado = ${a.estado ?? 'Pendiente'}, prioridad = ${a.prioridad ?? null},
          resultado_esperado = ${a.resultadoEsperado ?? null}, fecha_cierre = ${a.fechaCierre ?? null},
          observaciones = ${a.observaciones ?? null}, metrica_antes = ${a.metricaAntes ?? null},
          metrica_despues = ${a.metricaDespues ?? null}, updated_at = now()
        WHERE id = ${a.id}
        RETURNING *;
      `;
      return Response.json({ ok: true, accion: rows[0] ? mapRow(rows[0]) : null });
    }

    const { rows } = await sql`
      INSERT INTO acciones_mejora (
        accion, problema, causa, responsable, fecha_compromiso, estado, prioridad,
        resultado_esperado, fecha_cierre, observaciones, metrica_antes, metrica_despues
      ) VALUES (
        ${a.accion ?? null}, ${a.problema ?? null}, ${a.causa ?? null}, ${a.responsable ?? null},
        ${a.fechaCompromiso ?? null}, ${a.estado ?? 'Pendiente'}, ${a.prioridad ?? null},
        ${a.resultadoEsperado ?? null}, ${a.fechaCierre ?? null}, ${a.observaciones ?? null},
        ${a.metricaAntes ?? null}, ${a.metricaDespues ?? null}
      ) RETURNING *;
    `;
    return Response.json({ ok: true, accion: mapRow(rows[0]) });
  } catch (err) {
    console.error('POST /api/acciones', err);
    return Response.json({ ok: false, error: String((err && err.message) || err) }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    await ensureSchema();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return Response.json({ ok: false, error: 'Falta el id' }, { status: 400 });
    await sql`DELETE FROM acciones_mejora WHERE id = ${id};`;
    return Response.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/acciones', err);
    return Response.json({ ok: false, error: String((err && err.message) || err) }, { status: 500 });
  }
}
