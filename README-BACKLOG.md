# 🏪 UniBazzar (ግቢ Bazzar) — Chatbot Backlog System

> **Production-grade asynchronous AI chatbot queue using Node.js, BullMQ, and Redis**

---

## 1. 📖 Project Overview

**UniBazzar** is a campus marketplace platform where students buy, sell, and trade items safely within their university community. The AI chatbot helps users:

- 🔍 Search listings by keyword, category, or price range
- 💡 Get personalized item recommendations powered by **Google Gemini**
- 📝 Learn how to post their own listings
- 💬 Ask general campus marketplace questions

This document covers the **backlog (queue) system** added to the chatbot so it can handle heavy traffic without degrading the user experience or crashing the server.

---

## 2. 🧠 What Is a Backlog (Queue)?

A **backlog** (or job queue) is a buffer between your HTTP server and a slow or resource-intensive operation — in our case, calling the Gemini AI API.

### Without a queue (synchronous)
```
User → HTTP Request → Server calls Gemini → waits 2–8 s → Response
                                ↑
              If 100 users do this at once → server hangs / timeouts
```

### With a queue (asynchronous)
```
User → POST /api/chat/queue → Job added to Redis → 202 Accepted (instant)
                                      ↓
                Worker picks up job → calls Gemini → saves to MongoDB
                                      ↓
        User polls GET /api/chat/status/:jobId → gets result when ready
```

Benefits:
- ✅ Instant HTTP response (no waiting)
- ✅ Automatic retries on failure
- ✅ Concurrency control (no overload)
- ✅ Job prioritization
- ✅ Scalable to multiple workers

---

## 3. 🏗 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           UniBazzar Backend                             │
│                                                                         │
│  ┌──────────────┐    POST /api/chat/queue    ┌──────────────────────┐   │
│  │   Frontend   │ ─────────────────────────▶ │  chat.controller.js  │   │
│  │  (React)     │                            │  addChatJobController│   │
│  └──────────────┘                            └──────────┬───────────┘   │
│         │                                               │ addChatJob()  │
│         │ GET /api/chat/status/:jobId                   ▼               │
│         │ ◀────────────────────────────        ┌────────────────┐       │
│         │                                      │  chatQueue.js  │       │
│         │                                      │  (BullMQ Queue)│       │
│         │                                      └───────┬────────┘       │
│         │                                             │ Redis           │
│         │                               ╔═════════════╧══════════════╗  │
│         │                               ║         Redis Server        ║  │
│         │                               ║   (job storage + cache)     ║  │
│         │                               ╚═════════════╤══════════════╝  │
│         │                                             │                 │
│         │                                      ┌──────▼─────────┐       │
│         │                                      │  chatWorker.js  │       │
│         │                                      │  (BullMQ Worker)│       │
│         │                                      └──────┬──────────┘       │
│         │                                            │                  │
│         │                              ┌─────────────▼───────────────┐  │
│         │                              │        aiService.js          │  │
│         │                              │  Intent Detection → Gemini   │  │
│         │                              └─────────────┬───────────────┘  │
│         │                                           │                   │
│         │                                    ┌──────▼──────┐           │
│         └──────────────────────────────────▶ │  MongoDB    │           │
│                                              │  ChatLog    │           │
│                                              └─────────────┘           │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 4. 🛠 Tech Stack

| Technology    | Role                                      |
|---------------|-------------------------------------------|
| Node.js       | Runtime                                   |
| Express       | HTTP framework                            |
| BullMQ        | Job queue (producer + worker)             |
| ioredis       | Redis client for BullMQ                   |
| Redis         | Queue storage + response cache            |
| Google Gemini | AI language model                         |
| Mongoose      | MongoDB ODM for ChatLog persistence       |
| express-rate-limit | Per-IP rate limiting on queue route  |

---

## 5. 📦 Installation

### Prerequisites
- Node.js ≥ 18
- MongoDB (Atlas or local)
- Redis ≥ 6 (see section 6 below)

### Steps

```bash
# 1. Clone the repo
git clone <your-repo-url>
cd UniBazzar/ecommerce-backend

# 2. Install dependencies (includes bullmq + ioredis)
npm install

# 3. Copy and configure environment variables
cp .env.example .env
# Edit .env — set MONGO_URI, GEMINI_API_KEY, REDIS_URL, etc.

# 4. Start the server
npm run dev
```

