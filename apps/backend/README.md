# YesNo Prediction Market Backend

Full-fledged Node.js backend for the YesNo prediction market platform. This backend indexes blockchain events, manages user data, and provides REST APIs for the frontend.

## 🚀 Features

- **Event Indexing**: Real-time blockchain event indexing from Market contracts
- **User Management**: Track user positions, trades, and unclaimed funds
- **Market Analytics**: Comprehensive market stats and participant tracking
- **Admin Dashboard**: APIs for platform administration
- **Notifications**: Alert users about unclaimed funds and market resolutions
- **WebSocket Support**: Real-time updates (coming soon)
- **Rate Limiting**: Protection against abuse
- **Database**: PostgreSQL with Prisma ORM

## 📦 Tech Stack

- **Node.js** + **TypeScript**
- **Express** - REST API
- **Prisma** - Type-safe ORM
- **PostgreSQL** - Database
- **Ethers.js** - Blockchain interaction
- **Winston** - Logging
- **Bull** - Job queue (future)
- **Redis** - Caching (future)

## 🛠️ Setup

### 1. Install Dependencies

```bash
cd apps/backend
npm install
```

### 2. Configure Environment

Copy `env.example` to `.env` and update values:

```bash
cp env.example .env
```

**Required variables:**
- `DATABASE_URL` - PostgreSQL connection string
- `RPC_URL` - Base Sepolia RPC URL
- `MARKET_FACTORY_PROXY` - MarketFactory contract address
- `USDC_ADDRESS` - USDC token address

### 3. Setup Database

```bash
# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate

# Or push schema directly (for development)
npm run db:push
```

### 4. Start Services

**Development:**
```bash
# Start API server
npm run dev

# Start event indexer (in separate terminal)
npm run indexer
```

**Production:**
```bash
# Build
npm run build

# Start API server
npm start

# Start indexer
npm run indexer
```

## 📡 API Endpoints

### User Endpoints

#### `GET /api/users/:address`
Get user profile and stats.

**Response:**
```json
{
  "address": "0x...",
  "createdAt": "2024-01-01T00:00:00Z",
  "stats": {
    "totalTrades": 50,
    "totalVolume": "10000000000",
    "activePositions": 5
  },
  "positions": [...],
  "recentTrades": [...]
}
```

#### `GET /api/users/:address/unclaimed`
Get user's unclaimed winning positions across all markets.

**Response:**
```json
{
  "count": 3,
  "positions": [
    {
      "marketId": "...",
      "marketAddress": "0x...",
      "question": "Will BTC reach $100k?",
      "winningOutcome": 1,
      "winningBalance": "100000000000000000000",
      "totalClaimed": "0"
    }
  ]
}
```

#### `GET /api/users/:address/lp-unclaimed`
Get user's LP positions in finalized markets (unclaimed reserves available).

**Response:**
```json
{
  "count": 2,
  "positions": [
    {
      "marketId": "...",
      "marketAddress": "0x...",
      "question": "...",
      "lpBalance": "200000000000000000000",
      "finalized": true,
      "finalizedAt": "2024-01-15T00:00:00Z"
    }
  ]
}
```

#### `GET /api/users/:address/notifications`
Get user notifications.

**Query params:**
- `unreadOnly=true` - Only unread notifications

