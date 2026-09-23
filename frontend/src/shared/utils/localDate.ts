const twoDigits = (value: number) => String(value).padStart(2, "0");

/** Giá trị cho input[type=date] theo múi giờ trình duyệt, không bị lùi ngày do UTC. */
export const localDateValue = (value = new Date()) =>
  `${value.getFullYear()}-${twoDigits(value.getMonth() + 1)}-${twoDigits(value.getDate())}`;

/** Giá trị cho input[type=datetime-local] theo múi giờ trình duyệt. */
export const localDateTimeValue = (value = new Date(), includeSeconds = false) => {
  const base = `${localDateValue(value)}T${twoDigits(value.getHours())}:${twoDigits(value.getMinutes())}`;
  return includeSeconds ? `${base}:${twoDigits(value.getSeconds())}` : base;
};
