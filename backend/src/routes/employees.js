const router = require("express").Router();
const pool   = require("../db");
const { authenticate, requireRole } = require("../middleware/auth");

// GET /api/employees
router.get("/", authenticate, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, email, role, job_title, department, avatar, created_at
       FROM employees ORDER BY name`
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// GET /api/employees/:id
router.get("/:id", authenticate, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, email, role, job_title, department, avatar, created_at
       FROM employees WHERE id=$1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Employee not found" });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// GET /api/employees/:id/stats
router.get("/:id/stats", authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;

    const summary = await pool.query(
      `SELECT
         count(*)::int                          AS total_reviews,
         round(avg(severity_score)::numeric, 1) AS avg_score,
         sum(security_count)::int               AS total_security,
         sum(performance_count)::int            AS total_performance,
         sum(quality_count)::int                AS total_quality,
         min(severity_score)                    AS min_score,
         max(severity_score)                    AS max_score
       FROM code_reviews WHERE employee_id=$1`,
      [id]
    );

    const trend = await pool.query(
      `SELECT severity_score, severity_label, language, created_at
       FROM code_reviews WHERE employee_id=$1
       ORDER BY created_at ASC`,
      [id]
    );

    const monthly = await pool.query(
      `SELECT
         to_char(date_trunc('month', created_at), 'Mon YYYY') AS month,
         round(avg(severity_score)::numeric,1)                AS avg_score,
         count(*)::int                                        AS review_count
       FROM code_reviews WHERE employee_id=$1
       GROUP BY date_trunc('month', created_at)
       ORDER BY date_trunc('month', created_at)`,
      [id]
    );

    res.json({
      summary: summary.rows[0],
      trend:   trend.rows,
      monthly: monthly.rows,
    });
  } catch (err) { next(err); }
});

// PATCH /api/employees/:id  (admin/lead only)
router.patch("/:id", authenticate, requireRole("admin", "lead"), async (req, res, next) => {
  try {
    const { name, department, job_title, role } = req.body;
    const { rows } = await pool.query(
      `UPDATE employees SET
         name       = COALESCE($1, name),
         department = COALESCE($2, department),
         job_title  = COALESCE($3, job_title),
         role       = COALESCE($4, role)
       WHERE id=$5
       RETURNING id, name, email, role, job_title, department, avatar`,
      [name, department, job_title, role, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Employee not found" });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

module.exports = router;
