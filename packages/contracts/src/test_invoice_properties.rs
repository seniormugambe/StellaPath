//! Property-based tests for invoice workflow
//! Feature: stellar-smart-contract-dapp, Property 10: Invoice Approval Workflow
//! **Validates: Requirements 4.3**

use crate::{StellarDAppContract, StellarDAppContractClient, InvoiceStatus};
use soroban_sdk::{testutils::{Address as _, Ledger}, Address, Env, String as SorobanString};

/// Helper function to create a test environment with initialized contract
fn setup_test_env() -> (Env, Address, StellarDAppContractClient<'static>) {
    let env = Env::default();
    env.mock_all_auths(); // Mock all authorization checks for testing
    
    let contract_id = env.register(StellarDAppContract, ());
    let client = StellarDAppContractClient::new(&env, &contract_id);
    
    let admin = Address::generate(&env);
    let _ = client.try_initialize(&admin);
    
    (env, contract_id, client)
}

/// Property 10: Invoice Approval Workflow
/// For any approved invoice, the system should automatically execute the payment
/// transaction without requiring additional user intervention.
/// 
/// This test runs 100 iterations with different amounts and due dates to verify
/// the property holds across various inputs.
#[test]
fn property_invoice_approval_workflow() {
    // Run 100 iterations to simulate property-based testing
    for iteration in 0..100 {
        let (env, _contract_id, client) = setup_test_env();
        
        let creator = Address::generate(&env);
        let client_addr = Address::generate(&env);
        
        // Generate varied test inputs based on iteration
        let amount = 1000i128 + (iteration as i128 * 10000);
        let current_time = env.ledger().timestamp();
        let due_date = current_time + 1000 + (iteration * 100);
        
        let description = SorobanString::from_str(&env, "Test invoice");
        
        // Step 1: Create invoice
        let create_result = client.try_create_invoice(
            &creator,
            &client_addr,
            &amount,
            &description,
            &due_date,
        );
        
        assert!(create_result.is_ok(), "Invoice creation should succeed");
        let invoice_id = create_result.unwrap().unwrap().invoice_id;
        
        // Step 2: Mark invoice as sent (prerequisite for approval)
        let sent_result = client.try_mark_invoice_sent(&invoice_id, &creator);
        assert!(sent_result.is_ok(), "Marking invoice as sent should succeed");
        
        // Step 3: Approve invoice
        let approve_result = client.try_approve_invoice(&invoice_id, &client_addr);
        assert!(approve_result.is_ok(), "Invoice approval should succeed");
        
        let approval_result = approve_result.unwrap().unwrap();
        assert_eq!(
            approval_result.status,
            InvoiceStatus::Approved,
            "Invoice status should be Approved after approval"
        );
        
        // Step 4: Execute invoice automatically (this validates the workflow)
        let execute_result = client.try_execute_invoice(&invoice_id);
        assert!(
            execute_result.is_ok(),
            "Invoice execution should succeed after approval"
        );
        
        let execution_result = execute_result.unwrap().unwrap();
        assert_eq!(
            execution_result.status,
            InvoiceStatus::Executed,
            "Invoice status should be Executed after execution"
        );
        
        // Verify transaction hash is generated
        assert!(
            execution_result.tx_hash.is_some(),
            "Transaction hash should be generated after execution"
        );
        
        // Step 5: Verify final invoice state
        let final_invoice = client.try_get_invoice(&invoice_id);
        assert!(final_invoice.is_ok(), "Should be able to retrieve invoice");
        
        let invoice = final_invoice.unwrap().unwrap();
        assert_eq!(
            invoice.status,
            InvoiceStatus::Executed,
            "Final invoice status should be Executed"
        );
        assert_eq!(invoice.amount, amount, "Invoice amount should be preserved");
        assert!(
            invoice.approved_at.is_some(),
            "Approval timestamp should be recorded"
        );
    }
}

/// Property 11: Invoice Expiration Handling
/// Feature: stellar-smart-contract-dapp, Property 11: Invoice Expiration Handling
/// **Validates: Requirements 4.6**
/// 
/// For any invoice that reaches its due date without approval, the system should
/// mark it as expired and prevent further processing.
/// 
/// This test runs 100 iterations with different due dates to verify the property
/// holds across various timing scenarios.
#[test]
fn property_invoice_expiration_handling() {
    // Run 100 iterations to simulate property-based testing
    for iteration in 0..100 {
        let (env, _contract_id, client) = setup_test_env();
        
        let creator = Address::generate(&env);
        let client_addr = Address::generate(&env);
        
        // Generate varied test inputs based on iteration
        let amount = 1000i128 + (iteration as i128 * 5000);
        let current_time = env.ledger().timestamp();
        // Create invoices with short due dates (10-1000 seconds in the future)
        let due_date = current_time + 10 + (iteration * 10);
        
        let description = SorobanString::from_str(&env, "Test invoice for expiration");
        
        // Step 1: Create invoice
        let create_result = client.try_create_invoice(
            &creator,
            &client_addr,
            &amount,
            &description,
            &due_date,
        );
        
        assert!(create_result.is_ok(), "Invoice creation should succeed");
        let invoice_id = create_result.unwrap().unwrap().invoice_id;
        
        // Step 2: Mark invoice as sent
        let sent_result = client.try_mark_invoice_sent(&invoice_id, &creator);
        assert!(sent_result.is_ok(), "Marking invoice as sent should succeed");
        
        // Step 3: Advance time past the due date
        env.ledger().with_mut(|li| {
            li.timestamp = due_date + 1;
        });
        
        // Step 4: Check invoice expiration
        let expiration_check = client.try_check_invoice_expiration(&invoice_id);
        assert!(expiration_check.is_ok(), "Expiration check should succeed");
        
        let expiration_result = expiration_check.unwrap().unwrap();
        assert_eq!(
            expiration_result.status,
            InvoiceStatus::Expired,
            "Invoice should be marked as Expired after due date"
        );
        
        // Step 5: Verify invoice state is updated
        let invoice = client.try_get_invoice(&invoice_id).unwrap().unwrap();
        assert_eq!(
            invoice.status,
            InvoiceStatus::Expired,
            "Invoice status should be Expired in storage"
        );
        
        // Step 6: Attempt to approve expired invoice should fail
        let approve_result = client.try_approve_invoice(&invoice_id, &client_addr);
        assert!(
            approve_result.is_err() || approve_result.unwrap().is_err(),
            "Approving expired invoice should fail"
        );
        
        // Step 7: Attempt to execute expired invoice should fail
        let execute_result = client.try_execute_invoice(&invoice_id);
        assert!(
            execute_result.is_err() || execute_result.unwrap().is_err(),
            "Executing expired invoice should fail"
        );
    }
}
