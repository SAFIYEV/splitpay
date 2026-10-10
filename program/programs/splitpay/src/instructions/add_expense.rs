use anchor_lang::prelude::*;

use crate::errors::SplitpayError;
use crate::state::{Expense, ExpenseGroup};

#[derive(Accounts)]
#[instruction(group_id: u64, expense_id: u64)]
pub struct AddExpense<'info> {
    #[account(
        mut,
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
        payer = paid_by,
        space = Expense::SPACE,
        seeds = [
            Expense::SEED_PREFIX,
            group.key().as_ref(),
            expense_id.to_le_bytes().as_ref(),
        ],
        bump,
    )]
    pub expense: Account<'info, Expense>,
    #[account(mut)]
    pub paid_by: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<AddExpense>,
    _group_id: u64,
    _expense_id: u64,
    amount: u64,
    description: String,
) -> Result<()> {
    require!(amount > 0, SplitpayError::InvalidAmount);
    require!(
        description.len() <= Expense::MAX_DESCRIPTION_LEN,
        SplitpayError::DescriptionTooLong
    );

    let group = &mut ctx.accounts.group;
    require!(
        group.is_member(&ctx.accounts.paid_by.key()),
        SplitpayError::NotGroupMember
    );

    group.total_spent = group
        .total_spent
        .checked_add(amount)
        .ok_or(SplitpayError::ArithmeticOverflow)?;

    let expense = &mut ctx.accounts.expense;
    expense.group = group.key();
    expense.paid_by = ctx.accounts.paid_by.key();
    expense.amount = amount;
    expense.description = description;
    expense.settlement_count = 0;
    expense.settled = false;
    expense.bump = ctx.bumps.expense;

    Ok(())
}
