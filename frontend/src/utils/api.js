import axios from "axios";

let baseURL = import.meta.env.VITE_API_URL || "/api";
if (baseURL.startsWith("http") && !baseURL.endsWith("/api") && !baseURL.includes("/api/")) {
  baseURL = baseURL.replace(/\/$/, "") + "/api";
}

const api = axios.create({
  baseURL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
