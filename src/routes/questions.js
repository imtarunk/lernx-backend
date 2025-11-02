import express from "express";
import { supabase } from "../utils/supabase.js";
import { verifyToken } from "../middleware/auth.js";

const router = express.Router({ mergeParams: true });

/**
 * GET /api/courses/:courseId/questions
 * Fetch questions for a specific course
 */
router.get("/", verifyToken, async (req, res, next) => {
  try {
    const { courseId } = req.params;
    console.log(`📝 Fetching questions for course ID: ${courseId}`);

    const { data, error } = await supabase
      .from("questions")
      .select("*")
      .eq("course_id", courseId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("❌ Error fetching questions:", error);
      throw error;
    }

    console.log(
      `✅ Retrieved ${data?.length || 0} questions for course ${courseId}`
    );
    res.json(data || []);
  } catch (error) {
    next(error);
  }
});

export default router;
