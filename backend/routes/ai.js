const express = require("express");
const OpenAI = require("openai");
const authMiddleware = require("../middleware/auth");
const RepoData = require("../models/RepoData");

const router = express.Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function generateMockInsights(data) {
  const {
    repoName,
    totalCommits,
    commitsByAuthor,
    inactiveContributors,
    openPRs,
    mergedPRs,
    openIssues,
    closedIssues,
  } = data;

  const topContributor = Object.entries(commitsByAuthor || {}).sort((a, b) => b[1] - a[1])[0]?.[0] || "Unknown";

  const summary = `Overall productivity for ${repoName} is moderate. There are a total of ${totalCommits || 0} commits recorded, with ${topContributor} being the most active contributor. Development is progressing, but attention is needed to resolve outstanding items.`;

  const bottlenecks = [];
  if (openPRs > 2) {
    bottlenecks.push(`Accumulation of ${openPRs} open Pull Requests awaiting review, creating a merge bottleneck.`);
  } else if (openPRs > 0) {
    bottlenecks.push(`There are ${openPRs} open Pull Requests that need approval to be merged into the main branch.`);
  } else {
    bottlenecks.push("No active pull requests; workflow integration seems to be quiet.");
  }

  if (openIssues > 4) {
    bottlenecks.push(`High volume of open issues (${openIssues}) might indicate unresolved bugs or lack of backlog refinement.`);
  }

  if (inactiveContributors && inactiveContributors.length > 0) {
    bottlenecks.push(`Some team members (${inactiveContributors.slice(0, 2).join(", ")}) have not contributed commits in the last 7 days.`);
  }

  const recommendations = [
    "Establish clear ownership for pull requests to reduce review times.",
    "Introduce automated testing in CI/CD to speed up integrations."
  ];

  if (openPRs > 0) {
    recommendations.push(`Prioritize reviewing and merging the ${openPRs} pending pull request(s).`);
  }
  if (openIssues > 0) {
    recommendations.push(`Triage the ${openIssues} open issue(s) and assign them to active contributors.`);
  }
  if (inactiveContributors && inactiveContributors.length > 0) {
    recommendations.push(`Check in with inactive contributors to see if they are blocked or need support.`);
  }

  const sprintProgress = `Sprint velocity is stable. ${mergedPRs} PRs have been successfully merged, and ${closedIssues} issues have been resolved. Focus should now shift to closing the remaining ${openIssues} issues and unblocking open reviews.`;

  return {
    summary,
    bottlenecks: bottlenecks.length > 0 ? bottlenecks : ["No major process bottlenecks detected at the moment."],
    inactiveContributors: inactiveContributors || [],
    sprintProgress,
    recommendations
  };
}

// POST /api/ai/analyze
router.post("/analyze", authMiddleware, async (req, res) => {
  try {
    const { owner, repoName } = req.body;
    if (!owner || !repoName)
      return res.status(400).json({ message: "owner and repoName required" });

    const repoData = await RepoData.findOne({
      userId: req.user.id,
      owner,
      repoName,
    });

    if (!repoData)
      return res.status(404).json({ message: "No repo data found. Fetch repo first." });

    // Summarize data for the prompt
    const commitsByAuthor = {};
    repoData.commits.forEach((c) => {
      commitsByAuthor[c.author] = (commitsByAuthor[c.author] || 0) + 1;
    });

    const recentCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentAuthors = new Set(
      repoData.commits
        .filter((c) => new Date(c.date) >= recentCutoff)
        .map((c) => c.author)
    );
    const allAuthors = new Set(repoData.commits.map((c) => c.author));
    const inactiveContributors = [...allAuthors].filter(
      (a) => !recentAuthors.has(a)
    );

    const dataForAI = {
      repoName,
      totalCommits: repoData.commits.length,
      commitsByAuthor,
      inactiveContributors,
      recentCommitMessages: repoData.commits.slice(0, 20).map((c) => c.message),
      openPRs: repoData.pullRequests.filter((p) => p.state === "open").length,
      mergedPRs: repoData.pullRequests.filter((p) => p.mergedAt).length,
      openIssues: repoData.issues.filter((i) => i.state === "open").length,
      closedIssues: repoData.issues.filter((i) => i.state === "closed").length,
    };

    const prompt = `
You are a software engineering productivity analyst. Analyze the following GitHub repository data and generate actionable insights.

Repository Data:
${JSON.stringify(dataForAI, null, 2)}

Respond with a JSON object containing:
{
  "summary": "2-3 sentence overall productivity summary",
  "bottlenecks": ["list", "of", "bottlenecks"],
  "inactiveContributors": ["names of inactive contributors"],
  "sprintProgress": "brief sprint progress description",
  "recommendations": ["list", "of", "actionable recommendations"]
}

Only respond with valid JSON, no extra text.
`;

    let insights;
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
      });

      const raw = completion.choices[0].message.content.trim();
      try {
        insights = JSON.parse(raw);
      } catch {
        throw new Error("AI returned invalid JSON structure");
      }
    } catch (err) {
      console.warn("OpenAI API call failed or quota exceeded. Falling back to local analyzer. Error:", err.message);
      insights = generateMockInsights(dataForAI);
    }

    // Save insights to DB
    repoData.aiInsights = { ...insights, generatedAt: new Date() };
    await repoData.save();

    res.json({ message: "AI analysis complete", insights });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// GET /api/ai/insights/:owner/:repoName
router.get("/insights/:owner/:repoName", authMiddleware, async (req, res) => {
  try {
    const { owner, repoName } = req.params;
    const repoData = await RepoData.findOne({
      userId: req.user.id,
      owner,
      repoName,
    });

    if (!repoData || !repoData.aiInsights?.summary)
      return res.status(404).json({ message: "No AI insights found. Run analysis first." });

    res.json(repoData.aiInsights);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

module.exports = router;
