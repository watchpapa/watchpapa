import { Hono } from "hono";
import { requireAuth, requireEditor } from "../auth.js";
import { withSql } from "../db.js";
import { mutationRateLimit } from "../ratelimit.js";
import { auditLog } from "../audit.js";

// Port of Backend/src/routes/announcements.js — supabase-js → SQL over Hyperdrive.
// Public GET; editor/admin (role 3|4) POST/PATCH.

export const announcements = new Hono();

announcements.get("/", async (c) =>
  withSql(c, async (sql) => {
    const rows = await sql`
      SELECT id, title, body, image_url, created_at
      FROM public.announcements
      WHERE archived = false
      ORDER BY created_at DESC
    `;
    return c.json({ announcements: rows });
  }),
);

function validate(payload) {
  const title = (payload?.title ?? "").trim();
  const body = (payload?.body ?? "").trim();
  const imageUrl = (payload?.image_url ?? "").trim() || null;
  if (!title || !body) return { error: "Title and body are required", status: 400 };
  if (title.length > 300) return { error: "Title must be 300 characters or fewer", status: 400 };
  if (body.length > 100_000) return { error: "Body is too long", status: 400 };
  return { title, body, imageUrl };
}

announcements.post("/", requireAuth, mutationRateLimit, requireEditor, auditLog("announcement_created", ["title"]), async (c) => {
  let payload;
  try {
    payload = await c.req.json();
  } catch {
    payload = {};
  }
  const v = validate(payload);
  if (v.error) return c.json({ error: v.error }, v.status);

  return withSql(c, async (sql) => {
    const [row] = await sql`
      INSERT INTO public.announcements (title, body, image_url, author_id)
      VALUES (${v.title}, ${v.body}, ${v.imageUrl}, ${c.get("user").id})
      RETURNING id, title, body, image_url, created_at
    `;
    return c.json({ announcement: row }, 201);
  });
});

announcements.patch("/:id/archive", requireAuth, mutationRateLimit, requireEditor, auditLog("announcement_archived"), async (c) => {
  const id = c.req.param("id");
  return withSql(c, async (sql) => {
    await sql`
      UPDATE public.announcements
      SET archived = true, archived_by = ${c.get("user").id}, archived_at = now(), updated_at = now()
      WHERE id = ${id}
    `;
    return c.json({ ok: true });
  });
});

announcements.patch("/:id", requireAuth, mutationRateLimit, requireEditor, auditLog("announcement_edited", ["title"]), async (c) => {
  const id = c.req.param("id");
  let payload;
  try {
    payload = await c.req.json();
  } catch {
    payload = {};
  }
  const v = validate(payload);
  if (v.error) return c.json({ error: v.error }, v.status);

  return withSql(c, async (sql) => {
    const [row] = await sql`
      UPDATE public.announcements
      SET title = ${v.title}, body = ${v.body}, image_url = ${v.imageUrl}, updated_at = now()
      WHERE id = ${id} AND archived = false
      RETURNING id, title, body, image_url, created_at
    `;
    if (!row) return c.json({ error: "Announcement not found or archived" }, 404);
    return c.json({ announcement: row });
  });
});
