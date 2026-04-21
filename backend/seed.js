/**
 * seed.js — Run once to populate your Neon DB with demo employees + reviews
 * Usage: node seed.js
 * Make sure your .env has DATABASE_URL set
 */
require("dotenv").config();
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ─── Schema ──────────────────────────────────────────────────────────────────
const SCHEMA = `
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS employees (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'developer' CHECK (role IN ('admin','lead','developer')),
  job_title     TEXT,
  department    TEXT,
  avatar        TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS code_reviews (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id       UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  reviewed_by       UUID REFERENCES employees(id),
  language          TEXT NOT NULL,
  code_snippet      TEXT,
  severity_score    NUMERIC(4,1) NOT NULL CHECK (severity_score BETWEEN 1 AND 10),
  severity_label    TEXT NOT NULL CHECK (severity_label IN ('critical','high','medium','low')),
  confidence        TEXT CHECK (confidence IN ('High','Medium','Low')),
  summary           TEXT,
  security_count    INT DEFAULT 0,
  performance_count INT DEFAULT 0,
  quality_count     INT DEFAULT 0,
  improved_snippet  TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS review_issues (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  review_id   UUID NOT NULL REFERENCES code_reviews(id) ON DELETE CASCADE,
  category    TEXT NOT NULL CHECK (category IN ('security','performance','quality','naming_design')),
  description TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reviews_employee ON code_reviews(employee_id);
CREATE INDEX IF NOT EXISTS idx_reviews_created  ON code_reviews(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_issues_review    ON review_issues(review_id);
`;

// ─── Demo employees ───────────────────────────────────────────────────────────
const EMPLOYEES = [
  { name: "Sarah Chen",     email: "admin@company.com",  password: "admin123", role: "admin",     job_title: "Engineering Manager",    department: "Leadership",  avatar: "SC" },
  { name: "Marcus Johnson", email: "dev@company.com",    password: "dev123",   role: "developer", job_title: "Senior Backend Dev",     department: "Backend",     avatar: "MJ" },
  { name: "Priya Sharma",   email: "lead@company.com",   password: "lead123",  role: "lead",      job_title: "Tech Lead",              department: "Full Stack",  avatar: "PS" },
  { name: "Aisha Patel",    email: "aisha@company.com",  password: "dev123",   role: "developer", job_title: "Mid Frontend Dev",       department: "Frontend",    avatar: "AP" },
  { name: "Ravi Kumar",     email: "ravi@company.com",   password: "dev123",   role: "developer", job_title: "Junior Backend Dev",     department: "Backend",     avatar: "RK" },
  { name: "Elena Torres",   email: "elena@company.com",  password: "dev123",   role: "developer", job_title: "Senior Full Stack Dev",  department: "Full Stack",  avatar: "ET" },
  { name: "Daniel Park",    email: "daniel@company.com", password: "dev123",   role: "developer", job_title: "Junior Frontend Dev",    department: "Frontend",    avatar: "DP" },
];

// ─── Issue pools per category ─────────────────────────────────────────────────
const ISSUE_POOLS = {
  security: [
    "SQL injection vulnerability in user query — use parameterised queries",
    "XSS risk: unsanitised user input rendered in DOM",
    "Hardcoded API key found in source — move to environment variable",
    "JWT secret stored in plain text config file",
    "Missing CSRF protection on state-changing endpoints",
    "Sensitive data logged to console in production path",
  ],
  performance: [
    "N+1 query pattern in dashboard loader — use JOIN or DataLoader",
    "Memory leak: event listeners added without cleanup in useEffect",
    "Unnecessary full re-render on every keystroke — add useMemo",
    "Synchronous file I/O blocking the event loop",
    "Missing database index on high-frequency WHERE column",
    "Fetching entire table rows when only 2 columns are needed",
  ],
  quality: [
    "Magic numbers without named constants — extract to config",
    "Function exceeds 80 lines — split into smaller units",
    "Missing error handling on async call — unhandled promise rejection",
    "Deep nesting (5+ levels) makes logic hard to follow",
    "Copy-pasted logic in 3 places — extract shared utility",
    "No input validation before processing user-supplied data",
  ],
  naming_design: [
    "Variable 'data' is too generic — rename to reflect its content",
    "Class mixes HTTP handling and business logic — separate concerns",
    "Boolean parameter flag is confusing — use an options object",
    "Inconsistent naming: camelCase and snake_case mixed in same module",
  ],
};

function pick(arr, n) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

