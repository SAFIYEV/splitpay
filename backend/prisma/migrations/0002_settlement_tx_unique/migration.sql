-- Replay protection: one Solana transaction signature can be linked to only
-- one settlement. Postgres allows multiple NULLs in a unique index.
CREATE UNIQUE INDEX "Settlement_solanaTransactionId_key" ON "Settlement"("solanaTransactionId");
