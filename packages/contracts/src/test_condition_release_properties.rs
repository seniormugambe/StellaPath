//! Property-based tests for condition-based escrow release
//! Feature: stellar-smart-contract-dapp, Property 6: Condition-Based Release
//! **Validates: Requirements 2.2**

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

/// Property 6: Condition-Based Release
///
/// For any escrow where all conditions are verified as met, the Escrow_Service
/// SHALL automatically release funds to the recipient without requiring
/// additional user intervention.
///
/// This test runs 100 iterations with varied amounts, condition counts, and
/// condition types to verify the property holds across diverse inputs.
#[test]
fn property_condition_based_release() {
    for iteration in 0..100u64 {
        let (env, _contract_id, client) = setup_test_env();

        let sender = Address::generate(&env);
        let recipient = Address::generate(&env);

        // Generate varied positive amounts
        let amount: i128 = 100 + (iteration as i128 * 7_777);

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

        // Expiration well in the future
        let expires_at = env.ledger().timestamp() + 5000 + (iteration * 200);

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

        // --- Step 2: Verify conditions are met ---
        let conditions_met = client
            .try_check_escrow_conditions(&escrow_id)
            .unwrap()
            .unwrap();
        assert!(
            conditions_met,
            "Iteration {}: All conditions should be reported as met",
            iteration
        );

        // --- Step 3: Release escrow (automatic release when conditions met) ---
        let release_result = client.try_release_escrow(&escrow_id);
        assert!(
            release_result.is_ok(),
            "Iteration {}: release_escrow call should not panic",
            iteration
        );
        let release = release_result.unwrap().unwrap();

        // Property assertion: status transitions to Released
        assert_eq!(
            release.status,
            EscrowStatus::Released,
            "Iteration {}: Escrow should be Released when conditions are met",
            iteration
        );

        // Property assertion: a transaction hash is produced
        assert!(
            release.tx_hash.is_some(),
            "Iteration {}: Release should produce a transaction hash",
            iteration
        );

        // --- Step 4: Verify persisted state reflects release ---
        let details = client
            .try_get_escrow_details(&escrow_id)
            .unwrap()
            .unwrap();
        assert_eq!(
            details.status,
            EscrowStatus::Released,
            "Iteration {}: Stored escrow status should be Released",
            iteration
        );
        assert_eq!(
            details.amount, amount,
            "Iteration {}: Amount should be preserved after release",
            iteration
        );
        assert_eq!(
            details.recipient, recipient,
            "Iteration {}: Recipient should be preserved after release",
            iteration
        );

        // --- Step 5: Released escrow cannot be released again ---
        let double_release = client.try_release_escrow(&escrow_id);
        let rejected = match &double_release {
            Err(_) => true,
            Ok(inner) => inner.is_err(),
        };
        assert!(
            rejected,
            "Iteration {}: Releasing an already-released escrow should fail",
            iteration
        );

        // --- Step 6: Released escrow cannot be refunded ---
        let refund_attempt = client.try_refund_escrow(&escrow_id);
        let refund_rejected = match &refund_attempt {
            Err(_) => true,
            Ok(inner) => inner.is_err(),
        };
        assert!(
            refund_rejected,
            "Iteration {}: Refunding a released escrow should fail",
            iteration
        );
    }
}

/// Supplementary test: process_escrow automatically releases when conditions are met
///
/// Validates that the automatic processing path (process_escrow) also triggers
/// release without additional user intervention when conditions are satisfied.
#[test]
fn property_condition_based_release_via_process() {
    for iteration in 0..100u64 {
        let (env, _contract_id, client) = setup_test_env();

        let sender = Address::generate(&env);
        let recipient = Address::generate(&env);

        let amount: i128 = 500 + (iteration as i128 * 3_333);

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

        let expires_at = env.ledger().timestamp() + 10_000 + (iteration * 50);

        // Create escrow
        let escrow_id = client
            .try_create_escrow(&sender, &recipient, &amount, &conditions, &expires_at)
            .unwrap()
            .unwrap()
            .escrow_id;

        // Use process_escrow — should auto-release since conditions are met
        let process_result = client.try_process_escrow(&escrow_id);
        assert!(
            process_result.is_ok(),
            "Iteration {}: process_escrow should not panic",
            iteration
        );
        let result = process_result.unwrap().unwrap();

        assert_eq!(
            result.status,
            EscrowStatus::Released,
            "Iteration {}: process_escrow should auto-release when conditions are met",
            iteration
        );
        assert!(
            result.tx_hash.is_some(),
            "Iteration {}: Auto-release should produce a transaction hash",
            iteration
        );

        // Confirm stored state
        let details = client
            .try_get_escrow_details(&escrow_id)
            .unwrap()
            .unwrap();
        assert_eq!(
            details.status,
            EscrowStatus::Released,
            "Iteration {}: Stored status should be Released after process_escrow",
            iteration
        );
    }
}
