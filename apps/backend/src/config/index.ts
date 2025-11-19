import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Server
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Database
  databaseUrl: process.env.DATABASE_URL || '',
  
  // Redis
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  
  // Blockchain
  rpcUrl: process.env.RPC_URL || 'https://sepolia.base.org',
  chainId: parseInt(process.env.CHAIN_ID || '84532', 10),
  startBlock: parseInt(process.env.START_BLOCK || '0', 10),
  
  // Contract Addresses
  contracts: {
    marketFactory: process.env.MARKET_FACTORY_PROXY || '',
    creatorRegistry: process.env.CREATOR_REGISTRY_PROXY || '',
    protocolTreasury: process.env.PROTOCOL_TREASURY_PROXY || '',
    oracleAdapter: process.env.ORACLE_ADAPTER_PROXY || '',
    usdc: process.env.USDC_ADDRESS || '',
  },
  
  // API
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  
  // Notifications
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
};

