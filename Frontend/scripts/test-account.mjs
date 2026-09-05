#!/usr/bin/env node
// Create / delete a confirmed test account for signed-in screenshots.
// Uses the service-role key from the repo-root .env (same approach as
// tests/rls_tests). Never commit the printed password anywhere.
//
//   node scripts/test-account.mjs create            → prints email + password
//   node scripts/test-account.mjs delete <email>
//   node scripts/test-account.mjs promote <email>   → role 4 (admin) for admin-page shots

import { readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const envText = await readFile(path.resolve(process.cwd(), "../.env"), "utf8");
const env = Object.fromEntries(
  envText.split("\n").filter((l) => l && !l.startsWith("#") && l.includes("=")).map((l) => {
    const i = l.indexOf("=");
    return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")];
  }),
);

const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const [cmd, arg] = process.argv.slice(2);

async function findUser(email) {
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  return data?.users?.find((u) => u.email === email) ?? null;
}

if (cmd === "create") {
  const ts = Date.now();
  const email = `ui-shots-${ts}@example.com`;
  const password = `UiShots_${ts}!Aa`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username: `uishots${String(ts).slice(-6)}`, date_of_birth: "1990-01-01", show_adult_content: false, email_marketing_opt_in: false },
  });
  if (error) throw new Error(error.message);
  // The handle_new_user trigger creates the profile row; make sure username landed.
  await admin.from("profile").update({ username: `uishots${String(ts).slice(-6)}`, date_of_birth: "1990-01-01", is_adult: true }).eq("id", data.user.id);
  console.log(JSON.stringify({ email, password, id: data.user.id }));
} else if (cmd === "delete") {
  const u = await findUser(arg);
  if (!u) { console.log("not found"); process.exit(0); }
  const { error } = await admin.auth.admin.deleteUser(u.id);
  if (error) throw new Error(error.message);
  console.log(`deleted ${arg}`);
} else if (cmd === "promote") {
  const u = await findUser(arg);
  if (!u) throw new Error("not found");
  const { error } = await admin.from("profile").update({ role: 4 }).eq("id", u.id);
  if (error) throw new Error(error.message);
  console.log(`promoted ${arg} to admin`);
} else {
  console.log("usage: create | delete <email> | promote <email>");
  process.exit(1);
}
