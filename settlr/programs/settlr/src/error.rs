use anchor_lang::prelude::*;

#[error_code]
pub enum InvoiceError {
    #[msg("Description too long")]
    DescriptionTooLong,
    #[msg("Deadline must be in the future")]
    InvalidDeadline,
    #[msg("Invoice already paid")]
    AlreadyPaid,
    #[msg("Only the client can pay this invoice")]
    Unauthorized,
    #[msg("Invoice has expired")]
    InvoiceExpired,
    #[msg("Amount must be greater than zero")]
    InvalidAmount,
}
