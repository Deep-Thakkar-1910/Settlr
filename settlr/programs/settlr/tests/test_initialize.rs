use anchor_lang::{
    solana_program::instruction::Instruction, AccountDeserialize, InstructionData, ToAccountMetas,
};
use litesvm::LiteSVM;
use solana_keypair::Keypair;
use solana_message::{Message, VersionedMessage};
use solana_pubkey::Pubkey;
use solana_signer::Signer;
use solana_transaction::versioned::VersionedTransaction;
use std::time::{SystemTime, UNIX_EPOCH};

fn setup_svm() -> (LiteSVM, Pubkey) {
    let program_id = settlr::id();
    let mut svm = LiteSVM::new();
    let bytes = include_bytes!("../../../target/deploy/settlr.so");
    svm.add_program(program_id, bytes).unwrap();
    (svm, program_id)
}

fn unix_now_plus_days(days: u64) -> i64 {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();
    (now + days * 86_400) as i64
}

fn derive_invoice_pda(freelancer: &Pubkey, invoice_id: u64, program_id: &Pubkey) -> Pubkey {
    let (pda, _bump) = Pubkey::find_program_address(
        &[
            b"invoice",
            freelancer.as_ref(),
            &invoice_id.to_le_bytes(),
        ],
        program_id,
    );
    pda
}

fn create_invoice_instruction(
    program_id: Pubkey,
    invoice_pda: Pubkey,
    freelancer: &Keypair,
    client: Pubkey,
    invoice_id: u64,
    amount: u64,
    description: &str,
    deadline: i64,
) -> Instruction {
    Instruction::new_with_bytes(
        program_id,
        &settlr::instruction::CreateInvoice {
            invoice_id,
            amount,
            description: description.to_string(),
            deadline,
            client,
        }
        .data(),
        settlr::accounts::CreateInvoiceAccountConstraints {
            invoice: invoice_pda,
            freelancer: freelancer.pubkey(),
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
fn test_create_invoice_succeeds() {
    let (mut svm, program_id) = setup_svm();
    let freelancer = Keypair::new();
    let client = Keypair::new();

    svm.airdrop(&freelancer.pubkey(), 1_000_000_000).unwrap();

    let invoice_id: u64 = 0;
    let invoice_pda = derive_invoice_pda(&freelancer.pubkey(), invoice_id, &program_id);

    let instruction = create_invoice_instruction(
        program_id,
        invoice_pda,
        &freelancer,
        client.pubkey(),
        invoice_id,
        10_000_000, // 10 USDC
        "Website design",
        unix_now_plus_days(7),
    );

    let result = send_single_ix(&mut svm, instruction, &freelancer, &[&freelancer]);
    assert!(result.is_ok(), "create_invoice failed: {:?}", result.err());

    let account_data = svm.get_account(&invoice_pda).unwrap();
    let invoice =
        settlr::Invoice::try_deserialize(&mut account_data.data.as_slice()).unwrap();

    assert_eq!(invoice.amount, 10_000_000);
    assert_eq!(invoice.client, client.pubkey());
    assert_eq!(invoice.freelancer, freelancer.pubkey());
    assert_eq!(invoice.status, settlr::InvoiceStatus::Pending);
    assert_eq!(invoice.description, "Website design");
}

#[test]
fn test_pay_invoice_succeeds() {
    let (mut svm, program_id) = setup_svm();
    let freelancer = Keypair::new();
    let client = Keypair::new();

    svm.airdrop(&freelancer.pubkey(), 1_000_000_000).unwrap();
    svm.airdrop(&client.pubkey(), 1_000_000_000).unwrap();

    let invoice_id: u64 = 0;
    let invoice_pda = derive_invoice_pda(&freelancer.pubkey(), invoice_id, &program_id);

    let create_ix = create_invoice_instruction(
        program_id,
        invoice_pda,
        &freelancer,
        client.pubkey(),
        invoice_id,
        5_000_000,
        "Logo design",
        unix_now_plus_days(14),
    );
    send_single_ix(&mut svm, create_ix, &freelancer, &[&freelancer]).unwrap();

    let pay_ix = Instruction::new_with_bytes(
        program_id,
        &settlr::instruction::PayInvoice {}.data(),
        settlr::accounts::PayInvoiceAccountConstraints {
            invoice: invoice_pda,
            client: client.pubkey(),
        }
        .to_account_metas(None),
    );
    let result = send_single_ix(&mut svm, pay_ix, &client, &[&client]);
    assert!(result.is_ok(), "pay_invoice failed: {:?}", result.err());

    let account_data = svm.get_account(&invoice_pda).unwrap();
    let invoice =
        settlr::Invoice::try_deserialize(&mut account_data.data.as_slice()).unwrap();

    assert_eq!(invoice.status, settlr::InvoiceStatus::Paid);
}

#[test]
fn test_pay_invoice_wrong_client_fails() {
    let (mut svm, program_id) = setup_svm();
    let freelancer = Keypair::new();
    let client = Keypair::new();
    let attacker = Keypair::new();

    svm.airdrop(&freelancer.pubkey(), 1_000_000_000).unwrap();
    svm.airdrop(&attacker.pubkey(), 1_000_000_000).unwrap();

    let invoice_id: u64 = 0;
    let invoice_pda = derive_invoice_pda(&freelancer.pubkey(), invoice_id, &program_id);

    let create_ix = create_invoice_instruction(
        program_id,
        invoice_pda,
        &freelancer,
        client.pubkey(),
        invoice_id,
        1_000_000,
        "SEO audit",
        unix_now_plus_days(3),
    );
    send_single_ix(&mut svm, create_ix, &freelancer, &[&freelancer]).unwrap();

    let pay_ix = Instruction::new_with_bytes(
        program_id,
        &settlr::instruction::PayInvoice {}.data(),
        settlr::accounts::PayInvoiceAccountConstraints {
            invoice: invoice_pda,
            client: attacker.pubkey(),
        }
        .to_account_metas(None),
    );
    let result = send_single_ix(&mut svm, pay_ix, &attacker, &[&attacker]);
    assert!(result.is_err(), "expected unauthorized error but got success");
}

#[test]
fn test_pay_invoice_twice_fails() {
    let (mut svm, program_id) = setup_svm();
    let freelancer = Keypair::new();
    let client = Keypair::new();

    svm.airdrop(&freelancer.pubkey(), 1_000_000_000).unwrap();
    svm.airdrop(&client.pubkey(), 1_000_000_000).unwrap();

    let invoice_id: u64 = 0;
    let invoice_pda = derive_invoice_pda(&freelancer.pubkey(), invoice_id, &program_id);

    let create_ix = create_invoice_instruction(
        program_id,
        invoice_pda,
        &freelancer,
        client.pubkey(),
        invoice_id,
        2_000_000,
        "Copy writing",
        unix_now_plus_days(5),
    );
    send_single_ix(&mut svm, create_ix, &freelancer, &[&freelancer]).unwrap();

    let make_pay_ix = || {
        Instruction::new_with_bytes(
            program_id,
            &settlr::instruction::PayInvoice {}.data(),
            settlr::accounts::PayInvoiceAccountConstraints {
                invoice: invoice_pda,
                client: client.pubkey(),
            }
            .to_account_metas(None),
        )
    };

    send_single_ix(&mut svm, make_pay_ix(), &client, &[&client]).unwrap();

    let second_pay = send_single_ix(&mut svm, make_pay_ix(), &client, &[&client]);
    assert!(second_pay.is_err(), "expected AlreadyPaid error");
}