---

## 6. 🔴 How to Run Redis

Redis is required for BullMQ to work. Choose one option:

### Option A — Local (Windows via WSL2)
```bash
# In WSL2 terminal:
sudo service redis-server start

# Verify it's running:
redis-cli ping   # Should respond: PONG
```

### Option B — Local (Windows via Docker)
```bash
docker run -d -p 6379:6379 --name redis redis:7-alpine
```

### Option C — Cloud (Free tier — Upstash)
1. Go to [upstash.com](https://upstash.com) → Create a Redis database
2. Copy the `rediss://...` URL
3. Set `REDIS_URL=rediss://:password@hostname:port` in `.env`

### Verify the connection
When you start the server you should see:
```
[redis] Connected to Redis successfully
[chatWorker] 🚀 Worker started. Queue: "chatbot-queue" | Concurrency: 5
```

---

## 7. ⚙️ How the Queue Works

### Request flow (step by step)

```
1. User sends POST /api/chat/queue  { "message": "show me cheap laptops" }
          │
2. addChatJobController validates message and calls addChatJob()
          │
3. chatQueue.add() stores the job in Redis with:
          { userId, message, timestamp }
          │
4. Server responds immediately: 202 Accepted { jobId: "42" }
          │
5. chatWorker (running in background) picks up the job
          │
6. Worker checks in-memory cache for same query (5-min TTL)
          │ (cache miss)
7. aiService.processMessage() runs:
   a. detectIntent()        → "product" intent
   b. searchProducts()      → MongoDB query
   c. generateGeminiReply() → Gemini API call
          │
8. Result saved to ChatLog (MongoDB) + cached in memory
          │
9. User polls GET /api/chat/status/42
          │
10. Controller checks BullMQ (Redis) → returns status + result
```

### Retry strategy
| Attempt | Delay  |
|---------|--------|
| 1st     | 2 s    |
| 2nd     | 4 s    |
| 3rd     | 8 s    |
| Final   | Job marked `failed`, error saved to MongoDB |

---

## 8. 📡 API Endpoints

### `POST /api/chat` *(legacy — synchronous)*
Kept for backwards compatibility. Blocks until AI responds.

```bash
curl -X POST http://localhost:5000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "hello"}'
```
```json
{ "type": "text", "reply": "Hello! I can help you find or sell items..." }
```

---

### `POST /api/chat/queue` *(async — recommended)*
Enqueues a chatbot message. Returns instantly.

**Request:**
```bash
curl -X POST http://localhost:5000/api/chat/queue \
  -H "Content-Type: application/json" \
  -d '{
    "message": "show me cheap laptops",
    "userId": "user_abc123",
    "priority": 1
  }'
```

**Body fields:**

| Field      | Type   | Required | Description                        |
|------------|--------|----------|------------------------------------|
| `message`  | string | ✅        | The user's chat message (max 2000 chars) |
| `userId`   | string | ❌        | Identify the user (defaults to `"anonymous"`) |
| `priority` | number | ❌        | Job priority: 1 = highest (optional) |

**Response `202 Accepted`:**
```json
{
  "success": true,
  "jobId": "42",
  "message": "Your message has been queued. Poll /api/chat/status/:jobId for the result."
}
```

**Rate limit:** 20 requests per minute per IP.

---

### `GET /api/chat/status/:jobId` *(poll for result)*
Returns the current status and result of a queued job.

```bash
curl http://localhost:5000/api/chat/status/42
```

**While processing:**
```json
{
  "success": true,
  "jobId": "42",
  "status": "active",
  "result": null,
  "error": null,
  "attemptsMade": 1,
  "timestamp": "2026-03-21T19:28:52.000Z"
}
```

**When completed:**
```json
{
  "success": true,
  "jobId": "42",
  "status": "completed",
  "result": {
    "type": "rag",
    "reply": "Here are 3 laptops that fit your budget:\n- MacBook Air (4500 ETB)...",
    "products": [
      {
        "id": "64abc...",
        "title": "MacBook Air M1",
        "price": 4500,
        "category": "Electronics",
        "condition": "Good",
        "imageUrl": "https://...",
        "link": "http://localhost:5173/products/64abc..."
      }
    ],
    "priceBand": "cheap"
  },
  "error": null
}
```

**Possible `status` values:**

| Status      | Meaning                                      |
|-------------|----------------------------------------------|
| `waiting`   | In the queue, not yet picked up              |
| `active`    | Worker is currently processing               |
| `completed` | Done — check `result`                        |
| `failed`    | All retries exhausted — check `error`        |
| `delayed`   | Waiting before retry (back-off)              |

---

## 9. 📁 Folder Structure

```
ecommerce-backend/
├── src/
│   ├── queue/
│   │   ├── chatQueue.js          # BullMQ Queue definition + addChatJob()
│   │   └── redisConnection.js    # Shared ioredis connection
│   │
│   ├── workers/
│   │   └── chatWorker.js         # BullMQ Worker — processes chatbot jobs
│   │
│   ├── services/
│   │   ├── aiService.js          # AI logic (intent + search + Gemini) for worker
│   │   └── gemini.service.js     # Raw Gemini API wrapper (unchanged)
│   │
│   ├── models/
│   │   ├── ChatLog.model.js      # MongoDB schema for persisted chat history
│   │   ├── Listing.model.js
│   │   ├── User.model.js
│   │   └── Review.model.js
│   │
│   ├── controllers/
│   │   └── chat.controller.js    # chatWithAssistant + addChatJobController + getJobStatusController
│   │
│   ├── routes/
│   │   └── chat.routes.js        # POST /queue + GET /status/:jobId + POST / (legacy)
│   │
│   ├── app.js
│   └── server.js                 # Bootstraps worker + graceful shutdown
│
├── .env                          # REDIS_URL, CHAT_QUEUE_CONCURRENCY, etc.
├── package.json
└── README-BACKLOG.md             # ← this file
```

---

## 10. 🚀 Scaling Strategy

### Horizontal Scaling (Multiple Workers)

The worker is decoupled from the HTTP server. To scale:

```
Process 1: node src/server.js     ← handles HTTP requests only
Process 2: node src/workerOnly.js ← runs only chatWorker (no HTTP)
Process 3: node src/workerOnly.js ← another worker instance
```

Create `src/workerOnly.js`:
```js
import dotenv from 'dotenv';
dotenv.config();
import connectDB from './config/db.js';
import { startChatWorker } from './workers/chatWorker.js';

connectDB().then(() => {
  startChatWorker();
  console.log('Worker-only process started');
});
```

### Using PM2 (process manager)
```bash
npm install -g pm2

# Start 1 HTTP server + 3 worker processes
pm2 start src/server.js    --name unibazzar-api
pm2 start src/workerOnly.js --name unibazzar-worker -i 3  # 3 instances
pm2 save
```

### Concurrency Control
```env
# In .env — tune based on your server's RAM and CPU
CHAT_QUEUE_CONCURRENCY=10
```

Each worker process handles up to `CHAT_QUEUE_CONCURRENCY` jobs simultaneously. With 3 worker processes × 10 concurrency = **30 parallel AI calls** without overloading a single process.

---

## 11. 🔮 Future Improvements

| Feature | Description |
|---|---|
| **WebSocket push** | Push job results to client via Socket.io instead of polling |
| **Redis pub/sub** | Worker publishes completion events; server pushes to frontend |
| **Bull Dashboard** | Add [@bull-board/express](https://github.com/felixmosh/bull-board) for a visual queue monitor |
| **Dead Letter Queue** | Route permanently failed jobs to a separate queue for manual review |
| **OpenAI fallback** | If Gemini fails, fall back to OpenAI GPT-4o-mini |
| **Persistent Redis cache** | Replace in-memory cache in worker with Redis `GET`/`SETEX` for cross-process caching |
| **Chat history** | Expose `GET /api/chat/history/:userId` to show past conversations from ChatLog |
| **Auth-gated queue** | Require JWT to use the async queue endpoint (VIP users get priority 1) |
| **Job progress** | Use `job.updateProgress()` to stream progress percentage back to the client |
