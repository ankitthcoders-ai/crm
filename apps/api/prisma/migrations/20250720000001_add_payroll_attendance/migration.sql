-- AlterTable: Add attendance tracking fields to payrolls
ALTER TABLE `payrolls`
  ADD COLUMN `working_days` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `present_days` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `absent_days` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `unpaid_leave_days` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `late_days` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `payable_days` DECIMAL(12, 2) NOT NULL DEFAULT 0;
