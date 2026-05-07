// Used by:
// - app.js
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let adminClient = null;

// Create and cache a Supabase admin client for auth-backed request validation.
function getAdminClient() {
  if (!adminClient) {
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set to authenticate requests");
    }
    adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });
  }
  return adminClient;
}

// Validate bearer token and attach authenticated user context to the request.
export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const token = authHeader.slice(7);
  try {
    // Verify JWT against Supabase Auth before allowing DB mutation routes.
    const { data, error } = await getAdminClient().auth.getUser(token);
    if (error || !data?.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    req.user = data.user;
    next();
  } catch (e) {
    console.error("Auth check failed:", e.message);
    return res.status(500).json({ error: "Authentication service unavailable" });
  }
}
