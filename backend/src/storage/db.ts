import Database from 'better-sqlite3';
import * as path from 'node:path';
import * as fs from 'node:fs';
import bcrypt from 'bcryptjs';
import { seedDemoData } from './seed';

let db: Database.Database | null = null;
let isInitializing = false;
let initError: Error | null = null;

function dataDir() {
  const explicit = process.env.LVER_DATA_DIR;
  if (explicit) return explicit;
  const sqlitePath = process.env.SQLITE_DB_PATH;
  if (sqlitePath) {
    return path.dirname(sqlitePath);
  }
  return path.join(process.cwd(), '.data');
}

function dbPath() {
  const sqlitePath = process.env.SQLITE_DB_PATH;
  if (sqlitePath) return sqlitePath;
  return path.join(dataDir(), 'store.sqlite');
}

export function getDb() {
  if (initError) {
    throw new Error(`Database initialization failed: ${initError.message}`);
  }
  if (!db) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return db;
}

export function initDb(): void {
  if (db) return; // Already initialized
  if (isInitializing) {
    throw new Error('Database initialization already in progress');
  }

  isInitializing = true;
  initError = null;

  try {
    const dir = dataDir();
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    const file = dbPath();
    
    // Validate directory permissions
    try {
      fs.accessSync(dir, fs.constants.R_OK | fs.constants.W_OK);
    } catch (accessErr: any) {
      throw new Error(`Cannot read/write to data directory ${dir}: ${accessErr.message}`);
    }

    // Initialize database with error handling
    try {
      db = new Database(file, { verbose: process.env.NODE_ENV === 'development' ? console.log : undefined });
    } catch (dbErr: any) {
      throw new Error(`Failed to open database at ${file}: ${dbErr.message}`);
    }

    // Configure database with error handling
    const pragmas = [
      'journal_mode = WAL',
      'foreign_keys = ON',
      'synchronous = NORMAL',
      'cache_size = -32000',
      'temp_store = MEMORY'
    ];
    
    for (const pragma of pragmas) {
      try {
        db.pragma(pragma);
      } catch (pragmaErr: any) {
        console.warn(`Warning: Failed to set pragma ${pragma}: ${pragmaErr.message}`);
      }
    }

    // Run migrations first
    migrate();

    // Then apply incremental column additions with proper error handling
    const migrations = [
      'ALTER TABLE customers ADD COLUMN lifetime_spend_total REAL NOT NULL DEFAULT 0',
      'ALTER TABLE customers ADD COLUMN vip_override_tier TEXT'
    ];
    
    for (const migration of migrations) {
      try {
        db.prepare(migration).run();
      } catch (migrationErr: any) {
        // Expected if column already exists
        if (!migrationErr.message.includes('duplicate column name')) {
          console.warn(`Warning: Migration failed: ${migration}: ${migrationErr.message}`);
        }
      }
    }

    // Run schema expansions with error handling
    try {
      ensureUsersRolesExpanded(db);
    } catch (err) {
      console.warn('Warning: Users roles expansion failed:', err instanceof Error ? err.message : err);
    }

    try {
      ensureUsersColumnsExpanded(db);
    } catch (err) {
      console.warn('Warning: Users columns expansion failed:', err instanceof Error ? err.message : err);
    }

    try {
      ensurePaymentsMethodsExpanded(db);
    } catch (err) {
      console.warn('Warning: Payments methods expansion failed:', err instanceof Error ? err.message : err);
    }

    console.log(`Database initialized successfully at ${file}`);
  } catch (err) {
    initError = err instanceof Error ? err : new Error(String(err));
    console.error('Database initialization failed:', initError);
    
    // Cleanup on failure
    if (db) {
      try {
        db.close();
      } catch (closeErr) {
        console.warn('Warning: Failed to close database after initialization failure:', closeErr);
      }
      db = null;
    }
    
    throw initError;
  } finally {
    isInitializing = false;
  }
}

function ensurePaymentsMethodsExpanded(database: Database.Database) {
  const row = database
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='payments'")
    .get() as { sql?: string } | undefined;
  const sql = String(row?.sql ?? '');
  if (!sql) return;
  if (sql.includes("'edahabia'") && sql.includes("'cib'")) return;

  const tx = database.transaction(() => {
    database.exec(`
      CREATE TABLE IF NOT EXISTS payments__new (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL,
        method TEXT NOT NULL CHECK(method IN ('cash','cib','edahabia','transfer','mixed')),
        amount REAL NOT NULL,
        details TEXT,
        created_at INTEGER NOT NULL,
        FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
      );
    `);

    database.exec(`
      INSERT INTO payments__new(id,order_id,method,amount,details,created_at)
      SELECT id, order_id,
        CASE
          WHEN method='card' THEN 'cib'
          ELSE method
        END as method,
        amount, details, created_at
      FROM payments;
    `);

    database.exec('DROP TABLE payments;');
    database.exec('ALTER TABLE payments__new RENAME TO payments;');
    database.exec('CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);');
  });

  tx();
}

