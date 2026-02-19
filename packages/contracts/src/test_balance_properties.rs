//! Property-based tests for balance validation consistency
//! Feature: stellar-smart-contract-dapp, Property 2: Balance Validation Consistency
//! **Validates: Requirements 1.3, 2.5, 5.2**

use crate::{StellarDAppContract, StellarDAppContractClient, Condition};
use soroban_sdk::{testutils::Address as _, Address, Env, String as SorobanString, Vec};

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

/// Property 2: Balance Validation Consistency
///
/// For any transaction attempt where the sender provides an invalid amount
/// (zero, negative, or overflow), the system should reject the transaction
/// and return an appropriate error message, regardless of transaction type
/// (basic, escrow, P2P, invoice).
///
/// This test runs 100 iterations with varied invalid amounts to verify
/// the property holds across all transaction types.
#[test]
fn property_balance_validation_consistency() {
    for iteration in 0..100u64 {
        let (env, _contract_id, client) = setup_test_env();

        let sender = Address::generate(&env);
        let recipient = Address::generate(&env);
        let metadata = SorobanString::from_str(&env, "test");

        // Generate invalid amounts: zero, negative, and overflow values
        let invalid_amount: i128 = match iteration % 3 {
            0 => 0,                                          // zero
            1 => -1 - (iteration as i128),                   // negative
            _ => (i128::MAX / 2) + 1 + (iteration as i128), // overflow
        };

        // --- Basic transaction should reject invalid amount ---
        let basic_result = client.try_execute_transaction(
            &sender,
            &recipient,
            &invalid_amount,
            &metadata,
        );
        assert!(
            basic_result.is_err() || basic_result.unwrap().is_err(),
            "Iteration {}: Basic transaction should reject invalid amount {}",
            iteration, invalid_amount
        );

        // --- P2P transaction should reject invalid amount ---
        let p2p_result = client.try_execute_p2p_transaction(
            &sender,
            &recipient,
            &invalid_amount,
            &metadata,
        );
        assert!(
            p2p_result.is_err() || p2p_result.unwrap().is_err(),
            "Iteration {}: P2P transaction should reject invalid amount {}",
            iteration, invalid_amount
        );

        // --- Escrow creation should reject invalid amount ---
        let conditions: Vec<Condition> = Vec::new(&env);
        let expires_at = env.ledger().timestamp() + 10000;
        let escrow_result = client.try_create_escrow(
            &sender,
            &recipient,
            &invalid_amount,
            &conditions,
            &expires_at,
        );
        assert!(
            escrow_result.is_err() || escrow_result.unwrap().is_err(),
            "Iteration {}: Escrow creation should reject invalid amount {}",
            iteration, invalid_amount
        );

        // --- Invoice creation should reject invalid amount ---
        let description = SorobanString::from_str(&env, "invoice");
        let due_date = env.ledger().timestamp() + 10000;
        let invoice_result = client.try_create_invoice(
            &sender,
            &recipient,
            &invalid_amount,
            &description,
            &due_date,
        );
        assert!(
            invoice_result.is_err() || invoice_result.unwrap().is_err(),
            "Iteration {}: Invoice creation should reject invalid amount {}",
            iteration, invalid_amount
        );
    }
}
