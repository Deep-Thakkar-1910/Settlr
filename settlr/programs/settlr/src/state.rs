use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, InitSpace, Debug)]
pub enum InvoiceStatus {
    Pending,
    Paid,
}

#[derive(InitSpace)]
#[account]
pub struct Invoice {
    pub freelancer: Pubkey,
    pub client: Pubkey,
    pub amount: u64,
    #[max_len(200)]
    pub description: String,
    pub deadline: i64,
    pub status: InvoiceStatus,
    pub created_at: i64,
    pub bump: u8,
}

#[derive(InitSpace)]
#[account]
pub struct Username {
    pub owner: Pubkey,
    #[max_len(32)]
    pub name: String,
    pub bump: u8,
}
