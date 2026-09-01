/**
 * Date formatting for values coming out of Documentum.
 *
 * The Admin Portal reads the repository through the xCP REST API, which returns
 * ISO-8601 in UTC — e.g. "2026-09-01T11:32:40.000+00:00". Rendering that with a
 * bare `new Date(x).toLocaleString()` works, but produces a locale-dependent
 * string that differs between machines and does not match the format used
 * elsewhere in the NABARD applications.
 *
 * These helpers render a single, explicit format instead:
 *
 *     16/01/2026 05:44:00 PM
 *
 * Day and month are zero-padded, the year is four digits, the clock is 12-hour
 * with a zero-padded hour, and the meridiem is upper-case.
 */

const PAD = (n) => String(n).padStart(2, "0");

/**
 * Parses a Documentum date value.
 *
 * Handles two shapes:
 *  - ISO-8601, with or without an offset — what xCP REST returns. Parsed as an
 *    absolute instant.
 *  - "D/M/YYYY h:mm:ss AM/PM" — what DFC-backed paths return. Parsed
 *    day-first; `new Date()` would read this as M/D/YYYY and silently swap day
 *    and month whenever the day is <= 12, so it must be handled before falling
 *    back to native parsing.
 *
 * @param {string|number|Date} value
 * @returns {Date|null} null when the value is empty or unparseable
 */
export const parseDocumentumDate = (value) => {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;

  const raw = String(value).trim();
  if (!raw || raw.toLowerCase() === "nulldate") return null;

  // Day-first with a 12-hour clock, e.g. "16/1/2026 5:44:00 PM".
  const dayFirst = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (dayFirst) {
    const [, dd, mm, yyyy, hh, min, sec, period] = dayFirst;
    let hours = parseInt(hh, 10);
    if (period.toUpperCase() === "PM" && hours !== 12) hours += 12;
    if (period.toUpperCase() === "AM" && hours === 12) hours = 0;
    return new Date(
      parseInt(yyyy, 10),
      parseInt(mm, 10) - 1,
      parseInt(dd, 10),
      hours,
      parseInt(min, 10),
      sec ? parseInt(sec, 10) : 0,
    );
  }

  // Day-first on a 24-hour clock, e.g. "16/1/2026 17:44:00".
  const dayFirst24 = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (dayFirst24) {
    const [, dd, mm, yyyy, hh, min, sec] = dayFirst24;
    return new Date(
      parseInt(yyyy, 10),
      parseInt(mm, 10) - 1,
      parseInt(dd, 10),
      parseInt(hh, 10),
      parseInt(min, 10),
      sec ? parseInt(sec, 10) : 0,
    );
  }

  const native = new Date(raw);
  return isNaN(native.getTime()) ? null : native;
};

/**
 * "16/01/2026 05:44:00 PM"
 *
 * @param {string|number|Date} value
 * @param {string} [fallback="—"] returned when the value is missing or unparseable
 */
export const formatDateTime = (value, fallback = "—") => {
  const d = parseDocumentumDate(value);
  if (!d) return fallback;

  const meridiem = d.getHours() >= 12 ? "PM" : "AM";
  const hours12 = d.getHours() % 12 || 12;

  return (
    `${PAD(d.getDate())}/${PAD(d.getMonth() + 1)}/${d.getFullYear()} ` +
    `${PAD(hours12)}:${PAD(d.getMinutes())}:${PAD(d.getSeconds())} ${meridiem}`
  );
};

/** "16/01/2026" — date only, same conventions. */
export const formatDateOnly = (value, fallback = "—") => {
  const d = parseDocumentumDate(value);
  if (!d) return fallback;
  return `${PAD(d.getDate())}/${PAD(d.getMonth() + 1)}/${d.getFullYear()}`;
};
