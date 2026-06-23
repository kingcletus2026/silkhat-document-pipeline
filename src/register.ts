// Plugin registration for the document pipeline (S5: watch + intake queue).
// S6 will add the drain loop (extraction → intelligence → cross-link → vault
// write) and the documents.* tool registrations.
//
// State dir: obtained from the canonical resolveStateDir() helper
// (openclaw/plugin-sdk/state-paths) — never hardcoded to ~/.openclaw.
// Source folders are read from plugin config; default empty (operator opts in
// per DESIGN_document-pipeline-rev0 §4.1).

import { IntakeQueue } from "@cleat-us/document-pipeline";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk/plugin-entry";
import { resolveStateDir } from "openclaw/plugin-sdk/state-paths";
import { type WatchServiceOptions, startWatchService } from "./watch-service.js";

export interface DocumentPipelinePluginConfig {
  // Absolute paths of source folders to watch for new documents.
  // Empty by default — operator must configure before the pipeline activates.
  sourceFolders?: string[];
  // Optional overrides for the watcher (for tests / performance tuning).
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
          `[document-pipeline] watch service active on ${sourceFolders.length} folder(s): ${sourceFolders.join(", ")}`,
        );
      })
      .catch((err: unknown) => {
        api.logger.error(`[document-pipeline] failed to start watch service: ${String(err)}`);
      });
  } else {
    api.logger.info(
      "[document-pipeline] no source folders configured; watch service idle. " +
        "Set sourceFolders in plugin config to activate.",
    );
  }

  // queue is retained here; S6 drain loop will be wired in this function when it lands.
  void queue;
}
