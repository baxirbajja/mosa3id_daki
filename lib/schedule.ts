export const TZ = 'Africa/Casablanca';
export const SLOT_MINUTES = 60;
export const BOOKING_DAYS_AHEAD = 7;
export const OPEN_MINUTES = 10 * 60;
export const CLOSE_MINUTES = 22 * 60;

export function localDateString(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

export function datePlusDays(dateString: string, days: number): string {
  const [y, m, d] = dateString.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days, 12));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,'0')}-${String(date.getUTCDate()).padStart(2,'0')}`;
}

// Morocco uses DST rules; this iterative conversion maps a Casablanca wall-clock time to UTC.
export function casablancaLocalToUtc(date: string, time: string): string {
  const target = `${date}T${time}:00`;
  const [y, mo, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  let guess = Date.UTC(y, mo - 1, d, hh, mm);
  const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hourCycle:'h23' });
  for (let i=0;i<4;i++) {
    const parts = Object.fromEntries(fmt.formatToParts(new Date(guess)).map(p=>[p.type,p.value]));
    const represented = Date.UTC(Number(parts.year), Number(parts.month)-1, Number(parts.day), Number(parts.hour), Number(parts.minute));
    const wanted = Date.UTC(y, mo-1, d, hh, mm);
    const delta = wanted - represented;
    if (!delta) break;
    guess += delta;
  }
  return new Date(guess).toISOString();
}

export function weekdayForDate(date: string): number {
  const [y,m,d] = date.split('-').map(Number);
  // Noon UTC avoids most boundary issues when extracting the calendar weekday.
  return new Date(Date.UTC(y,m-1,d,12)).getUTCDay();
}
