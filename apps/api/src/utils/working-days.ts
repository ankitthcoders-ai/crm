export interface HolidayData {
  date: Date;
  isOptional: boolean;
}

/**
 * Calculate the number of working days in a given month/year.
 * Excludes weekends (based on workDays array) and company holidays.
 *
 * workDays format: 0=Sunday, 1=Monday, ..., 6=Saturday
 * Default: [1,2,3,4,5] = Monday to Friday
 */
export function getWorkingDaysInMonth(
  year: number,
  month: number,
  workDays: number[] = [1, 2, 3, 4, 5],
  holidays: HolidayData[] = []
): number {
  let count = 0;
  const daysInMonth = new Date(year, month, 0).getDate();

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month - 1, day);
    const dow = date.getDay();

    if (!workDays.includes(dow)) continue;

    const isHoliday = holidays.some((h) => {
      const hd = new Date(h.date);
      return (
        hd.getFullYear() === year &&
        hd.getMonth() === month - 1 &&
        hd.getDate() === day
      );
    });

    if (!isHoliday) count++;
  }

  return count;
}

/**
 * Calculate per-day salary from monthly base salary.
 */
export function calcPerDaySalary(monthlySalary: number, workingDays: number): number {
  if (workingDays <= 0) return 0;
  return Math.round((monthlySalary / workingDays) * 100) / 100;
}

/**
 * Get the start and end dates for a given month/year.
 */
export function getMonthDateRange(year: number, month: number): { startDate: Date; endDate: Date } {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  return { startDate, endDate };
}
