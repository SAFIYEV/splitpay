use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum SettlementStatus {
    Pending,
    Completed,
    Disputed,
}

/// PDA seeds: [b"splitpay-settlement", from.key().as_ref(), to.key().as_ref(), group.key().as_ref()]
/// Note: this seed layout allows exactly one open settlement account per
/// (from, to, group) triple; `close_settlement` frees the PDA (and rent) so
/// the next settlement between the same pair can be created.
#[account]
pub struct Settlement {
    pub from: Pubkey,
    pub to: Pubkey,
    pub group: Pubkey,
    pub amount: u64,
    pub status: SettlementStatus,
    pub bump: u8,
}

impl Settlement {
    pub const SEED_PREFIX: &'static [u8] = b"splitpay-settlement";

    /// 8  discriminator
    /// + 32 from
    /// + 32 to
    /// + 32 group
    /// + 8  amount
    /// + 1  status enum discriminant
    /// + 1  bump
    pub const SPACE: usize = 8 + 32 + 32 + 32 + 8 + 1 + 1;
}
