import { Router } from "express";
import { createClient } from "@supabase/supabase-js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireEditor } from "../middleware/requireEditor.js";

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

// GET /api/announcements — public, non-archived posts newest first
router.get("/", async (_req, res) => {
  const { data, error } = await getAdminClient()
    .from("announcements")
    .select("id, title, body, image_url, created_at")
    .eq("archived", false)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch announcements:", error.message);
    return res.status(500).json({ error: "Failed to fetch announcements" });
  }

  res.json({ announcements: data ?? [] });
});

// POST /api/announcements — editor/admin only (role 3 or 4)
router.post("/", requireAuth, requireEditor, async (req, res) => {
  const { title, body, image_url } = req.body ?? {};

  if (!title?.trim() || !body?.trim()) {
    return res.status(400).json({ error: "Title and body are required" });
  }
  if (title.length > 300) {
    return res.status(400).json({ error: "Title must be 300 characters or fewer" });
  }
  if (body.length > 100_000) {
    return res.status(400).json({ error: "Body is too long" });
  }

  const { data, error } = await getAdminClient()
    .from("announcements")
    .insert({
      title: title.trim(),
      body: body.trim(),
      image_url: image_url?.trim() || null,
      author_id: req.user.id,
    })
    .select("id, title, body, image_url, created_at")
    .single();

  if (error) {
    console.error("Failed to create announcement:", error.message);
    return res.status(500).json({ error: "Failed to create announcement" });
  }

  res.status(201).json({ announcement: data });
});

// PATCH /api/announcements/:id/archive — archive only (roles 3+4); restore is admin-only
router.patch("/:id/archive", requireAuth, requireEditor, async (req, res) => {
  const { id } = req.params;
  const now = new Date().toISOString();

  const { error } = await getAdminClient()
    .from("announcements")
    .update({
      archived:    true,
      archived_by: req.user.id,
      archived_at: now,
      updated_at:  now,
    })
    .eq("id", id);

  if (error) {
    console.error("Failed to archive announcement:", error.message);
    return res.status(500).json({ error: "Failed to archive announcement" });
  }

  res.json({ ok: true });
});

// PATCH /api/announcements/:id — editor/admin only, cannot edit archived posts
router.patch("/:id", requireAuth, requireEditor, async (req, res) => {
  const { id } = req.params;
  const { title, body, image_url } = req.body ?? {};

  if (!title?.trim() || !body?.trim()) {
    return res.status(400).json({ error: "Title and body are required" });
  }
  if (title.length > 300) {
    return res.status(400).json({ error: "Title must be 300 characters or fewer" });
  }
  if (body.length > 100_000) {
    return res.status(400).json({ error: "Body is too long" });
  }

  const { data, error } = await getAdminClient()
    .from("announcements")
    .update({
      title: title.trim(),
      body: body.trim(),
      image_url: image_url?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("archived", false)
    .select("id, title, body, image_url, created_at")
    .single();

  if (error) {
    console.error("Failed to update announcement:", error.message);
    return res.status(500).json({ error: "Failed to update announcement" });
  }

  res.json({ announcement: data });
});

export default router;
