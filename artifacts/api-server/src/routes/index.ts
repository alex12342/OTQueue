import { Router, type IRouter } from "express";
import healthRouter from "./health";
import rostersRouter from "./rosters";
import classificationsRouter from "./classifications";
import dayTypeConfigRouter from "./dayTypeConfig";
import employeesRouter from "./employees";
import eventsRouter from "./events";
import reportsRouter from "./reports";

const router: IRouter = Router();

router.use(healthRouter);
router.use(rostersRouter);
router.use(classificationsRouter);
router.use(dayTypeConfigRouter);
router.use(employeesRouter);
router.use(eventsRouter);
router.use(reportsRouter);

export default router;
