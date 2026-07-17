import { Router, type IRouter } from "express";
import healthRouter from "./health";
import rostersRouter from "./rosters";
import classificationsRouter from "./classifications";
import dayTypeConfigRouter from "./dayTypeConfig";
import employeesRouter from "./employees";
import eventsRouter from "./events";
import reportsRouter from "./reports";
import authRouter from "./auth";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(rostersRouter);
router.use(classificationsRouter);
router.use(dayTypeConfigRouter);
router.use(employeesRouter);
router.use(eventsRouter);
router.use(reportsRouter);
// Add auth routes last so they are matched after all resource routes
router.use("/auth", authRouter);
// Add admin routes after auth (for protected endpoints)
router.use("/admin", adminRouter);

export default router;
