IF DB_ID('familytrackerdb') IS NULL
    CREATE DATABASE familytrackerdb;


USE familytrackerdb;

IF OBJECT_ID('dbo.users', 'U') IS NULL
CREATE TABLE dbo.users (
    id INT IDENTITY(1,1) PRIMARY KEY,
    email NVARCHAR(100) UNIQUE NOT NULL,
    username NVARCHAR(50) UNIQUE NOT NULL,
    password NVARCHAR(100) NOT NULL,
    role NVARCHAR(20) NOT NULL,
    created_at DATETIME DEFAULT GETDATE()
);

-- Add profile columns if they don't exist (safe for existing databases)
IF COL_LENGTH('dbo.users', 'fullname') IS NULL
    ALTER TABLE dbo.users ADD fullname NVARCHAR(100);

IF COL_LENGTH('dbo.users', 'profile_photo') IS NULL
    ALTER TABLE dbo.users ADD profile_photo NVARCHAR(MAX);
GO


IF OBJECT_ID('dbo.Members', 'U') IS NULL
CREATE TABLE dbo.Members (
    MemberID INT IDENTITY(1,1) PRIMARY KEY,
    FirstName VARCHAR(50) NOT NULL,
    LastName VARCHAR(50) NOT NULL,
    Relationship VARCHAR(50),
    Email VARCHAR(100),
    Phone VARCHAR(20),
    AddedByUserID INT FOREIGN KEY REFERENCES dbo.users(id),
    CreatedAt DATETIME DEFAULT GETDATE()
);

IF OBJECT_ID('dbo.UpcomingEvents', 'U') IS NULL
CREATE TABLE dbo.UpcomingEvents (
    UpcomingEventID INT IDENTITY(1,1) PRIMARY KEY,
    EventName VARCHAR(100) NOT NULL,
    [Description] VARCHAR(500), 
    EventDate DATETIME NOT NULL,
    MemberName VARCHAR(100) NOT NULL, 
    CreatedAt DATETIME DEFAULT GETDATE()
);

IF OBJECT_ID('dbo.RecentEvents', 'U') IS NULL
CREATE TABLE dbo.RecentEvents (
    RecentEventID INT IDENTITY(1,1) PRIMARY KEY,
    EventName VARCHAR(100) NOT NULL,
    [Description] VARCHAR(500),
    EventDate DATETIME NOT NULL,
    MemberName VARCHAR(100) NOT NULL,
    LoggedAt DATETIME DEFAULT GETDATE()
);

IF OBJECT_ID('dbo.Tasks', 'U') IS NULL
CREATE TABLE dbo.Tasks (
    TaskID INT IDENTITY(1,1) PRIMARY KEY,
    Role NVARCHAR(20) NOT NULL,
    Username NVARCHAR(50) NOT NULL,
    TaskName NVARCHAR(200) NOT NULL,
    [Description] NVARCHAR(500),
    TaskDate DATE NOT NULL,
    TaskTime TIME NOT NULL,
    status NVARCHAR(20) NOT NULL DEFAULT 'pending',
    AssignedBy INT,
    AssignedByName NVARCHAR(50),
    CreatedAt DATETIME DEFAULT GETDATE()
);

