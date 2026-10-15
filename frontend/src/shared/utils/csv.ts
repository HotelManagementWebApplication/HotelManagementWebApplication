/** UTF-8 CSV readable by Excel, with user-entered cells kept as text. */
export function downloadCsv(filename: string, rows: (string | number | null | undefined)[][]) {
  const csv = rows.map(row => row.map(value => {
    const text = String(value ?? "");
    const safe = /^[=+@\-\t\r]/.test(text) ? `'${text}` : text;
    return `"${safe.replace(/"/g, '""')}"`;
  }).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = [], cell = "", quoted = false;
  const source = text.replace(/^\uFEFF/, "");
  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    if (char === '"') {
      if (quoted && source[index + 1] === '"') { cell += '"'; index++; }
      else quoted = !quoted;
    } else if (char === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      row.push(cell); if (row.some(value => value.trim())) rows.push(row); row = []; cell = "";
      if (char === "\r" && source[index + 1] === "\n") index++;
    } else cell += char;
  }
  if (quoted) throw new Error("File CSV có dấu ngoặc kép chưa đóng.");
  row.push(cell); if (row.some(value => value.trim())) rows.push(row);
  return rows;
}
