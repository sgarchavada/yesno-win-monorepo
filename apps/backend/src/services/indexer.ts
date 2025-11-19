import { ethers } from 'ethers';
import prisma from '../utils/db';
import logger from '../utils/logger';
import { config } from '../config';
import { EventProcessor } from './eventProcessor';

// Market Factory ABI (events only)
const MARKET_FACTORY_ABI = [
  'event MarketCreated(address indexed marketAddress, address indexed creator, string question, string[] outcomes, uint256 endTime)',
];

// Market ABI (events only)
const MARKET_ABI = [
  'event TokensPurchased(address indexed user, uint256 indexed outcome, uint256 collateralAmount, uint256 tokensReceived, uint256 fee)',
  'event TokensSold(address indexed user, uint256 indexed outcome, uint256 tokensAmount, uint256 collateralReceived, uint256 fee)',
  'event LiquidityAdded(address indexed provider, uint256 collateralAmount, uint256 lpTokens)',
  'event LiquidityRemoved(address indexed provider, uint256 lpTokens, uint256 collateralAmount)',
  'event WinningsClaimed(address indexed user, uint256 amount, uint256 totalClaimed)',
  'event MarketResolved(uint256 indexed winningOutcome, address indexed resolver)',
  'event MarketCanceled(string reason)',
  'event MarketFinalized(uint256 unclaimedReservesDistributed)',
];

export class EventIndexer {
  private provider: ethers.JsonRpcProvider;
  private marketFactory: ethers.Contract;
  private eventProcessor: EventProcessor;
  private isRunning = false;

  constructor() {
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.marketFactory = new ethers.Contract(
      config.contracts.marketFactory,
      MARKET_FACTORY_ABI,
      this.provider
    );
    this.eventProcessor = new EventProcessor();
  }

  async start() {
    if (this.isRunning) {
      logger.warn('Indexer already running');
      return;
    }

    this.isRunning = true;
    logger.info('🚀 Event Indexer starting...');

    try {
      // Get last synced block
      const syncState = await prisma.syncState.findUnique({
        where: { contractName: 'MarketFactory' },
      });

      const fromBlock = syncState?.lastBlock
        ? Number(syncState.lastBlock) + 1
        : config.startBlock;

      logger.info(`Starting sync from block ${fromBlock}`);

      // Sync historical events
      await this.syncHistoricalEvents(fromBlock);

      // Listen for new events
      this.listenForNewEvents();

      logger.info('✅ Event Indexer started successfully');
    } catch (error) {
      logger.error('Failed to start indexer:', error);
      this.isRunning = false;
      throw error;
    }
  }

  private async syncHistoricalEvents(fromBlock: number) {
    const currentBlock = await this.provider.getBlockNumber();
    const BATCH_SIZE = 5000; // Process 5000 blocks at a time

    logger.info(`Syncing historical events from block ${fromBlock} to ${currentBlock}`);

    for (let start = fromBlock; start <= currentBlock; start += BATCH_SIZE) {
      const end = Math.min(start + BATCH_SIZE - 1, currentBlock);
      
      try {
        logger.info(`Processing blocks ${start} to ${end}`);

        // Get MarketCreated events
        const marketCreatedEvents = await this.marketFactory.queryFilter(
          this.marketFactory.filters.MarketCreated(),
          start,
          end
        );

        // Process each market creation
        for (const event of marketCreatedEvents) {
          await this.processMarketCreated(event as any);
          
          // Get all events for this market
          await this.syncMarketEvents(event.args![0] as string, start, end);
        }

        // Update sync state
        await prisma.syncState.upsert({
          where: { contractName: 'MarketFactory' },
          update: { lastBlock: BigInt(end) },
          create: {
            contractName: 'MarketFactory',
            lastBlock: BigInt(end),
          },
        });

        logger.info(`✅ Processed blocks ${start} to ${end}`);
      } catch (error) {
        logger.error(`Error processing blocks ${start} to ${end}:`, error);
        throw error;
      }
    }

    logger.info('✅ Historical sync complete');
  }

