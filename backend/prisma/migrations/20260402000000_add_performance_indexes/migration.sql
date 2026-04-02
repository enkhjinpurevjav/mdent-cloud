-- Add performance indexes for Appointment and Encounter models

-- Appointment: doctor + date (doctor portal day view queries)
CREATE INDEX "Appointment_doctorId_scheduledAt_idx" ON "Appointment"("doctorId", "scheduledAt");

-- Appointment: patient + date (patient profile appointment history)
CREATE INDEX "Appointment_patientId_scheduledAt_idx" ON "Appointment"("patientId", "scheduledAt");

-- Encounter: foreign key to Appointment (encounter lookups by appointment)
CREATE INDEX "Encounter_appointmentId_idx" ON "Encounter"("appointmentId");

-- Encounter: patient book + visit date (patient history ordered by date)
CREATE INDEX "Encounter_patientBookId_visitDate_idx" ON "Encounter"("patientBookId", "visitDate");
