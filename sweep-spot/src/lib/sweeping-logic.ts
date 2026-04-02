export interface SweepingSchedule {
  weekday: string;
  fromhour: string;
  tohour: string;
  week1: string;
  week2: string;
  week3: string;
  week4: string;
  week5: string;
  cnn: string;
  cnnrightleft: string;
  blockside: string;
  holidays?: string;
}

export type SweepingStatus = 'RED' | 'ORANGE' | 'GREEN';

export interface StatusResult {
  status: SweepingStatus;
  message: string;
  nextDate: Date | null;
  window: string;
  countdown: string;
}

const SF_HOLIDAYS = [
  '2026-01-01', // New Year's
  '2026-01-19', // MLK
  '2026-02-16', // Presidents Day
  '2026-05-25', // Memorial Day
  '2026-06-19', // Juneteenth
  '2026-07-04', // July 4th
  '2026-09-07', // Labor Day
  '2026-10-12', // Indigenous Peoples Day
  '2026-11-11', // Veterans Day
  '2026-11-26', // Thanksgiving
  '2026-11-27', // Day after Thanksgiving
  '2026-12-25', // Christmas
];

function isHoliday(date: Date): boolean {
  const dateStr = date.toISOString().split('T')[0];
  return SF_HOLIDAYS.includes(dateStr);
}

function getWeekOfMonth(date: Date): number {
  const day = date.getDate();
  return Math.ceil(day / 7);
}

function normalizeWeekday(value: string): string {
  const normalized = value.trim().toLowerCase();
  const weekdayMap: Record<string, string> = {
    mon: 'monday',
    monday: 'monday',
    tue: 'tuesday',
    tues: 'tuesday',
    tuesday: 'tuesday',
    wed: 'wednesday',
    weds: 'wednesday',
    wednesday: 'wednesday',
    thu: 'thursday',
    thur: 'thursday',
    thurs: 'thursday',
    thursday: 'thursday',
    fri: 'friday',
    friday: 'friday',
    sat: 'saturday',
    saturday: 'saturday',
    sun: 'sunday',
    sunday: 'sunday',
    holiday: 'holiday',
  };

  return weekdayMap[normalized] || normalized;
}

function isWeekActive(schedule: SweepingSchedule, weekNum: number): boolean {
  const weekValue = (schedule as Record<string, string>)[`week${weekNum}`];
  return weekValue === 'Y' || weekValue === '1';
}

function parseHourString(value: string): [number, number] | null {
  if (!value) return null;
  if (value.includes(':')) {
    const [hours, minutes] = value.split(':').map(Number);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
    return [hours, minutes];
  }

  const hours = Number(value);
  if (Number.isNaN(hours)) return null;
  return [hours, 0];
}

export function calculateSweepingStatus(currentTime: Date, schedules: SweepingSchedule[]): StatusResult {
  try {
    if (!schedules || !Array.isArray(schedules) || schedules.length === 0) {
      return {
        status: 'GREEN',
        message: 'No sweeping scheduled',
        nextDate: null,
        window: 'N/A',
        countdown: ''
      };
    }

    const upcomingEvents: { date: Date; schedule: SweepingSchedule }[] = [];

    // Look ahead 31 days to be safe
    for (let i = 0; i < 31; i++) {
      const checkDate = new Date(currentTime);
      checkDate.setDate(currentTime.getDate() + i);
      
      if (isHoliday(checkDate)) continue;

      const dayName = normalizeWeekday(checkDate.toLocaleDateString('en-US', { weekday: 'long' }));
      const weekNum = getWeekOfMonth(checkDate);

      for (const sched of schedules) {
        const scheduleWeekday = normalizeWeekday(sched.weekday);

        if (scheduleWeekday === 'holiday') continue;
        if (scheduleWeekday === dayName) {
          const weekIsActive = isWeekActive(sched, weekNum);
          
          if (weekIsActive) {
            const fromTime = parseHourString(sched.fromhour);
            const toTime = parseHourString(sched.tohour);
            if (!fromTime || !toTime) continue;

            const [fromH, fromM] = fromTime;
            const [toH, toM] = toTime;

            const start = new Date(checkDate);
            start.setHours(fromH, fromM || 0, 0, 0);
            
            const end = new Date(checkDate);
            end.setHours(toH, toM || 0, 0, 0);

            if (i === 0 && currentTime > end) continue;

            upcomingEvents.push({ date: start, schedule: sched });
          }
        }
      }
    }

    if (upcomingEvents.length === 0) {
      return {
        status: 'GREEN',
        message: 'Safe for a while',
        nextDate: null,
        window: 'N/A',
        countdown: ''
      };
    }

    upcomingEvents.sort((a, b) => a.date.getTime() - b.date.getTime());
    const next = upcomingEvents[0];
    
    const diffMs = next.date.getTime() - currentTime.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    let status: SweepingStatus = 'GREEN';
    let message = 'Safe for a while';

    // Defensive check for next schedule end time
    const endTime = parseHourString(next.schedule.tohour);
    const toH = endTime ? endTime[0] : 0;
    const toM = endTime ? endTime[1] : 0;

    const nextEnd = new Date(next.date);
    nextEnd.setHours(toH, toM, 0, 0);

    if (currentTime >= next.date && currentTime <= nextEnd) {
      status = 'RED';
      message = 'Move Now (Cleaning In Progress)';
    } else if (diffHours <= 4) {
      status = 'RED';
      message = 'Move Today';
    } else if (diffHours <= 24) {
      status = 'ORANGE';
      message = 'Move Soon';
    }

    return {
      status,
      message,
      nextDate: next.date,
      window: `${next.schedule.weekday}, ${next.schedule.fromhour} - ${next.schedule.tohour}`,
      countdown: formatCountdown(diffMs)
    };
  } catch (err) {
    console.error('Error in calculateSweepingStatus:', err);
    return {
      status: 'GREEN',
      message: 'Error calculating status',
      nextDate: null,
      window: 'N/A',
      countdown: ''
    };
  }
}

function formatCountdown(ms: number): string {
  if (ms < 0) return "Now";
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 24) {
    return `${Math.floor(hours / 24)}d ${hours % 24}h`;
  }
  return `${hours}h ${mins}m`;
}
