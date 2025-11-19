# Frontend Integration Guide

This guide shows how to integrate the backend APIs into your Next.js frontend.

## 1. Create API Client

Create `/apps/web/lib/api.ts`:

```typescript
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export class YesNoAPI {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  // User endpoints
  async getUser(address: string) {
    const res = await fetch(`${this.baseUrl}/users/${address}`);
    if (!res.ok) throw new Error('Failed to fetch user');
    return res.json();
  }

  async getUserUnclaimedPositions(address: string) {
    const res = await fetch(`${this.baseUrl}/users/${address}/unclaimed`);
    if (!res.ok) throw new Error('Failed to fetch unclaimed positions');
    return res.json();
  }

  async getUserLPUnclaimed(address: string) {
    const res = await fetch(`${this.baseUrl}/users/${address}/lp-unclaimed`);
    if (!res.ok) throw new Error('Failed to fetch LP unclaimed');
    return res.json();
  }

  async getUserNotifications(address: string, unreadOnly = false) {
    const url = `${this.baseUrl}/users/${address}/notifications${unreadOnly ? '?unreadOnly=true' : ''}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch notifications');
    return res.json();
  }

  async markNotificationRead(notificationId: string) {
    const res = await fetch(`${this.baseUrl}/users/notifications/${notificationId}/read`, {
      method: 'PATCH',
    });
    if (!res.ok) throw new Error('Failed to mark notification as read');
    return res.json();
  }

  // Market endpoints
  async getMarkets(params?: {
    status?: number;
    creator?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const query = new URLSearchParams();
    if (params?.status !== undefined) query.set('status', params.status.toString());
    if (params?.creator) query.set('creator', params.creator);
    if (params?.search) query.set('search', params.search);
    if (params?.page) query.set('page', params.page.toString());
    if (params?.limit) query.set('limit', params.limit.toString());

    const res = await fetch(`${this.baseUrl}/markets?${query}`);
    if (!res.ok) throw new Error('Failed to fetch markets');
    return res.json();
  }

  async getMarket(address: string) {
    const res = await fetch(`${this.baseUrl}/markets/${address}`);
    if (!res.ok) throw new Error('Failed to fetch market');
    return res.json();
  }

  async getMarketParticipants(address: string) {
    const res = await fetch(`${this.baseUrl}/markets/${address}/participants`);
    if (!res.ok) throw new Error('Failed to fetch participants');
    return res.json();
  }

  async getMarketUnclaimedWinners(address: string) {
    const res = await fetch(`${this.baseUrl}/markets/${address}/unclaimed-winners`);
    if (!res.ok) throw new Error('Failed to fetch unclaimed winners');
    return res.json();
  }

  async getMarketStats(address: string) {
    const res = await fetch(`${this.baseUrl}/markets/${address}/stats`);
    if (!res.ok) throw new Error('Failed to fetch market stats');
    return res.json();
  }

  // Admin endpoints
  async getAdminMarkets(adminAddress: string, status?: number) {
    const query = status !== undefined ? `?status=${status}` : '';
    const res = await fetch(`${this.baseUrl}/admin/markets${query}`, {
      headers: {
        'x-admin-address': adminAddress,
      },
    });
    if (!res.ok) throw new Error('Failed to fetch admin markets');
    return res.json();
  }

  async getMarketsReadyToFinalize(adminAddress: string) {
    const res = await fetch(`${this.baseUrl}/admin/markets/ready-to-finalize`, {
      headers: {
        'x-admin-address': adminAddress,
      },
    });
    if (!res.ok) throw new Error('Failed to fetch markets ready to finalize');
    return res.json();
  }

  async getAdminStats(adminAddress: string) {
    const res = await fetch(`${this.baseUrl}/admin/stats`, {
      headers: {
        'x-admin-address': adminAddress,
      },
    });
    if (!res.ok) throw new Error('Failed to fetch admin stats');
    return res.json();
  }

  async getUsersWithUnclaimedFunds(adminAddress: string) {
    const res = await fetch(`${this.baseUrl}/admin/users/unclaimed`, {
      headers: {
        'x-admin-address': adminAddress,
      },
    });
    if (!res.ok) throw new Error('Failed to fetch users with unclaimed funds');
    return res.json();
  }
}

export const api = new YesNoAPI();
```

## 2. Add Environment Variable

Add to `/apps/web/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api
```

## 3. Example: Unclaimed Funds Notification

Create `/apps/web/components/UnclaimedFundsNotification.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import { api } from '@/lib/api';

