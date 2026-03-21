# UniBazzar Backend API

This is a production-ready Node.js, Express, and MongoDB backend for the UniBazzar (ግቢ Bazzar) campus marketplace platform.

## Architecture

The backend follows an MVC-like, scalable folder structure:

- **`src/app.js`**: Express app configuration, middleware definitions (CORS, Helmet, Rate Limiter), and main route mounting.
- **`src/server.js`**: Server initialization and MongoDB connection wrapper.
- **`src/config/db.js`**: Mongoose connection logic.
- **`src/models/`**: Mongoose database schemas (User, Listing, Review).
- **`src/controllers/`**: Core API logic/handlers.
- **`src/routes/`**: Express routers, defining RESTful endpoints.
- **`src/middlewares/`**: Custom middlewares for authentication (JWT), error handling, multer file uploads, and express-validators.

## Security Features

- **JWT Authentication**: Password hashing (bcrypt) and stateless session tokens.
- **Helmet**: Secures HTTP headers to protect against common web vulnerabilities.
- **CORS**: Configured to accept requests only from the frontend (`CLIENT_URL`).
- **Rate Limiting**: Defends against brute-force attacks by limiting IP request counts.
- **Input Validation**: `express-validator` verifies expected input formats before hitting controllers.
- **Global Error Handling**: Prevents app crashes and format errors securely (obscuring stack traces in production).

## Setup & Running Locally

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Environment Variables:**
   Ensure you have a `.env` file at the root of `ecommerce-backend/`. Example:
   ```env
   NODE_ENV=development
   PORT=5000
   MONGO_URI=mongodb://127.0.0.1:27017/unibazzar
   JWT_SECRET=your_super_secret_jwt_key_here_change_in_production
   JWT_EXPIRE=30d
   CLIENT_URL=http://localhost:5173
   ```

3. **Start MongoDB:**
   Make sure your local MongoDB instance is running, or replace `MONGO_URI` with a MongoDB Atlas connection string.

4. **Run Server:**
   ```bash
   # Development mode (auto-restart)
   npm run dev

   # Production mode
   npm start
   ```

## Connecting Frontend to Backend

1. In your frontend directory (`ecommerce-frontend`), find or create the `.env` file (or `.env.local` for Vite).
2. Set the API URL to point to this backend:
   ```env
   VITE_API_URL=http://localhost:5000
   ```
3. Look at `src/constants/api.js` in the frontend codebase. Verify these endpoint strings match the routes exposed by this backend.
4. The frontend's `src/lib/axios.js` is already configured to read from `VITE_API_URL` and send the JWT Bearer token on protected routes.
