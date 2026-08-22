import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({
    status: "ok",
    version: process.env.VERSION || "dev",
    git_sha: process.env.GIT_SHA || "dev",
    build_date: process.env.BUILD_DATE || new Date().toISOString(),
  });
  res.json(data);
});

export default router;
