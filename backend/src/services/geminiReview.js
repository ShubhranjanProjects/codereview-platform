function buildPrompt({ language, code }) {
  return `
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
${String(code || "").slice(0, 12000)}
`;
}

function toIssues(parsed) {
  const {
    code_quality = [],
    security_issues = [],
    performance_issues = [],
    naming_design = [],
  } = parsed || {};

  return [
    ...code_quality.map((d) => ({ category: "quality", description: d })),
    ...security_issues.map((d) => ({ category: "security", description: d })),
    ...performance_issues.map((d) => ({ category: "performance", description: d })),
    ...naming_design.map((d) => ({ category: "naming_design", description: d })),
  ];
}

async function analyzeWithGemini({ apiKey, language, code }) {
  if (!apiKey) {
    const err = new Error("Missing GEMINI_API_KEY");
    err.statusCode = 500;
    throw err;
  }

  const prompt = buildPrompt({ language, code });

  const geminiRes = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    }
  );

  const rawText = await geminiRes.text();
  if (!geminiRes.ok) {
    const err = new Error("AI service error (Gemini failed)");
    err.statusCode = 502;
    err.details = rawText;
    throw err;
  }

  let aiData;
  try {
    aiData = JSON.parse(rawText);
  } catch {
    const err = new Error("Invalid AI response format");
    err.statusCode = 502;
    err.details = rawText;
    throw err;
  }

  const candidateText = aiData?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

  let parsed;
  try {
    parsed = JSON.parse(String(candidateText).replace(/```json|```/g, "").trim());
  } catch {
    const err = new Error("AI returned unparseable JSON");
    err.statusCode = 502;
    err.details = candidateText;
    throw err;
  }

  return {
    parsed,
    issues: toIssues(parsed),
  };
}

module.exports = { analyzeWithGemini };
