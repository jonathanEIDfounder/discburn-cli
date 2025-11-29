# DiscBurn CLI

Universal command-line interface for file packaging, cloud backup, and DVD burning with HP DVD557s.

## Quick Start (Offline)

```bash
# Clone repository
git clone https://github.com/jonathanEIDfounder/discburn-cli.git
cd discburn-cli

# Install dependencies
npm install

# Run automation
npx tsx automate.ts

# Or run interactive CLI
npx tsx run-cli.ts
```

## Architecture

```
Phone (queue jobs) → OneDrive → Desktop Executor → HP DVD557s
                                      ↓
                              OneDrive (results)
```

## Commands

| Command | Description |
|---------|-------------|
| `burn` | Create burn job |
| `execute` | Execute pending burn |
| `status` | Show system status |
| `watch` | Monitor signals |
| `help` | Show all commands |

## Files Structure

```
├── automate.ts          # Main automation script
├── run-cli.ts           # CLI entry point
├── src/
│   ├── cli/             # Command-line interface
│   ├── core/            # Business logic
│   ├── adapters/        # External services
│   └── storage/         # Persistence
├── components/          # React Native UI
├── screens/             # App screens
├── hooks/               # Custom hooks
└── utils/               # Utilities
```

## Desktop Setup

1. Install Node.js from https://nodejs.org
2. Install HP DVD557s driver
3. Connect DVD burner via USB
4. Run `npx tsx automate.ts`

## Requirements

- Node.js 18+
- HP DVD557s DVD burner
- OneDrive account (for job sync)

## License

MIT
