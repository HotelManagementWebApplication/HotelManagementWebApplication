import { useEffect, useState, useMemo, useRef } from "react";

import { catalogProposalsApi, type CatalogProposal, serviceAvailabilityApi, type ServiceAvailability, kitchenAccountingApi, newKitchenIdempotencyKey, type ServiceConsumption, serviceConsumptionApi, serviceScheduleApi, stockReturnsApi, type StockReturn, type ScheduleMode } from "../../shared/api/kitchenAccounting";
import { authApi } from "../../shared/api/auth";
import { ApiError, apiErrorMessage } from "../../shared/api/client";
import { EmployeeProfileDropdown } from "../../shared/components/EmployeeProfileDropdown";
import { type Approval, type MovementType, type Service, type InventoryMovement, type RestaurantBooking } from "../../shared/types/kitchenAccounting";
import { employeeRoleLabel, type EmployeeProfileDto } from "../../shared/types/api";
import { formatDateVi, localDateValue, parseApiDate } from "../../shared/utils/localDate";
import { formatVnd } from "../../shared/utils/money";
import { Package, ArrowLeftRight, Tag, BarChart2, Search, ChevronDown, Plus, AlertTriangle, ShoppingCart, FileText, MoreVertical, ArrowUpRight, ArrowDownRight, LogOut, CheckSquare, Calendar, Upload, TrendingUp, Download, Clock, CheckCircle2, X, Send, Utensils, RefreshCw, SlidersHorizontal, Eye, Zap, BarChart3, BedDouble, BriefcaseBusiness, CalendarDays, Car, CircleHelp, Dumbbell, Flower2, PieChart, Shirt, ArrowRight, Check, FolderPlus, ArrowDownToLine, ArrowUpFromLine, Bell, RotateCcw, Trash2, Files, Printer } from "lucide-react";

/* KitchenInventory.tsx — màn hình chính */
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

  return (<><style>{kitchenInventoryStyles}</style>{(
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
  )}</>);
}


/* consumptionReport.ts — chức năng Kho / Dịch vụ */
export interface ReportItem {
  id:string;name:string;category:string;categoryLabel:string;unit:string;
  price:number;stock:number;reorder:number;isStock:boolean;
}
export interface ReportMovement {
  id:string;serviceId:string;movementType:MovementType;qty:number;occurredAt:string;
  stockBefore?:number|null;stockAfter?:number|null;
}
export interface ConsumptionRow {
  item:ReportItem;quantity:number;amount:number;endingStock:number|null;
}
export type ReportTab="services"|"stock";

function endingStock(item:ReportItem,movements:ReportMovement[],end:string):number|null {
  const sorted=movements.filter(row=>row.serviceId===item.id).sort((a,b)=>Date.parse(b.occurredAt)-Date.parse(a.occurredAt)||Number(b.id)-Number(a.id));
  const previous=sorted.find(row=>localDateValue(parseApiDate(row.occurredAt))<=end);
  if(previous?.stockAfter!=null)return previous.stockAfter;
  const next=sorted.filter(row=>localDateValue(parseApiDate(row.occurredAt))>end).at(-1);
  if(next?.stockBefore!=null)return next.stockBefore;
  return end===localDateValue()?item.stock:null;
}

export function buildConsumptionReport(items:ReportItem[],movements:ReportMovement[],end:string,usages:ServiceConsumption[],from?:string) {
  const endDate=parseApiDate(end);const startDate=from?parseApiDate(from):new Date(endDate);if(!from)startDate.setDate(startDate.getDate()-6);
  const start=localDateValue(startDate);
  const dayCount=Math.round((Date.UTC(endDate.getFullYear(),endDate.getMonth(),endDate.getDate())-Date.UTC(startDate.getFullYear(),startDate.getMonth(),startDate.getDate()))/86400000)+1;
  const days=Array.from({length:Math.max(1,dayCount)},(_,index)=>{
    const date=new Date(startDate);date.setDate(date.getDate()+index);
    return {key:localDateValue(date),label:date.toLocaleDateString("vi-VN",{day:"2-digit",month:"2-digit"}),services:0,stock:0};
  });
  const itemById=new Map(items.map(item=>[item.id,item]));
  const byDay=new Map(days.map(day=>[day.key,day]));
  const totals=new Map<string,ConsumptionRow>();
  let issueCount=0;
  movements.forEach(movement=>{
    const day=byDay.get(localDateValue(parseApiDate(movement.occurredAt)));
    const item=itemById.get(movement.serviceId);
    if(!day||!item||!item.isStock||movement.movementType!=="ISSUE")return;
    issueCount++;
    const quantity=Math.abs(movement.qty);const amount=quantity*item.price;
    day[item.isStock?"stock":"services"]+=amount;
    const row=totals.get(item.id)??{item,quantity:0,amount:0,endingStock:null};
    row.quantity+=quantity;row.amount+=amount;totals.set(item.id,row);
  });
  usages.forEach(usage=>{
    const day=byDay.get(localDateValue(parseApiDate(usage.occurred_at)));
    const item=itemById.get(usage.service_id);
    if(!day||!item||item.isStock)return;
    issueCount++;
    day.services+=usage.amount_due;
    const row=totals.get(item.id)??{item,quantity:0,amount:0,endingStock:null};
    row.quantity+=usage.quantity;row.amount+=usage.amount_due;totals.set(item.id,row);
  });
  const rows=[...totals.values()].map(row=>({...row,endingStock:row.item.isStock?endingStock(row.item,movements,end):null}))
    .sort((a,b)=>b.amount-a.amount||a.item.name.localeCompare(b.item.name,"vi"));
  const services=rows.filter(row=>!row.item.isStock);const stock=rows.filter(row=>row.item.isStock);
  const summarizeGroups=(rows:ConsumptionRow[])=>{
    const total=rows.reduce((sum,row)=>sum+row.amount,0);
    const grouped=new Map<string,{category:string;label:string;amount:number}>();
    rows.forEach(row=>{
      const group=grouped.get(row.item.category)??{category:row.item.category,label:row.item.categoryLabel,amount:0};
      group.amount+=row.amount;grouped.set(row.item.category,group);
    });
    return [...grouped.values()].sort((a,b)=>b.amount-a.amount).map(group=>({...group,percent:total>0?group.amount/total*100:0}));
  };
  const serviceAmount=services.reduce((total,row)=>total+row.amount,0);
  const groups=summarizeGroups(services),stockGroups=summarizeGroups(stock);
  return {start,end,days,services,stock,groups,stockGroups,serviceAmount,issueCount};
}

export function consumptionCsv(rows:ConsumptionRow[],tab:ReportTab,start:string,end:string):string {
  const cell=(value:string|number)=>`"${String(value).replace(/^[=+@-]/,"'$&").replaceAll('"','""')}"`;
  const header=["Từ ngày","Đến ngày","Mã hàng","Tên mặt hàng","ĐVT",tab==="stock"?"SL xuất kho":"SL sử dụng","Đơn giá tham chiếu","Thành tiền",...(tab==="stock"?["Tồn cuối"]:[])];
  const data=rows.map(row=>[start,end,row.item.id,row.item.name,row.item.unit,row.quantity,row.item.price,row.amount,...(tab==="stock"?[row.endingStock??""]:[])]);
  return "\uFEFF"+[header,...data].map(row=>row.map(cell).join(",")).join("\r\n");
}


/* stockVoucher.ts — chức năng Kho / Dịch vụ */
export interface VoucherMovement {
  id:string;serviceId:string;itemName:string;unit:string;unitPrice:number;
  movementType:MovementType;qty:number;occurredAt:string;staffName?:string;
  stockBefore?:number|null;stockAfter?:number|null;note?:string;
}
export interface VoucherDetails { sender:string;receiver:string;source:string;destination:string;reference:string }
export const movementLabels:Record<MovementType,string>={RECEIVE:"Nhập kho",ISSUE:"Xuất kho",WASTE:"Hao hụt",RETURN:"Trả lại kho",ADJUST:"Điều chỉnh"};
const escape=(value:unknown)=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]!));
const number=(value:number|null|undefined)=>value==null?"—":value.toLocaleString("vi-VN");
export const isOutgoing=(movement:VoucherMovement)=>movement.qty<0;
export function defaultVoucherDetails(movement:VoucherMovement):VoucherDetails {
  const outgoing=isOutgoing(movement);
  return {sender:outgoing?movement.staffName??"":"",receiver:outgoing?"":movement.staffName??"",source:outgoing?"Kho và Dịch vụ":"",destination:outgoing?"":"Kho và Dịch vụ",reference:""};
}

export function voucherBody(movement:VoucherMovement,details:VoucherDetails) {
  const time=new Date(movement.occurredAt);
  return `<article class="stock-voucher-sheet">
    <header><strong>MaM HOTEL</strong><h1>PHIẾU BIẾN ĐỘNG KHO</h1></header>
    <div class="voucher-meta"><p><b>Đơn vị phụ trách:</b> Kho và Dịch vụ</p><p><b>Số phiếu:</b> BDK-${escape(movement.id)} <span><b>Ngày lập:</b> ${escape(time.toLocaleDateString("vi-VN"))}</span></p>
    <p><b>Thời điểm ghi nhận:</b> ${escape(time.toLocaleString("vi-VN"))}</p><p><b>Người thực hiện:</b> ${escape(movement.staffName||"Chưa có thông tin họ tên")}</p>
    <p><b>Loại biến động:</b> ${escape(movementLabels[movement.movementType])}</p><p><b>Vị trí nguồn:</b> ${escape(details.source)||"........................................"} <span><b>Vị trí đích:</b> ${escape(details.destination)||"........................................"}</span></p>
    <p><b>Chứng từ liên quan:</b> ${escape(details.reference)||"............................................................................"}</p><p><b>Lý do:</b> ${escape(movement.note)||"........................................................................................"}</p></div>
    <table><thead><tr><th>Mã / Tên hàng</th><th>ĐVT</th><th>SL biến động</th><th>Đơn giá tham chiếu (đ)</th><th>Tồn trước</th><th>Tồn sau</th></tr></thead><tbody>
    <tr><td>${escape(movement.serviceId)}<br/>${escape(movement.itemName)}</td><td>${escape(movement.unit)}</td><td>${movement.qty>0?"+":""}${escape(number(movement.qty))}</td><td>${escape(number(movement.unitPrice))}</td><td>${escape(number(movement.stockBefore))}</td><td>${escape(number(movement.stockAfter))}</td></tr>
    ${Array.from({length:3},()=>"<tr class=\"voucher-blank\"><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td></tr>").join("")}</tbody></table>
    <p class="voucher-price-note">Đơn giá tham chiếu theo danh mục tại thời điểm xuất phiếu.</p>
    <section class="voucher-confirmation"><h2>Xác nhận và trách nhiệm</h2><div class="voucher-signatures"><div><strong>Người xuất / Giao</strong><em>(Ký, ghi rõ họ tên)</em><p>${escape(details.sender)}</p></div><div><strong>Người nhập / Nhận</strong><em>(Ký, ghi rõ họ tên)</em><p>${escape(details.receiver)}</p></div></div><p>Thời điểm xác nhận: ........................................................................................</p></section>
  </article>`;
}

export const voucherPrintStyles=`
@page{size:A4 portrait;margin:18mm}*{box-sizing:border-box}body{margin:0;color:#000;background:#fff;font-family:"Times New Roman",serif;font-size:12pt}.stock-voucher-sheet{width:100%;line-height:1.5}.stock-voucher-sheet header{text-align:center;margin-bottom:16px}.stock-voucher-sheet h1{font-size:16pt;margin:4px 0 0;font-weight:bold}.voucher-meta p{margin:5px 0;overflow-wrap:anywhere}.voucher-meta span{margin-left:30px}.stock-voucher-sheet table{width:100%;border-collapse:collapse;margin-top:16px;table-layout:fixed}.stock-voucher-sheet th,.stock-voucher-sheet td{border:1px solid #000;padding:7px 5px;text-align:center;overflow-wrap:anywhere}.stock-voucher-sheet th:first-child{width:29%}.stock-voucher-sheet th:nth-child(2){width:9%}.stock-voucher-sheet th:nth-child(4){width:20%}.stock-voucher-sheet td:first-child{text-align:left}.voucher-blank{height:32px}.voucher-price-note{font-size:10pt;font-style:italic}.voucher-confirmation{border:1px solid #000;padding:12px;margin-top:22px;break-inside:avoid}.voucher-confirmation h2{font-size:12pt;margin:0 0 8px}.voucher-signatures{display:grid;grid-template-columns:1fr 1fr;text-align:center;gap:20px}.voucher-signatures strong,.voucher-signatures em{display:block}.voucher-signatures em{font-size:11pt}.voucher-signatures p{margin:85px 0 10px;min-height:22px;font-weight:bold}.voucher-confirmation>p{font-size:11pt;margin-top:18px}.stock-voucher-sheet table tr{break-inside:avoid}
`;

