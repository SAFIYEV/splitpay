use anchor_lang::prelude::*;

use crate::errors::SplitpayError;
use crate::state::{ExpenseGroup, Settlement, SettlementStatus};

#[derive(Accounts)]
#[instruction(group_id: u64)]
pub struct CreateSettlement<'info> {
    #[account(
        seeds = [
            ExpenseGroup::SEED_PREFIX,
            group.authority.as_ref(),
            group_id.to_le_bytes().as_ref(),
        ],
        bump = group.bump,
    )]
    pub group: Account<'info, ExpenseGroup>,
    #[account(
        init,
        payer = from,
        space = Settlement::SPACE,
        seeds = [
            Settlement::SEED_PREFIX,
            from.key().as_ref(),
            to.key().as_ref(),
            group.key().as_ref(),
        ],
        bump,
    )]
    pub settlement: Account<'info, Settlement>,
    /// CHECK: recipient wallet; used only as a PDA seed and for the group
    /// membership check. No data is read from or written to this account.
    pub to: UncheckedAccount<'info>,
    #[account(mut)]
    pub from: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<CreateSettlement>, _group_id: u64, amount: u64) -> Result<()> {
    require!(amount > 0, SplitpayError::InvalidAmount);

    let from = ctx.accounts.from.key();
    let to = ctx.accounts.to.key();
    require!(from != to, SplitpayError::SelfSettlement);

    let group = &ctx.accounts.group;
    require!(group.is_member(&from), SplitpayError::NotGroupMember);
    require!(group.is_member(&to), SplitpayError::NotGroupMember);

    let settlement = &mut ctx.accounts.settlement;
    settlement.from = from;
    settlement.to = to;
    settlement.group = group.key();
    settlement.amount = amount;
    settlement.status = SettlementStatus::Pending;
    settlement.bump = ctx.bumps.settlement;

    Ok(())
}
