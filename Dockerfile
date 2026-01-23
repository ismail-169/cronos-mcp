FROM node:18-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-workspace.yaml* ./
COPY apps/registry/package.json ./apps/registry/
COPY packages/*/package.json ./packages/

# Install dependencies
RUN pnpm install --no-frozen-lockfile

# Copy source
COPY . .

# Build registry
RUN pnpm run build --filter=@cronos-mcp/registry || echo "No build step"

# Expose port
EXPOSE 3010

# Set environment
ENV PORT=3010
ENV HOST=0.0.0.0

# Start
CMD ["pnpm", "run", "start", "--filter=@cronos-mcp/registry"]