export function printStockVouchers(movements:VoucherMovement[],detailsById:Record<string,VoucherDetails>) {
  if(movements.length===0)return;
  document.getElementById("stock-voucher-print-frame")?.remove();
  const frame=document.createElement("iframe");
  frame.id="stock-voucher-print-frame";frame.title="In phiếu biến động kho";frame.setAttribute("aria-hidden","true");
  Object.assign(frame.style,{position:"fixed",width:"0",height:"0",border:"0",bottom:"0",left:"0"});
  frame.onload=()=>{frame.contentWindow?.addEventListener("afterprint",()=>frame.remove(),{once:true});frame.contentWindow?.focus();frame.contentWindow?.print();};
  frame.srcdoc=`<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Phiếu biến động kho${movements.length===1?` BDK-${escape(movements[0].id)}`:""}</title><style>${voucherPrintStyles}.stock-voucher-sheet{break-after:page}.stock-voucher-sheet:last-child{break-after:auto}</style></head><body>${movements.map(movement=>voucherBody(movement,detailsById[movement.id]??defaultVoucherDetails(movement))).join("")}</body></html>`;
  document.body.appendChild(frame);
}


/* ConsumptionReports.tsx — chức năng Kho / Dịch vụ */
type TrendDay=ReturnType<typeof buildConsumptionReport>["days"][number];
const colors=["#1D4ED8","#3B82F6","#60A5FA","#93C5FD","#2563EB","#7DD3FC"];
const groupIcons:Record<string,typeof Package>={inroom:BedDouble,"fine-dining":Utensils,laundry:Shirt,business:BriefcaseBusiness,spa:Flower2,transport:Car,recreation:Dumbbell};
const quantity=(value:number)=>value.toLocaleString("vi-VN");

function ConsumptionTrend({days,issueCount}:{days:TrendDay[];issueCount:number}) {
  const [focused,setFocused]=useState<number|null>(null);
  const max=Math.max(...days.flatMap(day=>[day.services,day.stock]))||1000000;
  const rough=max/4;const magnitude=10**Math.floor(Math.log10(rough));const ratio=rough/magnitude;
  const step=(ratio<=1?1:ratio<=2?2:ratio<=5?5:10)*magnitude;const ceiling=step*4;
  const width=720;
  const labelEvery=Math.max(1,Math.ceil(days.length/8));
  const hitWidth=Math.min(68,(width-127)/Math.max(1,days.length-1));
  const left=103,right=width-24,top=34,bottom=210;
  const x=(index:number)=>days.length===1?(left+right)/2:left+(right-left)*index/(days.length-1);
  const y=(value:number)=>bottom-(bottom-top)*value/ceiling;
  const points=(key:"services"|"stock")=>days.map((day,index)=>`${x(index)},${y(day[key])}`).join(" ");
  const area=(key:"services"|"stock")=>`M ${left},${bottom} L ${days.map((day,index)=>`${x(index)},${y(day[key])}`).join(" L ")} L ${right},${bottom} Z`;
  const hasValue=days.some(day=>day.services>0||day.stock>0);
  return <div className="ki-report-chart-scroll"><svg viewBox={`0 0 ${width} 251`} style={{minWidth:width}} className="ki-report-chart" role="img" aria-label={`Xu hướng giá trị tiêu thụ ${days.length} ngày`}>
    <defs><linearGradient id="ki-report-service-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3B82F6" stopOpacity=".2"/><stop offset="100%" stopColor="#3B82F6" stopOpacity=".025"/></linearGradient><linearGradient id="ki-report-stock-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#60A5FA" stopOpacity=".12"/><stop offset="100%" stopColor="#60A5FA" stopOpacity=".025"/></linearGradient></defs>
    {Array.from({length:5},(_,index)=>{const value=ceiling-index*step;return <g key={index}><line x1={left} x2={right} y1={y(value)} y2={y(value)} stroke="#E9EEF0"/><text x={left-12} y={y(value)+4} textAnchor="end" className="ki-report-axis">{formatVnd(value)}</text></g>;})}
    {days.map((day,index)=><g key={day.key}><line x1={x(index)} x2={x(index)} y1={top} y2={bottom} stroke="#F0F3F4"/>{(index%labelEvery===0||index===days.length-1)&&<text x={x(index)} y={239} textAnchor="middle" className="ki-report-axis">{day.label}</text>}</g>)}
    <path d={area("services")} fill="url(#ki-report-service-fill)"/><path d={area("stock")} fill="url(#ki-report-stock-fill)"/>
    <polyline points={points("services")} fill="none" stroke="#1D4ED8" strokeWidth="2.5" strokeLinejoin="round"/><polyline points={points("stock")} fill="none" stroke="#60A5FA" strokeWidth="2.5" strokeLinejoin="round"/>
    {days.map((day,index)=>{const close=Math.abs(y(day.services)-y(day.stock))<26;return <g key={day.key} tabIndex={0} role="img" aria-label={`${day.label}: dịch vụ ${formatVnd(day.services)}, xuất kho ${formatVnd(day.stock)}`} onMouseEnter={()=>setFocused(index)} onMouseLeave={()=>setFocused(null)} onFocus={()=>setFocused(index)} onBlur={()=>setFocused(null)}>
      <title>{day.label}: Dịch vụ {formatVnd(day.services)}; Xuất kho {formatVnd(day.stock)}</title>
      <rect x={x(index)-hitWidth/2} y={top} width={hitWidth} height={bottom-top} fill="transparent"/>
      {(["services","stock"] as const).map(key=>{const upper=day[key]>=day[key==="services"?"stock":"services"];const offset=close&&!upper?16:-12;return <g key={key}><circle cx={x(index)} cy={y(day[key])} r={focused===index?5:4} fill={key==="services"?"#1D4ED8":"#60A5FA"}/>{hasValue&&(focused===index||day[key]>0&&(index%labelEvery===0||index===days.length-1))&&<text x={x(index)} y={y(day[key])+offset+(close&&day.services===day.stock&&key==="stock"?28:0)} textAnchor="middle" className="ki-report-value">{quantity(day[key])}</text>}</g>;})}
    </g>;})}
    {!hasValue&&<text x={(left+right)/2} y="116" textAnchor="middle" className="ki-report-empty-chart">{issueCount===0?"Chưa có lượt sử dụng hoặc phiếu xuất dùng trong kỳ này":"Các lượt trong kỳ có giá trị bằng 0"}</text>}
  </svg></div>;
}

export function ConsumptionReports({items,transactions}:{items:ReportItem[];transactions:ReportMovement[]}) {
  const [endDate,setEndDate]=useState(()=>localDateValue());
  const [startDate,setStartDate]=useState(()=>{const date=parseApiDate(localDateValue());date.setDate(date.getDate()-6);return localDateValue(date);});
  const rangeError=startDate>endDate?"Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.":null;
  const [tab,setTab]=useState<ReportTab>("stock");
  const [usages,setUsages]=useState<ServiceConsumption[]>([]);
  const [usageError,setUsageError]=useState<string|null>(null);
  const [usageLoading,setUsageLoading]=useState(true);
  const [retry,setRetry]=useState(0);
  useEffect(()=>{let active=true;setUsages([]);setUsageError(null);setUsageLoading(true);
    if(rangeError){setUsageLoading(false);return()=>{active=false;};}
    // Reuse the API's 31-day contract through consecutive, non-overlapping windows.
    const load=async()=>{
      const rows:ServiceConsumption[]=[];let cursor=startDate;
      while(cursor<=endDate&&active){
        const end=parseApiDate(cursor);end.setDate(end.getDate()+30);
        const until=localDateValue(end)<endDate?localDateValue(end):endDate;
        rows.push(...await serviceConsumptionApi.list(cursor,until));
        if(until===endDate)break;
        const next=parseApiDate(until);next.setDate(next.getDate()+1);cursor=localDateValue(next);
      }
      return rows;
    };
    load().then(rows=>{if(active)setUsages(rows);})
      .catch(error=>{if(active)setUsageError(apiErrorMessage(error,"Không tải được các lượt sử dụng dịch vụ."));})
      .finally(()=>{if(active)setUsageLoading(false);});
    return()=>{active=false;};},[startDate,endDate,rangeError,retry]);
  const report=useMemo(()=>buildConsumptionReport(items,transactions,endDate,usages,rangeError?endDate:startDate),[items,transactions,startDate,endDate,usages,rangeError]);
  const rows=tab==="stock"?report.stock:report.services;
  const groups=tab==="stock"?report.stockGroups:report.groups;
  const total=rows.reduce((sum,row)=>sum+row.amount,0);
  const download=()=>{
    const url=URL.createObjectURL(new Blob([consumptionCsv(rows,tab,report.start,report.end)],{type:"text/csv;charset=utf-8"}));
    const anchor=document.createElement("a");anchor.href=url;anchor.download=`bao-cao-${tab==="stock"?"xuat-kho":"dich-vu"}-${report.start}-${report.end}.csv`;anchor.click();URL.revokeObjectURL(url);
  };
  return <div className="ki-consumption-reports">
    <div className="ki-report-page-header"><div><h2>Báo cáo tiêu thụ</h2><p>Theo dõi dịch vụ và xuất kho trong {report.days.length} ngày · {formatDateVi(startDate)} – {formatDateVi(endDate)}</p></div><div className="ki-report-page-actions"><label><span>Từ ngày</span><CalendarDays size={15}/><input aria-label="Từ ngày báo cáo" type="date" value={startDate} onChange={event=>{if(event.target.value)setStartDate(event.target.value);}}/></label><label><span>Đến ngày</span><CalendarDays size={15}/><input aria-label="Đến ngày báo cáo" type="date" value={endDate} onChange={event=>{if(event.target.value)setEndDate(event.target.value);}}/></label><button type="button" onClick={download} disabled={Boolean(rangeError)||tab==="services"&&(usageLoading||Boolean(usageError))}><Download size={15}/>Xuất báo cáo</button></div></div>
    {rangeError&&<p role="alert">{rangeError}</p>}
    {!rangeError&&<>
    {usageError&&<p role="alert">{usageError} <button onClick={()=>setRetry(value=>value+1)}>Tải lại</button></p>}
    {usageLoading&&<p role="status">Đang tải lượt sử dụng dịch vụ…</p>}
    <div className="ki-report-overview">
      <section className="ki-report-card ki-report-trend" aria-labelledby="consumption-trend-title"><header><h3 id="consumption-trend-title"><BarChart3 size={20}/>Xu hướng tiêu thụ</h3><div className="ki-report-legend"><span><i/>Giá trị dịch vụ</span><span><i/>Giá trị xuất kho</span></div></header><ConsumptionTrend days={report.days} issueCount={report.issueCount}/><p className="ki-report-reference-note"><CircleHelp size={12}/>Dịch vụ: giá đã ghi nhận, trừ phần miễn phí. Xuất kho: đơn giá danh mục hiện tại.</p></section>
      <section className="ki-report-card ki-report-groups" aria-labelledby="service-groups-title"><header><h3 id="service-groups-title"><PieChart size={21}/>{tab==="stock"?"Giá trị xuất kho theo nhóm hàng":"Tiêu thụ theo nhóm dịch vụ"}</h3></header><div className="ki-report-group-list">{groups.map((group,index)=>{const Icon=groupIcons[group.category]??Package;const color=colors[index%colors.length];return <div key={group.category} className="ki-report-group"><span className="ki-report-group-icon" style={{color}}><Icon size={20}/></span><div><div className="ki-report-group-label"><strong>{group.label}</strong><span>{quantity(Number(group.percent.toFixed(1)))}%</span><b>{formatVnd(group.amount)}</b></div><div className="ki-report-progress" role="progressbar" aria-label={group.label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Number(group.percent.toFixed(1))}><span style={{width:`${group.percent}%`,background:color}}/></div></div></div>;})}{groups.length===0&&<div className="ki-report-empty"><PieChart size={30}/><p>{tab==="stock"?"Chưa có xuất kho trong kỳ đã chọn.":"Chưa có tiêu thụ dịch vụ trong kỳ đã chọn."}</p></div>}</div></section>
    </div>
    <section className="ki-report-card ki-report-details" aria-labelledby="consumption-details-title"><header><h3 id="consumption-details-title"><Package size={20}/>Chi tiết tiêu thụ</h3><div className="ki-report-tabs" role="tablist" aria-label="Loại chi tiết tiêu thụ"><button id="report-services-tab" role="tab" aria-selected={tab==="services"} aria-controls="report-consumption-table" onClick={()=>setTab("services")}>Dịch vụ</button><button id="report-stock-tab" role="tab" aria-selected={tab==="stock"} aria-controls="report-consumption-table" onClick={()=>setTab("stock")}>Xuất kho</button></div></header>
      <div id="report-consumption-table" role="tabpanel" aria-labelledby={tab==="stock"?"report-stock-tab":"report-services-tab"} className="ki-report-table-scroll"><table><thead><tr>{["#","Mã hàng",tab==="stock"?"Tên mặt hàng":"Tên dịch vụ","ĐVT",tab==="stock"?"SL xuất kho":"SL sử dụng","Đơn giá tham chiếu","Thành tiền",...(tab==="stock"?["Tồn cuối"]:[])].map(title=><th key={title}>{title}</th>)}</tr></thead><tbody>{rows.map((row,index)=><tr key={row.item.id}><td>{index+1}</td><td className="ki-report-sku">{row.item.id}</td><td>{row.item.name}</td><td>{row.item.unit}</td><td>{quantity(row.quantity)}</td><td>{formatVnd(row.item.price)}</td><td>{formatVnd(row.amount)}</td>{tab==="stock"&&<td><span className={row.endingStock===0?"ki-report-no-stock":row.endingStock!=null&&row.endingStock<=row.item.reorder?"ki-report-low-stock":""}>{row.endingStock==null?"—":quantity(row.endingStock)}</span></td>}</tr>)}{rows.length===0&&<tr><td colSpan={tab==="stock"?8:7} className="ki-report-empty-cell">{tab==="stock"?"Chưa có giao dịch xuất kho trong kỳ đã chọn.":"Chưa có dịch vụ sử dụng trong kỳ đã chọn."}</td></tr>}</tbody></table></div>
      <footer><span>Hiển thị {rows.length} {tab==="stock"?"mặt hàng":"dịch vụ"} · {formatDateVi(report.start)} – {formatDateVi(report.end)}</span><span>{tab==="stock"?"Tổng giá trị tham chiếu:":"Tổng giá trị dịch vụ đã dùng:"} <strong>{formatVnd(total)}</strong></span></footer>
    </section>
    </>}
  </div>;
}


