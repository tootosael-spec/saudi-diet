-- Set the confirmed store WhatsApp number for direct order forwarding.
INSERT INTO settings(key,value) VALUES('whatsapp','96653243108')
ON CONFLICT(key) DO UPDATE SET value=excluded.value;
