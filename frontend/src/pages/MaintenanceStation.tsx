import { useEffect, useState, useMemo } from "react";
import { housekeepingTechnicalApi } from "../shared/api/housekeepingTechnical";
import { enterpriseApi } from "../shared/api/enterprise";
import { authApi } from "../shared/api/auth";
import { normalizeVietnameseText } from "../shared/utils/encoding";
import { EmployeeProfileDropdown } from "../components/common/EmployeeProfileDropdown";
import type { Equipment, Room, TechnicalWorkOrder, TechnicalWorkOrderStatus } from "../shared/types/housekeepingTechnical";
import type { EmployeeAdmin } from "../shared/types/hrGovernance";
import type { TechnicalAsset } from "../shared/types/enterprise";
import {
  LayoutDashboard, CalendarDays,
  Wrench, Package,
  Search, Bell, ChevronDown, ChevronLeft, ChevronRight,
  AlertTriangle, CheckCircle2, Cog, Plus,
  Lock, Unlock, Image, Send, X, LogOut, Check,
  Clock, ShieldAlert, FileText
} from "lucide-react";

/* ══════════════════════════════════════════════════════════
   TYPES
══════════════════════════════════════════════════════════ */
export type Priority     = "urgent" | "critical" | "medium" | "low";
export type TicketStatus = "NEW" | "ACKNOWLEDGED" | "IN_PROGRESS" | "WAITING_ACCEPTANCE" | "COMPLETED" | "ROOM_RELEASED";
export type TicketTab    = "all" | "rooms" | "public" | "preventive";
export type TechSection  = TicketTab | "catalog";

export interface WorkOrder {
  id: string;
  rawId: number;
  roomId: string;
  roomName: string;
  roomArea: string;
  areaType: string;
  equipmentId?: number | null;
  issue: string;
  issueDetail: string;
  priority: Priority;
  assignedTo: string;
  assignedInitials: string;
  assignedColor: string;
  roomLock: boolean;
  etaDate: string;
  etaTime: string;
  status: TicketStatus;
  resultNote?: string | null;
  acceptanceNote?: string | null;
  acceptedBy?: string | null;
  createdBy: string;
  tab: TicketTab[];
}

export interface Asset {
  id: string;
  name: string;
  category: string;
  location: string;
  brandModel: string;
  installDate: string;
  nextMaintenance: string;
  status: "good" | "maintenance-needed" | "repairing";
  cycle: string;
  cost?: string;
}

/* ══════════════════════════════════════════════════════════
   CONFIGS
══════════════════════════════════════════════════════════ */
export const PRI_CFG: Record<Priority, { label: string; bg: string; text: string; dot: string }> = {
  critical: { label: "Nghiêm trọng", bg: "#FFE4E6", text: "#BE123C", dot: "#EF4444" },
  urgent:   { label: "Khẩn cấp",     bg: "#FFE4E6", text: "#BE123C", dot: "#EF4444" },
  medium:   { label: "Trung bình",   bg: "#FEF3C7", text: "#92400E", dot: "#F59E0B" },
  low:      { label: "Thấp",         bg: "#DCFCE7", text: "#166534", dot: "#16A34A" },
};

export const STA_CFG: Record<TicketStatus, { label: string; bg: string; text: string; dot: string; nextLabel?: string }> = {
  NEW: {
    label: "Mới tạo",
    bg: "#F1F5F9",
    text: "#475569",
    dot: "#94A3B8",
    nextLabel: "Tiếp nhận"
  },
  ACKNOWLEDGED: {
    label: "Đã tiếp nhận",
    bg: "#DBEAFE",
    text: "#1D4ED8",
    dot: "#3B82F6",
    nextLabel: "Bắt đầu xử lý"
  },
  IN_PROGRESS: {
    label: "Đang xử lý",
    bg: "#E0F2FE",
    text: "#0369A1",
    dot: "#0284C7",
    nextLabel: "Báo hoàn thành"
  },
  WAITING_ACCEPTANCE: {
    label: "Chờ nghiệm thu",
    bg: "#FEF9C3",
    text: "#854D0E",
    dot: "#EAB308",
    nextLabel: "Chờ quản lý nghiệm thu"
  },
  COMPLETED: {
    label: "Đã nghiệm thu",
    bg: "#ECFDF5",
    text: "#047857",
    dot: "#10B981",
    nextLabel: "Mở khóa phòng"
  },
  ROOM_RELEASED: {
    label: "Đã mở phòng (Xong)",
    bg: "#DCFCE7",
    text: "#166534",
    dot: "#16A34A"
  },
};

export const SIDEBAR_NAV: { id: TechSection; label: string; Icon: React.ElementType }[] = [
  { id: "all",        label: "Tổng quan kỹ thuật",         Icon: LayoutDashboard },
  { id: "rooms",      label: "Sự cố phòng khách",          Icon: Wrench },
  { id: "public",     label: "Khu vực công cộng",          Icon: AlertTriangle },
  { id: "preventive", label: "Bảo trì định kỳ",            Icon: CalendarDays },
  { id: "catalog",    label: "Danh mục thiết bị & Tài sản", Icon: Package },
];

export const ISSUE_CATEGORIES = [
  "Chọn hạng mục sự cố",
  "Điều hòa & Không khí (HVAC)",
  "Hệ thống điện & Chiếu sáng",
  "Nước & Thiết bị vệ sinh",
  "Khóa cửa & Thẻ từ phòng",
  "Thang máy & Cửa tự động",
  "Nội thất & Đồ gỗ",
  "Công nghệ thông tin / TV / WiFi",
  "Thiết bị bếp & Minibar",
  "Hồ bơi & Cảnh quan ngoài trời",
  "Bảo trì định kỳ",
  "Khác",
];

