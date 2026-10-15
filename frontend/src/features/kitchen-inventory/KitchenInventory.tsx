import { ServiceScheduleDialog } from "./ServiceScheduleDialog";
import { ServiceCoordination } from "./ServiceCoordination";
import { useEffect, useState, useMemo, useRef } from "react";
import ConsumptionReports from "./ConsumptionReports";
import StockReturnsPanel from "../stock-returns/StockReturnsPanel";
import ProposalDialog from "./ProposalDialog";
import StockNotifications, { type StockActivity } from "./StockNotifications";
import StockVoucherDialog from "./StockVoucherDialog";
import type { VoucherMovement } from "./stockVoucher";
import { catalogProposalsApi, type CatalogProposal } from "../../shared/api/catalogProposals";
import { serviceAvailabilityApi, type ServiceAvailability } from "../../shared/api/serviceAvailability";
import { kitchenAccountingApi, newKitchenIdempotencyKey } from "../../shared/api/kitchenAccounting";
import { authApi } from "../../shared/api/auth";
import { ApiError, apiErrorMessage } from "../../shared/api/client";
import { EmployeeProfileDropdown } from "../../shared/components/EmployeeProfileDropdown";
import type { Approval, MovementType, Service, InventoryMovement, RestaurantBooking } from "../../shared/types/kitchenAccounting";
import { employeeRoleLabel } from "../../shared/types/api";
import type { EmployeeProfileDto } from "../../shared/types/api";
import { localDateValue } from "../../shared/utils/localDate";
import { formatVnd } from "../../shared/utils/money";
import {
  Package, ArrowLeftRight, Tag, BarChart2,
  Search, ChevronDown, Plus,
  AlertTriangle, ShoppingCart, FileText,
  MoreVertical, ArrowUpRight, ArrowDownRight, LogOut,
  CheckSquare, Calendar, Upload, TrendingUp, Download,
  Clock, CheckCircle2, X, Send,
  Utensils, RefreshCw, SlidersHorizontal, Eye, Zap,
} from "lucide-react";

/* ══════════════════════════════════════════════════════════
   TYPES
══════════════════════════════════════════════════════════ */
type NavPage   = "restaurant" | "inventory" | "services" | "returns" | "transactions" | "pricing" | "reports";
type StockStatus = "in-stock" | "low-stock" | "out-of-stock";
type TxType    = "import" | "export" | "waste" | "adjustment";
type PriceStatus = "pending" | "approved" | "rejected" | "expired" | "consumed";
type TxStatus  = "completed" | "pending" | "cancelled";

interface InventoryItem {
  id: string; name: string; sku: string;
  category: string; unit: string; price: number;
  stock: number; reorder: number; active: boolean; imageUrl: string | null;
  emoji: string;
}
interface Transaction extends VoucherMovement {
  id: string; serviceId: string; date: string; occurredAt: string; type: TxType; movementType: MovementType;
  item: string; qty: number; amount: number;
  staff: string; status: TxStatus; note?: string;
}
interface PriceRequest {
  id: string; item: string; sku: string;
  currentPrice: number; newPrice: number;
  requestedBy: string; requestedAt: string;
  status: PriceStatus; reason?: string;
  rawApproval?: Approval;
  catalogAddition?: boolean;
  catalogKind?: CatalogProposal["kind"];
}

/* ══════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════ */
const fmtVNDFull = formatVnd;

const stockStatus = (item: InventoryItem): StockStatus => {
  if (item.stock === 0) return "out-of-stock";
  if (item.stock <= item.reorder) return "low-stock";
  return "in-stock";
};
const stockPct = (item: InventoryItem) => item.reorder > 0
  ? Math.min(100, Math.round((item.stock / item.reorder) * 100))
  : item.stock > 0 ? 100 : 0;

const STATUS_CFG: Record<StockStatus, { label: string; bg: string; text: string; dot: string }> = {
  "in-stock":    { label:"Còn hàng",     bg:"#DCFCE7",text:"#166534",dot:"#16A34A" },
  "low-stock":   { label:"Sắp hết",    bg:"#FFE4E6",text:"#BE123C",dot:"#EF4444" },
  "out-of-stock":{ label:"Hết hàng", bg:"#F1F5F9",text:"#475569",dot:"#94A3B8" },
};

const CATEGORY_LABEL: Record<string,string> = {
  food:"Món ăn", beverage:"Thức uống",
  "Minibar Beverage":"Đồ uống minibar", "Minibar Snack":"Đồ ăn nhẹ minibar",
  "Kitchen Dry":"Nguyên liệu khô", "Kitchen Fresh":"Nguyên liệu tươi",
  "fine-dining":"Nhà hàng", transport:"Vận chuyển", spa:"Spa",
  inroom:"Dịch vụ tại phòng", recreation:"Giải trí", business:"Dịch vụ doanh nghiệp", other:"Khác",
  "room-amenity":"Đồ gia dụng",
};
const STOCK_CATEGORIES = new Set(["food", "beverage", "room-amenity", "Minibar Beverage", "Minibar Snack", "Kitchen Dry", "Kitchen Fresh"]);
const isStockItem = (item: InventoryItem) => STOCK_CATEGORIES.has(item.category);
const UNIT_LABEL: Record<string,string> = { Can:"lon", Bottle:"chai", Box:"hộp", Pack:"gói", Kg:"kg", Pcs:"cái", Liter:"lít", Block:"khối" };

const CAT_COLORS: Record<string, { bg: string; text: string }> = {
  business:          { bg:"#DBEAFE",text:"#1D4ED8" },
  inroom:            { bg:"#EDE9FE",text:"#6D28D9" },
  recreation:        { bg:"#DCFCE7",text:"#166534" },
  "fine-dining":     { bg:"#FFEDD5",text:"#9A3412" },
  spa:               { bg:"#FCE7F3",text:"#9D174D" },
  transport:         { bg:"#CFFAFE",text:"#155E75" },
  laundry:           { bg:"#E0E7FF",text:"#3730A3" },
  other:             { bg:"#F1F5F9",text:"#475569" },
  food:              { bg:"#FEF3C7",text:"#92400E" },
  beverage:          { bg:"#D1FAE5",text:"#065F46" },
  "Minibar Beverage": { bg:"#DBEAFE",text:"#1D4ED8" },
  "Minibar Snack":    { bg:"#FEF9C3",text:"#92400E" },
  "Kitchen Dry":      { bg:"#FEF3C7",text:"#78350F" },
  "Kitchen Fresh":    { bg:"#DCFCE7",text:"#166534" },
  "room-amenity":     { bg:"#F3E8FF",text:"#6B21A8" },
};

const ITEM_EMOJI: Record<string, string> = {
  BREAKFAST:"🍳", MINIBAR:"🥤", EXTRABED:"🛏️", LNDRYEXP:"🧺", LNDRYSTD:"🧺",
  PRESSING:"👔", MAMREST:"🍽️", DECOR:"💐", SPAMASS:"💆", SPAFACIAL:"🧴",
  STEAM:"♨️", LIMO:"🚘", CITYTOUR:"🗺️", POOL:"🏊", GYM:"🏋️", TENNIS:"🎾",
  PINGPONG:"🏓", BADMINTON:"🏸", MEETING:"🏢", BOARDROOM:"🖥️",
  DENTALKIT:"🪥", COMBONE:"🪮", TOWELRST:"🧺", SOAPBAR:"🧼", SHAMPOO:"🧴",
  BODYWASH:"🧴", SHWRCAP:"🚿", VANITYKIT:"🧻",
};

