# Devcontainer and Public GitHub Auth

This repository supports a devcontainer setup that isolates public GitHub credentials inside the container instead of on the host machine.

## Why

- Host machine auth is used for Salesforce GitHub Enterprise workflows.
- This repo is on public GitHub.
- Keeping public GitHub credentials in the container lowers accidental cross-use risk.

## Setup

1. Open the repository in VS Code / Cursor.
2. Reopen in container (`.devcontainer/devcontainer.json`).
3. Inside the container terminal, authenticate:

```bash
gh auth login
```

Choose GitHub.com and HTTPS auth. Credentials are stored in the container-only volume mounted at `/home/node/.config/gh`.

## Git identity inside container

The container config sets a default git identity on startup if none exists:

- `user.name = Deck Monsters Dev`
- `user.email = devcontainer@example.local`

Update these values inside the container as needed:

```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

## Storage isolation

The devcontainer mounts named Docker volumes for:

- `/home/node/.gitconfig`
- `/home/node/.ssh`
- `/home/node/.config/gh`

These volumes are independent from host home-directory credential files.
