CREATE TABLE IF NOT EXISTS subscription_payment (
 id INTEGER PRIMARY KEY CHECK (id = 1),
 bank_name TEXT NOT NULL DEFAULT '',
 iban TEXT NOT NULL DEFAULT '',
 receipt_data TEXT,
 receipt_mime TEXT,
 receipt_uploaded_at TEXT,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT OR IGNORE INTO subscription_payment (id,bank_name,iban) VALUES (1,'','');
