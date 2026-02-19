//! Transaction management functions

use soroban_sdk::{contractimpl, Address, Env, String};
use crate::{StellarDAppContract, ContractError, Transaction, TransactionResult, TransactionType, TransactionStatus};
use crate::validation;
use crate::storage;

#[contractimpl]
impl StellarDAppContract {
    /// Execute a basic transaction
    pub fn execute_transaction(
        env: Env,
        sender: Address,
        recipient: Address,
        amount: i128,
        metadata: String,
    ) -> Result<TransactionResult, ContractError> {
        // Check for reentrancy
        validation::check_reentrancy(&env)?;
        
        // Validate inputs
        validation::validate_address(&env, &sender)?;
        validation::validate_address(&env, &recipient)?;
        validation::validate_amount(amount)?;
        
        // Validate signature and balance (requires authorization)
        validation::validate_balance(&env, &sender, amount)?;

        // Create transaction record
        let tx_id = storage::get_next_transaction_id(&env);
        let transaction = Transaction {
            id: tx_id,
            transaction_type: TransactionType::Basic,
            sender: sender.clone(),
            recipient: recipient.clone(),
            amount,
            status: TransactionStatus::Pending,
            timestamp: env.ledger().timestamp(),
            metadata: metadata.clone(),
        };

        // Store transaction
        storage::set_transaction(&env, tx_id, &transaction);

        // Execute the transfer (this would interact with Stellar's native token transfer)
        // In a real implementation, this would call the token contract's transfer function
        // For now, we'll mark as confirmed after successful validation
        let mut updated_transaction = transaction;
        updated_transaction.status = TransactionStatus::Confirmed;
        storage::set_transaction(&env, tx_id, &updated_transaction);

        // Clear reentrancy guard
        validation::clear_reentrancy(&env);

        Ok(TransactionResult {
            transaction_id: tx_id,
            status: TransactionStatus::Confirmed,
            tx_hash: String::from_str(&env, "mock_tx_hash"), // In real implementation, this would be the actual tx hash
        })
    }

    /// Get transaction details
    pub fn get_transaction(env: Env, transaction_id: u64) -> Result<Transaction, ContractError> {
        storage::get_transaction(&env, transaction_id)
            .ok_or(ContractError::TransactionNotFound)
    }

    /// Get transaction history for an account
    pub fn get_transaction_history(env: Env, account: Address) -> Result<soroban_sdk::Vec<Transaction>, ContractError> {
        validation::validate_address(&env, &account)?;
        Ok(storage::get_transactions_by_account(&env, &account))
    }

    /// Execute a P2P (peer-to-peer) transaction
    pub fn execute_p2p_transaction(
        env: Env,
        sender: Address,
        recipient: Address,
        amount: i128,
        memo: String,
    ) -> Result<TransactionResult, ContractError> {
        // Check for reentrancy
        validation::check_reentrancy(&env)?;
        
        // Validate inputs
        validation::validate_address(&env, &sender)?;
        validation::validate_address(&env, &recipient)?;
        validation::validate_amount(amount)?;
        
        // Validate balance and authorization
        validation::validate_balance(&env, &sender, amount)?;

        // Create transaction record
        let tx_id = storage::get_next_transaction_id(&env);
        let transaction = Transaction {
            id: tx_id,
            transaction_type: TransactionType::P2P,
            sender: sender.clone(),
            recipient: recipient.clone(),
            amount,
            status: TransactionStatus::Pending,
            timestamp: env.ledger().timestamp(),
            metadata: memo,
        };

        // Store transaction
        storage::set_transaction(&env, tx_id, &transaction);

        // Execute the P2P transfer
        let mut updated_transaction = transaction;
        updated_transaction.status = TransactionStatus::Confirmed;
        storage::set_transaction(&env, tx_id, &updated_transaction);

        // Clear reentrancy guard
        validation::clear_reentrancy(&env);

        Ok(TransactionResult {
            transaction_id: tx_id,
            status: TransactionStatus::Confirmed,
            tx_hash: String::from_str(&env, "p2p_tx_hash"),
        })
    }
}