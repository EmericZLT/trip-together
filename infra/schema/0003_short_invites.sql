ALTER TABLE trip_invites ADD COLUMN code TEXT;
DELETE FROM trip_invites WHERE rowid NOT IN (
  SELECT MAX(rowid) FROM trip_invites GROUP BY trip_id
);
CREATE UNIQUE INDEX trip_invites_trip ON trip_invites(trip_id);
CREATE UNIQUE INDEX trip_invites_code ON trip_invites(code);
