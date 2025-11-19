# Backend Setup Guide

## Prerequisites

1. **Node.js** (v18+)
2. **PostgreSQL** (v14+)
3. **Redis** (optional, for future features)

## Quick Start

### 1. Install PostgreSQL

**macOS (Homebrew):**
```bash
brew install postgresql@14
brew services start postgresql@14
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

**Windows:**
Download from https://www.postgresql.org/download/windows/

### 2. Create Database

```bash
# Connect to PostgreSQL
psql postgres

# Create database
CREATE DATABASE yesno_market;

# Create user (optional)
CREATE USER yesno_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE yesno_market TO yesno_user;

# Exit
\q
```

### 3. Configure Environment

```bash
cd apps/backend
cp env.example .env
```

**Edit `.env`:**
```env
# Database
DATABASE_URL="postgresql://yesno_user:your_password@localhost:5432/yesno_market?schema=public"

# Or if using default postgres user:
DATABASE_URL="postgresql://postgres@localhost:5432/yesno_market?schema=public"

# Blockchain (from CONTRACT_REGISTRY.md)
RPC_URL="https://sepolia.base.org"
CHAIN_ID=84532
START_BLOCK=0  # Or specific block to start indexing from

# Contract Addresses
MARKET_FACTORY_PROXY="0x01B7fB88D99D7876bb26F4C15A2c2BB8f1eD8352"
USDC_ADDRESS="0xB4FBeD6cE2256c1907a5DA4ed53c53BB1818c584"

# API
PORT=4000
CORS_ORIGIN="http://localhost:3000"
```

### 4. Install Dependencies

```bash
npm install
```

### 5. Setup Database Schema

```bash
# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push

# Or run migrations (for production)
npm run db:migrate
```

### 6. Start Services

**Terminal 1 - API Server:**
```bash
npm run dev
```

**Terminal 2 - Event Indexer:**
```bash
npm run indexer
```

### 7. Verify Setup

**Check API:**
```bash
curl http://localhost:4000/health
```

**Check Database:**
```bash
npm run db:studio
# Opens Prisma Studio in browser at http://localhost:5555
```

## Configuration Options

### START_BLOCK

Set this to the block where your MarketFactory was deployed to avoid indexing unnecessary blocks:

```env
START_BLOCK=12345678
```

To find deployment block:
1. Go to BaseScan
2. Find MarketFactory contract
3. Look at "Contract Creation" transaction
4. Use that block number

### RPC_URL

For better performance, use a dedicated RPC provider:
- **Alchemy**: https://www.alchemy.com/
- **Infura**: https://www.infura.io/
- **QuickNode**: https://www.quicknode.com/

Example:
```env
RPC_URL="https://base-sepolia.g.alchemy.com/v2/YOUR_API_KEY"
```

## Troubleshooting

### "Database does not exist"
```bash
# Create database manually
psql postgres -c "CREATE DATABASE yesno_market;"
```

### "Connection refused" (PostgreSQL)
```bash
# Check if PostgreSQL is running
brew services list  # macOS
sudo systemctl status postgresql  # Linux

# Start if not running
brew services start postgresql@14  # macOS
sudo systemctl start postgresql  # Linux
```

### "Prisma Client not generated"
```bash
npm run db:generate
```

### Indexer syncing slowly
- Use a faster RPC provider
- Reduce batch size in `src/services/indexer.ts` (BATCH_SIZE constant)
- Start from a later block (set START_BLOCK)

### Port already in use
```bash
# Change PORT in .env
PORT=4001
```

## Production Deployment

### 1. Environment Variables

Set all required env vars on your hosting platform:
- Heroku: `heroku config:set KEY=VALUE`
- Vercel: Add in dashboard
- AWS/GCP: Use secrets manager

### 2. Database

Use managed PostgreSQL:
- **Heroku Postgres**
- **AWS RDS**
- **Google Cloud SQL**
- **Supabase**
- **Railway**

### 3. Process Management

Use PM2 for process management:

```bash
npm install -g pm2

# Start API
pm2 start npm --name "yesno-api" -- start

# Start indexer
pm2 start npm --name "yesno-indexer" -- run indexer

# Save process list
pm2 save

# Setup startup script
pm2 startup
```

### 4. Monitoring

```bash
# View logs
pm2 logs

# Monitor processes
pm2 monit

# Restart on crash
pm2 restart all
```

## Next Steps

1. **Update Frontend**: Integrate backend APIs in `/apps/web`
2. **Test APIs**: Use Postman or curl to test endpoints
3. **Monitor Logs**: Check `logs/` directory for errors
4. **Setup Notifications**: Configure SMTP for email alerts

## Support

- Check `/apps/backend/README.md` for API documentation
- Review Prisma schema: `/apps/backend/prisma/schema.prisma`
- Contract addresses: `/docs/CONTRACT_REGISTRY.md`

