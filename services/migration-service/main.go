package main

import (
	"database/sql"
	"flag"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	_ "github.com/lib/pq"
)

func main() {
	dryRun := flag.Bool("dry-run", false, "Run migrations in dry-run mode (rolls back transactions)")
	flag.Parse()

	// 1. Connect to Database
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		host := getEnvOrDefault("DB_HOST", "localhost")
		port := getEnvOrDefault("DB_PORT", "5432")
		user := getEnvOrDefault("DB_USER", "postgres")
		pass := getEnvOrDefault("DB_PASSWORD", "postgres")
		name := getEnvOrDefault("DB_NAME", "postgres")
		sslmode := getEnvOrDefault("DB_SSLMODE", "disable")
		sslrootcert := os.Getenv("DB_SSLROOTCERT")
		sslcert := os.Getenv("DB_SSLCERT")
		sslkey := os.Getenv("DB_SSLKEY")

		dbURL = fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
			host, port, user, pass, name, sslmode)

		if sslrootcert != "" {
			dbURL += fmt.Sprintf(" sslrootcert=%s", sslrootcert)
		}
		if sslcert != "" && sslkey != "" {
			dbURL += fmt.Sprintf(" sslcert=%s sslkey=%s", sslcert, sslkey)
		}
	}

	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		log.Fatalf("Failed to open database connection: %v", err)
	}
	defer db.Close()

	// Retry connection a few times in case db is starting up
	for i := 0; i < 5; i++ {
		err = db.Ping()
		if err == nil {
			break
		}
		log.Printf("Waiting for database connection... (%v)", err)
		time.Sleep(2 * time.Second)
	}
	if err != nil {
		log.Fatalf("Could not connect to database after retries: %v", err)
	}

	log.Println("Connected to database successfully.")

	// 2. Create the migrations table if it doesn't exist
	createTableQuery := `
	CREATE TABLE IF NOT EXISTS migrations (
		id SERIAL PRIMARY KEY,
		filename VARCHAR(255) UNIQUE NOT NULL,
		status VARCHAR(50) NOT NULL,
		applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);
	`
	if _, err := db.Exec(createTableQuery); err != nil {
		log.Fatalf("Failed to create migrations table: %v", err)
	}

	// 3. Retrieve failed migrations
	failedRows, err := db.Query("SELECT filename FROM migrations WHERE status = 'failed'")
	if err != nil {
		log.Fatalf("Failed to query failed migrations: %v", err)
	}

	failedMigrations := make(map[string]bool)
	for failedRows.Next() {
		var filename string
		if err := failedRows.Scan(&filename); err != nil {
			log.Fatalf("Failed to read failed migration row: %v", err)
		}
		failedMigrations[filename] = true
	}
	failedRows.Close()

	// 4. Retrieve executed migrations
	rows, err := db.Query("SELECT filename FROM migrations WHERE status = 'executed'")
	if err != nil {
		log.Fatalf("Failed to query executed migrations: %v", err)
	}
	defer rows.Close()

	executedMigrations := make(map[string]bool)
	for rows.Next() {
		var filename string
		if err := rows.Scan(&filename); err != nil {
			log.Fatalf("Failed to read executed migration row: %v", err)
		}
		executedMigrations[filename] = true
	}

	// 5. Read migration files
	migrationsDir := getEnvOrDefault("MIGRATIONS_DIR", "migrations")
	files, err := os.ReadDir(migrationsDir)
	if err != nil {
		log.Fatalf("Failed to read migrations directory (%s): %v", migrationsDir, err)
	}

	var sqlFiles []string
	for _, file := range files {
		if !file.IsDir() && strings.HasSuffix(file.Name(), ".sql") {
			sqlFiles = append(sqlFiles, file.Name())
		}
	}

	// ReadDir sorts by name, but to be sure we sort explicitly
	sort.Strings(sqlFiles)

	// 6. Execute pending migrations
	for _, file := range sqlFiles {
		if executedMigrations[file] {
			continue // Already applied
		}

		if failedMigrations[file] {
			log.Printf("Re-attempting previously failed migration: %s", file)
		} else {
			if *dryRun {
				log.Printf("DRY RUN: Applying migration: %s", file)
			} else {
				log.Printf("Applying migration: %s", file)
			}
		}

		start := time.Now()
		filePath := filepath.Join(migrationsDir, file)
		content, err := os.ReadFile(filePath)
		if err != nil {
			log.Fatalf("Failed to read file %s: %v", file, err)
		}

		tx, err := db.Begin()
		if err != nil {
			log.Fatalf("Failed to begin transaction for %s: %v", file, err)
		}

		_, err = tx.Exec(string(content))
		if err != nil {
			tx.Rollback()
			log.Printf("Migration failed: %s, error: %v", file, err)

			if !*dryRun && !failedMigrations[file] {
				// Record the failure in a non-transaction query
				_, recordErr := db.Exec("INSERT INTO migrations (filename, status) VALUES ($1, 'failed')", file)
				if recordErr != nil {
					log.Fatalf("Critical: failed to execute migration AND failed to record the failure status: %v", recordErr)
				}
			}
			log.Fatalf("Aborting further execution.")
		}

		if *dryRun {
			if err := tx.Rollback(); err != nil {
				log.Fatalf("Failed to rollback transaction for %s: %v", file, err)
			}
			duration := time.Since(start)
			log.Printf("DRY RUN: Successfully verified migration: %s in %v", file, duration)
			continue
		}

		// Success!
		if failedMigrations[file] {
			_, err = tx.Exec("DELETE FROM migrations WHERE filename = $1 AND status = 'failed'", file)
			if err != nil {
				tx.Rollback()
				log.Fatalf("Failed to remove migration from failed list for %s: %v", file, err)
			}
		}

		_, err = tx.Exec("INSERT INTO migrations (filename, status) VALUES ($1, 'executed')", file)
		if err != nil {
			tx.Rollback()
			log.Fatalf("Failed to record migration success for %s: %v", file, err)
		}

		if err := tx.Commit(); err != nil {
			log.Fatalf("Failed to commit transaction for %s: %v", file, err)
		}

		duration := time.Since(start)
		log.Printf("Successfully applied migration: %s in %v", file, duration)
	}

	if *dryRun {
		log.Println("DRY RUN: All migrations verified successfully.")
	} else {
		log.Println("All migrations applied successfully.")
	}
}

func getEnvOrDefault(key, fallback string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return fallback
}
