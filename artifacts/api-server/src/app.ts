import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
import router from "./routes";
import { logger } from "./lib/logger";
import { authMiddleware } from "./middlewares/auth";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app: Express = express();

// Trust exactly one reverse-proxy hop (Nginx) so req.ip reflects the real
// client IP, without allowing X-Forwarded-For spoofing from further upstream.
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
// CORS configuration with environment-aware settings.
// - CORS_ORIGIN unset / empty / "*" -> allow any origin (origin: true)
// - CORS_ORIGIN "a.com, b.com"      -> whitelist exactly those origins
const corsOriginRaw = (process.env.CORS_ORIGIN ?? "").trim();
const corsWhitelist = corsOriginRaw
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const corsOrigin: boolean | string[] =
  corsOriginRaw === "" || corsOriginRaw === "*" || corsWhitelist.length === 0
    ? true
    : corsWhitelist;

app.use(cors({
  origin: corsOrigin,
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  exposedHeaders: ["RateLimit-*"],
  maxAge: 600, // Preflight cache duration in seconds
}));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Apply auth middleware globally so all routes can read req.userId / req.userRole
app.use(authMiddleware);

app.use("/api", router);

// Serve compiled static frontend files for non-API routes
const publicDir = path.resolve(__dirname, "../public");
app.use(express.static(publicDir, {
  index: false,
}));

// SPA wildcard redirect: serve index.html for any non-API route
// that isn't an existing file. This ensures client-side routing works.
app.use((_req, res) => {
  // Skip if it looks like an API route
  if (_req.path.startsWith("/api")) {
    return res.status(404).json({ message: "Not found" });
  }
  
  return res.sendFile(path.join(publicDir, "index.html"));
});

export default app;
