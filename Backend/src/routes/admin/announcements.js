import { Router } from "express";
import { createClient } from "@supabase/supabase-js";

const router = Router();

let adminClient = null;

function getAdminClient() {
  if (!adminClient) {
    adminClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
  }
  return adminClient;
}

// GET /api/admin/announcements — all posts including archived, with author_id
router.get("/", async (_req, res) => {
  const { data, error } = await getAdminClient()
    .from("announcements")
    .select("id, title, body, image_url, author_id, archived, archived_by, archived_at, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch announcements:", error.message);
    return res.status(500).json({ error: "Failed to fetch announcements" });
  }

  res.json({ announcements: data ?? [] });
});

// PATCH /api/admin/announcements/:id/restore — restore archived post, admin only
router.patch("/:id/restore", async (req, res) => {
  const { id } = req.params;

  const { error } = await getAdminClient()
    .from("announcements")
    .update({
      archived:    false,
      archived_by: null,
      archived_at: null,
      updated_at:  new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    console.error("Failed to restore announcement:", error.message);
    return res.status(500).json({ error: "Failed to restore announcement" });
  }

  res.json({ ok: true });
});

// DELETE /api/admin/announcements/:id — permanent hard delete, admin only
router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  const { error } = await getAdminClient()
    .from("announcements")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Failed to delete announcement:", error.message);
    return res.status(500).json({ error: "Failed to delete announcement" });
  }

  res.json({ ok: true });
});

export default router;
