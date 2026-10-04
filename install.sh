#!/bin/bash
#
# ============================================================
# battle platform — macOS installer
# ============================================================
#
# One command to install the whole voice battle system:
#
#   1. checks prerequisites (node, python3, cmake, sox, brew)
#      and offers to install anything missing via Homebrew
#   2. copies the app into ~/.battle-mcp/app
#   3. installs node + python dependencies (with the two
#      sidecar services merged into a single venv)
#   4. builds the Whisper worker (clones whisper.cpp, cmake)
#   5. downloads the Whisper model you pick
#   6. runs the setup wizard — MongoDB URI, NER service and
#      the TTS voice profile picker with live preview
#   7. registers a LaunchAgent so the chat API starts on login
#   8. registers the MCP server with Claude Code (optional)
#
# Re-running it is safe: existing artifacts are kept, and the
# wizard keeps previously saved answers.
#
# Usage:
#   ./install.sh                  interactive, from a checkout
#   BATTLE_HOME=/x ./install.sh   custom install location
#   curl -fsSL <raw-url> | bash   web install, no clone needed
#
# (Web install works because of the bootstrap block below: the
# piped script finds no checkout beside itself, clones the repo,
# and re-runs the installer from inside it with the terminal on
# stdin so every prompt still works.)

set -euo pipefail

# Homebrew tools live outside /usr/bin in non-interactive shells.
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"


# ============================================================
# 0. CURL-BOOTSTRAP MODE
# ============================================================

# Where the project lives. Set this once before sharing, or
# override per-run with BATTLE_REPO_URL.

REPO_URL="${BATTLE_REPO_URL:-https://github.com/sura-p/BATTLE_ASSISTANT.git}"

# A piped-in script has no BASH_SOURCE and no checkout beside it;
# a checkout has both the sources and this installer file.

SELF_DIR="$(dirname "${BASH_SOURCE[0]:-bash}")"

if [ ! -f "$SELF_DIR/src/mcp/server.ts" ] ||
   [ ! -f "$SELF_DIR/install.sh" ]; then

    case "$REPO_URL" in
        *YOUR_GITHUB_USERNAME*)
            echo "install.sh: REPO_URL near the top of install.sh is still"
            echo "the placeholder — set it to your repository URL first."
            exit 1
            ;;
    esac

    command -v git > /dev/null 2>&1 || {
        echo "git not found. Run:  xcode-select --install"
        echo "then re-run the curl command."
        exit 1
    }

    echo "==> Downloading battle platform from $REPO_URL"

    DL_DIR="$(mktemp -d "${TMPDIR:-/tmp}/battle-mcp.XXXXXX")"

    git clone --quiet --depth 1 "$REPO_URL" "$DL_DIR/battle-mcp"

    # /dev/tty keeps the wizard interactive even though the
    # script itself arrived on stdin.

    exec bash "$DL_DIR/battle-mcp/install.sh" "$@" < /dev/tty
fi


# ============================================================
# CONSTANTS
# ============================================================

APP_SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

BATTLE_HOME="${BATTLE_HOME:-$HOME/.battle-mcp}"

BATTLE_HOME_ENV_WAS_SET="${BATTLE_HOME:+set}"

APP_DST="$BATTLE_HOME/app"

LOGS_DIR="$BATTLE_HOME/logs"

LAUNCHD_LABEL="com.battle-mcp.chatapi"

PLIST_PATH="$HOME/Library/LaunchAgents/$LAUNCHD_LABEL.plist"

NODE_BIN="$(command -v node || true)"

WHISPER_REPO="https://github.com/ggml-org/whisper.cpp"


step()   { printf "\n\033[1;34m==>\033[0m %s\n" "$*"; }
info()   { printf "    %s\n" "$*"; }
okay()   { printf "\033[1;32m ✓\033[0m %s\n" "$*"; }
warn()   { printf "\033[1;33m !\033[0m %s\n" "$*"; }
pause()  { read -r -p "$1 [y/N] " RESP; }
pause_y(){ read -r -p "$1 [Y/n] " RESP; [ -z "${RESP:-}" ] || echo "$RESP" | grep -qi '^y'; }


# ============================================================
# 1. PREFLIGHT
# ============================================================

step "Checking your Mac"

if [ "$(uname -s)" != "Darwin" ]; then
    echo "This installer targets macOS only."
    exit 1
fi

okay "$(sw_vers -productVersion) on $(uname -m)"


# Xcode command line tools (compilers).

if ! xcode-select -p > /dev/null 2>&1; then
    step "Installing Xcode command line tools"
    info "A system dialog will open — follow it and re-run ./install.sh when it finishes."
    xcode-select --install || true
    exit 0
fi

okay "Xcode command line tools"

if ! command -v brew > /dev/null 2>&1; then
    step "Installing Homebrew"
    /bin/bash -c \
        "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi


# Everything the system needs. Missing pieces are installed
# with brew, no questions asked.

MISSING=()

