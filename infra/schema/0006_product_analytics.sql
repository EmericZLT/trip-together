-- Events and business mutations commit together. No backdated historical events.
ALTER TABLE events ADD COLUMN created_by TEXT;
CREATE TABLE analytics_events (
 id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
 name TEXT NOT NULL,
 actor_id TEXT,
 entity_id TEXT,
 data TEXT NOT NULL DEFAULT '{}',
 created_at INTEGER NOT NULL DEFAULT (unixepoch()),
 delivered_at INTEGER,
 attempts INTEGER NOT NULL DEFAULT 0,
 next_attempt_at INTEGER NOT NULL DEFAULT 0,
 lease_until INTEGER NOT NULL DEFAULT 0,
 lease_token TEXT,
 last_status INTEGER
);
CREATE INDEX analytics_pending ON analytics_events(delivered_at,next_attempt_at,lease_until);
CREATE INDEX analytics_activity ON analytics_events(created_at,actor_id);
CREATE TABLE analytics_state (key TEXT PRIMARY KEY, value TEXT NOT NULL);
INSERT INTO analytics_state VALUES ('started_at',strftime('%Y-%m-%dT%H:%M:%SZ','now'));
CREATE TRIGGER analytics_registration AFTER INSERT ON members BEGIN
 INSERT INTO analytics_events(name,actor_id,entity_id) VALUES ('account_registered',NEW.id,NEW.id);
 INSERT INTO analytics_events(name,actor_id,entity_id) SELECT 'email_verified',NEW.id,NEW.id WHERE NEW.email_verified_at IS NOT NULL;
END;
CREATE TRIGGER analytics_verification AFTER UPDATE OF email_verified_at ON members WHEN OLD.email_verified_at IS NULL AND NEW.email_verified_at IS NOT NULL BEGIN
 INSERT INTO analytics_events(name,actor_id,entity_id) VALUES ('email_verified',NEW.id,NEW.id);
END;
CREATE TRIGGER analytics_session AFTER INSERT ON sessions BEGIN
 INSERT INTO analytics_events(name,actor_id) VALUES ('session_started',NEW.member_id);
END;
CREATE TRIGGER analytics_trip AFTER INSERT ON trips BEGIN
 INSERT INTO analytics_events(name,actor_id,entity_id) VALUES ('trip_created',NEW.owner_id,NEW.id);
END;
CREATE TRIGGER analytics_join AFTER INSERT ON trip_members WHEN NEW.member_id<>(SELECT owner_id FROM trips WHERE id=NEW.trip_id) BEGIN
 INSERT INTO analytics_events(name,actor_id,entity_id) VALUES ('trip_joined',NEW.member_id,NEW.trip_id);
 INSERT OR IGNORE INTO analytics_events(id,name,actor_id,entity_id)
 SELECT 'multiplayer:'||NEW.trip_id,'trip_became_multiplayer',NEW.member_id,NEW.trip_id
 WHERE (SELECT count(*) FROM trip_members WHERE trip_id=NEW.trip_id)=2;
END;
CREATE TRIGGER analytics_event AFTER INSERT ON events BEGIN
 INSERT INTO analytics_events(name,actor_id,entity_id,data) VALUES ('event_created',NEW.created_by,NEW.id,json_object('kind',json_extract(NEW.data,'$.kind')));
END;
CREATE TRIGGER analytics_document AFTER INSERT ON documents WHEN NEW.trip_id IS NOT NULL BEGIN
 INSERT INTO analytics_events(name,actor_id,entity_id,data) VALUES ('document_uploaded',NEW.uploaded_by,NEW.id,json_object('visibility',CASE WHEN NEW.owner_id IS NULL THEN 'shared' ELSE 'private' END,'format',CASE WHEN NEW.mime='application/pdf' THEN 'pdf' ELSE 'image' END));
END;
CREATE TRIGGER analytics_expense AFTER INSERT ON expenses BEGIN
 INSERT INTO analytics_events(name,actor_id,entity_id) VALUES ('expense_created',NEW.created_by,NEW.id);
END;
