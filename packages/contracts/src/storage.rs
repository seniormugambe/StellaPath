//! Storage utilities for smart contract data

use soroban_sdk::{Address, Env, Vec, Symbol, symbol_short};
use crate::{Transaction, EscrowContract, Invoice};

/// Set contract administrator
pub fn set_admin(env: &Env, admin: &Address) {
    let key = symbol_short!("admin");
    env.storage().instance().set(&key, admin);
}

/// Get contract administrator
pub fn get_admin(env: &Env) -> Option<Address> {
    let key = symbol_short!("admin");
    env.storage().instance().get(&key)
}

/// Get next transaction ID
pub fn get_next_transaction_id(env: &Env) -> u64 {
    let key = symbol_short!("tx_count");
    let current: u64 = env.storage().instance().get(&key).unwrap_or(0);
    let next = current + 1;
    env.storage().instance().set(&key, &next);
    next
}

/// Store transaction
pub fn set_transaction(env: &Env, id: u64, transaction: &Transaction) {
    env.storage().persistent().set(&id, transaction);
}

/// Get transaction
pub fn get_transaction(env: &Env, id: u64) -> Option<Transaction> {
    env.storage().persistent().get(&id)
}

/// Get transactions by account (simplified - in real implementation would use indexing)
pub fn get_transactions_by_account(env: &Env, _account: &Address) -> Vec<Transaction> {
    let transactions = Vec::new(env);
    
    // In a real implementation, this would use proper indexing
    // For now, we'll return an empty vector as a placeholder
    transactions
}

/// Get next escrow ID
pub fn get_next_escrow_id(env: &Env) -> u64 {
    let key = symbol_short!("esc_count");
    let current: u64 = env.storage().instance().get(&key).unwrap_or(0);
    let next = current + 1;
    env.storage().instance().set(&key, &next);
    next
}

/// Store escrow
pub fn set_escrow(env: &Env, id: u64, escrow: &EscrowContract) {
    let key = Symbol::new(env, "escrow");
    env.storage().persistent().set(&(key, id), escrow);
}

/// Get escrow
pub fn get_escrow(env: &Env, id: u64) -> Option<EscrowContract> {
    let key = Symbol::new(env, "escrow");
    env.storage().persistent().get(&(key, id))
}

/// Get next invoice ID
pub fn get_next_invoice_id(env: &Env) -> u64 {
    let key = symbol_short!("inv_count");
    let current: u64 = env.storage().instance().get(&key).unwrap_or(0);
    let next = current + 1;
    env.storage().instance().set(&key, &next);
    next
}

/// Store invoice
pub fn set_invoice(env: &Env, id: u64, invoice: &Invoice) {
    let key = Symbol::new(env, "invoice");
    env.storage().persistent().set(&(key, id), invoice);
}

/// Get invoice
pub fn get_invoice(env: &Env, id: u64) -> Option<Invoice> {
    let key = Symbol::new(env, "invoice");
    env.storage().persistent().get(&(key, id))
}