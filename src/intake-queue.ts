// SilkHat Document Pipeline — Intake Queue
// Durable, file-backed queue for documents awaiting AI processing.
// Survives process restarts — any unprocessed items are replayed on next startup.

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

export type QueueLane = "foreground" | "background";

export interface QueueEntry {
  /** SHA-256 hex of the file content — used for deduplication */
  contentHash: string;
  /** Absolute path to the source file */
  sourcePath: string;
  /** Filename for display purposes */
  displayPath: string;
  /** MIME type resolved from file extension */
  mimeType: string;
  /** File modification time in ISO-8601 format */
  documentDate: string;
  /** Processing priority lane */
  lane: QueueLane;
}

interface QueueRecord extends QueueEntry {
  id: string;
  enqueuedAt: string;
}

/**
 * IntakeQueue — durable file-backed queue stored under stateDir/intake-queue/.
 * Each entry is a JSON file named by a UUID. On startup, any leftover files
 * are replayed automatically (crash recovery).
 */
export class IntakeQueue {
  private readonly queueDir: string;
  private readonly seenHashes = new Set<string>();

  private constructor(stateDir: string) {
    this.queueDir = join(stateDir, "intake-queue");
    mkdirSync(this.queueDir, { recursive: true });
    this.replayExisting();
  }

  static open(stateDir: string): IntakeQueue {
    return new IntakeQueue(stateDir);
  }

  /**
   * Enqueue a file for processing. Silently deduplicates by contentHash —
   * the same file (even if renamed or moved) is never processed twice.
   */
  enqueue(entry: QueueEntry): void {
    if (this.seenHashes.has(entry.contentHash)) return;

    const record: QueueRecord = {
      ...entry,
      id: randomUUID(),
      enqueuedAt: new Date().toISOString(),
    };

    const filePath = join(this.queueDir, `${record.id}.json`);
    writeFileSync(filePath, JSON.stringify(record, null, 2), "utf8");
    this.seenHashes.add(entry.contentHash);

    console.log(
      `[silkhat-document-pipeline] queued: ${entry.displayPath} (${entry.mimeType})`,
    );
  }

  /**
   * Drain: returns all pending queue entries and removes them from disk.
   * Call this from your processing loop to consume the queue.
   */
  drain(): QueueRecord[] {
    const files = readdirSync(this.queueDir).filter((f) => f.endsWith(".json"));
    const records: QueueRecord[] = [];

    for (const file of files) {
      const filePath = join(this.queueDir, file);
      try {
        const raw = readFileSync(filePath, "utf8");
        const record = JSON.parse(raw) as QueueRecord;
        records.push(record);
        rmSync(filePath);
      } catch {
        // Corrupt entry — remove it
        try { rmSync(filePath); } catch { /* ignore */ }
      }
    }

    return records;
  }

  /** Reload hashes from any queue files left over from a previous run (crash recovery). */
  private replayExisting(): void {
    if (!existsSync(this.queueDir)) return;
    const files = readdirSync(this.queueDir).filter((f) => f.endsWith(".json"));
    for (const file of files) {
      try {
        const raw = readFileSync(join(this.queueDir, file), "utf8");
        const record = JSON.parse(raw) as QueueRecord;
        this.seenHashes.add(record.contentHash);
      } catch { /* skip corrupt files */ }
    }
    if (files.length > 0) {
      console.log(`[silkhat-document-pipeline] replayed ${files.length} pending item(s) from previous run`);
    }
  }
}
