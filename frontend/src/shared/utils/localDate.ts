const twoDigits = (value: number) => String(value).padStart(2, "0");

/** Giá trị cho input[type=date] theo múi giờ trình duyệt, không bị lùi ngày do UTC. */
export const localDateValue = (value = new Date()) =>
  `${value.getFullYear()}-${twoDigits(value.getMonth() + 1)}-${twoDigits(value.getDate())}`;

/** Giá trị cho input[type=datetime-local] theo múi giờ trình duyệt. */
export const localDateTimeValue = (value = new Date(), includeSeconds = false) => {
  const base = `${localDateValue(value)}T${twoDigits(value.getHours())}:${twoDigits(value.getMinutes())}`;
  return includeSeconds ? `${base}:${twoDigits(value.getSeconds())}` : base;
};

/** Parse ngày thuần và LocalDateTime của API theo giờ địa phương thay vì coi ngày thuần là UTC. */
export const parseApiDate = (value: string) => {
  const local = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?$/.exec(value);
  if (local) {
    return new Date(
      Number(local[1]),
      Number(local[2]) - 1,
      Number(local[3]),
      Number(local[4] ?? 0),
      Number(local[5] ?? 0),
      Number(local[6] ?? 0),
    );
  }
  return new Date(value);
};

export const formatDateVi = (value?: string | null) => {
  if (!value) return "—";
  const date = parseApiDate(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return `${twoDigits(date.getDate())}/${twoDigits(date.getMonth() + 1)}/${date.getFullYear()}`;
};

export const formatDateTimeVi = (value?: string | null) => {
  if (!value) return "—";
  const date = parseApiDate(value);
  if (Number.isNaN(date.getTime())) return value.replace("T", " ").slice(0, 16);
  return `${twoDigits(date.getHours())}:${twoDigits(date.getMinutes())}, ${formatDateVi(value)}`;
};
