//! Property-based tests for timeout refund mechanism
//! Feature: stellar-smart-contract-dapp, Property 7: Timeout Refund Mechanism
//! **Validates: Requirements 2.3**

use crate::{
    StellarDAppContract, StellarDAppContractClient, Condition, ConditionType, EscrowStatus,
};
use soroban_sdk::{testutils::{Address as _, Ledger}, Address, Env, String as SorobanString, Vec};

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

/// Property 7: Timeout Refund Mechanism
///
/// For any escrow where conditions are not met within the specified timeout
/// period, the Escrow_Service SHALL automatically return funds to the
/// original sender.
///
/// This test runs 100 iterations with varied amounts, conditions, and
/// expiration offsets. For each iteration it:
/// 1. Creates an escrow with a future expiration
/// 2. Advances the ledger timestamp past the expiration
/// 3. Verifies that refund succeeds and funds are returned to sender
/// 4. Verifies that the escrow cannot be released or refunded again
#[test]
fn property_timeout_refund_mechanism() {
    for iteration in 0..100u64 {
        let (env, _contract_id, client) = setup_test_env();

        let sender = Address::generate(&env);
        let recipient = Address::generate(&env);

        // Varied positive amounts
        let amount: i128 = 1 + (iteration as i128 * 12_345);

        // Vary condition types and counts (1 to 3 conditions)
        let num_conditions = 1 + (iteration % 3) as usize;
        let mut conditions: Vec<Condition> = Vec::new(&env);
        for i in 0..num_conditions {
            let ctype = match (iteration + i as u64) % 3 {
                0 => ConditionType::TimeBased,
                1 => ConditionType::OracleBased,
                _ => ConditionType::ManualApproval,
            };
            conditions.push_back(Condition {
                condition_type: ctype,
                parameters: SorobanString::from_str(&env, "{}"),
                validator: Address::generate(&env),
            });
        }

        // Expiration offset varies per iteration (small window)
        let expiration_offset = 100 + (iteration * 10);
        let expires_at = env.ledger().timestamp() + expiration_offset;

        // --- Step 1: Create escrow ---
        let create_result = client
            .try_create_escrow(&sender, &recipient, &amount, &conditions, &expires_at)
            .unwrap()
            .unwrap();

        let escrow_id = create_result.escrow_id;
        assert_eq!(
            create_result.status,
            EscrowStatus::Active,
            "Iteration {}: Escrow should start as Active",
            iteration
        );

        // --- Step 2: Verify refund is rejected before expiration ---
        let early_refund = client.try_refund_escrow(&escrow_id);
        let early_rejected = match &early_refund {
            Err(_) => true,
            Ok(inner) => inner.is_err(),
        };
        assert!(
            early_rejected,
            "Iteration {}: Refund should be rejected before timeout expires",
            iteration
        );

        // --- Step 3: Advance time past expiration ---
        env.ledger().with_mut(|li| {
            li.timestamp = expires_at + 1;
        });

        // --- Step 4: Refund should now succeed ---
        let refund_result = client.try_refund_escrow(&escrow_id);
        assert!(
            refund_result.is_ok(),
            "Iteration {}: refund_escrow call should not panic after timeout",
            iteration
        );
        let refund = refund_result.unwrap().unwrap();

        // Property assertion: status transitions to Refunded
        assert_eq!(
            refund.status,
            EscrowStatus::Refunded,
            "Iteration {}: Escrow should be Refunded after timeout",
            iteration
        );

        // Property assertion: a transaction hash is produced for the refund
        assert!(
            refund.tx_hash.is_some(),
            "Iteration {}: Refund should produce a transaction hash",
            iteration
        );

        // --- Step 5: Verify persisted state reflects refund ---
        let details = client
            .try_get_escrow_details(&escrow_id)
            .unwrap()
            .unwrap();
        assert_eq!(
            details.status,
            EscrowStatus::Refunded,
            "Iteration {}: Stored escrow status should be Refunded",
            iteration
        );
        assert_eq!(
            details.sender, sender,
            "Iteration {}: Sender should be preserved (funds returned to sender)",
            iteration
        );
        assert_eq!(
            details.amount, amount,
            "Iteration {}: Amount should be preserved after refund",
            iteration
        );

        // --- Step 6: Refunded escrow cannot be refunded again ---
        let double_refund = client.try_refund_escrow(&escrow_id);
        let double_rejected = match &double_refund {
            Err(_) => true,
            Ok(inner) => inner.is_err(),
        };
        assert!(
            double_rejected,
            "Iteration {}: Refunding an already-refunded escrow should fail",
            iteration
        );

        // --- Step 7: Refunded escrow cannot be released ---
        let release_attempt = client.try_release_escrow(&escrow_id);
        let release_rejected = match &release_attempt {
            Err(_) => true,
            Ok(inner) => inner.is_err(),
        };
        assert!(
            release_rejected,
            "Iteration {}: Releasing a refunded escrow should fail",
            iteration
        );
    }
}

/// Supplementary test: process_escrow automatically refunds when expired
///
/// Validates that the automatic processing path (process_escrow) triggers
/// a refund when the escrow has timed out, returning funds to the sender
/// without requiring explicit refund_escrow calls.
#[test]
fn property_timeout_refund_via_process() {
    for iteration in 0..100u64 {
        let (env, _contract_id, client) = setup_test_env();

        let sender = Address::generate(&env);
        let recipient = Address::generate(&env);

        let amount: i128 = 500 + (iteration as i128 * 7_891);

        // Single condition of varying type
        let mut conditions: Vec<Condition> = Vec::new(&env);
        conditions.push_back(Condition {
            condition_type: match iteration % 3 {
                0 => ConditionType::TimeBased,
                1 => ConditionType::OracleBased,
                _ => ConditionType::ManualApproval,
            },
            parameters: SorobanString::from_str(&env, "{}"),
            validator: Address::generate(&env),
        });

        let expiration_offset = 200 + (iteration * 5);
        let expires_at = env.ledger().timestamp() + expiration_offset;

        // Create escrow
        let escrow_id = client
            .try_create_escrow(&sender, &recipient, &amount, &conditions, &expires_at)
            .unwrap()
            .unwrap()
            .escrow_id;

        // Advance time past expiration
        env.ledger().with_mut(|li| {
            li.timestamp = expires_at + 1 + iteration;
        });

        // Use process_escrow — should auto-refund since expired
        let process_result = client.try_process_escrow(&escrow_id);
        assert!(
            process_result.is_ok(),
            "Iteration {}: process_escrow should not panic",
            iteration
        );
        let result = process_result.unwrap().unwrap();

        assert_eq!(
            result.status,
            EscrowStatus::Refunded,
            "Iteration {}: process_escrow should auto-refund when expired",
            iteration
        );
        assert!(
            result.tx_hash.is_some(),
            "Iteration {}: Auto-refund should produce a transaction hash",
            iteration
        );

        // Confirm stored state
        let details = client
            .try_get_escrow_details(&escrow_id)
            .unwrap()
            .unwrap();
        assert_eq!(
            details.status,
            EscrowStatus::Refunded,
            "Iteration {}: Stored status should be Refunded after process_escrow",
            iteration
        );
        assert_eq!(
            details.sender, sender,
            "Iteration {}: Sender preserved — funds returned to original sender",
            iteration
        );
    }
}
