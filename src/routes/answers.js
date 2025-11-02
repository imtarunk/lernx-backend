import express from "express";
import { supabase } from "../utils/supabase.js";
import { verifyToken } from "../middleware/auth.js";
import { body, validationResult } from "express-validator";

const router = express.Router();

/**
 * POST /api/answers
 * Record user answer and feedback
 */
router.post(
  "/",
  verifyToken,
  [
    body("question_id").notEmpty().withMessage("question_id is required"),
    body("selected_answer")
      .notEmpty()
      .withMessage("selected_answer is required"),
    body("is_correct").isBoolean().withMessage("is_correct must be a boolean"),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { question_id, selected_answer, is_correct } = req.body;
      const user_id = req.user.id;

      const { data, error } = await supabase
        .from("answers")
        .insert({
          user_id,
          question_id,
          selected_answer,
          is_correct,
        })
        .select()
        .single();

      if (error) throw error;

      res.status(201).json(data);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
