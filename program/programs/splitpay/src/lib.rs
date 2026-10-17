use anchor_lang::prelude::*;

pub mod errors;
pub mod instructions;
pub mod state;

use instructions::*;

// Placeholder program id. After the first `anchor build` run `anchor keys sync`
// to replace it with the real program keypair pubkey, and set it in the root
// .env as SPLITPAY_PROGRAM_ID.
declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod splitpay {
    use super::*;

    /// Create a new expense group. `group_id` is a client-generated u64 nonce
    /// (e.g. a millisecond timestamp or an incrementing counter kept off-chain)
    /// encoded as little-endian bytes in the PDA seeds, allowing one wallet to
    /// own many groups.
    pub fn create_group(ctx: Context<CreateGroup>, group_id: u64, name: String) -> Result<()> {
        instructions::create_group::handler(ctx, group_id, name)
    }

    /// Add a member to a group (group authority only).
    pub fn add_member(ctx: Context<AddMember>, group_id: u64, member: Pubkey) -> Result<()> {
        instructions::add_member::handler(ctx, group_id, member)
    }

    /// Remove a member from a group (group authority only).
    pub fn remove_member(ctx: Context<RemoveMember>, group_id: u64, member: Pubkey) -> Result<()> {
        instructions::remove_member::handler(ctx, group_id, member)
    }

    /// Close a group and reclaim its rent (group authority only).
    pub fn close_group(ctx: Context<CloseGroup>, group_id: u64) -> Result<()> {
        instructions::close_group::handler(ctx, group_id)
    }

    /// Record a new expense in a group (group members only). `expense_id` is a
    /// client-generated u64 nonce (LE bytes) that makes each expense PDA unique.
    pub fn add_expense(
        ctx: Context<AddExpense>,
        group_id: u64,
        expense_id: u64,
        amount: u64,
        description: String,
    ) -> Result<()> {
        instructions::add_expense::handler(ctx, group_id, expense_id, amount, description)
    }

    /// Create a settlement request from the signer (payer) to another group member.
    pub fn create_settlement(
        ctx: Context<CreateSettlement>,
        group_id: u64,
        amount: u64,
    ) -> Result<()> {
        instructions::create_settlement::handler(ctx, group_id, amount)
    }

    /// Pay a pending settlement: CPI-transfers `amount` USDC from the payer's
    /// associated token account to the recipient's and marks it Completed.
    pub fn complete_settlement(ctx: Context<CompleteSettlement>) -> Result<()> {
        instructions::complete_settlement::handler(ctx)
    }

    /// Open a dispute on a pending settlement (callable by payer or recipient).
    pub fn dispute_settlement(ctx: Context<DisputeSettlement>) -> Result<()> {
        instructions::dispute_settlement::handler(ctx)
    }

    /// Close a settlement account and reclaim its rent for the payer. Pending:
    /// payer only (cancel). Completed/Disputed: either party. Closing frees the
    /// (from, to, group) PDA so a new settlement can be created for the pair.
    pub fn close_settlement(ctx: Context<CloseSettlement>) -> Result<()> {
        instructions::close_settlement::handler(ctx)
    }
}
