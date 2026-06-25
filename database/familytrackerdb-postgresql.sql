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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
