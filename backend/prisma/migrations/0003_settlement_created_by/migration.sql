-- Counterparty-confirmation model for off-chain settlements: completion is
-- allowed only to the party that did NOT create the settlement record.
-- Legacy rows get '' (creator unknown) and therefore cannot be completed
-- off-chain by anyone — on-chain verification remains their only path.
ALTER TABLE "Settlement" ADD COLUMN "createdById" TEXT NOT NULL DEFAULT '';
