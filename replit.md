# DiscBurn Administrative Platform

## Overview
DiscBurn is an enterprise-grade, platform-agnostic command-line orchestration system with **bidirectional USB signal communication** for managing files, preparing disc burns, and syncing with cloud storage.

**Signal Path:** Phone <-> Anker Hub <-> HP DVD557s <-> Anker Hub <-> Phone

## Quick Start
```bash
npx tsx run-cli.ts
```

Or run commands directly:
```bash
npx tsx run-cli.ts "burn"
npx tsx run-cli.ts "watch"       # Monitor bidirectional signals
npx tsx run-cli.ts "send status" # Send signal to DVD burner
npx tsx run-cli.ts "execute"     # Execute burn + sync to OneDrive
```

## Architecture
```
src/
├── cli/              # Command-line interface
│   └── index.ts      # Interactive shell
├── core/             # Business logic
│   ├── executor.ts   # Command execution engine
│   ├── burn-executor.ts # Burn lifecycle with OneDrive sync
│   ├── manifest.ts   # Burn manifest schema (v2.0)
│   └── admin.ts      # Administrative controls
├── adapters/         # External service integrations
│   ├── onedrive.ts   # Microsoft OneDrive via Graph API
│   ├── openai.ts     # Natural language parsing
│   ├── usb-signal.ts # Bidirectional USB communication
│   └── sovereigncapsule.ts # SovereignCapsule adapter
└── storage/          # Persistence layer
    └── fileStorage.ts # JSON file-based storage
```

## Signal Communication

### Bidirectional Flow
```
OUTBOUND: Phone -> Anker Hub -> HP DVD557s
  - Burn commands
  - Cancel/pause/resume
  - Status requests

INBOUND: HP DVD557s -> Anker Hub -> Phone  
  - Job progress updates
  - Burn completion status
  - Error notifications
  - Device state changes
```

### Signal Commands
| Command | Description |
|---------|-------------|
| `watch` | Monitor bidirectional signals in real-time |
| `send` | Send signal to DVD burner |
| `cancel <jobId>` | Cancel active burn job |

## Available Commands

### Burn Commands
| Command | Description |
|---------|-------------|
| `burn` | Create burn job for HP DVD557s |
| `burn all projects` | Package all files for disc burning |
| `execute` | Execute burn + sync to OneDrive after |

### Backup Commands
| Command | Description |
|---------|-------------|
| `backup` | Backup files to cloud destinations |

### System Commands
| Command | Description |
|---------|-------------|
| `sync` | Synchronize with cloud storage |
| `list` | Show workspace files |
| `status` | Platform and connection status |
| `help` | Show available commands |

### Admin Commands
| Command | Description |
|---------|-------------|
| `admin audit` | View audit log |
| `admin config` | View platform configuration |
| `admin registry` | View command registry |

## Burn Execution Lifecycle
```
1. burn          -> Create job, upload to OneDrive/pending/
2. execute       -> Process job through DVD557s
3. OneDrive sync -> Save completion to /completed/ and /archive/
```

### State Machine
```
created -> pending -> queued -> burning -> verifying -> complete
                  \-> cancelled
                              \-> failed -> pending (retry)
```

## OneDrive Structure
```
OneDrive/DiscBurn/
├── pending/       # Jobs awaiting execution
├── jobs/          # Full manifests
├── status/        # Live job status updates
├── completed/     # Finished job records
├── archive/       # Historical records by date
├── signals/       # Bidirectional signal queue
│   ├── outbound.json
│   └── inbound.json
└── backups/       # Backup archives
```

## Platform Configuration

### Devices
- HP DVD557s (DVD burner, USB via Anker Hub)
- Driver: dvd557s_driver.exe (Windows executor)

### Destinations
- OneDrive (enabled, priority 1)
- SovereignCapsule (adapter ready)

### Features
- Bidirectional USB Signals: Enabled
- Natural Language Processing: Enabled
- Dual-Write: Enabled
- Auto-Retry: Enabled
- Post-Burn OneDrive Sync: Enabled

## Environment Variables
- `OPENAI_API_KEY` - Natural language processing (optional)
- OneDrive connection managed by Replit Connectors