export function UnclaimedFundsNotification() {
  const account = useActiveAccount();
  const [unclaimedCount, setUnclaimedCount] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!account) return;

    async function fetchUnclaimed() {
      setLoading(true);
      try {
        const [winnings, lpUnclaimed] = await Promise.all([
          api.getUserUnclaimedPositions(account.address),
          api.getUserLPUnclaimed(account.address),
        ]);

        setUnclaimedCount(winnings.count + lpUnclaimed.count);
      } catch (error) {
        console.error('Failed to fetch unclaimed funds:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchUnclaimed();
    // Refresh every 30 seconds
    const interval = setInterval(fetchUnclaimed, 30000);
    return () => clearInterval(interval);
  }, [account]);

  if (!account || unclaimedCount === 0) return null;

  return (
    <div className="fixed top-20 right-4 bg-gradient-to-r from-[#00D1FF] to-[#FF00AA] p-4 rounded-xl shadow-lg max-w-sm z-50">
      <div className="flex items-start gap-3">
        <div className="text-2xl">💰</div>
        <div>
          <h3 className="font-bold text-white">Unclaimed Funds Available!</h3>
          <p className="text-sm text-white/90 mt-1">
            You have {unclaimedCount} market{unclaimedCount > 1 ? 's' : ''} with unclaimed funds.
          </p>
          <a
            href="/dashboard"
            className="text-sm font-medium text-white underline mt-2 inline-block"
          >
            View Details →
          </a>
        </div>
      </div>
    </div>
  );
}
```

Add to your layout:

```typescript
// /apps/web/app/layout.tsx
import { UnclaimedFundsNotification } from '@/components/UnclaimedFundsNotification';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <ThirdwebProvider>
          <Header />
          <UnclaimedFundsNotification />
          {children}
        </ThirdwebProvider>
      </body>
    </html>
  );
}
```

## 4. Example: User Dashboard with Backend Data

Update `/apps/web/app/dashboard/page.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import { api } from '@/lib/api';

