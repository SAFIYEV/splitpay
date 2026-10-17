import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AccountRole,
  address,
  appendTransactionMessageInstruction,
  compileTransactionMessage,
  createSolanaRpc,
  createTransactionMessage,
  getAddressEncoder,
  getBase58Encoder,
  getBase64Decoder,
  getCompiledTransactionMessageEncoder,
  getProgramDerivedAddress,
  isAddress,
  pipe,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  type Instruction,
  type Transaction,
} from '@solana/kit';

// Classic SPL Token program (USDC mainnet/devnet mints live here).
// TODO: switch to Token-2022 program id if the mint requires it.
const TOKEN_PROGRAM = address('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const ASSOCIATED_TOKEN_PROGRAM = address(
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
);
// SPL Token `transferChecked` instruction index
const TRANSFER_CHECKED_DISCRIMINATOR = 12;
const USDC_DECIMALS = 6;

export interface PreparedTransfer {
  /** base64-encoded unsigned transaction for the client to sign */
  transaction: string;
  blockhash: string;
  lastValidBlockHeight: string;
  fromTokenAccount: string;
  toTokenAccount: string;
}

export interface OnChainStatus {
  found: boolean;
  confirmationStatus?: 'processed' | 'confirmed' | 'finalized';
  error?: string;
}

export interface PaymentExpectation {
  fromWallet: string;
  toWallet: string;
  amountMicro: bigint;
}

/**
 * 'verified' — the parsed transaction proves the exact USDC transfer;
 * 'pending' — not confirmed yet, retry later;
 * 'failed' — the confirmed transaction can never satisfy the settlement.
 */
export type PaymentVerification =
  | { status: 'verified' }
  | { status: 'pending' }
  | { status: 'failed'; reason: string };

/** Minimal structural view of a jsonParsed transaction (spl-token parsed). */
interface ParsedTransactionView {
  meta?: { err?: unknown } | null;
  transaction?: {
    message?: {
      instructions?: Array<{
        program?: string;
        parsed?: {
          type?: string;
          info?: {
            mint?: string;
            source?: string;
            destination?: string;
            authority?: string;
            tokenAmount?: { amount?: string; decimals?: number };
          };
        };
      }>;
    };
  };
}

@Injectable()
export class SolanaService {
  private readonly logger = new Logger(SolanaService.name);
  private readonly rpc: ReturnType<typeof createSolanaRpc>;
  private readonly usdcMint: string;

  constructor(config: ConfigService) {
    this.rpc = createSolanaRpc(config.get<string>('solana.rpcUrl')!);
    this.usdcMint = config.get<string>('solana.usdcMint')!;
  }

  validateAddress(value: string): boolean {
    return isAddress(value);
  }

  /**
   * Derives the Associated Token Account for `owner` holding USDC.
   * ATA = PDA([owner, tokenProgram, mint], associatedTokenProgram).
   */
  async findAssociatedTokenAccount(owner: string): Promise<string> {
    const addressEncoder = getAddressEncoder();
    const [ata] = await getProgramDerivedAddress({
      programAddress: ASSOCIATED_TOKEN_PROGRAM,
      seeds: [
        addressEncoder.encode(address(owner)),
        addressEncoder.encode(TOKEN_PROGRAM),
        addressEncoder.encode(address(this.usdcMint)),
      ],
    });
    return ata;
  }

  /**
   * Builds an unsigned `transferChecked` USDC transaction from `fromWallet`
   * to `toWallet`. The client signs it with the connected wallet and submits
   * it; the backend verifies the resulting signature afterwards.
   *
   * Requires RPC access (fetches a fresh blockhash).
   *
   * TODO: prepend a createAssociatedTokenAccountIdempotent instruction for
   * the recipient ATA so first-time recipients can be paid.
   */
  async buildUsdcTransfer(
    fromWallet: string,
    toWallet: string,
    amountMicro: bigint,
  ): Promise<PreparedTransfer> {
    const fromAta = await this.findAssociatedTokenAccount(fromWallet);
    const toAta = await this.findAssociatedTokenAccount(toWallet);

    // transferChecked data: discriminator(1) + amount u64 LE(8) + decimals(1)
    const data = new Uint8Array(10);
    data[0] = TRANSFER_CHECKED_DISCRIMINATOR;
    new DataView(data.buffer).setBigUint64(1, amountMicro, true);
    data[9] = USDC_DECIMALS;

    const instruction: Instruction = {
      programAddress: TOKEN_PROGRAM,
      accounts: [
        { address: address(fromAta), role: AccountRole.WRITABLE },
        { address: address(this.usdcMint), role: AccountRole.WRITABLE },
        { address: address(toAta), role: AccountRole.WRITABLE },
        { address: address(fromWallet), role: AccountRole.READONLY_SIGNER },
      ],
      data,
    };

    let blockhash: {
      blockhash: Parameters<
        typeof setTransactionMessageLifetimeUsingBlockhash
      >[0]['blockhash'];
      lastValidBlockHeight: bigint;
    };
    try {
      const { value } = await this.rpc.getLatestBlockhash().send();
      blockhash = value;
    } catch (err) {
      this.logger.error(`getLatestBlockhash failed: ${(err as Error).message}`);
      throw new ServiceUnavailableException(
        'Solana RPC unreachable — cannot prepare transaction',
      );
    }

    const message = pipe(
      createTransactionMessage({ version: 0 }),
      (m) => setTransactionMessageFeePayer(address(fromWallet), m),
      (m) => setTransactionMessageLifetimeUsingBlockhash(blockhash, m),
      (m) => appendTransactionMessageInstruction(instruction, m),
    );

    const compiled = compileTransactionMessage(message);
    const messageBytes = new Uint8Array(
      getCompiledTransactionMessageEncoder().encode(compiled),
    ) as unknown as Transaction['messageBytes'];
    // Unsigned transaction: fee payer slot present, signature empty.
    const transaction: Transaction = {
      messageBytes,
      signatures: { [address(fromWallet)]: null } as Transaction['signatures'],
    };
    const base64 = getBase64Decoder().decode(
      this.encodeTransaction(transaction),
    );

    return {
      transaction: base64,
      blockhash: String(blockhash.blockhash),
      lastValidBlockHeight: blockhash.lastValidBlockHeight.toString(),
      fromTokenAccount: fromAta,
      toTokenAccount: toAta,
    };
  }