function CatalogThumbnail({ item, size = 38 }: { item: InventoryItem; size?: number }) {
  return (
    <div style={{ width:size,height:size,borderRadius:8,flexShrink:0,position:"relative",overflow:"hidden",
      background:(CAT_COLORS[item.category] ?? { bg:"#F8FAFC" }).bg,
      display:"flex",alignItems:"center",justifyContent:"center",fontSize:size * 0.52 }}>
      <span aria-hidden="true">{item.emoji}</span>
      {item.imageUrl && <img src={item.imageUrl} alt={item.name} loading="lazy"
        onError={event => { event.currentTarget.style.display = "none"; }}
        style={{ position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover" }} />}
    </div>
  );
}

const STATUS_OPTIONS = [["All Status","Tất cả trạng thái"],["In Stock","Còn hàng"],["Low Stock","Sắp hết"],["Out of Stock","Hết hàng"]] as const;

/* ══════════════════════════════════════════════════════════
   STOCK BAR
══════════════════════════════════════════════════════════ */
function StockBar({ item, availability }: { item: InventoryItem; availability?:ServiceAvailability }) {
  const value=availability?.available ?? item.stock;
  const unit=availability?.unit ?? UNIT_LABEL[item.unit] ?? item.unit;
  const pct=availability ? (availability.capacity>0?Math.min(100,Math.round(value/availability.capacity*100)):0) : stockPct(item);
  const clr=value===0?"#94A3B8":!availability&&value<=item.reorder?"#F59E0B":"#16A34A";
  return (
    <div style={{ minWidth:120 }}>
      <p style={{ fontSize:12,fontWeight:700,color:"#0F172A",marginBottom:3 }}>{value} {unit}</p>
      <div style={{ height:6,background:"#E2E8F0",borderRadius:99,overflow:"hidden" }}>
        <div style={{ height:"100%",width:`${pct}%`,borderRadius:99,background:clr }} />
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   KPI BAR
══════════════════════════════════════════════════════════ */
function KpiBar({ items, transactions, priceRequests, availability }: { items: InventoryItem[]; transactions: Transaction[]; priceRequests: PriceRequest[];availability?:ServiceAvailability[]|null }) {
  const lowStock = availability===undefined?items.filter(item => stockStatus(item) === "low-stock" || stockStatus(item) === "out-of-stock").length:availability?.filter(row=>row.available===0).length;
  const today = localDateValue();
  const consumedToday = transactions.filter(transaction => transaction.movementType === "ISSUE" && localDateValue(new Date(transaction.occurredAt)) === today)
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const pendingRequests = priceRequests.filter(request => request.status === "pending").length;
  return (
    <div style={{ display:"flex",gap:16,padding:"16px 24px",background:"#F8FAFC",flexShrink:0,
      borderBottom:"1px solid #E2E8F0" }}>
      {[
        { label:"Tổng danh mục",val:String(items.length),iconBg:"#DCFCE7",iconColor:"#16A34A",Icon:Package },
        { label:"Cảnh báo sắp hết",val:lowStock===undefined?"—":String(lowStock),iconBg:"#FEF3C7",iconColor:"#F59E0B",Icon:AlertTriangle },
        { label:"Tiêu thụ hôm nay",val:fmtVNDFull(consumedToday),iconBg:"#DCFCE7",iconColor:"#16A34A",Icon:ShoppingCart },
        { label:"Chờ phê duyệt",val:String(pendingRequests),iconBg:"#FFE4E6",iconColor:"#DC2626",Icon:FileText },
      ].map(k => (
        <div key={k.label} style={{ flex:1,background:"#FFF",borderRadius:12,border:"1px solid #E2E8F0",
          padding:"16px 20px",display:"flex",alignItems:"center",gap:14,
          boxShadow:"0 1px 3px rgba(0,0,0,.04)" }}>
          <div style={{ width:46,height:46,borderRadius:12,background:k.iconBg,flexShrink:0,
            display:"flex",alignItems:"center",justifyContent:"center" }}>
            <k.Icon size={20} style={{ color:k.iconColor }} />
          </div>
          <div>
            <p style={{ fontSize:11,color:"#64748B",marginBottom:3 }}>{k.label}</p>
            <p style={{ fontFamily:"'JetBrains Mono',monospace",fontSize:22,fontWeight:800,
              color:"#0F172A",lineHeight:1,marginBottom:3 }}>{k.val}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   PRICE REQUEST MODAL
══════════════════════════════════════════════════════════ */
function PriceRequestModal({
  item,
  existingRequest,
  onClose,
  onSubmit,
}: {
  item: InventoryItem;
  existingRequest?: PriceRequest;
  onClose: () => void;
  onSubmit: (newPrice: number, reason: string) => Promise<void>;
}) {
  const [newPrice, setNewPrice] = useState(existingRequest ? String(existingRequest.newPrice) : String(item.price));
  const [reason, setReason] = useState(existingRequest ? (existingRequest.reason || "") : "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const numNewPrice = Number(newPrice);
  const diff = numNewPrice - item.price;
  const pct = item.price > 0 ? Math.round((diff / item.price) * 100) : 0;
  const isPending = existingRequest?.status === "pending";

  const handleSubmit = async () => {
    if (isNaN(numNewPrice) || numNewPrice <= 0) {
      setError("Vui lòng nhập giá đề xuất hợp lệ lớn hơn 0 đ.");
      return;
    }
    if (numNewPrice === item.price) {
      setError("Giá đề xuất mới phải khác giá niêm yết hiện tại.");
      return;
    }
    if (!reason.trim()) {
      setError("Vui lòng nhập lý do thay đổi giá để Sếp/Quản lý xem xét.");
      return;
    }
    setSaving(true);
    try {
      await onSubmit(numNewPrice, reason.trim());
      onClose();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không thể gửi đề xuất giá.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.5)",
      display:"flex",alignItems:"center",justifyContent:"center",zIndex:100,padding:20 }}>
      <div style={{ background:"#FFF",borderRadius:16,width:"100%",maxWidth:520,
        boxShadow:"0 20px 60px rgba(0,0,0,.25)",overflow:"hidden",display:"flex",flexDirection:"column" }}>
        
        {/* Header */}
        <div style={{ padding:"18px 22px 14px",borderBottom:"1px solid #E2E8F0",
          display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0 }}>
          <div style={{ display:"flex",alignItems:"center",gap:10 }}>
            <div style={{ width:38,height:38,borderRadius:10,background:"#FEF3C7",
              display:"flex",alignItems:"center",justifyContent:"center",color:"#D97706" }}>
              <Tag size={18} />
            </div>
            <div>
              <h3 style={{ fontSize:16,fontWeight:700,color:"#0F172A",margin:0 }}>
                {isPending ? "Chi tiết đề xuất đổi giá" : "Đề xuất thay đổi giá niêm yết"}
              </h3>
              <p style={{ fontSize:11,color:"#64748B",margin:"2px 0 0" }}>
                Yêu cầu bắt buộc phải được Sếp/Quản lý phê duyệt
              </p>
            </div>
          </div>
          <button onClick={onClose}
            style={{ width:30,height:30,borderRadius:8,border:"1px solid #E2E8F0",
              background:"#F8FAFC",display:"flex",alignItems:"center",justifyContent:"center",
              cursor:"pointer",color:"#64748B" }}>
            <X size={14} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding:"20px 22px",overflowY:"auto" }}>
          {/* Item details card */}
          <div style={{ display:"flex",alignItems:"center",gap:12,padding:"12px 14px",
            background:"#F8FAFC",borderRadius:10,border:"1px solid #E2E8F0",marginBottom:16 }}>
            <CatalogThumbnail item={item} size={44} />
            <div style={{ flex:1 }}>
              <p style={{ fontSize:14,fontWeight:700,color:"#0F172A",margin:0 }}>{item.name}</p>
              <div style={{ display:"flex",alignItems:"center",gap:8,marginTop:3 }}>
                <span style={{ fontSize:11,color:"#64748B" }}>SKU: <strong>{item.sku}</strong></span>
                <span style={{ fontSize:11,color:"#94A3B8" }}>•</span>
                <span style={{ fontSize:11,color:"#64748B" }}>Đơn vị: <strong>{UNIT_LABEL[item.unit] ?? item.unit}</strong></span>
                <span style={{ fontSize:11,color:"#94A3B8" }}>•</span>
                <span style={{ fontSize:11,color:"#64748B" }}>Nhóm: <strong>{CATEGORY_LABEL[item.category] ?? item.category}</strong></span>
              </div>
            </div>
          </div>

          {/* Pending alert if existing */}
          {isPending && (
            <div style={{ padding:"10px 14px",borderRadius:8,background:"#FEF3C7",border:"1px solid #FCD34D",
              marginBottom:16,display:"flex",alignItems:"center",gap:8 }}>
              <Clock size={15} style={{ color:"#D97706",flexShrink:0 }} />
              <div style={{ fontSize:11,color:"#92400E" }}>
                <strong>Đang chờ Sếp phê duyệt:</strong> Yêu cầu gửi lúc {existingRequest?.requestedAt} bởi {existingRequest?.requestedBy}.
              </div>
            </div>
          )}

          {/* Price comparison inputs */}
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16 }}>
            <div>
              <label style={{ display:"block",fontSize:11,fontWeight:700,color:"#475569",marginBottom:6 }}>
                GIÁ NIÊM YẾT HIỆN TẠI
              </label>
              <div style={{ height:40,padding:"0 12px",borderRadius:8,border:"1px solid #E2E8F0",
                background:"#F1F5F9",display:"flex",alignItems:"center",justifyContent:"space-between" }}>
                <span style={{ fontSize:14,fontWeight:700,color:"#0F172A",fontFamily:"'JetBrains Mono',monospace" }}>
                  {item.active ? item.price.toLocaleString("vi-VN") : "Vật tư nội bộ"}
                </span>
                <span style={{ fontSize:12,color:"#64748B",fontWeight:600 }}>VNĐ</span>
              </div>
            </div>

            <div>
              <label style={{ display:"block",fontSize:11,fontWeight:700,color:"#0F172A",marginBottom:6 }}>
                GIÁ ĐỀ XUẤT MỚI (*)
              </label>
              <div style={{ position:"relative" }}>
                <input
                  type="number"
                  disabled={isPending}
                  value={newPrice}
                  onChange={e => { setNewPrice(e.target.value); setError(""); }}
                  placeholder="Nhập giá mới..."
                  style={{ width:"100%",height:40,padding:"0 42px 0 12px",borderRadius:8,
                    border:`1px solid ${error?"#EF4444":"#CBD5E1"}`,fontSize:14,fontWeight:700,
                    outline:"none",boxSizing:"border-box",color:"#0F172A",
                    fontFamily:"'JetBrains Mono',monospace",background:isPending?"#F8FAFC":"#FFF" }}
                />
                <span style={{ position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",
                  fontSize:12,color:"#64748B",fontWeight:600,pointerEvents:"none" }}>VNĐ</span>
              </div>
            </div>
          </div>

          {/* Diff preview */}
          {numNewPrice > 0 && numNewPrice !== item.price && (
            <div style={{ padding:"8px 12px",borderRadius:8,marginBottom:14,
              background:diff>0?"#EFF6FF":"#FEF2F2",border:`1px solid ${diff>0?"#BFDBFE":"#FECACA"}`,
              display:"flex",alignItems:"center",justifyContent:"space-between",fontSize:12 }}>
              <span style={{ color:"#475569" }}>Mức độ chênh lệch:</span>
              <strong style={{ color:diff>0?"#1D4ED8":"#DC2626" }}>
                {diff > 0 ? `Tăng +${formatVnd(diff)} (+${pct}%)` : `Giảm ${formatVnd(diff)} (${pct}%)`}
              </strong>
            </div>
          )}

          {/* Reason */}
          <div style={{ marginBottom:16 }}>
            <label style={{ display:"block",fontSize:11,fontWeight:700,color:"#0F172A",marginBottom:6 }}>
              LÝ DO THAY ĐỔI GIÁ (*)
            </label>
            <textarea
              rows={3}
              disabled={isPending}
              value={reason}
              onChange={e => { setReason(e.target.value); setError(""); }}
              placeholder="VD: Nhà cung cấp Sabeco tăng giá 12%, biến động chi phí thị trường, bổ sung chi phí phục vụ..."
              style={{ width:"100%",padding:"10px 12px",borderRadius:8,border:`1px solid ${error?"#EF4444":"#CBD5E1"}`,
                fontSize:12,outline:"none",resize:"vertical",boxSizing:"border-box",
                background:isPending?"#F8FAFC":"#FFF" }}
            />
          </div>

          {error && (
            <div style={{ padding:"8px 12px",borderRadius:6,background:"#FEE2E2",color:"#DC2626",fontSize:11,fontWeight:600,marginBottom:14 }}>
              ⚠️ {error}
            </div>
          )}

          {/* RBAC notice */}
          <div style={{ padding:"12px 14px",borderRadius:10,background:"#F0FDF4",border:"1px solid #BBF7D0",
            display:"flex",alignItems:"flex-start",gap:10 }}>
            <CheckCircle2 size={16} style={{ color:"#16A34A",flexShrink:0,marginTop:2 }} />
            <div style={{ fontSize:11,color:"#166534",lineHeight:1.4 }}>
              <strong>Quy chuẩn phân quyền (RBAC):</strong> Nhân viên Kho &amp; Dịch vụ chỉ có thẩm quyền lập đề xuất đổi giá. Giá mới sẽ được chuyển tới <strong>Trung tâm Phê duyệt của Quản lý / Giám đốc</strong> và chỉ có hiệu lực sau khi Sếp phê duyệt.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding:"14px 22px",borderTop:"1px solid #E2E8F0",background:"#F8FAFC",
          display:"flex",justifyContent:"flex-end",gap:10,flexShrink:0 }}>
          <button onClick={onClose}
            style={{ padding:"9px 16px",borderRadius:8,border:"1px solid #CBD5E1",
              background:"#FFF",color:"#475569",fontSize:12,fontWeight:600,cursor:"pointer" }}>
            {isPending ? "Đóng" : "Hủy"}
          </button>
          {!isPending && (
            <button onClick={() => void handleSubmit()} disabled={saving}
              style={{ padding:"9px 18px",borderRadius:8,border:"none",
                background:saving?"#64748B":"#0F172A",color:"#FFF",fontSize:12,fontWeight:700,cursor:saving?"wait":"pointer",
                display:"flex",alignItems:"center",gap:6,boxShadow:"0 2px 6px rgba(15,23,42,.2)" }}>
              <Send size={13} /> {saving ? "Đang gửi…" : "Gửi Sếp / Quản lý duyệt"}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}

const MOVEMENT_OPTIONS: [MovementType, string][] = [
  ["RECEIVE", "Nhập kho"],
  ["ISSUE", "Xuất kho"],
  ["WASTE", "Hao hụt"],
];

function InventoryMovementModal({
  items,
  initialServiceId,
  initialType,
  initialReason,
  onClose,
  onSubmit,
}: {
  items: InventoryItem[];
  initialServiceId?: string;
  initialType: MovementType;
  initialReason?: string;
  onClose: () => void;
  onSubmit: (serviceId: string, type: MovementType, quantity: number, reason: string) => Promise<void>;
}) {
  const [serviceId, setServiceId] = useState(initialServiceId || items[0]?.id || "");
  const [type, setType] = useState<MovementType>(initialType);
  const [quantity, setQuantity] = useState("1");
  const [selectedRoom, setSelectedRoom] = useState("");
  const [reason, setReason] = useState(initialReason || "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const selected = items.find(item => item.id === serviceId);

  const isService = selected?.active === true;

  const submit = async () => {
    const parsedQuantity = Number(quantity);
    if (!serviceId || !selected) { setError("Chọn danh mục cần ghi nhận."); return; }
    if (!Number.isSafeInteger(parsedQuantity) || parsedQuantity < 1) {
      setError("Số lượng phải là số nguyên lớn hơn 0.");
      return;
    }
    let finalReason = reason.trim();
    if (type === "ISSUE" && selectedRoom && !finalReason.includes(selectedRoom)) {
      finalReason = finalReason ? `${finalReason} (Phòng ${selectedRoom})` : `Cấp cho phòng ${selectedRoom}`;
    }
    if (!finalReason) { setError("Nhập lý do để lưu dấu vết kiểm soát kho và dịch vụ."); return; }
    setSaving(true);
    setError("");
    try {
      await onSubmit(serviceId, type, parsedQuantity, finalReason);
      onClose();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không thể lưu phiếu.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !saving) onClose(); }} style={{ position:"fixed",inset:0,zIndex:120,background:"rgba(15,23,42,.48)",display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}>
      <section role="dialog" aria-modal="true" aria-labelledby="inventory-movement-title" style={{ width:"100%",maxWidth:480,maxHeight:"90vh",overflowY:"auto",background:"#FFF",borderRadius:14,border:"1px solid #E2E8F0",boxShadow:"0 20px 60px rgba(15,23,42,.24)" }}>
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,padding:"16px 18px",borderBottom:"1px solid #E2E8F0" }}>
          <div><h3 id="inventory-movement-title" style={{ margin:0,fontSize:16,fontWeight:800,color:"#0F172A" }}>Ghi nhận phiếu kho và dịch vụ</h3><p style={{ margin:"4px 0 0",fontSize:11,color:"#64748B" }}>Phiếu sẽ cập nhật tồn kho/slot khả dụng và lưu dấu vết kiểm soát.</p></div>
          <button type="button" aria-label="Đóng" disabled={saving} onClick={onClose} style={{ width:30,height:30,borderRadius:8,border:"1px solid #E2E8F0",background:"#F8FAFC",color:"#64748B",cursor:"pointer" }}><X size={14} /></button>
        </div>
        <div style={{ display:"grid",gap:13,padding:18 }}>
          <label style={{ display:"grid",gap:5,fontSize:11,fontWeight:700,color:"#334155" }}>Danh mục
            <select value={serviceId} onChange={event => setServiceId(event.target.value)} disabled={saving || Boolean(initialServiceId)} style={{ height:38,padding:"0 10px",border:"1px solid #CBD5E1",borderRadius:8,background:"#FFF",fontSize:12 }}>
              {items.map(item => <option key={item.id} value={item.id}>{item.name} ({item.id}) · tồn {item.stock} {UNIT_LABEL[item.unit] ?? item.unit}</option>)}
            </select>
          </label>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
            <label style={{ display:"grid",gap:5,fontSize:11,fontWeight:700,color:"#334155" }}>Loại phiếu
              <select value={type} onChange={event => { setType(event.target.value as MovementType); setSelectedRoom(""); }} disabled={saving} style={{ height:38,padding:"0 10px",border:"1px solid #CBD5E1",borderRadius:8,background:"#FFF",fontSize:12 }}>
                {MOVEMENT_OPTIONS.map(([value,label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label style={{ display:"grid",gap:5,fontSize:11,fontWeight:700,color:"#334155" }}>Số lượng / Slot
              <input type="number" min="1" step="1" value={quantity} onChange={event => setQuantity(event.target.value)} disabled={saving} style={{ height:38,padding:"0 10px",border:"1px solid #CBD5E1",borderRadius:8,fontSize:13 }} />
            </label>
          </div>
          {selected && (
            <div style={{ padding:"10px 12px",borderRadius:8,background:"#F8FAFC",fontSize:11,color:"#475569",border:"1px solid #F1F5F9" }}>
              <p style={{ margin:0 }}>
                {isService?"Số lượng quản lý":"Tồn hiện tại"}: <strong>{selected.stock} {UNIT_LABEL[selected.unit] ?? selected.unit}</strong> · Ngưỡng đảm bảo: <strong>{selected.reorder}</strong>
              </p>
              <p style={{ margin:"4px 0 0",fontSize:10,color:"#94A3B8",fontStyle:"italic" }}>
                {isService?"Đơn vị dùng cho phiếu; số sân, phòng và suất còn lại được tính riêng theo lịch đặt.":"Số lượng được ghi theo đơn vị mặt hàng."}
              </p>
            </div>
          )}
          {type === "ISSUE" && <label style={{ display:"grid",gap:5,fontSize:11,fontWeight:700,color:"#334155" }}>Chọn phòng nhận (tùy chọn)
            <select value={selectedRoom} onChange={event => setSelectedRoom(event.target.value)} disabled={saving} style={{ height:38,padding:"0 10px",border:"1px solid #CBD5E1",borderRadius:8,background:"#FFF",fontSize:12 }}>
              <option value="">-- Không chỉ định phòng (xuất nội bộ / kho chung) --</option>
              {["101","102","103","201","202","203","301","302","401","501","502","601","701","801","802"].map(room => (
                <option key={room} value={room}>Phòng {room}</option>
              ))}
            </select>
          </label>}
          <label style={{ display:"grid",gap:5,fontSize:11,fontWeight:700,color:"#334155" }}>Lý do / nơi nhận
            <textarea value={reason} maxLength={500} rows={3} onChange={event => setReason(event.target.value)} disabled={saving} placeholder="Ví dụ: Cấp cho buồng phòng – phòng 502" style={{ resize:"vertical",padding:"9px 10px",border:"1px solid #CBD5E1",borderRadius:8,fontSize:12 }} />
          </label>
          {error && <div role="alert" style={{ padding:"9px 11px",borderRadius:8,background:"#FFF1F2",border:"1px solid #FECDD3",color:"#BE123C",fontSize:12 }}>{error}</div>}
        </div>
        <div style={{ display:"flex",justifyContent:"flex-end",gap:8,padding:"12px 18px",borderTop:"1px solid #E2E8F0",background:"#F8FAFC" }}>
          <button type="button" disabled={saving} onClick={onClose} style={{ height:36,padding:"0 13px",border:"1px solid #CBD5E1",borderRadius:8,background:"#FFF",color:"#475569",fontSize:12,cursor:"pointer" }}>Hủy</button>
          <button type="button" disabled={saving || items.length === 0} onClick={() => void submit()} style={{ height:36,padding:"0 15px",border:0,borderRadius:8,background:saving?"#64748B":"#0F172A",color:"#FFF",fontSize:12,fontWeight:700,cursor:saving?"wait":"pointer" }}>{saving ? "Đang lưu…" : "Lưu phiếu"}</button>
        </div>
      </section>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   INVENTORY TABLE SCREEN
══════════════════════════════════════════════════════════ */
function InventoryScreen({
  priceRequests,
  onAddPriceRequest,
  onOpenMovement,
  onConfigureSchedule,
  searchQuery,
  loading,
  items = [],
  requesterName,
  servicesView = false,
  refreshKey = 0,
  onAvailabilityChange,
}: {
  servicesView?: boolean;
  refreshKey?:number;
  onAvailabilityChange?:(rows:ServiceAvailability[]|null)=>void;
  priceRequests: PriceRequest[];
  onAddPriceRequest: (req: PriceRequest) => Promise<void>;
  onConfigureSchedule: (item:InventoryItem)=>void;
  onOpenMovement: (serviceId: string | undefined, type: MovementType, reason?: string) => void;
  searchQuery: string;
  loading: boolean;
  items?: InventoryItem[];
  requesterName?: string;
}) {
  const [search, setSearch]  = useState("");
  const [quickTag, setQuickTag] = useState<string>("all");
  const [cat, setCat]        = useState("All Categories");
  const [status, setStatus]  = useState("All Status");
  const [page, setPage]      = useState(1);
  const [modalItem, setModalItem] = useState<InventoryItem|null>(null);
  const [toastMessage, setToastMessage] = useState<string|null>(null);
  const [fromTime,setFromTime]=useState(()=>`${localDateValue()}T08:00`);
  const [toTime,setToTime]=useState(()=>`${localDateValue()}T09:00`);
  const [availability,setAvailability]=useState<ServiceAvailability[]>([]);
  const [availabilityLoading,setAvailabilityLoading]=useState(servicesView);
  const [availabilityError,setAvailabilityError]=useState("");
  const [scheduleRefresh,setScheduleRefresh]=useState(0);
  useEffect(()=>{
    if(!servicesView)return;
    let active=true;setAvailability([]);setAvailabilityError("");onAvailabilityChange?.(null);
    if(!fromTime||!toTime||fromTime>=toTime||new Date(toTime).getTime()-new Date(fromTime).getTime()>31*86400000){
      setAvailabilityLoading(false);setAvailabilityError("Chọn thời gian kết thúc sau thời gian bắt đầu, tối đa 31 ngày.");return;
    }
    setAvailabilityLoading(true);
    serviceAvailabilityApi.list(fromTime,toTime)
      .then(rows=>{if(active){setAvailability(rows);onAvailabilityChange?.(rows);}})
      .catch(cause=>{if(active)setAvailabilityError(apiErrorMessage(cause,"Không thể tải lịch khả dụng."));})
      .finally(()=>{if(active)setAvailabilityLoading(false);});
    return ()=>{active=false;};
  },[servicesView,fromTime,toTime,scheduleRefresh,refreshKey,onAvailabilityChange]);
  const availabilityById=useMemo(()=>new Map(availability.map(row=>[row.service_id,row])),[availability]);
  const PER_PAGE = 10;
  const categoryOptions = useMemo<[string,string][]>(() => [
      ["All Categories", "Tất cả danh mục"],
    ...[...new Set(items.map(item => item.category))]
      .sort((left, right) => (CATEGORY_LABEL[left] ?? left).localeCompare(CATEGORY_LABEL[right] ?? right, "vi"))
      .map(category => [category, CATEGORY_LABEL[category] ?? category] as [string, string]),
  ], [items]);

  const filtered = useMemo(() => {
    let rs = items;
    if (quickTag === "food") {
      rs = rs.filter(i => ["food", "Kitchen Fresh", "Kitchen Dry", "Minibar Snack"].includes(i.category));
    } else if (quickTag === "drinks") {
      rs = rs.filter(i => ["beverage", "Minibar Beverage"].includes(i.category));
    } else if (quickTag === "household") {
      rs = rs.filter(i => i.category === "room-amenity");
    } else if (quickTag === "minibar") {
      rs = rs.filter(i => i.category.toLowerCase().includes("minibar") || i.sku.toUpperCase().startsWith("MINI"));
    } else if (quickTag === "service") {
      rs = rs.filter(i => ["spa", "transport", "recreation", "business", "inroom"].includes(i.category));
    } else if (cat !== "All Categories") {
      rs = rs.filter(i => i.category === cat);
    }
    if (status === "Low Stock")   rs = rs.filter(i => stockStatus(i) === "low-stock");
    if (status === "In Stock")    rs = rs.filter(i => servicesView?(availabilityById.get(i.id)?.available??0)>0:stockStatus(i)==="in-stock");
    if (status === "Out of Stock") rs = rs.filter(i => servicesView?availabilityById.get(i.id)?.available===0:stockStatus(i)==="out-of-stock");
    if (search.trim() || searchQuery.trim()) {
      const q = (searchQuery.trim() || search.trim()).toLowerCase();
      rs = rs.filter(i => i.name.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q) || i.category.toLowerCase().includes(q));
    }
    return rs;
  }, [search, searchQuery, quickTag, cat, status, items,servicesView,availabilityById]);

  const totalPages = Math.ceil(filtered.length / PER_PAGE) || 1;
  const pageItems  = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <div style={{ flex:1,display:"flex",overflow:"hidden" }}>
      {/* Table area */}
      <div style={{ flex:1,overflowY:"auto",padding:"18px 22px",minWidth:0 }}>

        {/* Section heading */}
        <div style={{ marginBottom:14 }}>
          <h2 style={{ fontSize:16,fontWeight:700,color:"#0F172A",marginBottom:2 }}>{servicesView ? "Danh mục dịch vụ" : "Danh mục kho"}</h2>
          <p style={{ fontSize:12,color:"#94A3B8" }}>{servicesView ? "Quản lý dịch vụ nhà hàng, spa, vận chuyển và tiện ích khách sạn" : "Quản lý món ăn, thức uống, minibar và đồ gia dụng"}</p>
        </div>

        {servicesView&&<div style={{display:"flex",alignItems:"end",gap:12,flexWrap:"wrap",padding:14,marginBottom:14,border:"1px solid #E2E8F0",borderRadius:10,background:"#FFF"}}>
          <label style={{display:"grid",gap:5,fontSize:12,color:"#475569"}}>Từ thời điểm<input type="datetime-local" value={fromTime} onChange={event=>{setFromTime(event.target.value);setPage(1);}} style={{height:34,padding:"0 8px",border:"1px solid #CBD5E1",borderRadius:6}}/></label>
          <label style={{display:"grid",gap:5,fontSize:12,color:"#475569"}}>Đến thời điểm<input type="datetime-local" value={toTime} onChange={event=>{setToTime(event.target.value);setPage(1);}} style={{height:34,padding:"0 8px",border:"1px solid #CBD5E1",borderRadius:6}}/></label>
          <button type="button" onClick={()=>setScheduleRefresh(value=>value+1)} style={{height:34,padding:"0 12px",fontSize:12,fontFamily:"inherit",fontWeight:400,border:"1px solid #CBD5E1",borderRadius:6,background:"#FFF",cursor:"pointer"}}>Tải lại lịch</button>
          <span style={{fontSize:11,color:"#64748B"}}>Khả dụng trong toàn bộ khoảng thời gian đã chọn</span>
        </div>}
        {servicesView&&availabilityError&&<p role="alert" style={{fontSize:12,color:"#B91C1C",marginBottom:12}}>{availabilityError}</p>}

        {/* Toolbar */}
        <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:14,flexWrap:"wrap" }}>
          {/* Search */}
          <div style={{ position:"relative",flex:1,minWidth:180 }}>
            <Search size={13} style={{ position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:"#94A3B8",pointerEvents:"none" }} />
            <input value={search} onChange={e=>{ setSearch(e.target.value); setPage(1); }}
              placeholder="Tìm danh mục, mặt hàng, dịch vụ..."
              style={{ width:"100%",height:34,paddingLeft:30,paddingRight:10,borderRadius:8,
                border:"1px solid #E2E8F0",background:"#F8FAFC",fontSize:12,outline:"none",boxSizing:"border-box" }} />
          </div>
          {/* Status filter */}
          <div style={{ position:"relative" }}>
            <select value={status} onChange={e=>{ setStatus(e.target.value); setPage(1); }}
              style={{ height:34,padding:"0 26px 0 10px",borderRadius:8,border:"1px solid #E2E8F0",
                background:"#F8FAFC",fontSize:12,outline:"none",cursor:"pointer",appearance:"none" }}>
              {(servicesView?[["All Status","Tất cả trạng thái"],["In Stock","Còn chỗ"],["Out of Stock","Hết chỗ"]]:STATUS_OPTIONS).map(([value,label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <ChevronDown size={11} style={{ position:"absolute",right:7,top:"50%",transform:"translateY(-50%)",color:"#94A3B8",pointerEvents:"none" }} />
          </div>
        </div>

        {/* Category filter pills & Quick tags */}
        <div style={{ display:"flex",gap:6,marginBottom:14,flexWrap:"wrap",alignItems:"center" }}>
          {(servicesView ? [{ id:"all", label:"Tất cả" }] : [
            { id:"all", label:"Tất cả" },
            { id:"food", label:"Món ăn" },
            { id:"drinks", label:"Thức uống" },
            { id:"household", label:"Đồ gia dụng" },
            { id:"minibar", label:"Minibar" },
          ]).map(tag => {
            const active = quickTag === tag.id && cat === "All Categories";
            return (
              <button key={tag.id} onClick={() => { setQuickTag(tag.id); setCat("All Categories"); setPage(1); }}
                style={{ padding:"5px 12px",borderRadius:99,fontSize:12,cursor:"pointer",
                  fontWeight:active?700:500,border:`1px solid ${active?"#0F172A":"#E2E8F0"}`,
                  background:active?"#0F172A":"#FFF",color:active?"#FFF":"#475569" }}>
                {tag.label}
              </button>
            );
          })}
          <span style={{ height:18,width:1,background:"#E2E8F0",margin:"0 3px" }} />
          {categoryOptions.filter(([value]) => value !== "All Categories" && (servicesView || !["food", "beverage", "room-amenity"].includes(value))).map(([value,label]) => {
            const active = cat === value && quickTag === "all";
            return (
              <button key={value} onClick={() => { setCat(value); setQuickTag("all"); setPage(1); }}
                style={{ padding:"5px 12px",borderRadius:99,fontSize:12,cursor:"pointer",
                  fontWeight:active?700:400,border:`1px solid ${active?"#0F172A":"#E2E8F0"}`,
                  background:active?"#0F172A":"#FFF",color:active?"#FFF":"#475569" }}>
                {label}
              </button>
            );
          })}
        </div>
        <p style={{ margin:"-7px 0 7px",fontSize:10,color:"#94A3B8",textAlign:"right" }}>Kéo ngang bảng để xem cột thao tác →</p>

        {/* Table */}
        <div style={{ background:"#FFF",borderRadius:12,border:"1px solid #E2E8F0",overflowX:"auto",overflowY:"hidden" }}>
          <table style={{ width:"100%",minWidth:1040,borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ background:"#F8FAFC" }}>
                {["Tên danh mục / dịch vụ","Phân loại",servicesView?"Đơn vị tính giá":"Đơn vị",servicesView?"Giá niêm yết":"Đơn giá (đ)",servicesView?"Khả dụng":"Tồn kho",servicesView?"Tổng công suất":"Ngưỡng đảm bảo","Trạng thái","Hành động"].map(h => (
                  <th key={h} style={{ padding:"9px 12px",fontSize:11,fontWeight:700,color:"#64748B",
                    textAlign:"left",whiteSpace:"nowrap",letterSpacing:"0.04em",
                    borderBottom:"1px solid #E2E8F0",textTransform:"uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageItems.map((item, i) => {
                const st   = stockStatus(item);
                const available=availabilityById.get(item.id);
                const cfg = servicesView?(available?{...STATUS_CFG[available.available>0?"in-stock":"out-of-stock"],label:available.available>0?"Còn chỗ":"Hết chỗ"}:{...STATUS_CFG["out-of-stock"],label:"Chưa có lịch"}):STATUS_CFG[st];
                const catC = CAT_COLORS[item.category] ?? { bg:"#F8FAFC",text:"#475569" };
                const pendingReq = priceRequests.find(pr => (pr.sku === item.sku || pr.item.toLowerCase() === item.name.toLowerCase()) && pr.status === "pending");
                return (
                  <tr key={item.id} style={{ borderBottom:i<pageItems.length-1?"1px solid #F8FAFC":"none",
                    background:i%2===0?"#FFF":"#FAFAFA" }}>
                    {/* Tên danh mục */}
                    <td style={{ padding:"9px 12px" }}>
                      <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                        <CatalogThumbnail item={item} />
                        <div>
                          <p style={{ fontSize:13,fontWeight:600,color:"#0F172A",marginBottom:1 }}>{item.name}</p>
                          <p style={{ fontSize:11,color:"#94A3B8" }}>SKU: {item.sku}</p>
                        </div>
                      </div>
                    </td>
                    {/* Phân loại */}
                    <td style={{ padding:"9px 12px" }}>
                      <span style={{ fontSize:11,fontWeight:500,padding:"2px 8px",borderRadius:5,
                        background:catC.bg,color:catC.text,whiteSpace:"nowrap" }}>
                        {CATEGORY_LABEL[item.category] ?? item.category}
                      </span>
                      {!item.active && <span style={{ display:"block",fontSize:10,color:"#64748B",marginTop:4 }}>Tồn kho nội bộ</span>}
                    </td>
                    {/* Đơn vị */}
                    <td style={{ padding:"9px 12px",fontSize:12,color:"#475569" }}>{UNIT_LABEL[item.unit] ?? item.unit}</td>
                    {/* Giá niêm yết */}
                    <td style={{ padding:"9px 12px",fontSize:12,fontWeight:600,color:"#0F172A",
                      fontFamily:"'JetBrains Mono',monospace" }}>
                      {item.price.toLocaleString("vi-VN")}
                      {pendingReq && (
                        <div style={{ fontSize:10,color:"#D97706",fontWeight:600,marginTop:3,display:"flex",alignItems:"center",gap:3,fontFamily:"system-ui" }}>
                          <Clock size={10} /> Đề xuất: {pendingReq.newPrice.toLocaleString("vi-VN")}
                        </div>
                      )}
                    </td>
                    {/* Tồn kho hiện tại */}
                    <td style={{ padding:"9px 12px",minWidth:130 }}>{servicesView?availabilityLoading?<span style={{fontSize:11,color:"#94A3B8"}}>Đang tải lịch…</span>:available?<StockBar item={item} availability={available}/>:<span style={{fontSize:11,color:"#94A3B8"}}>{availabilityError?"Chưa tải được lịch":"Chưa cấu hình lịch"}</span>:<StockBar item={item}/>}</td>
                    {/* Ngưỡng đảm bảo */}
                    <td style={{ padding:"9px 12px",fontSize:12,color:"#64748B" }}>{servicesView?(available?`${available.capacity} ${available.unit}`:"—"):item.reorder}</td>
                    {/* Trạng thái */}
                    <td style={{ padding:"9px 12px" }}>
                      <div style={{ display:"flex",alignItems:"center",gap:5 }}>
                        <span style={{ width:7,height:7,borderRadius:99,background:cfg.dot,flexShrink:0 }} />
                        <span style={{ fontSize:11,fontWeight:600,padding:"2px 8px",borderRadius:99,
                          background:cfg.bg,color:cfg.text,whiteSpace:"nowrap" }}>{cfg.label}</span>
                      </div>
                    </td>
                    {/* Hành động */}
                    <td style={{ padding:"9px 12px" }}>
                      <div style={{ display:"flex",alignItems:"center",gap:5 }}>
                        <button onClick={() => servicesView ? onConfigureSchedule(item) : onOpenMovement(item.id,"RECEIVE")} style={{ fontSize:11,fontWeight:600,padding:"4px 10px",borderRadius:6,
                          border:"none",background:"#0F172A",color:"#FFF",cursor:"pointer",
                          display:"flex",alignItems:"center",gap:4 }}>
                          <SlidersHorizontal size={11} /> {servicesView ? "Cấu hình" : "Điều chỉnh"}
                        </button>
                        {servicesView && available?.consumes_stock && <button onClick={()=>onOpenMovement(item.id,"RECEIVE")} style={{fontSize:11,padding:"4px 10px",borderRadius:6,border:"1px solid #CBD5E1",background:"white"}}>Điều chỉnh</button>}
                        {item.active && pendingReq ? (
                          <button onClick={() => setModalItem(item)}
                            title="Đang có đề xuất đổi giá chờ Sếp/Quản lý duyệt"
                            style={{ fontSize:11,fontWeight:600,padding:"4px 8px",borderRadius:6,
                              border:"1px solid #FCD34D",background:"#FEF3C7",color:"#92400E",cursor:"pointer",
                              display:"flex",alignItems:"center",gap:3,whiteSpace:"nowrap" }}>
                            <Clock size={11} /> Chờ sếp duyệt
                          </button>
                        ) : item.active ? (
                          <button onClick={() => setModalItem(item)}
                            title="Lập đề xuất thay đổi giá niêm yết gửi Quản lý phê duyệt"
                            style={{ fontSize:11,fontWeight:600,padding:"4px 10px",borderRadius:6,
                              border:"1px solid #E2E8F0",background:"#FFF",color:"#334155",cursor:"pointer",
                              display:"flex",alignItems:"center",gap:3,whiteSpace:"nowrap" }}>
                            <Tag size={11} style={{ color:"#64748B" }} /> Đổi giá
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {pageItems.length === 0 && <tr><td colSpan={8} style={{padding:36,textAlign:"center",fontSize:12,color:"#64748B"}}>{loading ? "Đang tải danh mục tồn kho…" : items.length === 0 ? "Danh mục dịch vụ đang trống." : "Không có mặt hàng phù hợp với bộ lọc."}</td></tr>}
            </tbody>
          </table>

          {/* Pagination */}
          <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",
            padding:"11px 16px",borderTop:"1px solid #E2E8F0",background:"#F8FAFC" }}>
            <span style={{ fontSize:12,color:"#64748B" }}>
              Hiển thị {filtered.length === 0 ? 0 : (page-1)*PER_PAGE+1}–{Math.min(page*PER_PAGE,filtered.length)} trên {filtered.length} mặt hàng
            </span>
            <div style={{ display:"flex",gap:4,alignItems:"center" }}>
              <button onClick={() => setPage(p=>Math.max(1,p-1))} disabled={page===1}
                style={{ width:26,height:26,borderRadius:6,border:"1px solid #E2E8F0",background:"#FFF",
                  cursor:page===1?"not-allowed":"pointer",color:page===1?"#CBD5E1":"#475569",
                  display:"flex",alignItems:"center",justifyContent:"center",fontSize:13 }}>‹</button>
              {Array.from({ length: totalPages }, (_, index) => index + 1).map(n => (
                <button key={n} onClick={() => setPage(n)}
                  style={{ width:26,height:26,borderRadius:6,border:"1px solid #E2E8F0",
                    background:page===n?"#0F172A":"#FFF",cursor:"pointer",
                    color:page===n?"#FFF":"#475569",fontSize:12,fontWeight:page===n?700:400 }}>{n}</button>
              ))}
              <button onClick={() => setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages}
                style={{ width:26,height:26,borderRadius:6,border:"1px solid #E2E8F0",background:"#FFF",
                  cursor:page===totalPages?"not-allowed":"pointer",color:page===totalPages?"#CBD5E1":"#475569",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13 }}>›</button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal đề xuất đổi giá */}
      {modalItem && (
        <PriceRequestModal
          item={modalItem}
          existingRequest={priceRequests.find(pr => (pr.sku === modalItem.sku || pr.item.toLowerCase() === modalItem.name.toLowerCase()) && pr.status === "pending")}
          onClose={() => setModalItem(null)}
          onSubmit={async (newPrice, reason) => {
            const newReq: PriceRequest = {
              id: `PR-${String(priceRequests.length + 1).padStart(3, "0")}`,
              item: modalItem.name,
              sku: modalItem.sku,
              currentPrice: modalItem.price,
              newPrice,
              requestedBy: requesterName || "Bộ phận Kho và Dịch vụ",
              requestedAt: "Hôm nay " + new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
              status: "pending",
              reason,
            };
            await onAddPriceRequest(newReq);
            setToastMessage(`Đã gửi đề xuất đổi giá cho "${modalItem.name}" (${formatVnd(modalItem.price)} → ${formatVnd(newPrice)}) đến Sếp/Quản lý phê duyệt!`);
            setTimeout(() => setToastMessage(null), 6000);
          }}
        />
      )}

      {/* Toast thông báo */}
      {toastMessage && (
        <div style={{ position:"fixed",bottom:24,right:24,zIndex:110,background:"#0F172A",color:"#FFF",
          padding:"12px 18px",borderRadius:10,boxShadow:"0 10px 25px rgba(0,0,0,.3)",
          display:"flex",alignItems:"center",gap:10,fontSize:12,maxWidth:420 }}>
          <CheckCircle2 size={16} style={{ color:"#22C55E",flexShrink:0 }} />
          <span style={{ flex:1 }}>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} style={{ background:"none",border:"none",color:"#94A3B8",cursor:"pointer",padding:0 }}>
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   TRANSACTIONS SCREEN
══════════════════════════════════════════════════════════ */
function TransactionsScreen({ transactions = [], searchQuery }: { transactions?: Transaction[]; searchQuery: string }) {
  const [txTab, setTxTab] = useState<"all"|TxType>("all");
  const [exportOpen,setExportOpen] = useState(false);
  const filtered = transactions.filter(t => (txTab === "all" || t.type === txTab)
    && (!searchQuery.trim() || `${t.item} ${t.note ?? ""} ${t.staff}`.toLowerCase().includes(searchQuery.trim().toLowerCase())));

  return (
    <div style={{ flex:1,overflowY:"auto",padding:"20px 24px",background:"#F8FAFC" }}>
      <div style={{ display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:16 }}>
        <div>
          <h2 style={{ fontSize:18,fontWeight:700,color:"#0F172A",marginBottom:2 }}>Nhập – Xuất kho</h2>
          <p style={{ fontSize:12,color:"#94A3B8" }}>Lịch sử nhập xuất và quản lý phiếu kho</p>
        </div>
        <button type="button" onClick={()=>setExportOpen(true)} disabled={filtered.length===0} style={{height:34,padding:"0 14px",borderRadius:8,border:0,background:"#0F172A",color:"#FFF",fontSize:12,fontWeight:600,cursor:filtered.length?"pointer":"default",opacity:filtered.length?1:.5,display:"flex",alignItems:"center",gap:6}}><Download size={14}/>Xuất phiếu</button>
      </div>

      {/* Tabs */}
      <div style={{ display:"flex",borderBottom:"2px solid #E2E8F0",marginBottom:16 }}>
        {([["all","Tất cả"],["import","Nhập kho"],["export","Xuất kho"],["waste","Hao hụt"]] as [string,string][]).map(([v,l]) => {
          const active = txTab === v;
          return (
            <button key={v} onClick={() => setTxTab(v as "all"|TxType)}
              style={{ padding:"9px 18px",fontSize:13,fontWeight:active?600:400,cursor:"pointer",
                color:active?"#0F172A":"#64748B",background:"transparent",
                borderBottom:active?"2px solid #0F172A":"2px solid transparent",marginBottom:-2 }}>
              {l}
            </button>
          );
        })}
      </div>

      <div style={{ background:"#FFF",borderRadius:12,border:"1px solid #E2E8F0",overflowX:"auto",overflowY:"hidden" }}>
        <table style={{ width:"100%",minWidth:980,borderCollapse:"collapse" }}>
          <thead>
            <tr style={{ background:"#F8FAFC" }}>
              {["Ngày","Loại","Mặt hàng","Số lượng","Giá trị tham chiếu","Nhân viên","Trạng thái"].map(h => (
                <th key={h} style={{ padding:"10px 14px",fontSize:11,fontWeight:700,color:"#64748B",
                  textAlign:"left",letterSpacing:"0.04em",textTransform:"uppercase",whiteSpace:"nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((tx, i) => (
              <tr key={tx.id} style={{ borderTop:"1px solid #F1F5F9",background:i%2===0?"#FFF":"#FAFAFA" }}>
                <td style={{ padding:"11px 14px",fontSize:12,color:"#475569",whiteSpace:"nowrap" }}>{tx.date}</td>
                <td style={{ padding:"11px 14px" }}>
                  <span style={{ fontSize:11,fontWeight:600,padding:"2px 8px",borderRadius:99,
                    background:tx.type==="import"?"#DCFCE7":tx.type==="waste"?"#FFE4E6":tx.type==="adjustment"?"#F1F5F9":"#DBEAFE",
                    color:tx.type==="import"?"#166534":tx.type==="waste"?"#BE123C":tx.type==="adjustment"?"#475569":"#1D4ED8" }}>
                    {tx.type==="import"?"↓ Nhập / hoàn kho":tx.type==="waste"?"Hao hụt":tx.type==="adjustment"?"Điều chỉnh":"↑ Xuất sử dụng"}
                  </span>
                </td>
                <td style={{ padding:"11px 14px" }}>
                  <p style={{ fontSize:13,fontWeight:600,color:"#0F172A" }}>{tx.item}</p>
                  {tx.note && <p style={{ fontSize:11,color:"#94A3B8",marginTop:1 }}>{tx.note}</p>}
                </td>
                <td style={{ padding:"11px 14px",fontSize:13,fontWeight:700,color:"#0F172A",
                  fontFamily:"'JetBrains Mono',monospace" }}>
                  {tx.qty > 0 ? "+" : ""}{tx.qty}
                </td>
                <td style={{ padding:"11px 14px",fontSize:12,fontWeight:600,color:"#0F172A" }}>{fmtVNDFull(tx.amount)}</td>
                <td style={{ padding:"11px 14px",fontSize:12,color:"#475569" }}>{tx.staff}</td>
                <td style={{ padding:"11px 14px" }}>
                  <span style={{ fontSize:11,fontWeight:600,padding:"2px 8px",borderRadius:99,
                    background:tx.status==="completed"?"#DCFCE7":tx.status==="pending"?"#FEF9C3":"#FFE4E6",
                    color:tx.status==="completed"?"#166534":tx.status==="pending"?"#92400E":"#BE123C" }}>
                    {tx.status==="completed"?"✓ Hoàn thành":tx.status==="pending"?"⏳ Đang xử lý":"✗ Hủy"}
                  </span>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={7} style={{padding:32,textAlign:"center",fontSize:12,color:"#64748B"}}>Không có phiếu kho phù hợp với bộ lọc.</td></tr>}
          </tbody>
        </table>
      </div>
      {exportOpen&&<StockVoucherDialog movements={filtered} onClose={()=>setExportOpen(false)}/>}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   PRICE PROPOSAL RESULT MODAL
══════════════════════════════════════════════════════════ */
function PriceProposalResultModal({
  request,
  onClose,
  onActivate,
}: {
  request: PriceRequest;
  onClose: () => void;
  onActivate?: (req: PriceRequest) => Promise<void>;
}) {
  const [activating, setActivating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const delta = request.newPrice - request.currentPrice;
  const deltaPct = ((delta / request.currentPrice) * 100).toFixed(1);
  const up = delta > 0;

  const STAT_MAP: Record<PriceStatus, { label: string; bg: string; text: string; desc: string }> = {
    pending: { label: "Chờ duyệt", bg: "#FEF9C3", text: "#92400E", desc: "Đề xuất đã gửi tới Quản lý và đang chờ xem xét phê duyệt." },
    approved: { label: "Đã duyệt", bg: "#DCFCE7", text: "#166534", desc: "Quản lý đã phê duyệt đề xuất. Có thể kích hoạt giá ngay để áp dụng vào hệ thống." },
    rejected: { label: "Từ chối", bg: "#FFE4E6", text: "#BE123C", desc: "Đề xuất đã bị Quản lý từ chối." },
    expired: { label: "Hết hạn", bg: "#F1F5F9", text: "#475569", desc: "Đề xuất đã quá thời hạn hiệu lực." },
    consumed: { label: "Đã áp dụng", bg: "#DBEAFE", text: "#1D4ED8", desc: "Giá mới đã được kích hoạt thành công và đang áp dụng thực tế trên toàn hệ thống." },
  };

  const currentStat = STAT_MAP[request.status];

  const handleActivateClick = async () => {
    if (!onActivate) return;
    setActivating(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await onActivate(request);
      setSuccessMsg("Kích hoạt giá thành công! Dịch vụ đã cập nhật mức giá mới.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Không thể kích hoạt giá.";
      if (message.includes("52206") || message.toLowerCase().includes("requester")) {
        setErrorMsg("Theo quy chuẩn kiểm soát nội bộ (RBAC), nhân viên lập đề xuất không thể tự kích hoạt. Vui lòng nhờ Quản lý (người duyệt) bấm 'Áp dụng giá ngay' tại Màn hình Quản lý.");
      } else {
        setErrorMsg(message);
      }
    } finally {
      setActivating(false);
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 120,
      background: "rgba(15,23,42,.55)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div style={{
        background: "#FFF", borderRadius: 16, width: "100%", maxWidth: 520,
        boxShadow: "0 20px 40px rgba(0,0,0,.15)", overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          padding: "16px 20px", borderBottom: "1px solid #E2E8F0",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "#F8FAFC",
        }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0F172A", margin: 0 }}>
              Tiến trình &amp; Kết quả đề xuất
            </h3>
            <p style={{ fontSize: 12, color: "#64748B", margin: "2px 0 0" }}>
              Mã đề xuất: #{request.id} · Dịch vụ: {request.sku}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B", padding: 4 }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: "20px 24px" }}>
          {/* Status banner */}
          <div style={{
            padding: "12px 16px", borderRadius: 10, background: currentStat.bg,
            border: `1px solid ${currentStat.text}20`, marginBottom: 18,
            display: "flex", alignItems: "flex-start", gap: 12,
          }}>
            <div style={{
              padding: "4px 10px", borderRadius: 99, background: "#FFF",
              fontSize: 12, fontWeight: 700, color: currentStat.text, flexShrink: 0,
            }}>
              {currentStat.label}
            </div>
            <p style={{ fontSize: 12, color: currentStat.text, margin: 0, lineHeight: 1.5 }}>
              {request.catalogAddition && request.status==="consumed" ? "Quản lý đã duyệt và tạo danh mục mới thành công." : currentStat.desc}
            </p>
          </div>

          {/* Service & Price Details */}
          <div style={{ background: "#F8FAFC", borderRadius: 12, border: "1px solid #E2E8F0", padding: "14px 16px", marginBottom: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
              Thông tin danh mục &amp; Mức giá
            </p>
            <p style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", marginBottom: 12 }}>
              {request.item} <span style={{ fontSize: 12, fontWeight: 500, color: "#64748B", fontFamily: "'JetBrains Mono',monospace" }}>({request.sku})</span>
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <div style={{ background: "#FFF", padding: "8px 12px", borderRadius: 8, border: "1px solid #E2E8F0" }}>
                <p style={{ fontSize: 10, color: "#64748B", marginBottom: 3 }}>Giá hiện tại</p>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#475569" }}>{formatVnd(request.currentPrice)}</p>
              </div>
              <div style={{ background: "#FFF", padding: "8px 12px", borderRadius: 8, border: "1px solid #E2E8F0" }}>
                <p style={{ fontSize: 10, color: "#64748B", marginBottom: 3 }}>Giá đề xuất</p>
                <p style={{ fontSize: 13, fontWeight: 800, color: "#0F172A" }}>{formatVnd(request.newPrice)}</p>
              </div>
              <div style={{ background: "#FFF", padding: "8px 12px", borderRadius: 8, border: "1px solid #E2E8F0" }}>
                <p style={{ fontSize: 10, color: "#64748B", marginBottom: 3 }}>Thay đổi</p>
                <p style={{ fontSize: 13, fontWeight: 700, color: up ? "#16A34A" : "#DC2626" }}>
                  {request.catalogAddition?"Thêm mới":request.currentPrice===0?formatVnd(delta):`${up?"+":""}${deltaPct}%`}
                </p>
              </div>
            </div>
          </div>

          {/* Audit trail / Details */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12, color: "#334155", marginBottom: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#64748B" }}>Người đề xuất:</span>
              <strong>{request.requestedBy}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#64748B" }}>Thời gian gửi:</span>
              <span>{request.requestedAt}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#64748B" }}>Lý do đề xuất:</span>
              <span style={{ fontWeight: 500 }}>{request.reason || "—"}</span>
            </div>
            {request.rawApproval?.approver && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#64748B" }}>Người phê duyệt:</span>
                <strong style={{ color: "#166534" }}>{request.rawApproval.approver}</strong>
              </div>
            )}
            {request.rawApproval?.decided_at && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#64748B" }}>Thời điểm duyệt:</span>
                <span>{new Date(request.rawApproval.decided_at).toLocaleString("vi-VN")}</span>
              </div>
            )}
          </div>

          {/* Notifications */}
          {errorMsg && (
            <div role="alert" style={{
              padding: "10px 14px", borderRadius: 8, background: "#FFF1F2",
              border: "1px solid #FECDD3", color: "#BE123C", fontSize: 12, marginBottom: 16, lineHeight: 1.5,
            }}>
              {errorMsg}
            </div>
          )}
          {successMsg && (
            <div role="status" style={{
              padding: "10px 14px", borderRadius: 8, background: "#F0FDF4",
              border: "1px solid #BBF7D0", color: "#166534", fontSize: 12, marginBottom: 16,
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <CheckCircle2 size={16} />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button
              onClick={onClose}
              style={{
                height: 36, padding: "0 16px", borderRadius: 8, border: "1px solid #E2E8F0",
                background: "#FFF", color: "#475569", fontSize: 12, fontWeight: 600, cursor: "pointer",
              }}
            >
              Đóng
            </button>
            {!request.catalogAddition && request.status === "approved" && onActivate && (
              <button
                onClick={handleActivateClick}
                disabled={activating || Boolean(successMsg)}
                style={{
                  height: 36, padding: "0 16px", borderRadius: 8, border: "none",
                  background: activating ? "#64748B" : "#16A34A", color: "#FFF",
                  fontSize: 12, fontWeight: 700, cursor: activating ? "wait" : "pointer",
                  display: "flex", alignItems: "center", gap: 6,
                }}
              >
                <Zap size={14} />
                {activating ? "Đang kích hoạt…" : "Kích hoạt giá ngay"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   PRICING SCREEN
══════════════════════════════════════════════════════════ */
function PricingScreen({
  requests,
  items,
  onAddPriceRequest,
  onActivatePrice,
  onAddCatalogRequest,
  requesterName,
  searchQuery,
  userProfile,
}: {
  requests: PriceRequest[];
  items: InventoryItem[];
  onAddPriceRequest: (req: PriceRequest) => Promise<void>;
  onActivatePrice?: (req: PriceRequest) => Promise<void>;
  onAddCatalogRequest: (body: CatalogProposal) => Promise<void>;
  requesterName?: string;
  searchQuery: string;
  userProfile?: EmployeeProfileDto | null;
}) {
  const [priceStatus, setPriceStatus] = useState<"all"|PriceStatus>("all");
  const [showForm, setShowForm] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState<PriceRequest | null>(null);
  const filtered = requests.filter(request => (priceStatus === "all" || request.status === priceStatus)
    && (!searchQuery.trim() || `${request.item} ${request.sku} ${request.reason ?? ""}`.toLowerCase().includes(searchQuery.trim().toLowerCase())));

  const STAT_CFG: Record<PriceStatus,{label:string;bg:string;text:string}> = {
    pending:  { label:"Chờ duyệt",bg:"#FEF9C3",text:"#92400E" },
    approved: { label:"Đã duyệt", bg:"#DCFCE7",text:"#166534" },
    rejected: { label:"Từ chối",  bg:"#FFE4E6",text:"#BE123C" },
    expired:  { label:"Hết hạn",  bg:"#F1F5F9",text:"#475569" },
    consumed: { label:"Đã áp dụng",bg:"#DBEAFE",text:"#1D4ED8" },
  };

  return (
    <div style={{ flex:1,overflowY:"auto",padding:"20px 24px",background:"#F8FAFC" }}>
      <div style={{ display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:16 }}>
        <div>
          <h2 style={{ fontSize:18,fontWeight:700,color:"#0F172A",marginBottom:2 }}>Đề xuất</h2>
        </div>
        <button onClick={() => { setShowForm(true); }} style={{ height:34,padding:"0 14px",borderRadius:8,
          background:"#0F172A",color:"#FFF",fontSize:12,fontWeight:600,cursor:"pointer",
          display:"flex",alignItems:"center",gap:5 }}>
          <Plus size={14} /> Tạo yêu cầu
        </button>
      </div>

      {showForm && <ProposalDialog items={items} onClose={()=>setShowForm(false)}
        onPrice={async(item,price,reason)=>{
          await onAddPriceRequest({id:`new-${Date.now()}`,item:item.name,sku:item.id,currentPrice:item.price,newPrice:price,
            requestedBy:requesterName||"KITCHEN",requestedAt:new Date().toISOString(),status:"pending",reason});
        }} onCatalog={onAddCatalogRequest}/>}

      <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:16 }}>
        {(["pending","approved","rejected","expired","consumed"] as PriceStatus[]).map(s => {
          const cfg   = STAT_CFG[s];
          const count = requests.filter(p => p.status === s).length;
          return (
            <div key={s} style={{ background:"#FFF",borderRadius:10,border:"1px solid #E2E8F0",padding:"14px 18px" }}>
              <p style={{ fontSize:11,color:"#64748B",marginBottom:6 }}>{cfg.label}</p>
              <p style={{ fontFamily:"'JetBrains Mono',monospace",fontSize:24,fontWeight:800,color:"#0F172A" }}>{count}</p>
              <span style={{ fontSize:11,fontWeight:600,padding:"2px 8px",borderRadius:99,
                background:cfg.bg,color:cfg.text }}>{cfg.label}</span>
            </div>
          );
        })}
      </div>

      <div style={{ display:"flex",gap:6,marginBottom:14 }}>
        {([["all","Tất cả"],["pending","Chờ duyệt"],["approved","Đã duyệt"],["rejected","Từ chối"],["expired","Hết hạn"],["consumed","Đã áp dụng"]] as [string,string][]).map(([v,l]) => {
          const active = priceStatus === v;
          return (
            <button key={v} onClick={() => setPriceStatus(v as "all"|PriceStatus)}
              style={{ padding:"6px 14px",borderRadius:99,cursor:"pointer",fontSize:12,fontWeight:active?600:400,
                background:active?"#0F172A":"#FFF",color:active?"#FFF":"#475569",
                border:`1px solid ${active?"#0F172A":"#E2E8F0"}` }}>
              {l}
            </button>
          );
        })}
      </div>

      <div style={{ background:"#FFF",borderRadius:12,border:"1px solid #E2E8F0",overflowX:"auto",overflowY:"hidden" }}>
        <table style={{ width:"100%",minWidth:1040,borderCollapse:"collapse" }}>
          <thead>
            <tr style={{ background:"#F8FAFC" }}>
              {["Danh mục / mặt hàng","SKU","Giá hiện tại","Giá đề xuất","Thay đổi","Yêu cầu bởi","Trạng thái","Thao tác"].map(h => (
                <th key={h} style={{ padding:"10px 14px",fontSize:11,fontWeight:700,color:"#64748B",
                  textAlign:"left",letterSpacing:"0.04em",textTransform:"uppercase",whiteSpace:"nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((pr, i) => {
              const cfg    = STAT_CFG[pr.status];
              const delta  = pr.newPrice - pr.currentPrice;
              const deltaPct = ((delta / pr.currentPrice) * 100).toFixed(1);
              const up     = delta > 0;
              return (
                <tr key={pr.id} style={{ borderTop:"1px solid #F1F5F9",background:i%2===0?"#FFF":"#FAFAFA" }}>
                  <td style={{ padding:"11px 14px" }}>
                    <p style={{ fontSize:13,fontWeight:600,color:"#0F172A" }}>{pr.item}</p>
                    {pr.reason && <p style={{ fontSize:11,color:"#94A3B8" }}>{pr.reason}</p>}
                  </td>
                  <td style={{ padding:"11px 14px",fontSize:11,color:"#94A3B8",fontFamily:"'JetBrains Mono',monospace" }}>{pr.sku}</td>
                  <td style={{ padding:"11px 14px",fontSize:12,color:"#475569" }}>{pr.catalogAddition?"—":pr.currentPrice.toLocaleString("vi-VN")}</td>
                  <td style={{ padding:"11px 14px",fontSize:12,fontWeight:700,color:"#0F172A" }}>{pr.newPrice.toLocaleString("vi-VN")}</td>
                  <td style={{ padding:"11px 14px" }}>
                    <span style={{ fontSize:12,fontWeight:700,color:up?"#16A34A":"#DC2626" }}>
                      {pr.catalogAddition?"Thêm mới":pr.currentPrice===0?formatVnd(delta):`${up?"+":""}${deltaPct}%`}
                    </span>
                  </td>
                  <td style={{ padding:"11px 14px" }}>
                    <p style={{ fontSize:12,color:"#334155" }}>{pr.requestedBy}</p>
                    <p style={{ fontSize:11,color:"#94A3B8" }}>{pr.requestedAt}</p>
                  </td>
                  <td style={{ padding:"11px 14px" }}>
                    <span style={{ fontSize:11,fontWeight:600,padding:"2px 8px",borderRadius:99,
                      background:cfg.bg,color:cfg.text }}>{cfg.label}</span>
                  </td>
                  <td style={{ padding:"11px 14px" }}>
                    <button
                      onClick={() => setSelectedProposal(pr)}
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: "5px 11px",
                        borderRadius: 7,
                        border: "1px solid #CBD5E1",
                        background: pr.status === "approved" ? "#F0FDF4" : "#FFF",
                        color: pr.status === "approved" ? "#166534" : pr.status === "pending" ? "#92400E" : "#2563EB",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        transition: "all .12s",
                      }}
                    >
                      <Eye size={12} />
                      {pr.status === "pending" ? "Xem tiến trình" : "Xem kết quả"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selectedProposal && (
        <PriceProposalResultModal
          request={selectedProposal}
          onClose={() => setSelectedProposal(null)}
          onActivate={onActivatePrice}
        />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   REPORTS SCREEN
══════════════════════════════════════════════════════════ */

const NAV: { id: NavPage; label: string; Icon: React.ElementType }[] = [
  { id:"restaurant",   label:"Điều phối dịch vụ",  Icon:Utensils },
  { id:"inventory",    label:"Kho",                Icon:Package },
  { id:"services",     label:"Dịch vụ",            Icon:Tag },
  { id:"returns",      label:"Duyệt trả kho",      Icon:RefreshCw },
  { id:"pricing",      label:"Đề xuất", Icon:Tag },
  { id:"reports",      label:"Báo cáo tiêu thụ",    Icon:BarChart2 },
];

const NAV_LABELS: Record<NavPage, string> = {
  restaurant:   "Điều phối dịch vụ",
  inventory:    "Kho",
  services:     "Dịch vụ",
  returns:      "Duyệt trả kho",
  transactions: "Nhập – Xuất kho",
  pricing:      "Đề xuất",
  reports:      "Báo cáo tiêu thụ",
};

export default function KitchenInventory({ onBack }: { onBack: () => void }) {
  const [page, setPage] = useState<NavPage>("restaurant");
  const [globalSearch, setGlobalSearch] = useState("");
  const [priceRequests, setPriceRequests] = useState<PriceRequest[]>([]);
  const [liveItems, setLiveItems] = useState<InventoryItem[]>([]);
  const [availabilitySummary,setAvailabilitySummary]=useState<ServiceAvailability[]|null>(null);
  const [liveTransactions, setLiveTransactions] = useState<Transaction[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(true);
  const [inventoryError, setInventoryError] = useState<string | null>(null);
  const [inventoryRefreshKey, setInventoryRefreshKey] = useState(0);
  const [scheduleItem,setScheduleItem]=useState<InventoryItem|null>(null);
  const [movementDialog, setMovementDialog] = useState<{ serviceId?: string; type: MovementType; reason?: string } | null>(null);
  const [movementNotice, setMovementNotice] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<EmployeeProfileDto | null>(null);
  const profileRoleLabel = userProfile?.role && userProfile.role !== "KITCHEN"
    ? employeeRoleLabel(userProfile.role) : "Quản lý kho và dịch vụ";
  const [topProfileOpen, setTopProfileOpen] = useState(false);
  const [sidebarProfileOpen, setSidebarProfileOpen] = useState(false);
  const [restaurantDate, setRestaurantDate] = useState(() => localDateValue());
  const [restaurantBookings, setRestaurantBookings] = useState<RestaurantBooking[]>([]);
  const [restaurantLoading, setRestaurantLoading] = useState(false);
  const [restaurantError, setRestaurantError] = useState<string | null>(null);
  const [restaurantBusyId, setRestaurantBusyId] = useState<number | null>(null);
  const [restaurantRefreshKey, setRestaurantRefreshKey] = useState(0);

  const todayLabel = useMemo(() => new Date().toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" }), []);

  const catalogItems = liveItems.filter(item => page === "inventory" ? isStockItem(item) : page === "services" ? !isStockItem(item) : true);
  const catalogIds = new Set(catalogItems.map(item => item.id));
  const catalogTransactions = liveTransactions.filter(transaction => catalogIds.has(transaction.serviceId));
  const catalogPriceRequests = priceRequests.filter(request => request.catalogAddition
    ? page === "inventory" ? request.catalogKind === "WAREHOUSE" : page === "services" ? request.catalogKind === "SERVICE" : true
    : catalogIds.has(request.sku));
  const liveUsage: StockActivity[] = catalogTransactions.slice(0, 10).map(transaction => ({
    id: transaction.id,
    name: liveItems.find(item=>item.id===transaction.serviceId)?.name ?? transaction.item,
    sku: transaction.serviceId,
    qty: transaction.qty,
    occurredAt: transaction.occurredAt,
    staff: transaction.staff,
    movementType: transaction.movementType,
  }));

  useEffect(() => {
    let active = true;
    authApi.employeeProfile()
      .then(profile => { if (active) setUserProfile(profile); })
      .catch(err => console.warn("Backend kitchen profile unavailable:", err));

    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setInventoryLoading(true);
    setInventoryError(null);
    kitchenAccountingApi.services()
      .then(async services => {
        if (!active) return;
        const mapped = services.map((service: Service): InventoryItem => {
          const category = service.category || "Dịch vụ";
          return {
            id: service.id,
            name: service.name,
            sku: service.id,
            category,
            unit: service.unit || "lượt",
            price: service.price,
            stock: service.stock,
            reorder: service.safety_threshold,
            active: service.active !== false,
            imageUrl: service.image_url ?? null,
            emoji: ITEM_EMOJI[service.id] ?? "📦",
          };
        });
        setLiveItems(mapped);
        const movementLists = await Promise.all(mapped.map(item => kitchenAccountingApi.inventoryMovements(item.id)));
        if (!active) return;
        const itemById = new Map(mapped.map(item => [item.id, item]));
        const transactions = movementLists.flat().flatMap((movement: InventoryMovement): Transaction[] => {
          const item = itemById.get(movement.service_id);
          if (!item) return [];
          const signedQuantity = movement.type === "ADJUST"
            ? movement.quantity
            : movement.type === "RECEIVE" || movement.type === "RETURN" ? movement.quantity : -movement.quantity;
          const type: TxType = movement.type === "RECEIVE" || movement.type === "RETURN" ? "import"
            : movement.type === "ISSUE" ? "export" : movement.type === "WASTE" ? "waste" : "adjustment";
          return [{
            id: String(movement.id),
            serviceId: movement.service_id,
            date: new Date(movement.occurred_at).toLocaleString("vi-VN"),
            occurredAt: movement.occurred_at,
            type,
            movementType: movement.type,
            item: `${item.name} (${item.sku})`,
            itemName:item.name,
            unit:item.unit,
            unitPrice:item.price,
            staffName:movement.actor_name??undefined,
            stockBefore:movement.stock_before,
            stockAfter:movement.stock_after,
            qty: signedQuantity,
            amount: item.price * Math.abs(movement.quantity),
            staff: movement.actor_name || movement.actor_id,
            status: "completed",
            note: movement.reason || undefined,
          }];
        }).sort((a,b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
        setLiveTransactions(transactions);
      })
      .catch(err => {
        console.warn("Backend service catalog unavailable:", err);
        if (active) setInventoryError(apiErrorMessage(err, "Không tải được dữ liệu kho."));
      })
      .finally(() => { if (active) setInventoryLoading(false); });

    return () => { active = false; };
  }, [inventoryRefreshKey]);

  useEffect(() => {
    if (liveItems.length === 0) return;
    let active = true;
    Promise.all([kitchenAccountingApi.priceRequests(), catalogProposalsApi.list()]).then(groups=>groups.flat())
      .then(requests => {
        const mapped = requests.map((approval: Approval): PriceRequest | null => {
          let requestedPrice: unknown;
          try {
            const payload: unknown = JSON.parse(approval.payload);
            if (typeof payload === "number" || typeof payload === "string") requestedPrice = payload;
            else if (typeof payload === "object" && payload !== null && "price" in payload) {
              requestedPrice = (payload as { price?: unknown }).price;
            }
          } catch {
            requestedPrice = approval.payload;
          }
          let addition: CatalogProposal | undefined;
          if(approval.action === "SERVICE_CATALOG_CREATE") {
            try { addition=JSON.parse(approval.payload) as CatalogProposal; } catch { return null; }
          }
          const item = liveItems.find(entry => entry.id === approval.target_id)
            ?? (addition ? {name:addition.name,sku:addition.id,price:0} : undefined);
          const newPrice = Number(requestedPrice);
          if (!item || !Number.isFinite(newPrice) || newPrice < 0) return null;
          const status: PriceStatus = approval.status === "PENDING" ? "pending"
            : (approval.status === "APPROVED" && !approval.consumed_at) ? "approved"
            : approval.status === "REJECTED" ? "rejected"
            : approval.status === "EXPIRED" ? "expired" : "consumed";
          return {
            id: String(approval.id), item: item.name, sku: item.sku, currentPrice: addition ? 0 : item.price, catalogAddition: Boolean(addition), catalogKind: addition?.kind,
            newPrice, requestedBy: approval.requester, requestedAt: new Date(approval.requested_at).toLocaleString("vi-VN"),
            status, reason: approval.reason,
            rawApproval: approval,
          };
        }).filter((request): request is PriceRequest => Boolean(request));
        if (active) setPriceRequests(mapped);
      })
      .catch(err => {
        console.warn("Backend kitchen price requests unavailable:", err);
        if (active) setInventoryError(apiErrorMessage(err, "Không tải được lịch sử đề xuất giá."));
      });
    return () => { active = false; };
  }, [liveItems]);

  const priceSubmission = useRef<{payload:string;key:string}|null>(null);
  const handleAddPriceRequest = async (req: PriceRequest): Promise<void> => {
    const service = liveItems.find(item => item.sku === req.sku || item.name === req.item);
    if (!service) throw new Error("Dịch vụ không còn trong danh mục; tải lại dữ liệu rồi thử lại.");
    const payload=JSON.stringify([service.id,req.newPrice,req.reason??""]);
    if(priceSubmission.current?.payload!==payload) priceSubmission.current={payload,key:newKitchenIdempotencyKey()};
    const approval = await kitchenAccountingApi.submitPrice(service.id, {
      price: req.newPrice,
      reason: req.reason ?? "",
    }, priceSubmission.current!.key);
    priceSubmission.current=null;
    setPriceRequests(prev => [{ ...req, id: String(approval.id), requestedBy: approval.requester,
      requestedAt: new Date(approval.requested_at).toLocaleString("vi-VN"), reason: approval.reason, rawApproval: approval }, ...prev]);
  };

  const catalogSubmission = useRef<{payload:string;key:string}|null>(null);
  const handleAddCatalogRequest = async (body:CatalogProposal) => {
    const payload=JSON.stringify(body);
    if(catalogSubmission.current?.payload!==payload) catalogSubmission.current={payload,key:newKitchenIdempotencyKey()};
    await catalogProposalsApi.submit(body,catalogSubmission.current!.key);
    catalogSubmission.current=null;
    setInventoryRefreshKey(key=>key+1);
  };

  const handleActivatePrice = async (req: PriceRequest): Promise<void> => {
    await kitchenAccountingApi.activatePrice(req.sku, {
      price: req.newPrice,
      reason: req.reason || "Kích hoạt giá dịch vụ đã duyệt",
    }, newKitchenIdempotencyKey());
    setInventoryRefreshKey(key => key + 1);
  };

  useEffect(() => {
    let active = true;
    setRestaurantLoading(true);
    setRestaurantError(null);
    kitchenAccountingApi.coordinatedBookings({ date: restaurantDate })
      .then(rows => { if (active) setRestaurantBookings(rows); })
      .catch(error => {
        console.warn("Không tải được lịch dịch vụ:", error);
        if (active) { setRestaurantBookings([]); setRestaurantError(apiErrorMessage(error, "Không tải được lịch dịch vụ.")); }
      })
      .finally(() => { if (active) setRestaurantLoading(false); });
    return () => { active = false; };
  }, [restaurantDate, restaurantRefreshKey]);

  const handleMarkRestaurantUsed = async (booking: RestaurantBooking) => {
    setRestaurantBusyId(booking.id);
    setRestaurantError(null);
    try {
      const updated = await kitchenAccountingApi.markServiceBookingUsed(booking.id);
      setRestaurantBookings(rows => rows.map(row => row.id === booking.id ? updated : row));
      setInventoryRefreshKey(key => key + 1);
    } catch (error) {
      setRestaurantError(apiErrorMessage(error, "Không thể xác nhận sử dụng."));
    } finally {
      setRestaurantBusyId(null);
    }
  };

  const handleInventoryMovement = async (serviceId: string, type: MovementType, quantity: number, reason: string) => {
    await kitchenAccountingApi.recordInventoryMovement({ service_id: serviceId, type, quantity, reason }, newKitchenIdempotencyKey());
    const label = MOVEMENT_OPTIONS.find(([value]) => value === type)?.[1] ?? "Phiếu kho";
    setMovementNotice(`${label} đã được ghi nhận; tồn kho và sổ biến động đã cập nhật.`);
    setInventoryRefreshKey(key => key + 1);
    globalThis.setTimeout(() => setMovementNotice(null), 6000);
  };

  return (
    <div style={{ display:"flex",height:"100vh",overflow:"hidden",
      background:"#F8FAFC",fontFamily:"'Inter',system-ui,sans-serif" }}>

      {/* SIDEBAR */}
      <aside style={{ width:190,background:"#FFF",borderRight:"1px solid #E2E8F0",
        display:"flex",flexDirection:"column",flexShrink:0 }}>
        {/* Brand */}
        <div style={{ padding:"14px 14px 12px",borderBottom:"1px solid #E2E8F0" }}>
          <div style={{ display:"flex",alignItems:"center",gap:9 }}>
            <img
              src="/hotel_logo.png"
              alt="MaM Hotel Logo"
              style={{ width:36,height:"auto",objectFit:"contain",flexShrink:0,filter:"drop-shadow(0 2px 6px rgba(184,148,74,0.35))" }}
            />
            <div>
              <p style={{ fontSize:13,fontWeight:700,color:"#0F172A",lineHeight:1.1,fontFamily:"'Cormorant Garamond',Georgia,serif",letterSpacing:"0.05em" }}>MaM Hotel</p>
              <p style={{ fontSize:9,color:"#D97706",letterSpacing:"0.08em",textTransform:"uppercase",marginTop:2,fontWeight:600 }}>KHO VÀ DỊCH VỤ</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex:1,padding:"10px 8px",overflowY:"auto" }}>
          {NAV.map(n => {
            const active = page === n.id;
            return (
              <button key={n.id} onClick={() => setPage(n.id)}
                style={{ width:"100%",display:"flex",alignItems:"center",gap:8,
                  padding:"8px 10px",borderRadius:8,cursor:"pointer",marginBottom:2,
                  background:active?"#0F172A":"transparent",
                  color:active?"#FFF":"#475569",fontWeight:active?600:400,fontSize:12,
                  textAlign:"left",transition:"all .12s" }}>
                <n.Icon size={14} style={{ color:active?"#FFF":"#94A3B8",flexShrink:0 }} strokeWidth={active?2:1.5} />
                {/* Decode HTML entities for display */}
                {NAV_LABELS[n.id]}
              </button>
            );
          })}
        </nav>

        {/* Profile */}
        <div style={{ padding:"10px 14px",borderTop:"1px solid #F1F5F9",position:"relative" }}>
          <div
            onClick={()=>setSidebarProfileOpen(p=>!p)}
            style={{ display:"flex",alignItems:"center",gap:8,marginBottom:8,cursor:"pointer" }}
            title="Hồ sơ nhân viên"
          >
            <div style={{ width:30,height:30,borderRadius:99,flexShrink:0,
              background:"linear-gradient(135deg,#1D4ED8,#3B82F6)",
              display:"flex",alignItems:"center",justifyContent:"center",
              fontSize:12,fontWeight:800,color:"#FFF" }}>
              {userProfile?.full_name ? userProfile.full_name.slice(0, 2).toUpperCase() : "VK"}
            </div>
            <div>
              <p style={{ fontSize:11,fontWeight:700,color:"#0F172A",lineHeight:1 }}>{userProfile?.full_name || "Võ Minh Kho và Dịch vụ"}</p>
              <p style={{ fontSize:10,color:"#94A3B8" }}>{profileRoleLabel}</p>
            </div>
          </div>
          <button onClick={onBack}
            style={{ display:"flex",alignItems:"center",gap:5,color:"#94A3B8",cursor:"pointer",fontSize:11,background:"transparent",border:"none",padding:0 }}>
            <LogOut size={11} /> Đăng xuất
          </button>
          <EmployeeProfileDropdown
            isOpen={sidebarProfileOpen}
            onClose={()=>setSidebarProfileOpen(false)}
            onLogout={onBack}
            align="bottom-left"
            currentRoleLabel={profileRoleLabel}
            roleLabelOverride={userProfile?.role === "KITCHEN" ? profileRoleLabel : undefined}
            departmentName="Bộ phận Kho và Dịch vụ"
          />
        </div>
      </aside>

      {/* MAIN */}
      <div style={{ flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minWidth:0 }}>

        {/* HEADER */}
        <header style={{ background:"#FFF",borderBottom:"1px solid #E2E8F0",height:52,
          display:"flex",alignItems:"center",gap:12,padding:"0 22px",flexShrink:0 }}>
          {/* Search */}
          <div style={{ position:"relative",flex:1,maxWidth:500 }}>
            <Search size={13} style={{ position:"absolute",left:11,top:"50%",transform:"translateY(-50%)",color:"#94A3B8",pointerEvents:"none" }} />
            <input aria-label="Tìm trong bộ phận kho và dịch vụ" value={globalSearch} onChange={event => setGlobalSearch(event.target.value)} placeholder="Tìm mặt hàng, dịch vụ hoặc phòng..."
              style={{ width:"100%",height:34,paddingLeft:32,paddingRight:12,borderRadius:8,
                border:"1px solid #E2E8F0",background:"#F8FAFC",fontSize:12,outline:"none",boxSizing:"border-box" }} />
          </div>
          <div style={{ flex:1 }} />
          <StockNotifications usage={liveUsage} onSeeAll={()=>setPage("transactions")}/>
          <div style={{ position:"relative" }}>
            <div
              onClick={()=>setTopProfileOpen(p=>!p)}
              style={{ display:"flex",alignItems:"center",gap:8,cursor:"pointer" }}
              title="Hồ sơ nhân viên"
            >
              <div style={{ width:30,height:30,borderRadius:99,
                background:"linear-gradient(135deg,#14B8A6,#0D9488)",
                display:"flex",alignItems:"center",justifyContent:"center",
                fontSize:11,fontWeight:700,color:"#FFF" }}>
                {userProfile?.full_name ? userProfile.full_name.slice(0, 2).toUpperCase() : "VK"}
              </div>
              <div>
                <p style={{ fontSize:12,fontWeight:700,color:"#0F172A",lineHeight:1 }}>{userProfile?.full_name || "Võ Minh Kho và Dịch vụ"}</p>
                <p style={{ fontSize:10,color:"#94A3B8" }}>{profileRoleLabel}</p>
              </div>
              <ChevronDown size={12} style={{ color:"#94A3B8" }} />
            </div>
            <EmployeeProfileDropdown
              isOpen={topProfileOpen}
              onClose={()=>setTopProfileOpen(false)}
              onLogout={onBack}
              align="top-right"
              currentRoleLabel={profileRoleLabel}
              roleLabelOverride={userProfile?.role === "KITCHEN" ? profileRoleLabel : undefined}
              departmentName="Bộ phận Kho và Dịch vụ"
            />
          </div>
        </header>

        {/* PAGE TITLE (inventory only) */}
        {(page === "inventory" || page === "services") && (
          <div style={{ padding:"14px 22px",background:"#FFF",borderBottom:"1px solid #E2E8F0",flexShrink:0 }}>
            <div style={{ display:"flex",alignItems:"flex-start",justifyContent:"space-between" }}>
              <div>
                <h1 style={{ fontSize:22,fontWeight:800,color:"#0F172A",marginBottom:3 }}>
                  {page === "services" ? "Dịch vụ" : "Kho"}
                </h1>
                <p style={{ fontSize:13,color:"#64748B" }}>Quản lý danh mục kho, dịch vụ khách sạn và định mức cung ứng</p>
              </div>
              <div style={{ display:"flex",alignItems:"center",gap:6,padding:"7px 14px",borderRadius:9,
                border:"1px solid #E2E8F0",background:"#FFF" }}>
                <Calendar size={13} style={{ color:"#64748B" }} />
                <span style={{ fontSize:13,color:"#334155",fontWeight:500 }}>{todayLabel}</span>
              </div>
            </div>
          </div>
        )}

        {/* KPI */}
          {page !== "restaurant" && <KpiBar items={catalogItems} transactions={catalogTransactions} priceRequests={catalogPriceRequests} availability={page==="services"?availabilitySummary:undefined}/>}

        {inventoryError && <div role="alert" style={{ display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,padding:"9px 16px",background:"#FFF1F2",borderBottom:"1px solid #FECDD3",color:"#BE123C",fontSize:12 }}>
          <span>{inventoryError}</span><button onClick={() => setInventoryRefreshKey(key => key + 1)} style={{ border:"1px solid #FDA4AF",borderRadius:7,background:"#FFF",padding:"5px 9px",color:"#9F1239",fontSize:11,fontWeight:700,cursor:"pointer" }}>Tải lại dữ liệu kho</button>
        </div>}
        {movementNotice && <div role="status" style={{ padding:"8px 16px",background:"#F0FDF4",borderBottom:"1px solid #BBF7D0",color:"#166534",fontSize:12 }}>{movementNotice}</div>}

        {/* CONTENT */}
        <div style={{ flex:1,display:"flex",overflow:"hidden" }}>
          {page === "restaurant" && <ServiceCoordination items={liveItems.map(item=>({...item,category:CATEGORY_LABEL[item.category]??item.category,unit:UNIT_LABEL[item.unit]??item.unit}))} bookings={restaurantBookings} date={restaurantDate} loading={restaurantLoading} error={restaurantError} busyId={restaurantBusyId} searchQuery={globalSearch} onDateChange={setRestaurantDate} onRefresh={() => setRestaurantRefreshKey(key => key + 1)} onMarkUsed={booking => void handleMarkRestaurantUsed(booking)} />}
          {(page === "inventory" || page === "services") && (
            <InventoryScreen
              key={page}
              servicesView={page === "services"}
              refreshKey={inventoryRefreshKey}
              onAvailabilityChange={setAvailabilitySummary}
              items={catalogItems}
              priceRequests={priceRequests}
              onConfigureSchedule={setScheduleItem}
              onOpenMovement={(serviceId,type,reason) => setMovementDialog({ serviceId,type,reason })}
              searchQuery={globalSearch}
              loading={inventoryLoading}
              onAddPriceRequest={handleAddPriceRequest}
              requesterName={userProfile?.full_name ? `${userProfile.full_name} (${employeeRoleLabel(userProfile.role)})` : "Bộ phận Kho và Dịch vụ"}
            />
          )}
          {page === "transactions" && <TransactionsScreen transactions={liveTransactions} searchQuery={globalSearch} />}
          {page === "returns" && <StockReturnsPanel warehouse onChanged={()=>setInventoryRefreshKey(key=>key+1)}/>}
          {page === "pricing"      && (
            <PricingScreen
              requests={priceRequests}
              items={liveItems}
              onAddPriceRequest={handleAddPriceRequest}
              onActivatePrice={handleActivatePrice}
              onAddCatalogRequest={handleAddCatalogRequest}
              searchQuery={globalSearch}
              requesterName={userProfile?.full_name ? `${userProfile.full_name} (${employeeRoleLabel(userProfile.role)})` : "Bộ phận Kho và Dịch vụ"}
              userProfile={userProfile}
            />
          )}
          {page === "reports"      && <ConsumptionReports items={liveItems.map(item=>({...item,isStock:isStockItem(item),categoryLabel:CATEGORY_LABEL[item.category]??item.category,unit:UNIT_LABEL[item.unit]??item.unit}))} transactions={liveTransactions} />}
        </div>
      </div>
      {scheduleItem && <ServiceScheduleDialog item={scheduleItem} onClose={()=>setScheduleItem(null)} onSaved={()=>setInventoryRefreshKey(key=>key+1)}/>}
      {movementDialog && <InventoryMovementModal items={catalogItems} initialServiceId={movementDialog.serviceId} initialType={movementDialog.type} initialReason={movementDialog.reason} onClose={() => setMovementDialog(null)} onSubmit={handleInventoryMovement} />}
    </div>
  );
}
