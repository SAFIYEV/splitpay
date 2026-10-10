export const TRANSACTION_VERIFICATION_QUEUE = 'transaction-verification';

export interface VerifyTransactionJob {
  settlementId: string;
  signature: string;
}
