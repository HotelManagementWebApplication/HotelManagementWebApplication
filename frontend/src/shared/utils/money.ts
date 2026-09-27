const finiteAmount = (value: number) => Number.isFinite(value) ? value : 0;

/** Hiển thị tiền Việt thống nhất: số trước, ký hiệu đồng sau. */
export const formatVnd = (value: number) =>
  `${Math.round(finiteAmount(value)).toLocaleString("vi-VN")} ₫`;

/** Chỉ định dạng phần số khi ô/bảng đã ghi rõ đơn vị VND ở tiêu đề. */
export const formatVndNumber = (value: number) =>
  Math.round(finiteAmount(value)).toLocaleString("vi-VN");

/** Hiển thị đúng đơn vị USD cho các hồ sơ có currency là "$". */
export const formatUsd = (value: number) =>
  finiteAmount(value).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
