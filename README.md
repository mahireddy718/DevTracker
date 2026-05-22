# DevTrackr — AI Developer Productivity Dashboard

An AI-powered dashboard for tracking software development activity from GitHub repositories.

## Project Structure

```
devtrackr/
├── backend/      → Express + MongoDB + GitHub API + OpenAI
└── frontend/     → React + Vite + Tailwind CSS + Chart.js
```

## Setup Instructions

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env
# Fill in your values in .env
npm run dev
```

**Required `.env` values:**
| Key | Description |
|-----|-------------|
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | Any long random string |
| `GITHUB_TOKEN` | GitHub Personal Access Token (Settings → Developer Settings → PAT) |
| `OPENAI_API_KEY` | OpenAI API key from https://platform.openai.com |

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5173` and proxies `/api` requests to `http://localhost:5000`.

## API Endpoints

### Auth
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/auth/signup` | Register new user |
| POST | `/api/auth/login` | Login, get JWT |
| GET | `/api/auth/me` | Get current user |

### GitHub
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/github/connect` | Add a repo URL |
| GET | `/api/github/repos` | List user's repos |
| POST | `/api/github/fetch` | Fetch repo data from GitHub |
| GET | `/api/github/analytics/:owner/:repoName` | Get stored analytics |

### AI
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/ai/analyze` | Run AI analysis on repo data |
| GET | `/api/ai/insights/:owner/:repoName` | Get stored AI insights |

## Full User Flow

1. Sign up / log in
2. Connect a GitHub repo URL (e.g. `https://github.com/facebook/react`)
3. Click **Fetch Data** on the repo page to pull GitHub data
4. View commit charts, PR analytics, contributor stats
5. Click **AI Analyze** to generate AI productivity insights

## Tech Stack

**Frontend:** React 18, Vite, Tailwind CSS, Chart.js, React Router  
**Backend:** Node.js, Express.js, MongoDB (Mongoose), JWT, bcrypt, OpenAI SDK, Axios
