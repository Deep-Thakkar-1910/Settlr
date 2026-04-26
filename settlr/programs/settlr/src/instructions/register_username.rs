use anchor_lang::prelude::*;

use crate::constants::USERNAME_SEED;
use crate::error::InvoiceError;
use crate::state::Username;

#[derive(Accounts)]
#[instruction(name: String)]
pub struct RegisterUsernameAccountConstraints<'info> {
    #[account(
        init,
        payer = owner,
        space = Username::DISCRIMINATOR.len() + Username::INIT_SPACE,
        seeds = [USERNAME_SEED, name.as_bytes()],
        bump
    )]
    pub username: Account<'info, Username>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn register_username(
    ctx: Context<RegisterUsernameAccountConstraints>,
    name: String,
) -> Result<()> {
    require!(
        (3..=32).contains(&name.len()),
        InvoiceError::InvalidUsernameLength
    );
    require!(
        name.bytes()
            .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'_'),
        InvoiceError::InvalidUsernameChars
    );

    let u = &mut ctx.accounts.username;
    u.owner = ctx.accounts.owner.key();
    u.name = name;
    u.bump = ctx.bumps.username;

    Ok(())
}
