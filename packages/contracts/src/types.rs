//! Type definitions for the Stellar DApp smart contract

use soroban_sdk::{contracttype, contracterror, Address, String, Vec};

/// Contract error types
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum ContractError {
    /// Insufficient balance for the operation
    InsufficientBalance = 1,
    /// Invalid address provided
    InvalidAddress = 2,
    /// Unauthorized access attempt
    Unauthorized = 3,
    /// Invalid amount (must be positive)
    InvalidAmount = 4,
    /// Transaction not found
    TransactionNotFound = 5,
    /// Escrow not found
    EscrowNotFound = 6,
    /// Escrow conditions not met
    ConditionsNotMet = 7,
    /// Escrow has expired
    EscrowExpired = 8,
    /// Invoice not found
    InvoiceNotFound = 9,
    /// Invoice already approved
    InvoiceAlreadyApproved = 10,
    /// Invoice has expired
    InvoiceExpired = 11,
    /// Invalid signature
    InvalidSignature = 12,
    /// Reentrancy detected
    ReentrancyDetected = 13,
}

/// Transaction status enumeration
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum TransactionStatus {
    Pending = 0,
    Confirmed = 1,
    Failed = 2,
    Cancelled = 3,
}

/// Transaction type enumeration
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum TransactionType {
    Basic = 0,
    Escrow = 1,
    P2P = 2,
    Invoice = 3,
}

/// Escrow status enumeration
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum EscrowStatus {
    Active = 0,
    ConditionsMet = 1,
    Released = 2,
    Refunded = 3,
    Expired = 4,
}

/// Invoice status enumeration
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum InvoiceStatus {
    Draft = 0,
    Sent = 1,
    Approved = 2,
    Executed = 3,
    Rejected = 4,
    Expired = 5,
}

/// Condition type for escrow
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ConditionType {
    TimeBased = 0,
    OracleBased = 1,
    ManualApproval = 2,
}

/// Basic transaction data
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Transaction {
    pub id: u64,
    pub transaction_type: TransactionType,
    pub sender: Address,
    pub recipient: Address,
    pub amount: i128,
    pub status: TransactionStatus,
    pub timestamp: u64,
    pub metadata: String,
}

/// Escrow condition definition
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Condition {
    pub condition_type: ConditionType,
    pub parameters: String, // JSON-encoded parameters
    pub validator: Address, // Contract or oracle address
}

/// Escrow contract data
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EscrowContract {
    pub id: u64,
    pub sender: Address,
    pub recipient: Address,
    pub amount: i128,
    pub conditions: Vec<Condition>,
    pub status: EscrowStatus,
    pub created_at: u64,
    pub expires_at: u64,
}

/// Invoice data
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Invoice {
    pub id: u64,
    pub creator: Address,
    pub client: Address,
    pub amount: i128,
    pub description: String,
    pub status: InvoiceStatus,
    pub created_at: u64,
    pub due_date: u64,
    pub approved_at: Option<u64>,
}

/// Transaction result
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TransactionResult {
    pub transaction_id: u64,
    pub status: TransactionStatus,
    pub tx_hash: String,
}

/// Escrow result
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EscrowResult {
    pub escrow_id: u64,
    pub status: EscrowStatus,
    pub tx_hash: Option<String>,
}

/// Invoice result
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct InvoiceResult {
    pub invoice_id: u64,
    pub status: InvoiceStatus,
    pub tx_hash: Option<String>,
}