const router = require("express").Router();
const pool = require("../db");
const { authenticate } = require("../middleware/auth");
const { analyzeWithGemini } = require("../services/geminiReview");

function getGithubToken() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    const err = new Error("Missing GITHUB_TOKEN in backend");
    err.statusCode = 500;
    throw err;
  }
  return token;
}

async function githubRequest(token, path) {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      Accept: "application/vnd.github+json",
    },
  });

  const text = await res.text();
  if (!res.ok) {
    const err = new Error(`GitHub API error: ${res.status}`);
    err.statusCode = 502;
    err.details = text;
    throw err;
  }

  try {
    return JSON.parse(text);
  } catch {
    const err = new Error("GitHub API returned invalid JSON");
    err.statusCode = 502;
    err.details = text;
    throw err;
  }
}

async function fetchAllPrFiles(token, { owner, repo, pull_number }) {
  const per_page = 100;
  let page = 1;
  const out = [];

  // GitHub caps at 3000 files; for typical PRs this is fine.
  // We stop when a page returns < per_page.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const data = await githubRequest(
      token,
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${pull_number}/files?per_page=${per_page}&page=${page}`
    );

    out.push(...data);
    if (!data || data.length < per_page) break;
    page += 1;
  }

  return out;
}

function prToAnalysisText({ pr, files }) {
  const header = [
    `GitHub PR Review Input`,
    `repo: ${pr.base?.repo?.full_name || ""}`,
    `pr: #${pr.number} ${pr.title || ""}`,
    `url: ${pr.html_url || ""}`,
    `author: ${pr.user?.login || ""}`,
    `base: ${pr.base?.ref || ""} (${pr.base?.sha || ""})`,
    `head: ${pr.head?.ref || ""} (${pr.head?.sha || ""})`,
    `changed_files: ${pr.changed_files ?? ""}, additions: ${pr.additions ?? ""}, deletions: ${pr.deletions ?? ""}`,
    ``,
  ].join("\n");

  const body = (files || [])
    .map((f) => {
      const patch = f.patch ? f.patch : "(no patch available - possibly binary or too large)";
      return [
        `--- file: ${f.filename}`,
        `status: ${f.status}, additions: ${f.additions}, deletions: ${f.deletions}, changes: ${f.changes}`,
        patch,
        ``,
      ].join("\n");
    })
    .join("\n");

  return (header + body).slice(0, 12000);
}

// POST /api/github/pr/analyze
// body: { employee_id, owner, repo, number, language, save? }
router.post("/pr/analyze", authenticate, async (req, res, next) => {
  try {
    const { employee_id, owner, repo, number, language, save = true } = req.body || {};

    if (!employee_id || !owner || !repo || !number || !language) {
      return res.status(400).json({ error: "employee_id, owner, repo, number, language required" });
    }

    const token = getGithubToken();
    const pull_number = parseInt(number, 10);
    if (!Number.isFinite(pull_number)) {
      return res.status(400).json({ error: "number must be an integer" });
    }

    const [pr, files] = await Promise.all([
      githubRequest(
        token,
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${pull_number}`
      ),
      fetchAllPrFiles(token, { owner, repo, pull_number }),
    ]);

    const code_snippet = prToAnalysisText({ pr, files });

    const apiKey = process.env.GEMINI_API_KEY;
    const { parsed, issues: allIssues } = await analyzeWithGemini({
      apiKey,
      language,
      code: code_snippet,
    });

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
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
           RETURNING *`,
          [
            employee_id,
            req.user.id,
            language,
            code_snippet,
            parsed.severity_score,
            parsed.severity_label,
            parsed.confidence,
            parsed.summary,
            (parsed.security_issues || []).length,
            (parsed.performance_issues || []).length,
            (parsed.code_quality || []).length,
            parsed.improved_snippet || null,
            "github_pr",
            pr.base?.repo?.full_name || `${owner}/${repo}`,
            pr.number,
            pr.html_url || null,
            pr.head?.sha || null,
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
      github: {
        repo_full_name: pr.base?.repo?.full_name || `${owner}/${repo}`,
        pr_number: pr.number,
        pr_url: pr.html_url,
        head_sha: pr.head?.sha,
        changed_files: pr.changed_files,
      },
    });
  } catch (err) {
    if (err?.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
});

module.exports = router;

