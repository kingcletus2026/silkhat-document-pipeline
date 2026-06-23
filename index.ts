// The bundled `silkhat-document-pipeline` plugin (DESIGN_document-pipeline-rev0
// §3). Thin registration surface — heavy lifting in @cleat-us/document-pipeline
// and src/. Mirrors silkhat-router / silkhat-authz-gate pattern.
//
// S5: watch service + durable intake queue.
// S6 (next slice): documents.* tools + drain loop (extract → intelligence →
//                  cross-link → vault write).

import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { registerDocumentPipeline } from "./src/register.js";

export default definePluginEntry({
  id: "silkhat-document-pipeline",
  name: "SilkHat Document Pipeline",
  description:
    "Document-intelligence pipeline: watches source folders, deduplicates by content " +
    "hash, queues documents for extraction and intelligence analysis through the privacy " +
    "chokepoint, and writes vault-resident document + fact entities.",
  register(api) {
    registerDocumentPipeline(api);
  },
});
