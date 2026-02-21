# syntax=docker/dockerfile:1

# --- Build stage ---
# cgr.dev/chainguard/node:latest-dev is Wolfi-based (glibc) with shell, apk, and build tooling.
FROM cgr.dev/chainguard/node:latest-dev AS builder

USER root

# Install bun (required for canvas:a2ui:bundle build step)
RUN apk add --no-cache bun

# Enable pnpm via corepack (ships with Node.js 16.9+)
RUN corepack enable

WORKDIR /app

# Optional extra apk packages (equivalent to former OPENCLAW_DOCKER_APT_PACKAGES).
# Package names follow wolfi/apk conventions, not apt.
ARG OPENCLAW_DOCKER_APT_PACKAGES=""
RUN if [ -n "$OPENCLAW_DOCKER_APT_PACKAGES" ]; then \
      apk add --no-cache $OPENCLAW_DOCKER_APT_PACKAGES; \
    fi

# Layer-cache dependency manifests before copying source
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY ui/package.json ./ui/package.json
COPY patches ./patches
COPY scripts ./scripts

RUN pnpm install --frozen-lockfile

# Optionally bake Chromium into the image for browser automation.
# Build with: docker build --build-arg OPENCLAW_INSTALL_BROWSER=1 ...
# On Wolfi, chromium is installed via apk (no apt); xvfb is xvfb-run.
ARG OPENCLAW_INSTALL_BROWSER=""
RUN if [ -n "$OPENCLAW_INSTALL_BROWSER" ]; then \
      apk add --no-cache chromium xvfb-run; \
    fi

COPY . .

# Force pnpm for UI build (bun may fail on ARM/Synology)
ENV OPENCLAW_PREFER_PNPM=1
RUN pnpm build && pnpm ui:build

# Strip devDependencies before copying to runtime stage
RUN pnpm prune --prod

# --- Runtime stage ---
# Minimal Chainguard node image — no shell, no package manager, runs as nonroot (uid 65532).
FROM cgr.dev/chainguard/node:latest

WORKDIR /app

# Copy built artifacts and pruned production node_modules.
# packages/ is included because pnpm workspace symlinks in node_modules point into it.
COPY --from=builder --chown=nonroot:nonroot /app/dist ./dist
COPY --from=builder --chown=nonroot:nonroot /app/node_modules ./node_modules
COPY --from=builder --chown=nonroot:nonroot /app/packages ./packages
COPY --from=builder --chown=nonroot:nonroot /app/openclaw.mjs ./openclaw.mjs
COPY --from=builder --chown=nonroot:nonroot /app/package.json ./package.json
COPY --from=builder --chown=nonroot:nonroot /app/pnpm-workspace.yaml ./pnpm-workspace.yaml

# Chainguard images already run as nonroot (uid 65532) — no USER directive needed.

ENV NODE_ENV=production

# Gateway WebSocket/HTTP port
EXPOSE 18789

# Chainguard node image uses ENTRYPOINT ["/usr/bin/node"], so CMD args are passed to node.
# --bind lan: listen on all interfaces (required for container networking, not just loopback).
CMD ["openclaw.mjs", "gateway", "--allow-unconfigured", "--bind", "lan"]
