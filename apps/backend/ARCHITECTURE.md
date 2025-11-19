# Backend Architecture

## Overview

The YesNo backend is a production-ready Node.js application that indexes blockchain events, manages user data, and provides REST APIs for the frontend. It solves the critical problem of tracking unclaimed funds across all markets and notifying users.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (Next.js)                       │
│  - User Dashboard                                                │
│  - Market Pages                                                  │
│  - Admin Panel                                                   │
└────────────────┬────────────────────────────────────────────────┘
                 │ HTTP/REST
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Express API Server                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ User Routes  │  │Market Routes │  │Admin Routes  │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PostgreSQL Database                           │
│  - Users                                                         │
│  - Markets                                                       │
│  - UserPositions                                                 │
│  - Trades                                                        │
│  - LPActions                                                     │
│  - Claims                                                        │
│  - Notifications                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      Event Indexer Service                       │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ 1. Sync Historical Events (batch processing)            │   │
│  │ 2. Listen for New Events (real-time)                    │   │
│  │ 3. Process Events → Update Database                     │   │
│  │ 4. Create Notifications                                 │   │
│  └──────────────────────────────────────────────────────────┘   │
└────────────────┬────────────────────────────────────────────────┘
                 │ Ethers.js
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Base Sepolia Blockchain                       │
│  - MarketFactory Contract                                        │
│  - Market Contracts                                              │
│  - Events: MarketCreated, TokensPurchased, WinningsClaimed, etc.│
└─────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Express API Server (`src/index.ts`)

**Purpose**: HTTP REST API for frontend  
**Port**: 4000 (configurable)  
**Features**:
- CORS enabled
- Rate limiting (100 req/15min)
- Helmet security headers
- Compression
- Error handling

**Routes**:
- `/api/users/*` - User data and positions
- `/api/markets/*` - Market data and stats
- `/api/admin/*` - Admin dashboard APIs

### 2. Event Indexer (`src/services/indexer.ts`)

**Purpose**: Index blockchain events into database  
**Process**:
1. **Historical Sync**: Batch process events from START_BLOCK to current
2. **Real-time Listening**: Subscribe to new events
3. **Event Processing**: Parse and store in database
4. **Notification Creation**: Alert users of important events

**Events Indexed**:
- `MarketCreated` (MarketFactory)
- `TokensPurchased`, `TokensSold` (Market)
- `LiquidityAdded`, `LiquidityRemoved` (Market)
- `WinningsClaimed` (Market)
- `MarketResolved`, `MarketCanceled`, `MarketFinalized` (Market)

**Performance**:
- Batch size: 5000 blocks
- Parallel event fetching
- Incremental sync (tracks last block)

### 3. Event Processor (`src/services/eventProcessor.ts`)

**Purpose**: Business logic for processing events  
**Responsibilities**:
- Create/update User records
- Create/update Market records
- Track UserPositions (outcome tokens + LP tokens)
- Record Trade history
- Record LPAction history
- Record Claim history
- Create Notifications

**Key Logic**:
- Automatically creates users on first interaction
- Updates position flags (`hasOutcomeTokens`, `hasLPTokens`, `hasClaimed`)
- Calculates market volume
- Notifies users on market resolution
- Notifies LPs on market finalization

### 4. Database (Prisma + PostgreSQL)

**Schema Highlights**:

**User**
- `address` (unique, indexed)
- Relations: positions, trades, lpActions, claims

**Market**
- `address` (unique, indexed)
- `question`, `outcomes`, `status`, `winningOutcome`
- `totalReserves`, `reserves[]`, `accumulatedFees`
- `finalized`, `finalizedAt`
- Relations: positions, trades, lpActions, claims

**UserPosition**
- Unique per (user, market)
- `outcomeBalances[]` - Array of token balances per outcome
- `lpBalance` - LP token balance
- `totalInvested`, `totalClaimed`
- Flags: `hasOutcomeTokens`, `hasLPTokens`, `hasClaimed`

**Trade**
- `txHash` (unique, indexed)
- `outcome`, `isBuy`, `amount`, `tokensAmount`, `price`, `fee`
- Timestamp indexed

**LPAction**
- `txHash` (unique, indexed)
- `isAdd`, `collateralAmount`, `lpTokenAmount`
- Timestamp indexed

**Claim**
- `txHash` (unique, indexed)
- `outcome`, `tokensAmount`, `payoutAmount`
- Timestamp indexed

**Notification**
- `type`: "unclaimed_funds", "market_resolved", "market_finalized"
- `read`, `sent` flags
- Indexed by userId, read status

**SyncState**
- Tracks last synced block per contract
- Enables incremental indexing

## API Endpoints

### User Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/users/:address` | GET | User profile and stats |
| `/api/users/:address/unclaimed` | GET | Unclaimed winning positions |
| `/api/users/:address/lp-unclaimed` | GET | LP positions in finalized markets |
| `/api/users/:address/notifications` | GET | User notifications |
| `/api/users/notifications/:id/read` | PATCH | Mark notification as read |

### Market Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/markets` | GET | List markets (with filters) |
| `/api/markets/:address` | GET | Market details |
| `/api/markets/:address/participants` | GET | All traders and LPs |
| `/api/markets/:address/unclaimed-winners` | GET | Users who haven't claimed |
| `/api/markets/:address/stats` | GET | Market statistics |

### Admin Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/admin/markets` | GET | All markets for admin |
| `/api/admin/markets/ready-to-finalize` | GET | Markets ready to finalize |
| `/api/admin/stats` | GET | Platform-wide stats |
| `/api/admin/activity` | GET | Recent activity |
| `/api/admin/users/unclaimed` | GET | Users with unclaimed funds |

