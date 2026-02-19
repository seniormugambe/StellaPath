//! Property-based tests for transaction validation
//! Feature: stellar-smart-contract-dapp, Property 1: Transaction Creation Completeness
//! **Validates: Requirements 1.1, 1.2**

use crate::{StellarDAppContract, StellarDAppContractClient, TransactionStatus, TransactionType};
use soroban_sdk::{testutils::Address as _, Address, Env, String as SorobanString};

/// Helper function to create a test environment with initialized contract
fn setup_test_env() -> (Env, Address, StellarDAppContractClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(StellarDAppContract, ());
    let client = StellarDAppContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let _ = client.try_initialize(&admin);

    (env, contract_id, client)
}

/// Property 1: Transaction Creation Completeness
///
/// For any valid transaction request with sufficient funds and valid addresses,
/// the Transaction_System should create a transaction and return a valid
/// transaction hash for tracking.
///
/// This test runs 100 iterations with varied amounts and metadata to verify
/// the property holds across diverse inputs.
#[test]
fn property_transaction_creation_completeness() {
    for iteration in 0..100u64 {
        let (env, _contract_id, client) = setup_test_env();

        let sender = Address::generate(&env);
        let recipient = Address::generate(&env);

        // Generate varied positive amounts across a wide range
        let amount: i128 = 1 + (iteration as i128 * 99_999);
        let metadata = SorobanString::from_str(&env, "tx metadata");

        // Execute transaction
        let result = client.try_execute_transaction(
            &sender,
            &recipient,
            &amount,
            &metadata,
        );

        // Property assertion 1: transaction creation succeeds for valid inputs
        assert!(
            result.is_ok(),
            "Iteration {}: Transaction creation should succeed for valid inputs (amount={})",
            iteration, amount
        );

        let tx_result = result.unwrap().unwrap();

        // Property assertion 2: a valid transaction ID is returned
        assert!(
            tx_result.transaction_id > 0,
            "Iteration {}: Transaction ID should be positive",
            iteration
        );

        // Property assertion 3: transaction status is Confirmed
        assert_eq!(
            tx_result.status,
            TransactionStatus::Confirmed,
            "Iteration {}: Transaction status should be Confirmed",
            iteration
        );

        // Property assertion 4: a transaction hash is returned for tracking (Req 1.2)
        let hash_len = tx_result.tx_hash.len();
        assert!(
            hash_len > 0,
            "Iteration {}: Transaction hash should be non-empty",
            iteration
        );

        // Property assertion 5: the stored transaction matches the request
        let stored_tx = client.try_get_transaction(&tx_result.transaction_id);
        assert!(
            stored_tx.is_ok(),
            "Iteration {}: Stored transaction should be retrievable",
            iteration
        );

        let tx = stored_tx.unwrap().unwrap();
        assert_eq!(tx.amount, amount, "Iteration {}: Amount should be preserved", iteration);
        assert_eq!(tx.sender, sender, "Iteration {}: Sender should be preserved", iteration);
        assert_eq!(tx.recipient, recipient, "Iteration {}: Recipient should be preserved", iteration);
        assert_eq!(
            tx.transaction_type,
            TransactionType::Basic,
            "Iteration {}: Transaction type should be Basic",
            iteration
        );
        assert_eq!(
            tx.status,
            TransactionStatus::Confirmed,
            "Iteration {}: Stored status should be Confirmed",
            iteration
        );

        // Property assertion 6: each transaction gets a unique ID
        // Create a second transaction in the same env to verify uniqueness
        let second_result = client.try_execute_transaction(
            &sender,
            &recipient,
            &amount,
            &metadata,
        );
        assert!(second_result.is_ok(), "Iteration {}: Second transaction should also succeed", iteration);
        let second_tx = second_result.unwrap().unwrap();
        assert_ne!(
            tx_result.transaction_id, second_tx.transaction_id,
            "Iteration {}: Transaction IDs should be unique",
            iteration
        );
    }
}
