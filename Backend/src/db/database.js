import { Sequelize } from "sequelize";
import dotenv from "dotenv";
dotenv.config();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

let isSupabasePooler = false;
try {
  const host = new URL(databaseUrl).hostname;
  isSupabasePooler = host.endsWith(".pooler.supabase.com");
} catch {
  isSupabasePooler = false;
}

const sslEnabled = process.env.DB_SSL !== "false";
const rejectUnauthorizedOverride = process.env.DB_SSL_REJECT_UNAUTHORIZED;
const rejectUnauthorized =
  rejectUnauthorizedOverride != null
    ? rejectUnauthorizedOverride === "true"
    : process.env.NODE_ENV === "production" && !isSupabasePooler;

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: "postgres",
  logging: false,
  dialectOptions: sslEnabled
    ? {
        ssl: {
          require: true,
          rejectUnauthorized,
        },
      }
    : {},
});

export default sequelize;
