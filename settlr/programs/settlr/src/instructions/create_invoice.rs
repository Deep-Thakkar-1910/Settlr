use anchor_lang::prelude::*;

use crate::constants::INVOICE_SEED;
use crate::error::InvoiceError;
use crate::state::{Invoice, InvoiceStatus};

#[derive(Accounts)]
#[instruction(invoice_id: u64)]
pub struct CreateInvoiceAccountConstraints<'info> {
    #[account(
        init,
        payer = freelancer,
        space = Invoice::DISCRIMINATOR.len() + Invoice::INIT_SPACE,
        seeds = [INVOICE_SEED, freelancer.key().as_ref(), &invoice_id.to_le_bytes()],
        bump
    )]
    pub invoice: Account<'info, Invoice>,

    #[account(mut)]
    pub freelancer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn create_invoice(
    context: Context<CreateInvoiceAccountConstraints>,
    _invoice_id: u64,
    amount: u64,
    description: String,
    deadline: i64,
    client: Pubkey,
) -> Result<()> {
    require!(description.len() <= 200, InvoiceError::DescriptionTooLong);
    require!(amount > 0, InvoiceError::InvalidAmount);

    let clock = Clock::get()?;
    require!(
        deadline > clock.unix_timestamp,
        InvoiceError::InvalidDeadline
    );

    let invoice = &mut context.accounts.invoice;
    invoice.freelancer = context.accounts.freelancer.key();
    invoice.client = client;
    invoice.amount = amount;
    invoice.description = description;
    invoice.deadline = deadline;
    invoice.status = InvoiceStatus::Pending;
    invoice.created_at = clock.unix_timestamp;
    invoice.bump = context.bumps.invoice;

    emit!(InvoiceCreated {
        invoice_pda: invoice.key(),
        freelancer: invoice.freelancer,
        client: invoice.client,
        amount: invoice.amount,
    });

    Ok(())
}

#[event]
pub struct InvoiceCreated {
    pub invoice_pda: Pubkey,
    pub freelancer: Pubkey,
    pub client: Pubkey,
    pub amount: u64,
}
