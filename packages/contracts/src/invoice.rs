//! Invoice management functions

use soroban_sdk::{contractimpl, Address, Env, String};
use crate::{StellarDAppContract, ContractError, Invoice, InvoiceResult, InvoiceStatus};
use crate::validation;
use crate::storage;

#[contractimpl]
impl StellarDAppContract {
    /// Create a new invoice
    pub fn create_invoice(
        env: Env,
        creator: Address,
        client: Address,
        amount: i128,
        description: String,
        due_date: u64,
    ) -> Result<InvoiceResult, ContractError> {
        // Check for reentrancy
        validation::check_reentrancy(&env)?;
        
        // Validate inputs
        validation::validate_address(&env, &creator)?;
        validation::validate_address(&env, &client)?;
        validation::validate_amount(amount)?;

        // Validate due date is in the future
        if due_date <= env.ledger().timestamp() {
            validation::clear_reentrancy(&env);
            return Err(ContractError::InvalidAmount);
        }

        // Create invoice record
        let invoice_id = storage::get_next_invoice_id(&env);
        let invoice = Invoice {
            id: invoice_id,
            creator: creator.clone(),
            client,
            amount,
            description,
            status: InvoiceStatus::Draft,
            created_at: env.ledger().timestamp(),
            due_date,
            approved_at: None,
        };

        // Store invoice
        storage::set_invoice(&env, invoice_id, &invoice);

        // Clear reentrancy guard
        validation::clear_reentrancy(&env);

        Ok(InvoiceResult {
            invoice_id,
            status: InvoiceStatus::Draft,
            tx_hash: None,
        })
    }

    /// Approve an invoice (called by client)
    pub fn approve_invoice(
        env: Env,
        invoice_id: u64,
        client: Address,
    ) -> Result<InvoiceResult, ContractError> {
        // Check for reentrancy
        validation::check_reentrancy(&env)?;
        
        let mut invoice = storage::get_invoice(&env, invoice_id)
            .ok_or(ContractError::InvoiceNotFound)?;

        // Verify client authorization (signature verification)
        validation::validate_signature(&env, &client, &[], &[])?;
        
        // Verify client matches invoice
        if invoice.client != client {
            validation::clear_reentrancy(&env);
            return Err(ContractError::Unauthorized);
        }

        // Check if already approved or executed
        if invoice.status != InvoiceStatus::Sent && invoice.status != InvoiceStatus::Draft {
            validation::clear_reentrancy(&env);
            return Err(ContractError::InvoiceAlreadyApproved);
        }

        // Check if expired
        if env.ledger().timestamp() > invoice.due_date {
            // Mark as expired
            invoice.status = InvoiceStatus::Expired;
            storage::set_invoice(&env, invoice_id, &invoice);
            validation::clear_reentrancy(&env);
            return Err(ContractError::InvoiceExpired);
        }

        // Approve invoice
        invoice.status = InvoiceStatus::Approved;
        invoice.approved_at = Some(env.ledger().timestamp());
        storage::set_invoice(&env, invoice_id, &invoice);

        // Clear reentrancy guard
        validation::clear_reentrancy(&env);

        Ok(InvoiceResult {
            invoice_id,
            status: InvoiceStatus::Approved,
            tx_hash: None,
        })
    }

    /// Execute an approved invoice (process payment automatically)
    pub fn execute_invoice(env: Env, invoice_id: u64) -> Result<InvoiceResult, ContractError> {
        // Check for reentrancy
        validation::check_reentrancy(&env)?;
        
        let mut invoice = storage::get_invoice(&env, invoice_id)
            .ok_or(ContractError::InvoiceNotFound)?;

        // Check if approved
        if invoice.status != InvoiceStatus::Approved {
            validation::clear_reentrancy(&env);
            return Err(ContractError::Unauthorized);
        }

        // Check if expired
        if env.ledger().timestamp() > invoice.due_date {
            invoice.status = InvoiceStatus::Expired;
            storage::set_invoice(&env, invoice_id, &invoice);
            validation::clear_reentrancy(&env);
            return Err(ContractError::InvoiceExpired);
        }

        // Validate client has sufficient balance
        validation::validate_balance(&env, &invoice.client, invoice.amount)?;

        // Execute payment (in real implementation, transfer funds from client to creator)
        invoice.status = InvoiceStatus::Executed;
        storage::set_invoice(&env, invoice_id, &invoice);

        // Clear reentrancy guard
        validation::clear_reentrancy(&env);

        Ok(InvoiceResult {
            invoice_id,
            status: InvoiceStatus::Executed,
            tx_hash: Some(String::from_str(&env, "invoice_payment_tx_hash")),
        })
    }

