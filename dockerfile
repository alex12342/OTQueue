FROM node:24-bookworm

# Install PostgreSQL, sudo, Nginx, and clean up cache
RUN apt-get update && apt-get install -y postgresql postgresql-contrib sudo nginx \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm globally to match your Replit environment
RUN npm install -g pnpm

WORKDIR /app

# Copy the entire workspace configuration and source files
COPY . .

# Tell pnpm it is safe to run build/compilation scripts in this isolated container
ENV PNPM_CONFIG_DANGEROUSLY_ALLOW_ALL_BUILDS=true

# Provide the environment variables required during the build phase by the Vite configuration
ENV PORT=8080
ENV BASE_PATH=/

# Install dependencies and build all monorepo packages
RUN pnpm install
RUN pnpm run build

# Expose port 80 where Nginx will handle our main frontend traffic
EXPOSE 80

# Configure default Environment Variables
ENV NODE_ENV=production
ENV DATABASE_URL=postgresql://postgres:postgres@localhost:5432/otqueue

# Copy and prepare the startup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
