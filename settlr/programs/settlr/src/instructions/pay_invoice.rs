use anchor_lang::prelude::*;

use crate::error::InvoiceError;
use crate::state::{Invoice, InvoiceStatus};

#[derive(Accounts)]
pub struct PayInvoiceAccountConstraints<'info> {
    #[account(
        mut,
        has_one = client @ InvoiceError::Unauthorized,
    )]
    pub invoice: Account<'info, Invoice>,

    pub client: Signer<'info>,
}

pub fn pay_invoice(context: Context<PayInvoiceAccountConstraints>) -> Result<()> {
    let invoice = &mut context.accounts.invoice;

    require!(
        invoice.status == InvoiceStatus::Pending,
        InvoiceError::AlreadyPaid
    );

    let clock = Clock::get()?;
    require!(
        clock.unix_timestamp <= invoice.deadline,
        InvoiceError::InvoiceExpired
    );

    invoice.status = InvoiceStatus::Paid;

    emit!(InvoicePaid {
        invoice_pda: invoice.key(),
        paid_at: clock.unix_timestamp,
    });

    Ok(())
}

#[event]
pub struct InvoicePaid {
    pub invoice_pda: Pubkey,
    pub paid_at: i64,
}
