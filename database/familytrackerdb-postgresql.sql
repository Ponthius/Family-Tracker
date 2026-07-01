-- Family Tracker PostgreSQL Schema
-- Run: psql -U familytracker_user -d familytrackerdb -f familytrackerdb-postgresql.sql

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(100) UNIQUE NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL,
    fullname VARCHAR(100),
    profile_photo TEXT,
    emailverified BOOLEAN DEFAULT FALSE,
    is_super_admin BOOLEAN DEFAULT FALSE,
    family_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS EmailVerifications (
    VerificationID SERIAL PRIMARY KEY,
    UserID INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    VerificationToken VARCHAR(255) NOT NULL UNIQUE,
    ExpiresAt TIMESTAMP NOT NULL,
    VerifiedAt TIMESTAMP,
    isActive BOOLEAN DEFAULT TRUE,
    CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Members (
    MemberID SERIAL PRIMARY KEY,
    FirstName VARCHAR(50) NOT NULL,
    LastName VARCHAR(50) NOT NULL,
    Relationship VARCHAR(50),
    Email VARCHAR(100),
    Phone VARCHAR(20),
    AddedByUserID INT REFERENCES users(id),
    CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS UpcomingEvents (
    UpcomingEventID SERIAL PRIMARY KEY,
    EventName VARCHAR(100) NOT NULL,
    Description VARCHAR(500),
    EventDate TIMESTAMP NOT NULL,
    MemberName VARCHAR(100) NOT NULL,
    CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS RecentEvents (
    RecentEventID SERIAL PRIMARY KEY,
    EventName VARCHAR(100) NOT NULL,
    Description VARCHAR(500),
    EventDate TIMESTAMP NOT NULL,
    MemberName VARCHAR(100) NOT NULL,
    LoggedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Tasks (
    TaskID SERIAL PRIMARY KEY,
    Role VARCHAR(20) NOT NULL,
    Username VARCHAR(50) NOT NULL,
    TaskName VARCHAR(200) NOT NULL,
    Description VARCHAR(500),
    TaskDate DATE NOT NULL,
    TaskTime TIME NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    AssignedBy INT,
    AssignedByName VARCHAR(50),
    CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS families (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    admin_id INT REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Active',
    language VARCHAR(10) DEFAULT 'en',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50),
    user_role VARCHAR(20),
    action VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Success',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS invitations (
    id SERIAL PRIMARY KEY,
    email VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL,
    family_id INT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    accepted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS DeletedAccounts (
    id SERIAL PRIMARY KEY,
    username_hash VARCHAR(64) NOT NULL UNIQUE,
    deleted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS FamilyInvitations (
    id SERIAL PRIMARY KEY,
    family_id INT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    recipient_email VARCHAR(100) NOT NULL,
    token VARCHAR(255) NOT NULL UNIQUE,
    invited_by INT REFERENCES users(id),
    is_active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMP NOT NULL,
    accepted_at TIMESTAMP,
    accepted_by INT REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
