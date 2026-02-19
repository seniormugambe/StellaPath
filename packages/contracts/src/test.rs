#[cfg(test)]
mod tests {
    use crate::{StellarDAppContract, StellarDAppContractClient};
    use soroban_sdk::{testutils::Address as _, Address, Env};

    #[test]
    fn test_contract_initialization() {
        let env = Env::default();
        env.mock_all_auths(); // Mock all authorization checks
        
        let contract_id = env.register(StellarDAppContract, ());
        let client = StellarDAppContractClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        
        // Test contract initialization
        let result = client.try_initialize(&admin);
        assert!(result.is_ok());

        // Test version
        let version = client.version();
        assert_eq!(version, 1);
    }

    #[test]
    fn test_basic_transaction() {
        let env = Env::default();
        env.mock_all_auths(); // Mock all authorization checks
        
        let contract_id = env.register(StellarDAppContract, ());
        let client = StellarDAppContractClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let sender = Address::generate(&env);
        let recipient = Address::generate(&env);
        
        // Initialize contract
        let _ = client.try_initialize(&admin);

        // Test transaction creation
        let result = client.try_execute_transaction(
            &sender,
            &recipient,
            &1000i128,
            &soroban_sdk::String::from_str(&env, "test transaction"),
        );

        assert!(result.is_ok());
        let tx_result = result.unwrap().unwrap(); // First unwrap for Result<Result<T, ContractError>, ConversionError>
        assert_eq!(tx_result.transaction_id, 1);
    }
}