/* ══════════════════════════════════════════════════════════
   CREATE WORK ORDER PANEL
══════════════════════════════════════════════════════════ */
function CreatePanel({
  rooms,
  onClose,
  onCreate,
}: {
  rooms: Room[];
  onClose: () => void;
  onCreate: (request: { roomId: string; equipmentId?: number; category: string; description: string; priority: Priority; slaDueHours?: number }) => Promise<boolean>;
}) {
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [category, setCategory]             = useState("");
  const [desc, setDesc]                     = useState("");
  const [priority, setPriority]             = useState<Priority>("urgent");
  const [equipmentList, setEquipmentList]   = useState<Equipment[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<string>("");
  const [slaHours, setSlaHours]             = useState<number>(4);
  const [created, setCreated]               = useState(false);
  const [error, setError]                   = useState<string | null>(null);
  const [loadingEquipment, setLoadingEquipment] = useState(false);

  // Load equipment when room changes
  useEffect(() => {
    if (!selectedRoomId) {
      setEquipmentList([]);
      setSelectedEquipment("");
      return;
    }
    setLoadingEquipment(true);
    housekeepingTechnicalApi.equipment(selectedRoomId)
      .then(eqs => {
        setEquipmentList(eqs.filter(e => e.active));
      })
      .catch(() => {
        setEquipmentList([]);
      })
      .finally(() => {
        setLoadingEquipment(false);
      });
  }, [selectedRoomId]);

  const canCreate = Boolean(selectedRoomId && category && !category.startsWith("Chọn") && desc.trim());

  const handleCreate = async () => {
    if (!canCreate) return;
    setError(null);
    try {
      const ok = await onCreate({
        roomId: selectedRoomId,
        equipmentId: selectedEquipment ? Number(selectedEquipment) : undefined,
        category,
        description: desc.trim(),
        priority,
        slaDueHours: slaHours,
      });
      if (!ok) throw new Error("Backend không lưu được phiếu công việc.");
      setCreated(true);
      setDesc("");
      setTimeout(() => {
        setCreated(false);
        onClose();
      }, 1200);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Không thể lưu phiếu công việc.");
    }
  };

  return (
    <div style={{ width: 340, flexShrink: 0, background: "#FFF", borderLeft: "1px solid #E2E8F0",
      display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "-2px 0 8px rgba(0,0,0,0.03)" }}>
      {/* Header */}
      <div style={{ padding: "14px 16px", borderBottom: "1px solid #E2E8F0",
        display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 6, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Wrench size={15} style={{ color: "#2563EB" }} />
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>Tạo phiếu công việc</p>
            <p style={{ fontSize: 11, color: "#94A3B8" }}>Tiếp nhận &amp; ghi nhận sự cố thật</p>
          </div>
        </div>
        <button onClick={onClose} title="Đóng bảng"
          style={{ width: 28, height: 28, borderRadius: 6, border: "none", background: "#F1F5F9", color: "#64748B", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <X size={15} />
        </button>
      </div>

      {/* Form */}
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Real Room Selection */}
        <div>
          <label htmlFor="room-select" style={{ fontSize: 11, fontWeight: 700, color: "#374151", marginBottom: 5, display: "block" }}>
            Vị trí phòng (Dữ liệu CSDL) <span style={{ color: "#EF4444" }}>*</span>
          </label>
          <div style={{ position: "relative" }}>
            <select
              id="room-select"
              value={selectedRoomId}
              onChange={e => setSelectedRoomId(e.target.value)}
              style={{ width: "100%", height: 34, padding: "0 28px 0 10px", borderRadius: 8,
                border: "1px solid #CBD5E1", background: "#F8FAFC", fontSize: 12, outline: "none",
                cursor: "pointer", appearance: "none", color: selectedRoomId ? "#0F172A" : "#94A3B8", boxSizing: "border-box" }}>
              <option value="">-- Chọn phòng khách sạn --</option>
              {rooms.map(r => (
                <option key={r.id} value={r.id}>
                  Phòng {r.name || r.id} ({r.id}) – Tầng {r.floor} ({r.room_type_name || "Tiêu chuẩn"})
                </option>
              ))}
            </select>
            <ChevronDown size={12} style={{ position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)", color: "#94A3B8", pointerEvents: "none" }} />
          </div>
        </div>

        {/* Room Equipment (if any) */}
        {selectedRoomId && (
          <div>
            <label htmlFor="equipment-select" style={{ fontSize: 11, fontWeight: 700, color: "#374151", marginBottom: 5, display: "block" }}>
              Thiết bị gắn phòng <span style={{ fontSize: 10, color: "#94A3B8", fontWeight: 400 }}>(Tùy chọn)</span>
            </label>
            <div style={{ position: "relative" }}>
              <select
                id="equipment-select"
                value={selectedEquipment}
                onChange={e => setSelectedEquipment(e.target.value)}
                disabled={loadingEquipment}
                style={{ width: "100%", height: 34, padding: "0 28px 0 10px", borderRadius: 8,
                  border: "1px solid #CBD5E1", background: "#F8FAFC", fontSize: 12, outline: "none",
                  cursor: "pointer", appearance: "none", color: selectedEquipment ? "#0F172A" : "#64748B", boxSizing: "border-box" }}>
                <option value="">Không liên kết thiết bị cụ thể</option>
                {equipmentList.map(eq => (
                  <option key={eq.id} value={eq.id}>
                    {eq.name} (SL: {eq.quantity})
                  </option>
                ))}
              </select>
              <ChevronDown size={12} style={{ position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)", color: "#94A3B8", pointerEvents: "none" }} />
            </div>
            {equipmentList.length === 0 && !loadingEquipment && (
              <p style={{ fontSize: 10, color: "#94A3B8", marginTop: 3 }}>Phòng này chưa có hồ sơ thiết bị riêng trong hệ thống.</p>
            )}
          </div>
        )}

        {/* Category */}
        <div>
          <label htmlFor="category-select" style={{ fontSize: 11, fontWeight: 700, color: "#374151", marginBottom: 5, display: "block" }}>
            Hạng mục sự cố <span style={{ color: "#EF4444" }}>*</span>
          </label>
          <div style={{ position: "relative" }}>
            <select
              id="category-select"
              value={category}
              onChange={e => setCategory(e.target.value)}
              style={{ width: "100%", height: 34, padding: "0 28px 0 10px", borderRadius: 8,
                border: "1px solid #CBD5E1", background: "#F8FAFC", fontSize: 12, outline: "none",
                cursor: "pointer", appearance: "none", color: category ? "#0F172A" : "#94A3B8", boxSizing: "border-box" }}>
              {ISSUE_CATEGORIES.map(c => <option key={c} value={c.startsWith("Chọn") ? "" : c}>{c}</option>)}
            </select>
            <ChevronDown size={12} style={{ position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)", color: "#94A3B8", pointerEvents: "none" }} />
          </div>
        </div>

        {/* Description */}
        <div>
          <label htmlFor="desc-input" style={{ fontSize: 11, fontWeight: 700, color: "#374151", marginBottom: 5, display: "block" }}>
            Mô tả hiện trạng sự cố <span style={{ color: "#EF4444" }}>*</span>
          </label>
          <textarea
            id="desc-input"
            value={desc}
            onChange={e => setDesc(e.target.value)}
            placeholder="Mô tả hiện trạng sự cố để kỹ thuật viên nắm rõ và chuẩn bị vật tư..."
            style={{ width: "100%", height: 74, padding: "8px 10px", borderRadius: 8,
              border: "1px solid #CBD5E1", background: "#F8FAFC", fontSize: 12, outline: "none",
              resize: "none", fontFamily: "'Inter',system-ui,sans-serif",
              color: "#0F172A", boxSizing: "border-box" }} />
        </div>

        {/* Priority */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#374151", marginBottom: 6, display: "block" }}>
            Mức độ ưu tiên <span style={{ color: "#EF4444" }}>*</span>
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {(["critical", "urgent", "medium", "low"] as Priority[]).map(p => {
              const cfg = PRI_CFG[p];
              const act = priority === p;
              return (
                <button key={p} type="button" onClick={() => setPriority(p)}
                  style={{ padding: "6px 0", borderRadius: 8, cursor: "pointer",
                    fontSize: 11, fontWeight: 600, textAlign: "center",
                    background: act ? cfg.bg : "#F8FAFC", color: act ? cfg.text : "#64748B",
                    border: `1.5px solid ${act ? cfg.dot : "#E2E8F0"}` }}>
                  <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                    <span style={{ width: 6, height: 6, borderRadius: 99, background: act ? cfg.dot : "#CBD5E1" }} />
                    {cfg.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* SLA Due */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#374151", marginBottom: 5, display: "block" }}>
            Thời hạn hoàn thành (SLA)
          </label>
          <div style={{ display: "flex", gap: 6 }}>
            {[
              { label: "2 giờ", val: 2 },
              { label: "4 giờ", val: 4 },
              { label: "8 giờ", val: 8 },
              { label: "24 giờ", val: 24 }
            ].map(item => (
              <button
                key={item.val}
                type="button"
                onClick={() => setSlaHours(item.val)}
                style={{
                  flex: 1, padding: "5px 0", borderRadius: 6, fontSize: 11, fontWeight: 600,
                  cursor: "pointer",
                  background: slaHours === item.val ? "#0F172A" : "#F8FAFC",
                  color: slaHours === item.val ? "#FFF" : "#475569",
                  border: `1px solid ${slaHours === item.val ? "#0F172A" : "#CBD5E1"}`
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Submit */}
      <div style={{ padding: "12px 16px", borderTop: "1px solid #E2E8F0", flexShrink: 0 }}>
        {error && <p role="alert" style={{ fontSize: 11, color: "#BE123C", background: "#FFF1F2", padding: "8px 10px", borderRadius: 8, marginBottom: 8 }}>{error}</p>}
        {created && (
          <p role="status" style={{ fontSize: 11, color: "#166534", background: "#DCFCE7", padding: "8px 10px", borderRadius: 8, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
            <Check size={14} /> Đã lưu và đồng bộ phiếu công việc lên hệ thống!
          </p>
        )}
        <button disabled={!canCreate} onClick={handleCreate} style={{ width: "100%", height: 38, borderRadius: 8, border: "none",
          background: canCreate ? "#0F172A" : "#CBD5E1", color: "#FFF", fontSize: 12, fontWeight: 700, cursor: canCreate ? "pointer" : "not-allowed",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
          <Send size={13} /> Tạo &amp; Phân công phiếu vào CSDL
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   TECHNICAL CATALOG PANEL
══════════════════════════════════════════════════════════ */
function TechnicalCatalogPanel() {
  const [assets, setAssets]              = useState<Asset[]>([]);
  const [assetSearch, setAssetSearch]     = useState("");
  const [catFilter, setCatFilter]         = useState("Tất cả nhóm");
  const [statusFilter, setStatusFilter]   = useState("Tất cả trạng thái");
  const [showAddModal, setShowAddModal]   = useState(false);
  const [newName, setNewName]             = useState("");
  const [newCat, setNewCat]               = useState("HVAC");
  const [newLoc, setNewLoc]               = useState("");
  const [newModel, setNewModel]           = useState("");
  const [newCycle, setNewCycle]           = useState("3 tháng/lần");

  const loadAssets = () => {
    enterpriseApi.assets()
      .then(rows => {
        const mapped: Asset[] = rows.map(item => ({
          id: item.id,
          name: item.name,
          category: item.category,
          location: item.location,
          brandModel: item.brand_model ?? "Chưa cấu hình",
          installDate: item.installed_on ?? "Chưa cập nhật",
          nextMaintenance: item.next_maintenance ?? "Chưa cấu hình",
          status: item.status === "REPAIRING" ? "repairing" : item.status === "MAINTENANCE_NEEDED" ? "maintenance-needed" : "good",
          cycle: "Theo kế hoạch kỹ thuật",
          cost: `${Number(item.original_value || 0).toLocaleString("vi-VN")} ₫`,
        }));
        setAssets(mapped);
      })
      .catch(error => {
        console.warn("Backend equipment catalog unavailable:", error);
        setAssets([]);
      });
  };

  useEffect(() => {
    loadAssets();
  }, []);

  const filteredAssets = useMemo(() => {
    return assets.filter(a => {
      const matchCat = catFilter === "Tất cả nhóm" || a.category === catFilter;
      const matchStatus =
        statusFilter === "Tất cả trạng thái" ||
        (statusFilter === "Hoạt động tốt" && a.status === "good") ||
        (statusFilter === "Cần bảo dưỡng" && a.status === "maintenance-needed") ||
        (statusFilter === "Đang sửa chữa" && a.status === "repairing");
      const q = assetSearch.toLowerCase().trim();
      const matchSearch =
        !q ||
        a.id.toLowerCase().includes(q) ||
        a.name.toLowerCase().includes(q) ||
        a.location.toLowerCase().includes(q) ||
        a.brandModel.toLowerCase().includes(q);
      return matchCat && matchStatus && matchSearch;
    });
  }, [assets, catFilter, statusFilter, assetSearch]);

  const handleAddAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const newId = `AST-${Date.now()}`;
      await enterpriseApi.createAsset({
        id: newId,
        name: newName,
        category: newCat,
        location_type: "BUILDING",
        location: newLoc,
        brand_model: newModel,
        status: "GOOD",
        original_value: 0
      });
      loadAssets();
      setShowAddModal(false);
      setNewName("");
      setNewLoc("");
      setNewModel("");
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Không thể lưu tài sản.");
    }
  };

  const handleAssetStatus = async (item: Asset) => {
    try {
      const nextStatus = item.status === "good" ? "MAINTENANCE_NEEDED" : "GOOD";
      await enterpriseApi.updateAssetStatus(item.id, nextStatus);
      setAssets(rows => rows.map(row => row.id === item.id ? { ...row, status: nextStatus === "GOOD" ? "good" : "maintenance-needed" } : row));
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Không thể cập nhật trạng thái tài sản.");
    }
  };

  const goodCount   = assets.filter(a => a.status === "good").length;
  const needCount   = assets.filter(a => a.status === "maintenance-needed").length;
  const repairCount = assets.filter(a => a.status === "repairing").length;

  const STATUS_MAP: Record<Asset["status"], { label: string; bg: string; text: string; dot: string }> = {
    good:                 { label: "Hoạt động tốt",     bg: "#DCFCE7", text: "#166534", dot: "#16A34A" },
    "maintenance-needed": { label: "Đến hạn bảo dưỡng", bg: "#FEF3C7", text: "#92400E", dot: "#F59E0B" },
    repairing:            { label: "Đang sửa chữa",     bg: "#FFE4E6", text: "#BE123C", dot: "#EF4444" },
  };

  return (
    <div style={{ padding: "20px 22px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", marginBottom: 3 }}>
            Danh mục thiết bị &amp; Tài sản kỹ thuật
          </h1>
          <p style={{ fontSize: 12, color: "#64748B" }}>
            Dữ liệu tài sản thực tế từ CSDL, hồ sơ máy móc và chu kỳ bảo dưỡng định kỳ
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "#0F172A", color: "#FFF", padding: "8px 14px",
            borderRadius: 8, border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer"
          }}
        >
          <Plus size={14} /> Thêm thiết bị mới
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 20 }}>
        <div style={{ background: "#FFF", borderRadius: 12, border: "1px solid #E2E8F0", padding: "14px 16px" }}>
          <p style={{ fontSize: 11, color: "#64748B", marginBottom: 2 }}>Tổng số thiết bị</p>
          <p style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 22, fontWeight: 800, color: "#0F172A" }}>{assets.length}</p>
          <p style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>Tài sản theo dõi trong CSDL</p>
        </div>
        <div style={{ background: "#FFF", borderRadius: 12, border: "1px solid #E2E8F0", padding: "14px 16px" }}>
          <p style={{ fontSize: 11, color: "#64748B", marginBottom: 2 }}>Vận hành ổn định</p>
          <p style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 22, fontWeight: 800, color: "#16A34A" }}>{goodCount}</p>
          <p style={{ fontSize: 11, color: "#16A34A", marginTop: 2 }}>Đang hoạt động tốt</p>
        </div>
        <div style={{ background: "#FFF", borderRadius: 12, border: "1px solid #E2E8F0", padding: "14px 16px" }}>
          <p style={{ fontSize: 11, color: "#64748B", marginBottom: 2 }}>Đến hạn bảo dưỡng</p>
          <p style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 22, fontWeight: 800, color: "#D97706" }}>{needCount}</p>
          <p style={{ fontSize: 11, color: "#D97706", marginTop: 2 }}>Cần kiểm tra định kỳ</p>
        </div>
        <div style={{ background: "#FFF", borderRadius: 12, border: "1px solid #E2E8F0", padding: "14px 16px" }}>
          <p style={{ fontSize: 11, color: "#64748B", marginBottom: 2 }}>Đang có sự cố / sửa chữa</p>
          <p style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 22, fontWeight: 800, color: "#DC2626" }}>{repairCount}</p>
          <p style={{ fontSize: 11, color: "#DC2626", marginTop: 2 }}>Đã gắn phiếu kỹ thuật</p>
        </div>
      </div>

      {/* Filter bar & Search */}
      <div style={{ background: "#FFF", borderRadius: 12, border: "1px solid #E2E8F0", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,.03)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 18px", borderBottom: "1px solid #E2E8F0", flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 260 }}>
            <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94A3B8" }} />
            <input
              value={assetSearch}
              onChange={e => setAssetSearch(e.target.value)}
              placeholder="Tìm theo mã thiết bị, tên máy, vị trí hoặc nhãn hiệu..."
              style={{ width: "100%", height: 32, paddingLeft: 30, paddingRight: 10, borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 12, outline: "none", boxSizing: "border-box" }}
            />
          </div>

          <div style={{ position: "relative" }}>
            <select
              value={catFilter}
              onChange={e => setCatFilter(e.target.value)}
              style={{ height: 32, padding: "0 26px 0 10px", borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 12, outline: "none", cursor: "pointer", background: "#F8FAFC", appearance: "none" }}
            >
              <option>Tất cả nhóm</option>
              <option>HVAC</option>
              <option>Hệ thống điện</option>
              <option>Thang máy</option>
              <option>Cấp thoát nước</option>
              <option>Hồ bơi</option>
              <option>Thiết bị bếp</option>
              <option>Thiết bị phòng</option>
            </select>
            <ChevronDown size={11} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: "#94A3B8", pointerEvents: "none" }} />
          </div>

          <div style={{ position: "relative" }}>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              style={{ height: 32, padding: "0 26px 0 10px", borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 12, outline: "none", cursor: "pointer", background: "#F8FAFC", appearance: "none" }}
            >
              <option>Tất cả trạng thái</option>
              <option>Hoạt động tốt</option>
              <option>Cần bảo dưỡng</option>
              <option>Đang sửa chữa</option>
            </select>
            <ChevronDown size={11} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: "#94A3B8", pointerEvents: "none" }} />
          </div>
        </div>

        {/* Table */}
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#F8FAFC" }}>
                {["Mã thiết bị", "Tên thiết bị & Thông số", "Nhóm", "Vị trí lắp đặt", "Chu kỳ", "Hạn bảo dưỡng", "Trạng thái", "Thao tác"].map(h => (
                  <th key={h} style={{ padding: "10px 14px", fontSize: 11, fontWeight: 700, color: "#64748B", textAlign: "left", letterSpacing: "0.03em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredAssets.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: "32px 16px", textAlign: "center", color: "#94A3B8", fontSize: 13 }}>
                    Không có thiết bị kỹ thuật nào trong CSDL phù hợp với tìm kiếm.
                  </td>
                </tr>
              ) : (
                filteredAssets.map((item, idx) => {
                  const sta = STATUS_MAP[item.status];
                  return (
                    <tr key={item.id} style={{ borderTop: "1px solid #F1F5F9", background: idx % 2 === 0 ? "#FFF" : "#FAFAFA" }}>
                      <td style={{ padding: "11px 14px", whiteSpace: "nowrap" }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#2563EB", fontFamily: "'JetBrains Mono',monospace" }}>{item.id}</span>
                      </td>
                      <td style={{ padding: "11px 14px" }}>
                        <p style={{ fontSize: 12, fontWeight: 700, color: "#0F172A", marginBottom: 1 }}>{item.name}</p>
                        <p style={{ fontSize: 11, color: "#64748B" }}>{item.brandModel}</p>
                      </td>
                      <td style={{ padding: "11px 14px", whiteSpace: "nowrap" }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: "#475569", background: "#F1F5F9", padding: "2px 8px", borderRadius: 6 }}>
                          {item.category}
                        </span>
                      </td>
                      <td style={{ padding: "11px 14px", fontSize: 12, color: "#334155" }}>{item.location}</td>
                      <td style={{ padding: "11px 14px", fontSize: 12, color: "#64748B", whiteSpace: "nowrap" }}>{item.cycle}</td>
                      <td style={{ padding: "11px 14px", fontSize: 12, fontWeight: 600, color: item.nextMaintenance === "Hôm nay" ? "#DC2626" : "#0F172A", whiteSpace: "nowrap" }}>
                        {item.nextMaintenance}
                      </td>
                      <td style={{ padding: "11px 14px", whiteSpace: "nowrap" }}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 8px", borderRadius: 99, background: sta.bg, color: sta.text, fontSize: 11, fontWeight: 600 }}>
                          <span style={{ width: 6, height: 6, borderRadius: 99, background: sta.dot }} />
                          {sta.label}
                        </div>
                      </td>
                      <td style={{ padding: "11px 14px", whiteSpace: "nowrap" }}>
                        <button
                          onClick={() => void handleAssetStatus(item)}
                          style={{
                            padding: "4px 10px", borderRadius: 6, border: "1px solid #CBD5E1",
                            background: "#FFF", fontSize: 11, fontWeight: 600, color: "#334155", cursor: "pointer"
                          }}
                        >
                          {item.status === "good" ? "Báo bảo trì" : "Xác nhận xong"}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Thêm thiết bị mới */}
      {showAddModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
          <div style={{ width: 440, background: "#FFF", borderRadius: 12, padding: 22, boxShadow: "0 10px 25px rgba(0,0,0,0.15)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: "#0F172A" }}>Thêm thiết bị mới vào danh mục</h2>
              <button onClick={() => setShowAddModal(false)} style={{ border: "none", background: "transparent", color: "#94A3B8", cursor: "pointer" }}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleAddAsset} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#374151", display: "block", marginBottom: 4 }}>Tên thiết bị *</label>
                <input
                  value={newName} onChange={e => setNewName(e.target.value)} required
                  placeholder="VD: Máy hút ẩm công nghiệp"
                  style={{ width: "100%", height: 34, padding: "0 10px", borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 12, boxSizing: "border-box" }}
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#374151", display: "block", marginBottom: 4 }}>Nhóm thiết bị</label>
                  <select
                    value={newCat} onChange={e => setNewCat(e.target.value)}
                    style={{ width: "100%", height: 34, padding: "0 8px", borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 12 }}
                  >
                    <option>HVAC</option>
                    <option>Hệ thống điện</option>
                    <option>Thang máy</option>
                    <option>Cấp thoát nước</option>
                    <option>Hồ bơi</option>
                    <option>Thiết bị bếp</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#374151", display: "block", marginBottom: 4 }}>Chu kỳ bảo dưỡng</label>
                  <select
                    value={newCycle} onChange={e => setNewCycle(e.target.value)}
                    style={{ width: "100%", height: 34, padding: "0 8px", borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 12 }}
                  >
                    <option>1 tháng/lần</option>
                    <option>3 tháng/lần</option>
                    <option>6 tháng/lần</option>
                    <option>1 năm/lần</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#374151", display: "block", marginBottom: 4 }}>Vị trí lắp đặt *</label>
                <input
                  value={newLoc} onChange={e => setNewLoc(e.target.value)} required
                  placeholder="VD: Phòng giặt là tầng hầm"
                  style={{ width: "100%", height: 34, padding: "0 10px", borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 12, boxSizing: "border-box" }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#374151", display: "block", marginBottom: 4 }}>Nhãn hiệu / Model</label>
                <input
                  value={newModel} onChange={e => setNewModel(e.target.value)}
                  placeholder="VD: Electrolux Commercial 50kg"
                  style={{ width: "100%", height: 34, padding: "0 10px", borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 12, boxSizing: "border-box" }}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
                <button
                  type="button" onClick={() => setShowAddModal(false)}
                  style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid #E2E8F0", background: "#FFF", fontSize: 12, cursor: "pointer" }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: "#0F172A", color: "#FFF", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                >
                  Lưu vào CSDL
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════ */
export default function MaintenanceStation({ onBack }: { onBack: () => void }) {
  const [orders, setOrders]                     = useState<WorkOrder[]>([]);
  const [rooms, setRooms]                       = useState<Room[]>([]);
  const [tab, setTab]                           = useState<TicketTab>("all");
  const [section, setSection]                   = useState<TechSection>("all");
  const [statusFilter, setStatusFilter]         = useState("Tất cả trạng thái");
  const [priorityFilter, setPriorityFilter]     = useState("Tất cả mức độ");
  const [search, setSearch]                     = useState("");
  const [isCreateOpen, setIsCreateOpen]         = useState(false);
  const [currentEmployee, setCurrentEmployee]   = useState<{ id: string; name: string; role: string; initials: string } | null>(null);
  const [profileLoading, setProfileLoading]     = useState(true);
  const [profileError, setProfileError]         = useState<string | null>(null);
  const [topProfileOpen, setTopProfileOpen]     = useState(false);
  const [sidebarProfileOpen, setSidebarProfileOpen] = useState(false);

  // Result note modal for WAITING_ACCEPTANCE transition
  const [resultModalOrder, setResultModalOrder] = useState<WorkOrder | null>(null);
  const [resultNoteInput, setResultNoteInput]   = useState("");
  const [resultModalError, setResultModalError] = useState<string | null>(null);

  // Loading and error states for work orders & rooms
  const [loadingData, setLoadingData]           = useState(true);
  const [loadError, setLoadError]               = useState<string | null>(null);

  // Map backend rooms for display lookup
  const roomMap = useMemo(() => {
    return new Map(rooms.map(r => [r.id, r]));
  }, [rooms]);

  const mapWorkOrderWithMap = (workOrder: TechnicalWorkOrder, map: Map<string, Room>, index = 0): WorkOrder => {
    const rawPriority = String(workOrder.priority).toUpperCase();
    const priority: Priority =
      rawPriority === "CRITICAL" ? "critical" :
      rawPriority === "HIGH" ? "urgent" :
      rawPriority === "MEDIUM" ? "medium" : "low";

    const r = map.get(workOrder.room_id);
    const roomAreaDisplay = r ? `Phòng ${r.name || r.id} (${r.id})` : `Phòng ${workOrder.room_id}`;
    const areaTypeDisplay = r?.room_type_name ? `${r.room_type_name} · Tầng ${r.floor}` : "Khu vực kỹ thuật phòng";

    // Tab classification based on backend data
    const isRoomTicket = Boolean(r || workOrder.room_id.startsWith("R"));
    const isPreventive = (workOrder.materials || "").toLowerCase().includes("định kỳ") ||
                         (workOrder.materials || "").toLowerCase().includes("bảo dưỡng");
    const tabs: TicketTab[] = ["all"];
    if (isRoomTicket) tabs.push("rooms");
    if (!isRoomTicket || (workOrder.materials || "").toLowerCase().includes("sảnh") || (workOrder.materials || "").toLowerCase().includes("thang máy") || (workOrder.materials || "").toLowerCase().includes("hồ bơi")) {
      tabs.push("public");
    }
    if (isPreventive) tabs.push("preventive");

    const statusVal: TicketStatus = workOrder.status as TicketStatus;

    return {
      id: `#${workOrder.id}`,
      rawId: Number(workOrder.id),
      roomId: workOrder.room_id,
      roomName: r?.name || workOrder.room_id,
      roomArea: roomAreaDisplay,
      areaType: areaTypeDisplay,
      equipmentId: workOrder.equipment_id,
      issue: normalizeVietnameseText(workOrder.materials) || "Phiếu công việc kỹ thuật",
      issueDetail: normalizeVietnameseText(workOrder.result_note || workOrder.acceptance_note) || "Đang xử lý theo phiếu",
      priority,
      assignedTo: normalizeVietnameseText(workOrder.assignee) || "Kỹ thuật trực ca",
      assignedInitials: (workOrder.assignee || "KT").slice(0, 2).toUpperCase(),
      assignedColor: ["#3B82F6", "#8B5CF6", "#14B8A6", "#F59E0B"][index % 4],
      roomLock: statusVal !== "ROOM_RELEASED",
      etaDate: workOrder.sla_due_at ? new Date(workOrder.sla_due_at).toLocaleDateString("vi-VN") : "Hôm nay",
      etaTime: workOrder.sla_due_at ? new Date(workOrder.sla_due_at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "Trong ca",
      status: statusVal,
      resultNote: workOrder.result_note,
      acceptanceNote: workOrder.acceptance_note,
      acceptedBy: workOrder.accepted_by,
      createdBy: workOrder.created_by,
      tab: tabs,
    };
  };

  const mapWorkOrder = (workOrder: TechnicalWorkOrder, index = 0): WorkOrder =>
    mapWorkOrderWithMap(workOrder, roomMap, index);

  // 1. Load real logged in employee profile without synthetic fallback
  const loadProfile = () => {
    setProfileLoading(true);
    setProfileError(null);
    authApi.employeeProfile()
      .then(profile => {
        if (!profile) throw new Error("Không nhận được dữ liệu hồ sơ nhân viên.");
        const name = profile.full_name || profile.employee_id;
        const parts = name.trim().split(" ");
        const initials = (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : name.slice(0, 2)).toUpperCase();
        setCurrentEmployee({
          id: profile.employee_id,
          name,
          role: profile.role === "TECHNICAL" ? "Kỹ thuật viên" : profile.role,
          initials,
        });
      })
      .catch(err => {
        console.warn("Backend technician profile unavailable:", err);
        setCurrentEmployee(null);
        setProfileError(err instanceof Error ? err.message : "Không thể tải hồ sơ kỹ thuật viên từ máy chủ.");
      })
      .finally(() => {
        setProfileLoading(false);
      });
  };

  useEffect(() => {
    loadProfile();
  }, []);

  // 2. Load real rooms and work orders concurrently
  const loadData = () => {
    setLoadingData(true);
    setLoadError(null);
    Promise.all([
      housekeepingTechnicalApi.rooms(),
      housekeepingTechnicalApi.workOrders()
    ])
      .then(([roomList, workOrders]) => {
        setRooms(roomList);
        const map = new Map(roomList.map(r => [r.id, r]));
        const mapped = workOrders.map((wo, i) => mapWorkOrderWithMap(wo, map, i));
        setOrders(mapped);
      })
      .catch(err => {
        console.warn("Backend technical data unavailable:", err);
        setLoadError(err instanceof Error ? err.message : "Không thể tải danh sách phiếu kỹ thuật và phòng từ CSDL.");
      })
      .finally(() => {
        setLoadingData(false);
      });
  };

  useEffect(() => {
    loadData();
  }, []);

  // Handle create work order
  const handleCreateOrder = async (req: {
    roomId: string;
    equipmentId?: number;
    category: string;
    description: string;
    priority: Priority;
    slaDueHours?: number;
  }): Promise<boolean> => {
    const backendPriority =
      req.priority === "critical" ? "CRITICAL" :
      req.priority === "urgent" ? "HIGH" :
      req.priority === "medium" ? "MEDIUM" : "LOW";

    const slaDueAt = req.slaDueHours
      ? new Date(Date.now() + req.slaDueHours * 3600 * 1000).toISOString()
      : undefined;

    try {
      const created = await housekeepingTechnicalApi.createWorkOrder({
        room_id: req.roomId,
        equipment_id: req.equipmentId,
        priority: backendPriority,
        materials: `[${req.category}] ${req.description}`.trim(),
        sla_due_at: slaDueAt,
      });
      const mapped = mapWorkOrder(created, orders.length);
      setOrders(prev => [mapped, ...prev]);
      return true;
    } catch (err) {
      console.warn("Backend work-order creation unavailable:", err);
      throw err;
    }
  };

  // State machine transition handlers
  const handleAcknowledge = async (order: WorkOrder) => {
    try {
      const updated = await housekeepingTechnicalApi.updateWorkOrder(order.rawId, {
        status: "ACKNOWLEDGED"
      });
      setOrders(prev => prev.map(o => o.rawId === order.rawId ? mapWorkOrder(updated) : o));
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Không thể tiếp nhận phiếu.");
    }
  };

  const handleStartWork = async (order: WorkOrder) => {
    try {
      const updated = await housekeepingTechnicalApi.updateWorkOrder(order.rawId, {
        status: "IN_PROGRESS"
      });
      setOrders(prev => prev.map(o => o.rawId === order.rawId ? mapWorkOrder(updated) : o));
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Không thể chuyển trạng thái đang xử lý.");
    }
  };

  const openResultModal = (order: WorkOrder) => {
    setResultModalOrder(order);
    setResultNoteInput("");
    setResultModalError(null);
  };

  const submitResultNote = async () => {
    if (!resultModalOrder) return;
    if (!resultNoteInput.trim()) {
      setResultModalError("Vui lòng ghi nhận kết quả xử lý hoặc linh kiện đã thay thế.");
      return;
    }
    try {
      const updated = await housekeepingTechnicalApi.updateWorkOrder(resultModalOrder.rawId, {
        status: "WAITING_ACCEPTANCE",
        result_note: resultNoteInput.trim(),
      });
      setOrders(prev => prev.map(o => o.rawId === resultModalOrder.rawId ? mapWorkOrder(updated) : o));
      setResultModalOrder(null);
    } catch (err) {
      setResultModalError(err instanceof Error ? err.message : "Lỗi khi báo hoàn thành.");
    }
  };

  const handleReleaseRoom = async (order: WorkOrder) => {
    if (!window.confirm(`Xác nhận mở khóa phòng ${order.roomId} trên hệ thống PMS để đón khách?`)) return;
    try {
      const released = await housekeepingTechnicalApi.release(order.rawId);
      const mapped = mapWorkOrder(released);
      setOrders(prev => prev.map(o => o.rawId === order.rawId ? mapped : o));
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Không thể mở khóa phòng trên backend.");
    }
  };

  const filtered = useMemo(() => {
    let rs = orders.filter(o => o.tab.includes(tab));
    if (statusFilter !== "Tất cả trạng thái") {
      const map: Record<string, TicketStatus> = {
        "Mới tạo": "NEW",
        "Đã tiếp nhận": "ACKNOWLEDGED",
        "Đang xử lý": "IN_PROGRESS",
        "Chờ nghiệm thu": "WAITING_ACCEPTANCE",
        "Đã nghiệm thu": "COMPLETED",
        "Đã mở phòng (Xong)": "ROOM_RELEASED",
      };
      const target = map[statusFilter];
      if (target) rs = rs.filter(o => o.status === target);
    }
    if (priorityFilter !== "Tất cả mức độ") {
      const map: Record<string, Priority> = {
        "Nghiêm trọng": "critical",
        "Khẩn cấp": "urgent",
        "Trung bình": "medium",
        "Thấp": "low"
      };
      const target = map[priorityFilter];
      if (target) rs = rs.filter(o => o.priority === target);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      rs = rs.filter(o =>
        o.id.toLowerCase().includes(q) ||
        o.roomArea.toLowerCase().includes(q) ||
        o.issue.toLowerCase().includes(q) ||
        o.issueDetail.toLowerCase().includes(q) ||
        o.assignedTo.toLowerCase().includes(q)
      );
    }
    return rs;
  }, [orders, tab, statusFilter, priorityFilter, search]);

  const TAB_COUNTS: Record<TicketTab, number> = {
    all:        orders.length,
    rooms:      orders.filter(o => o.tab.includes("rooms")).length,
    public:     orders.filter(o => o.tab.includes("public")).length,
    preventive: orders.filter(o => o.tab.includes("preventive")).length,
  };

  // Dynamic KPI calculations based on live backend data
  const activeCount       = orders.filter(o => o.status !== "ROOM_RELEASED").length;
  const criticalCount     = orders.filter(o => (o.priority === "urgent" || o.priority === "critical") && o.status !== "ROOM_RELEASED").length;
  const waitingAccCount   = orders.filter(o => o.status === "WAITING_ACCEPTANCE").length;
  const completedCount    = orders.filter(o => o.status === "COMPLETED" || o.status === "ROOM_RELEASED").length;

  const technicianName = profileLoading ? "Đang tải..." : profileError ? "Lỗi tải hồ sơ" : currentEmployee?.name || "Kỹ thuật viên";
  const technicianRole = profileLoading ? "Đang kết nối..." : profileError ? "Chưa xác thực" : currentEmployee?.role || "Kỹ thuật viên";
  const technicianInitials = profileLoading ? "..." : profileError ? "!" : currentEmployee?.initials || "KT";

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden",
      background: "#F8FAFC", fontFamily: "'Inter',system-ui,sans-serif" }}>

      {/* ── SIDEBAR ── */}
      <aside style={{ width: 210, background: "#FFF", borderRight: "1px solid #E2E8F0",
        display: "flex", flexDirection: "column", flexShrink: 0, overflow: "hidden" }}>
        {/* Brand */}
        <div style={{ padding: "14px 14px 12px", borderBottom: "1px solid #E2E8F0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <img
              src="/hotel_logo.png"
              alt="MAM Hotel Logo"
              style={{ width: 36, height: "auto", objectFit: "contain", flexShrink: 0, filter: "drop-shadow(0 2px 6px rgba(184,148,74,0.35))" }}
            />
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", lineHeight: 1.1, fontFamily: "'Cormorant Garamond',Georgia,serif", letterSpacing: "0.05em" }}>MAM HOTEL</p>
              <p style={{ fontSize: 9, color: "#EA580C", letterSpacing: "0.08em", textTransform: "uppercase", marginTop: 2, fontWeight: 600 }}>KỸ THUẬT &amp; BẢO TRÌ</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "10px 8px", overflowY: "auto" }}>
          <div style={{ padding: "4px 8px 8px", fontSize: 10, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.05em", textTransform: "uppercase" }}>
            Quản lý công việc
          </div>
          {SIDEBAR_NAV.map(n => {
            const active = section === n.id;
            return <button key={n.id} onClick={() => {
              setSection(n.id);
              if (n.id !== "catalog") setTab(n.id);
            }}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 9,
                padding: "9px 10px", borderRadius: 8, cursor: "pointer", marginBottom: 2, border: "none",
                background: active ? "#0F172A" : "transparent",
                color: active ? "#FFF" : "#475569", fontWeight: active ? 600 : 400, fontSize: 12,
                textAlign: "left", transition: "all .1s" }}>
              <n.Icon size={15} style={{ color: active ? "#FFF" : "#64748B", flexShrink: 0 }} strokeWidth={active ? 2 : 1.5} />
              {n.label}
            </button>;
          })}
        </nav>

        {/* Profile */}
        <div style={{ padding: "10px 14px", borderTop: "1px solid #F1F5F9", position: "relative" }}>
          {profileError ? (
            <div style={{ padding: "8px 10px", borderRadius: 8, background: "#FEF2F2", border: "1px solid #FCA5A5", marginBottom: 8 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#991B1B", marginBottom: 4 }}>Lỗi tải hồ sơ</p>
              <button
                onClick={loadProfile}
                style={{ fontSize: 11, fontWeight: 600, color: "#DC2626", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", padding: 0 }}
              >
                Thử lại
              </button>
            </div>
          ) : (
            <div
              onClick={() => setSidebarProfileOpen(p => !p)}
              style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, cursor: "pointer" }}
              title="Hồ sơ nhân viên"
            >
              <div style={{ width: 30, height: 30, borderRadius: 99, flexShrink: 0,
                background: "linear-gradient(135deg,#1D4ED8,#3B82F6)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, fontWeight: 800, color: "#FFF" }}>{technicianInitials}</div>
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: "#0F172A", lineHeight: 1 }}>{technicianName}</p>
                <p style={{ fontSize: 10, color: "#94A3B8" }}>{technicianRole}</p>
              </div>
            </div>
          )}
          <button onClick={onBack}
            style={{ display: "flex", alignItems: "center", gap: 5, color: "#94A3B8", cursor: "pointer", fontSize: 11, background: "transparent", border: "none", padding: 0 }}>
            <LogOut size={11} /> Đăng xuất
          </button>
          <EmployeeProfileDropdown
            isOpen={sidebarProfileOpen}
            onClose={() => setSidebarProfileOpen(false)}
            onLogout={onBack}
            align="bottom-left"
            currentRoleLabel="Kỹ thuật & Bảo trì"
            departmentName="Bộ phận Kỹ thuật"
          />
        </div>
      </aside>

      {/* ── MAIN ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>

        {/* HEADER */}
        <header style={{ background: "#FFF", borderBottom: "1px solid #E2E8F0", height: 54,
          display: "flex", alignItems: "center", gap: 14, padding: "0 22px", flexShrink: 0 }}>
          <div style={{ position: "relative", flex: 1, maxWidth: 520 }}>
            <Search size={14} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "#94A3B8", pointerEvents: "none" }} />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Tìm theo mã phiếu, phòng, sự cố, người xử lý..."
              style={{ width: "100%", height: 35, paddingLeft: 33, paddingRight: 12, borderRadius: 8,
                border: "1px solid #CBD5E1", background: "#F8FAFC", fontSize: 12, outline: "none", boxSizing: "border-box" }} />
          </div>
          <div style={{ flex: 1 }} />

          <button onClick={() => setIsCreateOpen(prev => !prev)}
            style={{ display: "flex", alignItems: "center", gap: 6, background: isCreateOpen ? "#2563EB" : "#0F172A", color: "#FFF",
              padding: "7px 14px", borderRadius: 8, border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "background .15s" }}>
            <Plus size={14} /> {isCreateOpen ? "Đóng form" : "Tạo phiếu mới"}
          </button>

          <button style={{ width: 35, height: 35, borderRadius: 8, background: "#F8FAFC", border: "1px solid #E2E8F0",
            display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", position: "relative" }}>
            <Bell size={14} style={{ color: "#475569" }} />
            {criticalCount > 0 && <span style={{ position: "absolute", top: 7, right: 7, width: 7, height: 7, borderRadius: 99, background: "#EF4444" }} />}
          </button>

          <div style={{ position: "relative" }}>
            <div
              onClick={() => setTopProfileOpen(p => !p)}
              style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 4, borderLeft: "1px solid #E2E8F0", cursor: "pointer" }}
              title="Hồ sơ nhân viên"
            >
              <div style={{ width: 32, height: 32, borderRadius: 99,
                background: "linear-gradient(135deg,#3B82F6,#1D4ED8)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 800, color: "#FFF" }}>{technicianInitials}</div>
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#0F172A", lineHeight: 1.1 }}>{technicianName}</p>
                <p style={{ fontSize: 10, color: "#94A3B8" }}>{technicianRole}</p>
              </div>
              <ChevronDown size={12} style={{ color: "#94A3B8" }} />
            </div>
            <EmployeeProfileDropdown
              isOpen={topProfileOpen}
              onClose={() => setTopProfileOpen(false)}
              onLogout={onBack}
              align="top-right"
              currentRoleLabel="Kỹ thuật & Bảo trì"
              departmentName="Bộ phận Kỹ thuật"
            />
          </div>
        </header>

        {/* SCROLL AREA */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {section === "catalog" ? <TechnicalCatalogPanel /> : (
          <div style={{ padding: "20px 22px" }}>

            {/* Page title */}
            <div style={{ marginBottom: 18, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", marginBottom: 3 }}>Trung tâm Kỹ thuật &amp; Bảo trì</h1>
                <p style={{ fontSize: 12, color: "#64748B" }}>
                  Đồng bộ thời gian thực với backend Spring Boot: Tiếp nhận sự cố, xử lý phiếu công việc và mở khóa phòng PMS sau nghiệm thu
                </p>
              </div>
              <button onClick={loadData} title="Làm mới dữ liệu từ server"
                style={{ display: "flex", alignItems: "center", gap: 6, background: "#FFF", border: "1px solid #CBD5E1", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, color: "#334155", cursor: "pointer" }}>
                Cập nhật dữ liệu
              </button>
            </div>

            {/* KPI CARDS */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 20 }}>
              {[
                { label: "Phiếu đang mở",       Icon: Wrench,        iconBg: "#DBEAFE", iconColor: "#2563EB", val: activeCount,     sub: "Cần theo dõi & xử lý",   subUp: false },
                { label: "Sự cố khẩn cấp",     Icon: AlertTriangle, iconBg: "#FFE4E6", iconColor: "#DC2626", val: criticalCount,   sub: "Ưu tiên can thiệp ngay", subUp: false },
                { label: "Chờ nghiệm thu",     Icon: Cog,           iconBg: "#FEF9C3", iconColor: "#D97706", val: waitingAccCount, sub: "Đã sửa, đợi quản lý",   subUp: false },
                { label: "Đã giải quyết",      Icon: CheckCircle2,  iconBg: "#DCFCE7", iconColor: "#16A34A", val: completedCount,  sub: "Đã nghiệm thu / mở phòng", subUp: true },
              ].map(k => (
                <div key={k.label} style={{ background: "#FFF", borderRadius: 12, border: "1px solid #E2E8F0",
                  padding: "15px 18px", display: "flex", alignItems: "center", gap: 14,
                  boxShadow: "0 1px 3px rgba(0,0,0,.03)" }}>
                  <div style={{ width: 44, height: 44, borderRadius: 11, background: k.iconBg, flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <k.Icon size={20} style={{ color: k.iconColor }} />
                  </div>
                  <div>
                    <p style={{ fontSize: 11, color: "#64748B", marginBottom: 3, fontWeight: 500 }}>{k.label}</p>
                    <p style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 24, fontWeight: 800,
                      color: "#0F172A", lineHeight: 1, marginBottom: 3 }}>{k.val}</p>
                    <p style={{ fontSize: 11, color: k.subUp ? "#16A34A" : "#64748B", fontWeight: k.subUp ? 600 : 400 }}>{k.sub}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* TABS + FILTERS */}
            <div style={{ background: "#FFF", borderRadius: 12, border: "1px solid #E2E8F0",
              overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,.03)" }}>

              <div style={{ display: "flex", alignItems: "center", gap: 0, padding: "0 18px",
                borderBottom: "1px solid #E2E8F0", flexWrap: "wrap" }}>
                {([
                  ["all", "Tất cả phiếu"],
                  ["rooms", "Phòng khách"],
                  ["public", "Khu vực chung"],
                  ["preventive", "Bảo trì định kỳ"]
                ] as [TicketTab, string][]).map(([v, l]) => {
                  const act = tab === v;
                  return (
                    <button key={v} onClick={() => { setTab(v); setSection(v); }}
                      style={{ padding: "12px 16px", fontSize: 13, fontWeight: act ? 600 : 400, cursor: "pointer",
                        color: act ? "#0F172A" : "#64748B", background: "transparent", border: "none",
                        borderBottom: act ? "2px solid #0F172A" : "2px solid transparent",
                        whiteSpace: "nowrap", marginBottom: -1 }}>
                      {l} <span style={{ fontSize: 11,
                        background: act ? "#0F172A" : "#F1F5F9", color: act ? "#FFF" : "#64748B",
                        padding: "1px 6px", borderRadius: 99, marginLeft: 4, fontWeight: 600 }}>{TAB_COUNTS[v]}</span>
                    </button>
                  );
                })}
                <div style={{ flex: 1 }} />

                {/* Status filter */}
                <div style={{ position: "relative", marginRight: 8, marginBlock: 6 }}>
                  <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                    style={{ height: 32, padding: "0 26px 0 10px", borderRadius: 8, border: "1px solid #CBD5E1",
                      background: "#F8FAFC", fontSize: 12, outline: "none", cursor: "pointer", appearance: "none", color: "#334155" }}>
                    {["Tất cả trạng thái", "Mới tạo", "Đã tiếp nhận", "Đang xử lý", "Chờ nghiệm thu", "Đã nghiệm thu", "Đã mở phòng (Xong)"].map(s => <option key={s}>{s}</option>)}
                  </select>
                  <ChevronDown size={11} style={{ position: "absolute", right: 7, top: "50%", transform: "translateY(-50%)", color: "#94A3B8", pointerEvents: "none" }} />
                </div>

                {/* Priority filter */}
                <div style={{ position: "relative", marginRight: 8, marginBlock: 6 }}>
                  <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}
                    style={{ height: 32, padding: "0 26px 0 10px", borderRadius: 8, border: "1px solid #CBD5E1",
                      background: "#F8FAFC", fontSize: 12, outline: "none", cursor: "pointer", appearance: "none", color: "#334155" }}>
                    {["Tất cả mức độ", "Nghiêm trọng", "Khẩn cấp", "Trung bình", "Thấp"].map(s => <option key={s}>{s}</option>)}
                  </select>
                  <ChevronDown size={11} style={{ position: "absolute", right: 7, top: "50%", transform: "translateY(-50%)", color: "#94A3B8", pointerEvents: "none" }} />
                </div>
              </div>

              {/* TABLE */}
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#F8FAFC" }}>
                      {["Mã phiếu", "Vị trí / Khu vực", "Mô tả sự cố & Kết quả", "Mức ưu tiên", "Kỹ thuật viên", "Khóa phòng PMS", "Hạn SLA", "Trạng thái", "Thao tác"].map(h => (
                        <th key={h} style={{ padding: "10px 14px", fontSize: 11, fontWeight: 700, color: "#64748B",
                          textAlign: "left", letterSpacing: "0.03em", textTransform: "uppercase",
                          whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loadingData ? (
                      <tr>
                        <td colSpan={9} style={{ padding: "36px 16px", textAlign: "center", color: "#64748B", fontSize: 13 }}>
                          Đang tải dữ liệu phiếu kỹ thuật từ CSDL...
                        </td>
                      </tr>
                    ) : loadError ? (
                      <tr>
                        <td colSpan={9} style={{ padding: "36px 16px", textAlign: "center", color: "#BE123C", fontSize: 13 }}>
                          <p style={{ marginBottom: 8, fontWeight: 600 }}>{loadError}</p>
                          <button
                            onClick={loadData}
                            style={{ padding: "6px 14px", borderRadius: 6, background: "#0F172A", color: "#FFF", border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                          >
                            Thử lại
                          </button>
                        </td>
                      </tr>
                    ) : filtered.length === 0 ? (
                      <tr>
                        <td colSpan={9} style={{ padding: "36px 16px", textAlign: "center", color: "#94A3B8", fontSize: 13 }}>
                          Không có phiếu công việc nào trong CSDL phù hợp với bộ lọc hiện tại.
                        </td>
                      </tr>
                    ) : (
                      filtered.map((o, i) => {
                        const priCfg = PRI_CFG[o.priority];
                        const staCfg = STA_CFG[o.status];
                        const isReleased = o.status === "ROOM_RELEASED";
                        const isCompleted = o.status === "COMPLETED";
                        const isWaitingAcceptance = o.status === "WAITING_ACCEPTANCE";
                        const isInProgress = o.status === "IN_PROGRESS";
                        const isNew = o.status === "NEW";
                        const isAcknowledged = o.status === "ACKNOWLEDGED";

                        return (
                          <tr key={o.id} style={{ borderTop: "1px solid #F1F5F9",
                            background: i % 2 === 0 ? "#FFF" : "#FAFAFA",
                            transition: "background .1s" }}>
                            {/* Ticket ID */}
                            <td style={{ padding: "11px 14px" }}>
                              <span style={{ fontSize: 12, fontWeight: 700, color: "#2563EB",
                                fontFamily: "'JetBrains Mono',monospace", whiteSpace: "nowrap" }}>{o.id}</span>
                            </td>
                            {/* Room / Area */}
                            <td style={{ padding: "11px 14px" }}>
                              <p style={{ fontSize: 13, fontWeight: 600, color: "#0F172A", marginBottom: 1 }}>{o.roomArea}</p>
                              <p style={{ fontSize: 11, color: "#94A3B8" }}>{o.areaType}</p>
                            </td>
                            {/* Issue & Result Note */}
                            <td style={{ padding: "11px 14px", maxWidth: 260 }}>
                              <p style={{ fontSize: 12, fontWeight: 600, color: "#0F172A", marginBottom: 2 }}>{o.issue}</p>
                              {o.resultNote && (
                                <p style={{ fontSize: 11, color: "#166534", background: "#F0FDF4", padding: "2px 6px", borderRadius: 4, display: "inline-block", marginBottom: 2 }}>
                                  KQ: {o.resultNote}
                                </p>
                              )}
                              {o.acceptanceNote && (
                                <p style={{ fontSize: 11, color: "#0369A1", background: "#F0F9FF", padding: "2px 6px", borderRadius: 4, display: "inline-block" }}>
                                  Duyệt: {o.acceptanceNote} ({o.acceptedBy})
                                </p>
                              )}
                            </td>
                            {/* Priority */}
                            <td style={{ padding: "11px 14px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                <span style={{ width: 7, height: 7, borderRadius: 99, background: priCfg.dot, flexShrink: 0 }} />
                                <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 99,
                                  background: priCfg.bg, color: priCfg.text, whiteSpace: "nowrap" }}>{priCfg.label}</span>
                              </div>
                            </td>
                            {/* Assigned */}
                            <td style={{ padding: "11px 14px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                                <div style={{ width: 26, height: 26, borderRadius: 99, flexShrink: 0,
                                  background: o.assignedColor, display: "flex", alignItems: "center",
                                  justifyContent: "center", fontSize: 9, fontWeight: 800, color: "#FFF" }}>
                                  {o.assignedInitials}
                                </div>
                                <span style={{ fontSize: 12, color: "#334155", whiteSpace: "nowrap", fontWeight: 500 }}>{o.assignedTo}</span>
                              </div>
                            </td>
                            {/* Room Lock PMS */}
                            <td style={{ padding: "11px 14px", whiteSpace: "nowrap" }}>
                              {isReleased ? (
                                <div style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 8px", borderRadius: 99, background: "#DCFCE7", color: "#166534", fontSize: 11, fontWeight: 600 }}>
                                  <Unlock size={11} /> Đã mở phòng
                                </div>
                              ) : isCompleted ? (
                                <button
                                  onClick={() => void handleReleaseRoom(o)}
                                  title="Nhấn để mở khóa phòng bàn giao cho Lễ tân / Buồng phòng"
                                  style={{
                                    display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px",
                                    borderRadius: 8, background: "#0F172A", color: "#FFF", fontSize: 11, fontWeight: 700,
                                    border: "none", cursor: "pointer", boxShadow: "0 1px 2px rgba(0,0,0,0.1)"
                                  }}
                                >
                                  <Unlock size={12} style={{ color: "#34D399" }} /> Mở khóa phòng
                                </button>
                              ) : (
                                <div style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 8px", borderRadius: 99, background: "#FEE2E2", color: "#991B1B", fontSize: 11, fontWeight: 600 }}>
                                  <Lock size={11} /> Đang khóa (PMS)
                                </div>
                              )}
                            </td>
                            {/* ETA */}
                            <td style={{ padding: "11px 14px", whiteSpace: "nowrap" }}>
                              <p style={{ fontSize: 11, color: "#64748B" }}>{o.etaDate}</p>
                              <p style={{ fontSize: 12, fontWeight: 700, color: "#0F172A" }}>{o.etaTime}</p>
                            </td>
                            {/* Status Badge */}
                            <td style={{ padding: "11px 14px", whiteSpace: "nowrap" }}>
                              <div style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 8px", borderRadius: 99,
                                background: staCfg.bg, color: staCfg.text, fontSize: 11, fontWeight: 600 }}>
                                <span style={{ width: 6, height: 6, borderRadius: 99, background: staCfg.dot }} />
                                {staCfg.label}
                              </div>
                            </td>
                            {/* Action Button */}
                            <td style={{ padding: "11px 14px", whiteSpace: "nowrap" }}>
                              {isNew && (
                                <button
                                  onClick={() => void handleAcknowledge(o)}
                                  style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid #93C5FD",
                                    background: "#EFF6FF", fontSize: 11, fontWeight: 700, color: "#1D4ED8", cursor: "pointer" }}
                                >
                                  Tiếp nhận
                                </button>
                              )}
                              {isAcknowledged && (
                                <button
                                  onClick={() => void handleStartWork(o)}
                                  style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid #7DD3FC",
                                    background: "#F0F9FF", fontSize: 11, fontWeight: 700, color: "#0369A1", cursor: "pointer" }}
                                >
                                  Bắt đầu sửa
                                </button>
                              )}
                              {isInProgress && (
                                <button
                                  onClick={() => openResultModal(o)}
                                  style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid #FCD34D",
                                    background: "#FEFCE8", fontSize: 11, fontWeight: 700, color: "#854D0E", cursor: "pointer" }}
                                >
                                  Báo hoàn thành
                                </button>
                              )}
                              {isWaitingAcceptance && (
                                <span style={{
                                  fontSize: 11, color: "#854D0E", background: "#FEF9C3",
                                  padding: "3px 8px", borderRadius: 6, fontWeight: 600, display: "inline-block"
                                }}>
                                  Chờ quản lý nghiệm thu
                                </span>
                              )}
                              {isCompleted && (
                                <button
                                  onClick={() => void handleReleaseRoom(o)}
                                  style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid #6EE7B7",
                                    background: "#ECFDF5", fontSize: 11, fontWeight: 700, color: "#047857", cursor: "pointer" }}
                                >
                                  Mở phòng
                                </button>
                              )}
                              {isReleased && (
                                <span style={{ fontSize: 11, color: "#16A34A", fontWeight: 600, display: "flex", alignItems: "center", gap: 3 }}>
                                  <CheckCircle2 size={13} /> Hoàn tất
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "11px 18px", borderTop: "1px solid #E2E8F0", background: "#F8FAFC" }}>
                <span style={{ fontSize: 12, color: "#64748B" }}>Hiển thị {filtered.length} trên tổng số {orders.length} phiếu công việc CSDL</span>
                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  <button style={{ width: 26, height: 26, borderRadius: 6, border: "1px solid #E2E8F0", background: "#FFF",
                    cursor: "pointer", color: "#94A3B8", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <ChevronLeft size={13} />
                  </button>
                  <button style={{ width: 26, height: 26, borderRadius: 6, border: "none", background: "#0F172A",
                    cursor: "pointer", color: "#FFF", fontSize: 12, fontWeight: 700 }}>1</button>
                  <button style={{ width: 26, height: 26, borderRadius: 6, border: "1px solid #E2E8F0", background: "#FFF",
                    cursor: "pointer", color: "#475569", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <ChevronRight size={13} />
                  </button>
                </div>
              </div>
            </div>

          </div>
          )}
        </div>
      </div>

      {/* ── RIGHT PANEL: CREATE WORK ORDER ── */}
      {isCreateOpen && section !== "catalog" && (
        <CreatePanel
          rooms={rooms}
          onClose={() => setIsCreateOpen(false)}
          onCreate={handleCreateOrder}
        />
      )}

      {/* ── MODAL: BÁO HOÀN THÀNH (NHẬP RESULT NOTE) ── */}
      {resultModalOrder && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
          <div style={{ width: 440, background: "#FFF", borderRadius: 12, padding: 22, boxShadow: "0 10px 25px rgba(0,0,0,0.15)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: "#0F172A" }}>Báo cáo kết quả xử lý sự cố</h2>
              <button onClick={() => setResultModalOrder(null)} style={{ border: "none", background: "transparent", color: "#94A3B8", cursor: "pointer" }}>
                <X size={16} />
              </button>
            </div>
            <p style={{ fontSize: 12, color: "#64748B", marginBottom: 12 }}>
              Phiếu <strong>{resultModalOrder.id}</strong> ({resultModalOrder.roomArea}): Để chuyển sang trạng thái chờ Quản lý nghiệm thu, kỹ thuật viên phải ghi rõ phương án đã xử lý và linh kiện thay thế.
            </p>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#374151", display: "block", marginBottom: 4 }}>
                Kết quả xử lý &amp; Vật tư linh kiện *
              </label>
              <textarea
                value={resultNoteInput}
                onChange={e => setResultNoteInput(e.target.value)}
                placeholder="VD: Đã nạp lại gas R32 và vệ sinh lưới lọc dàn lạnh, nhiệt độ phòng đã mát sâu..."
                style={{ width: "100%", height: 80, padding: "8px 10px", borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 12, boxSizing: "border-box", resize: "none" }}
              />
            </div>
            {resultModalError && (
              <p style={{ fontSize: 11, color: "#BE123C", background: "#FFF1F2", padding: "6px 10px", borderRadius: 6, marginBottom: 10 }}>
                {resultModalError}
              </p>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                onClick={() => setResultModalOrder(null)}
                style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid #E2E8F0", background: "#FFF", fontSize: 12, cursor: "pointer" }}
              >
                Hủy
              </button>
              <button
                onClick={submitResultNote}
                style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: "#0F172A", color: "#FFF", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
              >
                Gửi chờ nghiệm thu
              </button>
            </div>
          </div>
        </div>
      )}


    </div>
  );
}
