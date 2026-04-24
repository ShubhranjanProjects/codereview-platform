const router = require("express").Router();
const pool   = require("../db");
const { authenticate } = require("../middleware/auth");
const { analyzeWithGemini } = require("../services/geminiReview");

function isPrivileged(user) {
  return user?.role === "admin" || user?.role === "lead";
}

function guessLikelyLanguage(code) {
  const s = String(code || "");
  const head = s.slice(0, 4000);

  // Very lightweight heuristics (fast, no deps). It’s fine if imperfect.
  if (/\bpublic\s+class\b|\bSystem\.out\.println\b|\bimport\s+java\./.test(head)) return "Java";
  if (/\bpackage\s+main\b|\bfmt\.\w+\(/.test(head)) return "Go";
  if (/\bdef\s+\w+\s*\(|^\s*import\s+\w+/m.test(head) && !/[;{}]/.test(head)) return "Python";
  if (/\bconsole\.log\b|\bfunction\s+\w+\s*\(|=>/.test(head)) return "JavaScript";
  if (/\binterface\s+\w+|\btype\s+\w+\s*=|:\s*\w+(\[\])?(\s*\|\s*\w+)+/.test(head)) return "TypeScript";
  return null;
}

// ── GET /api/reviews ──────────────────────────────────────────────────────────
router.get("/", authenticate, async (req, res, next) => {
  try {
    const { employee_id, severity, language, limit = 200, offset = 0 } = req.query;
    const conditions = [], params = [];
    let idx = 1;

    if (employee_id) {
      if (!isPrivileged(req.user) && employee_id !== req.user.id) {
        return res.status(403).json({ error: "Insufficient permissions" });
      }
      conditions.push(`cr.employee_id=$${idx++}`);
      params.push(employee_id);
    } else if (!isPrivileged(req.user)) {
      conditions.push(`cr.employee_id=$${idx++}`);
      params.push(req.user.id);
    }
    if (severity)    { conditions.push(`cr.severity_label=$${idx++}`); params.push(severity); }
    if (language)    { conditions.push(`cr.language=$${idx++}`); params.push(language); }

    const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";

    const { rows } = await pool.query(
      `SELECT cr.id, cr.employee_id, cr.language, cr.severity_score, cr.severity_label,
              cr.confidence, cr.summary, cr.security_count, cr.performance_count,
              cr.quality_count, cr.improved_snippet, cr.created_at,
              e.name AS employee_name, e.avatar AS employee_avatar, e.department AS dept,
              COALESCE(json_agg(ri.description ORDER BY ri.category) FILTER (WHERE ri.id IS NOT NULL),'[]') AS issues
       FROM code_reviews cr
       JOIN employees e ON e.id=cr.employee_id
       LEFT JOIN review_issues ri ON ri.review_id=cr.id
       ${where}
       GROUP BY cr.id, e.name, e.avatar, e.department
       ORDER BY cr.created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, parseInt(limit), parseInt(offset)]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// ── POST /api/reviews/analyze ─────────────────────────────────────────────────
router.post("/analyze", authenticate, async (req, res, next) => {
  try {
    const {
      employee_id,
      language,
      code_snippet,
      save = true,
      source_type = "snippet",
      github_repo_full_name = null,
      github_pr_number = null,
      github_pr_url = null,
      github_head_sha = null,
    } = req.body;

    if (!employee_id || !language || !code_snippet) {
      return res.status(400).json({ error: "employee_id, language and code_snippet required" });
    }

    // Catch obvious “selected Python but pasted Java” mistakes early.
    const guessed = guessLikelyLanguage(code_snippet);
    if (guessed && String(language).toLowerCase() !== guessed.toLowerCase()) {
      return res.status(400).json({
        error: `Selected language is ${language}, but the code looks like ${guessed}. Please correct the language and try again.`,
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const { parsed, issues: allIssues } = await analyzeWithGemini({
      apiKey,
      language,
      code: code_snippet,
    });

    const {
      severity_score,
      confidence,
      severity_label,
      summary,
      code_quality = [],
      security_issues = [],
      performance_issues = [],
      naming_design = [],
      improved_snippet,
    } = parsed;

    let savedReview = null;

    if (save) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        const { rows } = await client.query(
          `INSERT INTO code_reviews 
          (employee_id, reviewed_by, language, code_snippet, severity_score, severity_label, confidence, summary,
           security_count, performance_count, quality_count, improved_snippet,
           source_type, github_repo_full_name, github_pr_number, github_pr_url, github_head_sha)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *`,
          [
            employee_id,
            req.user.id,
            language,
            code_snippet,
            severity_score,
            severity_label,
            confidence,
            summary,
            security_issues.length,
            performance_issues.length,
            code_quality.length,
            improved_snippet || null,
            source_type,
            github_repo_full_name,
            github_pr_number,
            github_pr_url,
            github_head_sha,
          ]
        );

        savedReview = rows[0];

        for (const i of allIssues) {
          await client.query(
            "INSERT INTO review_issues (review_id, category, description) VALUES ($1,$2,$3)",
            [savedReview.id, i.category, i.description]
          );
        }

        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }
    }

    res.status(201).json({
      review: savedReview,
      analysis: { ...parsed, issues: allIssues },
    });

  } catch (err) {
    if (err?.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    next(err);
  }
});

module.exports = router;