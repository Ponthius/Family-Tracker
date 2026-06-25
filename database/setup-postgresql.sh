#!/bin/bash
# Family Tracker — PostgreSQL setup for Ubuntu/Debian (Contabo VPS)
# Run as root on the server: bash database/setup-postgresql.sh

set -e

echo "=== Installing PostgreSQL ==="
apt update -y
apt install postgresql postgresql-contrib -y

echo "=== Starting PostgreSQL ==="
systemctl start postgresql
systemctl enable postgresql

echo "=== Creating database user ==="
su - postgres -c "psql -c \"CREATE USER familytracker_user WITH PASSWORD 'familytracker_pass';\""
su - postgres -c "psql -c \"CREATE DATABASE familytrackerdb OWNER familytracker_user;\""
su - postgres -c "psql -c \"GRANT ALL PRIVILEGES ON DATABASE familytrackerdb TO familytracker_user;\""

echo "=== Importing schema ==="
# Copy the schema file to a location postgres can read
cp database/familytrackerdb-postgresql.sql /tmp/familytrackerdb-postgresql.sql
chmod 644 /tmp/familytrackerdb-postgresql.sql
su - postgres -c "psql -d familytrackerdb -f /tmp/familytrackerdb-postgresql.sql"
rm /tmp/familytrackerdb-postgresql.sql

echo "=== Allowing password auth for local connections ==="
# Update pg_hba.conf to allow password-based auth for local TCP
PG_HBA=$(su - postgres -c "psql -t -c 'SHOW hba_file;'" | xargs)
sed -i 's/^local\s\+all\s\+all\s\+peer/local   all             all                                     md5/' "$PG_HBA"
sed -i 's/^host\s\+all\s\+all\s\+127.0.0.1\/32\s\+scram-sha-256/host    all             all             127.0.0.1\/32            md5/' "$PG_HBA"
systemctl restart postgresql

echo ""
echo "=== Setup complete! ==="
echo "Database: familytrackerdb"
echo "User:     familytracker_user"
echo "Password: familytracker_pass"
echo ""
echo "To change the password, run:"
echo "  sudo -u postgres psql -c \"ALTER USER familytracker_user WITH PASSWORD 'newpass';\""
echo ""
echo "Then set these env vars when running the app:"
echo "  PGHOST=localhost"
echo "  PGPORT=5432"
echo "  PGDATABASE=familytrackerdb"
echo "  PGUSER=familytracker_user"
echo "  PGPASSWORD=familytracker_pass"
