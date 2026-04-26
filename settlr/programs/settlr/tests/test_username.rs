use anchor_lang::{
    solana_program::instruction::Instruction, AccountDeserialize, InstructionData, ToAccountMetas,
};
use litesvm::LiteSVM;
use solana_keypair::Keypair;
use solana_message::{Message, VersionedMessage};
use solana_pubkey::Pubkey;
use solana_signer::Signer;
use solana_transaction::versioned::VersionedTransaction;

fn setup_svm() -> (LiteSVM, Pubkey) {
    let program_id = settlr::id();
    let mut svm = LiteSVM::new();
    let bytes = include_bytes!("../../../target/deploy/settlr.so");
    svm.add_program(program_id, bytes).unwrap();
    (svm, program_id)
}

fn derive_username_pda(name: &str, program_id: &Pubkey) -> Pubkey {
    let (pda, _bump) = Pubkey::find_program_address(
        &[b"username", name.as_bytes()],
        program_id,
    );
    pda
}

fn register_username_instruction(
    program_id: Pubkey,
    username_pda: Pubkey,
    owner: &Keypair,
    name: &str,
) -> Instruction {
    Instruction::new_with_bytes(
        program_id,
        &settlr::instruction::RegisterUsername {
            name: name.to_string(),
        }
        .data(),
        settlr::accounts::RegisterUsernameAccountConstraints {
            username: username_pda,
            owner: owner.pubkey(),
            system_program: anchor_lang::solana_program::system_program::id(),
        }
        .to_account_metas(None),
    )
}

fn send_single_ix(
    svm: &mut LiteSVM,
    instruction: Instruction,
    payer: &Keypair,
    signers: &[&Keypair],
) -> litesvm::types::TransactionResult {
    let blockhash = svm.latest_blockhash();
    let msg =
        Message::new_with_blockhash(&[instruction], Some(&payer.pubkey()), &blockhash);
    let tx =
        VersionedTransaction::try_new(VersionedMessage::Legacy(msg), signers).unwrap();
    svm.send_transaction(tx)
}

#[test]
fn test_register_username_succeeds() {
    let (mut svm, program_id) = setup_svm();
    let owner = Keypair::new();
    svm.airdrop(&owner.pubkey(), 1_000_000_000).unwrap();

    let name = "alice";
    let pda = derive_username_pda(name, &program_id);
    let ix = register_username_instruction(program_id, pda, &owner, name);

    let result = send_single_ix(&mut svm, ix, &owner, &[&owner]);
    assert!(
        result.is_ok(),
        "register_username failed: {:?}",
        result.err()
    );

    let account_data = svm.get_account(&pda).unwrap();
    let username =
        settlr::Username::try_deserialize(&mut account_data.data.as_slice()).unwrap();

    assert_eq!(username.owner, owner.pubkey());
    assert_eq!(username.name, name);
}

#[test]
fn test_register_username_duplicate_fails() {
    let (mut svm, program_id) = setup_svm();
    let first = Keypair::new();
    let second = Keypair::new();
    svm.airdrop(&first.pubkey(), 1_000_000_000).unwrap();
    svm.airdrop(&second.pubkey(), 1_000_000_000).unwrap();

    let name = "alice";
    let pda = derive_username_pda(name, &program_id);

    let ix1 = register_username_instruction(program_id, pda, &first, name);
    send_single_ix(&mut svm, ix1, &first, &[&first]).unwrap();

    let ix2 = register_username_instruction(program_id, pda, &second, name);
    let result = send_single_ix(&mut svm, ix2, &second, &[&second]);
    assert!(
        result.is_err(),
        "expected duplicate registration to fail but it succeeded"
    );
}

#[test]
fn test_register_username_too_short_fails() {
    let (mut svm, program_id) = setup_svm();
    let owner = Keypair::new();
    svm.airdrop(&owner.pubkey(), 1_000_000_000).unwrap();

    let name = "al";
    let pda = derive_username_pda(name, &program_id);
    let ix = register_username_instruction(program_id, pda, &owner, name);

    let result = send_single_ix(&mut svm, ix, &owner, &[&owner]);
    assert!(result.is_err(), "expected InvalidUsernameLength for 2-char name");
}

