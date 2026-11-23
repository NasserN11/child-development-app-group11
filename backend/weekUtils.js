const DAY = 86_400_000;
const zone = "Europe/Istanbul";
const formatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit",
});

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
  // Istanbul has observed UTC+03:00 year-round since September 2016.
  return [date, next].map(value => new Date(value + "T00:00:00+03:00").toISOString());
}

module.exports = { currentMonday, weekBounds };
