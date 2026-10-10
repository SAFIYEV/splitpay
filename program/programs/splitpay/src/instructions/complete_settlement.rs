use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked},
};

use crate::errors::SplitpayError;
use crate::state::{Settlement, SettlementStatus};

#[derive(Accounts)]
pub struct CompleteSettlement<'info> {
    #[account(
        mut,
        seeds = [
            Settlement::SEED_PREFIX,
            payer.key().as_ref(),
            recipient.key().as_ref(),
            settlement.group.as_ref(),
        ],
        bump = settlement.bump,
        constraint = settlement.from == payer.key() @ SplitpayError::Unauthorized,
        constraint = settlement.to == recipient.key() @ SplitpayError::Unauthorized,
    )]
    pub settlement: Account<'info, Settlement>,
    /// The debtor paying the settlement; must sign to authorize the USDC move.
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: recipient wallet; only its pubkey is used (PDA seed + ATA owner).
    pub recipient: UncheckedAccount<'info>,
    /// USDC mint. Devnet USDC: 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU
    /// (mainnet: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v).
    pub usdc_mint: InterfaceAccount<'info, Mint>,
    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = payer,
        associated_token::token_program = token_program,
    )]
    pub payer_token_account: InterfaceAccount<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = recipient,
        associated_token::token_program = token_program,
    )]
    pub recipient_token_account: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<CompleteSettlement>) -> Result<()> {
    let settlement = &mut ctx.accounts.settlement;

    require!(
        settlement.status == SettlementStatus::Pending,
        SplitpayError::SettlementNotPending
    );

    // CPI: transfer `settlement.amount` USDC from the payer's ATA to the
    // recipient's ATA. `transfer_checked` enforces mint/decimals consistency.
    let cpi_accounts = TransferChecked {
        from: ctx.accounts.payer_token_account.to_account_info(),
        mint: ctx.accounts.usdc_mint.to_account_info(),
        to: ctx.accounts.recipient_token_account.to_account_info(),
        authority: ctx.accounts.payer.to_account_info(),
    };
    let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts);
    transfer_checked(
        cpi_ctx,
        settlement.amount,
        ctx.accounts.usdc_mint.decimals,
    )?;

    settlement.status = SettlementStatus::Completed;

    Ok(())
}
