# Zayavki - Tenant Management System

A Go-based web application for managing tenant resources in cloud environments.

## Project Structure

The project has been restructured to follow clean architecture principles:

```
├── cmd/
│   └── server/              # Application entry point
│       └── main.go
├── internal/                # Private application code
│   ├── config/             # Configuration management
│   ├── handlers/           # HTTP request handlers
│   ├── services/           # Business logic layer
│   ├── repositories/       # Data access layer
│   ├── models/             # Data structures and models
│   └── middleware/         # HTTP middleware
├── pkg/                    # Public packages (if any)
├── web/                    # Frontend assets
│   ├── static/            # CSS, JS, images
│   └── templates/         # HTML templates
└── legacy/                 # Original code (to be migrated)
```

## Architecture Layers

### 1. **Models** (`internal/models/`)
- Data structures and domain models
- JSON tags and validation rules
- Database model representations

### 2. **Repositories** (`internal/repositories/`)
- Data access layer
- Database operations
- External service integrations

### 3. **Services** (`internal/services/`)
- Business logic implementation
- Orchestrates operations between repositories
- Handles complex workflows

### 4. **Handlers** (`internal/handlers/`)
- HTTP request/response handling
- Input validation
- Response formatting

### 5. **Configuration** (`internal/config/`)
- Environment-based configuration
- Database connection settings
- Server configuration

## Getting Started

### Prerequisites
- Go 1.22 or later
- PostgreSQL database
- Excel file with cluster information (`clusters.xlsx`)

### Configuration

The application can be configured using either environment variables or a configuration file:

#### Environment Variables
```bash
export SERVER_ADDRESS=localhost
export SERVER_PORT=8080
export DB_HOST=localhost
export DB_PORT=5432
export DB_USER=username
export DB_PASSWORD=password
export DB_NAME=database_name
```

#### Configuration File
Create a `db_config.json` file:
```json
{
  "server": {
    "address": "localhost",
    "port": 8080,
    "read_timeout": 30,
    "write_timeout": 30,
    "max_header_bytes": 1048576
  },
  "database": {
    "host": "localhost",
    "port": "5432",
    "user": "username",
    "password": "password",
    "dbname": "database_name",
    "schema": "public",
    "table": "tenant_resources",
    "max_open_conns": 25,
    "max_idle_conns": 25,
    "conn_max_lifetime": 300
  }
}
```

### Running the Application

1. **Build the application:**
   ```bash
   go build -o zayavki ./cmd/server
   ```

2. **Run the server:**
   ```bash
   ./zayavki
   ```

3. **Access the application:**
   - Web interface: http://localhost:8080/zayavki/
   - API endpoints: http://localhost:8080/zayavki/*

## API Endpoints

### Tenant Management
- `POST /zayavki/submit` - Create new tenant
- `POST /zayavki/cluster` - Handle cluster selection
- `POST /zayavki/check` - Check existing entries
- `POST /zayavki/check-tenant-resources` - Check tenant resources
- `POST /zayavki/deactivate-resources` - Deactivate resources
- `POST /zayavki/update-bucket-quotas` - Update bucket quotas

### Cluster Management
- `POST /zayavki/cluster-info` - Get cluster information

## Development

### Adding New Features

1. **Models**: Define data structures in `internal/models/`
2. **Repositories**: Implement data access in `internal/repositories/`
3. **Services**: Add business logic in `internal/services/`
4. **Handlers**: Create HTTP endpoints in `internal/handlers/`
5. **Configuration**: Update config if needed

### Testing

Run tests:
```bash
go test ./...
```

### Code Quality

The project follows Go best practices:
- Proper error handling
- Context usage for request lifecycle
- Interface-based design
- Clean separation of concerns

## Migration from Legacy Code

The original monolithic `main.go` has been broken down into:

- **Database operations** → `internal/repositories/`
- **Business logic** → `internal/services/`
- **HTTP handling** → `internal/handlers/`
- **Configuration** → `internal/config/`

Legacy packages are still imported and used in the new structure, but the architecture is now much cleaner and more maintainable.

## Future Improvements

- [ ] Add comprehensive testing
- [ ] Implement proper logging with structured logging
- [ ] Add metrics and monitoring
- [ ] Implement authentication and authorization
- [ ] Add API documentation with OpenAPI/Swagger
- [ ] Implement rate limiting
- [ ] Add health checks
- [ ] Containerization with Docker
- [ ] CI/CD pipeline setup

## Contributing

1. Follow the established architecture patterns
2. Add tests for new functionality
3. Update documentation as needed
4. Use meaningful commit messages

## License

[Add your license information here]
