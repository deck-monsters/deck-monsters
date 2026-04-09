# Observability Guide

Deck Monsters exposes Prometheus-format metrics at `GET /metrics` via
[prom-client](https://github.com/siimon/prom-client).

**Phase 1 (current):** Direct scraping from Grafana Cloud — the server already
has a public Railway domain, so no extra service is needed. Just point Grafana
Cloud at the endpoint and protect it with a bearer token.

**Phase 2 (future, if the server is made private):** Replace direct scraping
with [Grafana Alloy](https://railway.com/deploy/grafanaalloyrailway) running
inside the Railway project, which can reach the server over Railway's internal
network (`server.railway.internal`) and push to Grafana Cloud. See the
[Alloy section](#future-grafana-alloy-on-railway) at the bottom of this doc
for the setup notes when that time comes.

---

## Setup — Direct Grafana Cloud scrape

### 1. Create a Grafana Cloud account

Sign up at [grafana.com](https://grafana.com). The free tier gives 10k active
series, 50 GB logs, and 14-day retention — more than enough for this game.

### 2. Get a Prometheus API token

In your Grafana Cloud stack, go to **Connections → Add new connection →
Hosted Prometheus metrics**. Click **Generate now** under *Password / API
Token* and copy the token.

### 3. Set `METRICS_TOKEN` on the Railway server service

Generate a secret and add it to the **server** service's environment variables
in Railway:

```bash
openssl rand -hex 32
```

| Variable | Value |
|---|---|
| `METRICS_TOKEN` | The hex string from above |

When this variable is set, the server returns `401` to any request that doesn't
include `Authorization: Bearer <token>`. When unset, the endpoint is open
(safe for local dev).

### 4. Add a Prometheus data source in Grafana Cloud

1. In your Grafana Cloud stack, go to **Connections → Add new connection → Prometheus**.
2. Set **URL** to `https://<your-server>.up.railway.app/metrics`.
3. Under **Custom HTTP headers**, add:
   - **Header**: `Authorization`
   - **Value**: `Bearer <your METRICS_TOKEN>`
4. Set **Scrape interval** to `15s`.
5. Click **Save & test** — you should see *"Data source is working"*.

---

---

## Future: Grafana Alloy on Railway

If the server is later split into a public-facing gateway and a private API
(or the `/metrics` path is moved off the public surface entirely), direct
Grafana Cloud scraping will stop working. At that point, deploy
[Grafana Alloy](https://railway.com/deploy/grafanaalloyrailway) as a Railway
service — it runs inside the project, scrapes `server.railway.internal:3000`
over the private network, and pushes to Grafana Cloud's remote_write endpoint.

### Alloy config (`infra/alloy/config.alloy`)

```river
// Scrape the server over Railway private networking
prometheus.scrape "deck_monsters_server" {
  targets = [
    {
      "__address__" = "server.railway.internal:3000",
      "job"         = "deck-monsters-server",
    },
  ]

  metrics_path    = "/metrics"
  scrape_interval = "15s"
  bearer_token    = env("METRICS_TOKEN")

  forward_to = [prometheus.remote_write.grafana_cloud.receiver]
}

// Push to Grafana Cloud
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

Mount this config via a small Dockerfile for the Alloy service:

```dockerfile
# infra/alloy/Dockerfile
FROM grafana/alloy:latest
COPY config.alloy /etc/alloy/config.alloy
CMD ["run", "/etc/alloy/config.alloy", "--storage.path=/var/lib/alloy/data"]
```

Set these env vars on the Alloy service in Railway:

| Variable | Value |
|---|---|
| `GRAFANA_CLOUD_PROM_URL` | `https://prometheus-prod-XX.grafana.net/api/prom/push` |
| `GRAFANA_CLOUD_PROM_USER` | Numeric user ID from the Grafana Cloud Prometheus connection page |
| `GRAFANA_CLOUD_PROM_API_KEY` | API token generated in Grafana Cloud |
| `METRICS_TOKEN` | Same value as on the server service |

> `server.railway.internal` resolves to the **server** service within the same
> Railway project. Adjust the hostname if your service has a different name.
> The Grafana Cloud data source configured in step 4 above can be removed once
> Alloy is pushing — or kept pointing at the public URL as a fallback.

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
