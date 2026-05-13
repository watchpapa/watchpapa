import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let adminClient = null;

function getAdminClient() {
  if (!adminClient) {
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
    }
    adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });
  }
  return adminClient;
}

// Confirm the authenticated user holds role = 4 (admin) by reading from the DB
// with the service-role client — cannot be spoofed via a crafted JWT.
export async function requireAdmin(req, res, next) {
  try {
    const { data, error } = await getAdminClient()
      .from("profile")
      .select("role")
      .eq("id", req.user.id)
      .single();

    if (error || !data) {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (data.role !== 4) {
      return res.status(403).json({ error: "Forbidden" });
    }

    req.isAdmin = true;
    next();
  } catch (e) {
    console.error("Admin check failed:", e.message);
    return res.status(500).json({ error: "Internal server error" });
  }
}