function generateReviewsForEmployee(empId, adminId, empIndex, totalEmployees) {
  const langs = ["Python", "TypeScript", "Go", "Java", "Rust", "JavaScript", "C#"];
  const reviews = [];

  // Score trajectory per employee: juniors improve, seniors are stable/good
  const trajectories = [
    { base: 7.5, variance: 1.0, drift: 0.05 },   // Marcus  — Senior, stable high
    { base: 6.0, variance: 0.8, drift: 0.12 },   // Aisha   — Mid, slowly improving
    { base: 3.5, variance: 0.7, drift: 0.45 },   // Ravi    — Junior, improving fast
    { base: 7.8, variance: 0.8, drift: 0.03 },   // Elena   — Senior, consistently good
    { base: 4.0, variance: 0.9, drift: 0.35 },   // Daniel  — Junior, improving
    { base: 6.5, variance: 1.0, drift: 0.08 },   // Priya   — Lead, good
  ];

  const traj = trajectories[empIndex] || trajectories[0];

  for (let monthsAgo = 5; monthsAgo >= 0; monthsAgo--) {
    const date = new Date();
    date.setMonth(date.getMonth() - monthsAgo);
    date.setDate(1 + Math.floor(Math.random() * 20));

    const monthIndex = 5 - monthsAgo; // 0 = oldest, 5 = newest
    const score = Math.min(10, Math.max(1,
      parseFloat((traj.base + traj.drift * monthIndex + (Math.random() - 0.5) * traj.variance).toFixed(1))
    ));

    const label = score < 4 ? "critical" : score < 6 ? "high" : score < 7.5 ? "medium" : "low";
    const confidence = ["High", "High", "Medium"][Math.floor(Math.random() * 3)];
    const lang = langs[Math.floor(Math.random() * langs.length)];

    const secIssues  = pick(ISSUE_POOLS.security,    score < 5 ? 2 : score < 7 ? 1 : 0);
    const perfIssues = pick(ISSUE_POOLS.performance,  score < 6 ? 2 : score < 8 ? 1 : 0);
    const qualIssues = pick(ISSUE_POOLS.quality,      score < 7 ? 2 : 1);
    const nameIssues = pick(ISSUE_POOLS.naming_design, score < 7 ? 1 : 0);

    const summary = score >= 8
      ? `Clean, well-structured ${lang} code. Minor style suggestions only — ready to merge with small tweaks.`
      : score >= 6
      ? `Decent ${lang} implementation with a few areas to address before merging. Logic is sound but needs some refactoring.`
      : score >= 4
      ? `Several issues found in this ${lang} submission. Refactoring required — particularly around error handling and code organisation.`
      : `Critical issues detected in this ${lang} code. Do not merge until security and quality concerns are fully resolved.`;

    reviews.push({
      employee_id: empId,
      reviewed_by: adminId,
      language: lang,
      severity_score: score,
      severity_label: label,
      confidence,
      summary,
      security_count: secIssues.length,
      performance_count: perfIssues.length,
      quality_count: qualIssues.length,
      created_at: date.toISOString(),
      issues: [
        ...secIssues.map(d  => ({ category: "security",      description: d })),
        ...perfIssues.map(d => ({ category: "performance",   description: d })),
        ...qualIssues.map(d => ({ category: "quality",       description: d })),
        ...nameIssues.map(d => ({ category: "naming_design", description: d })),
      ],
    });
  }

  return reviews;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function seed() {
  const client = await pool.connect();
  try {
    console.log("🔧  Creating schema...");
    await client.query(SCHEMA);

    // Check if already seeded
    const { rows: existing } = await client.query("SELECT COUNT(*)::int AS cnt FROM employees");
    if (existing[0].cnt > 0) {
      console.log("⚠️   Employees table already has data.");
      const args = process.argv.slice(2);
      if (!args.includes("--force")) {
        console.log("    Pass --force to reseed. Exiting.\n");
        return;
      }
      console.log("    --force detected, clearing tables...");
      await client.query("DELETE FROM review_issues");
      await client.query("DELETE FROM code_reviews");
      await client.query("DELETE FROM employees");
    }

    console.log("👥  Inserting employees...");
    const empIds = {};
    let adminId = null;

    for (const emp of EMPLOYEES) {
      const hash = await bcrypt.hash(emp.password, 12);
      const { rows } = await client.query(
        `INSERT INTO employees (name, email, password_hash, role, job_title, department, avatar)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
        [emp.name, emp.email, hash, emp.role, emp.job_title, emp.department, emp.avatar]
      );
      empIds[emp.email] = rows[0].id;
      if (emp.role === "admin") adminId = rows[0].id;
      console.log(`   ✓ ${emp.name} (${emp.role})`);
    }

    console.log("\n📋  Inserting code reviews...");
    const developerEmails = EMPLOYEES.filter(e => e.role !== "admin").map(e => e.email);

    for (let i = 0; i < developerEmails.length; i++) {
      const email = developerEmails[i];
      const empId = empIds[email];
      const emp   = EMPLOYEES.find(e => e.email === email);
      const reviews = generateReviewsForEmployee(empId, adminId, i, developerEmails.length);

      for (const rev of reviews) {
        await client.query("BEGIN");
        try {
          const { rows } = await client.query(
            `INSERT INTO code_reviews
               (employee_id, reviewed_by, language, severity_score, severity_label,
                confidence, summary, security_count, performance_count, quality_count, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
            [
              rev.employee_id, rev.reviewed_by, rev.language,
              rev.severity_score, rev.severity_label, rev.confidence, rev.summary,
              rev.security_count, rev.performance_count, rev.quality_count, rev.created_at,
            ]
          );
          const reviewId = rows[0].id;

          for (const issue of rev.issues) {
            await client.query(
              "INSERT INTO review_issues (review_id, category, description) VALUES ($1,$2,$3)",
              [reviewId, issue.category, issue.description]
            );
          }
          await client.query("COMMIT");
        } catch (e) {
          await client.query("ROLLBACK");
          throw e;
        }
      }
      console.log(`   ✓ ${emp.name} — ${reviews.length} reviews inserted`);
    }

    const { rows: counts } = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM employees)    AS employees,
        (SELECT COUNT(*) FROM code_reviews) AS reviews,
        (SELECT COUNT(*) FROM review_issues) AS issues
    `);
    console.log(`\n✅  Seed complete!`);
    console.log(`   employees:    ${counts[0].employees}`);
    console.log(`   code_reviews: ${counts[0].reviews}`);
    console.log(`   review_issues:${counts[0].issues}\n`);

  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(err => {
  console.error("❌  Seed failed:", err.message);
  process.exit(1);
});
