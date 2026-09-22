-- =======================================================
-- Script: create_database.sql
-- Mục đích: Khởi tạo database và thiết lập mã hóa UTF-8
-- Dự án: Hotel Management System (Hệ thống Quản lý Khách sạn)
-- =======================================================

-- Dành cho PostgreSQL:
CREATE DATABASE hotel_db
    WITH 
    ENCODING = 'UTF8'
    LC_COLLATE = 'C'
    LC_CTYPE = 'C'
    TABLESPACE = pg_default
    CONNECTION LIMIT = -1;

COMMENT ON DATABASE hotel_db IS 'Cơ sở dữ liệu Hệ thống Quản lý Khách sạn';
