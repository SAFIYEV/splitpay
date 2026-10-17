use anchor_lang::prelude::*;

use crate::errors::SplitpayError;
use crate::state::{Settlement, SettlementStatus};

/// Closes a settlement account and returns its rent to the payer (`from`),
/// who funded the account at creation. Because the settlement PDA is unique
/// per (from, to, group) triple, closing is also what unblocks the next
/// settlement between the same pair.
///
/// State machine:
/// - Pending: only the payer (`from`) may close — cancels the payment request.
/// - Completed / Disputed: either party may close (cleanup / dispute resolution).
#[derive(Accounts)]
pub struct CloseSettlement<'info> {
    #[account(
        mut,
        seeds = [
            Settlement::SEED_PREFIX,
            settlement.from.as_ref(),
            settlement.to.as_ref(),
            settlement.group.as_ref(),
        ],
        bump = settlement.bump,
        constraint = caller.key() == settlement.from || caller.key() == settlement.to
            @ SplitpayError::Unauthorized,
        close = rent_receiver,
    )]
    pub settlement: Account<'info, Settlement>,
    pub caller: Signer<'info>,
    /// CHECK: receives the settlement account rent. Constrained to the
    /// settlement's `from` wallet, which paid the rent at creation.
    #[account(mut, address = settlement.from @ SplitpayError::Unauthorized)]
    pub rent_receiver: UncheckedAccount<'info>,
}

pub fn handler(ctx: Context<CloseSettlement>) -> Result<()> {
    let settlement = &ctx.accounts.settlement;
    let is_from = ctx.accounts.caller.key() == settlement.from;

    require!(
        settlement.status != SettlementStatus::Pending || is_from,
        SplitpayError::Unauthorized
    );

    Ok(())
}
