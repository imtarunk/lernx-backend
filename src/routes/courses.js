import express from "express";
import { supabase } from "../utils/supabase.js";

const router = express.Router();

/**
 * GET /api/courses
 * Fetch all courses
 */
router.get("/", async (req, res, next) => {
  try {
    console.log("📚 Fetching all courses...");
    const { data, error } = await supabase
      .from("courses")
      .select("*")
      .order("label", { ascending: true });

    if (error) {
      console.error("❌ Error fetching courses:", error);
      throw error;
    }

    console.log(`✅ Retrieved ${data?.length || 0} courses`);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

export default router;