  /** Serializes a (partially signed) transaction: signature count + sigs + message. */
  private encodeTransaction(transaction: Transaction): Uint8Array {
    const signatureEntries = Object.entries(transaction.signatures);
    const messageBytes = new Uint8Array(transaction.messageBytes);
    const length = 1 + signatureEntries.length * 64 + messageBytes.length;
    const out = new Uint8Array(length);
    out[0] = signatureEntries.length;
    signatureEntries.forEach(([, sig], i) => {
      if (sig) {
        out.set(new Uint8Array(sig), 1 + i * 64);
      }
    });
    out.set(messageBytes, 1 + signatureEntries.length * 64);
    return out;
  }

  /**
   * Verifies that `signatureBase58` pays exactly `expected.amountMicro` USDC
   * from the payer's ATA to the recipient's ATA via an SPL `transferChecked`
   * signed by the payer. A settlement may be marked completed only after this
   * returns 'verified' — a bare confirmed signature proves nothing.
   */
  async verifySettlementPayment(
    signatureBase58: string,
    expected: PaymentExpectation,
  ): Promise<PaymentVerification> {
    const status = await this.getSignatureStatus(signatureBase58);
    if (!status.found) {
      return { status: 'pending' };
    }
    if (status.error) {
      return { status: 'failed', reason: `on-chain error: ${status.error}` };
    }
    if (status.confirmationStatus === 'processed') {
      return { status: 'pending' };
    }

    let tx: ParsedTransactionView | null;
    try {
      tx = (await this.rpc
        .getTransaction(signatureBase58 as never, {
          encoding: 'jsonParsed',
          maxSupportedTransactionVersion: 0,
          commitment: 'confirmed',
        })
        .send()) as unknown as ParsedTransactionView | null;
    } catch (err) {
      this.logger.warn(
        `getTransaction failed for ${signatureBase58}: ${(err as Error).message}`,
      );
      return { status: 'pending' };
    }
    if (!tx) {
      return { status: 'pending' };
    }
    if (tx.meta?.err) {
      return { status: 'failed', reason: 'transaction failed on-chain' };
    }

    const [fromAta, toAta] = await Promise.all([
      this.findAssociatedTokenAccount(expected.fromWallet),
      this.findAssociatedTokenAccount(expected.toWallet),
    ]);

    const instructions = tx.transaction?.message?.instructions ?? [];
    const paid = instructions.some((ix) => {
      if (ix.program !== 'spl-token' || ix.parsed?.type !== 'transferChecked') {
        return false;
      }
      const info = ix.parsed.info ?? {};
      return (
        info.mint === this.usdcMint &&
        info.source === fromAta &&
        info.destination === toAta &&
        info.authority === expected.fromWallet &&
        info.tokenAmount?.decimals === USDC_DECIMALS &&
        BigInt(info.tokenAmount?.amount ?? '0') === expected.amountMicro
      );
    });

    return paid
      ? { status: 'verified' }
      : {
          status: 'failed',
          reason: 'no matching USDC transferChecked instruction',
        };
  }

  /**
   * Checks on-chain status of a transaction signature.
   */
  async getSignatureStatus(signatureBase58: string): Promise<OnChainStatus> {
    try {
      const signatureBytes = getBase58Encoder().encode(signatureBase58); // basic format check
      if (signatureBytes.length !== 64) {
        return { found: false, error: 'invalid-signature-format' };
      }
      const { value } = await this.rpc
        .getSignatureStatuses([signatureBase58 as never])
        .send();
      const status = value[0];
      if (!status) {
        return { found: false };
      }
      return {
        found: true,
        confirmationStatus: status.confirmationStatus ?? undefined,
        error: status.err ? JSON.stringify(status.err) : undefined,
      };
    } catch (err) {
      this.logger.warn(
        `getSignatureStatuses failed for ${signatureBase58}: ${(err as Error).message}`,
      );
      return { found: false, error: 'rpc-unreachable' };
    }
  }
}
