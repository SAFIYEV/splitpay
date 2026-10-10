use anchor_lang::prelude::*;

use crate::errors::SplitpayError;
use crate::state::ExpenseGroup;

#[derive(Accounts)]
#[instruction(group_id: u64)]
pub struct CloseGroup<'info> {
    #[account(
        mut,
        seeds = [
            ExpenseGroup::SEED_PREFIX,
            authority.key().as_ref(),
            group_id.to_le_bytes().as_ref(),
        ],
        bump = group.bump,
        has_one = authority @ SplitpayError::Unauthorized,
        close = authority,
    )]
    pub group: Account<'info, ExpenseGroup>,
    #[account(mut)]
    pub authority: Signer<'info>,
}

pub fn handler(_ctx: Context<CloseGroup>, _group_id: u64) -> Result<()> {
    // All checks live in the account constraints (seeds, has_one, close).
    Ok(())
}
