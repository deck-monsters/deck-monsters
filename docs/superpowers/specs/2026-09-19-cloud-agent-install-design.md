# Cloud Agent install conffile fix

## Problem

The Cloud Agent environment install runs `apt-get install -y` for Docker and
`fuse-overlayfs`. The base image already contains a locally created
`/etc/fuse.conf` with `user_allow_other`. When `fuse3` is installed, `dpkg`
asks whether to replace that file. Environment builds have no interactive
stdin, so the prompt receives EOF, exits with an error, and leaves `fuse3` and
`fuse-overlayfs` unconfigured.

## Design

Keep the current environment lifecycle: install Docker packages during the
repository install phase and start Docker during the per-boot start phase.
Make the package installation explicitly non-interactive and pass
`--force-confdef` plus `--force-confold` to `dpkg`.

This policy resolves conffile prompts using their defaults and preserves
locally managed configuration. In particular, it retains the base image's
`user_allow_other` setting instead of replacing or deleting `/etc/fuse.conf`.

## Scope

- Update `.cursor/cloud-agent-install.sh`.
- Record the environment-build failure and root cause in the fixed-bug archive.
- Do not change Docker versions, storage drivers, startup behavior, or
  application dependencies.

## Verification

1. Run a regression assertion before the patch and confirm the install script
   lacks the required non-interactive conffile policy.
2. Check the updated script with `bash -n`.
3. Run the corrected package-install command against the restored failed build
   state and confirm all Docker/FUSE packages configure successfully.
4. Confirm `/etc/fuse.conf` still contains `user_allow_other`.
5. Run the Cloud Agent install script and verify the monorepo build completes.
6. Trigger a draft environment build and inspect its complete logs.

## Error handling

The script retains `set -euo pipefail`, so package, dependency, and build
failures remain fatal. The new policy only removes the interactive conffile
decision; it does not suppress package-manager errors.
