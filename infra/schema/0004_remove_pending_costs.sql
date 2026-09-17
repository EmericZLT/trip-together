-- Preserve paid expenses and source documents before removing the import-only workflow.
ALTER TABLE expenses ADD COLUMN source_document_id TEXT REFERENCES documents(id) ON DELETE SET NULL;
UPDATE expenses SET source_document_id = (SELECT document_id FROM pending_costs WHERE id = expenses.pending_id);
DROP INDEX expenses_pending_once;
ALTER TABLE expenses DROP COLUMN pending_id;
DROP TABLE pending_costs;
DELETE FROM email_verifications WHERE purpose = 'login';
