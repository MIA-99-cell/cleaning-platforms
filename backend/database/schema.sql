-- Multi-Tenant Cleaning Platform Database Schema
-- Compatible with MySQL (XAMPP) - easy migration to PostgreSQL/Supabase later

CREATE DATABASE IF NOT EXISTS cleaning_platform;
USE cleaning_platform;

-- Super Admin
CREATE TABLE IF NOT EXISTS super_admin (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  is_active BOOLEAN DEFAULT TRUE,
  last_login DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Tenants (Cleaning Companies - account level)
CREATE TABLE IF NOT EXISTS tenants (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  email_verified BOOLEAN DEFAULT FALSE,
  email_verification_token VARCHAR(255),
  email_verification_expires DATETIME,
  status ENUM('pending', 'approved', 'suspended', 'rejected') DEFAULT 'pending',
  admin_approval_token VARCHAR(255),
  admin_approval_token_expires DATETIME,
  is_active BOOLEAN DEFAULT TRUE,
  last_login DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Companies (tenant company profile)
CREATE TABLE IF NOT EXISTS companies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  company_name VARCHAR(255) NOT NULL,
  logo_url VARCHAR(500),
  address TEXT,
  phone VARCHAR(50),
  email VARCHAR(255),
  working_hours JSON,
  license_number VARCHAR(100),
  description TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  rating DECIMAL(3, 2) DEFAULT 0.00,
  total_reviews INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  INDEX idx_tenant_id (tenant_id)
);

-- Cleaners
CREATE TABLE IF NOT EXISTS cleaners (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  photo_url VARCHAR(500),
  status ENUM('active', 'suspended', 'inactive') DEFAULT 'active',
  must_change_password BOOLEAN DEFAULT TRUE,
  availability JSON,
  performance_rating DECIMAL(3, 2) DEFAULT 0.00,
  total_jobs_completed INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  last_login DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  UNIQUE KEY unique_tenant_email (tenant_id, email),
  INDEX idx_tenant_id (tenant_id)
);

-- Customers
CREATE TABLE IF NOT EXISTS customers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  address TEXT,
  is_blacklisted BOOLEAN DEFAULT FALSE,
  blacklist_reason TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  last_login DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tenant_id (tenant_id),
  INDEX idx_email (email)
);

-- Services
CREATE TABLE IF NOT EXISTS services (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 60,
  image_url VARCHAR(500),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  INDEX idx_tenant_id (tenant_id)
);

-- Booking status lookup
CREATE TABLE IF NOT EXISTS booking_status (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  description VARCHAR(255)
);

-- Bookings
CREATE TABLE IF NOT EXISTS bookings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  customer_id INT NOT NULL,
  service_id INT NOT NULL,
  status_id INT NOT NULL DEFAULT 1,
  scheduled_date DATE NOT NULL,
  scheduled_time TIME NOT NULL,
  address TEXT NOT NULL,
  special_instructions TEXT,
  total_amount DECIMAL(10, 2) NOT NULL,
  rejection_reason TEXT,
  cancellation_reason TEXT,
  completed_at DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (service_id) REFERENCES services(id),
  FOREIGN KEY (status_id) REFERENCES booking_status(id),
  INDEX idx_tenant_id (tenant_id),
  INDEX idx_customer_id (customer_id),
  INDEX idx_status_id (status_id),
  INDEX idx_scheduled_date (scheduled_date)
);

-- Cleaner assignments
CREATE TABLE IF NOT EXISTS cleaner_assignments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  booking_id INT NOT NULL,
  cleaner_id INT NOT NULL,
  status ENUM('assigned', 'accepted', 'rejected', 'in_progress', 'completed') DEFAULT 'assigned',
  notes TEXT,
  completion_photo_url VARCHAR(500),
  started_at DATETIME,
  completed_at DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  FOREIGN KEY (cleaner_id) REFERENCES cleaners(id),
  UNIQUE KEY unique_booking_cleaner (booking_id, cleaner_id),
  INDEX idx_tenant_id (tenant_id),
  INDEX idx_cleaner_id (cleaner_id)
);

-- Payments
CREATE TABLE IF NOT EXISTS payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  booking_id INT NOT NULL,
  customer_id INT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  payment_method ENUM('mobile_money', 'card', 'cash', 'bank_transfer', 'flutterwave') NOT NULL,
  status ENUM('pending', 'confirmed', 'successful', 'failed', 'refunded') DEFAULT 'pending',
  transaction_ref VARCHAR(255),
  flw_charge_id VARCHAR(100),
  confirmed_at DATETIME,
  confirmed_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (booking_id) REFERENCES bookings(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  INDEX idx_tenant_id (tenant_id),
  INDEX idx_booking_id (booking_id)
);

-- Invoices
CREATE TABLE IF NOT EXISTS invoices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  booking_id INT NOT NULL,
  payment_id INT,
  invoice_number VARCHAR(50) NOT NULL UNIQUE,
  amount DECIMAL(10, 2) NOT NULL,
  status ENUM('draft', 'sent', 'paid', 'cancelled') DEFAULT 'draft',
  issued_at DATETIME,
  due_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (booking_id) REFERENCES bookings(id),
  FOREIGN KEY (payment_id) REFERENCES payments(id),
  INDEX idx_tenant_id (tenant_id)
);

-- Reviews
CREATE TABLE IF NOT EXISTS reviews (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  booking_id INT NOT NULL,
  customer_id INT NOT NULL,
  cleaner_id INT,
  company_rating INT NOT NULL CHECK (company_rating BETWEEN 1 AND 5),
  cleaner_rating INT CHECK (cleaner_rating BETWEEN 1 AND 5),
  comment TEXT,
  tenant_reply TEXT,
  is_visible BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (booking_id) REFERENCES bookings(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (cleaner_id) REFERENCES cleaners(id),
  UNIQUE KEY unique_booking_review (booking_id),
  INDEX idx_tenant_id (tenant_id)
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT,
  user_type ENUM('super_admin', 'tenant', 'cleaner', 'customer', 'all') NOT NULL,
  user_id INT,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type ENUM('info', 'success', 'warning', 'error', 'announcement') DEFAULT 'info',
  is_read BOOLEAN DEFAULT FALSE,
  link VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_tenant_user (tenant_id, user_type, user_id),
  INDEX idx_is_read (is_read)
);

-- Activity logs
CREATE TABLE IF NOT EXISTS activity_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT,
  user_type ENUM('super_admin', 'tenant', 'cleaner', 'customer') NOT NULL,
  user_id INT NOT NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id INT,
  details JSON,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_tenant_id (tenant_id),
  INDEX idx_user (user_type, user_id),
  INDEX idx_created_at (created_at)
);

-- Password resets
CREATE TABLE IF NOT EXISTS password_resets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_type ENUM('super_admin', 'tenant', 'cleaner', 'customer') NOT NULL,
  user_id INT NOT NULL,
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_token (token),
  INDEX idx_user (user_type, user_id)
);

-- Insert default booking statuses
INSERT INTO booking_status (name, description) VALUES
  ('pending', 'Awaiting tenant approval'),
  ('accepted', 'Booking accepted by tenant'),
  ('rejected', 'Booking rejected by tenant'),
  ('assigned', 'Cleaner assigned'),
  ('in_progress', 'Cleaning in progress'),
  ('completed', 'Service completed'),
  ('cancelled', 'Booking cancelled')
ON DUPLICATE KEY UPDATE name = name;
