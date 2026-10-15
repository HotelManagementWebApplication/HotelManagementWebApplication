import React from "react";
import { Printer, X } from "lucide-react";
import type { Room as ApiRoom, HousekeepingTask } from "../../shared/types/housekeepingTechnical";

export interface AcceptanceFormOptions {
  roomNumber: string;
  roomType?: string;
  floor?: number;
  taskId?: string | number;
  cleanerName?: string;
  managerName?: string;
  inspectionTime?: string;
  dateStr?: string;
  voucherCode?: string;
  hasBlockingIncident?: boolean;
  isOccupied?: boolean;
  hasIncompleteChecklist?: boolean;
}

export function generateAcceptanceHtml(opts: AcceptanceFormOptions): string {
  const now = new Date();
  const dateStr = opts.dateStr || `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
  const inspectionTime = opts.inspectionTime || now.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  const voucherCode = opts.voucherCode || `SC-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${opts.roomNumber}`;
  const reportCode = `BB-NT-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}-${opts.roomNumber}`;
  const taskCode = opts.taskId ? `NVBP-${opts.taskId}` : `NVBP-${opts.roomNumber}`;
  const cleaner = opts.cleanerName || "Trần Thị Buồng Phòng";
  const manager = opts.managerName || "Nguyễn Văn Quản Lý";

  const isChecklistPassed = !opts.hasIncompleteChecklist;
  const isTechPassed = !opts.hasBlockingIncident;
  const isGuestPassed = !opts.isOccupied;

  const rows = [
    { title: "Vệ sinh đạt chuẩn", passed: isChecklistPassed, note: "Đã thay ga gối, khử khuẩn sàn và phòng tắm phẳng đẹp" },
    { title: "Tiện nghi đủ và hoạt động", passed: isChecklistPassed, note: "Đèn, máy lạnh, tivi, khóa từ vận hành trơn tru" },
    { title: "Minibar đã kiểm tra", passed: true, note: "Đã kiểm đếm và bổ sung đủ định mức tiêu chuẩn" },
    { title: "Sự cố kỹ thuật đã xử lý", passed: isTechPassed, note: isTechPassed ? "Không phát hiện lỗi kỹ thuật hoặc sự cố tồn đọng" : "Có sự cố kỹ thuật cần thợ bảo trì giải quyết" },
    { title: "Phòng không có khách", passed: isGuestPassed, note: isGuestPassed ? "Phòng trống, sẵn sàng bàn giao đón lượt khách tiếp theo" : "Đang có khách lưu trú" },
  ];

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <title>BIÊN BẢN NGHIỆM THU BUỒNG PHÒNG (BP_BM3) - PHÒNG ${opts.roomNumber}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 15mm;
    }
    @media print {
      body {
        background: transparent !important;
        padding: 0 !important;
      }
      .no-print {
        display: none !important;
      }
      .page-sheet {
        border: 1.5px solid #000 !important;
        box-shadow: none !important;
        max-width: 100% !important;
        padding: 24px 28px !important;
      }
    }
    * {
      box-sizing: border-box;
    }
    body {
      margin: 0;
      padding: 24px;
      background: #F8FAFC;
      color: #000;
      font-family: "Times New Roman", Times, Georgia, serif;
      font-size: 13pt;
      line-height: 1.35;
    }
    .no-print-toolbar {
      max-width: 780px;
      margin: 0 auto 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #0F172A;
      padding: 12px 20px;
      border-radius: 8px;
      color: #FFF;
      font-family: system-ui, -apple-system, sans-serif;
    }
    .page-sheet {
      width: 100%;
      max-width: 780px;
      margin: 0 auto;
      background: #FFF;
      border: 1.5px solid #000;
      padding: 28px 32px;
      box-shadow: 0 4px 24px rgba(15, 23, 42, 0.12);
    }
    .doc-header-tag {
      font-size: 11pt;
      font-weight: bold;
      text-decoration: underline;
      margin-bottom: 6px;
    }
    .title-hotel {
      text-align: center;
      font-size: 14pt;
      font-weight: bold;
      text-transform: uppercase;
      margin: 0;
      letter-spacing: 0.5px;
    }
    .title-doc {
      text-align: center;
      font-size: 15pt;
      font-weight: bold;
      text-transform: uppercase;
      margin: 6px 0 20px 0;
      letter-spacing: 0.5px;
    }
    .meta-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11.5pt;
      line-height: 1.6;
      margin-bottom: 14px;
    }
    .meta-table td {
      padding: 2px 0;
      vertical-align: top;
    }
    .grid-table {
      width: 100%;
      table-layout: fixed;
      border-collapse: collapse;
      font-size: 11.5pt;
      margin-bottom: 14px;
    }
    .grid-table th, .grid-table td {
      border: 1px solid #000;
      padding: 6px 10px;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
    .grid-table th {
      font-weight: bold;
      text-align: center;
      background: #FFF;
    }
    .center {
      text-align: center;
    }
    .box {
      font-size: 13pt;
      line-height: 1;
      display: inline-block;
    }
    .conclusion-line {
      font-size: 11.5pt;
      margin: 12px 0 10px 0;
      line-height: 1.5;
    }
    .dashed-divider {
      border-top: 1px dashed #000;
      margin: 14px 0 12px;
    }
    .duty-title {
      font-weight: bold;
      font-size: 11.5pt;
      margin-bottom: 3px;
    }
    .duty-roles {
      font-weight: bold;
      font-size: 11.5pt;
      margin-bottom: 18px;
    }
    .dotted-line {
      display: inline-block;
      border-bottom: 1px dotted #000;
      min-width: 150px;
      height: 14px;
    }
  </style>
</head>
<body>
  <div class="no-print no-print-toolbar">
    <div style="font-size:14px;font-weight:600;">
      Biểu mẫu BP_BM3 · Biên bản nghiệm thu buồng phòng (Phòng ${opts.roomNumber})
    </div>
    <div style="display:flex;gap:10px;">
      <button onclick="window.print()" style="padding:8px 16px;border-radius:6px;border:none;background:#2563EB;color:#FFF;font-weight:bold;cursor:pointer;font-size:13px;display:inline-flex;align-items:center;gap:6px;">
        🖨️ In biên bản / Lưu PDF
      </button>
      <button onclick="window.close()" style="padding:8px 14px;border-radius:6px;border:1px solid #475569;background:#1E293B;color:#CBD5E1;font-weight:600;cursor:pointer;font-size:13px;">
        Đóng
      </button>
    </div>
  </div>

  <div class="page-sheet">
    <div class="doc-header-tag">BP_BM3:</div>
    <div class="title-hotel">KHÁCH SẠN MAM HOTEL</div>
    <div class="title-doc">BIÊN BẢN NGHIỆM THU BUỒNG PHÒNG</div>

    <table class="meta-table">
      <tr>
        <td style="width: 48%;"><strong>Mã biểu mẫu:</strong> BP_BM3</td>
        <td style="width: 52%;"><strong>Đơn vị phụ trách:</strong> Quản lý vận hành</td>
      </tr>
      <tr>
        <td><strong>Số chứng từ:</strong> ${voucherCode}</td>
        <td><strong>Ngày lập:</strong> ${dateStr}</td>
      </tr>
      <tr>
        <td><strong>Số biên bản:</strong> ${reportCode}</td>
        <td><strong>Nhiệm vụ:</strong> ${taskCode} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; <strong>Phòng:</strong> ${opts.roomNumber}</td>
      </tr>
      <tr>
        <td><strong>Người dọn:</strong> ${cleaner}</td>
        <td><strong>Người nghiệm thu:</strong> ${manager} &nbsp;&nbsp;&nbsp;&nbsp; <strong>Kiểm tra lúc:</strong> ${inspectionTime}</td>
      </tr>
      <tr>
        <td colspan="2" style="padding-top: 4px;">
          <strong>Checklist:</strong> &nbsp;<span class="box">☑</span> Đủ &nbsp;<span class="box">☐</span> Thiếu &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
          <strong>Khóa kỹ thuật:</strong> &nbsp;<span class="box">☑</span> Không &nbsp;<span class="box">☐</span> Còn &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
          <strong>Khách đang ở:</strong> &nbsp;<span class="box">☑</span> Không &nbsp;<span class="box">☐</span> Có
        </td>
      </tr>
    </table>

    <table class="grid-table">
      <thead>
        <tr>
          <th style="width: 36%;">Tiêu chí nghiệm thu</th>
          <th style="width: 14%;">Đạt</th>
          <th style="width: 14%;">Không đạt</th>
          <th style="width: 36%;">Yêu cầu khắc phục</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(r => `
          <tr>
            <td><strong>${r.title}</strong></td>
            <td class="center"><span class="box">${r.passed ? "☑" : "☐"}</span></td>
            <td class="center"><span class="box">${!r.passed ? "☑" : "☐"}</span></td>
            <td>${r.note}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>

    <div class="conclusion-line">
      <strong>Kết luận:</strong> &nbsp;&nbsp;
      <span class="box">☑</span> Đạt &nbsp;&nbsp;
      <span class="box">☐</span> Dọn lại &nbsp;&nbsp;
      <span class="box">☐</span> Chờ kỹ thuật
      &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
      <strong>Đưa về trạng thái sẵn sàng lúc:</strong> &nbsp;
      <span class="dotted-line" style="min-width: 160px; font-weight: bold; padding: 0 4px;">
        ${inspectionTime} ${dateStr}
      </span>
    </div>

    <div class="dashed-divider"></div>

    <div class="duty-title">Xác nhận và trách nhiệm</div>
    <div class="duty-roles">Người nghiệm thu &nbsp;&nbsp;|&nbsp;&nbsp; Kỹ thuật mở khóa nếu có</div>

    <div style="display: flex; justify-content: space-between; align-items: baseline; margin-top: 14px; font-size: 11.5pt;">
      <div style="flex: 1; display: flex; align-items: baseline; margin-right: 32px;">
        <span style="white-space: nowrap;">Ký/Tài khoản xác nhận:&nbsp;</span>
        <span class="dotted-line" style="flex: 1; border-bottom: 1px dotted #000; font-weight: bold; padding: 0 4px;">
          ${manager}
        </span>
      </div>
      <div style="flex: 1; display: flex; align-items: baseline;">
        <span style="white-space: nowrap;">Thời điểm:&nbsp;</span>
        <span class="dotted-line" style="flex: 1; border-bottom: 1px dotted #000; padding: 0 4px;">
          ${inspectionTime} ${dateStr}
        </span>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export function printAcceptanceFormBpBm3(opts: AcceptanceFormOptions) {
  const html = generateAcceptanceHtml(opts);
  const win = window.open("", "_blank");
  if (!win) {
    alert("Vui lòng cho phép popup để xem và in biên bản nghiệm thu.");
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => {
    win.print();
  }, 250);
}

