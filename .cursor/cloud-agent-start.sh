#!/usr/bin/env bash
set -euo pipefail

# A daemon started during an environment build does not survive the snapshot.
# Reconcile Docker on every pod boot and wait for the socket to become usable.
if ! sudo docker info >/dev/null 2>&1; then
  sudo service docker start || true
fi

for _attempt in $(seq 1 30); do
  if sudo test -S /var/run/docker.sock; then
    sudo chmod 666 /var/run/docker.sock
  fi

  if docker info >/dev/null 2>&1; then
    exit 0
  fi

  sleep 1
done

echo "Docker did not become ready within 30 seconds." >&2
sudo service docker status || true
exit 1
