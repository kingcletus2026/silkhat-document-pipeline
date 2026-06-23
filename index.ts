// SilkHat Document Pipeline — OpenClaw Plugin Entry
// Watches source folders, deduplicates by content hash, and queues documents
// for AI-powered extraction and intelligence analysis.

import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { registerDocumentPipeline } from "./src/register.js";

export default definePluginEntry({
  id: "silkhat-document-pipeline",
  name: "SilkHat Document Pipeline",
  description:
    "Document-intelligence pipeline: watches source folders, deduplicates by content " +
    "hash, queues documents for AI-powered extraction and analysis, and makes " +
    "their contents available to your SilkHat assistant.",
  register(api) {
    registerDocumentPipeline(api);
  },
});