export function AcceptancePdfModal({
  options,
  onClose,
}: {
  options: AcceptanceFormOptions;
  onClose: () => void;
}) {
  const now = new Date();
  const dateStr = options.dateStr || `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
  const inspectionTime = options.inspectionTime || now.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  const voucherCode = options.voucherCode || `SC-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${options.roomNumber}`;
  const reportCode = `BB-NT-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}-${options.roomNumber}`;
  const taskCode = options.taskId ? `NVBP-${options.taskId}` : `NVBP-${options.roomNumber}`;
  const cleaner = options.cleanerName || "Trần Thị Buồng Phòng";
  const manager = options.managerName || "Nguyễn Văn Quản Lý";

  const isChecklistPassed = !options.hasIncompleteChecklist;
  const isTechPassed = !options.hasBlockingIncident;
  const isGuestPassed = !options.isOccupied;

  const rows = [
    { title: "Vệ sinh đạt chuẩn", passed: isChecklistPassed, note: "Đã thay ga gối, khử khuẩn sàn và phòng tắm phẳng đẹp" },
    { title: "Tiện nghi đủ và hoạt động", passed: isChecklistPassed, note: "Đèn, máy lạnh, tivi, khóa từ vận hành trơn tru" },
    { title: "Minibar đã kiểm tra", passed: true, note: "Đã kiểm đếm và bổ sung đủ định mức tiêu chuẩn" },
    { title: "Sự cố kỹ thuật đã xử lý", passed: isTechPassed, note: isTechPassed ? "Không phát hiện lỗi kỹ thuật hoặc sự cố tồn đọng" : "Có sự cố kỹ thuật cần thợ bảo trì giải quyết" },
    { title: "Phòng không có khách", passed: isGuestPassed, note: isGuestPassed ? "Phòng trống, sẵn sàng bàn giao đón lượt khách tiếp theo" : "Đang có khách lưu trú" },
  ];

  const handlePrint = () => {
    printAcceptanceFormBpBm3(options);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(15, 23, 42, 0.65)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 820,
          maxHeight: "92vh",
          background: "#FFF",
          borderRadius: 12,
          boxShadow: "0 20px 45px rgba(0,0,0,0.25)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: "14px 20px",
            borderBottom: "1px solid #E2E8F0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#F8FAFC",
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0F172A" }}>
              Biên bản nghiệm thu buồng phòng · Biểu mẫu BP_BM3
            </h3>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "#64748B" }}>
              Phòng {options.roomNumber} — Mẫu nghiệm thu bàn giao phòng của Quản lý vận hành
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              type="button"
              onClick={handlePrint}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "none",
                background: "#0F172A",
                color: "#FFF",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                boxShadow: "0 2px 6px rgba(15,23,42,0.25)",
              }}
            >
              <Printer size={14} /> In biên bản / Lưu PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                border: "1px solid #E2E8F0",
                background: "#FFF",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Paper Container Body */}
        <div style={{ flex: 1, overflowY: "auto", background: "#F1F5F9", padding: "16px 20px 24px" }}>
          <div
            style={{
              background: "#FFF",
              border: "1.5px solid #000",
              padding: "24px 28px 36px",
              fontFamily: "'Times New Roman', Times, Georgia, serif",
              color: "#000",
              fontSize: 14,
              lineHeight: 1.4,
              boxShadow: "0 4px 18px rgba(0,0,0,0.08)",
            }}
          >
            <div style={{ fontSize: 13, fontWeight: "bold", textDecoration: "underline", marginBottom: 6 }}>
              BP_BM3:
            </div>
            <div style={{ textAlign: "center", marginBottom: 18 }}>
              <div style={{ fontSize: 16, fontWeight: "bold", textTransform: "uppercase", letterSpacing: 0.5 }}>
                KHÁCH SẠN MAM HOTEL
              </div>
              <div style={{ fontSize: 17, fontWeight: "bold", textTransform: "uppercase", marginTop: 4, letterSpacing: 0.5 }}>
                BIÊN BẢN NGHIỆM THU BUỒNG PHÒNG
              </div>
            </div>

            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, lineHeight: 1.6, marginBottom: 14 }}>
              <tbody>
                <tr>
                  <td style={{ width: "48%" }}><strong>Mã biểu mẫu:</strong> BP_BM3</td>
                  <td style={{ width: "52%" }}><strong>Đơn vị phụ trách:</strong> Quản lý vận hành</td>
                </tr>
                <tr>
                  <td><strong>Số chứng từ:</strong> {voucherCode}</td>
                  <td><strong>Ngày lập:</strong> {dateStr}</td>
                </tr>
                <tr>
                  <td><strong>Số biên bản:</strong> {reportCode}</td>
                  <td><strong>Nhiệm vụ:</strong> {taskCode} &nbsp;&nbsp;&nbsp;&nbsp; <strong>Phòng:</strong> {options.roomNumber}</td>
                </tr>
                <tr>
                  <td><strong>Người dọn:</strong> {cleaner}</td>
                  <td><strong>Người nghiệm thu:</strong> {manager} &nbsp;&nbsp;&nbsp;&nbsp; <strong>Kiểm tra lúc:</strong> {inspectionTime}</td>
                </tr>
                <tr>
                  <td colSpan={2} style={{ paddingTop: 4 }}>
                    <strong>Checklist:</strong> &nbsp;☑ Đủ &nbsp;☐ Thiếu &nbsp;&nbsp;&nbsp;&nbsp;
                    <strong>Khóa kỹ thuật:</strong> &nbsp;☑ Không &nbsp;☐ Còn &nbsp;&nbsp;&nbsp;&nbsp;
                    <strong>Khách đang ở:</strong> &nbsp;☑ Không &nbsp;☐ Có
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Grid Table */}
            <table style={{ width: "100%", tableLayout: "fixed", borderCollapse: "collapse", fontSize: 13, marginBottom: 14 }}>
              <thead>
                <tr>
                  <th style={{ width: "36%", border: "1px solid #000", padding: "6px 10px", textAlign: "center" }}>Tiêu chí nghiệm thu</th>
                  <th style={{ width: "14%", border: "1px solid #000", padding: "6px 10px", textAlign: "center" }}>Đạt</th>
                  <th style={{ width: "14%", border: "1px solid #000", padding: "6px 10px", textAlign: "center" }}>Không đạt</th>
                  <th style={{ width: "36%", border: "1px solid #000", padding: "6px 10px", textAlign: "center" }}>Yêu cầu khắc phục</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr key={idx}>
                    <td style={{ border: "1px solid #000", padding: "6px 10px", fontWeight: "bold" }}>{row.title}</td>
                    <td style={{ border: "1px solid #000", padding: "6px 10px", textAlign: "center", fontSize: 14 }}>
                      {row.passed ? "☑" : "☐"}
                    </td>
                    <td style={{ border: "1px solid #000", padding: "6px 10px", textAlign: "center", fontSize: 14 }}>
                      {!row.passed ? "☑" : "☐"}
                    </td>
                    <td style={{ border: "1px solid #000", padding: "6px 10px" }}>{row.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ fontSize: 13, margin: "12px 0 10px 0" }}>
              <strong>Kết luận:</strong> &nbsp;&nbsp;
              ☑ Đạt &nbsp;&nbsp;
              ☐ Dọn lại &nbsp;&nbsp;
              ☐ Chờ kỹ thuật
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
              <strong>Đưa về trạng thái sẵn sàng lúc:</strong> &nbsp;
              <span style={{ borderBottom: "1px dotted #000", fontWeight: "bold", padding: "0 6px" }}>
                {inspectionTime} {dateStr}
              </span>
            </div>

            {/* Dashed line */}
            <div style={{ borderTop: "1px dashed #000", margin: "16px 0 12px" }} />

            <div style={{ fontWeight: "bold", fontSize: 13, marginBottom: 4 }}>
              Xác nhận và trách nhiệm
            </div>
            <div style={{ fontWeight: "bold", fontSize: 13, marginBottom: 16 }}>
              Người nghiệm thu &nbsp;&nbsp;|&nbsp;&nbsp; Kỹ thuật mở khóa nếu có
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: 13, gap: 32, marginTop: 12 }}>
              <div style={{ flex: 1, display: "flex", alignItems: "baseline" }}>
                <span style={{ whiteSpace: "nowrap" }}>Ký/Tài khoản xác nhận:&nbsp;</span>
                <span style={{ flex: 1, borderBottom: "1px dotted #000", fontWeight: "bold", padding: "0 4px" }}>
                  {manager}
                </span>
              </div>
              <div style={{ flex: 1, display: "flex", alignItems: "baseline" }}>
                <span style={{ whiteSpace: "nowrap" }}>Thời điểm:&nbsp;</span>
                <span style={{ flex: 1, borderBottom: "1px dotted #000", padding: "0 4px" }}>
                  {inspectionTime} {dateStr}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal footer */}
        <div
          style={{
            padding: "12px 20px",
            borderTop: "1px solid #E2E8F0",
            background: "#F8FAFC",
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "8px 18px",
              borderRadius: 8,
              border: "1px solid #CBD5E1",
              background: "#FFF",
              color: "#475569",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Đóng
          </button>
          <button
            type="button"
            onClick={handlePrint}
            style={{
              padding: "8px 18px",
              borderRadius: 8,
              border: "none",
              background: "#0284C7",
              color: "#FFF",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Printer size={14} /> In phiếu PDF (BP_BM3)
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   BP_BM2: PHIẾU PHÂN CÔNG NHIỆM VỤ BUỒNG PHÒNG
══════════════════════════════════════════════════════════ */
export interface AssignmentItem {
  roomNumber: string;
  taskType: string;
  deadline: string;
  timeRange: string;
  status: string;
}

export interface AssignmentFormOptions {
  shiftName?: string;
  managerName?: string;
  employeeName?: string;
  floorArea?: string;
  priorityNote?: string;
  voucherCode?: string;
  assignmentCode?: string;
  dateStr?: string;
  items?: AssignmentItem[];
}

export function generateAssignmentHtml(opts: AssignmentFormOptions): string {
  const now = new Date();
  const dateStr = opts.dateStr || `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
  const voucherCode = opts.voucherCode || `PC-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-01`;
  const assignmentCode = opts.assignmentCode || `PCBP-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const shiftName = opts.shiftName || `Ca sáng (${dateStr})`;
  const manager = opts.managerName || "Nguyễn Văn Quản Lý";
  const employee = opts.employeeName || "Trần Thị Buồng Phòng";
  const floorArea = opts.floorArea || "Tầng 5, 6, 7 & 8";
  const priorityNote = opts.priorityNote || "Ưu tiên hoàn tất dọn phòng khách VIP (P.803, P.701) trước 11:30 để đón lượt check-in mới.";

  const items: AssignmentItem[] = (opts.items && opts.items.length > 0) ? opts.items : [
    { roomNumber: "701", taskType: "Dọn sau trả phòng", deadline: "10:30", timeRange: "08:00 - 08:35", status: "Đã dọn xong" },
    { roomNumber: "604", taskType: "Dọn sau trả phòng", deadline: "11:00", timeRange: "08:45 - 09:20", status: "Đã dọn xong" },
    { roomNumber: "803", taskType: "Dọn VIP Suite", deadline: "11:30", timeRange: "09:30 - 10:15", status: "Đã dọn xong" },
    { roomNumber: "501", taskType: "Dọn phòng định kỳ", deadline: "14:00", timeRange: "10:30 - 11:05", status: "Cần dọn" },
    { roomNumber: "602", taskType: "Kiểm tra minibar", deadline: "15:00", timeRange: "11:15 - 11:45", status: "Đang dọn" },
  ];

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <title>PHIẾU PHÂN CÔNG NHIỆM VỤ BUỒNG PHÒNG (BP_BM2)</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 15mm;
    }
    @media print {
      body { background: transparent !important; padding: 0 !important; }
      .no-print { display: none !important; }
      .page-sheet {
        border: 1.5px solid #000 !important;
        box-shadow: none !important;
        max-width: 100% !important;
        padding: 24px 28px !important;
      }
    }
    * { box-sizing: border-box; }
    body {
      margin: 0; padding: 24px; background: #F8FAFC; color: #000;
      font-family: "Times New Roman", Times, Georgia, serif;
      font-size: 13pt; line-height: 1.35;
    }
    .no-print-toolbar {
      max-width: 780px; margin: 0 auto 16px; display: flex;
      justify-content: space-between; align-items: center;
      background: #0F172A; padding: 12px 20px; border-radius: 8px;
      color: #FFF; font-family: system-ui, -apple-system, sans-serif;
    }
    .page-sheet {
      width: 100%; max-width: 780px; margin: 0 auto; background: #FFF;
      border: 1.5px solid #000; padding: 28px 32px;
      box-shadow: 0 4px 24px rgba(15, 23, 42, 0.12);
    }
    .doc-header-tag { font-size: 11pt; font-weight: bold; text-decoration: underline; margin-bottom: 6px; }
    .title-hotel { text-align: center; font-size: 14pt; font-weight: bold; text-transform: uppercase; margin: 0; letter-spacing: 0.5px; }
    .title-doc { text-align: center; font-size: 15pt; font-weight: bold; text-transform: uppercase; margin: 6px 0 20px 0; letter-spacing: 0.5px; }
    .meta-table { width: 100%; border-collapse: collapse; font-size: 11.5pt; line-height: 1.6; margin-bottom: 14px; }
    .meta-table td { padding: 2px 0; vertical-align: top; }
    .grid-table { width: 100%; table-layout: fixed; border-collapse: collapse; font-size: 11.5pt; margin-bottom: 16px; }
    .grid-table th, .grid-table td { border: 1px solid #000; padding: 6px 10px; word-wrap: break-word; overflow-wrap: break-word; }
    .grid-table th { font-weight: bold; text-align: center; background: #FFF; }
    .center { text-align: center; }
    .dashed-divider { border-top: 1px dashed #000; margin: 18px 0 12px; }
    .duty-title { font-weight: bold; font-size: 11.5pt; margin-bottom: 3px; }
    .duty-roles { font-weight: bold; font-size: 11.5pt; margin-bottom: 20px; }
    .dotted-line { display: inline-block; border-bottom: 1px dotted #000; min-width: 150px; height: 14px; }
  </style>
</head>
<body>
  <div class="no-print no-print-toolbar">
    <div style="font-size:14px;font-weight:600;">
      Biểu mẫu BP_BM2 · Phiếu phân công nhiệm vụ buồng phòng (${dateStr})
    </div>
    <div style="display:flex;gap:10px;">
      <button onclick="window.print()" style="padding:8px 16px;border-radius:6px;border:none;background:#2563EB;color:#FFF;font-weight:bold;cursor:pointer;font-size:13px;display:inline-flex;align-items:center;gap:6px;">
        🖨️ In phiếu / Lưu PDF
      </button>
      <button onclick="window.close()" style="padding:8px 14px;border-radius:6px;border:1px solid #475569;background:#1E293B;color:#CBD5E1;font-weight:600;cursor:pointer;font-size:13px;">
        Đóng
      </button>
    </div>
  </div>

  <div class="page-sheet">
    <div class="doc-header-tag">BP_BM2:</div>
    <div class="title-hotel">KHÁCH SẠN MAM HOTEL</div>
    <div class="title-doc">PHIẾU PHÂN CÔNG NHIỆM VỤ BUỒNG PHÒNG</div>

    <table class="meta-table">
      <tr>
        <td style="width: 48%;"><strong>Mã biểu mẫu:</strong> BP_BM2</td>
        <td style="width: 52%;"><strong>Đơn vị phụ trách:</strong> Quản lý vận hành</td>
      </tr>
      <tr>
        <td><strong>Số chứng từ:</strong> ${voucherCode}</td>
        <td><strong>Ngày lập:</strong> ${dateStr}</td>
      </tr>
      <tr>
        <td><strong>Mã phân công:</strong> ${assignmentCode}</td>
        <td><strong>Ngày/Ca:</strong> ${shiftName} &nbsp;&nbsp;&nbsp;&nbsp; <strong>Quản lý:</strong> ${manager}</td>
      </tr>
      <tr>
        <td><strong>Nhân viên được giao:</strong> ${employee}</td>
        <td><strong>Tầng/Khu vực:</strong> ${floorArea}</td>
      </tr>
      <tr>
        <td colspan="2" style="padding-top: 4px;">
          <strong>Yêu cầu ưu tiên/Ghi chú:</strong> ${priorityNote}
        </td>
      </tr>
    </table>

    <table class="grid-table">
      <thead>
        <tr>
          <th style="width: 22%;">Phòng/Nhiệm vụ</th>
          <th style="width: 26%;">Loại việc</th>
          <th style="width: 18%;">Hạn hoàn thành</th>
          <th style="width: 20%;">Bắt đầu/Kết thúc</th>
          <th style="width: 14%;">Trạng thái</th>
        </tr>
      </thead>
      <tbody>
        ${items.map(item => `
          <tr>
            <td class="center"><strong>Phòng ${item.roomNumber}</strong></td>
            <td>${item.taskType}</td>
            <td class="center">${item.deadline}</td>
            <td class="center">${item.timeRange}</td>
            <td class="center">${item.status}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>

    <div class="dashed-divider"></div>

    <div class="duty-title">Xác nhận và trách nhiệm</div>
    <div class="duty-roles">Quản lý phân công &nbsp;&nbsp;|&nbsp;&nbsp; Nhân viên nhận việc</div>

    <div style="display: flex; justify-content: space-between; align-items: baseline; margin-top: 16px; font-size: 11.5pt;">
      <div style="flex: 1; display: flex; align-items: baseline; margin-right: 32px;">
        <span style="white-space: nowrap;">Ký/Tài khoản xác nhận:&nbsp;</span>
        <span class="dotted-line" style="flex: 1; border-bottom: 1px dotted #000; font-weight: bold; padding: 0 4px;">
          ${manager}
        </span>
      </div>
      <div style="flex: 1; display: flex; align-items: baseline;">
        <span style="white-space: nowrap;">Thời điểm:&nbsp;</span>
        <span class="dotted-line" style="flex: 1; border-bottom: 1px dotted #000; padding: 0 4px;">
          07:30 ${dateStr}
        </span>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export function printAssignmentFormBpBm2(opts: AssignmentFormOptions) {
  const html = generateAssignmentHtml(opts);
  const win = window.open("", "_blank");
  if (!win) {
    alert("Vui lòng cho phép popup để xem và in phiếu phân công.");
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => {
    win.print();
  }, 250);
}

