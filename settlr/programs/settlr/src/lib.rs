pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

pub use constants::*;
pub use instructions::*;
pub use state::*;

use anchor_lang::prelude::*;

declare_id!("DdKS6wL5UKk8EAnTVfGUBThcDuqAy79ZyChr5S9eXJjC");

#[program]
pub mod settlr {
    use super::*;

    pub fn create_invoice(
        context: Context<CreateInvoiceAccountConstraints>,
        invoice_id: u64,
        amount: u64,
        description: String,
        deadline: i64,
        client: Pubkey,
    ) -> Result<()> {
        instructions::create_invoice::create_invoice(
            context,
            invoice_id, // forwarded to handler — used by Anchor for PDA seed derivation
            amount,
            description,
            deadline,
            client,
        )
    }

    pub fn pay_invoice(context: Context<PayInvoiceAccountConstraints>) -> Result<()> {
        instructions::pay_invoice::pay_invoice(context)
    }

    pub fn register_username(
        context: Context<RegisterUsernameAccountConstraints>,
        name: String,
    ) -> Result<()> {
        instructions::register_username::register_username(context, name)
    }
}
