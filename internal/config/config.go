package config

import (
	"encoding/json"
	"fmt"
	"os"
	"strconv"
)

type Config struct {
	Server   ServerConfig   `json:"server"`
	Database DatabaseConfig `json:"database"`
}

type ServerConfig struct {
	Address        string `json:"address" env:"SERVER_ADDRESS"`
	Port           int    `json:"port" env:"SERVER_PORT"`
	ReadTimeout    int    `json:"read_timeout" env:"SERVER_READ_TIMEOUT"`
	WriteTimeout   int    `json:"write_timeout" env:"SERVER_WRITE_TIMEOUT"`
	MaxHeaderBytes int    `json:"max_header_bytes" env:"SERVER_MAX_HEADER_BYTES"`
}

type DatabaseConfig struct {
	Host            string `json:"host" env:"DB_HOST"`
	Port            string `json:"port" env:"DB_PORT"`
	User            string `json:"user" env:"DB_USER"`
	Password        string `json:"password" env:"DB_PASSWORD"`
	DBName          string `json:"dbname" env:"DB_NAME"`
	Schema          string `json:"schema" env:"DB_SCHEMA"`
	Table           string `json:"table" env:"DB_TABLE"`
	MaxOpenConns    int    `json:"max_open_conns" env:"DB_MAX_OPEN_CONNS"`
	MaxIdleConns    int    `json:"max_idle_conns" env:"DB_MAX_IDLE_CONNS"`
	ConnMaxLifetime int    `json:"conn_max_lifetime" env:"DB_CONN_MAX_LIFETIME"`
}

func Load() (*Config, error) {
	cfg := &Config{}

	// Try to load from config file first
	if err := loadFromFile(cfg); err != nil {
		// If file loading fails, use environment variables
		if err := loadFromEnv(cfg); err != nil {
			return nil, fmt.Errorf("failed to load configuration: %v", err)
		}
	}

	// Set defaults
	setDefaults(cfg)

	return cfg, nil
}

func loadFromFile(cfg *Config) error {
	configPath := os.Getenv("CONFIG_PATH")
	if configPath == "" {
		configPath = "db_config.json"
	}

	file, err := os.ReadFile(configPath)
	if err != nil {
		return fmt.Errorf("failed to read config file: %v", err)
	}

	// Parse the JSON into our Config struct
	if err := json.Unmarshal(file, &cfg); err != nil {
		return fmt.Errorf("failed to parse config file: %v", err)
	}

	return nil
}

func loadFromEnv(cfg *Config) error {
	// Server config
	if val := os.Getenv("SERVER_ADDRESS"); val != "" {
		cfg.Server.Address = val
	}
	if val := os.Getenv("SERVER_PORT"); val != "" {
		if port, err := strconv.Atoi(val); err == nil {
			cfg.Server.Port = port
		}
	}

	// Database config
	if val := os.Getenv("DB_HOST"); val != "" {
		cfg.Database.Host = val
	}
	if val := os.Getenv("DB_PORT"); val != "" {
		cfg.Database.Port = val
	}
	if val := os.Getenv("DB_USER"); val != "" {
		cfg.Database.User = val
	}
	if val := os.Getenv("DB_PASSWORD"); val != "" {
		cfg.Database.Password = val
	}
	if val := os.Getenv("DB_NAME"); val != "" {
		cfg.Database.DBName = val
	}
	if val := os.Getenv("DB_SCHEMA"); val != "" {
		cfg.Database.Schema = val
	}
	if val := os.Getenv("DB_TABLE"); val != "" {
		cfg.Database.Table = val
	}

	return nil
}

func setDefaults(cfg *Config) {
	// Server defaults
	if cfg.Server.Address == "" {
		cfg.Server.Address = "localhost"
	}
	if cfg.Server.Port == 0 {
		cfg.Server.Port = 8080
	}
	if cfg.Server.ReadTimeout == 0 {
		cfg.Server.ReadTimeout = 30
	}
	if cfg.Server.WriteTimeout == 0 {
		cfg.Server.WriteTimeout = 30
	}
	if cfg.Server.MaxHeaderBytes == 0 {
		cfg.Server.MaxHeaderBytes = 1 << 20
	}

	// Database defaults
	if cfg.Database.Port == "" {
		cfg.Database.Port = "5432"
	}
	if cfg.Database.MaxOpenConns == 0 {
		cfg.Database.MaxOpenConns = 25
	}
	if cfg.Database.MaxIdleConns == 0 {
		cfg.Database.MaxIdleConns = 25
	}
	if cfg.Database.ConnMaxLifetime == 0 {
		cfg.Database.ConnMaxLifetime = 300 // 5 minutes
	}
}

func (c *Config) GetServerAddress() string {
	return fmt.Sprintf("%s:%d", c.Server.Address, c.Server.Port)
}

func (c *Config) GetDatabaseConnectionString() string {
	return fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		c.Database.Host, c.Database.Port, c.Database.User, c.Database.Password, c.Database.DBName)
}
