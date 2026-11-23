/**
 * Admin backup & restore endpoints (mounted at /api/admin/backups).
 *
 * A backup archive is a tar.gz containing:
 *   manifest.json    — format version, app version, timestamps, per-file sha256
 *   database.dump    — pg_dump -Fc custom-format dump of the otqueue database
 *   data/...         — every file under DATA_DIR (recursively) EXCEPT the live
 *                      postgres cluster dir, the backups dir and staging dirs.
 *                      This captures .jwt-secret, sso-whitelist.json,
 *                      sso-pending-codes.json and any future data files.
 *
 * The raw PGDATA directory is deliberately NOT copied: a hot copy of a running
 * cluster is corrupt. The logical dump captures the same data consistently,
 * and entrypoint.sh regenerates the cluster config on every boot anyway.
 *
 * Restore semantics mirror the manual "replace the whole /app/data directory"
 * workflow, but safely: the dump is first restored into a temp database and
 * verified, then swapped in atomically; data files are replaced exactly (files
 * not present in the archive are deleted). A pre-restore safety backup is taken
 * automatically before anything destructive happens. After a successful
 * restore the API exits so Docker's restart policy reboots the container —
 * entrypoint.sh then re-runs migrate + schema verification against the
 * restored database and reloads the restored JWT secret.
 */
import { Router, type IRouter, type Response } from "express";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { Pool } from "pg";
import { adminAuthMiddleware, type AuthRequest } from "../middlewares/auth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// ── Configuration ────────────────────────────────────────────────────────────

const DATA_DIR = process.env.DATA_DIR || "/app/data";
const BACKUP_DIR = path.join(DATA_DIR, "backups");
// Staging lives inside the data volume so renames stay on one filesystem.
const STAGING_ROOT = path.join(DATA_DIR, ".backup-staging");

/** Top-level entries of DATA_DIR that are never captured in an archive. */
const EXCLUDED_TOP = new Set(["postgres", "backups", ".backup-staging"]);

/** Canonical backup filename — doubles as the only accepted name on restore. */
const BACKUP_NAME_RE =
  /^otqueue-backup-(auto|manual|pre-restore)-(\d{8}T\d{6}Z)-[0-9a-f]{4}\.tar\.gz$/;