**Response:**
```json
{
  "count": 5,
  "unreadCount": 2,
  "notifications": [
    {
      "id": "...",
      "type": "market_resolved",
      "title": "Market Resolved",
      "message": "The market '...' has been resolved.",
      "read": false,
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### Market Endpoints

#### `GET /api/markets`
Get all markets with filters.

**Query params:**
- `status` - Filter by status (0=ACTIVE, 1=CLOSED, 2=RESOLVED, 3=CANCELED)
- `creator` - Filter by creator address
- `search` - Search in question text
- `page` - Page number (default: 1)
- `limit` - Results per page (default: 20)

#### `GET /api/markets/:address`
Get single market details with recent trades.

#### `GET /api/markets/:address/participants`
Get all participants (traders + LPs) in a market.

#### `GET /api/markets/:address/unclaimed-winners`
Get users who haven't claimed winnings (for admin to check before finalization).

**Response:**
```json
{
  "count": 5,
  "totalUnclaimedTokens": "500000000000000000000",
  "winners": [
    {
      "address": "0x...",
      "winningBalance": "100000000000000000000"
    }
  ]
}
```

#### `GET /api/markets/:address/stats`
Get market statistics.

### Admin Endpoints

**Note:** All admin endpoints require `x-admin-address` header (signature verification to be implemented).

#### `GET /api/admin/markets`
Get all markets for admin dashboard.

#### `GET /api/admin/markets/ready-to-finalize`
Get markets ready for finalization (resolved, not finalized, no unclaimed winners).

**Response:**
```json
[
  {
    "address": "0x...",
    "question": "...",
    "status": 2,
    "finalized": false,
    "unclaimedWinnersCount": 0,
    "totalUnclaimedTokens": "0",
    "canFinalize": true
  }
]
```

#### `GET /api/admin/stats`
Get platform-wide statistics.

#### `GET /api/admin/activity`
Get recent platform activity (trades, markets, claims).

#### `GET /api/admin/users/unclaimed`
Get all users with unclaimed funds (for sending notifications).

## 🔄 Event Indexer

The event indexer runs as a separate process and:

1. **Syncs historical events** from `START_BLOCK` to current block
2. **Listens for new events** in real-time
3. **Processes events** and updates database
4. **Creates notifications** for users

**Events indexed:**
- `MarketCreated` (MarketFactory)
- `TokensPurchased` (Market)
- `TokensSold` (Market)
- `LiquidityAdded` (Market)
- `LiquidityRemoved` (Market)
- `WinningsClaimed` (Market)
- `MarketResolved` (Market)
- `MarketCanceled` (Market)
- `MarketFinalized` (Market)

## 📊 Database Schema

### Key Models:
- **User**: Wallet addresses
- **Market**: Market details and state
- **UserPosition**: User's tokens and LP positions per market
- **Trade**: Trade history
- **LPAction**: Liquidity add/remove history
- **Claim**: Winnings claimed history
- **Notification**: User notifications
- **SyncState**: Event indexer sync progress

## 🔐 Security

- **Rate Limiting**: 100 requests per 15 minutes per IP
- **Helmet**: Security headers
- **CORS**: Configured origin whitelist
- **Admin Auth**: Signature verification (to be implemented)

## 🚧 Future Enhancements

1. **WebSocket Support**: Real-time market updates
2. **Redis Caching**: Cache frequently accessed data
3. **Bull Queue**: Background job processing
4. **Email Notifications**: SMTP integration
5. **Push Notifications**: Web push API
6. **GraphQL API**: Alternative to REST
7. **Admin Signature Verification**: On-chain role verification
8. **Analytics Dashboard**: Advanced charts and insights
9. **Market Predictions**: ML-based outcome predictions
10. **API Documentation**: Swagger/OpenAPI

## 📝 Development

### Database Management

```bash
# View database in browser
npm run db:studio

# Create migration
npm run db:migrate

# Reset database (CAUTION: deletes all data)
npx prisma migrate reset
```

### Logs

Logs are stored in `logs/` directory:
- `combined.log` - All logs
- `error.log` - Error logs only

### Testing

```bash
# Run tests (to be implemented)
npm test
```

## 🐛 Troubleshooting

### Indexer not syncing
- Check RPC URL is correct
- Verify contract addresses in `.env`
- Check `START_BLOCK` is not too far back (may take time)

### Database connection errors
- Verify PostgreSQL is running
- Check `DATABASE_URL` format
- Ensure database exists

### Missing events
- Check if indexer is running
- Verify `SyncState` table for last synced block
- Restart indexer to re-sync

## 📞 Support

For issues or questions, check:
- Contract Registry: `/docs/CONTRACT_REGISTRY.md`
- Frontend Integration: `/apps/web/`
- Smart Contracts: `/packages/contracts/`