export default function DashboardPage() {
  const account = useActiveAccount();
  const [userData, setUserData] = useState<any>(null);
  const [unclaimedWinnings, setUnclaimedWinnings] = useState<any>(null);
  const [unclaimedLP, setUnclaimedLP] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!account) return;

    async function fetchData() {
      setLoading(true);
      try {
        const [user, winnings, lp] = await Promise.all([
          api.getUser(account.address),
          api.getUserUnclaimedPositions(account.address),
          api.getUserLPUnclaimed(account.address),
        ]);

        setUserData(user);
        setUnclaimedWinnings(winnings);
        setUnclaimedLP(lp);
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [account]);

  if (!account) {
    return <div>Please connect your wallet</div>;
  }

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Your Dashboard</h1>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-[#1A1A24] p-6 rounded-xl">
          <div className="text-gray-400 text-sm">Total Trades</div>
          <div className="text-3xl font-bold text-white mt-2">
            {userData?.stats.totalTrades || 0}
          </div>
        </div>
        <div className="bg-[#1A1A24] p-6 rounded-xl">
          <div className="text-gray-400 text-sm">Active Positions</div>
          <div className="text-3xl font-bold text-white mt-2">
            {userData?.stats.activePositions || 0}
          </div>
        </div>
        <div className="bg-[#1A1A24] p-6 rounded-xl">
          <div className="text-gray-400 text-sm">Total Volume</div>
          <div className="text-3xl font-bold text-white mt-2">
            ${(parseFloat(userData?.stats.totalVolume || '0') / 1e6).toFixed(2)}
          </div>
        </div>
      </div>

      {/* Unclaimed Winnings */}
      {unclaimedWinnings && unclaimedWinnings.count > 0 && (
        <div className="bg-gradient-to-r from-[#00D1FF]/10 to-[#FF00AA]/10 border border-[#00D1FF]/30 p-6 rounded-xl mb-6">
          <h2 className="text-xl font-bold text-white mb-4">
            💰 Unclaimed Winnings ({unclaimedWinnings.count})
          </h2>
          <div className="space-y-3">
            {unclaimedWinnings.positions.map((position: any) => (
              <div key={position.marketId} className="bg-[#1A1A24] p-4 rounded-lg">
                <div className="font-medium text-white">{position.question}</div>
                <div className="text-sm text-gray-400 mt-1">
                  Winning Balance: {(parseFloat(position.winningBalance) / 1e18).toFixed(2)} tokens
                </div>
                <a
                  href={`/market/${position.marketAddress}`}
                  className="text-[#00D1FF] text-sm font-medium mt-2 inline-block"
                >
                  Claim Now →
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Unclaimed LP Funds */}
      {unclaimedLP && unclaimedLP.count > 0 && (
        <div className="bg-gradient-to-r from-green-500/10 to-blue-500/10 border border-green-500/30 p-6 rounded-xl mb-6">
          <h2 className="text-xl font-bold text-white mb-4">
            🏦 LP Funds Available ({unclaimedLP.count})
          </h2>
          <div className="text-sm text-gray-300 mb-4">
            These markets have been finalized. Additional funds from unclaimed reserves are now available!
          </div>
          <div className="space-y-3">
            {unclaimedLP.positions.map((position: any) => (
              <div key={position.marketId} className="bg-[#1A1A24] p-4 rounded-lg">
                <div className="font-medium text-white">{position.question}</div>
                <div className="text-sm text-gray-400 mt-1">
                  LP Balance: {(parseFloat(position.lpBalance) / 1e18).toFixed(2)} LP
                </div>
                <div className="text-xs text-green-400 mt-1">
                  ✅ Finalized on {new Date(position.finalizedAt).toLocaleDateString()}
                </div>
                <a
                  href={`/market/${position.marketAddress}`}
                  className="text-[#00D1FF] text-sm font-medium mt-2 inline-block"
                >
                  Withdraw LP →
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Trades */}
      <div className="bg-[#1A1A24] p-6 rounded-xl">
        <h2 className="text-xl font-bold text-white mb-4">Recent Trades</h2>
        {/* ... render recent trades ... */}
      </div>
    </div>
  );
}
```

## 5. Example: Admin Panel - Markets Ready to Finalize

Add to `/apps/web/app/yesno-admin/page.tsx`:

```typescript
// Add this section to your admin panel

const [marketsToFinalize, setMarketsToFinalize] = useState<any[]>([]);

useEffect(() => {
  if (!account) return;

  async function fetchMarketsToFinalize() {
    try {
      const markets = await api.getMarketsReadyToFinalize(account.address);
      setMarketsToFinalize(markets.filter((m: any) => m.canFinalize));
    } catch (error) {
      console.error('Failed to fetch markets to finalize:', error);
    }
  }

  fetchMarketsToFinalize();
}, [account]);

// In your JSX:
{marketsToFinalize.length > 0 && (
  <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/30 p-6 rounded-xl mb-6">
    <h2 className="text-xl font-bold text-white mb-4">
      ⚠️ Markets Ready to Finalize ({marketsToFinalize.length})
    </h2>
    <div className="space-y-3">
      {marketsToFinalize.map((market) => (
        <div key={market.address} className="bg-[#1A1A24] p-4 rounded-lg">
          <div className="font-medium text-white">{market.question}</div>
          <div className="text-sm text-gray-400 mt-1">
            All winners have claimed. Unclaimed reserves can be distributed to LPs.
          </div>
          <button
            onClick={() => handleFinalizeMarket(market.address)}
            className="mt-3 px-4 py-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-lg font-medium"
          >
            Finalize Market
          </button>
        </div>
      ))}
    </div>
  </div>
)}
```

## 6. Update .env.local

```env
# Add to /apps/web/.env.local
NEXT_PUBLIC_API_URL=http://localhost:4000/api
```

For production:
```env
NEXT_PUBLIC_API_URL=https://api.yesno.market/api
```

## Next Steps

1. **Start backend**: `cd apps/backend && npm run dev`
2. **Start indexer**: `cd apps/backend && npm run indexer`
3. **Update frontend**: Integrate API calls as shown above
4. **Test**: Verify unclaimed funds notifications work
5. **Deploy**: Deploy backend to production server

## Benefits

✅ **Reduced RPC Calls**: Frontend fetches from backend instead of blockchain  
✅ **Better UX**: Users see unclaimed funds across all markets  
✅ **Notifications**: Alert users when they have funds to claim  
✅ **Admin Tools**: See which markets are ready to finalize  
✅ **Analytics**: Track user behavior and market performance  
✅ **Scalability**: Backend can handle heavy lifting  

