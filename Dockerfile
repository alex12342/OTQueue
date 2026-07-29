FROM node:24-bookworm

# Install PostgreSQL, sudo, Nginx, and clean up cache
RUN apt-get update && apt-get install -y postgresql postgresql-contrib sudo nginx \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm globally to match your Replit environment
RUN npm install -g pnpm

# Install tsx globally for running TypeScript seed scripts at runtime
RUN npm install -g tsx

WORKDIR /app

# Copy the entire workspace configuration and source files
COPY . .

# Tell pnpm it is safe to run build/compilation scripts in this isolated container
ENV PNPM_CONFIG_DANGEROUSLY_ALLOW_ALL_BUILDS=true

# Provide the environment variables required during the build phase by the Vite configuration
ENV PORT=8080
ENV BASE_PATH=/

# Install dependencies and build all monorepo packages
RUN pnpm install -y
RUN pnpm run build

# Expose port 80 where Nginx will handle our main frontend traffic
EXPOSE 80

# Configure default Environment Variables
ENV NODE_ENV=production
ENV DATABASE_URL=postgresql://postgres:postgres@localhost:5432/otqueue
# JWT_SECRET is generated at runtime by entrypoint.sh and persisted in /app/data/.jwt-secret

# PUID/PGID for file ownership (default: root)
ENV PUID=0
ENV PGID=0

# Copy and prepare the startup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