for TOOL in node python3 cmake sox git; do
    if command -v "$TOOL" > /dev/null 2>&1; then
        okay "$TOOL: $(command -v "$TOOL")"
    else
        warn "$TOOL: missing"
        MISSING+=("$TOOL")
    fi
done

if [ ${#MISSING[@]} -gt 0 ]; then
    step "Installing missing tools via Homebrew: ${MISSING[*]}"
    brew install "${MISSING[@]}"
fi

NODE_BIN="$(command -v node)"
PYTHON_BIN="$(command -v python3)"


# ============================================================
# 2. INSTALL LOCATION
# ============================================================

step "Install location"

# If BATTLE_HOME was exported, it is the target — no prompt
# (this is how repeated installs and CI stay unattended).

if [ -z "${BATTLE_HOME_ENV_WAS_SET:-}" ]; then

    printf "Install into %s? [Y/n] " "$BATTLE_HOME"

    if ! pause_y ""; then
        read -r -p "Custom path: " CUSTOM
        BATTLE_HOME="${CUSTOM:-$BATTLE_HOME}"
    fi
fi

APP_DST="$BATTLE_HOME/app"

LOGS_DIR="$BATTLE_HOME/logs"

mkdir -p "$BATTLE_HOME" "$LOGS_DIR" "$BATTLE_HOME/bin" "$BATTLE_HOME/models"

info "$BATTLE_HOME"


# ============================================================
# 3. APP CODE
# ============================================================

step "Copying application code"

if [ "$APP_SRC" != "$APP_DST" ]; then

    rsync -a \
        --exclude node_modules \
        --exclude ".venv*" \
        --exclude .git \
        --exclude .env \
        --exclude dist \
        --exclude logs \
        --exclude "native/whisper-worker/build" \
        "$APP_SRC/" \
        "$APP_DST/"

    info "installed at $APP_DST (dev .env excluded — secrets stay local)"
else
    info "running from the installed location already"
    APP_DST="$APP_SRC"
fi

cd "$APP_DST"


# ============================================================
# 4. NODE DEPENDENCIES
# ============================================================

step "Installing node dependencies"

npm install

okay "node modules ready"


# ============================================================
# 5. PYTHON SIDECARS  (wake word + VAD, one shared venv)
# ============================================================

step "Python sidecar services"

VENV_PY="$BATTLE_HOME/venv/bin/python"

if [ ! -f "$VENV_PY" ]; then
    "$PYTHON_BIN" -m venv "$BATTLE_HOME/venv"
fi

"$VENV_PY" -m pip install --upgrade pip --quiet

"$VENV_PY" -m pip install -r "$APP_DST/requirements.txt" --quiet

# openWakeWord ships without its pretrained wake word models —
# they download on first use, which would fail offline. Prefetch.

"$VENV_PY" -c "import openwakeword; openwakeword.utils.download_models()" \
    > /dev/null 2>&1 || warn "could not prefetch wake word models (offline?)"

okay "venv at $BATTLE_HOME/venv (openWakeWord + Silero VAD)"


# ============================================================
# 6. WHISPER.CPP + NATIVE WORKER
# ============================================================

step "Building Whisper worker"

if [ ! -d "$BATTLE_HOME/whisper.cpp/.git" ]; then
    git clone --depth 1 "$WHISPER_REPO" "$BATTLE_HOME/whisper.cpp"
fi

# Build outside the app dir: app upgrades never break the build
# cache, and stale dev caches can't poison a fresh install.

cmake -S "$APP_DST/native/whisper-worker" \
      -B "$BATTLE_HOME/build/whisper-worker" \
      -DWHISPER_CPP_DIR="$BATTLE_HOME/whisper.cpp" \
      > "$LOGS_DIR/whisper-build.log" 2>&1 \
&& cmake --build "$BATTLE_HOME/build/whisper-worker" --parallel \
      >> "$LOGS_DIR/whisper-build.log" 2>&1 \
|| {
    warn "whisper build failed — last 30 lines of $LOGS_DIR/whisper-build.log:"
    tail -30 "$LOGS_DIR/whisper-build.log"
    exit 1
}

cp "$BATTLE_HOME/build/whisper-worker/battle-whisper-worker" \
   "$BATTLE_HOME/bin/battle-whisper-worker"

okay "worker binary at $BATTLE_HOME/bin/battle-whisper-worker"


# ============================================================
# 7. WHISPER MODEL
# ============================================================

step "Speech recognition model"

if ls "$BATTLE_HOME"/models/ggml-*.bin > /dev/null 2>&1; then
    info "model already downloaded: $(ls "$BATTLE_HOME"/models/ggml-*.bin | head -1)"
    info "delete it from $BATTLE_HOME/models to pick a different size"
else
    echo "  1) tiny.en   — fastest, least accurate"
    echo "  2) base.en   — balanced (recommended)"
    echo "  3) small.en  — most accurate, slower"
    read -r -p "Model [2]: " MODEL_CHOICE

    case "${MODEL_CHOICE:-2}" in
        1) WHISPER_MODEL="tiny.en" ;;
        3) WHISPER_MODEL="small.en" ;;
        *) WHISPER_MODEL="base.en" ;;
    esac

    (cd "$BATTLE_HOME/whisper.cpp/models" && \
        ./download-ggml-model.sh "$WHISPER_MODEL")

    cp "$BATTLE_HOME/whisper.cpp/models/ggml-$WHISPER_MODEL.bin" \
       "$BATTLE_HOME/models/"

    okay "$WHISPER_MODEL → $BATTLE_HOME/models/"
