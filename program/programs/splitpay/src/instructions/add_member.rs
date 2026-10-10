use anchor_lang::prelude::*;

use crate::errors::SplitpayError;
use crate::state::ExpenseGroup;

#[derive(Accounts)]
#[instruction(group_id: u64, member: Pubkey)]
pub struct AddMember<'info> {
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

pub fn handler(ctx: Context<AddMember>, _group_id: u64, member: Pubkey) -> Result<()> {
    let group = &mut ctx.accounts.group;

    require!(
        group.members.len() < ExpenseGroup::MAX_MEMBERS,
        SplitpayError::TooManyMembers
    );
    require!(!group.is_member(&member), SplitpayError::AlreadyMember);

    group.members.push(member);
    group.member_count = group.member_count.saturating_add(1);

    Ok(())
}