## Key Features

### 1. Unclaimed Funds Tracking

**Problem**: Users don't know which markets have unclaimed funds  
**Solution**: Backend tracks all positions and notifies users

**Flow**:
1. User trades → Event indexed → Position updated
2. Market resolves → Notification created
3. User claims → Position marked as claimed
4. Market finalized → LPs notified of additional funds

**API**: `GET /api/users/:address/unclaimed`

### 2. Market Finalization Support

**Problem**: Admin needs to know when it's safe to finalize markets  
**Solution**: Backend tracks unclaimed winners per market

**Flow**:
1. Market resolves
2. Winners claim over time
3. Backend tracks remaining unclaimed winners
4. When all claimed → Market appears in "ready to finalize" list
5. Admin calls `finalizeMarket()` on contract
6. Backend detects `MarketFinalized` event
7. LPs notified via notifications

**API**: `GET /api/admin/markets/ready-to-finalize`

### 3. Real-time Position Tracking

**Problem**: Frontend makes many RPC calls to get user positions  
**Solution**: Backend maintains up-to-date position data

**Benefits**:
- Faster load times
- Reduced RPC costs
- Historical data available
- Cross-market queries possible

### 4. Notification System

**Types**:
- `market_resolved`: Market you're in has been resolved
- `market_finalized`: LP market has been finalized (more funds available)
- `unclaimed_funds`: Reminder about unclaimed funds (future)

**Future**: Email/push notifications via SMTP/Web Push API

## Deployment

### Development

```bash
# Terminal 1: API Server
cd apps/backend
npm run dev

# Terminal 2: Event Indexer
npm run indexer
```

### Production

**Option 1: Single Server (PM2)**
```bash
pm2 start npm --name "yesno-api" -- start
pm2 start npm --name "yesno-indexer" -- run indexer
pm2 save
pm2 startup
```

**Option 2: Separate Services**
- API Server → Vercel/Railway/Heroku
- Indexer → Background worker (Railway/Render)
- Database → Managed PostgreSQL (Supabase/Railway)

**Environment Variables** (production):
- `DATABASE_URL` - Managed PostgreSQL connection
- `RPC_URL` - Dedicated RPC provider (Alchemy/Infura)
- `START_BLOCK` - MarketFactory deployment block
- `CORS_ORIGIN` - Production frontend URL

## Performance Considerations

### Indexer Optimization

1. **Batch Size**: 5000 blocks (adjustable)
2. **Parallel Fetching**: All event types fetched concurrently
3. **Incremental Sync**: Only new blocks processed
4. **Error Recovery**: Continues from last synced block on restart

### API Optimization

1. **Database Indexing**: All foreign keys and query fields indexed
2. **Pagination**: Markets endpoint supports pagination
3. **Rate Limiting**: Prevents abuse
4. **Caching** (future): Redis for frequently accessed data

### Scaling Strategy

**Phase 1** (Current): Single server, PostgreSQL
- Handles 1000s of markets
- 100k+ trades
- Sub-second API responses

**Phase 2** (Future): Horizontal scaling
- Multiple API servers (load balanced)
- Single indexer (stateful)
- Redis caching layer
- Read replicas for database

**Phase 3** (Future): Microservices
- Separate indexer per contract type
- Message queue (Bull/RabbitMQ)
- WebSocket server for real-time updates
- GraphQL API

## Security

### Current

- ✅ Rate limiting
- ✅ Helmet security headers
- ✅ CORS whitelist
- ✅ Input validation (Zod)
- ✅ SQL injection protection (Prisma)

### To Implement

- ⏳ Admin signature verification
- ⏳ JWT authentication
- ⏳ API key system
- ⏳ Request logging
- ⏳ DDoS protection (Cloudflare)

## Monitoring

### Logs

- `logs/combined.log` - All logs
- `logs/error.log` - Errors only
- Winston logger with timestamps

### Database

- Prisma Studio: `npm run db:studio`
- Query logging in development

### Future

- Sentry for error tracking
- Datadog/New Relic for APM
- Grafana dashboards
- Alert system for indexer failures

## Future Enhancements

1. **WebSocket Server**: Real-time market updates
2. **GraphQL API**: More flexible queries
3. **Caching Layer**: Redis for hot data
4. **Job Queue**: Bull for background tasks
5. **Email Notifications**: SMTP integration
6. **Push Notifications**: Web Push API
7. **Analytics Dashboard**: Advanced charts
8. **ML Predictions**: Outcome probability models
9. **API Documentation**: Swagger/OpenAPI
10. **Multi-chain Support**: Deploy to other chains

## Maintenance

### Regular Tasks

- **Monitor indexer**: Ensure it's running and syncing
- **Check logs**: Review errors daily
- **Database backups**: Automated daily backups
- **Update dependencies**: Monthly security updates

### Troubleshooting

**Indexer stopped syncing**:
- Check RPC URL
- Verify contract addresses
- Review error logs
- Restart indexer

**API slow responses**:
- Check database indexes
- Review slow query logs
- Consider caching
- Scale database

**Missing events**:
- Check SyncState table
- Verify START_BLOCK
- Re-sync from specific block

## Summary

The backend provides:

✅ **User Experience**: Notify users of unclaimed funds  
✅ **Admin Tools**: See which markets need finalization  
✅ **Performance**: Reduce frontend RPC calls  
✅ **Analytics**: Track platform metrics  
✅ **Scalability**: Handle growth to millions of users  
✅ **Reliability**: Automatic event syncing and recovery  

This architecture sets the foundation for a production-ready prediction market platform that can scale to handle significant traffic and provide excellent user experience.

