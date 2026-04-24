const router = require("express").Router();
const pool   = require("../db");
const { authenticate } = require("../middleware/auth");

router.get("/dashboard", authenticate, async (req, res, next) => {
  try {
    const privileged = req.user?.role === "admin" || req.user?.role === "lead";
    const where = privileged ? "" : "WHERE employee_id = $1";
    const params = privileged ? [] : [req.user.id];

    const totals = await pool.query(`
      SELECT count(*)::int AS total_reviews,
        round(avg(severity_score)::numeric,1) AS avg_score,
        count(*) FILTER (WHERE severity_label='critical')::int AS critical_count,
        count(*) FILTER (WHERE severity_label='high')::int     AS high_count,
        count(*) FILTER (WHERE severity_label='medium')::int   AS medium_count,
        count(*) FILTER (WHERE severity_label='low')::int      AS low_count
      FROM code_reviews ${where}`, params);

    const byLanguage = await pool.query(`
      SELECT language, count(*)::int AS review_count,
        round(avg(severity_score)::numeric,1) AS avg_score
      FROM code_reviews ${where}
      GROUP BY language ORDER BY avg_score DESC`, params);

    const teamSnapshot = privileged ? await pool.query(`
      SELECT e.id, e.name, e.avatar, e.role, e.department,
        round(avg(cr.severity_score)::numeric,1) AS avg_score,
        count(cr.id)::int AS review_count,
        (SELECT severity_score FROM code_reviews WHERE employee_id=e.id ORDER BY created_at DESC LIMIT 1) AS latest_score,
        (SELECT severity_score FROM code_reviews WHERE employee_id=e.id ORDER BY created_at ASC  LIMIT 1) AS oldest_score
      FROM employees e
      LEFT JOIN code_reviews cr ON cr.employee_id=e.id
      WHERE e.role='developer' GROUP BY e.id ORDER BY e.name`)
      : await pool.query(`
        SELECT e.id, e.name, e.avatar, e.role, e.department,
          round(avg(cr.severity_score)::numeric,1) AS avg_score,
          count(cr.id)::int AS review_count,
          (SELECT severity_score FROM code_reviews WHERE employee_id=e.id ORDER BY created_at DESC LIMIT 1) AS latest_score,
          (SELECT severity_score FROM code_reviews WHERE employee_id=e.id ORDER BY created_at ASC  LIMIT 1) AS oldest_score
        FROM employees e
        LEFT JOIN code_reviews cr ON cr.employee_id=e.id
        WHERE e.id=$1
        GROUP BY e.id ORDER BY e.name`, [req.user.id]);

    res.json({ totals:totals.rows[0], byLanguage:byLanguage.rows, teamSnapshot:teamSnapshot.rows });
  } catch (err) { next(err); }
});

module.exports = router;
