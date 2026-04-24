require("dotenv").config();
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");

const authRoutes = require("./routes/auth");
const employeeRoutes = require("./routes/employees");
const reviewRoutes = require("./routes/reviews");
const analyticsRoutes = require("./routes/analytics");
const githubRoutes = require("./routes/github");
const { errorHandler } = require("./middleware/errorHandler");

const app = express();
const PORT = process.env.PORT || 4000;

// ── Middleware ────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true,
}));
app.use(express.json({ limit: "2mb" }));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
app.use(limiter);

// ── Routes ────────────────────────────────────────────────────────
app.get("/health", (req, res) => res.json({ status: "ok", ts: new Date() }));
app.use("/api/auth",      authRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/reviews",   reviewRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/github",    githubRoutes);

// ── Error handler ────────────────────────────────────────────────
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`\n🚀 CodeReview API running on http://localhost:${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || "development"}\n`);
});
