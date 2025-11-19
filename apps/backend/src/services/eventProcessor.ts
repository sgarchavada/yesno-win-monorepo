import prisma from '../utils/db';
import logger from '../utils/logger';

export class EventProcessor {
  async processTokensPurchased(marketAddress: string, event: any) {
    const { user, outcome, collateralAmount, tokensReceived, fee } = event.args;
    const txHash = event.transactionHash;

    try {
      // Ensure user exists
      await this.ensureUser(user);

      // Get market
      const market = await prisma.market.findUnique({
        where: { address: marketAddress },
      });

      if (!market) {
        logger.error(`Market ${marketAddress} not found`);
        return;
      }

      // Create trade record
      await prisma.trade.create({
        data: {
          userId: (await this.getUser(user)).id,
          marketId: market.id,
          txHash,
          outcome: Number(outcome),
          isBuy: true,
          amount: collateralAmount.toString(),
          tokensAmount: tokensReceived.toString(),
          price: '0', // Calculate from AMM formula if needed
          fee: fee.toString(),
        },
      });

      // Update user position
      await this.updateUserPosition(user, marketAddress, Number(outcome), tokensReceived, true);

      // Update market volume
      await prisma.market.update({
        where: { id: market.id },
        data: {
          totalVolume: (BigInt(market.totalVolume) + BigInt(collateralAmount.toString())).toString(),
        },
      });

      logger.info(`✅ TokensPurchased: ${user} bought ${tokensReceived} tokens in ${marketAddress}`);
    } catch (error) {
      logger.error(`Error processing TokensPurchased:`, error);
    }
  }

  async processTokensSold(marketAddress: string, event: any) {
    const { user, outcome, tokensAmount, collateralReceived, fee } = event.args;
    const txHash = event.transactionHash;

    try {
      await this.ensureUser(user);

      const market = await prisma.market.findUnique({
        where: { address: marketAddress },
      });

      if (!market) return;

      await prisma.trade.create({
        data: {
          userId: (await this.getUser(user)).id,
          marketId: market.id,
          txHash,
          outcome: Number(outcome),
          isBuy: false,
          amount: collateralReceived.toString(),
          tokensAmount: tokensAmount.toString(),
          price: '0',
          fee: fee.toString(),
        },
      });

      await this.updateUserPosition(user, marketAddress, Number(outcome), tokensAmount, false);

      await prisma.market.update({
        where: { id: market.id },
        data: {
          totalVolume: (BigInt(market.totalVolume) + BigInt(collateralReceived.toString())).toString(),
        },
      });

      logger.info(`✅ TokensSold: ${user} sold ${tokensAmount} tokens in ${marketAddress}`);
    } catch (error) {
      logger.error(`Error processing TokensSold:`, error);
    }
  }

  async processLiquidityAdded(marketAddress: string, event: any) {
    const { provider, collateralAmount, lpTokens } = event.args;
    const txHash = event.transactionHash;

    try {
      await this.ensureUser(provider);

      const market = await prisma.market.findUnique({
        where: { address: marketAddress },
      });

      if (!market) return;

      await prisma.lPAction.create({
        data: {
          userId: (await this.getUser(provider)).id,
          marketId: market.id,
          txHash,
          isAdd: true,
          collateralAmount: collateralAmount.toString(),
          lpTokenAmount: lpTokens.toString(),
        },
      });

      // Update user LP position
      await this.updateUserLPPosition(provider, marketAddress, lpTokens, true);

      logger.info(`✅ LiquidityAdded: ${provider} added ${collateralAmount} to ${marketAddress}`);
    } catch (error) {
      logger.error(`Error processing LiquidityAdded:`, error);
    }
  }

