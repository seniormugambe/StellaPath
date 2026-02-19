//! Property-based tests for escrow fund locking
//! Feature: stellar-smart-contract-dapp, Property 5: Escrow Fund Locking
//! **Validates: Requirements 2.1**

use crate::{
    StellarDAppContract, StellarDAppContractClient, Condition, ConditionType, EscrowStatus,
};
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

/// Helper to build a conditions vector with a single manual-approval condition
fn _make_conditions(env: &Env) -> Vec<Condition> {
    let mut conditions: Vec<Condition> = Vec::new(env);
    conditions.push_back(Condition {
        condition_type: ConditionType::ManualApproval,
        parameters: SorobanString::from_str(env, "{}"),
        validator: Address::generate(env),
    });
    conditions
}

/// Property 5: Escrow Fund Locking
///
/// For any escrow creation with valid parameters, the Escrow_Service SHALL
/// lock the specified funds in a smart contract and prevent access until
/// conditions are met or timeout occurs.
///
/// This test runs 100 iterations with varied amounts, conditions, and
/// expiration times to verify the property holds across diverse inputs.
#[test]
fn property_escrow_fund_locking() {
    for iteration in 0..100u64 {
        let (env, _contract_id, client) = setup_test_env();

        let sender = Address::generate(&env);
        let recipient = Address::generate(&env);

        // Generate varied positive amounts
        let amount: i128 = 1 + (iteration as i128 * 50_000);

        // Vary the number of conditions (0 to 2)
        let mut conditions: Vec<Condition> = Vec::new(&env);
        let num_conditions = (iteration % 3) as usize;
        for _ in 0..num_conditions {
            conditions.push_back(Condition {
                condition_type: match iteration % 3 {
                    0 => ConditionType::TimeBased,
                    1 => ConditionType::OracleBased,
                    _ => ConditionType::ManualApproval,
                },
                parameters: SorobanString::from_str(&env, "{}"),
                validator: Address::generate(&env),
            });
        }

        // Expiration in the future (varied offsets)
        let expires_at = env.ledger().timestamp() + 1000 + (iteration * 100);

        // --- Create escrow ---
        let result = client.try_create_escrow(
            &sender,
            &recipient,
            &amount,
            &conditions,
            &expires_at,
        );

        // Property assertion 1: escrow creation succeeds for valid inputs
        assert!(
            result.is_ok(),
            "Iteration {}: Escrow creation should succeed for valid inputs (amount={})",
            iteration, amount
        );

        let escrow_result = result.unwrap().unwrap();

        // Property assertion 2: escrow ID is positive
        assert!(
            escrow_result.escrow_id > 0,
            "Iteration {}: Escrow ID should be positive",
            iteration
        );

        // Property assertion 3: initial status is Active (funds locked)
        assert_eq!(
            escrow_result.status,
            EscrowStatus::Active,
            "Iteration {}: Escrow status should be Active after creation",
            iteration
        );

        // Property assertion 4: stored escrow preserves all parameters
        let details = client
            .try_get_escrow_details(&escrow_result.escrow_id)
            .unwrap()
            .unwrap();

        assert_eq!(details.amount, amount, "Iteration {}: Amount should be preserved", iteration);
        assert_eq!(details.sender, sender, "Iteration {}: Sender should be preserved", iteration);
        assert_eq!(details.recipient, recipient, "Iteration {}: Recipient should be preserved", iteration);
        assert_eq!(details.expires_at, expires_at, "Iteration {}: Expiration should be preserved", iteration);
        assert_eq!(
            details.status,
            EscrowStatus::Active,
            "Iteration {}: Stored status should be Active",
            iteration
        );

        // Property assertion 5: funds are locked — refund is rejected while not expired
        // (timestamp is still before expires_at, so refund must fail)
        let refund_result = client.try_refund_escrow(&escrow_result.escrow_id);
        let refund_rejected = match &refund_result {
            Err(_) => true, // conversion error — call itself failed
            Ok(inner) => inner.is_err(), // ContractError returned
        };
        assert!(
            refund_rejected,
            "Iteration {}: Refund should be rejected while escrow is not expired",
            iteration
        );

        // Property assertion 6: each escrow gets a unique ID
        let second = client
            .try_create_escrow(&sender, &recipient, &amount, &conditions, &expires_at)
            .unwrap()
            .unwrap();
        assert_ne!(
            escrow_result.escrow_id, second.escrow_id,
            "Iteration {}: Escrow IDs should be unique",
            iteration
        );
    }
}
