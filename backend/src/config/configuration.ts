const DEV_JWT_SECRET = 'dev-secret-change-me';

/**
 * Fail fast instead of silently signing tokens with a publicly known secret.
 * Only production is forced: local dev/tests keep the convenient default.
 */
function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (
    process.env.NODE_ENV === 'production' &&
    (!secret || secret === DEV_JWT_SECRET)
  ) {
    throw new Error(
      'JWT_SECRET must be set to a strong secret when NODE_ENV=production',
    );
  }
  return secret ?? DEV_JWT_SECRET;
}

export default () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  databaseUrl: process.env.DATABASE_URL ?? '',
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  corsOrigin: process.env.CORS_ORIGIN ?? '',
  jwt: {
    secret: jwtSecret(),
    expiresIn: process.env.JWT_EXPIRES_IN ?? '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
    // Server-side refresh-grant lifetime (Redis), keep in sync with the JWT ttl.
    refreshTtlSeconds: parseInt(process.env.JWT_REFRESH_TTL_SECONDS ?? '604800', 10),
  },
  solana: {
    rpcUrl: process.env.SOLANA_RPC_URL ?? 'https://api.devnet.solana.com',
    network: process.env.SOLANA_NETWORK ?? 'devnet',
    programId: process.env.SPLITPAY_PROGRAM_ID ?? '',
    usdcMint:
      process.env.USDC_MINT ?? '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
  },
  helius: {
    apiKey: process.env.HELIUS_API_KEY ?? '',
    webhookId: process.env.HELIUS_WEBHOOK_ID ?? '',
    webhookSecret: process.env.HELIUS_WEBHOOK_SECRET ?? '',
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
  },
});
