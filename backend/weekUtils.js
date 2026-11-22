const DAY = 86_400_000;
const zone = "Europe/Istanbul";
const formatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit",
});

const offsetFormatter = new Intl.DateTimeFormat("en", {
  timeZone: zone, timeZoneName: "longOffset",
});

function istanbulMidnight(date) {
  const utc = Date.parse(date + "T00:00:00Z");
  const offset = offsetFormatter.formatToParts(utc).find(part => part.type === "timeZoneName").value;
  const [, sign, hours, minutes, seconds = 0] = /GMT([+-])(\d{2}):(\d{2})(?::(\d{2}))?/.exec(offset);
  const millis = (Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds)) * 1000;
  return new Date(utc - (sign === "+" ? millis : -millis)).toISOString();
}

function currentMonday(now = new Date()) {
  const localDate = new Date(formatter.format(now) + "T00:00:00Z");
  const offset = (localDate.getUTCDay() + 6) % 7;
  return new Date(localDate.getTime() - offset * DAY).toISOString().slice(0, 10);
}

function weekBounds(date) {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const day = new Date(date + "T00:00:00Z");
  if (!Number.isFinite(+day) || day.toISOString().slice(0, 10) !== date || day.getUTCDay() !== 1) return null;
  const next = new Date(+day + 7 * DAY).toISOString().slice(0, 10);
  if (next.length !== 10) return null;
  return [date, next].map(istanbulMidnight);
}

module.exports = { currentMonday, weekBounds };
