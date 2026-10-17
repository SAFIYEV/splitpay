use anchor_lang::prelude::*;

#[error_code]
pub enum SplitpayError {
    #[msg("Group name exceeds 32 bytes")]
    NameTooLong,
    #[msg("Expense description exceeds 48 bytes")]
    DescriptionTooLong,
    #[msg("Group already has the maximum of 20 members")]
    TooManyMembers,
    #[msg("Wallet is already a member of this group")]
    AlreadyMember,
    #[msg("Wallet is not a member of this group")]
    NotGroupMember,
    #[msg("The group authority cannot be removed from the group")]
    CannotRemoveAuthority,
    #[msg("Amount must be greater than zero")]
    InvalidAmount,
    #[msg("Settlement payer and recipient must be different wallets")]
    SelfSettlement,
    #[msg("Settlement is not in Pending status")]
    SettlementNotPending,
    #[msg("Signer is not authorized for this action")]
    Unauthorized,
    #[msg("Mint is not an accepted USDC mint")]
    InvalidMint,
    #[msg("Arithmetic overflow")]
    ArithmeticOverflow,
}
