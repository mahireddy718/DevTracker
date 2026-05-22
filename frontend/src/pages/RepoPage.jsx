import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Line, Bar, Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import api from "../utils/api";
import Navbar from "../components/Navbar";

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Title, Tooltip, Legend, Filler
);

const chartOptions = {
  responsive: true,
  plugins: { legend: { labels: { color: "#9ca3af" } } },
  scales: {
    x: { ticks: { color: "#9ca3af" }, grid: { color: "#1f2937" } },
    y: { ticks: { color: "#9ca3af" }, grid: { color: "#1f2937" } },
  },
};

export default function RepoPage() {
  const { owner, repoName } = useParams();
  const [analytics, setAnalytics] = useState(null);
  const [insights, setInsights] = useState(null);
  const [fetching, setFetching] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState("");

  const loadAnalytics = async () => {
    try {
      const res = await api.get(`/github/analytics/${owner}/${repoName}`);
      setAnalytics(res.data);
      if (res.data.aiInsights?.summary) setInsights(res.data.aiInsights);
    } catch {
      // No data yet
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAnalytics(); }, [owner, repoName]);

  const handleFetch = async () => {
    setFetching(true);
    setStatusMsg("Fetching repository data from GitHub...");
    try {
      await api.post("/github/fetch", { owner, repoName });
      await loadAnalytics();
      setStatusMsg("Data fetched successfully!");
    } catch (err) {
      setStatusMsg(err.response?.data?.message || "Fetch failed");
    } finally {
      setFetching(false);
    }
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setStatusMsg("Generating AI insights...");
    try {
      const res = await api.post("/ai/analyze", { owner, repoName });
      setInsights(res.data.insights);
      setStatusMsg("AI analysis complete!");
    } catch (err) {
      setStatusMsg(err.response?.data?.message || "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  };

  // Prepare chart data
  const commitChartData = analytics ? (() => {
    const days = Object.keys(analytics.commitsByDay).sort().slice(-14);
    return {
      labels: days,
      datasets: [{
        label: "Commits",
        data: days.map((d) => analytics.commitsByDay[d] || 0),
        borderColor: "#0ea5e9",
        backgroundColor: "rgba(14,165,233,0.1)",
        fill: true,
        tension: 0.4,
      }],
    };
  })() : null;

  const authorChartData = analytics ? (() => {
    const authors = Object.keys(analytics.commitsByAuthor).slice(0, 8);
    return {
      labels: authors,
      datasets: [{
        label: "Commits",
        data: authors.map((a) => analytics.commitsByAuthor[a]),
        backgroundColor: ["#0ea5e9","#6366f1","#f59e0b","#10b981","#ef4444","#8b5cf6","#14b8a6","#f97316"],
      }],
    };
  })() : null;

  const prChartData = analytics ? {
    labels: ["Open PRs", "Merged PRs", "Total Issues Open", "Issues Closed"],
    datasets: [{
      data: [
        analytics.pullRequests.open,
        analytics.pullRequests.merged,
        analytics.issues.open,
        analytics.issues.closed,
      ],
      backgroundColor: ["#f59e0b","#10b981","#ef4444","#6366f1"],
    }],
  } : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950">
        <Navbar />
        <div className="flex items-center justify-center h-64 text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-bold text-white">{owner}/{repoName}</h2>
            {analytics && (
              <p className="text-gray-400 text-sm mt-1">
                Last fetched: {new Date(analytics.lastFetched).toLocaleString()}
              </p>
            )}
          </div>
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={handleFetch}
              disabled={fetching}
              className="bg-gray-700 hover:bg-gray-600 text-white font-semibold px-4 py-2 rounded-lg transition disabled:opacity-50"
            >
              {fetching ? "Fetching..." : "🔄 Fetch Data"}
            </button>
            <button
              onClick={handleAnalyze}
              disabled={analyzing || !analytics}
              className="bg-sky-600 hover:bg-sky-500 text-white font-semibold px-4 py-2 rounded-lg transition disabled:opacity-50"
            >
              {analyzing ? "Analyzing..." : "🤖 AI Analyze"}
            </button>
          </div>
        </div>

        {statusMsg && (
          <p className="text-sky-400 text-sm mb-6 bg-sky-900/20 px-4 py-2 rounded-lg">{statusMsg}</p>
        )}

        {!analytics ? (
          <div className="text-center py-20 text-gray-500">
            <p className="text-5xl mb-4">📊</p>
            <p>Click <strong className="text-white">Fetch Data</strong> to load repository analytics.</p>
          </div>
        ) : (
          <>
            {/* Stat Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
              {[
                { label: "Total Commits", value: analytics.totalCommits, color: "sky" },
                { label: "Open PRs", value: analytics.pullRequests.open, color: "yellow" },
                { label: "Merged PRs", value: analytics.pullRequests.merged, color: "green" },
                { label: "Open Issues", value: analytics.issues.open, color: "red" },
              ].map((stat) => (
                <div key={stat.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <p className="text-gray-400 text-xs mb-1">{stat.label}</p>
                  <p className={`text-3xl font-bold text-${stat.color}-400`}>{stat.value}</p>
                </div>
              ))}
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {commitChartData && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                  <h3 className="text-white font-semibold mb-4">Commit Activity (Last 14 days)</h3>
                  <Line data={commitChartData} options={chartOptions} />
                </div>
              )}
              {authorChartData && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                  <h3 className="text-white font-semibold mb-4">Commits by Contributor</h3>
                  <Bar data={authorChartData} options={{ ...chartOptions, indexAxis: "y" }} />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {prChartData && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                  <h3 className="text-white font-semibold mb-4">PR & Issue Overview</h3>
                  <div className="max-w-xs mx-auto">
                    <Doughnut data={prChartData} options={{ plugins: { legend: { labels: { color: "#9ca3af" } } } }} />
                  </div>
                </div>
              )}

              {/* Contributors */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <h3 className="text-white font-semibold mb-4">Top Contributors</h3>
                <div className="space-y-3">
                  {analytics.contributors.slice(0, 6).map((c) => (
                    <div key={c.login} className="flex items-center gap-3">
                      <img src={c.avatarUrl} alt={c.login} className="w-8 h-8 rounded-full" />
                      <div className="flex-1">
                        <p className="text-white text-sm font-medium">{c.login}</p>
                        <div className="w-full bg-gray-800 rounded-full h-1.5 mt-1">
                          <div
                            className="bg-sky-500 h-1.5 rounded-full"
                            style={{ width: `${Math.min(100, (c.contributions / analytics.contributors[0]?.contributions) * 100)}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-gray-400 text-sm">{c.contributions}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* AI Insights */}
            {insights && (
              <div className="bg-gradient-to-br from-sky-900/30 to-indigo-900/30 border border-sky-800/40 rounded-2xl p-6">
                <h3 className="text-white font-bold text-lg mb-5 flex items-center gap-2">
                  🤖 AI Productivity Insights
                  <span className="text-xs text-sky-400 font-normal ml-2">
                    {insights.generatedAt ? new Date(insights.generatedAt).toLocaleString() : ""}
                  </span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <h4 className="text-sky-300 font-semibold mb-2">Summary</h4>
                    <p className="text-gray-300 text-sm leading-relaxed">{insights.summary}</p>
                  </div>
                  <div>
                    <h4 className="text-yellow-300 font-semibold mb-2">Sprint Progress</h4>
                    <p className="text-gray-300 text-sm leading-relaxed">{insights.sprintProgress}</p>
                  </div>
                  {insights.bottlenecks?.length > 0 && (
                    <div>
                      <h4 className="text-red-300 font-semibold mb-2">Bottlenecks</h4>
                      <ul className="space-y-1">
                        {insights.bottlenecks.map((b, i) => (
                          <li key={i} className="text-gray-300 text-sm flex gap-2">
                            <span className="text-red-400">⚠</span> {b}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {insights.recommendations?.length > 0 && (
                    <div>
                      <h4 className="text-green-300 font-semibold mb-2">Recommendations</h4>
                      <ul className="space-y-1">
                        {insights.recommendations.map((r, i) => (
                          <li key={i} className="text-gray-300 text-sm flex gap-2">
                            <span className="text-green-400">✓</span> {r}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {insights.inactiveContributors?.length > 0 && (
                    <div className="md:col-span-2">
                      <h4 className="text-orange-300 font-semibold mb-2">Inactive Contributors</h4>
                      <div className="flex flex-wrap gap-2">
                        {insights.inactiveContributors.map((c, i) => (
                          <span key={i} className="bg-orange-900/30 text-orange-300 text-xs px-3 py-1 rounded-full border border-orange-800/40">{c}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
