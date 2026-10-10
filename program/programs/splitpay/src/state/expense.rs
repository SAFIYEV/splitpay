use anchor_lang::prelude::*;

/// PDA seeds: [b"splitpay-expense", group.key().as_ref(), expense_id.to_le_bytes()]
/// `expense_id` is a client-generated u64 nonce (LE bytes), unique per group.
#[account]
pub struct Expense {
    pub group: Pubkey,
    pub paid_by: Pubkey,
    pub amount: u64,
    pub description: String,
    pub settlement_count: u8,
    pub settled: bool,
    pub bump: u8,
}

impl Expense {
    pub const SEED_PREFIX: &'static [u8] = b"splitpay-expense";
    pub const MAX_DESCRIPTION_LEN: usize = 48;

    /// 8  discriminator
    /// + 32 group
    /// + 32 paid_by
    /// + 8  amount
    /// + (4 + 48) description (len prefix + max chars)
    /// + 1  settlement_count
    /// + 1  settled
    /// + 1  bump
    pub const SPACE: usize = 8 + 32 + 32 + 8 + (4 + Self::MAX_DESCRIPTION_LEN) + 1 + 1 + 1;
}