fi


# ============================================================
# 8. SETUP WIZARD (APIs + TTS voice profile)
# ============================================================

step "Configuration"

if [ -f "$BATTLE_HOME/config.env" ]; then

    info "config found: $BATTLE_HOME/config.env"

    if ! pause_y "Re-run the setup wizard to review settings?"; then
        info "keeping existing config (run \`battle setup\` anytime to change it)"
    else
        "$NODE_BIN" "$APP_DST/node_modules/tsx/dist/cli.mjs" \
            "$APP_DST/src/setup/wizard.ts"
    fi
else
    "$NODE_BIN" "$APP_DST/node_modules/tsx/dist/cli.mjs" \
        "$APP_DST/src/setup/wizard.ts"
fi


# ============================================================
# 9. LAUNCH AGENT (chat API starts on login)
# ============================================================

step "Chat API auto-start"

if pause_y "Start the chat API automatically when you log in?"; then

mkdir -p "$LOGS_DIR"

cat > "$PLIST_PATH" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>$LAUNCHD_LABEL</string>

    <key>ProgramArguments</key>
    <array>
        <string>$NODE_BIN</string>
        <string>$APP_DST/node_modules/tsx/dist/cli.mjs</string>
        <string>src/api/server.ts</string>
    </array>

    <key>WorkingDirectory</key>
    <string>$APP_DST</string>

    <key>RunAtLoad</key>
    <true/>

    <key>KeepAlive</key>
    <true/>

    <key>StandardOutPath</key>
    <string>$LOGS_DIR/chatapi.log</string>

    <key>StandardErrorPath</key>
    <string>$LOGS_DIR/chatapi.err</string>

    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
        <key>BATTLE_HOME</key>
        <string>$BATTLE_HOME</string>
    </dict>
</dict>
</plist>
PLIST

# A previous install may already have the agent loaded — reload it.

launchctl bootout "gui/$(id -u)/$LAUNCHD_LABEL" 2> /dev/null || true

launchctl bootstrap "gui/$(id -u)" "$PLIST_PATH" \
    || launchctl load -w "$PLIST_PATH"

okay "$PLIST_PATH"

else
    info "skipped — start it manually anytime with \`battle start\`"
fi


# ============================================================
# 10. MCP REGISTRATION
# ============================================================

step "MCP server"

if command -v claude > /dev/null 2>&1; then

    info "found the Claude Code CLI"

    if pause_y "Register the battle MCP server with Claude Code?"; then

        (cd "$APP_DST" && claude mcp add battle-platform -- \
            "$NODE_BIN" "$APP_DST/node_modules/tsx/dist/cli.mjs" \
            "src/mcp/server.ts")

        okay "registered — find_game / get_game_schema / validate_mechanic are live"
    fi
else
    info "claude CLI not found — run \`battle mcp\` later to register"
fi


# ============================================================
# 11. battle COMMAND ON PATH
# ============================================================

step "battle command"

BIN_LINK_TARGET=""

for CANDIDATE in /opt/homebrew/bin /usr/local/bin; do
    if [ -d "$CANDIDATE" ] && [ -w "$CANDIDATE" ]; then
        BIN_LINK_TARGET="$CANDIDATE"
        break
    fi
done

if [ -n "$BIN_LINK_TARGET" ]; then
    ln -sf "$APP_DST/bin/battle" "$BIN_LINK_TARGET/battle"
    okay "typed \`battle\` anywhere: $BIN_LINK_TARGET/battle"
else
    warn "no writable bin dir — call $APP_DST/bin/battle directly"
fi


# ============================================================
# 12. VERIFY
# ============================================================

step "Verifying the installation"

BATTLE_HOME="$BATTLE_HOME" \
    "$NODE_BIN" "$APP_DST/node_modules/tsx/dist/cli.mjs" \
    "$APP_DST/src/doctor.ts" || true


# ============================================================
# DONE
# ============================================================

printf "\n"
printf "\033[1;32m  Install complete.\033[0m\n\n"
printf "  • chat API:   \033[1mbattle start\033[0m (or auto-starts on login if you opted in)\n"
printf "  • voice mode: \033[1mbattle %s\033[0m in a terminal — say \"hey jarvis\"\n" "talk"
printf "  • reconfigure: \033[1mbattle setup\033[0m  |  voice only: \033[1mbattle voice\033[0m\n"
printf "  • health:     \033[1mbattle status\033[0m / \033[1mbattle doctor\033[0m\n\n"