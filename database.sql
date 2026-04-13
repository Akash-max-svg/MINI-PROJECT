-- Cyber Threat Checker Database Schema
-- Execute this in MySQL Workbench

CREATE DATABASE IF NOT EXISTS cyber_threat_db;
USE cyber_threat_db;

-- Users table
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    age INT,
    phone VARCHAR(20),
    email VARCHAR(100) UNIQUE,
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Complaints table
CREATE TABLE complaints (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    age INT,
    address TEXT,
    mobile VARCHAR(20),
    type ENUM('cyber-fraud', 'harassment', 'phishing', 'identity-theft', 'other'),
    suspicious_number VARCHAR(20),
    complaint_text TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Threat reports table
CREATE TABLE threat_reports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    phone_number VARCHAR(20),
    url TEXT,
    threat_type VARCHAR(50),
    risk_score INT,
    status ENUM('Safe', 'Threat', 'Fraud', 'Harmful', 'Danger'),
    reported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);