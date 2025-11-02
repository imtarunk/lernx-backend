import rateLimit from "express-rate-limit";

/**
 * Rate limiter for video generation endpoints
 */
export const videoGenerationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: "Too many video generation requests, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
});