function envInt(name: string, fallback: number): number {
  const v = parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

const MAX_UPLOAD_MB = envInt("BACKUP_MAX_UPLOAD_MB", 2048);
const KEEP_AUTO = envInt("BACKUP_KEEP_AUTO", 5);

type BackupKind = "auto" | "manual" | "pre-restore";

interface ManifestFile {
  path: string; // relative to the archive root, e.g. "database.dump" or "data/.jwt-secret"
  sha256: string;
  size: number;
}

interface Manifest {
  formatVersion: number;
  appVersion: string;
  gitSha: string;
  createdAt: string; // ISO
  pgDatabase: string;
  files: ManifestFile[];
}

interface BackupMeta {
  name: string;
  kind: BackupKind;
  createdAt: string; // ISO
  appVersion?: string;
  sizeBytes: number;
  sha256: string;
  fileCount: number;
  originalName?: string;
}

// ── Small helpers ────────────────────────────────────────────────────────────

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Serialize backup/restore operations — only one may run at a time. */
type ActiveOp = BackupKind | "upload" | "restore";
let activeOp: ActiveOp | null = null;
async function withLock<T>(kind: ActiveOp, fn: () => Promise<T>): Promise<T> {
  if (activeOp) {
    throw new HttpError(409, `Another ${activeOp} operation is already in progress`);
  }
  activeOp = kind;
  try {
    return await fn();
  } finally {
    activeOp = null;
  }
}

function compactTs(d: Date): string {
  // 20261121T031500Z — parseable back to an epoch via parseCompactTs()
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function parseCompactTs(s: string): number | null {
  const m = s.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (!m) return null;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
}

function backupName(kind: BackupKind): string {
  const rand = crypto.randomBytes(2).toString("hex");
  return `otqueue-backup-${kind}-${compactTs(new Date())}-${rand}.tar.gz`;
}

/** Validate a :file param against the canonical pattern (blocks traversal). */
function assertBackupName(name: string): BackupKind {
  const m = BACKUP_NAME_RE.exec(name);
  if (!m) throw new HttpError(400, `Invalid backup filename: ${name}`);
  return m[1] as BackupKind;
}

async function sha256File(file: string): Promise<string> {
  const hash = crypto.createHash("sha256");
  await new Promise<void>((resolve, reject) => {
    const s = fs.createReadStream(file);
    s.on("error", reject);
    s.on("data", (c) => hash.update(c));
    s.on("end", () => resolve());
  });
  return hash.digest("hex");
}

function run(cmd: string, args: string[], opts?: { env?: NodeJS.ProcessEnv }): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"], ...opts });
    let stderr = "";
    child.stderr.on("data", (c) => {
      stderr += c.toString();
      if (stderr.length > 64 * 1024) stderr = stderr.slice(-32 * 1024); // bound memory
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${path.basename(cmd)} exited with code ${code}: ${stderr.trim().slice(-500)}`));
    });
  });
}

/** Resolve a postgres client binary: versioned path first, PATH as fallback. */
function pgBin(name: string): string {
  const base = "/usr/lib/postgresql";
  try {
    for (const v of fs.readdirSync(base).sort().reverse()) {
      const p = path.join(base, v, "bin", name);
      if (fs.existsSync(p)) return p;
    }
  } catch {
    /* fall through to PATH */
  }
  return name;
}

interface PgConn {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

function pgParams(overrideDb?: string): PgConn {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new HttpError(500, "DATABASE_URL is not configured");
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new HttpError(500, "DATABASE_URL is not a valid URL");
  }
  return {
    host: url.hostname || "localhost",
    port: url.port ? Number(url.port) : 5432,
    user: decodeURIComponent(url.username || "postgres"),
    password: decodeURIComponent(url.password || ""),
    database: overrideDb ?? (decodeURIComponent(url.pathname.replace(/^\//, "")) || "otqueue"),
  };
}

/** Recursively list regular files under DATA_DIR (relative paths), skipping
 *  the live cluster / backups / staging dirs and symlinks. */
async function listDataFiles(): Promise<string[]> {
  const out: string[] = [];
  async function walk(dir: string, rel: string) {
    let entries: fs.Dirent[];
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true });
    } catch {
      return; // DATA_DIR may not exist yet on a fresh volume
    }
    for (const e of entries) {
      const relPath = rel ? `${rel}/${e.name}` : e.name;
      if (!rel && EXCLUDED_TOP.has(e.name)) continue;
      if (e.isDirectory()) {
        await walk(path.join(dir, e.name), relPath);
      } else if (e.isFile()) {
        out.push(relPath);
      }
    }
  }
  await walk(DATA_DIR, "");
  return out.sort();
}

// ── Archive validation ───────────────────────────────────────────────────────

/** Assert every extracted path stays inside `root` (tar-slip guard). */
function assertWithin(root: string, target: string) {
  const resolved = path.resolve(target);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new HttpError(400, "Archive contains an unsafe file path");
  }
}

async function extractArchive(archivePath: string, destDir: string): Promise<void> {
  await fsp.mkdir(destDir, { recursive: true });
  // GNU tar strips leading '/' and refuses '..' members by default; the exit
  // code plus assertWithin() below catch anything else.
  await run("tar", ["xzf", archivePath, "-C", destDir]);
}

/** Verify manifest + per-file checksums of an extracted archive directory. */
async function validateExtracted(stagingDir: string): Promise<Manifest> {
  const root = path.resolve(stagingDir);
  let manifestRaw: string;
  try {
    manifestRaw = await fsp.readFile(path.join(root, "manifest.json"), "utf8");
  } catch {
    throw new HttpError(400, "Archive is missing manifest.json — not an OTQueue backup");
  }
  let manifest: Manifest;
  try {
    manifest = JSON.parse(manifestRaw);
  } catch {
    throw new HttpError(400, "manifest.json is not valid JSON");
  }
  if (manifest.formatVersion !== 1 || !Array.isArray(manifest.files)) {
    throw new HttpError(400, `Unsupported backup format version: ${String(manifest.formatVersion)}`);
  }

  // Walk the extracted tree first — reject any path escaping staging.
  async function walk(dir: string) {
    for (const e of await fsp.readdir(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      assertWithin(root, p);
      if (e.isDirectory()) await walk(p);
    }
  }
  await walk(root);

  let sawDump = false;
  for (const f of manifest.files) {
    const abs = path.join(root, f.path);
    assertWithin(root, abs);
    let stat: fs.Stats;
    try {
      stat = await fsp.stat(abs);
    } catch {
      throw new HttpError(400, `Archive is missing ${f.path}`);
    }
    if (stat.size !== f.size) {
      throw new HttpError(400, `Checksum validation failed for ${f.path} (size mismatch)`);
    }
    const hash = await sha256File(abs);
    if (hash !== f.sha256) {
      throw new HttpError(400, `Checksum validation failed for ${f.path}`);
    }
    if (f.path === "database.dump") sawDump = true;
  }
  if (!sawDump) throw new HttpError(400, "Archive is missing database.dump");
  return manifest;
}

// ── Backup creation ──────────────────────────────────────────────────────────

async function createBackupInternal(kind: BackupKind): Promise<BackupMeta> {
  const conn = pgParams();
  const name = backupName(kind);
  const stagingDir = path.join(STAGING_ROOT, name.replace(/\.tar\.gz$/, ""));
  await fsp.mkdir(path.join(stagingDir, "data"), { recursive: true });

  try {
    // 1. Logical dump of the database (consistent snapshot while running).
    const dumpPath = path.join(stagingDir, "database.dump");
    await new Promise<void>((resolve, reject) => {
      const child = spawn(
        pgBin("pg_dump"),
        ["-Fc", "-h", conn.host, "-p", String(conn.port), "-U", conn.user, "-d", conn.database],
        { stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, PGPASSWORD: conn.password } },
      );
      const out = fs.createWriteStream(dumpPath);
      let stderr = "";
      child.stderr.on("data", (c) => (stderr += c.toString()));
      child.stdout.pipe(out);

      // Await BOTH the child's exit and the file stream finishing — checking
      // exitCode from either event alone races against the other.
      let childCode: number | null = null;
      let childSignal: NodeJS.Signals | null = null;
      let childDone = false;
      let outDone = false;
      const finish = () => {
        if (!childDone || !outDone) return;
        if (childCode === 0) resolve();
        else reject(new Error(`pg_dump exited with code ${String(childCode)}${childSignal ? ` (signal ${childSignal})` : ""}: ${stderr.slice(-500)}`));
      };
      child.on("error", reject);
      out.on("error", reject);
      child.on("close", (code, signal) => {
        childCode = code;
        childSignal = signal;
        childDone = true;
        finish();
      });
      out.on("finish", () => {
        outDone = true;
        finish();
      });
    });

    // 2. Copy every non-PGDATA data file into the archive's data/ tree.
    const dataFiles = await listDataFiles();
    for (const rel of dataFiles) {
      const dest = path.join(stagingDir, "data", rel);
      await fsp.mkdir(path.dirname(dest), { recursive: true });
      await fsp.copyFile(path.join(DATA_DIR, rel), dest);
    }

    // 3. Manifest with checksums over the staged copies.
    const files: ManifestFile[] = [];
    for (const p of ["database.dump", ...dataFiles.map((r) => `data/${r}`)]) {
      const abs = path.join(stagingDir, p);
      const stat = await fsp.stat(abs);
      files.push({ path: p, sha256: await sha256File(abs), size: stat.size });
    }
    const manifest: Manifest = {
      formatVersion: 1,
      appVersion: process.env.VERSION || "dev",
      gitSha: process.env.GIT_SHA || "dev",
      createdAt: new Date().toISOString(),
      pgDatabase: conn.database,
      files,
    };
    await fsp.writeFile(path.join(stagingDir, "manifest.json"), JSON.stringify(manifest, null, 2));

    // 4. Pack the archive straight into BACKUP_DIR (same volume → atomic-ish).
    await fsp.mkdir(BACKUP_DIR, { recursive: true });
    const archivePath = path.join(BACKUP_DIR, name);
    await run("tar", ["czf", archivePath, "-C", stagingDir, "manifest.json", "database.dump", "data"]);

    // 5. Sidecar metadata for fast listing.
    const stat = await fsp.stat(archivePath);
    const meta: BackupMeta = {
      name,
      kind,
      createdAt: manifest.createdAt,
      appVersion: manifest.appVersion,
      sizeBytes: stat.size,
      sha256: await sha256File(archivePath),
      fileCount: files.length,
    };
    await fsp.writeFile(`${archivePath}.meta.json`, JSON.stringify(meta, null, 2));
    return meta;
  } finally {
    await fsp.rm(stagingDir, { recursive: true, force: true });
  }
}

// ── Listing / pruning ────────────────────────────────────────────────────────

async function listBackups(): Promise<BackupMeta[]> {
  let names: string[];
  try {
    names = (await fsp.readdir(BACKUP_DIR)).filter((n) => n.endsWith(".tar.gz"));
  } catch {
    return []; // no backups dir yet
  }
  const metas: BackupMeta[] = [];
  for (const name of names) {
    if (!BACKUP_NAME_RE.test(name)) continue; // ignore foreign files
    try {
      const sidecar = await fsp.readFile(path.join(BACKUP_DIR, `${name}.meta.json`), "utf8");
      metas.push(JSON.parse(sidecar) as BackupMeta);
    } catch {
      // No/invalid sidecar (e.g. hand-copied file): derive from name + stat.
      const m = BACKUP_NAME_RE.exec(name)!;
      const stat = await fsp.stat(path.join(BACKUP_DIR, name)).catch(() => null);
      const ts = parseCompactTs(m[2]);
      metas.push({
        name,
        kind: m[1] as BackupKind,
        createdAt: ts ? new Date(ts).toISOString() : (stat?.mtime.toISOString() ?? ""),
        sizeBytes: stat?.size ?? 0,
        sha256: "",
        fileCount: 0,
      });
    }
  }
  return metas.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
}

async function pruneAutoBackups(): Promise<number> {
  const auto = (await listBackups()).filter((b) => b.kind === "auto");
  let removed = 0;
  for (const stale of auto.slice(KEEP_AUTO)) {
    await fsp.rm(path.join(BACKUP_DIR, stale.name), { force: true });
    await fsp.rm(path.join(BACKUP_DIR, `${stale.name}.meta.json`), { force: true });
    removed++;
  }
  return removed;
}

// ── Restore ──────────────────────────────────────────────────────────────────

async function restoreBackupInternal(name: string): Promise<void> {
  const archivePath = path.join(BACKUP_DIR, name);
  const stagingDir = path.join(STAGING_ROOT, `restore-${crypto.randomBytes(4).toString("hex")}`);

  try {
    // 1. Extract + fully validate before touching anything live.
    await extractArchive(archivePath, stagingDir);
    const manifest = await validateExtracted(stagingDir);

    // 2. Automatic safety backup of the CURRENT state (never auto-pruned).
    logger.info({ event: "backup.pre_restore_start", file: name }, "Creating pre-restore safety backup");
    await createBackupInternal("pre-restore");

    const conn = pgParams();
    const tmpDb = `otqueue_r_${Date.now().toString(36)}`;
    const oldDb = `otqueue_old_${Date.now().toString(36)}`;
    const maint = new Pool({ ...pgParams("postgres"), max: 1 });

    try {
      // 3. Restore the dump into a temp database and verify it.
      await maint.query(`CREATE DATABASE ${tmpDb} OWNER ${conn.user}`);
      try {
        await run(
          pgBin("pg_restore"),
          [
            "--single-transaction",
            "--exit-on-error",
            "-h", conn.host, "-p", String(conn.port), "-U", conn.user, "-d", tmpDb,
            path.join(stagingDir, "database.dump"),
          ],
          { env: { ...process.env, PGPASSWORD: conn.password } },
        );

        // Cross-database queries aren't possible — verify via a dedicated pool.
        const tmpPool = new Pool({ ...pgParams(tmpDb), max: 1 });
        try {
          const m = await tmpPool.query("SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations");
          if (m.rows[0].n < 1) throw new Error("restored database has no migration history");
          const t = await tmpPool.query(
            "SELECT to_regclass('public.users') IS NOT NULL AND to_regclass('public.rosters') IS NOT NULL AS ok",
          );
          if (!t.rows[0].ok) throw new Error("restored database is missing core tables");
        } finally {
          await tmpPool.end();
        }

        // 4. Atomic swap: terminate app connections, rename live → old, temp → live.
        let swapped = false;
        for (let attempt = 1; attempt <= 5 && !swapped; attempt++) {
          await maint.query(
            "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()",
            [conn.database],
          );
          try {
            await maint.query(`ALTER DATABASE ${conn.database} RENAME TO ${oldDb}`);
            swapped = true;
          } catch {
            if (attempt === 5) throw new Error("could not acquire exclusive access to the live database");
            await new Promise((r) => setTimeout(r, 300));
          }
        }

        try {
          await maint.query(`ALTER DATABASE ${tmpDb} RENAME TO ${conn.database}`);
        } catch (err) {
          // Roll back the first rename so the live database is usable again.
          logger.error({ err, event: "backup.restore_swap_failed" }, "Restore swap failed — rolling back");
          await maint.query(`ALTER DATABASE ${oldDb} RENAME TO ${conn.database}`).catch(() => {});
          throw new HttpError(500, "Database swap failed; the live database was restored to its previous state.");
        }

        // 5. The pre-restore archive is the recovery path for the old DB — drop it.
        await maint.query(`DROP DATABASE IF EXISTS ${oldDb} WITH (FORCE)`).catch((e) => {
          logger.warn({ err: e, db: oldDb }, "Could not drop the replaced database — remove it manually");
        });
      } catch (err) {
        // Temp DB never went live; clean it up and abort with the live DB untouched.
        await maint.query(`DROP DATABASE IF EXISTS ${tmpDb} WITH (FORCE)`).catch(() => {});
        throw err;
      }
    } finally {
      await maint.end();
    }

    // 6. Replace data files exactly as backed up (mirror the manual workflow):
    //    overwrite with archive contents, then delete live files absent from it.
    const backupDataFiles = new Set(
      manifest.files.filter((f) => f.path.startsWith("data/")).map((f) => f.path.slice("data/".length)),
    );
    for (const rel of backupDataFiles) {
      const src = path.join(stagingDir, "data", rel);
      const dest = path.join(DATA_DIR, rel);
      await fsp.mkdir(path.dirname(dest), { recursive: true });
      await fsp.copyFile(src, dest);
    }
    for (const live of await listDataFiles()) {
      if (!backupDataFiles.has(live)) {
        await fsp.rm(path.join(DATA_DIR, live), { force: true }).catch(() => {});
      }
    }

    logger.info(
      { event: "backup.restore_done", file: name, filesRestored: backupDataFiles.size },
      "Restore completed — container restart required (JWT secret reloaded at boot)",
    );
  } finally {
    await fsp.rm(stagingDir, { recursive: true, force: true });
  }
}

// ── Scheduler (daily automatic backups + prune) ──────────────────────────────

/**
 * Creates one backup per day at BACKUP_DAILY_AT (UTC "HH:MM", default 03:15;
 * set to "none" to disable). An hourly tick also catches up when the container
 * was down during the scheduled slot. Automatic backups are pruned to the
 * newest KEEP_AUTO (default 5); manual and pre-restore backups are kept until
 * an admin deletes them.
 */
export function startBackupScheduler(): void {
  const spec = (process.env.BACKUP_DAILY_AT ?? "03:15").trim().toLowerCase();
  if (spec === "" || ["none", "off", "disabled"].includes(spec)) {
    logger.info({ event: "backup.scheduler_disabled" }, "Automatic daily backups disabled");
    return;
  }
  const m = /^(\d{1,2}):(\d{2})$/.exec(spec);
  if (!m || +m[1] > 23 || +m[2] > 59) {
    logger.warn({ spec }, "BACKUP_DAILY_AT is invalid — automatic backups disabled");
    return;
  }
  const [hh, mm] = [+m[1], +m[2]];

  const tick = async () => {
    try {
      const now = new Date();
      // Most recent scheduled slot at or before "now" (UTC).
      let slot = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hh, mm);
      if (slot > now.getTime()) slot -= 24 * 60 * 60 * 1000;

      const latestAuto = (await listBackups()).find((b) => b.kind === "auto");
      const latestTs = latestAuto ? Date.parse(latestAuto.createdAt) : 0;
      if (latestTs >= slot) return; // this day's backup already exists

      await withLock("auto", async () => {
        const meta = await createBackupInternal("auto");
        const pruned = await pruneAutoBackups();
        logger.info(
          { event: "backup.auto_created", file: meta.name, sizeBytes: meta.sizeBytes, pruned },
          `Daily automatic backup created (pruned ${pruned} old)`,
        );
      });
    } catch (err: any) {
      if (err?.status === 409) return; // another operation is running — next tick retries
      logger.error({ err, event: "backup.auto_failed" }, "Automatic backup failed");
    }
  };

  // First check shortly after boot (catch-up), then hourly.
  setTimeout(() => void tick(), 30_000).unref();
  setInterval(() => void tick(), 60 * 60 * 1000).unref();
}

// ── Routes (all admin-only) ──────────────────────────────────────────────────

router.use(adminAuthMiddleware);

function audit(req: AuthRequest, event: string, extra: Record<string, unknown> = {}) {
  logger.info({ event, actor: req.userId, email: req.userEmail, ...extra }, `admin ${event}`);
}

/** Express 5 types params as string | string[]; coerce + validate centrally. */
function paramFile(req: AuthRequest): string {
  const raw = req.params.file;
  const name = Array.isArray(raw) ? raw[0] : String(raw ?? "");
  assertBackupName(name);
  return name;
}

// GET /api/admin/backups — list backups + whether an operation is running
router.get("/", async (_req: AuthRequest, res: Response) => {
  try {
    return res.json({ backups: await listBackups(), activeOperation: activeOp });
  } catch (err) {
    logger.error({ err }, "backup list failed");
    return res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/admin/backups — create a manual backup now
router.post("/", async (req: AuthRequest, res: Response) => {
  try {
    const meta = await withLock("manual", () => createBackupInternal("manual"));
    audit(req, "backup.created", { file: meta.name, sizeBytes: meta.sizeBytes });
    return res.status(201).json(meta);
  } catch (err: any) {
    if (err instanceof HttpError) return res.status(err.status).json({ message: err.message });
    logger.error({ err }, "backup creation failed");
    return res.status(500).json({ message: `Backup failed: ${err?.message ?? "internal error"}` });
  }
});

// GET /api/admin/backups/upload-capacity — upload limit for the UI
router.get("/upload-capacity", (_req: AuthRequest, res: Response) => {
  return res.json({ maxUploadMb: MAX_UPLOAD_MB, keepAuto: KEEP_AUTO });
});

// PUT /api/admin/backups/upload?name=<original>.tar.gz — upload an archive.
// The request body is the raw octet-stream file (streamed to disk, never buffered).
router.put("/upload", async (req: AuthRequest, res: Response) => {
  const partPath = path.join(STAGING_ROOT, `upload-${crypto.randomBytes(4).toString("hex")}.part`);
  try {
    await fsp.mkdir(STAGING_ROOT, { recursive: true });

    // Stream the body to disk with a hard size cap.
    const maxBytes = MAX_UPLOAD_MB * 1024 * 1024;
    let received = 0;
    await new Promise<void>((resolve, reject) => {
      const ws = fs.createWriteStream(partPath);
      req.on("data", (chunk: Buffer) => {
        received += chunk.length;
        if (received > maxBytes) {
          req.destroy();
          reject(new HttpError(413, `Upload exceeds the ${MAX_UPLOAD_MB} MB limit`));
        }
      });
      req.pipe(ws);
      ws.on("finish", () => resolve());
      ws.on("error", reject);
      req.on("error", (e: Error) => reject(new HttpError(400, `Upload failed: ${e.message}`)));
    });

    // Must at least be a gzip stream.
    const fd = await fsp.open(partPath, "r");
    try {
      const buf = Buffer.alloc(2);
      await fd.read(buf, 0, 2, 0);
      if (buf[0] !== 0x1f || buf[1] !== 0x8b) {
        throw new HttpError(400, "Uploaded file is not a gzip archive (.tar.gz)");
      }
    } finally {
      await fd.close();
    }

    // Extract + validate fully before registering it.
    const stagingDir = path.join(STAGING_ROOT, `upload-${crypto.randomBytes(4).toString("hex")}`);
    try {
      await extractArchive(partPath, stagingDir);
      await validateExtracted(stagingDir);
    } finally {
      await fsp.rm(stagingDir, { recursive: true, force: true });
    }

    // Register under a canonical name; keep the original for display.
    const rawName = String(req.query.name ?? req.header("x-backup-filename") ?? "");
    const base = path.basename(rawName);
    const originalName = /\.(tar\.gz|tgz)$/i.test(base) && base.length <= 200 ? base : undefined;

    await fsp.mkdir(BACKUP_DIR, { recursive: true });
    const name = backupName("manual");
    const archivePath = path.join(BACKUP_DIR, name);
    await fsp.rename(partPath, archivePath);

    const stat = await fsp.stat(archivePath);
    const meta: BackupMeta = {
      name,
      kind: "manual",
      createdAt: new Date().toISOString(),
      sizeBytes: stat.size,
      sha256: await sha256File(archivePath),
      fileCount: 0, // not re-hashed per-file; the validation above already checked them
      ...(originalName ? { originalName } : {}),
    };
    await fsp.writeFile(`${archivePath}.meta.json`, JSON.stringify(meta, null, 2));

    audit(req, "backup.uploaded", { file: name, originalName, sizeBytes: stat.size });
    return res.status(201).json(meta);
  } catch (err: any) {
    await fsp.rm(partPath, { force: true });
    if (err instanceof HttpError) return res.status(err.status).json({ message: err.message });
    logger.error({ err }, "backup upload failed");
    return res.status(500).json({ message: `Upload failed: ${err?.message ?? "internal error"}` });
  }
});

// GET /api/admin/backups/:file/download — stream the archive to the admin
router.get("/:file/download", async (req: AuthRequest, res: Response) => {
  try {
    const name = paramFile(req);
    const abs = path.join(BACKUP_DIR, name);
    if (!fs.existsSync(abs)) return res.status(404).json({ message: "Backup not found" });
    audit(req, "backup.downloaded", { file: name });
    return new Promise<Response>((resolve, reject) => {
      res.download(abs, name, (err) => (err ? reject(err) : resolve(res)));
    }).catch((err) => {
      logger.error({ err }, "backup download failed");
    });
  } catch (err: any) {
    if (err instanceof HttpError) return res.status(err.status).json({ message: err.message });
    logger.error({ err }, "backup download failed");
    return res.status(500).json({ message: "Internal server error" });
  }
});

// DELETE /api/admin/backups/:file — remove a backup (never auto-prunes manual/pre-restore)
router.delete("/:file", async (req: AuthRequest, res: Response) => {
  try {
    const name = paramFile(req);
    const abs = path.join(BACKUP_DIR, name);
    if (!fs.existsSync(abs)) return res.status(404).json({ message: "Backup not found" });
    await fsp.rm(abs, { force: true });
    await fsp.rm(`${abs}.meta.json`, { force: true });
    audit(req, "backup.deleted", { file: name });
    return res.json({ ok: true });
  } catch (err: any) {
    if (err instanceof HttpError) return res.status(err.status).json({ message: err.message });
    logger.error({ err }, "backup delete failed");
    return res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/admin/backups/:file/restore — restore a backup, then restart.
router.post("/:file/restore", async (req: AuthRequest, res: Response) => {
  let name = "";
  try {
    name = paramFile(req);
    if (req.body?.confirm !== true) {
      return res.status(400).json({ message: "Restore requires { confirm: true }" });
    }
    audit(req, "backup.restore_started", { file: name });

    await withLock("restore", () => restoreBackupInternal(name));

    // The restored JWT secret only takes effect on a fresh boot — exit and let
    // Docker's restart policy (and entrypoint migrate/verify) bring us back.
    return res.json({ ok: true, requiresRestart: true });
  } catch (err: any) {
    if (err instanceof HttpError) return res.status(err.status).json({ message: err.message });
    logger.error({ err, event: "backup.restore_failed", file: name }, "Restore failed");
    return res.status(500).json({ message: `Restore failed: ${err?.message ?? "internal error"}` });
  } finally {
    // Only restart when the client actually got a success response.
    if (res.writableEnded && res.statusCode === 200) {
      setTimeout(() => {
        logger.info({ event: "backup.restart_now" }, "Exiting after restore — container will restart");
        process.exit(0);
      }, 1500).unref();
    }
  }
});

export default router;
