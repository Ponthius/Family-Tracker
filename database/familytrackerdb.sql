CREATE DATABASE familytrackerdb;
USE familytrackerdb;

CREATE TABLE Users (
    UserID INT IDENTITY(1,1) PRIMARY KEY,
    Username VARCHAR(50) NOT NULL UNIQUE,
    Email VARCHAR(100) NOT NULL UNIQUE,
    [Password] VARCHAR(255) NOT NULL, 
    UserRole VARCHAR(30) NOT NULL,
    CreatedAt DATETIME DEFAULT GETDATE()
);

CREATE TABLE Members (
    MemberID INT IDENTITY(1,1) PRIMARY KEY,
    FirstName VARCHAR(50) NOT NULL,
    LastName VARCHAR(50) NOT NULL,
    Relationship VARCHAR(50),
    Email VARCHAR(100),
    Phone VARCHAR(20),
    AddedByUserID INT FOREIGN KEY REFERENCES Users(UserID), 
    CreatedAt DATETIME DEFAULT GETDATE()
);

CREATE TABLE UpcomingEvents (
    UpcomingEventID INT IDENTITY(1,1) PRIMARY KEY,
    EventName VARCHAR(100) NOT NULL,
    [Description] VARCHAR(500), 
    EventDate DATETIME NOT NULL,
    MemberName VARCHAR(100) NOT NULL, 
    CreatedAt DATETIME DEFAULT GETDATE()
);

CREATE TABLE RecentEvents (
    RecentEventID INT IDENTITY(1,1) PRIMARY KEY,
    EventName VARCHAR(100) NOT NULL,
    [Description] VARCHAR(500),
    EventDate DATETIME NOT NULL,
    MemberName VARCHAR(100) NOT NULL,
    LoggedAt DATETIME DEFAULT GETDATE()
);

