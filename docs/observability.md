# Observability Guide

Deck Monsters exposes Prometheus-format metrics at `GET /metrics` via
[prom-client](https://github.com/siimon/prom-client). This guide covers two
ways to get those metrics into Grafana:

| Approach | When to use |
|---|---|
| **A — Grafana Alloy on Railway** (recommended) | Production. Alloy runs inside your Railway project and scrapes the server over the private internal network, then pushes to Grafana Cloud. Metrics never traverse the public internet. |
| **B — Direct Grafana Cloud scrape** | Quick local testing or if you're already comfortable exposing `/metrics` behind `METRICS_TOKEN`. |

---

## A — Grafana Alloy on Railway (recommended)

Grafana Alloy is a lightweight telemetry collector. Running it as a Railway
service means it can reach `server.railway.internal:3000` without the server
needing to be publicly accessible.

### A1. Grafana Cloud — get credentials

1. Create a free account at [grafana.com](https://grafana.com) (10k series, 50 GB logs, 14-day retention — more than enough).
2. In your Grafana Cloud stack, go to **Connections → Add new connection → Hosted Prometheus metrics**.
3. Click **Generate now** under *Password / API Token*. Copy the token.
4. Note the three values on that page:

| Variable | Example value |
|---|---|
| `GRAFANA_CLOUD_PROM_URL` | `https://prometheus-prod-13-prod-us-east-0.grafana.net/api/prom/push` |
| `GRAFANA_CLOUD_PROM_USER` | `123456` (numeric user ID) |
| `GRAFANA_CLOUD_PROM_API_KEY` | The token you just generated |

### A2. Deploy Alloy on Railway

Click **[Deploy Grafana Alloy on Railway](https://railway.com/deploy/grafanaalloyrailway)** and select your existing Deck Monsters project when prompted. This adds an **Alloy** service to your project.

> If the one-click deploy creates a new project instead of adding to an existing one, create a new Railway service manually and use the `grafana/alloy:latest` Docker image.

### A3. Write the Alloy config

Create a file `infra/alloy/config.alloy` in your repo:

```river
// ── Scrape the server over Railway private networking ─────────────────────
prometheus.scrape "deck_monsters_server" {
  targets = [
    {
      "__address__" = "server.railway.internal:3000",
      "job"         = "deck-monsters-server",
    },
  ]

  metrics_path    = "/metrics"
  scrape_interval = "15s"

  // METRICS_TOKEN is optional when scraping over the private network, but
  // keeping it here means the same config works if the server is later moved
  // behind a public gateway.
  bearer_token = env("METRICS_TOKEN")

  forward_to = [prometheus.remote_write.grafana_cloud.receiver]
}

// ── Push to Grafana Cloud ─────────────────────────────────────────────────
prometheus.remote_write "grafana_cloud" {
  endpoint {
    url = env("GRAFANA_CLOUD_PROM_URL")

    basic_auth {
      username = env("GRAFANA_CLOUD_PROM_USER")
      password = env("GRAFANA_CLOUD_PROM_API_KEY")
    }
  }
}
```

> **`server.railway.internal`** is Railway's private DNS name for any service
> named *server* in the same project. If you renamed your server service in
> Railway, adjust the hostname accordingly. The port is the value of `PORT`
> on the server (default `3000`).

### A4. Mount the config into the Alloy service

In the Alloy service on Railway, go to **Settings → Config-as-code** and point
it at a `Dockerfile` that copies your config in:

```dockerfile
# infra/alloy/Dockerfile
FROM grafana/alloy:latest
COPY config.alloy /etc/alloy/config.alloy
CMD ["run", "/etc/alloy/config.alloy", "--storage.path=/var/lib/alloy/data"]
```

Then set **Root directory** to `infra/alloy/` in the service settings.

Alternatively, pass the config inline via the `CONFIG_FILE` environment
variable if the Railway template supports it — check the template's README.

### A5. Set environment variables on the Alloy service

| Variable | Value |
|---|---|
| `GRAFANA_CLOUD_PROM_URL` | Prometheus remote_write URL from step A1 |
| `GRAFANA_CLOUD_PROM_USER` | Numeric user ID from step A1 |
| `GRAFANA_CLOUD_PROM_API_KEY` | API token from step A1 |
| `METRICS_TOKEN` | Same value as set on the **server** service (optional for private-network scrape, but keeps the config portable) |

Also set these on the **server** service if not already set:

| Variable | Value |
|---|---|
| `METRICS_TOKEN` | A random secret — `openssl rand -hex 32` |

### A6. Verify

After both services redeploy, check Alloy's logs in Railway — you should see
lines like:

```
level=info  component=prometheus.scrape targets_discovered=1
level=info  component=prometheus.remote_write  samples_sent=123
```

In Grafana Cloud, go to **Explore → Metrics** and type `dm_` — you should see
your custom metrics populating within a minute.

---

## B — Direct Grafana Cloud scrape (simpler)

If the server has a public Railway domain and you're happy to expose `/metrics`
behind a bearer token, Grafana Cloud can scrape it directly — no extra service
needed.

### B1. Set `METRICS_TOKEN` on the server

```bash
openssl rand -hex 32
# → set this as METRICS_TOKEN in Railway's server service environment variables
```

### B2. Add a Prometheus data source in Grafana Cloud

1. In your Grafana Cloud stack, go to **Connections → Add new connection → Prometheus**.
2. Set **URL** to `https://<your-server>.up.railway.app/metrics`.
3. Under **Custom HTTP headers**, add:
   - **Header**: `Authorization`
   - **Value**: `Bearer <your METRICS_TOKEN>`
4. Set **Scrape interval** to `15s`.
5. Click **Save & test** — you should see *"Data source is working"*.

---

## Available metrics

All custom metrics are prefixed `dm_` and carry a `service="deck-monsters"` default label. Most carry a `room_id` label for per-room filtering.

### Battle

| Metric | Type | Description |
|---|---|---|
| `dm_battles_started_total` | Counter | Battles started (countdown fired) |
| `dm_battles_completed_total` | Counter | Battles completed |
| `dm_battle_duration_ms` | Histogram | Combat duration (ms), from countdown end to fight conclusion |
| `dm_battle_rounds` | Histogram | Rounds per battle |
| `dm_battle_participants` | Histogram | Monsters per battle |
| `dm_battle_avg_monster_level` | Histogram | Average monster level in a battle |
| `dm_battle_min_monster_level` | Histogram | Lowest monster level in a battle |
| `dm_battle_max_monster_level` | Histogram | Highest monster level in a battle |
| `dm_battle_round_duration_ms` | Histogram | Average ms per round |

### Monster outcomes

| Metric | Type | Description |
|---|---|---|
| `dm_player_wins_total` | Counter | Monster wins |
| `dm_player_losses_total` | Counter | Monster losses |
| `dm_player_draws_total` | Counter | Draws |
| `dm_player_fled_total` | Counter | Monsters that fled |
| `dm_monster_perm_deaths_total` | Counter | Permanent deaths |
| `dm_boss_spawns_total` | Counter | Boss spawns |
| `dm_monsters_in_ring` | Gauge | Monsters currently in the ring |

### Rooms & commands

| Metric | Type | Description |
|---|---|---|
| `dm_rooms_created_total` | Counter | Rooms ever created |
| `dm_rooms_active` | Gauge | Rooms currently loaded in memory |
| `dm_commands_total` | Counter | Commands processed; labels: `result` (`ok` / `rejected` / `error`) |
| `dm_ws_connections_active` | Gauge | Active WebSocket ringFeed subscribers |

### Errors & warnings

| Metric | Type | Description |
|---|---|---|
| `dm_card_errors_total` | Counter | Invalid card played mid-fight |
| `dm_card_validation_warnings_total` | Counter | Bad card detected at ring-join time |
| `dm_fight_errors_total` | Counter | Unexpected error — fight cancelled and ring cleared |
| `dm_room_hydration_failures_total` | Counter | State blob could not be restored — fresh game started |
| `dm_room_hydration_warnings_total` | Counter | Non-fatal partial hydration warning |
| `dm_prompt_timeouts_total` | Counter | Interactive prompts that timed out |

Node.js process metrics (`go_*`, `process_*`, `nodejs_*`) are also collected via `collectDefaultMetrics`.

---

## Starter Grafana queries

Paste these into a Grafana **Explore** panel (Prometheus data source) to get started:

```promql
# Battle rate (per minute, averaged over 5m)
rate(dm_battles_completed_total[5m]) * 60

# Average battle duration (ms) over 5m
rate(dm_battle_duration_ms_sum[5m]) / rate(dm_battle_duration_ms_count[5m])

# Win rate (wins as % of losses+wins)
rate(dm_player_wins_total[5m])
  / (rate(dm_player_wins_total[5m]) + rate(dm_player_losses_total[5m]))

# Command error rate
rate(dm_commands_total{result="error"}[5m])

# Active WebSocket connections
dm_ws_connections_active

# Monsters in ring per room
dm_monsters_in_ring

# Node.js event loop lag (p99)
histogram_quantile(0.99, rate(nodejs_eventloop_lag_seconds_bucket[5m]))
```

---

## Alerting suggestions

| Alert | Query | Threshold |
|---|---|---|
| Fight errors spiking | `rate(dm_fight_errors_total[10m])` | > 0.1 / min |
| No battles in 30 min | `increase(dm_battles_completed_total[30m])` | == 0 (if ring is active) |
| Hydration failures | `increase(dm_room_hydration_failures_total[1h])` | > 0 |
| High prompt timeout rate | `rate(dm_prompt_timeouts_total[5m])` | > 0.5 / min |
