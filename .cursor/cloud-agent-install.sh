#!/usr/bin/env bash
set -euo pipefail

# Install Docker without starting it. Environment builds preserve packages and
# configuration, but not running processes; startup belongs in the start phase.
sudo install -m 0755 -d /etc/apt/keyrings
curl --retry 3 --retry-delay 5 -fsSL https://download.docker.com/linux/ubuntu/gpg |
  sudo gpg --batch --yes --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

docker_arch="$(dpkg --print-architecture)"
. /etc/os-release
echo "deb [arch=${docker_arch} signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" |
  sudo tee /etc/apt/sources.list.d/docker.list >/dev/null

sudo apt-get update
sudo apt-get install -y \
  containerd.io \
  docker-buildx-plugin \
  docker-ce \
  docker-ce-cli \
  docker-compose-plugin \
  fuse-overlayfs \
  iptables
sudo rm -rf /var/lib/apt/lists/*

sudo install -m 0755 -d /etc/docker
printf '%s\n' '{' '  "storage-driver": "fuse-overlayfs"' '}' |
  sudo tee /etc/docker/daemon.json >/dev/null
sudo update-alternatives --set iptables /usr/sbin/iptables-legacy 2>/dev/null || true
sudo update-alternatives --set ip6tables /usr/sbin/ip6tables-legacy 2>/dev/null || true

# Install Railway in the NVM-managed Node prefix so it remains on the agent PATH.
npm install --global @railway/cli@5.30.3

pnpm install --frozen-lockfile
pnpm build