/* ServiceCoordination.tsx — chức năng Kho / Dịch vụ */
export function ServiceCoordination({ bookings, items, date, loading, error, busyId, searchQuery, onDateChange, onRefresh, onMarkUsed }: {
  bookings: RestaurantBooking[];
  items: { id: string; category: string; unit: string }[];
  date: string;
  loading: boolean;
  error: string | null;
  busyId: number | null;
  searchQuery: string;
  onDateChange: (date: string) => void;
  onRefresh: () => void;
  onMarkUsed: (booking: RestaurantBooking) => void;
}) {
  const [category, setCategory] = useState("");
  const categories = [...new Set(bookings.map(booking => items.find(item => item.id === booking.service_id)?.category).filter((value): value is string => Boolean(value)))];
  const visibleBookings = bookings.filter(booking => !category || items.find(item => item.id === booking.service_id)?.category === category).filter(booking => !searchQuery.trim()
    || `${booking.room_id} ${booking.reservation_id} ${booking.service_name} ${booking.note ?? ""}`.toLowerCase().includes(searchQuery.trim().toLowerCase()));
  const confirmed = visibleBookings.filter(booking => booking.status === "CONFIRMED").length;
  const used = visibleBookings.filter(booking => booking.status === "USED").length;
  const cancelled = visibleBookings.filter(booking => booking.status === "CANCELLED").length;
  const mealLabel = (value: string | null) => value === "LUNCH" ? "Bữa trưa" : value === "DINNER" ? "Bữa tối" : "";
  return (
    <div style={{ flex:1,overflowY:"auto",padding:"20px 24px",background:"#F8FAFC" }}>
      <div style={{ display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:16,marginBottom:18,flexWrap:"wrap" }}>
        <div><p style={{ fontSize:11,color:"#D97706",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em" }}>Vận hành dịch vụ</p><h2 style={{ fontSize:22,fontWeight:800,color:"#0F172A",marginTop:3 }}>Điều phối dịch vụ</h2></div>
        <div style={{ display:"flex",gap:8,alignItems:"center" }}><input type="date" value={date} onChange={event => onDateChange(event.target.value)} style={{ height:36,border:"1px solid #CBD5E1",borderRadius:8,padding:"0 10px",fontSize:12,background:"#FFF" }} /><button onClick={onRefresh} disabled={loading} style={{ height:36,padding:"0 13px",display:"flex",alignItems:"center",gap:6,border:"1px solid #CBD5E1",borderRadius:8,background:"#FFF",fontSize:12,fontWeight:600,cursor:loading?"wait":"pointer" }}><RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Làm mới</button></div>
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:12,marginBottom:16 }}>
        {[["Đã đặt",confirmed,"#FEF3C7","#92400E"],["Đã sử dụng",used,"#DCFCE7","#166534"],["Đã hủy",cancelled,"#F1F5F9","#475569"]].map(([label,value,bg,color]) => <div key={String(label)} style={{ background:"#FFF",border:"1px solid #E2E8F0",borderRadius:12,padding:15 }}><p style={{ fontSize:11,color:"#64748B" }}>{label}</p><div style={{ display:"flex",alignItems:"center",gap:8,marginTop:6 }}><strong style={{ fontSize:24,color:String(color) }}>{value}</strong><span style={{ fontSize:10,fontWeight:700,color:String(color),background:String(bg),padding:"2px 7px",borderRadius:99 }}>đơn</span></div></div>)}
      </div>
      <label style={{display:"block",fontSize:12,marginBottom:16}}>Nhóm dịch vụ <select aria-label="Nhóm dịch vụ" value={category} onChange={event => setCategory(event.target.value)} style={{marginLeft:8,padding:8,border:"1px solid #CBD5E1",borderRadius:8,background:"white"}}><option value="">Tất cả nhóm</option>{categories.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
      {error && <div role="alert" style={{ marginBottom:14,padding:"10px 12px",borderRadius:9,background:"#FFF1F2",border:"1px solid #FECDD3",color:"#BE123C",fontSize:12 }}>{error}</div>}
      <div style={{ background:"#FFF",border:"1px solid #E2E8F0",borderRadius:12,overflow:"hidden" }}>
        <div style={{ overflowX:"auto" }}><table style={{ width:"100%",borderCollapse:"collapse",minWidth:780 }}><thead><tr style={{ background:"#F8FAFC" }}>{["Giờ phục vụ","Phòng / Booking","Dịch vụ","Số lượng","Ghi chú","Trạng thái","Thao tác"].map(label => <th key={label} style={{ padding:"10px 13px",textAlign:"left",fontSize:10,fontWeight:700,color:"#64748B",textTransform:"uppercase",letterSpacing:"0.05em" }}>{label}</th>)}</tr></thead><tbody>
          {visibleBookings.map(booking => { const due = new Date(booking.scheduled_at).getTime() <= Date.now(); const canUse = booking.status === "CONFIRMED" && due; return <tr key={booking.id} style={{ borderTop:"1px solid #F1F5F9" }}><td style={{ padding:"12px 13px",fontSize:12,fontWeight:700,color:"#0F172A" }}>{new Date(booking.scheduled_at).toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit"})}<p style={{ marginTop:2,fontSize:10,color:"#64748B",fontWeight:500 }}>{mealLabel(booking.meal_period)}</p></td><td style={{ padding:"12px 13px",fontSize:12,color:"#334155" }}><strong>Phòng {booking.room_id}</strong><p style={{ marginTop:2,fontSize:10,color:"#94A3B8" }}>BK-{booking.reservation_id}</p></td><td style={{ padding:"12px 13px",fontSize:12,color:"#334155" }}>{booking.service_name}</td><td style={{ padding:"12px 13px",fontSize:13,fontWeight:700,color:"#0F172A" }}>{booking.quantity} {items.find(item => item.id === booking.service_id)?.unit ?? ""}<p style={{ marginTop:2,fontSize:10,color:"#64748B",fontWeight:400 }}>miễn phí {booking.free_quantity}</p></td><td style={{ padding:"12px 13px",fontSize:11,color:"#64748B",maxWidth:220 }}>{booking.note || "—"}</td><td style={{ padding:"12px 13px" }}><span style={{ fontSize:10,fontWeight:700,borderRadius:99,padding:"3px 8px",background:booking.status==="USED"?"#DCFCE7":booking.status==="CANCELLED"?"#F1F5F9":"#FEF3C7",color:booking.status==="USED"?"#166534":booking.status==="CANCELLED"?"#475569":"#92400E" }}>{booking.status === "USED" ? "Đã sử dụng" : booking.status === "CANCELLED" ? "Đã hủy" : "Đã đặt"}</span></td><td style={{ padding:"12px 13px" }}><button onClick={() => onMarkUsed(booking)} disabled={!canUse || busyId === booking.id} title={!due && booking.status === "CONFIRMED" ? "Chưa đến giờ phục vụ" : undefined} style={{ border:0,borderRadius:7,padding:"7px 10px",background:canUse?"#0F172A":"#E2E8F0",color:canUse?"#FFF":"#94A3B8",fontSize:11,fontWeight:700,cursor:canUse?"pointer":"not-allowed" }}>{busyId === booking.id ? "Đang lưu…" : booking.status === "USED" ? "Đã sử dụng" : "Xác nhận sử dụng"}</button></td></tr>; })}
          {!loading && visibleBookings.length === 0 && <tr><td colSpan={7} style={{ padding:38,textAlign:"center",fontSize:12,color:"#64748B" }}>{bookings.length === 0 ? "Không có lịch dịch vụ trong ngày đã chọn." : "Không tìm thấy lịch dịch vụ khớp với từ khóa."}</td></tr>}
          {loading && <tr><td colSpan={7} style={{ padding:38,textAlign:"center",fontSize:12,color:"#64748B" }}>Đang tải lịch dịch vụ…</td></tr>}
        </tbody></table></div>
      </div>
    </div>
  );
}


/* ServiceScheduleDialog.tsx — chức năng Kho / Dịch vụ */
export function ServiceScheduleDialog({item,onClose,onSaved}:{item:{id:string;name:string;unit?:string};onClose:()=>void;onSaved:()=>void}) {
  const dialog=useRef<HTMLDialogElement>(null);
  const [capacity,setCapacity]=useState("");const [unit,setUnit]=useState("");const [minutes,setMinutes]=useState("");
  const [mode,setMode]=useState<ScheduleMode>("UNITS");const [consume,setConsume]=useState(false);const [reason,setReason]=useState("");
  const [loading,setLoading]=useState(true);const [loaded,setLoaded]=useState(false);const [saving,setSaving]=useState(false);const [error,setError]=useState<string|null>(null);
  useEffect(()=>{dialog.current?.showModal();let active=true;
    serviceScheduleApi.get(item.id).then(row=>{if(!active)return;setCapacity(row.capacity==null?"":String(row.capacity));setUnit(row.unit??"");setMinutes(row.minutes_per_unit==null?"":String(row.minutes_per_unit));setMode(row.mode??"UNITS");setConsume(row.consumes_stock);setLoaded(true);})
      .catch(error=>{if(active)setError(apiErrorMessage(error,"Không tải được cấu hình dịch vụ."));}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};},[item.id]);
  const submit=async(event:React.FormEvent)=>{event.preventDefault();if(loading||saving)return;setSaving(true);setError(null);
    try{await serviceScheduleApi.save(item.id,{capacity:Number(capacity),unit:unit.trim(),minutes_per_unit:Number(minutes),mode,consumes_stock:mode==="STOCK"||consume,reason:reason.trim()});onSaved();onClose();}
    catch(error){setError(apiErrorMessage(error,"Không lưu được cấu hình dịch vụ."));}finally{setSaving(false);}};
  const inputStyle={width:"100%",padding:10,border:"1px solid #CBD5E1",borderRadius:8,marginTop:5,fontSize:14};
  const count=Number(capacity)>0?Number(capacity).toLocaleString("vi-VN"):"…";
  const countUnit=unit.trim()||"chỗ";
  const duration=Number(minutes)>0 ? Number(minutes)%1440===0 ? `${Number(minutes)/1440} ngày`
    : Number(minutes)%60===0 ? `${Number(minutes)/60} giờ` : `${minutes} phút` : "…";
  const summary=mode==="STOCK" ? "Số lượng khách có thể đặt được tính từ hàng còn trong kho, sau khi trừ các đơn đang giữ hàng."
    : mode==="DAILY" ? `Nhận tối đa ${count} ${countUnit} trong một ngày.`
    : mode==="STAY" ? `Có ${count} ${countUnit}. Khách đặt sẽ giữ đến lúc trả phòng.`
    : mode==="OVERNIGHT" ? `Nhận tối đa ${count} ${countUnit} cùng lúc. Mỗi lượt giữ đến 08:00 sáng hôm sau.`
    : mode==="DURATION" ? `Có ${count} ${countUnit} phục vụ cùng lúc. Mỗi ${item.unit||"đơn vị tính tiền"} khách đặt sẽ giữ 1 ${countUnit} trong ${duration}.`
    : `Nhận tối đa ${count} ${countUnit} cùng lúc. Mỗi lượt đặt giữ chỗ trong ${duration}.`;
  return <dialog ref={dialog} onCancel={event=>{if(saving)event.preventDefault();else onClose();}} aria-labelledby="schedule-title" style={{width:"min(560px,94vw)",border:0,borderRadius:16,padding:24,color:"#0F172A"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><h2 id="schedule-title" style={{fontSize:20,fontWeight:700}}>Thiết lập số lượng phục vụ</h2><button onClick={onClose} disabled={saving} aria-label="Đóng"><X size={20}/></button></div>
    <p style={{margin:"8px 0 16px",color:"#64748B"}}>{item.name} ({item.id})</p>
    {error&&<p role="alert" style={{color:"#B91C1C",marginBottom:12}}>{error}</p>}
    {loading?<p>Đang tải cấu hình…</p>:!loaded?<button onClick={onClose}>Đóng và thử lại</button>:<form onSubmit={event=>void submit(event)} style={{display:"grid",gap:14,fontSize:14}}>
      <label>Cách nhận đặt dịch vụ<select style={inputStyle} value={mode} onChange={e=>{const next=e.target.value as ScheduleMode;setMode(next);if(next==="STOCK")setConsume(true);}}>
        <option value="DURATION">Giữ chỗ theo số giờ/ngày khách đặt</option><option value="UNITS">Giữ chỗ trong một khoảng thời gian</option><option value="STAY">Giữ đến khi khách trả phòng</option><option value="DAILY">Giới hạn số lượng trong ngày</option><option value="OVERNIGHT">Giữ đến 08:00 sáng hôm sau</option><option value="STOCK">Nhận đặt theo hàng còn trong kho</option></select></label>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><label>Số lượng phục vụ tối đa<input required type="number" min="1" max="2147483647" step="1" value={capacity} onChange={e=>setCapacity(e.target.value)} style={inputStyle}/></label><label>Đơn vị (suất, sân, phòng…)<input required maxLength={20} placeholder="Ví dụ: suất" value={unit} onChange={e=>setUnit(e.target.value)} style={inputStyle}/></label></div>
      <label>{mode==="DURATION"?`Thời gian cho 1 ${item.unit||"đơn vị tính tiền"} (phút)`:"Thời gian giữ chỗ mỗi lượt (phút)"}<input required type="number" min="1" max="10080" step="1" value={minutes} onChange={e=>setMinutes(e.target.value)} style={inputStyle}/></label>
      <div style={{padding:12,borderRadius:8,background:"#EFF6FF",color:"#1E40AF",lineHeight:1.6}}><strong>Với thiết lập này:</strong><p style={{marginTop:4}}>{summary}</p></div>
      <label style={{display:"flex",gap:8,alignItems:"center"}}><input type="checkbox" checked={mode==="STOCK"||consume} disabled={mode==="STOCK"} onChange={e=>setConsume(e.target.checked)}/>Trừ hàng trong kho khi xác nhận khách đã dùng</label>
      <p style={{color:"#64748B",fontSize:12,marginTop:-6,lineHeight:1.6}}>{mode==="STOCK"||consume?"Bật cho suất ăn, đồ uống hoặc hàng dùng hết. Số có thể đặt còn phụ thuộc lượng hàng trong kho.":"Không trừ kho. Sân, phòng hoặc xe có thể phục vụ lượt tiếp theo sau khi hết thời gian giữ chỗ."}</p>
      <label>Lý do thay đổi<textarea required maxLength={255} value={reason} onChange={e=>setReason(e.target.value)} style={inputStyle}/></label>
      <div style={{display:"flex",justifyContent:"flex-end",gap:10}}><button type="button" disabled={saving} onClick={onClose}>Hủy bỏ</button><button disabled={saving||!reason.trim()} style={{padding:"9px 16px",background:"#2563EB",color:"white",borderRadius:8}}>{saving?"Đang lưu…":"Lưu cấu hình"}</button></div>
    </form>}
  </dialog>;
}


/* ProposalDialog.tsx — chức năng Kho / Dịch vụ */
type Item = { id:string;name:string;price:number;category:string;active:boolean };
const goods = new Set(["food","beverage","room-amenity","Minibar Beverage","Minibar Snack","Kitchen Dry","Kitchen Fresh"]);
const serviceCategories = [["business","Dịch vụ doanh nghiệp"],["inroom","Dịch vụ tại phòng"],["recreation","Giải trí"],["fine-dining","Nhà hàng"],["spa","Spa"],["transport","Vận chuyển"],["laundry","Giặt ủi"],["other","Khác"]];
const stockCategories = [["food","Món ăn"],["beverage","Thức uống"],["room-amenity","Đồ gia dụng"]];
const units = ["giờ","ngày","lần","suất","món","đêm","lượt","chuyến","khách","khách/ngày","bộ","chai","lon","ly","đơn vị","cái","gói","cuộn","tuýp"];

export function ProposalDialog({items,onClose,onPrice,onCatalog}:{
  items:Item[];onClose:()=>void;
  onPrice:(item:Item,price:number,reason:string)=>Promise<void>;
  onCatalog:(body:CatalogProposal)=>Promise<void>;
}) {
  const ref=useRef<HTMLDialogElement>(null);
  const [step,setStep]=useState<"choose"|"price"|"catalog">("choose");
  const [type,setType]=useState<"price"|"catalog">("price");
  const [kind,setKind]=useState<"SERVICE"|"WAREHOUSE">("SERVICE");
  const [serviceId,setServiceId]=useState("");
  const [name,setName]=useState("");const [sku,setSku]=useState("");
  const [unit,setUnit]=useState("giờ");const [category,setCategory]=useState("business");
  const [price,setPrice]=useState("");const [reason,setReason]=useState("");
  const [saving,setSaving]=useState(false);const [error,setError]=useState("");
  useEffect(()=>{ref.current?.showModal();},[]);
  const available=items.filter(item=>kind==="WAREHOUSE"?goods.has(item.category):!goods.has(item.category)&&item.active);
  const selected=available.find(item=>item.id===serviceId)??available[0];
  const amount=Number(price);const delta=selected?amount-selected.price:0;
  const valid=price.trim()!==""&&Number.isFinite(amount)&&amount>=0&&amount<=99999999.99&&reason.trim().length>0
    &&(step==="price"?Boolean(selected)&&amount!==selected?.price:Boolean(name.trim())&&/^[A-Z0-9]{1,10}$/.test(sku));
  const changeKind=(next:"SERVICE"|"WAREHOUSE")=>{setKind(next);setServiceId("");setCategory(next==="SERVICE"?"business":"food");setUnit(next==="SERVICE"?"giờ":"cái");};
  const submit=async(event:React.FormEvent)=>{
    event.preventDefault();if(!valid||saving)return;setSaving(true);setError("");
    try {
      if(step==="price"&&selected)await onPrice(selected,amount,reason.trim());
      else await onCatalog({kind,id:sku,name:name.trim(),unit,category,price:amount,reason:reason.trim()});
      onClose();
    }catch(err){setError(err instanceof Error?err.message:"Không thể gửi đề xuất. Vui lòng thử lại.");}
    finally{setSaving(false);}
  };
  return <dialog ref={ref} className="ki-proposal" aria-labelledby="proposal-title" onCancel={event=>{event.preventDefault();if(!saving)onClose();}}>
    <form onSubmit={submit}>
      <header><div>{step!=="choose"&&<span className="ki-proposal-icon">{step==="price"?<Tag size={24}/>:<FolderPlus size={24}/>}</span>}<div>
        <h2 id="proposal-title">{step==="choose"?"Tạo yêu cầu đề xuất mới":step==="price"?"Đề xuất giá dịch vụ / mặt hàng":"Đề xuất thêm danh mục / mặt hàng mới"}</h2>
        <p>{step==="choose"?"Vui lòng chọn loại đề xuất bạn muốn tạo:":step==="price"?"Điền thông tin thay đổi giá và gửi quản lý phê duyệt.":"Điền thông tin danh mục mới và gửi quản lý phê duyệt."}</p>
      </div></div><button type="button" aria-label="Đóng đề xuất" className="ki-proposal-close" disabled={saving} onClick={onClose}><X size={20}/></button></header>
      <section>
        {step==="choose"?<div className="ki-proposal-choices">
          {([{id:"price",title:"Đề xuất giá dịch vụ / mặt hàng",desc:"Thay đổi đơn giá hiện tại cho các dịch vụ hoặc mặt hàng có sẵn.",Icon:Tag},{id:"catalog",title:"Đề xuất thêm danh mục / mặt hàng mới",desc:"Thêm một dịch vụ hoặc mặt hàng vào danh mục kho mới.",Icon:FolderPlus}] as const).map(option=><button type="button" key={option.id} aria-pressed={type===option.id} className={type===option.id?"selected":""} onClick={()=>setType(option.id)}><span className="ki-choice-top"><span className="ki-proposal-icon"><option.Icon size={26}/></span><span className="ki-choice-check">{type===option.id&&<Check size={17}/>}</span></span><strong>{option.title}</strong><p>{option.desc}</p></button>)}
        </div>:<>
          <fieldset><legend>Loại danh mục</legend><div className="ki-proposal-kind">{([ ["SERVICE","Dịch vụ",Tag],["WAREHOUSE",step==="price"?"Mặt hàng":"Danh mục kho",Package] ] as const).map(([value,label,Icon])=><button type="button" key={value} aria-pressed={kind===value} className={kind===value?"selected":""} onClick={()=>changeKind(value)}><Icon size={20}/>{label}</button>)}</div></fieldset>
          {step==="price"?<label>Chọn {kind==="SERVICE"?"dịch vụ":"mặt hàng"}<select value={selected?.id??""} onChange={event=>setServiceId(event.target.value)}><option value="" disabled>Chọn trong danh mục</option>{available.map(item=><option key={item.id} value={item.id}>{item.name} ({item.id})</option>)}</select></label>:<>
            <label>Tên {kind==="SERVICE"?"dịch vụ":"mặt hàng"}<input maxLength={100} value={name} onChange={event=>setName(event.target.value)} placeholder={kind==="SERVICE"?"Nhập tên dịch vụ mới":"Nhập tên mặt hàng mới"}/></label>
            <div className="ki-proposal-grid"><label>Mã danh mục (SKU)<input maxLength={10} value={sku} onChange={event=>setSku(event.target.value.toUpperCase())} placeholder="Ví dụ: SPAFOOT" pattern="[A-Z0-9]{1,10}"/></label><label>Phân loại<select value={category} onChange={event=>setCategory(event.target.value)}>{(kind==="SERVICE"?serviceCategories:stockCategories).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label></div>
          </>}
          <div className="ki-proposal-grid">
            {step==="price"?<label>Giá hiện tại<input readOnly value={selected?formatVnd(selected.price):"—"}/></label>:<label>Đơn vị tính<select value={unit} onChange={event=>setUnit(event.target.value)}>{units.map(value=><option key={value}>{value}</option>)}</select></label>}
            <label><span className="ki-price-label">Giá đề xuất {step==="price"&&price!==""&&selected&&<small>{delta>0?"+":""}{formatVnd(delta)}{selected.price>0?` · ${delta>0?"+":""}${(delta/selected.price*100).toFixed(1)}%`:""}</small>}</span><input type="number" min="0" max="99999999.99" step="any" value={price} onChange={event=>setPrice(event.target.value)} placeholder="VND"/></label>
          </div>
          <label><span className="ki-price-label">Lý do <small>{reason.length}/300</small></span><textarea maxLength={300} value={reason} onChange={event=>setReason(event.target.value)} placeholder={step==="price"?"Nêu rõ lý do thay đổi":"Nêu rõ lý do cần thêm mới"}/></label>
          <p className="ki-proposal-note"><Clock size={18}/>{step==="price"?"Giá mới chỉ được áp dụng sau khi quản lý phê duyệt.":"Mục mới chỉ được tạo sau khi quản lý phê duyệt. Hàng trong Kho được quản lý nội bộ."}</p>
        </>}
        {error&&<p role="alert" className="ki-proposal-error">{error}</p>}
      </section>
      <footer>{step!=="choose"&&<button type="button" disabled={saving} onClick={()=>{setStep("choose");setError("");}}>Quay lại</button>}<button type="button" disabled={saving} onClick={onClose}>Hủy bỏ</button>{step==="choose"?<button type="button" className="primary" onClick={()=>setStep(type)}>Tiếp tục <ArrowRight size={18}/></button>:<button type="submit" className="primary" disabled={!valid||saving}><Send size={17}/>{saving?"Đang gửi…":"Gửi quản lý phê duyệt"}</button>}</footer>
    </form>
  </dialog>;
}


/* StockNotifications.tsx — chức năng Kho / Dịch vụ */
export interface StockActivity {
  id: string;
  name: string;
  sku: string;
  occurredAt: string;
  qty: number;
  staff: string;
  movementType: MovementType;
}

const types = {
  RECEIVE: { filter:"Nhập", label:"Nhập kho", tone:"green", Icon:ArrowDownToLine },
  ISSUE: { filter:"Xuất", label:"Xuất kho", tone:"blue", Icon:ArrowUpFromLine },
  WASTE: { filter:"Hao hụt", label:"Hao hụt", tone:"red", Icon:Trash2 },
  RETURN: { filter:"Trả kho", label:"Trả lại kho", tone:"green", Icon:RotateCcw },
  ADJUST: { filter:"Điều chỉnh", label:"Điều chỉnh", tone:"slate", Icon:SlidersHorizontal },
} as const;

const dateKey = (date:Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
function dayLabel(date:Date) {
  const today=new Date();const yesterday=new Date(today.getFullYear(),today.getMonth(),today.getDate()-1);
  const label=dateKey(date)===dateKey(today)?"Hôm nay":dateKey(date)===dateKey(yesterday)?"Hôm qua":date.toLocaleDateString("vi-VN",{weekday:"long"});
  const short=date.toLocaleDateString("vi-VN",{day:"2-digit",month:"2-digit",...(date.getFullYear()!==today.getFullYear()?{year:"numeric" as const}:{})});
  return `${label} · ${short}`;
}

export function StockNotifications({usage,onSeeAll}:{usage:StockActivity[];onSeeAll:()=>void}) {
  const [open,setOpen]=useState(false);
  const [filter,setFilter]=useState<"all"|MovementType>("all");
  const containerRef=useRef<HTMLDivElement>(null);
  const triggerRef=useRef<HTMLButtonElement>(null);
  const closeRef=useRef<HTMLButtonElement>(null);
  const close=()=>{setOpen(false);triggerRef.current?.focus();};
  useEffect(()=>{
    if(!open)return;
    closeRef.current?.focus();
    const outside=(event:PointerEvent)=>{if(!containerRef.current?.contains(event.target as Node))setOpen(false);};
    const escape=(event:KeyboardEvent)=>{if(event.key==="Escape"){setOpen(false);triggerRef.current?.focus();}};
    document.addEventListener("pointerdown",outside);document.addEventListener("keydown",escape);
    return ()=>{document.removeEventListener("pointerdown",outside);document.removeEventListener("keydown",escape);};
  },[open]);
  const sorted=[...usage].sort((a,b)=>Date.parse(b.occurredAt)-Date.parse(a.occurredAt));
  const rows=sorted.filter(activity=>filter==="all"||activity.movementType===filter);
  const groups=new Map<string,{date:Date;rows:StockActivity[]}>();
  rows.forEach(activity=>{
    const date=new Date(activity.occurredAt);const key=dateKey(date);
    if(!groups.has(key))groups.set(key,{date,rows:[]});
    groups.get(key)!.rows.push(activity);
  });
  const filterTypes:MovementType[]=["RECEIVE","ISSUE","WASTE",...(["RETURN","ADJUST"] as const).filter(type=>usage.some(row=>row.movementType===type))];
  return <div ref={containerRef} className="ki-stock-notifications">
    <button ref={triggerRef} type="button" aria-label="Thông báo biến động kho" aria-haspopup="dialog" aria-expanded={open} aria-controls={open?"stock-notifications":undefined} className={`ki-stock-bell${open?" is-open":""}`} onClick={()=>{setFilter("all");setOpen(value=>!value);}}>
      <Bell size={19}/>{usage.length>0&&<span className="ki-stock-count" aria-hidden="true">{usage.length}</span>}
    </button>
    {open&&<>
      <div className="ki-stock-backdrop" aria-hidden="true" onPointerDown={close}/>
      <div id="stock-notifications" className="ki-stock-popover" role="dialog" aria-label="Thông báo biến động kho">
        <header className="ki-stock-heading"><div><h2>Thông báo kho</h2><p className="ki-stock-subtitle">Biến động tồn kho gần đây</p></div><button ref={closeRef} type="button" aria-label="Đóng thông báo kho" className="ki-stock-close" onClick={close}><X size={17}/></button></header>
        <p className="ki-stock-description">Các lần nhập, xuất và điều chỉnh gần nhất của danh mục đang xem.</p>
        <div className="ki-stock-filters" role="group" aria-label="Lọc loại biến động">
          <button type="button" aria-pressed={filter==="all"} onClick={()=>setFilter("all")}>Tất cả <span>{usage.length}</span></button>
          {filterTypes.map(type=><button type="button" key={type} aria-pressed={filter===type} onClick={()=>setFilter(type)}>{types[type].filter} <span>{usage.filter(row=>row.movementType===type).length}</span></button>)}
        </div>
        <div className="ki-stock-list">
          {[...groups].map(([key,group])=><section key={key} className="ki-stock-day" aria-label={dayLabel(group.date)}>
            <h3>{dayLabel(group.date)}</h3>
            {group.rows.map(activity=>{
              const cfg=types[activity.movementType];const Icon=cfg.Icon;
              return <article className="ki-stock-activity" key={activity.id}>
                <span className={`ki-stock-icon ${cfg.tone}`} aria-hidden="true"><Icon size={19}/></span>
                <div className="ki-stock-item"><h4 title={activity.name}>{activity.name}</h4><div className="ki-stock-meta"><span className="ki-stock-sku">{activity.sku}</span><span title={activity.staff}>{activity.staff}</span><span aria-hidden="true">·</span><time dateTime={activity.occurredAt}>{new Date(activity.occurredAt).toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit",hour12:false})}</time></div></div>
                <div className="ki-stock-amount"><strong className={activity.qty<0?"negative":activity.qty>0?"positive":"neutral"}>{activity.qty>0?"+":""}{activity.qty.toLocaleString("vi-VN")}</strong><span className={`ki-stock-type ${cfg.tone}`}>{cfg.label}</span></div>
              </article>;
            })}
          </section>)}
          {rows.length===0&&<div className="ki-stock-empty"><Package size={28}/><p>{usage.length===0?"Chưa có biến động kho.":"Chưa có biến động thuộc loại này."}</p></div>}
        </div>
        <footer className="ki-stock-footer"><button type="button" onClick={()=>{close();onSeeAll();}}>Xem tất cả biến động <ArrowRight size={16}/></button></footer>
      </div>
    </>}
  </div>;
}


/* StockVoucherDialog.tsx — chức năng Kho / Dịch vụ */
export function StockVoucherDialog({movements,onClose}:{movements:VoucherMovement[];onClose:()=>void}) {
  const ref=useRef<HTMLDialogElement>(null);
  const [step,setStep]=useState<"choose"|"preview">("choose");
  const [mode,setMode]=useState<"all"|"single">("single");
  const [id,setId]=useState(movements[0]?.id??"");
  const [detailsById,setDetailsById]=useState<Record<string,VoucherDetails>>({});
  const selected=movements.find(row=>row.id===id);
  const details=selected?(detailsById[id]??defaultVoucherDetails(selected)):{sender:"",receiver:"",source:"",destination:"",reference:""};
  const update=(field:keyof VoucherDetails,value:string)=>setDetailsById(previous=>({...previous,[id]:{...details,[field]:value}}));
  useEffect(()=>{ref.current?.showModal();},[]);
  return <dialog ref={ref} className={`ki-voucher-dialog${step==="choose"?" ki-voucher-select-mode":""}`} aria-labelledby="voucher-dialog-title" onCancel={event=>{event.preventDefault();onClose();}}>
    <header><div><h2 id="voucher-dialog-title">Xuất phiếu biến động kho</h2><p>{step==="choose"?"Vui lòng chọn cách xuất phiếu bạn muốn thực hiện:":mode==="all"?`Xuất ${movements.length} phiếu theo danh sách đang lọc. Mỗi biến động một phiếu riêng.`:"Chọn biến động đã ghi nhận, kiểm tra thông tin và in hoặc lưu PDF."}</p></div><button type="button" aria-label="Đóng xuất phiếu" onClick={onClose}><X size={20}/></button></header>
    {step==="choose"?<section className="ki-voucher-choices">
      {([{value:"all",title:"Xuất tất cả biến động",description:`Xuất ${movements.length} biến động trong danh sách đang lọc. Mỗi biến động có phiếu và phần ký riêng.`,Icon:Files},{value:"single",title:"Xuất riêng từng biến động",description:"Chọn một biến động cụ thể để xem, bổ sung thông tin và xuất phiếu.",Icon:FileText}] as const).map(choice=><button type="button" key={choice.value} aria-pressed={mode===choice.value} onClick={()=>setMode(choice.value)}><span className="ki-voucher-choice-top"><span className="ki-voucher-choice-icon"><choice.Icon size={28}/></span><span className="ki-voucher-choice-check">{mode===choice.value&&<Check size={17}/>}</span></span><strong>{choice.title}</strong><p>{choice.description}</p></button>)}
    </section>:<>
      <section className="ki-voucher-controls">
        <label>{mode==="all"?"Xem trước / bổ sung thông tin từng phiếu":"Chọn biến động"}<select value={id} onChange={event=>setId(event.target.value)}>{movements.map(row=><option key={row.id} value={row.id}>BDK-{row.id} · {movementLabels[row.movementType]} · {row.itemName} · {new Date(row.occurredAt).toLocaleString("vi-VN")}</option>)}</select></label>
        {selected&&<><div className="ki-voucher-fields">
          <label>Người xuất / Giao<input maxLength={100} value={details.sender} readOnly={isOutgoing(selected)&&Boolean(selected.staffName)} onChange={event=>update("sender",event.target.value)} placeholder="Họ tên bên giao"/></label>
          <label>Người nhập / Nhận<input maxLength={100} value={details.receiver} readOnly={!isOutgoing(selected)&&Boolean(selected.staffName)} onChange={event=>update("receiver",event.target.value)} placeholder="Họ tên bên nhận"/></label>
          <label>Vị trí nguồn<input maxLength={150} value={details.source} onChange={event=>update("source",event.target.value)}/></label>
          <label>Vị trí đích<input maxLength={150} value={details.destination} onChange={event=>update("destination",event.target.value)}/></label>
        </div><label>Chứng từ liên quan (tùy chọn)<input maxLength={150} value={details.reference} onChange={event=>update("reference",event.target.value)}/></label>
        <p>Tên người thực hiện lấy từ giao dịch đã lưu. Thông tin bổ sung dùng trên bản in này; chỗ ký để người giao và người nhận ký thực tế.</p></>}
      </section>
      {selected?<div className="ki-voucher-preview" dangerouslySetInnerHTML={{__html:voucherBody(selected,details)}}/>:<p>Không có biến động để xuất phiếu.</p>}
    </>}
    <footer>{step==="preview"&&<button type="button" onClick={()=>setStep("choose")}>Quay lại</button>}<button type="button" onClick={onClose}>Hủy bỏ</button>{step==="choose"?<button type="button" className="primary" disabled={movements.length===0} onClick={()=>setStep("preview")}>Tiếp tục <ArrowRight size={17}/></button>:<button type="button" className="primary" disabled={!selected} onClick={()=>{if(selected)printStockVouchers(mode==="all"?movements:[selected],detailsById);}}><Printer size={16}/>{mode==="all"?`In / Lưu PDF ${movements.length} phiếu`:"In / Lưu PDF"}</button>}</footer>
  </dialog>;
}

const kitchenInventoryStyles = String.raw`
/* consumptionReports.css */
.ki-report-page-actions{flex-wrap:wrap}.ki-report-page-actions label>span{font-size:11px;white-space:nowrap;color:#64748b}.ki-report-chart-scroll{max-width:100%;overflow-x:auto}
.ki-consumption-reports{flex:1;min-height:0;overflow-y:auto;padding:20px 24px 28px;background:#f8fafc;color:#0f172a;font-family:inherit}.ki-report-page-header{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;margin-bottom:18px}.ki-report-page-header h2{font-size:19px;font-weight:700;margin:0 0 6px}.ki-report-page-header p{margin:0;font-size:12px;color:#64748b;line-height:1.6}.ki-report-page-actions{display:flex;gap:10px;align-items:center}.ki-report-page-actions label,.ki-report-page-actions>button{display:flex;align-items:center;gap:8px;border:1px solid #e2e8f0;border-radius:8px;background:white;color:#475569;padding:9px 12px;font-size:12px}.ki-report-page-actions input{border:0;background:transparent;outline:0;color:#475569;font-size:12px;font-family:inherit;min-width:0}.ki-report-page-actions>button{font-family:inherit;cursor:pointer;font-weight:500}.ki-report-overview{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(310px,1fr);gap:16px;margin-bottom:16px;align-items:stretch}.ki-report-card{background:white;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;box-shadow:0 2px 5px #0f172a03;min-width:0}.ki-report-card>header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:17px 20px}.ki-report-card h3{display:flex;align-items:center;gap:12px;font-size:14px;font-weight:700;line-height:1.4;margin:0;color:#0f172a}.ki-report-card h3 svg{color:#1d4ed8;flex-shrink:0}.ki-report-legend{display:flex;gap:20px;flex-wrap:wrap;font-size:10px;color:#64748b}.ki-report-legend span{display:flex;align-items:center;gap:7px;white-space:nowrap}.ki-report-legend i{width:9px;height:9px;border-radius:50%;background:#1d4ed8}.ki-report-legend span:nth-child(2) i{background:#60a5fa}.ki-report-chart-scroll{overflow-x:auto;padding:0 12px 0 0}.ki-report-chart{display:block;width:100%;min-width:600px;outline:0}.ki-report-axis{fill:#64748b;font-size:10px;font-family:inherit}.ki-report-value{fill:#0f172a;font-size:10px;font-weight:600;font-family:inherit}.ki-report-empty-chart{fill:#64748b;font-size:12px;font-family:inherit}.ki-report-chart g[tabindex]:focus-visible{outline:none}.ki-report-chart g[tabindex]:focus-visible circle{stroke:#0f172a;stroke-width:2}.ki-report-reference-note{display:flex;align-items:center;gap:6px;font-size:10px;color:#94a3b8;margin:0;padding:0 20px 14px;line-height:1.5}.ki-report-groups>header{border-bottom:1px solid #f1f5f9}.ki-report-group-list{padding:0 20px 5px;max-height:310px;overflow-y:auto;scrollbar-width:thin}.ki-report-group{display:flex;gap:14px;align-items:center;padding:19px 0;border-bottom:1px solid #f1f5f9}.ki-report-group:last-child{border-bottom:0}.ki-report-group-icon{display:flex;align-items:center;justify-content:center;flex-shrink:0;width:34px;height:34px;border-radius:50%;background:#eff6ff}.ki-report-group>div{flex:1;min-width:0}.ki-report-group-label{display:flex;align-items:center;gap:12px;font-size:11px;line-height:1.5;margin-bottom:9px}.ki-report-group-label strong{flex:1;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ki-report-group-label span{font-weight:600;color:#334155;white-space:nowrap}.ki-report-group-label b{font-weight:600;color:#1e293b;white-space:nowrap}.ki-report-progress{height:11px;border-radius:99px;background:#edf0f2;overflow:hidden}.ki-report-progress span{display:block;height:100%;border-radius:99px;min-width:0}.ki-report-empty{padding:42px 12px;display:flex;flex-direction:column;align-items:center;gap:12px;color:#94a3b8;text-align:center}.ki-report-empty p{font-size:12px;color:#64748b;line-height:1.6;margin:0}.ki-report-details>header{border-bottom:1px solid #e2e8f0;padding:12px 20px;flex-wrap:wrap}.ki-report-tabs{display:flex;border:1px solid #dbeafe;border-radius:7px;overflow:hidden;background:#f8fafc}.ki-report-tabs button{border:0;background:transparent;color:#475569;padding:8px 22px;font-size:11px;font-weight:500;font-family:inherit;cursor:pointer}.ki-report-tabs button[aria-selected=true]{background:#1d4ed8;color:white;box-shadow:0 2px 5px #1d4ed826}.ki-report-table-scroll{overflow-x:auto}.ki-report-details table{width:100%;min-width:760px;border-collapse:collapse;text-align:left;font-size:12px}.ki-report-details th{padding:12px 16px;font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.02em;background:#f8fafc;white-space:nowrap}.ki-report-details td{padding:14px 16px;border-top:1px solid #eef2f6;color:#334155;line-height:1.5}.ki-report-details td:nth-child(3){font-weight:500;color:#0f172a;min-width:170px}.ki-report-details th:nth-child(n+5),.ki-report-details td:nth-child(n+5){text-align:right;white-space:nowrap}.ki-report-details th:last-child,.ki-report-details td:last-child{text-align:center}.ki-report-details tr:hover td{background:#f8faff}.ki-report-sku{font-size:11px;font-weight:600;white-space:nowrap}.ki-report-low-stock,.ki-report-no-stock{display:inline-flex;align-items:center;justify-content:center;min-width:42px;padding:2px 10px;border-radius:99px;background:#fff1d6;color:#b45309;font-size:11px}.ki-report-no-stock{background:#fff1f2;color:#be123c}.ki-report-details .ki-report-empty-cell{padding:34px;text-align:center;color:#94a3b8;font-size:12px}.ki-report-details>footer{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;border-top:1px solid #edf2f7;padding:12px 16px;font-size:10px;line-height:1.6;color:#94a3b8}.ki-report-details>footer strong{color:#1d4ed8;font-weight:600}.ki-consumption-reports button:focus-visible{outline:2px solid #3b82f6;outline-offset:2px}.ki-report-page-actions label:focus-within{outline:2px solid #3b82f6;outline-offset:2px}
@media(max-width:1250px){.ki-report-overview{grid-template-columns:minmax(0,1fr)}.ki-report-trend>header{flex-wrap:wrap}.ki-report-group-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 24px;max-height:none}.ki-report-group-label{gap:8px}.ki-report-chart{max-height:300px}.ki-report-empty{grid-column:1/-1}.ki-report-group{padding:16px 0}}
@media(max-width:700px){.ki-consumption-reports{padding:16px 12px}.ki-report-card>header{padding:14px}.ki-report-page-actions{width:100%;flex-wrap:wrap}.ki-report-legend{gap:12px}.ki-report-group-list{display:block;padding:0 14px}.ki-report-group-label{font-size:11px}.ki-report-details>header{gap:14px}.ki-report-tabs button{padding:8px 18px}.ki-report-group-icon{width:30px;height:30px}.ki-report-group{gap:10px}}

/* proposalDialog.css */
.ki-proposal{padding:0;border:0;border-radius:20px;width:min(680px,calc(100vw - 32px));max-height:calc(100dvh - 32px);margin:auto;color:#0f172a;box-shadow:0 24px 80px #0f172a33;font-family:inherit;overflow:auto}
.ki-proposal::backdrop{background:#0f172a80;backdrop-filter:blur(3px)}
.ki-proposal *{box-sizing:border-box}.ki-proposal button,.ki-proposal input,.ki-proposal select,.ki-proposal textarea{font-family:inherit;font-size:13px}
.ki-proposal header{display:flex;justify-content:space-between;gap:16px;padding:28px 28px 12px}.ki-proposal header>div{display:flex;gap:16px;align-items:center}.ki-proposal h2{font-size:21px;font-weight:700;margin:0 0 8px;line-height:1.35}.ki-proposal p{font-size:13px;line-height:1.6;color:#64748b;margin:0}.ki-proposal-icon{display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;width:52px;height:52px;border-radius:16px;background:#2563eb;color:white}
.ki-proposal button{cursor:pointer}.ki-proposal button:disabled{cursor:default;opacity:.55}.ki-proposal .ki-proposal-close{display:flex;align-items:center;justify-content:center;border:0;background:#f1f5f9;color:#64748b;border-radius:50%;width:36px;height:36px;flex-shrink:0}.ki-proposal section{padding:20px 28px 28px;display:flex;flex-direction:column;gap:20px}
.ki-proposal-choices{display:grid;grid-template-columns:1fr 1fr;gap:16px}.ki-proposal-choices>button{background:white;border:1px solid #e2e8f0;border-radius:18px;padding:22px;text-align:left;color:#0f172a}.ki-proposal-choices>button.selected{border-color:#2563eb;background:#f5f8ff;box-shadow:0 0 0 4px #2563eb15}.ki-proposal-choices strong{display:block;font-size:17px;line-height:1.5;margin:20px 0 10px}.ki-choice-top{display:flex;align-items:center;justify-content:space-between}.ki-choice-check{width:26px;height:26px;border:1px solid #cbd5e1;border-radius:50%;display:flex;align-items:center;justify-content:center}.selected .ki-choice-check{background:#2563eb;color:white;border-color:#2563eb}.ki-proposal-choices>button:not(.selected) .ki-proposal-icon{background:#f1f5f9;color:#475569}
.ki-proposal fieldset{margin:0;padding:0;border:0}.ki-proposal legend,.ki-proposal label{font-size:13px;font-weight:600;color:#475569}.ki-proposal legend{margin-bottom:10px}.ki-proposal label{display:flex;flex-direction:column;gap:9px;min-width:0}.ki-proposal-kind{display:flex;gap:8px;background:#f1f5f9;border-radius:12px;padding:5px}.ki-proposal-kind button{flex:1;display:flex;align-items:center;justify-content:center;gap:10px;border:1px solid transparent;border-radius:9px;background:transparent;color:#64748b;padding:11px;font-weight:600}.ki-proposal-kind button.selected{background:white;color:#2563eb;border-color:#bfdbfe;box-shadow:0 2px 3px #0f172a0d}
.ki-proposal input,.ki-proposal select,.ki-proposal textarea{width:100%;border:1px solid #dbe2ed;border-radius:10px;padding:12px;color:#0f172a;background:white;outline:none;font-weight:400;min-width:0}.ki-proposal input:focus,.ki-proposal select:focus,.ki-proposal textarea:focus{border-color:#2563eb;box-shadow:0 0 0 2px #2563eb15}.ki-proposal input[readonly]{background:#f8fafc;color:#64748b}.ki-proposal textarea{resize:vertical;min-height:100px}.ki-proposal-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}.ki-price-label{display:flex;justify-content:space-between;gap:8px;align-items:center;min-height:20px}.ki-price-label small{font-size:11px;color:#64748b;font-weight:400}.ki-proposal .ki-proposal-note{display:flex;align-items:center;gap:12px;border:1px solid #dbeafe;background:#f5f8ff;border-radius:12px;padding:13px;font-size:12px}.ki-proposal-note svg{color:#2563eb;flex-shrink:0}.ki-proposal .ki-proposal-error{color:#be123c;background:#fff1f2;padding:12px;border-radius:10px}
.ki-proposal footer{display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 28px}.ki-proposal footer button{display:flex;align-items:center;justify-content:center;gap:8px;padding:11px 18px;border:1px solid #dbe2ed;border-radius:10px;background:white;color:#475569;font-weight:600}.ki-proposal footer .primary{background:#2563eb;border-color:#2563eb;color:white}.ki-proposal button:focus-visible{outline:2px solid #2563eb;outline-offset:3px}
@media(max-width:560px){.ki-proposal header{padding:20px 18px 8px}.ki-proposal section{padding:16px 18px 20px}.ki-proposal h2{font-size:18px}.ki-proposal-choices,.ki-proposal-grid{grid-template-columns:1fr}.ki-proposal-choices>button{padding:16px}.ki-proposal-choices strong{margin-top:12px}.ki-proposal footer{padding:16px 18px}}

/* stockNotifications.css */
.ki-stock-notifications{position:relative;flex-shrink:0;font-family:inherit}.ki-stock-notifications button{font-family:inherit;cursor:pointer}.ki-stock-bell{position:relative;display:flex;align-items:center;justify-content:center;width:38px;height:38px;border:1px solid #e2e8f0;border-radius:11px;background:#f8fafc;color:#475569}.ki-stock-bell.is-open{border-color:#bfdbfe;background:#eff6ff;color:#2563eb}.ki-stock-count{position:absolute;top:-6px;right:-6px;min-width:18px;height:18px;border:2px solid white;border-radius:20px;background:#2563eb;color:white;display:flex;align-items:center;justify-content:center;padding:0 3px;font-size:10px;font-weight:700}
.ki-stock-backdrop{position:fixed;inset:52px 0 0;background:#0f172a2b;z-index:79}.ki-stock-popover{position:fixed;top:64px;right:22px;width:min(440px,calc(100vw - 24px));max-height:calc(100dvh - 80px);display:flex;flex-direction:column;background:white;border:1px solid #e2e8f0;border-radius:20px;box-shadow:0 16px 48px #0f172a2b;overflow:hidden;z-index:80;color:#0f172a}.ki-stock-popover *{box-sizing:border-box}.ki-stock-heading{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding:22px 22px 0;flex-shrink:0}.ki-stock-heading h2{margin:0 0 3px;font-size:18px;font-weight:700;line-height:1.35}.ki-stock-popover .ki-stock-subtitle{margin:0;font-size:12px;color:#2563eb;line-height:1.5}.ki-stock-close{width:32px;height:32px;display:flex;align-items:center;justify-content:center;flex-shrink:0;border:0;border-radius:50%;background:#f1f5f9;color:#64748b}.ki-stock-description{margin:10px 22px 12px;font-size:12px;color:#64748b;line-height:1.6;flex-shrink:0}
.ki-stock-filters{display:flex;gap:8px;flex-wrap:wrap;padding:0 22px 16px;border-bottom:1px solid #f1f5f9;flex-shrink:0}.ki-stock-filters button{display:inline-flex;align-items:center;gap:7px;padding:7px 12px;border:1px solid #e2e8f0;border-radius:99px;background:white;color:#475569;font-size:12px;line-height:1.4;white-space:nowrap}.ki-stock-filters button span{font-size:10px;color:#94a3b8}.ki-stock-filters button[aria-pressed=true]{background:#0f172a;border-color:#0f172a;color:white;font-weight:700}.ki-stock-filters button[aria-pressed=true] span{color:#cbd5e1}
.ki-stock-list{min-height:0;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:#d7dee9 transparent;max-height:440px;padding:4px 0 12px}.ki-stock-day h3{font-size:11px;font-weight:600;letter-spacing:.025em;color:#64748b;margin:16px 22px 8px;line-height:1.5}.ki-stock-activity{display:flex;align-items:center;gap:14px;padding:12px 22px}.ki-stock-activity:hover{background:#f8fafc}.ki-stock-icon{display:flex;align-items:center;justify-content:center;width:42px;height:42px;border-radius:13px;flex-shrink:0}.ki-stock-item{flex:1;min-width:0}.ki-stock-item h4{font-size:12px;font-weight:600;line-height:1.5;color:#0f172a;margin:0 0 5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ki-stock-meta{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:10px;color:#64748b;line-height:1.5}.ki-stock-sku{padding:1px 5px;background:#f1f5f9;border-radius:4px;letter-spacing:.04em;font-weight:600;max-width:100%;overflow:hidden;text-overflow:ellipsis}.ki-stock-amount{display:flex;flex-direction:column;align-items:flex-end;gap:5px;flex-shrink:0}.ki-stock-amount strong{font-family:inherit;font-size:15px;font-weight:700;line-height:1.4}.ki-stock-amount .positive{color:#059669}.ki-stock-amount .negative{color:#dc2626}.ki-stock-amount .neutral{color:#64748b}.ki-stock-type{padding:2px 8px;border-radius:99px;font-size:10px;line-height:1.4;font-weight:600;white-space:nowrap}.ki-stock-popover .green{color:#059669;background:#ecfdf5}.ki-stock-popover .blue{color:#2563eb;background:#eff6ff}.ki-stock-popover .red{color:#dc2626;background:#fff1f2}.ki-stock-popover .slate{color:#64748b;background:#f1f5f9}
.ki-stock-empty{display:flex;flex-direction:column;align-items:center;gap:12px;padding:32px 22px;color:#94a3b8}.ki-stock-empty p{font-size:12px;line-height:1.6;margin:0}.ki-stock-footer{padding:14px 22px 18px;border-top:1px solid #f1f5f9;background:white;flex-shrink:0}.ki-stock-footer button{width:100%;display:flex;align-items:center;justify-content:center;gap:10px;border:0;border-radius:12px;padding:12px;background:#f5f8ff;color:#2563eb;font-size:13px;font-weight:600}.ki-stock-notifications button:focus-visible{outline:2px solid #2563eb;outline-offset:3px}
@media(max-width:480px){.ki-stock-popover{right:12px}.ki-stock-activity{gap:10px;padding-left:16px;padding-right:16px}.ki-stock-heading{padding:18px 16px 0}.ki-stock-description{margin-left:16px;margin-right:16px}.ki-stock-filters{padding-left:16px;padding-right:16px;gap:6px}.ki-stock-filters button{padding:6px 10px}.ki-stock-day h3{margin-left:16px}.ki-stock-footer{padding-left:16px;padding-right:16px}.ki-stock-icon{width:36px;height:36px}}

/* stockVoucher.css */
.ki-voucher-dialog{padding:0;border:0;border-radius:16px;width:min(900px,calc(100vw - 32px));max-height:calc(100dvh - 32px);margin:auto;overflow:auto;background:white;color:#0f172a;font-family:inherit;box-shadow:0 24px 80px #0f172a33}.ki-voucher-dialog::backdrop{background:#0f172a80}.ki-voucher-dialog>header{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;padding:20px 24px;border-bottom:1px solid #e2e8f0}.ki-voucher-dialog h2{margin:0;font-size:18px;font-weight:700}.ki-voucher-dialog>header p,.ki-voucher-controls>p{font-size:12px;color:#64748b;line-height:1.6;margin:6px 0 0}.ki-voucher-dialog>header button{border:0;border-radius:50%;padding:7px;display:flex;background:#f1f5f9;color:#64748b;cursor:pointer}.ki-voucher-controls{padding:18px 24px;display:flex;flex-direction:column;gap:14px}.ki-voucher-controls label{display:flex;flex-direction:column;gap:7px;font-size:12px;font-weight:600;color:#475569}.ki-voucher-controls select,.ki-voucher-controls input{font-family:inherit;font-size:12px;border:1px solid #cbd5e1;border-radius:8px;padding:10px;color:#0f172a;background:white;width:100%;min-width:0;box-sizing:border-box}.ki-voucher-controls input[readonly]{background:#f1f5f9;color:#475569}.ki-voucher-fields{display:grid;grid-template-columns:1fr 1fr;gap:14px}.ki-voucher-preview{background:#e2e8f0;padding:24px;overflow:auto}.ki-voucher-preview .stock-voucher-sheet{padding:32px;background:#fff;color:#000;max-width:740px;margin:auto;font-family:"Times New Roman",serif;font-size:13px;line-height:1.5;min-width:570px;box-sizing:border-box}.ki-voucher-preview .stock-voucher-sheet>header{text-align:center;margin-bottom:16px}.ki-voucher-preview h1{font-size:19px;font-weight:700;margin:4px 0 0}.ki-voucher-preview .voucher-meta p{margin:5px 0;overflow-wrap:anywhere}.ki-voucher-preview .voucher-meta span{margin-left:25px}.ki-voucher-preview table{width:100%;border-collapse:collapse;table-layout:fixed;margin-top:16px}.ki-voucher-preview th,.ki-voucher-preview td{border:1px solid #000;padding:7px 5px;text-align:center;overflow-wrap:anywhere}.ki-voucher-preview th:first-child{width:29%}.ki-voucher-preview th:nth-child(2){width:9%}.ki-voucher-preview th:nth-child(4){width:20%}.ki-voucher-preview td:first-child{text-align:left}.ki-voucher-preview .voucher-blank{height:30px}.ki-voucher-preview .voucher-price-note{font-size:11px;font-style:italic}.ki-voucher-preview .voucher-confirmation{border:1px solid #000;padding:12px;margin-top:20px}.ki-voucher-preview .voucher-confirmation h2{font-size:13px;font-weight:700;margin:0 0 8px}.ki-voucher-preview .voucher-signatures{display:grid;grid-template-columns:1fr 1fr;text-align:center;gap:20px}.ki-voucher-preview .voucher-signatures strong,.ki-voucher-preview .voucher-signatures em{display:block}.ki-voucher-preview .voucher-signatures p{margin:70px 0 10px;min-height:20px;font-weight:700}.ki-voucher-preview .voucher-confirmation>p{font-size:12px;margin-top:18px}.ki-voucher-dialog>footer{position:sticky;bottom:0;display:flex;justify-content:flex-end;gap:10px;background:white;border-top:1px solid #e2e8f0;padding:16px 24px}.ki-voucher-dialog>footer button{display:flex;align-items:center;gap:8px;padding:10px 16px;border:1px solid #cbd5e1;border-radius:8px;background:white;color:#475569;font-family:inherit;font-size:12px;font-weight:600;cursor:pointer}.ki-voucher-dialog>footer button.primary{background:#0f172a;color:white;border-color:#0f172a}.ki-voucher-dialog>footer button:disabled{opacity:.5;cursor:default}.ki-voucher-dialog button:focus-visible,.ki-voucher-dialog input:focus-visible,.ki-voucher-dialog select:focus-visible{outline:2px solid #2563eb;outline-offset:2px}@media(max-width:600px){.ki-voucher-fields{grid-template-columns:1fr}.ki-voucher-dialog>header,.ki-voucher-controls{padding:16px}.ki-voucher-preview{padding:12px}}

.ki-voucher-select-mode{width:min(680px,calc(100vw - 32px));border-radius:22px}.ki-voucher-select-mode>header{border:0;padding:28px 28px 12px}.ki-voucher-select-mode>header h2{font-size:24px}.ki-voucher-select-mode>header p{font-size:14px;margin-top:10px}.ki-voucher-select-mode>header button{padding:10px}.ki-voucher-choices{padding:24px 28px 32px;display:grid;grid-template-columns:1fr 1fr;gap:18px}.ki-voucher-choices>button{padding:24px 20px;border:1px solid #e2e8f0;background:white;border-radius:20px;color:#0f172a;text-align:left;font-family:inherit;cursor:pointer}.ki-voucher-choices>button[aria-pressed=true]{background:#f5f8ff;border-color:#2563eb;box-shadow:0 0 0 4px #2563eb15}.ki-voucher-choice-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px}.ki-voucher-choice-icon{display:flex;align-items:center;justify-content:center;width:56px;height:56px;background:#f1f5f9;color:#475569;border-radius:17px}.ki-voucher-choice-check{display:flex;align-items:center;justify-content:center;width:26px;height:26px;border:1px solid #cbd5e1;border-radius:50%}.ki-voucher-choices>button[aria-pressed=true] .ki-voucher-choice-icon,.ki-voucher-choices>button[aria-pressed=true] .ki-voucher-choice-check{background:#2563eb;color:white;border-color:#2563eb}.ki-voucher-choices strong{display:block;font-size:18px;font-weight:700;line-height:1.5}.ki-voucher-choices p{font-size:14px;line-height:1.6;margin:12px 0 0;color:#64748b}.ki-voucher-dialog>footer{background:#f8fafc}.ki-voucher-dialog>footer button.primary{background:#2563eb;border-color:#2563eb}.ki-voucher-select-mode>footer{padding:20px 28px}.ki-voucher-select-mode>footer button{border-radius:12px;padding:12px 20px;font-size:14px}@media(max-width:540px){.ki-voucher-choices{grid-template-columns:1fr;padding:16px 20px 24px}.ki-voucher-choice-top{margin-bottom:16px}.ki-voucher-select-mode>header{padding:22px 20px 10px}.ki-voucher-select-mode>header h2{font-size:21px}}

`;


// Gửi và duyệt trả kho: dùng chung cùng một triển khai cho Kho và Buồng phòng.
const statusLabels={PENDING:"Chờ duyệt",APPROVED:"Đã duyệt",REJECTED:"Từ chối"};
export function StockReturnsPanel({ warehouse=false, onChanged }: { warehouse?:boolean; onChanged?:()=>void }) {
  const [rows,setRows]=useState<StockReturn[]>([]),[items,setItems]=useState<Service[]>([]);
  const [loading,setLoading]=useState(true),[refresh,setRefresh]=useState(0),[busy,setBusy]=useState(false);
  const [error,setError]=useState(""),[notice,setNotice]=useState("");
  const [serviceId,setServiceId]=useState(""),[quantity,setQuantity]=useState("1"),[room,setRoom]=useState(""),[reason,setReason]=useState("");
  const [filter,setFilter]=useState(warehouse?"PENDING":"ALL");
  const [decision,setDecision]=useState<{row:StockReturn;approve:boolean}|null>(null);
  const retry=useRef<{signature:string;key:string}|null>(null);
  useEffect(()=>{
    let active=true;setLoading(true);setError("");
    Promise.all([stockReturnsApi.list(),warehouse?Promise.resolve([]):stockReturnsApi.catalog()])
      .then(([requests,catalog])=>{if(active){setRows(requests);setItems(catalog);setServiceId(current=>catalog.some(item=>item.id===current)?current:catalog[0]?.id??"");}})
      .catch(cause=>{if(active)setError(apiErrorMessage(cause,"Không thể tải yêu cầu trả kho."));})
      .finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;};
  },[warehouse,refresh]);
  const create=async(event:React.FormEvent)=>{
    event.preventDefault();if(busy)return;setError("");setNotice("");
    const number=Number(quantity);
    if(!serviceId||!Number.isSafeInteger(number)||number<1||!reason.trim()){setError("Chọn mặt hàng, nhập số lượng nguyên dương và lý do trả hàng.");return;}
    const body={service_id:serviceId,quantity:number,room_id:room.trim()||null,reason:reason.trim()};
    const signature=JSON.stringify(body);
    if(retry.current?.signature!==signature)retry.current={signature,key:newKitchenIdempotencyKey()};
    setBusy(true);
    try{
      const result=await stockReturnsApi.create(body,retry.current.key);
      setRows(current=>[result,...current.filter(row=>row.id!==result.id)]);retry.current=null;
      setQuantity("1");setRoom("");setReason("");setNotice("Đã gửi yêu cầu. Tồn kho chỉ tăng khi nhân viên Kho duyệt.");
    }catch(cause){setError(apiErrorMessage(cause,"Không thể gửi yêu cầu trả kho."));}finally{setBusy(false);}
  };
  const decide=async(note:string)=>{
    if(!decision||busy)return;setBusy(true);setError("");setNotice("");
    try{
      const result=await stockReturnsApi.decide(decision.row.id,decision.approve,note);
      setRows(current=>current.map(row=>row.id===result.id?result:row));setDecision(null);
      setNotice(result.status==="APPROVED"?"Đã duyệt trả hàng và cộng tồn kho.":"Đã từ chối yêu cầu; tồn kho không thay đổi.");onChanged?.();
    }catch(cause){setError(apiErrorMessage(cause,"Không thể quyết định yêu cầu trả kho."));throw cause;}finally{setBusy(false);}
  };
  const visible=rows.filter(row=>filter==="ALL"||row.status===filter);
  return (<><style>{stockReturnsStyles}</style>{<section className="stock-returns">
    <header><div><h2>{warehouse?"Duyệt trả kho":"Trả hàng về Kho"}</h2><p>{warehouse?"Kiểm đếm hàng nhận lại từ Buồng phòng trước khi cộng tồn.":"Gửi các mặt hàng còn dùng được về Kho. Yêu cầu cần được Kho duyệt trước khi nhập lại tồn."}</p></div>
      <button type="button" disabled={loading||busy} onClick={()=>setRefresh(value=>value+1)}>Tải lại</button></header>
    {error&&<p role="alert" className="stock-returns-error">{error}</p>}
    {notice&&<p role="status" className="stock-returns-notice">{notice}</p>}
    {!warehouse&&<form className="stock-returns-form" onSubmit={event=>void create(event)}>
      <label>Mặt hàng trả<select required value={serviceId} disabled={loading||busy} onChange={event=>setServiceId(event.target.value)}>
        {!items.length&&<option value="">Chưa có mặt hàng</option>}{items.map(item=><option key={item.id} value={item.id}>{item.name} ({item.id}) · {item.unit}</option>)}
      </select></label>
      <label>Số lượng trả<input required type="number" min="1" max="2147483647" step="1" value={quantity} onChange={event=>setQuantity(event.target.value)} disabled={busy}/></label>
      <label>Phòng trả (tùy chọn)<input value={room} maxLength={10} onChange={event=>setRoom(event.target.value)} disabled={busy} placeholder="Ví dụ: 502"/></label>
      <label className="stock-returns-wide">Lý do trả hàng<textarea required maxLength={255} value={reason} onChange={event=>setReason(event.target.value)} disabled={busy} placeholder="Ví dụ: Đồ dùng còn nguyên, chưa sử dụng"/></label>
      <button type="submit" className="stock-returns-primary" disabled={loading||busy||!items.length}>{busy?"Đang gửi…":"Gửi yêu cầu trả kho"}</button>
    </form>}
    <div className="stock-returns-filters" aria-label="Trạng thái trả kho">
      {(["ALL","PENDING","APPROVED","REJECTED"] as const).map(status=><button type="button" key={status} aria-pressed={filter===status} onClick={()=>setFilter(status)}>{status==="ALL"?"Tất cả":statusLabels[status]} ({rows.filter(row=>status==="ALL"||row.status===status).length})</button>)}
    </div>
    {loading?<p>Đang tải yêu cầu…</p>:<div className="stock-returns-table"><table><thead><tr>{["Mã / Thời điểm","Mặt hàng","Số lượng","Phòng","Người gửi / Lý do","Trạng thái","Quyết định"].map(label=><th key={label}>{label}</th>)}</tr></thead>
      <tbody>{visible.map(row=><tr key={row.id}><td>TK-{row.id}<small>{new Date(row.requested_at).toLocaleString("vi-VN")}</small></td><td>{row.service_name}<small>{row.service_id}</small></td><td>{row.quantity} {row.unit}</td><td>{row.room_id||"—"}</td><td>{row.requester}<small>{row.reason}</small></td>
        <td><span className={`stock-returns-status ${row.status.toLowerCase()}`}>{statusLabels[row.status]}</span></td>
        <td>{warehouse&&row.status==="PENDING"?<div className="stock-returns-actions"><button type="button" disabled={busy} onClick={()=>setDecision({row,approve:true})}>Duyệt nhập lại kho</button><button type="button" disabled={busy} onClick={()=>setDecision({row,approve:false})}>Từ chối</button></div>:<>{row.approver||"Chờ Kho kiểm đếm"}<small>{row.decision_reason}</small></>}</td>
      </tr>)}{!visible.length&&<tr><td colSpan={7}>Chưa có yêu cầu trả kho ở trạng thái này.</td></tr>}</tbody></table></div>}
    {decision&&<ReturnDecisionDialog value={decision} busy={busy} onClose={()=>{if(!busy)setDecision(null);}} onConfirm={decide}/>}
  </section>}</>);
}

function ReturnDecisionDialog({value,busy,onClose,onConfirm}:{value:{row:StockReturn;approve:boolean};busy:boolean;onClose:()=>void;onConfirm:(reason:string)=>Promise<void>}){
  const ref=useRef<HTMLDialogElement>(null);const [reason,setReason]=useState("");const [error,setError]=useState("");
  useEffect(()=>{const dialog=ref.current!;dialog.showModal();return()=>dialog.close();},[]);
  return <dialog className="stock-return-decision" ref={ref} aria-label={value.approve?"Duyệt nhập lại kho":"Từ chối trả kho"} onCancel={event=>{event.preventDefault();onClose();}}>
    <form onSubmit={async event=>{event.preventDefault();try{await onConfirm(reason.trim());}catch(cause){setError(apiErrorMessage(cause,"Không thể lưu quyết định."));}}}>
      <h3>{value.approve?"Xác nhận đã kiểm đếm hàng trả":"Từ chối yêu cầu trả hàng"}</h3>
      <p>{value.row.service_name} · <strong>{value.row.quantity} {value.row.unit}</strong></p>
      <p>{value.approve?"Sau khi duyệt, số hàng này sẽ được cộng lại vào tồn kho.":"Tồn kho sẽ được giữ nguyên khi từ chối."}</p>
      <label>{value.approve?"Ghi chú kiểm đếm (tùy chọn)":"Lý do từ chối"}<textarea required={!value.approve} maxLength={255} disabled={busy} value={reason} onChange={event=>setReason(event.target.value)}/></label>
      {error&&<p role="alert">{error}</p>}
      <footer><button type="button" disabled={busy} onClick={onClose}>Hủy</button><button type="submit" disabled={busy}>{busy?"Đang lưu…":value.approve?"Xác nhận duyệt":"Xác nhận từ chối"}</button></footer>
    </form>
  </dialog>;
}
const stockReturnsStyles=".stock-returns { flex: 1; min-width: 0; overflow: auto; padding: 22px; background: #f8fafc; color: #0f172a; font-size: 13px; }\n.stock-returns header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 18px; }\n.stock-returns h2 { font-size: 20px; font-weight: 750; margin: 0 0 6px; }\n.stock-returns p { margin: 6px 0 12px; color: #64748b; }\n.stock-returns button, .stock-return-decision button { border: 1px solid #cbd5e1; border-radius: 7px; padding: 8px 12px; background: #fff; color: #334155; cursor: pointer; font: inherit; white-space: nowrap; }\n.stock-returns button:disabled, .stock-return-decision button:disabled { opacity: .5; cursor: not-allowed; }\n.stock-returns .stock-returns-primary, .stock-returns-filters button[aria-pressed=true] { background: #0f172a; color: #fff; border-color: #0f172a; }\n.stock-returns-form { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 14px; padding: 18px; margin-bottom: 18px; border: 1px solid #e2e8f0; border-radius: 12px; background: #fff; }\n.stock-returns label, .stock-return-decision label { display: grid; gap: 6px; font-size: 12px; font-weight: 600; }\n.stock-returns input, .stock-returns select, .stock-returns textarea, .stock-return-decision textarea { width: 100%; box-sizing: border-box; padding: 9px; border: 1px solid #cbd5e1; border-radius: 7px; font: inherit; background: #fff; color: #0f172a; }\n.stock-returns textarea, .stock-return-decision textarea { min-height: 72px; resize: vertical; }\n.stock-returns-wide { grid-column: 1 / -1; }\n.stock-returns-form button { justify-self: start; }\n.stock-returns-filters { display: flex; flex-wrap: wrap; gap: 8px; margin: 14px 0; }\n.stock-returns-table { overflow: auto; border: 1px solid #e2e8f0; border-radius: 10px; background: #fff; }\n.stock-returns table { width: 100%; border-collapse: collapse; }\n.stock-returns th, .stock-returns td { padding: 12px; text-align: left; border-bottom: 1px solid #f1f5f9; vertical-align: top; }\n.stock-returns th { background: #f1f5f9; color: #64748b; white-space: nowrap; font-size: 11px; }\n.stock-returns small { display: block; color: #64748b; font-size: 11px; margin-top: 5px; max-width: 260px; overflow-wrap: anywhere; }\n.stock-returns-actions { display: flex; gap: 6px; flex-wrap: wrap; }\n.stock-returns-status { display: inline-block; padding: 4px 8px; border-radius: 20px; white-space: nowrap; font-size: 11px; }\n.stock-returns-status.pending { color: #92400e; background: #fef3c7; }\n.stock-returns-status.approved { color: #166534; background: #dcfce7; }\n.stock-returns-status.rejected { color: #9f1239; background: #ffe4e6; }\n.stock-returns .stock-returns-error, .stock-return-decision p[role=alert] { color: #b91c1c; background: #fff1f2; padding: 12px; border-radius: 8px; }\n.stock-returns .stock-returns-notice { color: #166534; background: #f0fdf4; padding: 12px; border-radius: 8px; }\n.stock-return-decision { position: fixed; inset: 0; margin: auto; padding: 22px; width: min(480px, calc(100vw - 32px)); max-height: calc(100dvh - 32px); overflow: auto; box-sizing: border-box; border: 1px solid #e2e8f0; border-radius: 12px; color: #0f172a; }\n.stock-return-decision::backdrop { background: #0f172a80; }\n.stock-return-decision h3 { font-size: 17px; font-weight: 700; margin-bottom: 12px; }\n.stock-return-decision p { font-size: 13px; margin: 10px 0; }\n.stock-return-decision footer { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }\n.stock-return-decision button[type=submit] { background: #0f172a; color: #fff; }\n@media(max-width:700px) { .stock-returns-form { grid-template-columns: 1fr; } }\n";
