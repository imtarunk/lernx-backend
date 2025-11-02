import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables - look in backend directory
dotenv.config({ path: join(__dirname, "../.env") });

import express from "express";
import cors from "cors";
import coursesRoutes from "./routes/courses.js";
import questionsRoutes from "./routes/questions.js";
import answersRoutes from "./routes/answers.js";
import videosRoutes from "./routes/videos.js";
import { errorHandler } from "./middleware/errorHandler.js";

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json());

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// API Routes
app.use("/api/courses", coursesRoutes);
app.use("/api/courses/:courseId/questions", questionsRoutes);
app.use("/api/answers", answersRoutes);
app.use("/api/videos", videosRoutes);

// Error handling
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
