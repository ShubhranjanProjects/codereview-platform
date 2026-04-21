const router = require("express").Router();
const pool   = require("../db");
const { authenticate } = require("../middleware/auth");

// ── GET /api/reviews ──────────────────────────────────────────────────────────
router.get("/", authenticate, async (req, res, next) => {
  try {
    const { employee_id, severity, language, limit = 200, offset = 0 } = req.query;
    const conditions = [], params = [];
    let idx = 1;

    if (employee_id) { conditions.push(`cr.employee_id=$${idx++}`); params.push(employee_id); }
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
    const { employee_id, language, code_snippet, save = true } = req.body;

    if (!employee_id || !language || !code_snippet) {
      return res.status(400).json({ error: "employee_id, language and code_snippet required" });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("❌ Missing GEMINI_API_KEY");
      return res.status(500).json({ error: "Missing GEMINI_API_KEY in backend" });
    }

    // 🔥 Prompt
    const prompt = `
You are a senior software engineer and security expert.

Analyze the code and return ONLY valid JSON:

{
  "severity_score": <1.0-10.0>,
  "confidence": "<High|Medium|Low>",
  "severity_label": "<critical|high|medium|low>",
  "summary": "<2-3 sentence summary>",
  "code_quality": ["<issue>"],
  "security_issues": ["<issue>"],
  "performance_issues": ["<issue>"],
  "naming_design": ["<issue>"],
  "improved_snippet": "<fix>"
}

Language: ${language}

Code:
${code_snippet.slice(0, 4000)}
`;

    console.log("🚀 Calling Gemini API...");

    const geminiRes = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-goog-api-key": apiKey,   // 👈 IMPORTANT (match curl)
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
        }),
      }
    );

    const rawText = await geminiRes.text();
    console.log("📥 Gemini RAW Response:", rawText);

    if (!geminiRes.ok) {
      console.error("❌ Gemini API Error:", rawText);
      return res.status(502).json({ error: "AI service error (Gemini failed)" });
    }

    let aiData;
    try {
      aiData = JSON.parse(rawText);
    } catch (e) {
      console.error("❌ JSON parse failed:", rawText);
      return res.status(502).json({ error: "Invalid AI response format" });
    }

    const raw =
      aiData?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

    let parsed;
    try {
      parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
    } catch (e) {
      console.error("❌ Failed to parse AI JSON:", raw);
      return res.status(502).json({ error: "AI returned unparseable JSON" });
    }

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

    const allIssues = [
      ...code_quality.map(d       => ({ category: "quality",       description: d })),
      ...security_issues.map(d    => ({ category: "security",      description: d })),
      ...performance_issues.map(d => ({ category: "performance",   description: d })),
      ...naming_design.map(d      => ({ category: "naming_design", description: d })),
    ];

    let savedReview = null;

    if (save) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        const { rows } = await client.query(
          `INSERT INTO code_reviews 
          (employee_id, reviewed_by, language, code_snippet, severity_score, severity_label, confidence, summary,
           security_count, performance_count, quality_count, improved_snippet)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
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
    console.error("❌ Analyze Error:", err);
    next(err);
  }
});

module.exports = router;