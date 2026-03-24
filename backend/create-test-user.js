/**
 * Script to create a test user for development
 * Run with: node create-test-user.js
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'mental_health_tracker',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || ''
});

async function createTestUser() {
  const testUser = {
    email: 'test@test.com',
    password: 'test1234',
    username: 'TestUser'
  };

  try {
    // Check if user already exists
    const existing = await pool.query('SELECT * FROM users WHERE email = $1', [testUser.email]);

    if (existing.rows.length > 0) {
      console.log('\n----------------------------------------');
      console.log('Test user already exists!');
      console.log('----------------------------------------');
      console.log('Email:    test@test.com');
      console.log('Password: test1234');
      console.log('----------------------------------------\n');
      process.exit(0);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(testUser.password, 10);
    const userId = uuidv4();

    // Insert user
    await pool.query(
      `INSERT INTO users (user_id, email, username, password_hash, is_anonymous, user_group, account_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, testUser.email, testUser.username, passwordHash, false, 'other', 'active']
    );

    // Create default preferences
    await pool.query(
      `INSERT INTO user_preferences (user_id) VALUES ($1)`,
      [userId]
    );

    console.log('\n========================================');
    console.log('  TEST USER CREATED SUCCESSFULLY!');
    console.log('========================================');
    console.log('');
    console.log('  Email:    test@test.com');
    console.log('  Password: test1234');
    console.log('');
    console.log('========================================\n');

  } catch (error) {
    console.error('Error creating test user:', error.message);
  } finally {
    await pool.end();
  }
}

createTestUser();
