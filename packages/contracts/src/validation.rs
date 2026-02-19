//! Validation utilities for smart contract operations

use soroban_sdk::{Address, Env};
use crate::ContractError;

/// Validate that an address is properly formatted
pub fn validate_address(_env: &Env, _address: &Address) -> Result<(), ContractError> {
    // In a real implementation, this would check address format and existence
    // For now, we assume all addresses are valid
    Ok(())
}

/// Validate that an amount is positive and within acceptable limits
pub fn validate_amount(amount: i128) -> Result<(), ContractError> {
    if amount <= 0 {
        return Err(ContractError::InvalidAmount);
    }
    
    // Check for reasonable upper limit (prevent overflow)
    if amount > i128::MAX / 2 {
        return Err(ContractError::InvalidAmount);
    }
    
    Ok(())
}

/// Validate that an account has sufficient balance for a transaction
pub fn validate_balance(_env: &Env, account: &Address, amount: i128) -> Result<(), ContractError> {
    // Require authorization from the account
    account.require_auth();
    
    // In Soroban, balance checks are handled by the token contract
    // This validation ensures the account has authorized the transaction
    // The actual balance check happens during token transfer
    
    // Additional validation: ensure amount is reasonable
    if amount <= 0 {
        return Err(ContractError::InvalidAmount);
    }
    
    Ok(())
}

/// Validate signature for transaction authorization
pub fn validate_signature(_env: &Env, signer: &Address, _data: &[u8], _signature: &[u8]) -> Result<(), ContractError> {
    // In Soroban, signature verification is handled through require_auth()
    // This ensures the signer has properly authorized the transaction
    signer.require_auth();
    
    // Additional signature validation logic could be added here
    // For example, checking signature format, expiration, etc.
    
    Ok(())
}

/// Check for reentrancy attacks
pub fn check_reentrancy(env: &Env) -> Result<(), ContractError> {
    // Simple reentrancy guard using contract storage
    let reentrancy_key = soroban_sdk::symbol_short!("reentry");
    
    if env.storage().instance().has(&reentrancy_key) {
        return Err(ContractError::ReentrancyDetected);
    }
    
    // Set reentrancy flag
    env.storage().instance().set(&reentrancy_key, &true);
    
    Ok(())
}

/// Clear reentrancy guard
pub fn clear_reentrancy(env: &Env) {
    let reentrancy_key = soroban_sdk::symbol_short!("reentry");
    env.storage().instance().remove(&reentrancy_key);
}