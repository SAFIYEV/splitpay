use anchor_lang::prelude::*;

use crate::errors::SplitpayError;
use crate::state::{Settlement, SettlementStatus};

#[derive(Accounts)]
pub struct DisputeSettlement<'info> {
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
    )]
    pub settlement: Account<'info, Settlement>,
    pub caller: Signer<'info>,
}

pub fn handler(ctx: Context<DisputeSettlement>) -> Result<()> {
    let settlement = &mut ctx.accounts.settlement;

    require!(
        settlement.status == SettlementStatus::Pending,
        SplitpayError::SettlementNotPending
    );

    settlement.status = SettlementStatus::Disputed;

    Ok(())
}
