# Telemetry-Gateway

**Node Infrastructure Monitoring & Telemetry Gateway Microservice**

Lightweight, isolated microservice designed for VPS deployment. Monitors target infrastructure nodes (YouTube, Instagram, TikTok), stores historical state snapshots in a sterile SQLite ledger, calculates 24-hour execution deltas, and dispatches structured telemetry reports via the Telegram API Gateway. Includes the 5-state **Antigravity Pre-flight Diagnostic Protocol**.

---

## 1. System Architecture

- **Worker / Scheduler (`src/scheduler.js`)**: Initiates telemetry collection cycles twice daily (08:00, 20:00 UTC).
- **API Aggregator (`src/aggregator.js`)**: Asynchronously fetches channel/user metrics across platform endpoints:
  - YouTube Data API: `GET /youtube/v3/channels?statistics`
  - Instagram Graph API: `GET /instagram/graph_api/user/insights`
  - TikTok API: `GET /tiktok/api/user/stats`
- **Notification Router (`src/telegramRouter.js`)**: Calculates 24h execution deltas from the SQLite ledger (`data/telemetry.db`) and broadcasts rich telemetry reports via Telegram.
- **Antigravity Pre-Flight Gatekeeper (`src/antigravity_preflight.js`)**: Fail-fast 5-state diagnostic filter executed prior to deployment:
  1. `STATE 1: RESOURCE_AUDIT` (RAM > 150MB, Load Avg < Cores, Free Disk > 1GB)
  2. `STATE 2: DEPENDENCY_CHECK` (Version checks, zero exit code)
  3. `STATE 3: NETWORK_TOPOLOGY_PING` (Platform gateway ping check)
  4. `STATE 4: LEDGER_INTEGRITY` (SQLite I/O permissions and table validation)
  5. `STATE 5: MOCK_EXECUTION_FLOW` (Payload dispatch test)

---

## 2. Database Schema (SQLite: `data/telemetry.db`)

### `infrastructure_nodes`
| Column | Type | Description |
|---|---|---|
| `id` | UUID (PK) | Unique Node Identifier |
| `platform` | Enum | `'youtube'`, `'instagram'`, `'tiktok'` |
| `account_identifier` | String | Channel ID / Node handle |
| `api_token_or_session` | Encrypted String | AES-256-GCM encrypted credential |
| `status` | Boolean (1/0) | Node operational status |

### `metrics_ledger`
| Column | Type | Description |
|---|---|---|
| `id` | UUID (PK) | Record ID |
| `node_id` | UUID (FK) | Reference to `infrastructure_nodes.id` |
| `timestamp` | DateTime | ISO 8601 snapshot timestamp |
| `views_count` | BigInt | Absolute metric snapshot |
| `followers_count` | Int | Subscriber / follower count |
| `execution_delta` | Int | 24-hour calculated delta |

---

## 3. Quick Start & Commands

### Install Dependencies
```bash
npm install
```

### Run Antigravity Diagnostic
```bash
npm run diagnostic
```

### Seed Development Mock Data (Dev Only)
```bash
npm run db:seed:mock
```

### Run Single Telemetry Cycle
```bash
npm run telemetry:run
```

### Start Worker / Daemon
```bash
npm start
```

---

## 4. Deployment Protocol
Deployments execute `antigravity_preflight.js` first. If any test returns `HALTED` (exit code 1), deployment is aborted immediately.

```bash
./deploy.sh
# or
python deploy.py
```
