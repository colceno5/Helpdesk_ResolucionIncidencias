import { sql } from '@vercel/postgres';
import { ensureSchema } from '../../../lib/db';

export const dynamic = 'force-dynamic';

function mapRow(r) {
  return {
    id: r.id,
    titulo: r.titulo,
    servicio: r.servicio,
    categoria: r.categoria,
    problema: r.problema,
    sintomas: r.sintomas,
    causa: r.causa,
    solucion: r.solucion,
    pasos: r.pasos,
    palabrasClave: r.palabras_clave,
    publicoObjetivo: r.publico_objetivo,
    dificultad: r.dificultad,
    estado: r.estado,
    autor: r.autor,
    ticketsRelacionados: r.tickets_relacionados,
    usos: r.usos,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function GET() {
  try {
    await ensureSchema();
    const { rows } = await sql`SELECT * FROM kb_articulos ORDER BY updated_at DESC;`;
    return Response.json({ ok: true, articulos: rows.map(mapRow) });
  } catch (err) {
    console.error('GET /api/kb', err);
    return Response.json({ ok: false, error: String((err && err.message) || err) }, { status: 500 });
  }
}

// Crea un artículo nuevo (sin id) o actualiza uno existente (con id).
export async function POST(req) {
  try {
    await ensureSchema();
    const a = (await req.json()) || {};

    if (a.id) {
      const { rows } = await sql`
        UPDATE kb_articulos SET
          titulo = ${a.titulo ?? null}, servicio = ${a.servicio ?? null}, categoria = ${a.categoria ?? null},
          problema = ${a.problema ?? null}, sintomas = ${a.sintomas ?? null}, causa = ${a.causa ?? null},
          solucion = ${a.solucion ?? null}, pasos = ${a.pasos ?? null}, palabras_clave = ${a.palabrasClave ?? null},
          publico_objetivo = ${a.publicoObjetivo ?? null}, dificultad = ${a.dificultad ?? null},
          estado = ${a.estado ?? 'Borrador'}, autor = ${a.autor ?? null},
          tickets_relacionados = ${a.ticketsRelacionados ?? null}, updated_at = now()
        WHERE id = ${a.id}
        RETURNING *;
      `;
      return Response.json({ ok: true, articulo: rows[0] ? mapRow(rows[0]) : null });
    }

    const { rows } = await sql`
      INSERT INTO kb_articulos (
        titulo, servicio, categoria, problema, sintomas, causa, solucion, pasos,
        palabras_clave, publico_objetivo, dificultad, estado, autor, tickets_relacionados
      ) VALUES (
        ${a.titulo ?? null}, ${a.servicio ?? null}, ${a.categoria ?? null}, ${a.problema ?? null},
        ${a.sintomas ?? null}, ${a.causa ?? null}, ${a.solucion ?? null}, ${a.pasos ?? null},
        ${a.palabrasClave ?? null}, ${a.publicoObjetivo ?? null}, ${a.dificultad ?? null},
        ${a.estado ?? 'Borrador'}, ${a.autor ?? null}, ${a.ticketsRelacionados ?? null}
      ) RETURNING *;
    `;
    return Response.json({ ok: true, articulo: mapRow(rows[0]) });
  } catch (err) {
    console.error('POST /api/kb', err);
    return Response.json({ ok: false, error: String((err && err.message) || err) }, { status: 500 });
  }
}

// Borra un artículo, o (si viene incrementarUso) suma 1 a su contador de usos
// sin necesitar mandar el artículo completo.
export async function PUT(req) {
  try {
    await ensureSchema();
    const { id, incrementarUso } = (await req.json()) || {};
    if (!id) return Response.json({ ok: false, error: 'Falta el id' }, { status: 400 });
    if (incrementarUso) {
      await sql`UPDATE kb_articulos SET usos = usos + 1, updated_at = now() WHERE id = ${id};`;
      return Response.json({ ok: true });
    }
    return Response.json({ ok: false, error: 'Nada que actualizar' }, { status: 400 });
  } catch (err) {
    console.error('PUT /api/kb', err);
    return Response.json({ ok: false, error: String((err && err.message) || err) }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    await ensureSchema();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return Response.json({ ok: false, error: 'Falta el id' }, { status: 400 });
    await sql`DELETE FROM kb_articulos WHERE id = ${id};`;
    return Response.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/kb', err);
    return Response.json({ ok: false, error: String((err && err.message) || err) }, { status: 500 });
  }
}
