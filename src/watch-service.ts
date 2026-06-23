// Source-folder watcher for the document pipeline (rev0 §4.1 / S5).
//
// Reuses the chokidar debounced-stability pattern from
// @cleat-us/vault-reindex/src/watcher.ts. Watches operator-designated source
// folders; on file add/change computes a content hash, resolves a MIME type,
// and enqueues to the IntakeQueue. Files with unrecognised extensions are
// silently ignored (the pipeline only handles formats it can extract).
//
// ISOLATION: this module reads real files from the filesystem. Tests that
// exercise watcher behaviour must use an OPENCLAW_STATE_DIR-isolated tmpdir
// and synthetic fixture files, never ~/.openclaw.

import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { basename, extname } from "node:path";
import type { IntakeQueue, QueueLane } from "@cleat-us/document-pipeline";
import { watch, type FSWatcher } from "chokidar";

export interface WatchServiceOptions {
  // Milliseconds chokidar waits for the file to stabilise before firing.
  stabilityThresholdMs?: number;
  // Force stat-polling instead of native fs.watch (same tradeoff as vault-reindex).
  usePolling?: boolean;
  pollIntervalMs?: number;
  // Queue lane for files discovered by this watcher. Default: foreground.
  lane?: QueueLane;
}

// Extension-to-MIME map for document + media types supported by the pipeline
// dispatcher (rev0 §5). Extensions not listed here are silently skipped by
// the watcher — the pipeline can't process them.
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

// Start watching sourceFolders and enqueue discovered files into queue.
// Resolves when chokidar's 'ready' event fires (watcher is live and the
// initial scan of existing files is complete).
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
    // Nothing to watch. Return a no-op watcher so callers don't need to branch.
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
    // Ignore dotfiles and dotdirs (e.g. .DS_Store, .git).
    ignored: /(^|[/\\])\../,
  });

  const handleFile = (fullPath: string) => {
    const mimeType = mimeFromPath(fullPath);
    if (!mimeType) {
      return;
    } // unrecognised extension — skip silently

    try {
      const buf = readFileSync(fullPath);
      const contentHash = sha256Hex(buf);
      const stat = statSync(fullPath);
      const documentDate = stat.mtime.toISOString();

      queue.enqueue({
        contentHash,
        sourcePath: fullPath,
        displayPath: basename(fullPath),
        mimeType,
        documentDate,
        lane,
      });
    } catch (err) {
      console.error("[document-pipeline/watcher] enqueue error for", fullPath, err);
    }
  };

  watcher.on("add", handleFile);
  watcher.on("change", handleFile);
  watcher.on("error", (err) => {
    console.error("[document-pipeline/watcher] watch error:", err);
  });

  // Resolve only once the initial scan is complete so callers can rely on
  // existing files already being enqueued immediately after this promise
  // resolves (mirrors the vault-reindex watcher pattern).
  return new Promise<FSWatcher>((resolve) => {
    watcher.once("ready", () => resolve(watcher));
  });
}
