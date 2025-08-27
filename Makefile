.PHONY: build run test clean help

# Binary name
BINARY_NAME=zayavki

# Build directory
BUILD_DIR=build

# Go files
GO_FILES=$(shell find . -name "*.go" -not -path "./vendor/*")

# Default target
all: build

# Build the application
build:
	@echo "Building $(BINARY_NAME)..."
	@mkdir -p $(BUILD_DIR)
	go build -o $(BUILD_DIR)/$(BINARY_NAME) ./cmd/server
	@echo "Build complete: $(BUILD_DIR)/$(BINARY_NAME)"

# Run the application
run: build
	@echo "Running $(BINARY_NAME)..."
	./$(BUILD_DIR)/$(BINARY_NAME)

# Run tests
test:
	@echo "Running tests..."
	go test -v ./...

# Run tests with coverage
test-coverage:
	@echo "Running tests with coverage..."
	go test -v -coverprofile=coverage.out ./...
	go tool cover -html=coverage.out -o coverage.html
	@echo "Coverage report generated: coverage.html"

# Clean build artifacts
clean:
	@echo "Cleaning build artifacts..."
	rm -rf $(BUILD_DIR)
	rm -f coverage.out coverage.html
	@echo "Clean complete"

# Format code
fmt:
	@echo "Formatting code..."
	go fmt ./...

# Run linter
lint:
	@echo "Running linter..."
	golangci-lint run

# Install dependencies
deps:
	@echo "Installing dependencies..."
	go mod download
	go mod tidy

# Generate mock files (if using mockgen)
mocks:
	@echo "Generating mocks..."
	@if command -v mockgen > /dev/null; then \
		mockgen -source=internal/services/tenant_service.go -destination=internal/mocks/mock_tenant_service.go; \
		mockgen -source=internal/services/cluster_service.go -destination=internal/mocks/mock_cluster_service.go; \
		echo "Mocks generated"; \
	else \
		echo "mockgen not found. Install with: go install github.com/golang/mock/mockgen@latest"; \
	fi

# Development mode (build and run with hot reload using air if available)
dev:
	@if command -v air > /dev/null; then \
		echo "Starting development server with hot reload..."; \
		air; \
	else \
		echo "air not found. Install with: go install github.com/cosmtrek/air@latest"; \
		echo "Falling back to regular build and run..."; \
		$(MAKE) run; \
	fi

# Show help
help:
	@echo "Available targets:"
	@echo "  build        - Build the application"
	@echo "  run          - Build and run the application"
	@echo "  test         - Run tests"
	@echo "  test-coverage - Run tests with coverage report"
	@echo "  clean        - Clean build artifacts"
	@echo "  fmt          - Format code"
	@echo "  lint         - Run linter"
	@echo "  deps         - Install dependencies"
	@echo "  mocks        - Generate mock files"
	@echo "  dev          - Development mode with hot reload"
	@echo "  help         - Show this help message"