function ensureUsersColumnsExpanded(database: Database.Database) {
  try {
    database.prepare('ALTER TABLE users ADD COLUMN active INTEGER NOT NULL DEFAULT 1').run();
  } catch {
    // ignore
  }

  try {
    database.prepare('ALTER TABLE users ADD COLUMN last_login INTEGER').run();
  } catch {
    // ignore
  }
}

function ensureUsersRolesExpanded(database: Database.Database) {
  const row = database
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'")
    .get() as { sql?: string } | undefined;
  const sql = String(row?.sql ?? '');
  if (!sql) return;
  // Only migrate legacy schemas that still enforce a fixed role CHECK constraint.
  // New schemas allow arbitrary role IDs (custom roles).
  if (!sql.includes('CHECK(role IN')) return;

  const hasActive = sql.includes('active');
  const hasLastLogin = sql.includes('last_login');

  const tx = database.transaction(() => {
    database.exec(`
      CREATE TABLE IF NOT EXISTS users__new (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1,
        last_login INTEGER,
        created_at INTEGER NOT NULL
      );
    `);

    database.exec(
      `
      INSERT INTO users__new(id, username, password_hash, role, active, last_login, created_at)
      SELECT id, username, password_hash,
        CASE
          WHEN role='employee' THEN 'employee'
          WHEN role='admin' THEN 'admin'
          ELSE 'employee'
        END as role,
        ${hasActive ? 'COALESCE(active, 1)' : '1'} as active,
        ${hasLastLogin ? 'last_login' : 'NULL'} as last_login,
        created_at
      FROM users;
    `
    );

    database.exec('DROP TABLE users;');
    database.exec('ALTER TABLE users__new RENAME TO users;');
  });

  tx();
}