// A 33-char name is rejected by Solana itself (PDA seeds are capped at 32 bytes),
// so `find_program_address` panics in the test client before we can submit the tx.
// This documents the boundary; the on-chain `InvalidUsernameLength` upper bound is
// effectively defense-in-depth — the seeds constraint fails first at runtime too.
#[test]
#[should_panic(expected = "Unable to find a viable program address bump seed")]
fn test_register_username_too_long_panics_on_pda_derivation() {
    let (_svm, program_id) = setup_svm();
    let name = "a".repeat(33);
    let _pda = derive_username_pda(&name, &program_id);
}

#[test]
fn test_register_username_uppercase_fails() {
    let (mut svm, program_id) = setup_svm();
    let owner = Keypair::new();
    svm.airdrop(&owner.pubkey(), 1_000_000_000).unwrap();

    let name = "Alice";
    let pda = derive_username_pda(name, &program_id);
    let ix = register_username_instruction(program_id, pda, &owner, name);

    let result = send_single_ix(&mut svm, ix, &owner, &[&owner]);
    assert!(
        result.is_err(),
        "expected InvalidUsernameChars for uppercase name"
    );
}

#[test]
fn test_register_username_hyphen_fails() {
    let (mut svm, program_id) = setup_svm();
    let owner = Keypair::new();
    svm.airdrop(&owner.pubkey(), 1_000_000_000).unwrap();

    let name = "ali-ce";
    let pda = derive_username_pda(name, &program_id);
    let ix = register_username_instruction(program_id, pda, &owner, name);

    let result = send_single_ix(&mut svm, ix, &owner, &[&owner]);
    assert!(
        result.is_err(),
        "expected InvalidUsernameChars for hyphenated name"
    );
}

#[test]
fn test_register_username_at_symbol_fails() {
    let (mut svm, program_id) = setup_svm();
    let owner = Keypair::new();
    svm.airdrop(&owner.pubkey(), 1_000_000_000).unwrap();

    let name = "@alice";
    let pda = derive_username_pda(name, &program_id);
    let ix = register_username_instruction(program_id, pda, &owner, name);

    let result = send_single_ix(&mut svm, ix, &owner, &[&owner]);
    assert!(
        result.is_err(),
        "expected InvalidUsernameChars for @-prefixed name"
    );
}

#[test]
fn test_register_username_max_length_succeeds() {
    let (mut svm, program_id) = setup_svm();
    let owner = Keypair::new();
    svm.airdrop(&owner.pubkey(), 1_000_000_000).unwrap();

    // 32 chars — the upper edge of what's allowed (Solana seed cap).
    let name = "a".repeat(32);
    assert_eq!(name.len(), 32);
    let pda = derive_username_pda(&name, &program_id);
    let ix = register_username_instruction(program_id, pda, &owner, &name);

    let result = send_single_ix(&mut svm, ix, &owner, &[&owner]);
    assert!(
        result.is_ok(),
        "register_username failed for 32-char name: {:?}",
        result.err()
    );

    let account_data = svm.get_account(&pda).unwrap();
    let username =
        settlr::Username::try_deserialize(&mut account_data.data.as_slice()).unwrap();
    assert_eq!(username.name, name);
}

#[test]
fn test_register_username_min_length_succeeds() {
    let (mut svm, program_id) = setup_svm();
    let owner = Keypair::new();
    svm.airdrop(&owner.pubkey(), 1_000_000_000).unwrap();

    // 3 chars — the lower edge of what's allowed.
    let name = "abc";
    let pda = derive_username_pda(name, &program_id);
    let ix = register_username_instruction(program_id, pda, &owner, name);

    let result = send_single_ix(&mut svm, ix, &owner, &[&owner]);
    assert!(
        result.is_ok(),
        "register_username failed for 3-char name: {:?}",
        result.err()
    );
}

#[test]
fn test_register_username_with_digits_and_underscore_succeeds() {
    let (mut svm, program_id) = setup_svm();
    let owner = Keypair::new();
    svm.airdrop(&owner.pubkey(), 1_000_000_000).unwrap();

    let name = "alice_99";
    let pda = derive_username_pda(name, &program_id);
    let ix = register_username_instruction(program_id, pda, &owner, name);

    let result = send_single_ix(&mut svm, ix, &owner, &[&owner]);
    assert!(
        result.is_ok(),
        "register_username failed for valid name: {:?}",
        result.err()
    );

    let account_data = svm.get_account(&pda).unwrap();
    let username =
        settlr::Username::try_deserialize(&mut account_data.data.as_slice()).unwrap();
    assert_eq!(username.name, name);
    assert_eq!(username.owner, owner.pubkey());
}
