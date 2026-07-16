const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config();

/**
 * Configure SSL for database connection
 * - Production: SSL enabled with certificate verification by default
 * - Development: SSL disabled by default (local database)
 * - DB_SSL_CA: Path to CA certificate for self-signed certs
 * - DB_SSL_REJECT_UNAUTHORIZED: Set to 'false' only if absolutely necessary (NOT recommended)
 */
const getSSLConfig = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  const sslEnabled = process.env.DB_SSL === 'true' || isProduction;

  if (!sslEnabled) {
    return false;
  }

  const sslConfig = {
    // Default to verifying certificates in production for security
    rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false'
  };

  // Allow custom CA certificate for self-signed certs
  if (process.env.DB_SSL_CA) {
    try {
      sslConfig.ca = fs.readFileSync(process.env.DB_SSL_CA);
    } catch (err) {
      console.error('Failed to read SSL CA certificate:', err.message);
    }
  }

  // Log SSL configuration for debugging (not the certificate contents)
  if (isProduction) {
    console.log('Database SSL config:', {
      enabled: true,
      rejectUnauthorized: sslConfig.rejectUnauthorized,
      hasCA: !!sslConfig.ca
    });
  }

  return sslConfig;
};

// PostgreSQL connection pool.
// Prefer a single DATABASE_URL when present — managed hosts such as Neon and
// Render provide one — and fall back to the split DB_* variables used for
// local development. This matches the scripts (bootstrap/reset/seed), which
// already connect via DATABASE_URL.
const poolConfig = process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL }
  : {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD
    };
const pool = new Pool({
  ...poolConfig,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  ssl: getSSLConfig()
});

// Test database connection
pool.on('connect', () => {
  console.log('Database connected successfully');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle database client:', err.message);
  // Do not crash the server on transient connection errors — the pool will recover
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};
