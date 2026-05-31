# Hermes Local Client

> A fully local desktop client for the [Hermes Agent](https://hermes-agent.nousresearch.com/) Gateway API — built with Tauri v2 + React 19 + TypeScript.

<p align="center">
  <img src="https://img.shields.io/badge/version-1.0.0-blue" alt="v1.0.0" />
  <img src="https://img.shields.io/badge/platform-macOS%20|%20Windows-lightgrey" alt="Platform" />
  <img src="https://img.shields.io/badge/Tauri-2.5-blueviolet" alt="Tauri v2" />
  <img src="https://img.shields.io/badge/React-19.1-cyan" alt="React 19" />
</p>

Hermes Local Client connects to your running Hermes Gateway (at `localhost:8642`) via its OpenAI-compatible `POST /v1/chat/completions` endpoint. Unlike direct LLM API clients, this goes through the full Hermes agent pipeline — tool calling, memory, skills, session management, and model routing.

---

## Architecture

```
┌──────────────────────────────────────────────┐
│  Hermes Local Client (Tauri v2 Desktop App)   │
│                                                │
│  ┌──────────────┐      ┌────────────────────┐  │
│  │  Frontend     │ IPC  │  Rust Backend      │  │
│  │  (React 19 +  │─────▶│  (Tauri Commands)  │  │
│  │   TypeScript) │◀─────│                    │  │
│  │               │      │  - send_message()  │  │
│  │  - Chat UI    │      │  - get/set config  │  │
│  │  - Markdown   │      │  - session mgmt    │  │
│  │  - Settings   │      │  - attachments     │  │
│  └──────────────┘      └───────┬────────────┘  │
└──────────────────────────────────┼──────────────┘
                                   │ HTTP/SSE
                                   ▼
                   ┌──────────────────────────┐
                   │  Hermes Gateway           │
                   │  (localhost:8642)         │
                   │                           │
                   │  POST /v1/chat/completions│
                   │  X-Hermes-Session-Id: ... │
                   │  Authorization: Bearer ...│
                   └──────────────────────────┘
```

**Data flow:**
1. User types a message in the React chat UI
2. Frontend calls Tauri IPC (`invoke("send_message")`)
3. Rust backend sends an authenticated HTTP POST to the Hermes Gateway
4. Gateway processes the request through the full Hermes agent pipeline
5. Response is returned via IPC back to the UI, rendered as Markdown

---

## Project Structure

```
hermes-local-client/
├── index.html                  # Vite entry point (HTML shell)
├── package.json                # Node dependencies & scripts
├── tsconfig.json               # TypeScript configuration
├── tsconfig.node.json          # TypeScript config for Vite/Node
├── vite.config.ts              # Vite bundler config (React + Tailwind)
├── .gitignore                  # Git ignore rules
│
├── src/                        # ─── Frontend (React) ───
│   ├── main.tsx                # React entry point
│   ├── App.tsx                 # Main chat application component
│   ├── App.css                 # Deep dark theme styles (415 lines)
│   ├── vite-env.d.ts           # Vite type declarations
│   └── assets/
│       └── react.svg           # Favicon asset
│
├── public/
│   ├── tauri.svg               # Tauri brand logo
│   └── vite.svg                # Vite brand logo
│
├── src-tauri/                  # ─── Backend (Rust/Tauri) ───
│   ├── Cargo.toml              # Rust dependencies & project metadata
│   ├── Cargo.lock              # Locked dependency versions
│   ├── build.rs                # Tauri build script
│   ├── tauri.conf.json         # Tauri app config (window, bundle, CSP)
│   │
│   ├── src/
│   │   ├── main.rs             # Rust entry point (calls lib::run())
│   │   ├── lib.rs              # Tauri app builder (command registration)
│   │   └── commands/
│   │       ├── mod.rs          # Commands module declaration
│   │       └── chat.rs         # All IPC command implementations
│   │
│   ├── capabilities/
│   │   └── default.json        # Tauri v2 security capabilities
│   │
│   ├── gen/schemas/            # Auto-generated Tauri schema files
│   │
│   └── icons/                  # App icons (all sizes)
│       ├── icon.png            # Main icon (1024x1024)
│       ├── icon.icns           # macOS icon bundle
│       ├── icon.ico            # Windows icon
│       └── (various sizes)
│
└── dist/                       # Built frontend output (gitignored)
```

---

## Key Files Explained

### Frontend

| File | Lines | Purpose |
|------|-------|---------|
| `src/App.tsx` | 247 | Main React component: message list, input bar, settings panel, session management, Markdown rendering via `react-markdown` |
| `src/App.css` | 415 | Deep dark theme: CSS variables, message bubbles, typing indicator animation, scrollbar styling, Markdown code block styling |
| `src/main.tsx` | ~9 | React DOM render entry point |
| `vite.config.ts` | 33 | Vite config: React plugin, Tailwind CSS v4, Tauri dev server (port 1420) |
| `index.html` | 14 | HTML shell with `<div id="root">` and module script tag |

### Backend (Rust/Tauri)

| File | Lines | Purpose |
|------|-------|---------|
| `src-tauri/src/main.rs` | 6 | Rust entry: calls `hermes_local_client_lib::run()` |
| `src-tauri/src/lib.rs` | 31 | Tauri app builder: registers 6 IPC commands, manages app state (Gateway config + session ID) |
| `src-tauri/src/commands/chat.rs` | 151 | All backend logic: 6 Tauri commands (see table below) |
| `src-tauri/Cargo.toml` | 23 | Rust dependencies: `tauri`, `reqwest`, `serde`, `tokio`, `uuid`, `thiserror` |
| `src-tauri/tauri.conf.json` | 43 | App identity, window size (1100×750), CSP security policy, bundle targets |

### Rust Commands (in `chat.rs`)

| Command | Description |
|---------|-------------|
| `get_gateway_config()` | Retrieve current Gateway URL + API Key from app state |
| `set_gateway_config(base_url, api_key)` | Save Gateway URL + API Key to app state |
| `send_message(message, session_id, attachments)` | Send message to Hermes Gateway via HTTP POST; returns `ChatResponse { response, session_id }` |
| `get_current_session()` | Get the active session ID |
| `set_current_session(session_id)` | Set the active session ID |
| `create_attachment(filename, path, mime_type, size)` | Create an `Attachment` struct (for future file upload support) |

### Data Flow Detail

The `send_message` command:
1. Reads Gateway config from app state
2. Constructs an HTTP POST request to `{base_url}/v1/chat/completions`
3. Sends the request body as `{"messages": [{"role": "user", "content": "..."}], "session_id": "..."}`
4. Includes `Authorization: Bearer <api_key>` and `X-Hermes-Session-Id` headers
5. Parses the OpenAI-compatible response: `response.choices[0].message.content`
6. Returns the assistant's response text along with the session ID

### Dependencies

**Node (frontend):**
- `react` / `react-dom` (19.1)
- `@tauri-apps/api` (v2) — Tauri IPC bridge
- `react-markdown` (10.1) — Markdown rendering
- `lucide-react` (0.485) — Icon library
- `tailwindcss` (4.2) + `@tailwindcss/vite` — Utility CSS
- `typescript` (5.8) + `vite` (7.0) — Build toolchain

**Rust (backend):**
- `tauri` (2.5) — Desktop framework
- `reqwest` (0.12) — HTTP client
- `serde` / `serde_json` (1.0) — Serialization
- `tokio` (1.44) — Async runtime
- `uuid` (1.16) — Session ID generation
- `thiserror` (1.0) — Error handling

---

## Getting Started

### Prerequisites

- **Node.js** 18+
- **Rust** toolchain (rustc 1.70+)
- A running **Hermes Gateway** instance (default: `http://localhost:8642`)

### Install & Run (Development)

```bash
# Install frontend dependencies
npm install

# Run in development mode (hot reload)
npm run tauri:dev
```

### Build for Production

```bash
# Build macOS .app + .dmg
npm run tauri:build
```

Outputs are generated in:
```
src-tauri/target/release/bundle/
├── macos/Hermes Local.app
└── dmg/Hermes Local_1.0.0_aarch64.dmg
```

### Configuration

Launch the app and click the **Settings** (gear) icon in the top-right corner:

1. **Gateway URL**: Your Hermes Gateway address (default: `http://localhost:8642`)
2. **API Key**: The API key from `~/.hermes/.env` (`API_SERVER_KEY`)
3. Click **Save Configuration**

---

## Releases

| Version | Platform | Download |
|---------|----------|----------|
| v1.0.0 | macOS (Apple Silicon) | `dist/Hermes Local_1.0.0_aarch64.dmg` |
| v1.0.0 | Windows (x64) | Build on Windows with `npm run tauri:build` |

> **Note:** Windows builds currently require building natively on Windows. Cross-compilation from macOS is not supported for the `msi`/`nsis` targets. See [Tauri documentation](https://v2.tauri.app/start/prerequisites/) for Windows build setup.

---

## Semantic Versioning

This project follows [SemVer 2.0.0](https://semver.org/):

- **PATCH** (0.0.x): Bug fixes, minor UI tweaks, dependency updates
- **MINOR** (0.x.0): New features, UI improvements, backward-compatible additions
- **MAJOR** (x.0.0): Breaking changes, major architecture overhauls

---

## License

This project is licensed under the MIT License.
