-- MediCare Hospital Database Setup
-- Run this after connecting to the RDS instance

USE hospital_db;

-- Doctors table
CREATE TABLE doctors (
    doctor_id INT PRIMARY KEY AUTO_INCREMENT,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    specialty VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE,
    phone VARCHAR(20),
    hire_date DATE NOT NULL
);

-- Patients table
CREATE TABLE patients (
    patient_id INT PRIMARY KEY AUTO_INCREMENT,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    date_of_birth DATE NOT NULL,
    gender ENUM('M', 'F', 'Other') NOT NULL,
    phone VARCHAR(20),
    insurance_id VARCHAR(50),
    registered_date DATE NOT NULL
);

-- Appointments table (relates doctors and patients)
CREATE TABLE appointments (
    appointment_id INT PRIMARY KEY AUTO_INCREMENT,
    patient_id INT NOT NULL,
    doctor_id INT NOT NULL,
    appointment_date DATETIME NOT NULL,
    status ENUM('scheduled', 'completed', 'cancelled') DEFAULT 'scheduled',
    notes TEXT,
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id),
    FOREIGN KEY (doctor_id) REFERENCES doctors(doctor_id)
);

-- Prescriptions table
CREATE TABLE prescriptions (
    prescription_id INT PRIMARY KEY AUTO_INCREMENT,
    appointment_id INT NOT NULL,
    medication_name VARCHAR(100) NOT NULL,
    dosage VARCHAR(50) NOT NULL,
    duration_days INT NOT NULL,
    notes TEXT,
    FOREIGN KEY (appointment_id) REFERENCES appointments(appointment_id)
);

-- Seed data: Doctors
INSERT INTO doctors (first_name, last_name, specialty, email, phone, hire_date) VALUES
('David', 'Cohen', 'Cardiology', 'david.cohen@medicare.com', '054-1234567', '2020-03-15'),
('Sarah', 'Levi', 'Pediatrics', 'sarah.levi@medicare.com', '052-2345678', '2019-07-01'),
('Michael', 'Ben-Ari', 'Orthopedics', 'michael.benari@medicare.com', '050-3456789', '2021-01-10'),
('Noa', 'Friedman', 'Dermatology', 'noa.friedman@medicare.com', '053-4567890', '2022-06-20'),
('Yossi', 'Goldstein', 'General Practice', 'yossi.gold@medicare.com', '054-5678901', '2018-11-05');

-- Seed data: Patients
INSERT INTO patients (first_name, last_name, date_of_birth, gender, phone, insurance_id, registered_date) VALUES
('Amit', 'Shapira', '1985-04-12', 'M', '050-1111111', 'INS-1001', '2023-01-10'),
('Tamar', 'Avraham', '1992-08-25', 'F', '052-2222222', 'INS-1002', '2023-02-15'),
('Omer', 'Dahan', '1978-12-03', 'M', '054-3333333', 'INS-1003', '2023-03-20'),
('Maya', 'Katz', '2001-06-18', 'F', '053-4444444', 'INS-1004', '2023-04-05'),
('Eyal', 'Peretz', '1995-11-30', 'M', '050-5555555', 'INS-1005', '2023-05-12'),
('Shira', 'Mizrahi', '1988-02-14', 'F', '052-6666666', 'INS-1006', '2023-06-01'),
('Ron', 'Hadad', '1990-07-22', 'M', '054-7777777', 'INS-1007', '2023-07-18'),
('Neta', 'Schwartz', '2003-09-08', 'F', '053-8888888', 'INS-1008', '2023-08-25');

-- Seed data: Appointments
INSERT INTO appointments (patient_id, doctor_id, appointment_date, status, notes) VALUES
(1, 1, '2025-01-10 09:00:00', 'completed', 'Routine heart checkup'),
(2, 2, '2025-01-10 10:30:00', 'completed', 'Child vaccination'),
(3, 3, '2025-01-11 14:00:00', 'completed', 'Knee pain examination'),
(4, 4, '2025-01-12 11:00:00', 'completed', 'Skin rash consultation'),
(5, 5, '2025-01-13 09:30:00', 'completed', 'Annual physical exam'),
(1, 5, '2025-01-15 10:00:00', 'completed', 'Follow-up general check'),
(6, 1, '2025-01-16 15:00:00', 'completed', 'Heart palpitations'),
(7, 2, '2025-01-17 09:00:00', 'completed', 'Flu symptoms'),
(3, 3, '2025-01-18 13:00:00', 'completed', 'Knee MRI review'),
(8, 4, '2025-01-19 16:00:00', 'scheduled', 'Acne treatment follow-up'),
(2, 5, '2025-01-20 11:30:00', 'scheduled', 'Blood test results review'),
(5, 1, '2025-01-21 14:00:00', 'cancelled', 'Chest pain - patient cancelled');

-- Seed data: Prescriptions
INSERT INTO prescriptions (appointment_id, medication_name, dosage, duration_days, notes) VALUES
(1, 'Aspirin', '100mg daily', 30, 'Take with food'),
(1, 'Lisinopril', '10mg daily', 90, 'Blood pressure management'),
(3, 'Ibuprofen', '400mg twice daily', 14, 'For knee inflammation'),
(4, 'Hydrocortisone Cream', 'Apply twice daily', 21, 'Apply to affected area'),
(5, 'Vitamin D', '1000IU daily', 60, 'Supplement deficiency'),
(7, 'Metoprolol', '25mg daily', 30, 'Heart rate control'),
(8, 'Amoxicillin', '500mg three times daily', 7, 'Antibiotic for infection'),
(9, 'Physical Therapy', '3 sessions/week', 42, 'Knee rehabilitation');

-- Verify the data
SELECT 'Doctors' AS table_name, COUNT(*) AS row_count FROM doctors
UNION ALL
SELECT 'Patients', COUNT(*) FROM patients
UNION ALL
SELECT 'Appointments', COUNT(*) FROM appointments
UNION ALL
SELECT 'Prescriptions', COUNT(*) FROM prescriptions;
