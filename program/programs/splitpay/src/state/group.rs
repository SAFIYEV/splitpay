use anchor_lang::prelude::*;

/// PDA seeds: [b"splitpay-group", authority.key().as_ref(), group_id.to_le_bytes()]
/// `group_id` is a client-generated u64 nonce (LE bytes), so a single wallet can
/// own many groups under the same authority seed.
#[account]
pub struct ExpenseGroup {
    pub authority: Pubkey,
    pub name: String,
    pub member_count: u8,
    pub members: Vec<Pubkey>,
    pub total_spent: u64,
    pub bump: u8,
}

impl ExpenseGroup {
    pub const SEED_PREFIX: &'static [u8] = b"splitpay-group";
    pub const MAX_NAME_LEN: usize = 32;
    pub const MAX_MEMBERS: usize = 20;

    /// 8  discriminator
    /// + 32 authority
    /// + (4 + 32) name (len prefix + max chars)
    /// + 1  member_count
    /// + (4 + 32 * 20) members vec (len prefix + max capacity)
    /// + 8  total_spent
    /// + 1  bump
    pub const SPACE: usize = 8 + 32 + (4 + Self::MAX_NAME_LEN) + 1 + (4 + 32 * Self::MAX_MEMBERS) + 8 + 1;

    pub fn is_member(&self, wallet: &Pubkey) -> bool {
        self.members.contains(wallet)
    }
}