  async processLiquidityRemoved(marketAddress: string, event: any) {
    const { provider, lpTokens, collateralAmount } = event.args;
    const txHash = event.transactionHash;

    try {
      await this.ensureUser(provider);

      const market = await prisma.market.findUnique({
        where: { address: marketAddress },
      });

      if (!market) return;

      await prisma.lPAction.create({
        data: {
          userId: (await this.getUser(provider)).id,
          marketId: market.id,
          txHash,
          isAdd: false,
          collateralAmount: collateralAmount.toString(),
          lpTokenAmount: lpTokens.toString(),
        },
      });

      await this.updateUserLPPosition(provider, marketAddress, lpTokens, false);

      logger.info(`✅ LiquidityRemoved: ${provider} removed ${lpTokens} LP from ${marketAddress}`);
    } catch (error) {
      logger.error(`Error processing LiquidityRemoved:`, error);
    }
  }

  async processWinningsClaimed(marketAddress: string, event: any) {
    const { user, amount, totalClaimed } = event.args;
    const txHash = event.transactionHash;

    try {
      await this.ensureUser(user);

      const market = await prisma.market.findUnique({
        where: { address: marketAddress },
      });

      if (!market || market.winningOutcome === null) return;

      await prisma.claim.create({
        data: {
          userId: (await this.getUser(user)).id,
          marketId: market.id,
          txHash,
          outcome: market.winningOutcome,
          tokensAmount: '0', // We don't have this in the event
          payoutAmount: amount.toString(),
        },
      });

      // Update user position to mark as claimed
      const userDb = await this.getUser(user);
      const position = await prisma.userPosition.findUnique({
        where: {
          userId_marketId: {
            userId: userDb.id,
            marketId: market.id,
          },
        },
      });

      if (position) {
        await prisma.userPosition.update({
          where: { id: position.id },
          data: {
            hasClaimed: true,
            totalClaimed: totalClaimed.toString(),
          },
        });
      }

      logger.info(`✅ WinningsClaimed: ${user} claimed ${amount} from ${marketAddress}`);
    } catch (error) {
      logger.error(`Error processing WinningsClaimed:`, error);
    }
  }

  async processMarketResolved(marketAddress: string, event: any) {
    const { winningOutcome } = event.args;

    try {
      const market = await prisma.market.findUnique({
        where: { address: marketAddress },
      });

      if (!market) return;

      await prisma.market.update({
        where: { id: market.id },
        data: {
          status: 2, // RESOLVED
          winningOutcome: Number(winningOutcome),
        },
      });

      // Create notifications for all users with positions
      await this.notifyUsersOfResolution(market.id);

      logger.info(`✅ MarketResolved: ${marketAddress} resolved with outcome ${winningOutcome}`);
    } catch (error) {
      logger.error(`Error processing MarketResolved:`, error);
    }
  }

  async processMarketCanceled(marketAddress: string, event: any) {
    try {
      const market = await prisma.market.findUnique({
        where: { address: marketAddress },
      });

      if (!market) return;

      await prisma.market.update({
        where: { id: market.id },
        data: {
          status: 3, // CANCELED
        },
      });

      logger.info(`✅ MarketCanceled: ${marketAddress}`);
    } catch (error) {
      logger.error(`Error processing MarketCanceled:`, error);
    }
  }

  async processMarketFinalized(marketAddress: string, event: any) {
    const { unclaimedReservesDistributed } = event.args;

    try {
      const market = await prisma.market.findUnique({
        where: { address: marketAddress },
      });

      if (!market) return;

      await prisma.market.update({
        where: { id: market.id },
        data: {
          finalized: true,
          finalizedAt: new Date(),
        },
      });

      // Notify all LPs that unclaimed reserves are now available
      await this.notifyLPsOfFinalization(market.id);

      logger.info(`✅ MarketFinalized: ${marketAddress} with ${unclaimedReservesDistributed} distributed`);
    } catch (error) {
      logger.error(`Error processing MarketFinalized:`, error);
    }
  }

  // Helper methods
  private async ensureUser(address: string) {
    await prisma.user.upsert({
      where: { address: address.toLowerCase() },
      update: {},
      create: { address: address.toLowerCase() },
    });
  }

