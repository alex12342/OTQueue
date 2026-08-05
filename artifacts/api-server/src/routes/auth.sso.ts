import { Router } from "express";

const router = Router();

// ── SSO status endpoint (public, no auth required) ───────────────────────────
// Mounted at /api/sso-enabled, before auth middleware so unauthenticated
// clients (e.g. the login page) can query whether SSO is enabled.

const ssoEnabled = process.env.SSO_ENABLED === "true";

router.get("/", (_req, res) => {
  return res.json({ enabled: ssoEnabled });
});

export default router;
