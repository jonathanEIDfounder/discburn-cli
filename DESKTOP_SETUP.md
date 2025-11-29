# DiscBurn Desktop Executor Setup

## The Problem
Phones cannot control DVD burners - they lack USB drivers. The burn must happen on a computer.

## Solution
Run this Replit code on your Windows/Mac computer that's connected to the HP DVD557s.

## Quick Setup (Windows)

### 1. Download This Code
- Click "Download as ZIP" in Replit
- Or clone: `git clone [your-repl-url]`

### 2. Install Prerequisites
```cmd
# Install Node.js from https://nodejs.org
# Then in the downloaded folder:
npm install
```

### 3. Install DVD Driver
Run the driver from `attached_assets/dvd557s_driver_*.exe`

### 4. Connect Hardware
- HP DVD557s -> USB cable -> Your Computer
- Insert blank DVD-R

### 5. Run Executor
```cmd
npx tsx run-cli.ts execute
```

## Commands on Desktop

```bash
# Execute next pending burn job
npx tsx run-cli.ts execute

# Watch for jobs continuously  
npx tsx run-cli.ts automate

# Check status
npx tsx run-cli.ts status
```

## Flow
```
Phone (queue jobs) -> OneDrive -> Desktop (execute burns) -> DVD557s
                                        |
                                        v
                              OneDrive (sync results back)
```

## OneDrive Sync
The desktop executor will:
1. Pull jobs from OneDrive/DiscBurn/pending/
2. Execute the burn on DVD557s
3. Save results to OneDrive/DiscBurn/completed/
