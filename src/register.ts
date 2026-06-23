// SilkHat Document Pipeline — Plugin Registration
// Wires the watch service and intake queue into the OpenClaw plugin API.
// Source folders are read from plugin config; empty by default (opt-in).

import type { OpenClawPluginApi } from "openclaw/plugin-sdk/plugin-entry";
import { resolveStateDir } from "openclaw/plugin-sdk/state-paths";
import { IntakeQueue } from "./intake-queue.js";
import { type WatchServiceOptions, startWatchService } from "./watch-service.js";

export interface DocumentPipelinePluginConfig {
  /**
   * Absolute paths of source folders to watch for new documents.
   * Empty by default — configure at least one folder to activate the pipeline.
   *
   * @example ["~/Documents/SilkHat Inbox", "~/Downloads"]
   */
  sourceFolders?: string[];
  /** Optional overrides for the watcher (for tests or performance tuning). */
  watchOptions?: WatchServiceOptions;
}

export function registerDocumentPipeline(api: OpenClawPluginApi): void {
  const stateDir = resolveStateDir();
  const pluginConfig = (api.pluginConfig ?? {}) as DocumentPipelinePluginConfig;
  const sourceFolders = pluginConfig.sourceFolders ?? [];

  const queue = IntakeQueue.open(stateDir);

  if (sourceFolders.length > 0) {
    startWatchService(sourceFolders, queue, pluginConfig.watchOptions)
      .then(() => {
        api.logger.info(
          `[silkhat-document-pipeline] active on ${sourceFolders.length} folder(s): ${sourceFolders.join(", ")}`,
        );
      })
      .catch((err: unknown) => {
        api.logger.error(`[silkhat-document-pipeline] failed to start watch service: ${String(err)}`);
      });
  } else {
    api.logger.info(
      "[silkhat-document-pipeline] no source folders configured; pipeline idle. " +
        "Add sourceFolders to your plugin config to activate.",
    );
  }

  // Expose queue on the API for the drain loop (connect your own processing step here)
  // queue.drain() returns all pending entries and clears them from disk.
  void queue;
}
