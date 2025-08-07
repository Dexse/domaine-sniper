const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
  constructor() {
    this.db = new sqlite3.Database(path.join(__dirname, 'domaine_sniper.db'));
    this.init();
  }

  init() {
    // Table des domaines
    this.db.run(`
      CREATE TABLE IF NOT EXISTS domains (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        domain TEXT UNIQUE NOT NULL,
        monitoring_enabled BOOLEAN DEFAULT 1,
        auto_purchase_enabled BOOLEAN DEFAULT 0,
        status TEXT DEFAULT 'pending',
        expiry_date TEXT,
        estimated_release_date TEXT,
        days_until_expiry INTEGER,
        registrar TEXT,
        last_check DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Table des vérifications (historique)
    this.db.run(`
      CREATE TABLE IF NOT EXISTS domain_checks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        domain_id INTEGER,
        status TEXT NOT NULL,
        available BOOLEAN,
        check_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        notes TEXT,
        FOREIGN KEY (domain_id) REFERENCES domains (id)
      )
    `);

    // Table des achats
    this.db.run(`
      CREATE TABLE IF NOT EXISTS purchases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        domain_id INTEGER,
        domain_name TEXT NOT NULL,
        order_id TEXT,
        purchase_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'pending',
        price DECIMAL(10,2),
        notes TEXT,
        FOREIGN KEY (domain_id) REFERENCES domains (id)
      )
    `);

    // Table des logs système
    this.db.run(`
      CREATE TABLE IF NOT EXISTS system_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        level TEXT NOT NULL,
        message TEXT NOT NULL,
        domain TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  // Méthodes pour les domaines
  addDomain(domain, monitoringEnabled = true, autoPurchaseEnabled = false) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT INTO domains (domain, monitoring_enabled, auto_purchase_enabled) VALUES (?, ?, ?)',
        [domain, monitoringEnabled, autoPurchaseEnabled],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  }

  getAllDomains() {
    return new Promise((resolve, reject) => {
      this.db.all('SELECT * FROM domains ORDER BY created_at DESC', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  updateDomainSettings(id, monitoringEnabled, autoPurchaseEnabled) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'UPDATE domains SET monitoring_enabled = ?, auto_purchase_enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [monitoringEnabled, autoPurchaseEnabled, id],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  updateDomainStatus(id, status, lastCheck = new Date()) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'UPDATE domains SET status = ?, last_check = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [status, lastCheck, id],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  updateDomainExpirationInfo(id, expiryDate, estimatedReleaseDate, daysUntilExpiry, registrar) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `UPDATE domains SET 
         expiry_date = ?, 
         estimated_release_date = ?, 
         days_until_expiry = ?, 
         registrar = ?, 
         updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [expiryDate, estimatedReleaseDate, daysUntilExpiry, registrar, id],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }
  deleteDomain(id) {
    return new Promise((resolve, reject) => {
      this.db.run('DELETE FROM domains WHERE id = ?', [id], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  // Méthodes pour les vérifications
  addDomainCheck(domainId, status, available, notes = null) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT INTO domain_checks (domain_id, status, available, notes) VALUES (?, ?, ?, ?)',
        [domainId, status, available, notes],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  }

  getDomainChecks(domainId, limit = 50) {
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT * FROM domain_checks WHERE domain_id = ? ORDER BY check_date DESC LIMIT ?',
        [domainId, limit],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  getAnalyticsData(startDate, endDate) {
    return new Promise((resolve, reject) => {
      this.db.all(`
        SELECT 
          DATE(dc.check_date) as date,
          COUNT(*) as total_checks,
          SUM(CASE WHEN dc.available = 1 THEN 1 ELSE 0 END) as available_count,
          SUM(CASE WHEN dc.status = 'error' THEN 1 ELSE 0 END) as error_count
        FROM domain_checks dc
        WHERE DATE(dc.check_date) BETWEEN ? AND ?
        GROUP BY DATE(dc.check_date)
        ORDER BY date DESC
      `, [startDate, endDate], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  // Méthodes pour les achats
  addPurchase(domainId, domainName, orderId, status = 'pending', price = null, notes = null) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT INTO purchases (domain_id, domain_name, order_id, status, price, notes) VALUES (?, ?, ?, ?, ?, ?)',
        [domainId, domainName, orderId, status, price, notes],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  }

  getAllPurchases() {
    return new Promise((resolve, reject) => {
      this.db.all(`
        SELECT p.*, d.domain as domain_name_ref
        FROM purchases p
        LEFT JOIN domains d ON p.domain_id = d.id
        ORDER BY p.purchase_date DESC
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  // Méthodes pour les logs
  addLog(level, message, domain = null) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT INTO system_logs (level, message, domain) VALUES (?, ?, ?)',
        [level, message, domain],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  }

  getRecentLogs(limit = 100) {
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT * FROM system_logs ORDER BY created_at DESC LIMIT ?',
        [limit],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  close() {
    this.db.close();
  }
}

module.exports = Database;
