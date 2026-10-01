import { sql } from '@vercel/postgres';
import { ensureSchema } from '../../../lib/db';

// Nunca cachear: un análisis o comentario guardado debe verse de inmediato desde cualquier equipo.
export const dynamic = 'force-dynamic';

const ESTADOS = ['En seguimiento', 'Reevaluado', 'Cerrado'];
const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;

function mapAnalisis(r) {
  return {
    id: r.id,
    especialista: r.especialista,
    periodoDesde: r.periodo_desde,
    periodoHasta: r.periodo_hasta,
    pctRegistro: r.pct_registro,
    cumplenRegistro: r.cumplen_registro,
    totalRegistro: r.total_registro,
    analisis: r.analisis,
    planAccion: r.plan_accion,
    fechaReevaluacion: r.fecha_reevaluacion,   // 'YYYY-MM-DD' o null
    estado: r.estado,
    autor: r.autor,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function mapComentario(r) {
  return {
    id: r.id,
    analisisId: r.analisis_id,
    comentario: r.comentario,
    autor: r.autor,
    createdAt: r.created_at,
  };
}

// Devuelve todos los análisis de desempeño con sus comentarios de feedback.
export async function GET() {
  try {
    await ensureSchema();
    const a = await sql`
      SELECT id, especialista, periodo_desde, periodo_hasta, pct_registro, cumplen_registro, total_registro,
             analisis, plan_accion, fecha_reevaluacion::text AS fecha_reevaluacion, estado, autor,
             created_at, updated_at
      FROM seguimiento_esp ORDER BY created_at DESC;
    `;
    const c = await sql`
      SELECT id, analisis_id, comentario, autor, created_at
      FROM seguimiento_esp_comentarios ORDER BY created_at ASC;
    `;
    const porAnalisis = new Map();
    c.rows.forEach((r) => {
      const k = r.analisis_id;
      if (!porAnalisis.has(k)) porAnalisis.set(k, []);
      porAnalisis.get(k).push(mapComentario(r));
    });
    const analisis = a.rows.map((r) => ({ ...mapAnalisis(r), comentarios: porAnalisis.get(r.id) || [] }));
    return Response.json({ ok: true, analisis });
  } catch (err) {
    console.error('GET /api/seguimiento', err);
    return Response.json({ ok: false, error: String((err && err.message) || err) }, { status: 500 });
  }
}

// Crea un análisis (sin id) o actualiza uno existente (con id).
// Al crear se guarda una "foto" del cumplimiento del momento (pctRegistro, cumplenRegistro,
// totalRegistro y el rango de fechas analizado) para poder comparar después contra el valor actual.
export async function POST(req) {
  try {
    await ensureSchema();
    const b = (await req.json()) || {};

    const especialista = String(b.especialista ?? '').trim();
    const analisis = String(b.analisis ?? '').trim();
    const planAccion = String(b.planAccion ?? '').trim();
    const autor = String(b.autor ?? '').trim().slice(0, 100) || null;
    const estado = ESTADOS.includes(b.estado) ? b.estado : 'En seguimiento';
    const fechaReev = String(b.fechaReevaluacion ?? '').trim();

    if (!especialista) return Response.json({ ok: false, error: 'Falta el especialista' }, { status: 400 });
    if (especialista.length > 200) return Response.json({ ok: false, error: 'Nombre demasiado largo' }, { status: 400 });
    if (!analisis) return Response.json({ ok: false, error: 'Escribe el análisis del desempeño' }, { status: 400 });
    if (!planAccion) return Response.json({ ok: false, error: 'Escribe el plan de acción' }, { status: 400 });
    if (analisis.length > 20000 || planAccion.length > 20000) {
      return Response.json({ ok: false, error: 'Texto demasiado largo' }, { status: 400 });
    }
    if (fechaReev && !RE_FECHA.test(fechaReev)) {
      return Response.json({ ok: false, error: 'Fecha de reevaluación inválida' }, { status: 400 });
    }

    if (b.id) {
      const { rows } = await sql`
        UPDATE seguimiento_esp SET
          analisis = ${analisis}, plan_accion = ${planAccion},
          fecha_reevaluacion = ${fechaReev || null}, estado = ${estado}, updated_at = now()
        WHERE id = ${b.id}
        RETURNING id, especialista, periodo_desde, periodo_hasta, pct_registro, cumplen_registro, total_registro,
                  analisis, plan_accion, fecha_reevaluacion::text AS fecha_reevaluacion, estado, autor,
                  created_at, updated_at;
      `;
      return Response.json({ ok: true, analisis: rows[0] ? mapAnalisis(rows[0]) : null });
    }

    const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
    const int = (v) => (Number.isInteger(v) ? v : null);
    const { rows } = await sql`
      INSERT INTO seguimiento_esp (
        especialista, periodo_desde, periodo_hasta, pct_registro, cumplen_registro, total_registro,
        analisis, plan_accion, fecha_reevaluacion, estado, autor
      ) VALUES (
        ${especialista}, ${b.periodoDesde ? String(b.periodoDesde).slice(0, 10) : null},
        ${b.periodoHasta ? String(b.periodoHasta).slice(0, 10) : null},
        ${num(b.pctRegistro)}, ${int(b.cumplenRegistro)}, ${int(b.totalRegistro)},
        ${analisis}, ${planAccion}, ${fechaReev || null}, ${estado}, ${autor}
      )
      RETURNING id, especialista, periodo_desde, periodo_hasta, pct_registro, cumplen_registro, total_registro,
                analisis, plan_accion, fecha_reevaluacion::text AS fecha_reevaluacion, estado, autor,
                created_at, updated_at;
    `;
    return Response.json({ ok: true, analisis: { ...mapAnalisis(rows[0]), comentarios: [] } });
  } catch (err) {
    console.error('POST /api/seguimiento', err);
    return Response.json({ ok: false, error: String((err && err.message) || err) }, { status: 500 });
  }
}

// Agrega un comentario de feedback a un análisis.
export async function PUT(req) {
  try {
    await ensureSchema();
    const b = (await req.json()) || {};
    const analisisId = Number(b.analisisId);
    const comentario = String(b.comentario ?? '').trim();
    const autor = String(b.autor ?? '').trim().slice(0, 100) || null;
    if (!Number.isInteger(analisisId)) return Response.json({ ok: false, error: 'Falta el análisis' }, { status: 400 });
    if (!comentario) return Response.json({ ok: false, error: 'Escribe el comentario' }, { status: 400 });
    if (comentario.length > 10000) return Response.json({ ok: false, error: 'Comentario demasiado largo' }, { status: 400 });

    const { rows } = await sql`
      INSERT INTO seguimiento_esp_comentarios (analisis_id, comentario, autor)
      VALUES (${analisisId}, ${comentario}, ${autor})
      RETURNING id, analisis_id, comentario, autor, created_at;
    `;
    await sql`UPDATE seguimiento_esp SET updated_at = now() WHERE id = ${analisisId};`;
    return Response.json({ ok: true, comentario: mapComentario(rows[0]) });
  } catch (err) {
    console.error('PUT /api/seguimiento', err);
    return Response.json({ ok: false, error: String((err && err.message) || err) }, { status: 500 });
  }
}

// ?id=<análisis>  borra el análisis y sus comentarios · ?comentarioId=<n> borra solo ese comentario.
export async function DELETE(req) {
  try {
    await ensureSchema();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const comentarioId = searchParams.get('comentarioId');
    if (comentarioId) {
      await sql`DELETE FROM seguimiento_esp_comentarios WHERE id = ${comentarioId};`;
      return Response.json({ ok: true });
    }
    if (!id) return Response.json({ ok: false, error: 'Falta el id' }, { status: 400 });
    await sql`DELETE FROM seguimiento_esp WHERE id = ${id};`;   // los comentarios caen por ON DELETE CASCADE
    return Response.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/seguimiento', err);
    return Response.json({ ok: false, error: String((err && err.message) || err) }, { status: 500 });
  }
}
