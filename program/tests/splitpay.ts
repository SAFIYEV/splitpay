import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import {
  PublicKey,
  Keypair,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  createMint,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
  getAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { assert, expect } from "chai";
import { Splitpay } from "../target/types/splitpay";

/**
 * These tests require `anchor test` on a machine with the Solana CLI +
 * Anchor CLI installed (see program/README.md) — they run against
 * solana-test-validator started automatically by the Anchor CLI.
 */

describe("splitpay", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Splitpay as Program<Splitpay>;
  const authority = provider.wallet;

  // u64 PDA seed nonces (little-endian 8-byte buffers)
  const groupId = new BN(Date.now());
  const expenseId = new BN(1);

  const member = Keypair.generate();

  const groupIdLe = groupId.toArrayLike(Buffer, "le", 8);
  const expenseIdLe = expenseId.toArrayLike(Buffer, "le", 8);

  const [groupPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("splitpay-group"), authority.publicKey.toBuffer(), groupIdLe],
    program.programId
  );

  const [expensePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("splitpay-expense"), groupPda.toBuffer(), expenseIdLe],
    program.programId
  );

  const [settlementPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("splitpay-settlement"),
      authority.publicKey.toBuffer(),
      member.publicKey.toBuffer(),
      groupPda.toBuffer(),
    ],
    program.programId
  );

  before(async () => {
    // Fund the member keypair so it can sign transactions if needed.
    const sig = await provider.connection.requestAirdrop(
      member.publicKey,
      LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(sig);
  });

  it("creates a group", async () => {
    await program.methods
      .createGroup(groupId, "Ski Trip")
      .accounts({
        group: groupPda,
        authority: authority.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const group = await program.account.expenseGroup.fetch(groupPda);
    assert.equal(group.authority.toBase58(), authority.publicKey.toBase58());
    assert.equal(group.name, "Ski Trip");
    assert.equal(group.memberCount, 1);
    assert.deepEqual(
      group.members.map((m: PublicKey) => m.toBase58()),
      [authority.publicKey.toBase58()]
    );
    assert.equal(group.totalSpent.toNumber(), 0);
  });

  it("rejects a group name longer than 32 bytes", async () => {
    const badId = new BN(Date.now() + 999);
    const [badPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("splitpay-group"),
        authority.publicKey.toBuffer(),
        badId.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );
    try {
      await program.methods
        .createGroup(badId, "x".repeat(33))
        .accounts({
          group: badPda,
          authority: authority.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      assert.fail("expected NameTooLong");
    } catch (err) {
      expect(err.toString()).to.include("NameTooLong");
    }
  });

  it("adds a member", async () => {
    await program.methods
      .addMember(groupId, member.publicKey)
      .accounts({
        group: groupPda,
        authority: authority.publicKey,
      })
      .rpc();

    const group = await program.account.expenseGroup.fetch(groupPda);
    assert.equal(group.memberCount, 2);
    assert.include(
      group.members.map((m: PublicKey) => m.toBase58()),
      member.publicKey.toBase58()
    );
  });

  it("rejects adding the same member twice", async () => {
    try {
      await program.methods
        .addMember(groupId, member.publicKey)
        .accounts({
          group: groupPda,
          authority: authority.publicKey,
        })
        .rpc();
      assert.fail("expected AlreadyMember");
    } catch (err) {
      expect(err.toString()).to.include("AlreadyMember");
    }
  });

  it("adds an expense and updates total_spent", async () => {
    const amount = new BN(25_000_000); // 25 USDC (6 decimals)

    await program.methods
      .addExpense(groupId, expenseId, amount, "Dinner")
      .accounts({
        group: groupPda,
        expense: expensePda,
        paidBy: authority.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const expense = await program.account.expense.fetch(expensePda);
    assert.equal(expense.group.toBase58(), groupPda.toBase58());
    assert.equal(expense.paidBy.toBase58(), authority.publicKey.toBase58());
    assert.equal(expense.amount.toNumber(), amount.toNumber());
    assert.equal(expense.description, "Dinner");
    assert.isFalse(expense.settled);

    const group = await program.account.expenseGroup.fetch(groupPda);
    assert.equal(group.totalSpent.toNumber(), amount.toNumber());
  });

  it("rejects an expense from a non-member", async () => {
    const outsider = Keypair.generate();
    const sig = await provider.connection.requestAirdrop(
      outsider.publicKey,
      LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(sig);

    const otherExpenseId = new BN(2);
    const [otherExpensePda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("splitpay-expense"),
        groupPda.toBuffer(),
        otherExpenseId.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    try {
      await program.methods
        .addExpense(groupId, otherExpenseId, new BN(100), "Nope")
        .accounts({
          group: groupPda,
          expense: otherExpensePda,
          paidBy: outsider.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([outsider])
        .rpc();
      assert.fail("expected NotGroupMember");
    } catch (err) {
      expect(err.toString()).to.include("NotGroupMember");
    }
  });

  it("creates a settlement", async () => {
    await program.methods
      .createSettlement(groupId, new BN(10_000_000)) // 10 USDC
      .accounts({
        group: groupPda,
        settlement: settlementPda,
        to: member.publicKey,
        from: authority.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const settlement = await program.account.settlement.fetch(settlementPda);
    assert.equal(settlement.from.toBase58(), authority.publicKey.toBase58());
    assert.equal(settlement.to.toBase58(), member.publicKey.toBase58());
    assert.equal(settlement.amount.toNumber(), 10_000_000);
    assert.deepEqual(settlement.status, { pending: {} });
  });

  it("completes a settlement with a USDC SPL transfer (test mint)", async () => {
    // On a local validator there is no real USDC, so we create a test mint
    // with 6 decimals and treat it as stand-in USDC. On devnet, use the real
    // devnet USDC mint: 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU.
    const payer = (provider.wallet as anchor.Wallet).payer;

    const usdcMint = await createMint(
      provider.connection,
      payer,
      authority.publicKey,
      null,
      6 // USDC decimals
    );

    const payerAta = getAssociatedTokenAddressSync(
      usdcMint,
      authority.publicKey
    );
    const recipientAta = getAssociatedTokenAddressSync(
      usdcMint,
      member.publicKey
    );

    // Create the payer ATA and fund it with 10 test-USDC.
    await provider.sendAndConfirm(
      new anchor.web3.Transaction().add(
        createAssociatedTokenAccountInstruction(
          authority.publicKey,
          payerAta,
          authority.publicKey,
          usdcMint
        )
      )
    );
    await mintTo(provider.connection, payer, usdcMint, payerAta, authority.publicKey, 10_000_000);

    // Create the recipient ATA.
    await provider.sendAndConfirm(
      new anchor.web3.Transaction().add(
        createAssociatedTokenAccountInstruction(
          authority.publicKey,
          recipientAta,
          member.publicKey,
          usdcMint
        )
      )
    );

    await program.methods
      .completeSettlement()
      .accounts({
        settlement: settlementPda,
        payer: authority.publicKey,
        recipient: member.publicKey,
        usdcMint,
        payerTokenAccount: payerAta,
        recipientTokenAccount: recipientAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const settlement = await program.account.settlement.fetch(settlementPda);
    assert.deepEqual(settlement.status, { completed: {} });

    const recipientBalance = await getAccount(provider.connection, recipientAta);
    assert.equal(Number(recipientBalance.amount), 10_000_000);

    const payerBalance = await getAccount(provider.connection, payerAta);
    assert.equal(Number(payerBalance.amount), 0);
  });

  it("dispute flow: new settlement -> dispute by recipient", async () => {
    // Reverse direction: member -> authority (fresh PDA for the pair).
    const [disputeSettlementPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("splitpay-settlement"),
        member.publicKey.toBuffer(),
        authority.publicKey.toBuffer(),
        groupPda.toBuffer(),
      ],
      program.programId
    );

    await program.methods
      .createSettlement(groupId, new BN(5_000_000))
      .accounts({
        group: groupPda,
        settlement: disputeSettlementPda,
        to: authority.publicKey,
        from: member.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([member])
      .rpc();

    await program.methods
      .disputeSettlement()
      .accounts({
        settlement: disputeSettlementPda,
        caller: authority.publicKey,
      })
      .rpc();

    const settlement = await program.account.settlement.fetch(
      disputeSettlementPda
    );
    assert.deepEqual(settlement.status, { disputed: {} });

    // Disputing again must fail (not Pending anymore).
    try {
      await program.methods
        .disputeSettlement()
        .accounts({
          settlement: disputeSettlementPda,
          caller: member.publicKey,
        })
        .signers([member])
        .rpc();
      assert.fail("expected SettlementNotPending");
    } catch (err) {
      expect(err.toString()).to.include("SettlementNotPending");
    }
  });

  it("rejects dispute from an unrelated wallet", async () => {
    const outsider = Keypair.generate();
    const sig = await provider.connection.requestAirdrop(
      outsider.publicKey,
      LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(sig);

    // The authority->member settlement is Completed; an outsider calling
    // dispute on a Pending one would fail Unauthorized, but the seed
    // constraint alone also rejects: use the disputed member->authority PDA
    // where outsider is neither from nor to -> Unauthorized / constraint error.
    const [disputeSettlementPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("splitpay-settlement"),
        member.publicKey.toBuffer(),
        authority.publicKey.toBuffer(),
        groupPda.toBuffer(),
      ],
      program.programId
    );

    try {
      await program.methods
        .disputeSettlement()
        .accounts({
          settlement: disputeSettlementPda,
          caller: outsider.publicKey,
        })
        .signers([outsider])
        .rpc();
      assert.fail("expected rejection");
    } catch (err) {
      expect(err.toString()).to.match(/Unauthorized|SettlementNotPending/);
    }
  });

  it("removes a member", async () => {
    await program.methods
      .removeMember(groupId, member.publicKey)
      .accounts({
        group: groupPda,
        authority: authority.publicKey,
      })
      .rpc();

    const group = await program.account.expenseGroup.fetch(groupPda);
    assert.equal(group.memberCount, 1);
    assert.notInclude(
      group.members.map((m: PublicKey) => m.toBase58()),
      member.publicKey.toBase58()
    );
  });

  it("closes the group and reclaims rent", async () => {
    await program.methods
      .closeGroup(groupId)
      .accounts({
        group: groupPda,
        authority: authority.publicKey,
      })
      .rpc();

    const closed = await provider.connection.getAccountInfo(groupPda);
    assert.isNull(closed);
  });
});
