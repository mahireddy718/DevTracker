import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";
import Navbar from "../components/Navbar";

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [repos, setRepos] = useState([]);
  const [repoUrl, setRepoUrl] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    api.get("/github/repos").then((res) => setRepos(res.data));
  }, []);

  const handleConnect = async () => {
    if (!repoUrl.trim()) return;
    setConnecting(true);
    setError("");
    setSuccess("");
    try {
      await api.post("/github/connect", { repoUrl });
      setSuccess("Repository connected!");
      setRepoUrl("");
      const res = await api.get("/github/repos");
      setRepos(res.data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to connect repo");
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-10">
        <h2 className="text-2xl font-bold text-white mb-1">Welcome, {user?.name} 👋</h2>
        <p className="text-gray-400 mb-8">Connect your GitHub repositories to start tracking productivity.</p>

        {/* Connect Repo */}
        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 mb-8">
          <h3 className="text-lg font-semibold text-white mb-4">Connect a Repository</h3>
          {error && <p className="text-red-400 text-sm mb-3 bg-red-900/20 p-2 rounded">{error}</p>}
          {success && <p className="text-green-400 text-sm mb-3 bg-green-900/20 p-2 rounded">{success}</p>}
          <div className="flex gap-3">
            <input
              type="text"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/owner/repo"
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-sky-500"
            />
            <button
              onClick={handleConnect}
              disabled={connecting}
              className="bg-sky-600 hover:bg-sky-500 text-white font-semibold px-5 py-2.5 rounded-lg transition disabled:opacity-50"
            >
              {connecting ? "Connecting..." : "Connect"}
            </button>
          </div>
        </div>

        {/* Repo List */}
        <h3 className="text-lg font-semibold text-white mb-4">Your Repositories</h3>
        {repos.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <p className="text-5xl mb-4">📂</p>
            <p>No repositories connected yet.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {repos.map((repo) => (
              <div
                key={repo._id}
                className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex items-center justify-between hover:border-sky-700 transition cursor-pointer"
                onClick={() => navigate(`/repo/${repo.owner}/${repo.repoName}`)}
              >
                <div>
                  <p className="text-white font-semibold">{repo.owner}/{repo.repoName}</p>
                  <p className="text-gray-500 text-sm mt-1">Added {new Date(repo.addedAt).toLocaleDateString()}</p>
                </div>
                <span className="text-sky-400 text-sm font-medium">View Analytics →</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
