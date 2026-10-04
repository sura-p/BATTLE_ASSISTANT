# Battle Platform — macOS install

One command installs the whole system: chat API, MCP server, voice
pipeline (wake word + VAD + Whisper) and setup.

## Requirements

- macOS (Apple Silicon or Intel)
- An internet connection
- A MongoDB instance the user can reach (local or Atlas)
- The NER service URL (e.g. hosted, or a colleague's machine)

Everything else — Node, Python, cmake, sox, whisper.cpp, models — is
checked and installed automatically (Homebrew is bootstrapped if
missing).

## Install

From a checkout:

```bash
./install.sh
```

Or straight from the web, no clone needed (set `REPO_URL` in
`install.sh` to your fork first):

```bash
curl -fsSL https://raw.githubusercontent.com/<you>/battle-mcp/main/install.sh | bash
```

The piped script detects it has no checkout beside itself, clones
the repository into a temp dir, and runs the installer from there;
prompts keep working because the hand-off reads from the terminal.

The installer walks through:

1. **Prerequisites** — node, python3, cmake, sox, git; anything
   missing is installed via Homebrew (Xcode CLT dialog may appear on
   a fresh Mac; re-run when it finishes).
2. **Code** — the app is copied to `~/.battle-mcp/app` (dev secrets
   like `.env` are excluded from the copy).
3. **Dependencies** — node modules plus a single Python venv at
   `~/.battle-mcp/venv` (openWakeWord + Silero VAD).
4. **Whisper** — whisper.cpp is cloned and the native worker is
   compiled; you pick the model size (tiny / base / small).
5. **Setup wizard** — asks for:
   - MongoDB URI (tested with a live connection)
   - NER API URL
   - local API port
   - **TTS voice profile** — every voice installed on your Mac,
     previewable before choosing, plus speaking rate
6. **Auto-start** (optional) — the chat API registers as a
   LaunchAgent so it starts at login.
7. **MCP** (optional) — registers the battle tools with Claude Code.

The final wizard answers land in `~/.battle-mcp/config.env`
(perms 600).

## Using it

| command | what it does |
|---|---|
| `battle setup` | re-run the whole setup wizard |
| `battle voice` | re-pick the TTS voice / rate only |
| `battle doctor` | verify every component |
| `battle start` | start the chat API (LaunchAgent or foreground) |
| `battle stop` | stop the chat API |
| `battle status` | is the chat API responding? |
| `battle mcp` | register the MCP server with Claude Code |
| `battle logs` | tail the chat API logs |

Voice mode is interactive:

```bash
battle talk
```

Say "hey jarvis" to wake it, speak your request.

## Directory layout

```
~/.battle-mcp/
  app/            application code (TS + python services + native worker)
  bin/            battle-whisper-worker binary
  venv/           python environment (wake word + VAD)
  models/         ggml whisper model
  whisper.cpp/    cloned + built whisper.cpp
  build/          cmake build cache for the worker
  logs/           chatapi.log / chatapi.err / whisper-build.log
  config.env      user configuration (600)
```

## Using it

Everything runs through one command: `battle`.

```bash
battle start        # chat API (skip if you opted into auto-start)
battle talk         # voice mode — say "hey jarvis", then speak
```

In voice mode, wait for the listening prompt, say **"hey
jarvis"**, then just talk — replies are spoken in the voice you
picked at setup. The chat API can also be called directly:

```bash
curl -s -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"conversationId":"my-chat","message":"create a fifa battle"}'
```

| Command | What it does |
|---|---|
| `battle start` / `battle stop` | start / stop the chat API |
| `battle status` | health check of the running API |
| `battle talk` | voice mode |
| `battle doctor` | full health check (config, Mongo, NER, voice, whisper) |
| `battle setup` | re-run the setup wizard |
| `battle voice` | re-pick the TTS voice profile |
| `battle logs` | tail the API logs |

If anything misbehaves, run `battle doctor` first — it names the
broken component. The usual suspects are the two endpoints from
the wizard: your MongoDB URI and the NER service URL (that
service must be running and reachable).

## Updating

Re-run `./install.sh` from the new code — it keeps your config,
venv, whisper model and re-copies the app code.

## Security notes

- Credentials live only in `~/.battle-mcp/config.env` (600 perms),
  never inside the app copy.
- The install copy excludes `.env`, so developer secrets don't ship.