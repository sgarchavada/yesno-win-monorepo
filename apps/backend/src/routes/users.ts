import { Router } from 'express';
import prisma from '../utils/db';
import logger from '../utils/logger';

const router = Router();

// Get user profile and stats
router.get('/:address', async (req, res) => {
  try {
    const { address } = req.params;

    const user = await prisma.user.findUnique({
      where: { address: address.toLowerCase() },
      include: {
        positions: {
          include: {
            market: true,
          },
        },
        trades: {
          orderBy: { timestamp: 'desc' },
          take: 50,
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Calculate stats
    const totalTrades = await prisma.trade.count({
      where: { userId: user.id },
    });

    const totalVolume = await prisma.trade.aggregate({
      where: { userId: user.id },
      _sum: { amount: true },
    });

    const activePosistions = user.positions.filter(
      (p) => p.hasOutcomeTokens || p.hasLPTokens
    ).length;

    res.json({
      address: user.address,
      createdAt: user.createdAt,
      stats: {
        totalTrades,
        totalVolume: totalVolume._sum.amount || '0',
        activePositions: activePosistions,
      },
      positions: user.positions,
      recentTrades: user.trades,
    });
  } catch (error) {
    logger.error('Error fetching user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user's unclaimed positions across all markets
router.get('/:address/unclaimed', async (req, res) => {
  try {
    const { address } = req.params;

    const user = await prisma.user.findUnique({
      where: { address: address.toLowerCase() },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Find all resolved markets where user has winning tokens but hasn't claimed
    const unclaimedPositions = await prisma.userPosition.findMany({
      where: {
        userId: user.id,
        hasOutcomeTokens: true,
        hasClaimed: false,
        market: {
          status: 2, // RESOLVED
        },
      },
      include: {
        market: true,
      },
    });

    // Filter for winning outcomes
    const winningPositions = unclaimedPositions.filter((position) => {
      if (position.market.winningOutcome === null) return false;
      const winningBalance = BigInt(
        position.outcomeBalances[position.market.winningOutcome] || '0'
      );
      return winningBalance > 0n;
    });

    res.json({
      count: winningPositions.length,
      positions: winningPositions.map((p) => ({
        marketId: p.market.id,
        marketAddress: p.market.address,
        question: p.market.question,
        winningOutcome: p.market.winningOutcome,
        winningBalance: p.outcomeBalances[p.market.winningOutcome!],
        totalClaimed: p.totalClaimed,
      })),
    });
  } catch (error) {
    logger.error('Error fetching unclaimed positions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user's LP positions with unclaimed reserves (after finalization)
router.get('/:address/lp-unclaimed', async (req, res) => {
  try {
    const { address } = req.params;

    const user = await prisma.user.findUnique({
      where: { address: address.toLowerCase() },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Find all finalized markets where user has LP tokens
    const lpPositions = await prisma.userPosition.findMany({
      where: {
        userId: user.id,
        hasLPTokens: true,
        market: {
          status: 2, // RESOLVED
          finalized: true,
        },
      },
      include: {
        market: true,
      },
    });

    res.json({
      count: lpPositions.length,
      positions: lpPositions.map((p) => ({
        marketId: p.market.id,
        marketAddress: p.market.address,
        question: p.market.question,
        lpBalance: p.lpBalance,
        finalized: p.market.finalized,
        finalizedAt: p.market.finalizedAt,
      })),
    });
  } catch (error) {
    logger.error('Error fetching LP unclaimed positions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user notifications
router.get('/:address/notifications', async (req, res) => {
  try {
    const { address } = req.params;
    const { unreadOnly } = req.query;

    const user = await prisma.user.findUnique({
      where: { address: address.toLowerCase() },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const notifications = await prisma.notification.findMany({
      where: {
        userId: user.id,
        ...(unreadOnly === 'true' ? { read: false } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json({
      count: notifications.length,
      unreadCount: notifications.filter((n) => !n.read).length,
      notifications,
    });
  } catch (error) {
    logger.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Mark notification as read
router.patch('/notifications/:id/read', async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await prisma.notification.update({
      where: { id },
      data: { read: true },
    });

    res.json(notification);
  } catch (error) {
    logger.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