  private async syncMarketEvents(marketAddress: string, fromBlock: number, toBlock: number) {
    const market = new ethers.Contract(marketAddress, MARKET_ABI, this.provider);

    try {
      // Get all events for this market in the block range
      const [
        purchaseEvents,
        sellEvents,
        liquidityAddedEvents,
        liquidityRemovedEvents,
        claimEvents,
        resolveEvents,
        cancelEvents,
        finalizeEvents,
      ] = await Promise.all([
        market.queryFilter(market.filters.TokensPurchased(), fromBlock, toBlock),
        market.queryFilter(market.filters.TokensSold(), fromBlock, toBlock),
        market.queryFilter(market.filters.LiquidityAdded(), fromBlock, toBlock),
        market.queryFilter(market.filters.LiquidityRemoved(), fromBlock, toBlock),
        market.queryFilter(market.filters.WinningsClaimed(), fromBlock, toBlock),
        market.queryFilter(market.filters.MarketResolved(), fromBlock, toBlock),
        market.queryFilter(market.filters.MarketCanceled(), fromBlock, toBlock),
        market.queryFilter(market.filters.MarketFinalized(), fromBlock, toBlock),
      ]);

      // Process events
      for (const event of purchaseEvents) {
        await this.eventProcessor.processTokensPurchased(marketAddress, event as any);
      }
      for (const event of sellEvents) {
        await this.eventProcessor.processTokensSold(marketAddress, event as any);
      }
      for (const event of liquidityAddedEvents) {
        await this.eventProcessor.processLiquidityAdded(marketAddress, event as any);
      }
      for (const event of liquidityRemovedEvents) {
        await this.eventProcessor.processLiquidityRemoved(marketAddress, event as any);
      }
      for (const event of claimEvents) {
        await this.eventProcessor.processWinningsClaimed(marketAddress, event as any);
      }
      for (const event of resolveEvents) {
        await this.eventProcessor.processMarketResolved(marketAddress, event as any);
      }
      for (const event of cancelEvents) {
        await this.eventProcessor.processMarketCanceled(marketAddress, event as any);
      }
      for (const event of finalizeEvents) {
        await this.eventProcessor.processMarketFinalized(marketAddress, event as any);
      }
    } catch (error) {
      logger.error(`Error syncing market ${marketAddress} events:`, error);
    }
  }

  private listenForNewEvents() {
    logger.info('👂 Listening for new events...');

    // Listen for new markets
    this.marketFactory.on('MarketCreated', async (...args) => {
      const event = args[args.length - 1];
      logger.info('📢 New MarketCreated event:', event.args);
      await this.processMarketCreated(event);
      
      // Start listening to this market's events
      this.listenToMarketEvents(event.args[0]);
    });
  }

  private listenToMarketEvents(marketAddress: string) {
    const market = new ethers.Contract(marketAddress, MARKET_ABI, this.provider);

    market.on('TokensPurchased', async (...args) => {
      const event = args[args.length - 1];
      await this.eventProcessor.processTokensPurchased(marketAddress, event);
    });

    market.on('TokensSold', async (...args) => {
      const event = args[args.length - 1];
      await this.eventProcessor.processTokensSold(marketAddress, event);
    });

    market.on('LiquidityAdded', async (...args) => {
      const event = args[args.length - 1];
      await this.eventProcessor.processLiquidityAdded(marketAddress, event);
    });

    market.on('LiquidityRemoved', async (...args) => {
      const event = args[args.length - 1];
      await this.eventProcessor.processLiquidityRemoved(marketAddress, event);
    });

    market.on('WinningsClaimed', async (...args) => {
      const event = args[args.length - 1];
      await this.eventProcessor.processWinningsClaimed(marketAddress, event);
    });

    market.on('MarketResolved', async (...args) => {
      const event = args[args.length - 1];
      await this.eventProcessor.processMarketResolved(marketAddress, event);
    });

    market.on('MarketCanceled', async (...args) => {
      const event = args[args.length - 1];
      await this.eventProcessor.processMarketCanceled(marketAddress, event);
    });

    market.on('MarketFinalized', async (...args) => {
      const event = args[args.length - 1];
      await this.eventProcessor.processMarketFinalized(marketAddress, event);
    });

    logger.info(`👂 Listening to market ${marketAddress}`);
  }

  private async processMarketCreated(event: any) {
    const [marketAddress, creator, question, outcomes, endTime] = event.args;

    try {
      await prisma.market.upsert({
        where: { address: marketAddress },
        update: {},
        create: {
          address: marketAddress,
          question,
          outcomes: outcomes as string[],
          creator,
          endTime: new Date(Number(endTime) * 1000),
          status: 0, // ACTIVE
          totalReserves: '0',
          reserves: [],
          accumulatedFees: '0',
          accumulatedProtocolFees: '0',
        },
      });

      logger.info(`✅ Market created: ${marketAddress}`);
    } catch (error) {
      logger.error(`Error processing MarketCreated for ${marketAddress}:`, error);
    }
  }

  async stop() {
    this.isRunning = false;
    this.provider.removeAllListeners();
    logger.info('🛑 Event Indexer stopped');
  }
}

// Run indexer if executed directly
if (require.main === module) {
  const indexer = new EventIndexer();
  
  indexer.start().catch((error) => {
    logger.error('Fatal error:', error);
    process.exit(1);
  });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    logger.info('Received SIGINT, shutting down...');
    await indexer.stop();
    await prisma.$disconnect();
    process.exit(0);
  });
}

