import { Router } from 'express';
import prisma from '../utils/db';
import logger from '../utils/logger';

const router = Router();

// Get all markets with filters
router.get('/', async (req, res) => {
  try {
    const { status, creator, search, page = '1', limit = '20' } = req.query;

    const where: any = {};

    if (status) {
      where.status = parseInt(status as string, 10);
    }

    if (creator) {
      where.creator = (creator as string).toLowerCase();
    }

    if (search) {
      where.question = {
        contains: search as string,
        mode: 'insensitive',
      };
    }

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const [markets, total] = await Promise.all([
      prisma.market.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.market.count({ where }),
    ]);

    res.json({
      markets,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    logger.error('Error fetching markets:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single market details
router.get('/:address', async (req, res) => {
  try {
    const { address } = req.params;

    const market = await prisma.market.findUnique({
      where: { address: address.toLowerCase() },
      include: {
        trades: {
          orderBy: { timestamp: 'desc' },
          take: 50,
          include: {
            user: {
              select: {
                address: true,
              },
            },
          },
        },
      },
    });

    if (!market) {
      return res.status(404).json({ error: 'Market not found' });
    }

    res.json(market);
  } catch (error) {
    logger.error('Error fetching market:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get market participants (users with positions)
router.get('/:address/participants', async (req, res) => {
  try {
    const { address } = req.params;

    const market = await prisma.market.findUnique({
      where: { address: address.toLowerCase() },
    });

    if (!market) {
      return res.status(404).json({ error: 'Market not found' });
    }

    const positions = await prisma.userPosition.findMany({
      where: {
        marketId: market.id,
        OR: [{ hasOutcomeTokens: true }, { hasLPTokens: true }],
      },
      include: {
        user: {
          select: {
            address: true,
          },
        },
      },
    });

    res.json({
      totalParticipants: positions.length,
      traders: positions.filter((p) => p.hasOutcomeTokens).length,
      liquidityProviders: positions.filter((p) => p.hasLPTokens).length,
      participants: positions.map((p) => ({
        address: p.user.address,
        hasOutcomeTokens: p.hasOutcomeTokens,
        hasLPTokens: p.hasLPTokens,
        hasClaimed: p.hasClaimed,
        outcomeBalances: p.outcomeBalances,
        lpBalance: p.lpBalance,
      })),
    });
  } catch (error) {
    logger.error('Error fetching market participants:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get users who haven't claimed winnings (for admin to finalize)
router.get('/:address/unclaimed-winners', async (req, res) => {
  try {
    const { address } = req.params;

    const market = await prisma.market.findUnique({
      where: { address: address.toLowerCase() },
    });

    if (!market) {
      return res.status(404).json({ error: 'Market not found' });
    }

    if (market.status !== 2) {
      return res.status(400).json({ error: 'Market is not resolved' });
    }

    if (market.winningOutcome === null) {
      return res.status(400).json({ error: 'No winning outcome set' });
    }

    // Find all users with winning tokens who haven't claimed
    const unclaimedWinners = await prisma.userPosition.findMany({
      where: {
        marketId: market.id,
        hasOutcomeTokens: true,
        hasClaimed: false,
      },
      include: {
        user: {
          select: {
            address: true,
          },
        },
      },
    });

    // Filter for those with winning outcome tokens
    const winnersWithTokens = unclaimedWinners.filter((p) => {
      const winningBalance = BigInt(p.outcomeBalances[market.winningOutcome!] || '0');
      return winningBalance > 0n;
    });

    res.json({
      count: winnersWithTokens.length,
      totalUnclaimedTokens: winnersWithTokens.reduce(
        (sum, p) => sum + BigInt(p.outcomeBalances[market.winningOutcome!]),
        0n
      ).toString(),
      winners: winnersWithTokens.map((p) => ({
        address: p.user.address,
        winningBalance: p.outcomeBalances[market.winningOutcome!],
      })),
    });
  } catch (error) {
    logger.error('Error fetching unclaimed winners:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get market stats
router.get('/:address/stats', async (req, res) => {
  try {
    const { address } = req.params;

    const market = await prisma.market.findUnique({
      where: { address: address.toLowerCase() },
    });

    if (!market) {
      return res.status(404).json({ error: 'Market not found' });
    }

    const [totalTrades, totalParticipants, totalLPs] = await Promise.all([
      prisma.trade.count({ where: { marketId: market.id } }),
      prisma.userPosition.count({
        where: {
          marketId: market.id,
          hasOutcomeTokens: true,
        },
      }),
      prisma.userPosition.count({
        where: {
          marketId: market.id,
          hasLPTokens: true,
        },
      }),
    ]);

    res.json({
      totalTrades,
      totalParticipants,
      totalLPs,
      totalVolume: market.totalVolume,
      totalReserves: market.totalReserves,
      accumulatedFees: market.accumulatedFees,
    });
  } catch (error) {
    logger.error('Error fetching market stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

