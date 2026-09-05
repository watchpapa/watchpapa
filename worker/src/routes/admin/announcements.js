import { Hono } from "hono";
import { withSql } from "../../db.js";
import { auditLog } from "../../audit.js";

// Port of Backend/src/routes/admin/announcements.js (supabase-js → SQL).

export const announcementsAdmin = new Hono();

announcementsAdmin.get("/", async (c) =>
  withSql(c, async (sql) => {
    const rows = await sql`
      SELECT id, title, body, image_url, author_id, archived, archived_by, archived_at, created_at, updated_at
      FROM public.announcements
      ORDER BY created_at DESC
    `;
    return c.json({ announcements: rows });
  }),
);

announcementsAdmin.patch("/:id/restore", auditLog("announcement_restored"), async (c) => {
  const id = c.req.param("id");
  return withSql(c, async (sql) => {
    await sql`
      UPDATE public.announcements
      SET archived = false, archived_by = NULL, archived_at = NULL, updated_at = now()
      WHERE id = ${id}
    `;
    return c.json({ ok: true });
  });
});

announcementsAdmin.delete("/:id", auditLog("announcement_deleted"), async (c) => {
  const id = c.req.param("id");
  return withSql(c, async (sql) => {
    await sql`DELETE FROM public.announcements WHERE id = ${id}`;
    return c.json({ ok: true });
  });
});
