# Stellar DApp Smart Contracts Makefile

# Default target
.DEFAULT_GOAL := help

# Variables
CONTRACT_NAME = stellar-dapp-contracts
NETWORK = testnet
WASM_TARGET = wasm32-unknown-unknown

# Help target
help: ## Show this help message
	@echo "Available targets:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

# Setup and installation
install: ## Install dependencies and setup environment
	@echo "Installing Rust dependencies..."
	cargo fetch
	@echo "Installing Soroban CLI..."
	cargo install --locked soroban-cli --features opt
	@echo "Adding wasm32 target..."
	rustup target add $(WASM_TARGET)

# Build targets
build: ## Build the smart contract
	@echo "Building smart contract..."
	cargo build --target $(WASM_TARGET) --release
	@echo "Optimizing WASM..."
	soroban contract optimize --wasm target/$(WASM_TARGET)/release/$(CONTRACT_NAME).wasm

build-dev: ## Build for development (with debug info)
	@echo "Building smart contract for development..."
	cargo build --target $(WASM_TARGET)

# Testing
test: ## Run all tests
	@echo "Running unit tests..."
	cargo test

test-verbose: ## Run tests with verbose output
	@echo "Running tests with verbose output..."
	cargo test -- --nocapture

test-property: ## Run property-based tests
	@echo "Running property-based tests..."
	cargo test --features testutils -- property

# Deployment
deploy-testnet: build ## Deploy to Stellar testnet
	@echo "Deploying to testnet..."
	soroban contract deploy \
		--wasm target/$(WASM_TARGET)/release/$(CONTRACT_NAME).wasm \
		--source-account $(DEPLOYER_SECRET_KEY) \
		--network $(NETWORK)

deploy-mainnet: build ## Deploy to Stellar mainnet (use with caution)
	@echo "Deploying to mainnet..."
	@read -p "Are you sure you want to deploy to mainnet? [y/N] " confirm && [ "$$confirm" = "y" ]
	soroban contract deploy \
		--wasm target/$(WASM_TARGET)/release/$(CONTRACT_NAME).wasm \
		--source-account $(DEPLOYER_SECRET_KEY) \
		--network mainnet

# Contract interaction
invoke: ## Invoke a contract function (usage: make invoke FUNCTION=function_name ARGS="--arg1 value1")
	soroban contract invoke \
		--id $(CONTRACT_ID) \
		--source-account $(DEPLOYER_SECRET_KEY) \
		--network $(NETWORK) \
		-- $(FUNCTION) $(ARGS)

# Development utilities
clean: ## Clean build artifacts
	@echo "Cleaning build artifacts..."
	cargo clean
	rm -rf target/

format: ## Format code
	@echo "Formatting code..."
	cargo fmt

lint: ## Run clippy linter
	@echo "Running clippy..."
	cargo clippy -- -D warnings

check: ## Check code without building
	@echo "Checking code..."
	cargo check

# Network setup
setup-testnet: ## Setup testnet configuration
	@echo "Setting up testnet configuration..."
	soroban config network add \
		--global testnet \
		--rpc-url https://soroban-testnet.stellar.org:443 \
		--network-passphrase "Test SDF Network ; September 2015"

setup-mainnet: ## Setup mainnet configuration
	@echo "Setting up mainnet configuration..."
	soroban config network add \
		--global mainnet \
		--rpc-url https://soroban-mainnet.stellar.org:443 \
		--network-passphrase "Public Global Stellar Network ; September 2015"

# Account management
create-account: ## Create a new Stellar account for testing
	@echo "Creating new test account..."
	soroban config identity generate --global test-account
	soroban config identity fund test-account --network testnet

# Documentation
docs: ## Generate documentation
	@echo "Generating documentation..."
	cargo doc --no-deps --open

# All-in-one setup
setup-all: install setup-testnet create-account ## Complete setup for development
	@echo "Development environment setup complete!"

.PHONY: help install build build-dev test test-verbose test-property deploy-testnet deploy-mainnet invoke clean format lint check setup-testnet setup-mainnet create-account docs setup-all