export function AssignmentPdfModal({
  options,
  onClose,
}: {
  options: AssignmentFormOptions;
  onClose: () => void;
}) {
  const now = new Date();
  const dateStr = options.dateStr || `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
  const voucherCode = options.voucherCode || `PC-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-01`;
  const assignmentCode = options.assignmentCode || `PCBP-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const shiftName = options.shiftName || `Ca sáng (${dateStr})`;
  const manager = options.managerName || "Nguyễn Văn Quản Lý";
  const employee = options.employeeName || "Trần Thị Buồng Phòng";
  const floorArea = options.floorArea || "Tầng 5, 6, 7 & 8";
  const priorityNote = options.priorityNote || "Ưu tiên hoàn tất dọn phòng khách VIP (P.803, P.701) trước 11:30 để đón lượt check-in mới.";

  const items: AssignmentItem[] = (options.items && options.items.length > 0) ? options.items : [
    { roomNumber: "701", taskType: "Dọn sau trả phòng", deadline: "10:30", timeRange: "08:00 - 08:35", status: "Đã dọn xong" },
    { roomNumber: "604", taskType: "Dọn sau trả phòng", deadline: "11:00", timeRange: "08:45 - 09:20", status: "Đã dọn xong" },
    { roomNumber: "803", taskType: "Dọn VIP Suite", deadline: "11:30", timeRange: "09:30 - 10:15", status: "Đã dọn xong" },
    { roomNumber: "501", taskType: "Dọn phòng định kỳ", deadline: "14:00", timeRange: "10:30 - 11:05", status: "Cần dọn" },
    { roomNumber: "602", taskType: "Kiểm tra minibar", deadline: "15:00", timeRange: "11:15 - 11:45", status: "Đang dọn" },
  ];

  const handlePrint = () => {
    printAssignmentFormBpBm2(options);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(15, 23, 42, 0.65)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 820,
          maxHeight: "92vh",
          background: "#FFF",
          borderRadius: 12,
          boxShadow: "0 20px 45px rgba(0,0,0,0.25)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "14px 20px",
            borderBottom: "1px solid #E2E8F0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#F8FAFC",
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0F172A" }}>
              Phiếu phân công nhiệm vụ buồng phòng · Biểu mẫu BP_BM2
            </h3>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "#64748B" }}>
              Phân công ca trực cho nhân viên buồng phòng — Quản lý vận hành
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              type="button"
              onClick={handlePrint}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "none",
                background: "#0F172A",
                color: "#FFF",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                boxShadow: "0 2px 6px rgba(15,23,42,0.25)",
              }}
            >
              <Printer size={14} /> In phiếu / Lưu PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                border: "1px solid #E2E8F0",
                background: "#FFF",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Paper Container Body */}
        <div style={{ flex: 1, overflowY: "auto", background: "#F1F5F9", padding: "16px 20px 24px" }}>
          <div
            style={{
              background: "#FFF",
              border: "1.5px solid #000",
              padding: "24px 28px 36px",
              fontFamily: "'Times New Roman', Times, Georgia, serif",
              color: "#000",
              fontSize: 14,
              lineHeight: 1.4,
              boxShadow: "0 4px 18px rgba(0,0,0,0.08)",
            }}
          >
            <div style={{ fontSize: 13, fontWeight: "bold", textDecoration: "underline", marginBottom: 6 }}>
              BP_BM2:
            </div>
            <div style={{ textAlign: "center", marginBottom: 18 }}>
              <div style={{ fontSize: 16, fontWeight: "bold", textTransform: "uppercase", letterSpacing: 0.5 }}>
                KHÁCH SẠN MAM HOTEL
              </div>
              <div style={{ fontSize: 17, fontWeight: "bold", textTransform: "uppercase", marginTop: 4, letterSpacing: 0.5 }}>
                PHIẾU PHÂN CÔNG NHIỆM VỤ BUỒNG PHÒNG
              </div>
            </div>

            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, lineHeight: 1.6, marginBottom: 14 }}>
              <tbody>
                <tr>
                  <td style={{ width: "48%" }}><strong>Mã biểu mẫu:</strong> BP_BM2</td>
                  <td style={{ width: "52%" }}><strong>Đơn vị phụ trách:</strong> Quản lý vận hành</td>
                </tr>
                <tr>
                  <td><strong>Số chứng từ:</strong> {voucherCode}</td>
                  <td><strong>Ngày lập:</strong> {dateStr}</td>
                </tr>
                <tr>
                  <td><strong>Mã phân công:</strong> {assignmentCode}</td>
                  <td><strong>Ngày/Ca:</strong> {shiftName} &nbsp;&nbsp;&nbsp;&nbsp; <strong>Quản lý:</strong> {manager}</td>
                </tr>
                <tr>
                  <td><strong>Nhân viên được giao:</strong> {employee}</td>
                  <td><strong>Tầng/Khu vực:</strong> {floorArea}</td>
                </tr>
                <tr>
                  <td colSpan={2} style={{ paddingTop: 4 }}>
                    <strong>Yêu cầu ưu tiên/Ghi chú:</strong> {priorityNote}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Grid Table */}
            <table style={{ width: "100%", tableLayout: "fixed", borderCollapse: "collapse", fontSize: 13, marginBottom: 16 }}>
              <thead>
                <tr>
                  <th style={{ width: "22%", border: "1px solid #000", padding: "6px 10px", textAlign: "center" }}>Phòng/Nhiệm vụ</th>
                  <th style={{ width: "26%", border: "1px solid #000", padding: "6px 10px", textAlign: "center" }}>Loại việc</th>
                  <th style={{ width: "18%", border: "1px solid #000", padding: "6px 10px", textAlign: "center" }}>Hạn hoàn thành</th>
                  <th style={{ width: "20%", border: "1px solid #000", padding: "6px 10px", textAlign: "center" }}>Bắt đầu/Kết thúc</th>
                  <th style={{ width: "14%", border: "1px solid #000", padding: "6px 10px", textAlign: "center" }}>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={idx}>
                    <td style={{ border: "1px solid #000", padding: "6px 10px", textAlign: "center", fontWeight: "bold" }}>Phòng {item.roomNumber}</td>
                    <td style={{ border: "1px solid #000", padding: "6px 10px" }}>{item.taskType}</td>
                    <td style={{ border: "1px solid #000", padding: "6px 10px", textAlign: "center" }}>{item.deadline}</td>
                    <td style={{ border: "1px solid #000", padding: "6px 10px", textAlign: "center" }}>{item.timeRange}</td>
                    <td style={{ border: "1px solid #000", padding: "6px 10px", textAlign: "center" }}>{item.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Dashed line */}
            <div style={{ borderTop: "1px dashed #000", margin: "18px 0 12px" }} />

            <div style={{ fontWeight: "bold", fontSize: 13, marginBottom: 4 }}>
              Xác nhận và trách nhiệm
            </div>
            <div style={{ fontWeight: "bold", fontSize: 13, marginBottom: 16 }}>
              Quản lý phân công &nbsp;&nbsp;|&nbsp;&nbsp; Nhân viên nhận việc
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: 13, gap: 32, marginTop: 12 }}>
              <div style={{ flex: 1, display: "flex", alignItems: "baseline" }}>
                <span style={{ whiteSpace: "nowrap" }}>Ký/Tài khoản xác nhận:&nbsp;</span>
                <span style={{ flex: 1, borderBottom: "1px dotted #000", fontWeight: "bold", padding: "0 4px" }}>
                  {manager}
                </span>
              </div>
              <div style={{ flex: 1, display: "flex", alignItems: "baseline" }}>
                <span style={{ whiteSpace: "nowrap" }}>Thời điểm:&nbsp;</span>
                <span style={{ flex: 1, borderBottom: "1px dotted #000", padding: "0 4px" }}>
                  07:30 {dateStr}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal footer */}
        <div
          style={{
            padding: "12px 20px",
            borderTop: "1px solid #E2E8F0",
            background: "#F8FAFC",
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "8px 18px",
              borderRadius: 8,
              border: "1px solid #CBD5E1",
              background: "#FFF",
              color: "#475569",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Đóng
          </button>
          <button
            type="button"
            onClick={handlePrint}
            style={{
              padding: "8px 18px",
              borderRadius: 8,
              border: "none",
              background: "#0284C7",
              color: "#FFF",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Printer size={14} /> In phiếu PDF (BP_BM2)
          </button>
        </div>
      </div>
    </div>
  );
}