function migrate() {
  const database = getDb();

  database.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      last_login INTEGER,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS roles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      permissions TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_roles_id ON roles(id);

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      sku TEXT UNIQUE,
      barcode TEXT,
      name TEXT NOT NULL,
      description TEXT,
      category_id TEXT,
      image_url TEXT,
      cost_price REAL NOT NULL DEFAULT 0,
      sale_price REAL NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
    CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
    CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);

    CREATE TABLE IF NOT EXISTS product_variants (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      size TEXT,
      color TEXT,
      barcode TEXT,
      sku TEXT,
      sale_price REAL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_variants_product_id ON product_variants(product_id);
    CREATE INDEX IF NOT EXISTS idx_variants_barcode ON product_variants(barcode);

    CREATE TABLE IF NOT EXISTS inventory (
      variant_id TEXT PRIMARY KEY,
      quantity INTEGER NOT NULL DEFAULT 0,
      low_stock_threshold INTEGER NOT NULL DEFAULT 2,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY(variant_id) REFERENCES product_variants(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_inventory_quantity ON inventory(quantity);

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      phone TEXT UNIQUE,
      email TEXT,
      notes TEXT,
      loyalty_points INTEGER NOT NULL DEFAULT 0,
      lifetime_spend_total REAL NOT NULL DEFAULT 0,
      vip INTEGER NOT NULL DEFAULT 0,
      vip_override_tier TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
    CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(full_name);

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      order_number TEXT NOT NULL UNIQUE,
      kind TEXT NOT NULL CHECK(kind IN ('sale','repair','reservation')),
      status TEXT NOT NULL,
      qr_token TEXT,
      customer_id TEXT,
      subtotal REAL NOT NULL DEFAULT 0,
      discount_total REAL NOT NULL DEFAULT 0,
      tax_total REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0,
      paid_total REAL NOT NULL DEFAULT 0,
      change_due REAL NOT NULL DEFAULT 0,
      profit_total REAL NOT NULL DEFAULT 0,
      notes TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
    CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
    CREATE INDEX IF NOT EXISTS idx_orders_kind ON orders(kind);
    CREATE INDEX IF NOT EXISTS idx_orders_qr_token ON orders(qr_token);
    -- Composite index: analytics queries filter by kind='sale' AND created_at range.
    -- SQLite can only use ONE index per scan; without this, it picks one and scans the rest.
    CREATE INDEX IF NOT EXISTS idx_orders_kind_created_at ON orders(kind, created_at);

    CREATE TABLE IF NOT EXISTS order_repairs (
      order_id TEXT PRIMARY KEY,
      title TEXT,
      due_at INTEGER,
      price_estimate REAL,
      FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      product_id TEXT,
      variant_id TEXT,
      name TEXT NOT NULL,
      size TEXT,
      color TEXT,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      unit_cost REAL NOT NULL DEFAULT 0,
      discount REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE SET NULL,
      FOREIGN KEY(variant_id) REFERENCES product_variants(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
    -- Needed by analytics best-sellers: JOINs order_items → products via product_id
    CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      method TEXT NOT NULL CHECK(method IN ('cash','cib','edahabia','transfer','mixed')),
      amount REAL NOT NULL,
      details TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);

    CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      address TEXT,
      notes TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);

    CREATE TABLE IF NOT EXISTS purchases (
      id TEXT PRIMARY KEY,
      supplier_id TEXT,
      invoice_number TEXT,
      subtotal REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0,
      notes TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY(supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_purchases_created_at ON purchases(created_at);

    CREATE TABLE IF NOT EXISTS purchase_items (
      id TEXT PRIMARY KEY,
      purchase_id TEXT NOT NULL,
      product_id TEXT,
      variant_id TEXT,
      name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_cost REAL NOT NULL,
      total REAL NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY(purchase_id) REFERENCES purchases(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase_id ON purchase_items(purchase_id);

    -- User profiles table
    CREATE TABLE IF NOT EXISTS user_profiles (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE,
      full_name TEXT,
      email TEXT,
      phone TEXT,
      avatar_url TEXT,
      language TEXT DEFAULT 'fr',
      theme TEXT DEFAULT 'light',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);

    -- Activity logs table
    CREATE TABLE IF NOT EXISTS activity_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      details TEXT,
      ip_address TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action);

    -- Store settings table
    CREATE TABLE IF NOT EXISTS store_settings (
      id TEXT PRIMARY KEY DEFAULT 'default',
      store_name TEXT NOT NULL DEFAULT 'La Vie En Rose 34',
      owner_name TEXT,
      store_logo TEXT,
      address TEXT,
      city TEXT,
      postal_code TEXT,
      phone TEXT,
      email TEXT,
      currency TEXT DEFAULT 'DZD',
      currency_symbol TEXT DEFAULT 'DA',
      tax_rate REAL DEFAULT 0,
      tax_label TEXT DEFAULT 'TVA',
      invoice_footer TEXT,
      qr_code_enabled INTEGER DEFAULT 1,
      business_hours TEXT,
      invoice_prefix TEXT DEFAULT 'LVR',
      auto_backup INTEGER DEFAULT 1,
      -- Algerian fiscal identifiers
      nif TEXT,
      nis TEXT,
      rc TEXT,
      art TEXT,
      article_tva TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    -- Notifications table
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT,
      read INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);

    -- Backups table
    CREATE TABLE IF NOT EXISTS backups (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      size INTEGER NOT NULL,
      type TEXT NOT NULL DEFAULT 'manual',
      created_at INTEGER NOT NULL,
      created_by TEXT,
      FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
    );
  `);

  try {
    const now = Date.now();
    database
      .prepare(
        `INSERT OR IGNORE INTO roles (id, name, permissions, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(
        'admin',
        'Admin',
        JSON.stringify([
          'manage_products',
          'manage_customers',
          'manage_suppliers',
          'access_analytics',
          'manage_users',
          'use_pos',
          'manage_settings',
          'view_activity',
          'manage_repairs',
          'manage_purchases',
        ]),
        now,
        now
      );

    database
      .prepare(
        `INSERT OR IGNORE INTO roles (id, name, permissions, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(
        'manager',
        'Manager',
        JSON.stringify([
          'manage_products',
          'manage_customers',
          'manage_suppliers',
          'access_analytics',
          'use_pos',
          'view_activity',
          'manage_repairs',
        ]),
        now,
        now
      );

    database
      .prepare(
        `INSERT OR IGNORE INTO roles (id, name, permissions, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(
        'employee',
        'Employee',
        JSON.stringify(['use_pos', 'manage_customers']),
        now,
        now
      );
  } catch {
    // ignore
  }

  const row = database.prepare("SELECT value FROM meta WHERE key='schema_version'").get() as
    | { value: string }
    | undefined;
  if (!row) {
    database
      .prepare('INSERT INTO meta(key,value) VALUES (?,?)')
      .run('schema_version', '1');
  }

  ensureDefaultAdmin(database);
  seedDemoData(database);
}

function ensureDefaultAdmin(database: Database.Database) {
  const existing = database.prepare('SELECT id FROM users LIMIT 1').get() as { id: string } | undefined;
  if (existing) return;

  const now = Date.now();
  const id = 'u_admin';
  const username = process.env.LVER_ADMIN_USER ?? 'admin';
  const passwordHash = process.env.LVER_ADMIN_PASS_HASH;

  if (!passwordHash) {
    // Create a temporary admin with password 'admin' only if hash not provided.
    // The app will force reset on first login later.
    const hash = bcrypt.hashSync('admin', 10);
    database
      .prepare('INSERT INTO users(id,username,password_hash,role,active,last_login,created_at) VALUES (?,?,?,?,?,?,?)')
      .run(id, username, hash, 'admin', 1, null, now);
    return;
  }

  database
    .prepare('INSERT INTO users(id,username,password_hash,role,active,last_login,created_at) VALUES (?,?,?,?,?,?,?)')
    .run(id, username, passwordHash, 'admin', 1, null, now);
}