  private async getUser(address: string) {
    const user = await prisma.user.findUnique({
      where: { address: address.toLowerCase() },
    });
    if (!user) throw new Error(`User ${address} not found`);
    return user;
  }

  private async updateUserPosition(
    userAddress: string,
    marketAddress: string,
    outcome: number,
    tokenAmount: bigint,
    isBuy: boolean
  ) {
    const user = await this.getUser(userAddress);
    const market = await prisma.market.findUnique({
      where: { address: marketAddress },
    });

    if (!market) return;

    const position = await prisma.userPosition.findUnique({
      where: {
        userId_marketId: {
          userId: user.id,
          marketId: market.id,
        },
      },
    });

    if (!position) {
      // Create new position
      const outcomeBalances = new Array(market.outcomes.length).fill('0');
      outcomeBalances[outcome] = tokenAmount.toString();

      await prisma.userPosition.create({
        data: {
          userId: user.id,
          marketId: market.id,
          outcomeBalances,
          hasOutcomeTokens: true,
        },
      });
    } else {
      // Update existing position
      const balances = [...position.outcomeBalances];
      const currentBalance = BigInt(balances[outcome] || '0');
      const newBalance = isBuy
        ? currentBalance + tokenAmount
        : currentBalance - tokenAmount;
      balances[outcome] = newBalance.toString();

      const hasOutcomeTokens = balances.some((b) => BigInt(b) > 0n);

      await prisma.userPosition.update({
        where: { id: position.id },
        data: {
          outcomeBalances: balances,
          hasOutcomeTokens,
        },
      });
    }
  }

  private async updateUserLPPosition(
    userAddress: string,
    marketAddress: string,
    lpTokenAmount: bigint,
    isAdd: boolean
  ) {
    const user = await this.getUser(userAddress);
    const market = await prisma.market.findUnique({
      where: { address: marketAddress },
    });

    if (!market) return;

    const position = await prisma.userPosition.findUnique({
      where: {
        userId_marketId: {
          userId: user.id,
          marketId: market.id,
        },
      },
    });

    if (!position) {
      await prisma.userPosition.create({
        data: {
          userId: user.id,
          marketId: market.id,
          outcomeBalances: new Array(market.outcomes.length).fill('0'),
          lpBalance: lpTokenAmount.toString(),
          hasLPTokens: true,
        },
      });
    } else {
      const currentLP = BigInt(position.lpBalance);
      const newLP = isAdd ? currentLP + lpTokenAmount : currentLP - lpTokenAmount;

      await prisma.userPosition.update({
        where: { id: position.id },
        data: {
          lpBalance: newLP.toString(),
          hasLPTokens: newLP > 0n,
        },
      });
    }
  }

  private async notifyUsersOfResolution(marketId: string) {
    const positions = await prisma.userPosition.findMany({
      where: {
        marketId,
        hasOutcomeTokens: true,
      },
      include: {
        user: true,
        market: true,
      },
    });

    for (const position of positions) {
      await prisma.notification.create({
        data: {
          userId: position.userId,
          type: 'market_resolved',
          marketId,
          title: 'Market Resolved',
          message: `The market "${position.market.question}" has been resolved. Check if you have winnings to claim!`,
        },
      });
    }
  }

  private async notifyLPsOfFinalization(marketId: string) {
    const positions = await prisma.userPosition.findMany({
      where: {
        marketId,
        hasLPTokens: true,
      },
      include: {
        user: true,
        market: true,
      },
    });

    for (const position of positions) {
      await prisma.notification.create({
        data: {
          userId: position.userId,
          type: 'market_finalized',
          marketId,
          title: 'Unclaimed Reserves Available',
          message: `The market "${position.market.question}" has been finalized. Additional funds from unclaimed reserves are now available for LP withdrawal!`,
        },
      });
    }
  }
}

