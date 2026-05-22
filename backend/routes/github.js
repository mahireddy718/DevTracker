const express = require("express");
const axios = require("axios");
const authMiddleware = require("../middleware/auth");
const User = require("../models/User");
const RepoData = require("../models/RepoData");

const router = express.Router();

const githubAPI = axios.create({
  baseURL: "https://api.github.com",
  headers: {
    Authorization: `token ${process.env.GITHUB_TOKEN}`,
    Accept: "application/vnd.github.v3+json",
  },
});

// Helper: fetch paginated data
async function fetchAllPages(url) {
  let results = [];
  let page = 1;
  while (true) {
    const separator = url.includes("?") ? "&" : "?";
    const res = await githubAPI.get(`${url}${separator}per_page=100&page=${page}`);
    if (!res.data || res.data.length === 0) break;
    results = results.concat(res.data);
    if (res.data.length < 100) break;
    page++;
  }
  return results;
}

// POST /api/github/connect  — add repo to user profile
router.post("/connect", authMiddleware, async (req, res) => {
  try {
    const { repoUrl } = req.body;
    if (!repoUrl)
      return res.status(400).json({ message: "repoUrl is required" });

    // Parse owner/repo from URL like https://github.com/owner/repo
    const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!match)
      return res.status(400).json({ message: "Invalid GitHub repo URL" });

    const [, owner, repoName] = match;

    // Verify repo exists on GitHub
    try {
      await githubAPI.get(`/repos/${owner}/${repoName}`);
    } catch {
      return res.status(404).json({ message: "GitHub repository not found" });
    }

    // Save to user's repo list (avoid duplicates)
    const user = await User.findById(req.user.id);
    const alreadyAdded = user.repos.some(
      (r) => r.owner === owner && r.repoName === repoName
    );
    if (!alreadyAdded) {
      user.repos.push({ repoUrl, repoName, owner });
      await user.save();
    }

    res.json({ message: "Repository connected", owner, repoName });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// GET /api/github/repos — list user's repos
router.get("/repos", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("repos");
    res.json(user.repos);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// POST /api/github/fetch  — fetch & store repo analytics
router.post("/fetch", authMiddleware, async (req, res) => {
  try {
    const { owner, repoName } = req.body;
    if (!owner || !repoName)
      return res.status(400).json({ message: "owner and repoName required" });

    // Fetch data in parallel
    const [commitsRaw, prsRaw, issuesRaw, contributorsRaw] = await Promise.all([
      fetchAllPages(`/repos/${owner}/${repoName}/commits`),
      fetchAllPages(`/repos/${owner}/${repoName}/pulls?state=all`),
      fetchAllPages(`/repos/${owner}/${repoName}/issues?state=all`),
      fetchAllPages(`/repos/${owner}/${repoName}/contributors`),
    ]);

    const commits = commitsRaw.map((c) => ({
      sha: c.sha,
      message: c.commit.message,
      author: c.commit.author?.name || "Unknown",
      date: c.commit.author?.date,
      url: c.html_url,
    }));

    const pullRequests = prsRaw.map((pr) => ({
      id: pr.number,
      title: pr.title,
      state: pr.state,
      author: pr.user?.login,
      createdAt: pr.created_at,
      mergedAt: pr.merged_at,
    }));

    // Filter out PRs from issues (GitHub issues API returns both)
    const issues = issuesRaw
      .filter((i) => !i.pull_request)
      .map((i) => ({
        id: i.number,
        title: i.title,
        state: i.state,
        author: i.user?.login,
        createdAt: i.created_at,
        closedAt: i.closed_at,
      }));

    const contributors = contributorsRaw.map((c) => ({
      login: c.login,
      contributions: c.contributions,
      avatarUrl: c.avatar_url,
    }));

    // Upsert into DB
    const repoData = await RepoData.findOneAndUpdate(
      { userId: req.user.id, repoName, owner },
      { commits, pullRequests, issues, contributors, lastFetched: new Date() },
      { upsert: true, new: true }
    );

    res.json({ message: "Repo data fetched", repoData });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// GET /api/github/analytics/:owner/:repoName
router.get("/analytics/:owner/:repoName", authMiddleware, async (req, res) => {
  try {
    const { owner, repoName } = req.params;
    const repoData = await RepoData.findOne({
      userId: req.user.id,
      owner,
      repoName,
    });

    if (!repoData)
      return res.status(404).json({ message: "No data found. Fetch repo first." });

    // Calculate commit frequency per day (last 30 days)
    const now = new Date();
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
    const recentCommits = repoData.commits.filter(
      (c) => new Date(c.date) >= thirtyDaysAgo
    );

    const commitsByDay = {};
    recentCommits.forEach((c) => {
      const day = c.date.split("T")[0];
      commitsByDay[day] = (commitsByDay[day] || 0) + 1;
    });

    const commitsByAuthor = {};
    repoData.commits.forEach((c) => {
      commitsByAuthor[c.author] = (commitsByAuthor[c.author] || 0) + 1;
    });

    const openPRs = repoData.pullRequests.filter((p) => p.state === "open").length;
    const mergedPRs = repoData.pullRequests.filter((p) => p.mergedAt).length;
    const openIssues = repoData.issues.filter((i) => i.state === "open").length;
    const closedIssues = repoData.issues.filter((i) => i.state === "closed").length;

    res.json({
      repoName,
      owner,
      totalCommits: repoData.commits.length,
      commitsByDay,
      commitsByAuthor,
      pullRequests: { open: openPRs, merged: mergedPRs, total: repoData.pullRequests.length },
      issues: { open: openIssues, closed: closedIssues, total: repoData.issues.length },
      contributors: repoData.contributors,
      aiInsights: repoData.aiInsights,
      lastFetched: repoData.lastFetched,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

module.exports = router;
