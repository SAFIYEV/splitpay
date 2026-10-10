use anchor_lang::prelude::*;

use crate::errors::SplitpayError;
use crate::state::ExpenseGroup;

#[derive(Accounts)]
#[instruction(group_id: u64, member: Pubkey)]
pub struct RemoveMember<'info> {
    #[account(
        mut,
        seeds = [
            ExpenseGroup::SEED_PREFIX,
            authority.key().as_ref(),
            group_id.to_le_bytes().as_ref(),
        ],
        bump = group.bump,
        has_one = authority @ SplitpayError::Unauthorized,
    )]
    pub group: Account<'info, ExpenseGroup>,
    pub authority: Signer<'info>,
}

pub fn handler(ctx: Context<RemoveMember>, _group_id: u64, member: Pubkey) -> Result<()> {
    let group = &mut ctx.accounts.group;

    require!(group.is_member(&member), SplitpayError::NotGroupMember);
    require!(
        member != group.authority,
        SplitpayError::CannotRemoveAuthority
    );

    group.members.retain(|m| m != &member);
    group.member_count = group
        .members
        .len()
        .try_into()
        .map_err(|_| SplitpayError::ArithmeticOverflow)?;

    Ok(())
}
