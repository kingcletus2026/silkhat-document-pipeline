// SilkHat Document Pipeline — Watch Service
// Watches operator-designated source folders for new documents.
// On file add/change, computes a content hash, resolves a MIME type,
// and enqueues the file for AI-powered processing.
// Files with unrecognised extensions are silently ignored.

import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { basename, extname } from "node:path";
import { watch, type FSWatcher } from "chokidar";
import type { IntakeQueue, QueueLane } from "./intake-queue.js";

export interface WatchServiceOptions {
  /** Milliseconds to wait for the file to stabilise before processing. Default: 100 */
  stabilityThresholdMs?: number;
  /** Force stat-polling instead of native fs.watch (useful on network drives). Default: false */
  usePolling?: boolean;
  pollIntervalMs?: number;
  /** Queue lane for files discovered by this watcher. Default: "foreground" */
  lane?: QueueLane;
}

// File extensions supported by the pipeline
const MIME_BY_EXT: Readonly<Record<string, string>> = {
  // Documents
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
  md: "text/markdown",
  rtf: "application/rtf",
  // Images
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  tiff: "image/tiff",
  tif: "image/tiff",
  heic: "image/heic",
  // Audio
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  wav: "audio/wav",
  ogg: "audio/ogg",
  flac: "audio/flac",
  // Video
  mp4: "video/mp4",
  mov: "video/quicktime",
  avi: "video/x-msvideo",
  mkv: "video/x-matroska",
  webm: "video/webm",
};

function mimeFromPath(filePath: string): string | undefined {
  const ext = extname(filePath).slice(1).toLowerCase();
  return MIME_BY_EXT[ext];
}

function sha256Hex(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

/**
 * Start watching sourceFolders and enqueue discovered files.
 * Resolves when the initial scan of existing files is complete.
 */
export function startWatchService(
  sourceFolders: string[],
  queue: IntakeQueue,
  opts: WatchServiceOptions = {},
): Promise<FSWatcher> {
  const threshold = opts.stabilityThresholdMs ?? 100;
  const usePolling = opts.usePolling ?? false;
  const pollInterval = opts.pollIntervalMs ?? 25;
  const lane = opts.lane ?? "foreground";

  if (sourceFolders.length === 0) {
    const watcher = watch([], { persistent: false });
    return new Promise<FSWatcher>((resolve) => watcher.once("ready", () => resolve(watcher)));
  }

  const watcher = watch(sourceFolders, {
    persistent: true,
    ignoreInitial: false,
    usePolling,
    interval: pollInterval,
    binaryInterval: pollInterval,
    awaitWriteFinish: {
      stabilityThreshold: threshold,
      pollInterval: Math.min(50, Math.floor(threshold / 2)),
    },
    ignored: /(^|[/\\])\../, // ignore dotfiles and dotdirs
  });

  const handleFile = (fullPath: string) => {
    const mimeType = mimeFromPath(fullPath);
    if (!mimeType) return; // unrecognised extension — skip

    try {
      const buf = readFileSync(fullPath);
      const contentHash = sha256Hex(buf);
      const stat = statSync(fullPath);

      queue.enqueue({
        contentHash,
        sourcePath: fullPath,
        displayPath: basename(fullPath),
        mimeType,
        documentDate: stat.mtime.toISOString(),
        lane,
      });
    } catch (err) {
      console.error("[silkhat-document-pipeline] enqueue error for", fullPath, err);
    }
  };

  watcher.on("add", handleFile);
  watcher.on("change", handleFile);
  watcher.on("error", (err) => {
    console.error("[silkhat-document-pipeline] watch error:", err);
  });

  return new Promise<FSWatcher>((resolve) => {
    watcher.once("ready", () => resolve(watcher));
  });
}
