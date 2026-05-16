import app from "./app.js";
import sequelize from "./Backend/src/db/database.js";

// Prevent unhandled promise rejections from crashing the server.
// Individual route handlers should still catch their own errors,
// but this is a safety net for any that don't.
process.on("unhandledRejection", (err) => {
  console.error("Unhandled rejection:", err?.message ?? err);
});

const PORT = process.env.PORT || 3000;

try {
  await sequelize.authenticate();
  console.log("Database connected");
} catch (err) {
  console.error("Database connection failed:", err.message);
  process.exit(1);
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
