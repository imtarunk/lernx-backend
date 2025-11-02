import express from "express";
import WebSocket from "ws";
import { v4 as uuidv4 } from "uuid";
import { supabase } from "../utils/supabase.js";
import { verifyToken } from "../middleware/auth.js";
import { videoGenerationLimiter } from "../middleware/rateLimiter.js";
import { body, validationResult } from "express-validator";

const router = express.Router();

/**
 * Generate video using Knowlify WebSocket API
 */
async function generateVideoWithWebSocket(task, apiKey) {
  console.log("🎬 Starting video generation with Knowlify WebSocket API");
  console.log("Task preview:", task.substring(0, 100) + "...");

  return new Promise((resolve, reject) => {
    const wsUrl =
      "wss://50fa8sjxo9.execute-api.us-west-2.amazonaws.com/production";
    console.log("🔗 Connecting to WebSocket:", wsUrl);
    const ws = new WebSocket(wsUrl);

    const timeout = setTimeout(() => {
      console.error("⏱️ Video generation timeout after 3 minutes");
      ws.close();
      reject(new Error("Video generation timeout"));
    }, 180000); // 3 minute timeout for fast Grant API

    ws.on("open", () => {
      console.log("✅ WebSocket connection established");
      const payload = {
        action: "finetuned_live_gen", // Fast Grant API for quick generation
        task: task,
        api_key: apiKey,
      };
      console.log("📤 Sending payload to Knowlify Grant API");
      ws.send(JSON.stringify(payload));
    });

    ws.on("message", (data) => {
      try {
        const response = JSON.parse(data.toString());
        console.log("📨 Received message from Knowlify:");
        console.log("   Full response:", JSON.stringify(response, null, 2));

        if (response.type === "error") {
          console.error("❌ Knowlify API error:", response.message);
          clearTimeout(timeout);
          ws.close();
          reject(new Error(response.message || "Video generation failed"));
        } else if (response.link) {
          // Fast Grant API returns "link" field
          console.log("🎉 Video generation completed successfully!");
          console.log("🔗 Video URL:", response.link);
          console.log(
            "📄 Subtitle files:",
            response.vtt_link || response.srt_link
          );
          clearTimeout(timeout);
          ws.close();
          resolve(response.link);
        } else if (response.video_link && response.status === "completed") {
          // Prism API returns "video_link" field
          console.log("🎉 Video generation completed successfully!");
          console.log("🔗 Video URL:", response.video_link);
          clearTimeout(timeout);
          ws.close();
          resolve(response.video_link);
        } else if (response.percent !== undefined) {
          // Progress updates use "percent" field
          console.log(`📊 Progress: ${response.percent}%`);
        } else if (response.type === "progress") {
          console.log(
            `📊 Progress: ${response.progress}% - ${response.message || ""}`
          );
        } else if (response.message) {
          console.log("ℹ️ Status message:", response.message);
        }
      } catch (error) {
        console.error("❌ Error parsing WebSocket message:", error);
        console.error("Raw message:", data.toString());
      }
    });

    ws.on("error", (error) => {
      console.error("❌ WebSocket error:", error.message);
      clearTimeout(timeout);
      reject(new Error(`WebSocket error: ${error.message}`));
    });

    ws.on("close", () => {
      console.log("🔌 WebSocket connection closed");
      clearTimeout(timeout);
    });
  });
}

/**
 * POST /api/videos
 * Generate video via Knowlify API
 */
router.post(
  "/",
  verifyToken,
  videoGenerationLimiter,
  [
    body("question_id").notEmpty().withMessage("question_id is required"),
    body("prompt").optional().isString(),
  ],
  async (req, res, next) => {
    try {
      console.log("🎥 Video generation request received");
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.error("❌ Validation errors:", errors.array());
        return res.status(400).json({ errors: errors.array() });
      }

      const { question_id, prompt } = req.body;
      const user_id = req.user.id;
      console.log("👤 User ID:", user_id);
      console.log("📝 Question ID:", question_id);
      console.log("💬 Custom prompt:", prompt || "Using default prompt");

      // Fetch question details
      console.log("🔍 Fetching question details from database...");
      const { data: question, error: questionError } = await supabase
        .from("questions")
        .select("*")
        .eq("id", question_id)
        .single();

      if (questionError || !question) {
        console.error("❌ Question not found:", questionError);
        return res.status(404).json({ error: "Question not found" });
      }
      console.log(
        "✅ Question found:",
        question.question_text.substring(0, 50) + "..."
      );

      // Prepare prompt for Knowlify API
      const knowlifyPrompt =
        prompt ||
        `Explain how to solve this SAT math question: ${
          question.question_text
        }. The correct answer is ${question.correct_answer}. ${
          question.explanation
            ? `Additional context: ${question.explanation}`
            : ""
        }`;

      // Call Knowlify API
      const knowlifyApiKey = process.env.KNOWLIFY_API_KEY;
      if (!knowlifyApiKey) {
        console.error("❌ KNOWLIFY_API_KEY not configured");
        return res
          .status(500)
          .json({ error: "Video generation service not configured" });
      }
      console.log("🔑 Knowlify API key configured");

      try {
        // Generate video using Knowlify WebSocket API
        console.log("🚀 Initiating video generation...");
        const videoUrl = await generateVideoWithWebSocket(
          knowlifyPrompt,
          knowlifyApiKey
        );

        if (!videoUrl) {
          console.error("❌ No video URL returned from Knowlify");
          return res
            .status(500)
            .json({ error: "Invalid response from video generation service" });
        }
        console.log("✅ Video generated successfully, URL:", videoUrl);

        // Generate share token
        const shareToken = uuidv4();
        console.log("🔑 Generated share token:", shareToken);

        // Store video in database
        console.log("💾 Storing video metadata in database...");
        const { data: video, error: videoError } = await supabase
          .from("videos")
          .insert({
            user_id,
            question_id,
            video_url: videoUrl,
            prompt: prompt || null,
            share_token: shareToken,
          })
          .select()
          .single();

        if (videoError) {
          console.error("❌ Error storing video:", videoError);
          throw videoError;
        }

        console.log("✅ Video stored successfully with ID:", video.id);
        res.status(201).json(video);
      } catch (knowlifyError) {
        console.error("❌ Knowlify API error:", knowlifyError.message);
        console.error("Stack trace:", knowlifyError.stack);
        return res.status(500).json({
          error: "Failed to generate video. Please try again later.",
        });
      }
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/videos
 * Get user's videos
 */
router.get("/", verifyToken, async (req, res, next) => {
  try {
    const user_id = req.user.id;

    const { data, error } = await supabase
      .from("videos")
      .select("*")
      .eq("user_id", user_id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json(data || []);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/videos/:id
 * Get a specific video (only owner)
 */
router.get("/:id", verifyToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    const user_id = req.user.id;

    const { data, error } = await supabase
      .from("videos")
      .select("*")
      .eq("id", id)
      .eq("user_id", user_id)
      .single();

    if (error || !data) {
      return res
        .status(404)
        .json({ error: "Video not found or access denied" });
    }

    res.json(data);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/videos/share/:token
 * Get video by share token (public access)
 */
router.get("/share/:token", async (req, res, next) => {
  try {
    const { token } = req.params;

    const { data, error } = await supabase
      .from("videos")
      .select("*")
      .eq("share_token", token)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: "Video not found" });
    }

    res.json(data);
  } catch (error) {
    next(error);
  }
});

export default router;
