# Cloud Agent Install Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Cloud Agent environment builds install Docker and FUSE packages without an interactive conffile failure while preserving `/etc/fuse.conf`.

**Architecture:** Keep package installation in the existing repository install phase and Docker startup in the per-boot start phase. Configure `apt-get` to run non-interactively and tell `dpkg` to resolve conffile decisions using the default while retaining locally managed files.

**Tech Stack:** Bash, apt, dpkg, pnpm, Turborepo, Cursor Cloud environment builds.

## Global Constraints

- Preserve `/etc/fuse.conf` and its `user_allow_other` setting.
- Keep `set -euo pipefail`; do not suppress package-manager failures.
- Do not change Docker versions, storage drivers, startup behavior, or application dependencies.

---

### Task 1: Make package installation non-interactive

**Files:**
- Modify: `.cursor/cloud-agent-install.sh`
- Modify: `docs/roadmap/10b-bugs-fixed.md`
- Modify: `docs/roadmap/README.md`

**Interfaces:**
- Consumes: the base image's locally managed `/etc/fuse.conf`.
- Produces: an install command that always terminates without prompting and preserves local conffiles.

- [ ] **Step 1: Run the pre-fix regression assertion**

```bash
bash -c 'grep -q "DEBIAN_FRONTEND=noninteractive" .cursor/cloud-agent-install.sh &&
  grep -q -- "--force-confdef" .cursor/cloud-agent-install.sh &&
  grep -q -- "--force-confold" .cursor/cloud-agent-install.sh'
```

Expected: exit code 1 because the install script does not yet declare the non-interactive conffile policy.

- [ ] **Step 2: Implement the minimal install fix**

Replace the package-install command with:

```bash
sudo DEBIAN_FRONTEND=noninteractive apt-get \
  -o Dpkg::Options::="--force-confdef" \
  -o Dpkg::Options::="--force-confold" \
  install -y \
  containerd.io \
  docker-buildx-plugin \
  docker-ce \
  docker-ce-cli \
  docker-compose-plugin \
  fuse-overlayfs \
  iptables
```

- [ ] **Step 3: Record the fixed build failure**

Append a fixed-bug entry explaining that the base image's locally created
`/etc/fuse.conf` triggered an unattended `dpkg` prompt, and that the install
now preserves local conffiles explicitly. Add the next bug number to the
roadmap archive summary.

- [ ] **Step 4: Run static verification**

```bash
bash -n .cursor/cloud-agent-install.sh
bash -c 'grep -q "DEBIAN_FRONTEND=noninteractive" .cursor/cloud-agent-install.sh &&
  grep -q -- "--force-confdef" .cursor/cloud-agent-install.sh &&
  grep -q -- "--force-confold" .cursor/cloud-agent-install.sh'
```

Expected: both commands exit 0.

- [ ] **Step 5: Commit and push the implementation**

```bash
git add .cursor/cloud-agent-install.sh docs/roadmap/10b-bugs-fixed.md docs/roadmap/README.md
git commit -m "Fix unattended Cloud Agent package install"
git push -u origin cursor/fix-cloud-install-f4e5
```

- [ ] **Step 6: Run the corrected install and verify package state**

```bash
bash .cursor/cloud-agent-install.sh
sudo dpkg --audit
dpkg-query -W -f='${Package}\t${Status}\t${Version}\n' fuse3 fuse-overlayfs docker-ce
sudo grep -Fx user_allow_other /etc/fuse.conf
```

Expected: the install and monorepo build succeed, `dpkg --audit` prints
nothing, all three packages report `install ok installed`, and the grep
prints `user_allow_other`.

- [ ] **Step 7: Trigger and inspect a draft environment build**

Trigger a draft build using branch `cursor/fix-cloud-install-f4e5`, wait for
terminal status, and fetch its complete logs.

Expected: build status `SUCCEEDED`; logs show the install script and `pnpm
build` complete without a conffile prompt or package-manager error.

- [ ] **Step 8: Verify the exact build in a fresh Cloud Agent**

Start a cloud subagent from the successful draft build and branch. Verify
`dpkg --audit`, Docker readiness through `.cursor/cloud-agent-start.sh`, and
the Docker storage driver.

Expected: no unconfigured packages, the start script exits 0, and `docker
info` reports a usable storage driver.
