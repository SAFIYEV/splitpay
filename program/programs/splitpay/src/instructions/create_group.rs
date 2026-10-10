use anchor_lang::prelude::*;

use crate::errors::SplitpayError;
use crate::state::ExpenseGroup;

#[derive(Accounts)]
#[instruction(group_id: u64, name: String)]
pub struct CreateGroup<'info> {
    #[account(
        init,
        payer = authority,
        space = ExpenseGroup::SPACE,
        seeds = [
            ExpenseGroup::SEED_PREFIX,
            authority.key().as_ref(),
            group_id.to_le_bytes().as_ref(),
        ],
        bump,
    )]
    pub group: Account<'info, ExpenseGroup>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<CreateGroup>, _group_id: u64, name: String) -> Result<()> {
    require!(
        name.len() <= ExpenseGroup::MAX_NAME_LEN,
        SplitpayError::NameTooLong
    );

    let group = &mut ctx.accounts.group;
    group.authority = ctx.accounts.authority.key();
    group.name = name;
    group.members = vec![ctx.accounts.authority.key()];
    group.member_count = 1;
    group.total_spent = 0;
    group.bump = ctx.bumps.group;

    Ok(())
}
