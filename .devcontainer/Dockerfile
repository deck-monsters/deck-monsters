FROM mcr.microsoft.com/devcontainers/javascript-node:1-22-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends \
	git \
	openssh-client \
	gnupg \
	ca-certificates \
	curl \
	&& curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
		| dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
	&& chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg \
	&& echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
		> /etc/apt/sources.list.d/github-cli.list \
	&& apt-get update && apt-get install -y --no-install-recommends \
	gh \
	&& rm -rf /var/lib/apt/lists/*