    /// Reject an invoice (called by client)
    pub fn reject_invoice(
        env: Env,
        invoice_id: u64,
        client: Address,
        _reason: String,
    ) -> Result<InvoiceResult, ContractError> {
        // Check for reentrancy
        validation::check_reentrancy(&env)?;
        
        let mut invoice = storage::get_invoice(&env, invoice_id)
            .ok_or(ContractError::InvoiceNotFound)?;

        // Verify client authorization
        validation::validate_signature(&env, &client, &[], &[])?;
        
        // Verify client matches invoice
        if invoice.client != client {
            validation::clear_reentrancy(&env);
            return Err(ContractError::Unauthorized);
        }

        // Can only reject if sent or draft
        if invoice.status != InvoiceStatus::Sent && invoice.status != InvoiceStatus::Draft {
            validation::clear_reentrancy(&env);
            return Err(ContractError::Unauthorized);
        }

        // Reject invoice
        invoice.status = InvoiceStatus::Rejected;
        storage::set_invoice(&env, invoice_id, &invoice);

        // Clear reentrancy guard
        validation::clear_reentrancy(&env);

        Ok(InvoiceResult {
            invoice_id,
            status: InvoiceStatus::Rejected,
            tx_hash: None,
        })
    }

    /// Check and handle invoice expiration
    pub fn check_invoice_expiration(env: Env, invoice_id: u64) -> Result<InvoiceResult, ContractError> {
        let mut invoice = storage::get_invoice(&env, invoice_id)
            .ok_or(ContractError::InvoiceNotFound)?;

        // Only check if invoice is in a state that can expire
        if invoice.status != InvoiceStatus::Sent && invoice.status != InvoiceStatus::Approved {
            return Ok(InvoiceResult {
                invoice_id,
                status: invoice.status,
                tx_hash: None,
            });
        }

        // Check if expired
        if env.ledger().timestamp() > invoice.due_date {
            invoice.status = InvoiceStatus::Expired;
            storage::set_invoice(&env, invoice_id, &invoice);
            
            return Ok(InvoiceResult {
                invoice_id,
                status: InvoiceStatus::Expired,
                tx_hash: None,
            });
        }

        // Not expired yet
        Ok(InvoiceResult {
            invoice_id,
            status: invoice.status,
            tx_hash: None,
        })
    }

    /// Get invoice details
    pub fn get_invoice(env: Env, invoice_id: u64) -> Result<Invoice, ContractError> {
        storage::get_invoice(&env, invoice_id)
            .ok_or(ContractError::InvoiceNotFound)
    }

    /// Mark invoice as sent (called after sending to client)
    pub fn mark_invoice_sent(env: Env, invoice_id: u64, creator: Address) -> Result<InvoiceResult, ContractError> {
        let mut invoice = storage::get_invoice(&env, invoice_id)
            .ok_or(ContractError::InvoiceNotFound)?;

        // Verify creator authorization
        if invoice.creator != creator {
            return Err(ContractError::Unauthorized);
        }

        if invoice.status != InvoiceStatus::Draft {
            return Err(ContractError::Unauthorized);
        }

        invoice.status = InvoiceStatus::Sent;
        storage::set_invoice(&env, invoice_id, &invoice);

        Ok(InvoiceResult {
            invoice_id,
            status: InvoiceStatus::Sent,
            tx_hash: None,
        })
    }
}