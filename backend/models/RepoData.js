const mongoose = require("mongoose");

const repoDataSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    repoName: { type: String, required: true },
    owner: { type: String, required: true },
    commits: [
      {
        sha: String,
        message: String,
        author: String,
        date: String,
        url: String,
      },
    ],
    pullRequests: [
      {
        id: Number,
        title: String,
        state: String,
        author: String,
        createdAt: String,
        mergedAt: String,
      },
    ],
    issues: [
      {
        id: Number,
        title: String,
        state: String,
        author: String,
        createdAt: String,
        closedAt: String,
      },
    ],
    contributors: [
      {
        login: String,
        contributions: Number,
        avatarUrl: String,
      },
    ],
    aiInsights: {
      summary: String,
      bottlenecks: [String],
      inactiveContributors: [String],
      sprintProgress: String,
      recommendations: [String],
      generatedAt: Date,
    },
    lastFetched: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model("RepoData", repoDataSchema);
