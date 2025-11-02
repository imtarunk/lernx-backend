import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables - look in backend directory
// Use .env.production if NODE_ENV is production, otherwise use .env
const envFile =
  process.env.NODE_ENV === "production"
    ? join(__dirname, "../../.env.production")
    : join(__dirname, "../../.env");

dotenv.config({ path: envFile });
