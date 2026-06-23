# SilkHat Document Pipeline

**By WBC Works LLC — [silkhat.ai](https://silkhat.ai)**

An AI-powered document ingestion and intelligence extraction plugin for [OpenClaw](https://openclaw.ai). Drop documents into a watched folder; SilkHat reads them, understands them, and makes them available to your AI assistant automatically.

---

## What It Does

- **Watches source folders** for new documents — PDF, Word, text files, Markdown, images, audio, and video
- **Deduplicates by content hash** — never processes the same file twice, even if renamed or moved
- **Queues documents** for AI-powered extraction and intelligence analysis
- **Writes structured facts** to SilkHat's private vault, where your assistant can recall and reason over them
- **Privacy-first** — all processing happens locally on your machine; nothing leaves without your explicit action

### Supported file types

| Category | Formats |
|---|---|
| Documents | PDF, DOC, DOCX, TXT, MD, RTF |
| Images | JPG, PNG, GIF, WEBP, TIFF, HEIC |
| Audio | MP3, M4A, WAV, OGG, FLAC |
| Video | MP4, MOV, AVI, MKV, WEBM |

---

## Requirements

- [OpenClaw](https://openclaw.ai) v2026.4.0 or later
- macOS 13+, Windows 10+, or Linux (Ubuntu 22.04+)
- Node.js 20+

---

## Installation

**Option A — OpenClaw CLI (recommended)**

```bash
openclaw skill install silkhat-document-pipeline
```

**Option B — Manual install from this package**

1. Unzip this archive to a local directory
2. In your OpenClaw workspace, run:

```bash
openclaw skill install /path/to/silkhat-document-pipeline
```

---

## Configuration

After installing, tell the pipeline which folders to watch. In your OpenClaw config (`~/.openclaw/openclaw.json`), add:

```json
{
  "extensions": {
    "silkhat-document-pipeline": {
      "sourceFolders": [
        "/Users/you/Documents/SilkHat Inbox",
        "/Users/you/Downloads"
      ]
    }
  }
}
```

Restart OpenClaw after saving. The pipeline will scan your configured folders on startup and watch for new files going forward.

---

## Privacy

The SilkHat Document Pipeline runs entirely on your local machine. Files are read locally, hashed locally, and stored in your local OpenClaw vault. No document content is transmitted to any external server unless you explicitly ask your assistant to act on it.

---

## Version History

**v1.0.0** — June 2026
- Initial public release
- Watch service with chokidar (stable file detection)
- SHA-256 content deduplication
- Durable intake queue with crash recovery
- Support for 20 file formats across documents, images, audio, and video

---

## Support

- **Website:** [silkhat.ai](https://silkhat.ai)
- **Email:** [hello@silkhat.ai](mailto:hello@silkhat.ai)
- **Community:** [discord.gg/cnremYj6](https://discord.gg/cnremYj6)

---

*Be kind. — WBC Works LLC*
