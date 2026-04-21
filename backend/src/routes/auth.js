const router  = require("express").Router();
const bcrypt  = require("bcryptjs");
const jwt     = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const pool    = require("../db");
const { authenticate } = require("../middleware/auth");

// ── POST /api/auth/login ──────────────────────────────────────────
router.post(
  "/login",
  [
    body("email").isEmail().normalizeEmail(),
    body("password").isLength({ min: 3 }),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { email, password } = req.body;

      const { rows } = await pool.query(
        "SELECT * FROM employees WHERE email = $1",
        [email]
      );

      const user = rows[0];
      if (!user) return res.status(401).json({ error: "Invalid credentials" });

      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) return res.status(401).json({ error: "Invalid credentials" });

      const token = jwt.sign(
        { id: user.id, email: user.email, name: user.name, role: user.role, avatar: user.avatar },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
      );

      res.json({
        token,
        user: { id: user.id, name: user.name, email: user.email, role: user.role, avatar: user.avatar, department: user.department },
      });
    } catch (err) { next(err); }
  }
);

// ── POST /api/auth/register ───────────────────────────────────────
router.post(
  "/register",
  [
    body("name").trim().isLength({ min: 2 }),
    body("email").isEmail().normalizeEmail(),
    body("password").isLength({ min: 6 }),
    body("role").isIn(["admin", "lead", "developer"]),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { name, email, password, role, department, job_title } = req.body;

      const exists = await pool.query("SELECT id FROM employees WHERE email=$1", [email]);
      if (exists.rows.length) return res.status(409).json({ error: "Email already registered" });

      const avatar       = name.split(" ").map(p => p[0]).join("").toUpperCase().slice(0, 2);
      const password_hash = await bcrypt.hash(password, 12);

      const { rows } = await pool.query(
        `INSERT INTO employees (name, email, password_hash, role, department, job_title, avatar)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, name, email, role, avatar, department`,
        [name, email, password_hash, role, department || null, job_title || null, avatar]
      );

      const token = jwt.sign(
        { id: rows[0].id, email: rows[0].email, name: rows[0].name, role: rows[0].role, avatar },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
      );

      res.status(201).json({ token, user: rows[0] });
    } catch (err) { next(err); }
  }
);

// ── GET /api/auth/me ──────────────────────────────────────────────
router.get("/me", authenticate, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, name, email, role, avatar, department, job_title, created_at FROM employees WHERE id=$1",
      [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: "User not found" });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

module.exports = router;
