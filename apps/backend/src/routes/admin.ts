import { Router } from 'express';
import prisma from '../utils/db';
import logger from '../utils/logger';

const router = Router();

// Middleware to verify admin (you can implement JWT or signature verification)
// For now, this is a placeholder
const verifyAdmin = (req: any, res: any, next: any) => {
  // TODO: Implement proper admin verification
  // For example: verify signature, check admin role on-chain, etc.
  const adminAddress = req.headers['x-admin-address'];
  
  if (!adminAddress) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  req.adminAddress = adminAddress;
  next();
};

// Get all markets for admin dashboard
router.get('/markets', verifyAdmin, async (req, res) => {
  try {
    const { status } = req.query;

    const where: any = {};
    if (status) {
      where.status = parseInt(status as string, 10);
    }

    const markets = await prisma.market.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            positions: true,
            trades: true,
          },
        },
      },
    });

    res.json(markets);
  } catch (error) {
    logger.error('Error fetching admin markets:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get markets ready for finalization
router.get('/markets/ready-to-finalize', verifyAdmin, async (req, res) => {
  try {
    // Find resolved markets that haven't been finalized
    const markets = await prisma.market.findMany({
      where: {
        status: 2, // RESOLVED
        finalized: false,
      },
      include: {
        positions: {
          where: {
            hasOutcomeTokens: true,
            hasClaimed: false,
          },
        },
      },
    });

    // For each market, check if there are unclaimed winners
    const marketsWithDetails = await Promise.all(
      markets.map(async (market) => {
        if (market.winningOutcome === null) {
          return null;
        }

        // Count unclaimed winners
        const unclaimedWinners = market.positions.filter((p) => {
          const winningBalance = BigInt(
            p.outcomeBalances[market.winningOutcome!] || '0'
          );
          return winningBalance > 0n;
        });

        const totalUnclaimedTokens = unclaimedWinners.reduce(
          (sum, p) => sum + BigInt(p.outcomeBalances[market.winningOutcome!]),
          0n
        );

        return {
          ...market,
          unclaimedWinnersCount: unclaimedWinners.length,
          totalUnclaimedTokens: totalUnclaimedTokens.toString(),
          canFinalize: unclaimedWinners.length === 0, // Can finalize if no unclaimed winners
        };
      })
    );

    res.json(marketsWithDetails.filter((m) => m !== null));
  } catch (error) {
    logger.error('Error fetching markets ready to finalize:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get platform stats
router.get('/stats', verifyAdmin, async (req, res) => {
  try {
    const [
      totalMarkets,
      activeMarkets,
      resolvedMarkets,
      totalUsers,
      totalTrades,
      totalVolume,
    ] = await Promise.all([
      prisma.market.count(),
      prisma.market.count({ where: { status: 0 } }),
      prisma.market.count({ where: { status: 2 } }),
      prisma.user.count(),
      prisma.trade.count(),
      prisma.trade.aggregate({ _sum: { amount: true } }),
    ]);

    res.json({
      totalMarkets,
      activeMarkets,
      resolvedMarkets,
      totalUsers,
      totalTrades,
      totalVolume: totalVolume._sum.amount || '0',
    });
  } catch (error) {
    logger.error('Error fetching admin stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get recent activity
router.get('/activity', verifyAdmin, async (req, res) => {
  try {
    const { limit = '50' } = req.query;
    const limitNum = parseInt(limit as string, 10);

    const [recentTrades, recentMarkets, recentClaims] = await Promise.all([
      prisma.trade.findMany({
        orderBy: { timestamp: 'desc' },
        take: limitNum,
        include: {
          user: { select: { address: true } },
          market: { select: { address: true, question: true } },
        },
      }),
      prisma.market.findMany({
        orderBy: { createdAt: 'desc' },
        take: limitNum,
      }),
      prisma.claim.findMany({
        orderBy: { timestamp: 'desc' },
        take: limitNum,
        include: {
          user: { select: { address: true } },
          market: { select: { address: true, question: true } },
        },
      }),
    ]);

    res.json({
      recentTrades,
      recentMarkets,
      recentClaims,
    });
  } catch (error) {
    logger.error('Error fetching admin activity:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get users with unclaimed funds (for notifications)
router.get('/users/unclaimed', verifyAdmin, async (req, res) => {
  try {
    // Find all users with unclaimed winning positions
    const unclaimedPositions = await prisma.userPosition.findMany({
      where: {
        hasOutcomeTokens: true,
        hasClaimed: false,
        market: {
          status: 2, // RESOLVED
        },
      },
      include: {
        user: {
          select: {
            address: true,
          },
        },
        market: {
          select: {
            address: true,
            question: true,
            winningOutcome: true,
          },
        },
      },
    });

    // Filter for winning positions
    const winningPositions = unclaimedPositions.filter((position) => {
      if (position.market.winningOutcome === null) return false;
      const winningBalance = BigInt(
        position.outcomeBalances[position.market.winningOutcome] || '0'
      );
      return winningBalance > 0n;
    });

    // Group by user
    const userMap = new Map<string, any>();
    winningPositions.forEach((position) => {
      const address = position.user.address;
      if (!userMap.has(address)) {
        userMap.set(address, {
          address,
          unclaimedMarkets: [],
        });
      }
      userMap.get(address).unclaimedMarkets.push({
        marketAddress: position.market.address,
        question: position.market.question,
        winningBalance: position.outcomeBalances[position.market.winningOutcome!],
      });
    });

    res.json({
      count: userMap.size,
      users: Array.from(userMap.values()),
    });
  } catch (error) {
    logger.error('Error fetching users with unclaimed funds:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

