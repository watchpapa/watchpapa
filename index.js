import app from "./app.js";
import sequelize from "./Backend/src/db/database.js";

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
