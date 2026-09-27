import { useEffect, useState, useMemo } from "react";
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
  Search, Bell, ChevronDown, Plus,
  AlertTriangle, ShoppingCart, FileText,
  MoreVertical, ArrowUpRight, ArrowDownRight, LogOut,
  CheckSquare, Calendar, Upload, TrendingUp, Download,
  Clock, CheckCircle2, X, Send,
  Utensils, RefreshCw,
} from "lucide-react";

/* ══════════════════════════════════════════════════════════
   TYPES
══════════════════════════════════════════════════════════ */
type NavPage   = "restaurant" | "inventory" | "transactions" | "pricing" | "reports";
type StockStatus = "in-stock" | "low-stock" | "out-of-stock";
type TxType    = "import" | "export" | "waste" | "adjustment";
type PriceStatus = "pending" | "approved" | "rejected" | "expired" | "consumed";
type TxStatus  = "completed" | "pending" | "cancelled";

interface InventoryItem {
  id: string; name: string; sku: string;
  category: string; unit: string; price: number;
  stock: number; max: number; reorder: number;
  emoji: string;
}
interface MinibarUsage {
  item: string; qty: number; time: string; staff: string; movementType: MovementType;
}
interface Transaction {
  id: string; date: string; occurredAt: string; type: TxType; movementType: MovementType;
  item: string; qty: number; amount: number;
  staff: string; status: TxStatus; note?: string;
}
interface PriceRequest {
  id: string; item: string; sku: string;
  currentPrice: number; newPrice: number;
  requestedBy: string; requestedAt: string;
  status: PriceStatus; reason?: string;
}

/* ══════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════ */
const fmtVNDFull = formatVnd;

const stockStatus = (item: InventoryItem): StockStatus => {
  if (item.stock === 0) return "out-of-stock";
  if (item.stock < item.reorder) return "low-stock";
  return "in-stock";
};
const stockPct = (item: InventoryItem) => Math.round((item.stock / item.max) * 100);

const STATUS_CFG: Record<StockStatus, { label: string; bg: string; text: string; dot: string }> = {
  "in-stock":    { label:"Còn hàng",     bg:"#DCFCE7",text:"#166534",dot:"#16A34A" },
  "low-stock":   { label:"Sắp hết",    bg:"#FFE4E6",text:"#BE123C",dot:"#EF4444" },
  "out-of-stock":{ label:"Hết hàng", bg:"#F1F5F9",text:"#475569",dot:"#94A3B8" },
};

const CATEGORY_LABEL: Record<string,string> = {
  "Minibar Beverage":"Đồ uống minibar", "Minibar Snack":"Đồ ăn nhẹ minibar",
  "Kitchen Dry":"Nguyên liệu khô", "Kitchen Fresh":"Nguyên liệu tươi",
  "fine-dining":"Nhà hàng", transport:"Vận chuyển", spa:"Spa",
  inroom:"Dịch vụ tại phòng", recreation:"Giải trí", business:"Dịch vụ doanh nghiệp", other:"Khác",
};
const UNIT_LABEL: Record<string,string> = { Can:"lon", Bottle:"chai", Box:"hộp", Pack:"gói", Kg:"kg", Pcs:"cái", Liter:"lít", Block:"khối" };

const CAT_COLORS: Record<string, { bg: string; text: string }> = {
  "Minibar Beverage": { bg:"#DBEAFE",text:"#1D4ED8" },
  "Minibar Snack":    { bg:"#FEF9C3",text:"#92400E" },
  "Kitchen Dry":      { bg:"#FEF3C7",text:"#78350F" },
  "Kitchen Fresh":    { bg:"#DCFCE7",text:"#166534" },
};

const STATUS_OPTIONS = [["All Status","Tất cả trạng thái"],["In Stock","Còn hàng"],["Low Stock","Sắp hết"],["Out of Stock","Hết hàng"]] as const;

/* ══════════════════════════════════════════════════════════
   STOCK BAR
══════════════════════════════════════════════════════════ */
function StockBar({ item }: { item: InventoryItem }) {
  const pct  = stockPct(item);
  const clr  = pct > 50 ? "#16A34A" : pct > 25 ? "#F59E0B" : "#EF4444";
  return (
    <div style={{ minWidth:120 }}>
      <p style={{ fontSize:12,fontWeight:700,color:"#0F172A",marginBottom:3 }}>{item.stock} / {item.max}</p>
      <div style={{ height:6,background:"#E2E8F0",borderRadius:99,overflow:"hidden" }}>
        <div style={{ height:"100%",width:`${pct}%`,borderRadius:99,background:clr }} />
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   KPI BAR
══════════════════════════════════════════════════════════ */
function KpiBar({ items, transactions, priceRequests }: { items: InventoryItem[]; transactions: Transaction[]; priceRequests: PriceRequest[] }) {
  const lowStock = items.filter(item => stockStatus(item) === "low-stock" || stockStatus(item) === "out-of-stock").length;
  const today = localDateValue();
  const consumedToday = transactions.filter(transaction => transaction.movementType === "ISSUE" && localDateValue(new Date(transaction.occurredAt)) === today)
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const pendingRequests = priceRequests.filter(request => request.status === "pending").length;
  return (
    <div style={{ display:"flex",gap:16,padding:"16px 24px",background:"#F8FAFC",flexShrink:0,
      borderBottom:"1px solid #E2E8F0" }}>
      {[
        { label:"Tổng mặt hàng",   val:String(items.length),       sub:"Theo danh mục dịch vụ", up:false,  iconBg:"#DCFCE7",iconColor:"#16A34A",Icon:Package },
        { label:"Cảnh báo sắp hết",val:`${lowStock} món`,     sub:"Theo ngưỡng tồn kho",up:false, iconBg:"#FEF3C7",iconColor:"#F59E0B",Icon:AlertTriangle },
        { label:"Tiêu thụ hôm nay",val:fmtVNDFull(consumedToday),sub:"Theo phiếu xuất kho đã ghi nhận", up:false,  iconBg:"#DCFCE7",iconColor:"#16A34A",Icon:ShoppingCart },
        { label:"Chờ cấp phát",    val:String(pendingRequests),         sub:"Đề xuất giá đang chờ duyệt",   up:false, iconBg:"#FFE4E6",iconColor:"#DC2626",Icon:FileText },
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
            <div style={{ display:"flex",alignItems:"center",gap:3 }}>
              {k.up && <ArrowUpRight size={11} style={{ color:"#16A34A" }} />}
              <span style={{ fontSize:11,color:k.up?"#16A34A":"#94A3B8",fontWeight:k.up?600:400 }}>{k.sub}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   RIGHT MINIBAR PANEL
══════════════════════════════════════════════════════════ */
function MinibarPanel({ usage = [], onSeeAll }: { usage?: MinibarUsage[]; onSeeAll: () => void }) {
  return (
    <div style={{ width:310,flexShrink:0,background:"#FFF",borderLeft:"1px solid #E2E8F0",
      display:"flex",flexDirection:"column",overflow:"hidden" }}>
      {/* Header */}
      <div style={{ padding:"14px 16px",borderBottom:"1px solid #F1F5F9" }}>
        <div style={{ display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:2 }}>
          <p style={{ fontSize:13,fontWeight:700,color:"#0F172A" }}>Biến động tồn kho gần đây</p>
          <button onClick={onSeeAll} style={{ fontSize:11,fontWeight:600,color:"#2563EB",cursor:"pointer",whiteSpace:"nowrap" }}>
            Xem tất cả →
          </button>
        </div>
        <p style={{ fontSize:11,color:"#94A3B8" }}>Đọc từ sổ biến động backend; không gán phòng nếu phiếu không có dữ liệu phòng.</p>
      </div>

      {/* Table header */}
      <div style={{ display:"grid",gridTemplateColumns:"1fr 54px 32px 45px",
        gap:4,padding:"7px 16px",background:"#F8FAFC",borderBottom:"1px solid #F1F5F9" }}>
        {["Mặt hàng","Phiếu","SL","NV"].map(h => (
          <span key={h} style={{ fontSize:10,fontWeight:700,color:"#64748B",
            textTransform:"uppercase",letterSpacing:"0.05em" }}>{h}</span>
        ))}
      </div>

      {/* Rows */}
      <div style={{ flex:1,overflowY:"auto" }}>
        {usage.map((u, i) => (
          <div key={i} style={{ display:"grid",gridTemplateColumns:"1fr 54px 32px 45px",
            gap:4,padding:"9px 16px",borderBottom:"1px solid #F8FAFC",alignItems:"center" }} title={`${u.time} · ${u.staff}`}>
            <div style={{minWidth:0}}><span style={{ display:"block",fontSize:11,color:"#334155",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{u.item}</span><span style={{fontSize:10,color:"#94A3B8"}}>{u.time}</span></div>
            <span style={{fontSize:9,fontWeight:700,color:u.movementType==="ISSUE"?"#1D4ED8":u.movementType==="WASTE"?"#BE123C":"#475569"}}>{u.movementType}</span>
            <span style={{ fontSize:12,fontWeight:700,color:u.qty<0?"#DC2626":"#166534" }}>{u.qty>0?"+":""}{u.qty}</span>
            <span style={{fontSize:10,color:"#64748B",overflow:"hidden",textOverflow:"ellipsis"}}>{u.staff}</span>
          </div>
        ))}
        {usage.length === 0 && <p style={{padding:18,textAlign:"center",fontSize:11,color:"#94A3B8"}}>Chưa có biến động kho.</p>}
      </div>

      {/* Role boundary */}
      <div style={{ padding:"12px 16px",borderTop:"1px solid #E2E8F0",
        display:"flex",alignItems:"flex-start",gap:8 }}>
        <CheckSquare size={16} style={{ color:"#2563EB",flexShrink:0,marginTop:2 }} />
        <div style={{ flex:1 }}>
          <p style={{ fontSize:12,fontWeight:700,color:"#0F172A",marginBottom:2 }}>Phân tách đúng nghiệp vụ</p>
          <p style={{ fontSize:10,color:"#94A3B8",lineHeight:1.4 }}>Bếp quản lý tồn kho; Lễ tân ghi nhận khoản minibar vào tài khoản lưu trú của khách.</p>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   PRICE REQUEST MODAL (SẾP / QUẢN LÝ PHÊ DUYỆT)
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
            <div style={{ fontSize:28,width:44,height:44,borderRadius:10,background:"#FFF",
              border:"1px solid #E2E8F0",display:"flex",alignItems:"center",justifyContent:"center" }}>
              {item.emoji}
            </div>
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
                  {item.price.toLocaleString("vi-VN")}
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
              <strong>Quy chuẩn phân quyền (RBAC):</strong> Nhân viên Bếp &amp; Minibar chỉ có thẩm quyền lập đề xuất đổi giá. Giá mới sẽ được chuyển tới <strong>Trung tâm Phê duyệt của Quản lý / Giám đốc</strong> và chỉ có hiệu lực sau khi Sếp phê duyệt.
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
  ["ISSUE", "Xuất sử dụng / cấp phát"],
  ["WASTE", "Hao hụt / hủy"],
  ["RETURN", "Trả lại kho"],
  ["ADJUST", "Điều chỉnh kiểm kê (+ / −)"],
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
  const [reason, setReason] = useState(initialReason || "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const selected = items.find(item => item.id === serviceId);

  const submit = async () => {
    const parsedQuantity = Number(quantity);
    if (!serviceId || !selected) { setError("Chọn mặt hàng cần ghi nhận."); return; }
    if (!Number.isSafeInteger(parsedQuantity) || parsedQuantity === 0 || (type !== "ADJUST" && parsedQuantity < 1)) {
      setError(type === "ADJUST" ? "Số điều chỉnh phải là số nguyên khác 0; nhập âm nếu giảm tồn." : "Số lượng phải là số nguyên lớn hơn 0.");
      return;
    }
    if (!reason.trim()) { setError("Nhập lý do để lưu dấu vết kiểm soát kho."); return; }
    setSaving(true);
    setError("");
    try {
      await onSubmit(serviceId, type, parsedQuantity, reason.trim());
      onClose();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không thể lưu phiếu kho.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !saving) onClose(); }} style={{ position:"fixed",inset:0,zIndex:120,background:"rgba(15,23,42,.48)",display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}>
      <section role="dialog" aria-modal="true" aria-labelledby="inventory-movement-title" style={{ width:"100%",maxWidth:480,maxHeight:"90vh",overflowY:"auto",background:"#FFF",borderRadius:14,border:"1px solid #E2E8F0",boxShadow:"0 20px 60px rgba(15,23,42,.24)" }}>
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,padding:"16px 18px",borderBottom:"1px solid #E2E8F0" }}>
          <div><h3 id="inventory-movement-title" style={{ margin:0,fontSize:16,fontWeight:800,color:"#0F172A" }}>Ghi nhận phiếu kho</h3><p style={{ margin:"4px 0 0",fontSize:11,color:"#64748B" }}>Phiếu sẽ cập nhật tồn và lưu người thao tác, thời điểm, lý do.</p></div>
          <button type="button" aria-label="Đóng" disabled={saving} onClick={onClose} style={{ width:30,height:30,borderRadius:8,border:"1px solid #E2E8F0",background:"#F8FAFC",color:"#64748B",cursor:"pointer" }}><X size={14} /></button>
        </div>
        <div style={{ display:"grid",gap:13,padding:18 }}>
          <label style={{ display:"grid",gap:5,fontSize:11,fontWeight:700,color:"#334155" }}>Mặt hàng
            <select value={serviceId} onChange={event => setServiceId(event.target.value)} disabled={saving || Boolean(initialServiceId)} style={{ height:38,padding:"0 10px",border:"1px solid #CBD5E1",borderRadius:8,background:"#FFF",fontSize:12 }}>
              {items.map(item => <option key={item.id} value={item.id}>{item.name} ({item.id}) · tồn {item.stock} {UNIT_LABEL[item.unit] ?? item.unit}</option>)}
            </select>
          </label>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
            <label style={{ display:"grid",gap:5,fontSize:11,fontWeight:700,color:"#334155" }}>Loại phiếu
              <select value={type} onChange={event => setType(event.target.value as MovementType)} disabled={saving} style={{ height:38,padding:"0 10px",border:"1px solid #CBD5E1",borderRadius:8,background:"#FFF",fontSize:12 }}>
                {MOVEMENT_OPTIONS.map(([value,label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label style={{ display:"grid",gap:5,fontSize:11,fontWeight:700,color:"#334155" }}>Số lượng {type === "ADJUST" ? "(âm hoặc dương)" : ""}
              <input type="number" step="1" value={quantity} onChange={event => setQuantity(event.target.value)} disabled={saving} style={{ height:38,padding:"0 10px",border:"1px solid #CBD5E1",borderRadius:8,fontSize:13 }} />
            </label>
          </div>
          {selected && <div style={{ padding:"9px 11px",borderRadius:8,background:"#F8FAFC",fontSize:11,color:"#475569" }}>Tồn hiện tại: <strong>{selected.stock} {UNIT_LABEL[selected.unit] ?? selected.unit}</strong> · ngưỡng an toàn: {selected.reorder}</div>}
          <label style={{ display:"grid",gap:5,fontSize:11,fontWeight:700,color:"#334155" }}>Lý do / nơi nhận
            <textarea value={reason} maxLength={500} rows={3} onChange={event => setReason(event.target.value)} disabled={saving} placeholder="Ví dụ: Cấp cho buồng phòng – phòng 502" style={{ resize:"vertical",padding:"9px 10px",border:"1px solid #CBD5E1",borderRadius:8,fontSize:12 }} />
          </label>
          {error && <div role="alert" style={{ padding:"9px 11px",borderRadius:8,background:"#FFF1F2",border:"1px solid #FECDD3",color:"#BE123C",fontSize:12 }}>{error}</div>}
        </div>
        <div style={{ display:"flex",justifyContent:"flex-end",gap:8,padding:"12px 18px",borderTop:"1px solid #E2E8F0",background:"#F8FAFC" }}>
          <button type="button" disabled={saving} onClick={onClose} style={{ height:36,padding:"0 13px",border:"1px solid #CBD5E1",borderRadius:8,background:"#FFF",color:"#475569",fontSize:12,cursor:"pointer" }}>Hủy</button>
          <button type="button" disabled={saving || items.length === 0} onClick={() => void submit()} style={{ height:36,padding:"0 15px",border:0,borderRadius:8,background:saving?"#64748B":"#0F172A",color:"#FFF",fontSize:12,fontWeight:700,cursor:saving?"wait":"pointer" }}>{saving ? "Đang lưu…" : "Lưu phiếu kho"}</button>
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
  onSeeAll,
  searchQuery,
  loading,
  usage = [],
  items = [],
  requesterName,
}: {
  priceRequests: PriceRequest[];
  onAddPriceRequest: (req: PriceRequest) => Promise<void>;
  onOpenMovement: (serviceId: string | undefined, type: MovementType, reason?: string) => void;
  onSeeAll: () => void;
  searchQuery: string;
  loading: boolean;
  usage?: MinibarUsage[];
  items?: InventoryItem[];
  requesterName?: string;
}) {
  const [search, setSearch]  = useState("");
  const [cat, setCat]        = useState("All Categories");
  const [status, setStatus]  = useState("All Status");
  const [page, setPage]      = useState(1);
  const [modalItem, setModalItem] = useState<InventoryItem|null>(null);
  const [toastMessage, setToastMessage] = useState<string|null>(null);
  const PER_PAGE = 10;
  const categoryOptions = useMemo<[string,string][]>(() => [
      ["All Categories", "Tất cả danh mục"],
    ...[...new Set(items.map(item => item.category))]
      .sort((left, right) => (CATEGORY_LABEL[left] ?? left).localeCompare(CATEGORY_LABEL[right] ?? right, "vi"))
      .map(category => [category, CATEGORY_LABEL[category] ?? category] as [string, string]),
  ], [items]);

  const filtered = useMemo(() => {
    let rs = items;
    if (cat !== "All Categories") rs = rs.filter(i => i.category === cat);
    if (status === "Low Stock")   rs = rs.filter(i => stockStatus(i) === "low-stock");
    if (status === "In Stock")    rs = rs.filter(i => stockStatus(i) === "in-stock");
    if (status === "Out of Stock") rs = rs.filter(i => stockStatus(i) === "out-of-stock");
    if (search.trim() || searchQuery.trim()) {
      const q = (searchQuery.trim() || search.trim()).toLowerCase();
      rs = rs.filter(i => i.name.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q) || i.category.toLowerCase().includes(q));
    }
    return rs;
  }, [search, searchQuery, cat, status, items]);

  const totalPages = Math.ceil(filtered.length / PER_PAGE) || 1;
  const pageItems  = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <div style={{ flex:1,display:"flex",overflow:"hidden" }}>
      {/* Table area */}
      <div style={{ flex:1,overflowY:"auto",padding:"18px 22px",minWidth:0 }}>

        {/* Section heading */}
        <div style={{ marginBottom:14 }}>
          <h2 style={{ fontSize:16,fontWeight:700,color:"#0F172A",marginBottom:2 }}>Danh mục tồn kho</h2>
          <p style={{ fontSize:12,color:"#94A3B8" }}>Theo dõi vật tư bếp và mặt hàng minibar</p>
        </div>

        {/* Toolbar */}
        <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:14,flexWrap:"wrap" }}>
          {/* Search */}
          <div style={{ position:"relative",flex:1,minWidth:180 }}>
            <Search size={13} style={{ position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:"#94A3B8",pointerEvents:"none" }} />
            <input value={search} onChange={e=>{ setSearch(e.target.value); setPage(1); }}
              placeholder="Tìm mặt hàng..."
              style={{ width:"100%",height:34,paddingLeft:30,paddingRight:10,borderRadius:8,
                border:"1px solid #E2E8F0",background:"#F8FAFC",fontSize:12,outline:"none",boxSizing:"border-box" }} />
          </div>
          {/* Status filter */}
          <div style={{ position:"relative" }}>
            <select value={status} onChange={e=>{ setStatus(e.target.value); setPage(1); }}
              style={{ height:34,padding:"0 26px 0 10px",borderRadius:8,border:"1px solid #E2E8F0",
                background:"#F8FAFC",fontSize:12,outline:"none",cursor:"pointer",appearance:"none" }}>
              {STATUS_OPTIONS.map(([value,label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <ChevronDown size={11} style={{ position:"absolute",right:7,top:"50%",transform:"translateY(-50%)",color:"#94A3B8",pointerEvents:"none" }} />
          </div>
          {/* Buttons */}
          <button onClick={() => onOpenMovement(undefined,"RECEIVE")} style={{ height:34,padding:"0 14px",borderRadius:8,
            background:"#0F172A",color:"#FFF",fontSize:12,fontWeight:600,cursor:"pointer",
            display:"flex",alignItems:"center",gap:5 }}>
            <Plus size={13} /> Phiếu nhập kho
          </button>
          <button onClick={() => onOpenMovement(undefined,"ISSUE","Cấp cho buồng phòng — ghi rõ phòng nhận")} style={{ height:34,padding:"0 14px",borderRadius:8,border:"1px solid #E2E8F0",
            background:"#FFF",color:"#334155",fontSize:12,fontWeight:500,cursor:"pointer",
            display:"flex",alignItems:"center",gap:5 }}>
            <Plus size={13} /> Xuất cho Buồng phòng
          </button>
        </div>

        {/* Category filter pills */}
        <div style={{ display:"flex",gap:6,marginBottom:14,flexWrap:"wrap" }}>
          {categoryOptions.map(([value,label]) => {
            const active = cat === value;
            return (
              <button key={value} onClick={() => { setCat(value); setPage(1); }}
                style={{ padding:"5px 12px",borderRadius:99,fontSize:12,cursor:"pointer",
                  fontWeight:active?600:400,border:`1px solid ${active?"#0F172A":"#E2E8F0"}`,
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
                {["Tên mặt hàng","Phân loại","Đơn vị","Giá niêm yết","Tồn kho hiện tại","Ngưỡng an toàn","Trạng thái","Hành động"].map(h => (
                  <th key={h} style={{ padding:"9px 12px",fontSize:11,fontWeight:700,color:"#64748B",
                    textAlign:"left",whiteSpace:"nowrap",letterSpacing:"0.04em",
                    borderBottom:"1px solid #E2E8F0",textTransform:"uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageItems.map((item, i) => {
                const st   = stockStatus(item);
                const cfg  = STATUS_CFG[st];
                const catC = CAT_COLORS[item.category] ?? { bg:"#F8FAFC",text:"#475569" };
                const pendingReq = priceRequests.find(pr => (pr.sku === item.sku || pr.item.toLowerCase() === item.name.toLowerCase()) && pr.status === "pending");
                return (
                  <tr key={item.id} style={{ borderBottom:i<pageItems.length-1?"1px solid #F8FAFC":"none",
                    background:i%2===0?"#FFF":"#FAFAFA" }}>
                    {/* Tên mặt hàng */}
                    <td style={{ padding:"9px 12px" }}>
                      <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                        <div style={{ width:38,height:38,borderRadius:8,flexShrink:0,
                          background:catC.bg,display:"flex",alignItems:"center",justifyContent:"center",
                          fontSize:20 }}>{item.emoji}</div>
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
                    <td style={{ padding:"9px 12px",minWidth:130 }}><StockBar item={item} /></td>
                    {/* Ngưỡng an toàn */}
                    <td style={{ padding:"9px 12px",fontSize:12,color:"#64748B" }}>{item.reorder}</td>
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
                        <button onClick={() => onOpenMovement(item.id,"RECEIVE")} style={{ fontSize:11,fontWeight:600,padding:"4px 10px",borderRadius:6,
                          border:"none",background:"#0F172A",color:"#FFF",cursor:"pointer",
                          display:"flex",alignItems:"center",gap:3 }}>
                          <Plus size={11} /> Nhập
                        </button>
                        {pendingReq ? (
                          <button onClick={() => setModalItem(item)}
                            title="Đang có đề xuất đổi giá chờ Sếp/Quản lý duyệt"
                            style={{ fontSize:11,fontWeight:600,padding:"4px 8px",borderRadius:6,
                              border:"1px solid #FCD34D",background:"#FEF3C7",color:"#92400E",cursor:"pointer",
                              display:"flex",alignItems:"center",gap:3,whiteSpace:"nowrap" }}>
                            <Clock size={11} /> Chờ sếp duyệt
                          </button>
                        ) : (
                          <button onClick={() => setModalItem(item)}
                            title="Lập đề xuất thay đổi giá niêm yết gửi Quản lý phê duyệt"
                            style={{ fontSize:11,fontWeight:600,padding:"4px 10px",borderRadius:6,
                              border:"1px solid #E2E8F0",background:"#FFF",color:"#334155",cursor:"pointer",
                              display:"flex",alignItems:"center",gap:3,whiteSpace:"nowrap" }}>
                            <Tag size={11} style={{ color:"#64748B" }} /> Đổi giá
                          </button>
                        )}
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

      {/* Right minibar panel */}
      <MinibarPanel usage={usage} onSeeAll={onSeeAll} />

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
              requestedBy: requesterName || "Bộ phận Bếp",
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
function TransactionsScreen({ transactions = [], onOpenMovement, searchQuery }: { transactions?: Transaction[]; onOpenMovement: (type: MovementType, reason?: string) => void; searchQuery: string }) {
  const [txTab, setTxTab] = useState<"all"|TxType>("all");
  const filtered = transactions.filter(t => (txTab === "all" || t.type === txTab)
    && (!searchQuery.trim() || `${t.item} ${t.note ?? ""} ${t.staff}`.toLowerCase().includes(searchQuery.trim().toLowerCase())));

  return (
    <div style={{ flex:1,overflowY:"auto",padding:"20px 24px",background:"#F8FAFC" }}>
      <div style={{ display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:16 }}>
        <div>
          <h2 style={{ fontSize:18,fontWeight:700,color:"#0F172A",marginBottom:2 }}>Nhập – Xuất kho</h2>
          <p style={{ fontSize:12,color:"#94A3B8" }}>Lịch sử nhập xuất và quản lý phiếu kho</p>
        </div>
        <div style={{ display:"flex",gap:8 }}>
          <button onClick={() => onOpenMovement("RECEIVE")} style={{ height:34,padding:"0 14px",borderRadius:8,border:"1px solid #E2E8F0",
            background:"#FFF",color:"#475569",fontSize:12,cursor:"pointer",
            display:"flex",alignItems:"center",gap:5 }}>
            <Upload size={12} /> Tạo phiếu nhập
          </button>
          <button onClick={() => onOpenMovement("ISSUE")} style={{ height:34,padding:"0 14px",borderRadius:8,
            background:"#0F172A",color:"#FFF",fontSize:12,fontWeight:600,cursor:"pointer",
            display:"flex",alignItems:"center",gap:5 }}>
            <ArrowDownRight size={12} /> Tạo phiếu xuất
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:"flex",borderBottom:"2px solid #E2E8F0",marginBottom:16 }}>
        {([["all","Tất cả"],["import","Nhập kho"],["export","Xuất kho"],["waste","Hao hụt"],["adjustment","Điều chỉnh"]] as [string,string][]).map(([v,l]) => {
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
  requesterName,
  searchQuery,
}: {
  requests: PriceRequest[];
  items: InventoryItem[];
  onAddPriceRequest: (req: PriceRequest) => Promise<void>;
  requesterName?: string;
  searchQuery: string;
}) {
  const [priceStatus, setPriceStatus] = useState<"all"|PriceStatus>("all");
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState({ serviceId:items[0]?.id ?? "", newPrice:"", reason:"" });
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!draft.serviceId && items.length > 0) {
      setDraft(value => ({ ...value, serviceId: items[0].id }));
    }
  }, [draft.serviceId, items]);
  const selectedItem = items.find(item => item.id === draft.serviceId);
  const filtered = requests.filter(request => (priceStatus === "all" || request.status === priceStatus)
    && (!searchQuery.trim() || `${request.item} ${request.sku} ${request.reason ?? ""}`.toLowerCase().includes(searchQuery.trim().toLowerCase())));
  const submitRequest = async () => {
    const newPrice = Number(draft.newPrice);
    if (!selectedItem) { setFormError("Chọn một dịch vụ đang có trong danh mục."); return; }
    if (!Number.isFinite(newPrice) || newPrice <= 0 || newPrice === selectedItem.price) { setFormError("Giá mới phải là số dương và khác giá hiện tại."); return; }
    if (!draft.reason.trim()) { setFormError("Nhập lý do để quản lý xem xét."); return; }
    setSaving(true);
    setFormError("");
    try {
      await onAddPriceRequest({
        id:`new-${Date.now()}`, item:selectedItem.name, sku:selectedItem.id,
        currentPrice:selectedItem.price, newPrice,
        requestedBy:requesterName || "Bộ phận Bếp", requestedAt:new Date().toLocaleString("vi-VN"), status:"pending", reason:draft.reason.trim(),
      });
      setDraft(value => ({ ...value, newPrice:"", reason:"" }));
      setShowForm(false);
      setPriceStatus("all");
    } catch (requestError) {
      setFormError(requestError instanceof Error ? requestError.message : "Không thể gửi đề xuất giá.");
    } finally {
      setSaving(false);
    }
  };

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
          <h2 style={{ fontSize:18,fontWeight:700,color:"#0F172A",marginBottom:2 }}>Đề xuất giá dịch vụ</h2>
          <p style={{ fontSize:12,color:"#94A3B8" }}>Bếp tạo đề xuất; Quản lý là người phê duyệt và kích hoạt giá mới</p>
        </div>
        <button onClick={() => { setShowForm(open => !open); setFormError(""); }} style={{ height:34,padding:"0 14px",borderRadius:8,
          background:"#0F172A",color:"#FFF",fontSize:12,fontWeight:600,cursor:"pointer",
          display:"flex",alignItems:"center",gap:5 }}>
          <Plus size={14} /> Tạo yêu cầu
        </button>
      </div>

      {showForm && (
        <div style={{background:"#FFF",border:"1px solid #E2E8F0",borderRadius:12,padding:14,marginBottom:16}}>
          <div style={{display:"grid",gridTemplateColumns:"1.2fr .8fr 1.5fr auto",gap:8,alignItems:"end"}}>
            <label style={{display:"flex",flexDirection:"column",gap:5,fontSize:10,fontWeight:700,color:"#64748B"}}>Dịch vụ
              <select value={draft.serviceId} onChange={event=>setDraft(value=>({...value,serviceId:event.target.value}))} style={{height:34,border:"1px solid #E2E8F0",borderRadius:8,padding:"0 10px",fontSize:11,background:"#FFF"}}>
                {items.map(item=><option key={item.id} value={item.id}>{item.name} ({item.id})</option>)}
              </select>
            </label>
            <label style={{display:"flex",flexDirection:"column",gap:5,fontSize:10,fontWeight:700,color:"#64748B"}}>Giá mới · giá hiện tại {selectedItem ? formatVnd(selectedItem.price) : "—"}
              <input type="number" min="1" step="1" value={draft.newPrice} onChange={event=>setDraft(value=>({...value,newPrice:event.target.value}))} placeholder="VND" style={{height:34,border:"1px solid #E2E8F0",borderRadius:8,padding:"0 10px",fontSize:11,outline:"none"}} />
            </label>
            <label style={{display:"flex",flexDirection:"column",gap:5,fontSize:10,fontWeight:700,color:"#64748B"}}>Lý do
              <input value={draft.reason} onChange={event=>setDraft(value=>({...value,reason:event.target.value}))} placeholder="Nêu rõ lý do thay đổi" style={{height:34,border:"1px solid #E2E8F0",borderRadius:8,padding:"0 10px",fontSize:11,outline:"none"}} />
            </label>
            <button onClick={() => void submitRequest()} disabled={saving || !items.length} style={{height:34,padding:"0 14px",borderRadius:8,border:"none",background:saving?"#64748B":"#0F172A",color:"#FFF",fontSize:11,fontWeight:700,cursor:saving?"wait":"pointer"}}>{saving?"Đang gửi…":"Gửi quản lý"}</button>
          </div>
          {formError && <div role="alert" style={{marginTop:10,padding:"8px 10px",borderRadius:8,background:"#FFF1F2",border:"1px solid #FECDD3",color:"#BE123C",fontSize:11}}>{formError}</div>}
        </div>
      )}

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
              {["Mặt hàng","SKU","Giá hiện tại","Giá đề xuất","Thay đổi","Yêu cầu bởi","Trạng thái","Thao tác"].map(h => (
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
                  <td style={{ padding:"11px 14px",fontSize:12,color:"#475569" }}>{pr.currentPrice.toLocaleString("vi-VN")}</td>
                  <td style={{ padding:"11px 14px",fontSize:12,fontWeight:700,color:"#0F172A" }}>{pr.newPrice.toLocaleString("vi-VN")}</td>
                  <td style={{ padding:"11px 14px" }}>
                    <span style={{ fontSize:12,fontWeight:700,color:up?"#16A34A":"#DC2626" }}>
                      {up?"+":""}{deltaPct}%
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
                    <span style={{fontSize:11,fontWeight:600,color:pr.status==="pending"?"#D97706":"#2563EB"}}>
                      {pr.status==="pending"?"Đã gửi Quản lý":"Xem kết quả"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   REPORTS SCREEN
══════════════════════════════════════════════════════════ */
function ReportsScreen({ items, transactions }: { items: InventoryItem[]; transactions: Transaction[] }) {
  const [selectedDate, setSelectedDate] = useState(() => localDateValue());
  const issueTransactions = transactions.filter(transaction => transaction.movementType === "ISSUE");
  const selectedDayTransactions = issueTransactions.filter(transaction => localDateValue(new Date(transaction.occurredAt)) === selectedDate);
  const selectedDayStart = new Date(`${selectedDate}T00:00:00`);
  const weekStart = new Date(selectedDayStart);
  weekStart.setDate(weekStart.getDate() - 6);
  const exported = selectedDayTransactions;
  const itemBySku = new Map(items.map(item => [item.sku, item]));
  const categoryTotals = new Map<string, number>();
  exported.forEach(transaction => {
    const sku = transaction.item.match(/\(([^)]+)\)$/)?.[1] ?? transaction.item;
    const category = itemBySku.get(sku)?.category ?? "Khác";
    categoryTotals.set(category, (categoryTotals.get(category) ?? 0) + transaction.amount);
  });
  const totalConsumption = exported.reduce((sum, transaction) => sum + transaction.amount, 0);
  const catConsumption = [...categoryTotals.entries()].map(([cat, val]) => ({
    cat, val, pct: totalConsumption > 0 ? Math.round((val / totalConsumption) * 100) : 0,
  }));
  const itemTotals = new Map<string, { name: string; sku: string; qty: number; revenue: number }>();
  exported.forEach(transaction => {
    const sku = transaction.item.match(/\(([^)]+)\)$/)?.[1] ?? transaction.item;
    const item = itemBySku.get(sku);
    const current = itemTotals.get(sku) ?? { name: item?.name ?? transaction.item, sku, qty: 0, revenue: 0 };
    itemTotals.set(sku, { ...current, qty: current.qty + Math.abs(transaction.qty), revenue: current.revenue + transaction.amount });
  });
  const topItems = [...itemTotals.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  const trendData = Array.from({ length:7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + index);
    const dateKey = localDateValue(date);
    return {
      day: date.toLocaleDateString("vi-VN", { day:"2-digit", month:"2-digit" }),
      value: issueTransactions.filter(transaction => localDateValue(new Date(transaction.occurredAt)) === dateKey)
        .reduce((sum, transaction) => sum + transaction.amount, 0),
    };
  });
  const maxTrend = Math.max(...trendData.map(item => item.value), 1);
  const average7Days = trendData.reduce((sum, day) => sum + day.value, 0) / 7;

  const downloadReport = () => {
    const cells = (value: string | number) => {
      const safe = String(value).replace(/^[=+@-]/, "'$&").replaceAll('"', '""');
      return `"${safe}"`;
    };
    const rows = [
      ["Ngày", "Mặt hàng", "Mã dịch vụ", "Loại biến động", "Số lượng", "Giá trị tham chiếu", "Nhân viên", "Lý do"],
      ...transactions.filter(transaction => localDateValue(new Date(transaction.occurredAt)) === selectedDate).map(transaction => [
        selectedDate, transaction.item.replace(/ \(([^)]+)\)$/, ""), transaction.item.match(/\(([^)]+)\)$/)?.[1] ?? "",
        transaction.movementType, transaction.qty, transaction.amount, transaction.staff, transaction.note ?? "",
      ]),
    ];
    const csv = `\uFEFF${rows.map(row => row.map(cells).join(",")).join("\r\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type:"text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `bao-cao-ton-kho-${selectedDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ flex:1,overflowY:"auto",padding:"20px 24px",background:"#F8FAFC" }}>
      <div style={{ display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:16 }}>
        <div>
          <h2 style={{ fontSize:18,fontWeight:700,color:"#0F172A",marginBottom:2 }}>Báo cáo tiêu thụ</h2>
          <p style={{ fontSize:12,color:"#94A3B8" }}>Phân tích xu hướng tiêu thụ theo danh mục và mặt hàng</p>
        </div>
        <div style={{ display:"flex",gap:8 }}>
          <label style={{ display:"flex",alignItems:"center",gap:6,padding:"6px 12px",borderRadius:8,
            border:"1px solid #E2E8F0",background:"#FFF",cursor:"pointer",fontSize:12,color:"#475569" }}>
            <Calendar size={12} style={{ color:"#94A3B8" }} />
            <input aria-label="Ngày báo cáo" type="date" value={selectedDate} onChange={event => setSelectedDate(event.target.value)} style={{ border:0,background:"transparent",fontSize:12,color:"#475569" }} />
          </label>
          <button onClick={downloadReport} style={{ height:34,padding:"0 14px",borderRadius:8,border:"1px solid #E2E8F0",
            background:"#FFF",color:"#475569",fontSize:12,cursor:"pointer",
            display:"flex",alignItems:"center",gap:5 }}>
            <Download size={12} /> Xuất báo cáo
          </button>
        </div>
      </div>

      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16 }}>
        <div style={{ background:"#FFF",borderRadius:12,border:"1px solid #E2E8F0",padding:"18px 20px" }}>
          <p style={{ fontSize:13,fontWeight:700,color:"#0F172A",marginBottom:14 }}>Tiêu thụ theo danh mục · {selectedDate}</p>
          <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
            {catConsumption.map(c => {
              const cfg = CAT_COLORS[c.cat] ?? { bg:"#F8FAFC",text:"#475569" };
              return (
                <div key={c.cat}>
                  <div style={{ display:"flex",justifyContent:"space-between",marginBottom:4 }}>
                    <span style={{ fontSize:12,color:"#334155",fontWeight:500 }}>{CATEGORY_LABEL[c.cat] ?? c.cat}</span>
                    <div style={{ display:"flex",gap:8 }}>
                      <span style={{ fontSize:12,color:"#64748B" }}>{c.pct}%</span>
                      <span style={{ fontSize:12,fontWeight:600,color:"#0F172A" }}>{fmtVNDFull(c.val)}</span>
                    </div>
                  </div>
                  <div style={{ height:8,background:"#F1F5F9",borderRadius:99,overflow:"hidden" }}>
                    <div style={{ height:"100%",width:`${c.pct}%`,borderRadius:99,background:cfg.text }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop:14,paddingTop:14,borderTop:"1px solid #F1F5F9",
            display:"flex",justifyContent:"space-between" }}>
            <span style={{ fontSize:12,color:"#64748B" }}>Tổng giá trị tham chiếu</span>
            <span style={{ fontSize:13,fontWeight:800,color:"#0F172A",fontFamily:"'JetBrains Mono',monospace" }}>
              {fmtVNDFull(totalConsumption)}
            </span>
          </div>
        </div>

        <div style={{ background:"#FFF",borderRadius:12,border:"1px solid #E2E8F0",padding:"18px 20px" }}>
          <p style={{ fontSize:13,fontWeight:700,color:"#0F172A",marginBottom:14 }}>Xu hướng 7 ngày đến ngày đã chọn</p>
          <div style={{ display:"flex",alignItems:"flex-end",gap:8,height:120 }}>
            {trendData.map((d, index) => (
              <div key={d.day} style={{ flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4 }}>
                <div style={{ width:"100%",borderRadius:"4px 4px 0 0",
                  background:index === trendData.length - 1?"#0F172A":"#E2E8F0",
                  height:`${Math.round((d.value / maxTrend) * 100)}%`,minHeight:4 }} />
                <span style={{ fontSize:10,color:index === trendData.length - 1?"#0F172A":"#94A3B8",
                  fontWeight:index === trendData.length - 1?700:400 }}>{d.day}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop:14,paddingTop:14,borderTop:"1px solid #F1F5F9",
            display:"flex",justifyContent:"space-between",alignItems:"center" }}>
            <span style={{ fontSize:12,color:"#64748B" }}>Trung bình / ngày</span>
            <span style={{ fontSize:13,fontWeight:700,color:"#64748B" }}>{fmtVNDFull(average7Days)}</span>
          </div>
        </div>
      </div>

      <div style={{ background:"#FFF",borderRadius:12,border:"1px solid #E2E8F0",overflowX:"auto",overflowY:"hidden" }}>
        <div style={{ padding:"14px 18px",borderBottom:"1px solid #F1F5F9",
          display:"flex",alignItems:"center",justifyContent:"space-between" }}>
          <p style={{ fontSize:13,fontWeight:700,color:"#0F172A" }}>Top mặt hàng xuất kho · {selectedDate}</p>
          <TrendingUp size={15} style={{ color:"#16A34A" }} />
        </div>
        <table style={{ width:"100%",minWidth:620,borderCollapse:"collapse" }}>
          <thead>
            <tr style={{ background:"#F8FAFC" }}>
              {["#","Mặt hàng","SKU","Số lượng","Giá trị tham chiếu"].map(h => (
                <th key={h} style={{ padding:"9px 14px",fontSize:11,fontWeight:700,color:"#64748B",
                  textAlign:"left",letterSpacing:"0.04em",textTransform:"uppercase" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {topItems.map((item, i) => {
              return (
                <tr key={item.sku} style={{ borderTop:"1px solid #F1F5F9",background:i%2===0?"#FFF":"#FAFAFA" }}>
                  <td style={{ padding:"10px 14px",fontSize:13,fontWeight:700,color:"#94A3B8" }}>#{i+1}</td>
                  <td style={{ padding:"10px 14px",fontSize:13,fontWeight:600,color:"#0F172A" }}>{item.name}</td>
                  <td style={{ padding:"10px 14px",fontSize:11,color:"#94A3B8",fontFamily:"'JetBrains Mono',monospace" }}>{item.sku}</td>
                  <td style={{ padding:"10px 14px",fontSize:12,fontWeight:600,color:"#0F172A" }}>{item.qty}</td>
                  <td style={{ padding:"10px 14px",fontSize:12,fontWeight:700,color:"#0F172A" }}>{fmtVNDFull(item.revenue)}</td>
                </tr>
              );
            })}
            {topItems.length === 0 && <tr><td colSpan={5} style={{padding:28,textAlign:"center",fontSize:12,color:"#64748B"}}>Không có phiếu xuất sử dụng trong ngày đã chọn.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════ */
function RestaurantScreen({ bookings, date, loading, error, busyId, searchQuery, onDateChange, onRefresh, onMarkUsed }: {
  bookings: RestaurantBooking[];
  date: string;
  loading: boolean;
  error: string | null;
  busyId: number | null;
  searchQuery: string;
  onDateChange: (date: string) => void;
  onRefresh: () => void;
  onMarkUsed: (booking: RestaurantBooking) => void;
}) {
  const visibleBookings = bookings.filter(booking => !searchQuery.trim()
    || `${booking.room_id} ${booking.reservation_id} ${booking.service_name} ${booking.note ?? ""}`.toLowerCase().includes(searchQuery.trim().toLowerCase()));
  const confirmed = visibleBookings.filter(booking => booking.status === "CONFIRMED").length;
  const used = visibleBookings.filter(booking => booking.status === "USED").length;
  const cancelled = visibleBookings.filter(booking => booking.status === "CANCELLED").length;
  const mealLabel = (value: string | null) => value === "LUNCH" ? "Bữa trưa" : value === "DINNER" ? "Bữa tối" : "Dịch vụ ăn uống";
  return (
    <div style={{ flex:1,overflowY:"auto",padding:"20px 24px",background:"#F8FAFC" }}>
      <div style={{ display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:16,marginBottom:18,flexWrap:"wrap" }}>
        <div><p style={{ fontSize:11,color:"#D97706",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em" }}>Vận hành F&amp;B</p><h2 style={{ fontSize:22,fontWeight:800,color:"#0F172A",marginTop:3 }}>Điều phối nhà hàng</h2><p style={{ fontSize:12,color:"#64748B",marginTop:3 }}>Đơn ăn do khách đặt được lấy trực tiếp từ backend. Xác nhận phục vụ sẽ trừ tồn và ghi nhận vào hóa đơn.</p></div>
        <div style={{ display:"flex",gap:8,alignItems:"center" }}><input type="date" value={date} onChange={event => onDateChange(event.target.value)} style={{ height:36,border:"1px solid #CBD5E1",borderRadius:8,padding:"0 10px",fontSize:12,background:"#FFF" }} /><button onClick={onRefresh} disabled={loading} style={{ height:36,padding:"0 13px",display:"flex",alignItems:"center",gap:6,border:"1px solid #CBD5E1",borderRadius:8,background:"#FFF",fontSize:12,fontWeight:600,cursor:loading?"wait":"pointer" }}><RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Làm mới</button></div>
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:12,marginBottom:16 }}>
        {[["Chờ phục vụ",confirmed,"#FEF3C7","#92400E"],["Đã phục vụ",used,"#DCFCE7","#166534"],["Đã hủy",cancelled,"#F1F5F9","#475569"]].map(([label,value,bg,color]) => <div key={String(label)} style={{ background:"#FFF",border:"1px solid #E2E8F0",borderRadius:12,padding:15 }}><p style={{ fontSize:11,color:"#64748B" }}>{label}</p><div style={{ display:"flex",alignItems:"center",gap:8,marginTop:6 }}><strong style={{ fontSize:24,color:String(color) }}>{value}</strong><span style={{ fontSize:10,fontWeight:700,color:String(color),background:String(bg),padding:"2px 7px",borderRadius:99 }}>đơn</span></div></div>)}
      </div>
      {error && <div role="alert" style={{ marginBottom:14,padding:"10px 12px",borderRadius:9,background:"#FFF1F2",border:"1px solid #FECDD3",color:"#BE123C",fontSize:12 }}>{error}</div>}
      <div style={{ background:"#FFF",border:"1px solid #E2E8F0",borderRadius:12,overflow:"hidden" }}>
        <div style={{ overflowX:"auto" }}><table style={{ width:"100%",borderCollapse:"collapse",minWidth:780 }}><thead><tr style={{ background:"#F8FAFC" }}>{["Giờ phục vụ","Phòng / Booking","Dịch vụ","Số lượng","Ghi chú","Trạng thái","Thao tác"].map(label => <th key={label} style={{ padding:"10px 13px",textAlign:"left",fontSize:10,fontWeight:700,color:"#64748B",textTransform:"uppercase",letterSpacing:"0.05em" }}>{label}</th>)}</tr></thead><tbody>
          {visibleBookings.map(booking => { const due = new Date(booking.scheduled_at).getTime() <= Date.now(); const canUse = booking.status === "CONFIRMED" && due; return <tr key={booking.id} style={{ borderTop:"1px solid #F1F5F9" }}><td style={{ padding:"12px 13px",fontSize:12,fontWeight:700,color:"#0F172A" }}>{new Date(booking.scheduled_at).toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit"})}<p style={{ marginTop:2,fontSize:10,color:"#64748B",fontWeight:500 }}>{mealLabel(booking.meal_period)}</p></td><td style={{ padding:"12px 13px",fontSize:12,color:"#334155" }}><strong>Phòng {booking.room_id}</strong><p style={{ marginTop:2,fontSize:10,color:"#94A3B8" }}>BK-{booking.reservation_id}</p></td><td style={{ padding:"12px 13px",fontSize:12,color:"#334155" }}>{booking.service_name}</td><td style={{ padding:"12px 13px",fontSize:13,fontWeight:700,color:"#0F172A" }}>{booking.quantity}<p style={{ marginTop:2,fontSize:10,color:"#64748B",fontWeight:400 }}>miễn phí {booking.free_quantity}</p></td><td style={{ padding:"12px 13px",fontSize:11,color:"#64748B",maxWidth:220 }}>{booking.note || "—"}</td><td style={{ padding:"12px 13px" }}><span style={{ fontSize:10,fontWeight:700,borderRadius:99,padding:"3px 8px",background:booking.status==="USED"?"#DCFCE7":booking.status==="CANCELLED"?"#F1F5F9":"#FEF3C7",color:booking.status==="USED"?"#166534":booking.status==="CANCELLED"?"#475569":"#92400E" }}>{booking.status === "USED" ? "Đã phục vụ" : booking.status === "CANCELLED" ? "Đã hủy" : "Đã xác nhận"}</span></td><td style={{ padding:"12px 13px" }}><button onClick={() => onMarkUsed(booking)} disabled={!canUse || busyId === booking.id} title={!due && booking.status === "CONFIRMED" ? "Chưa đến giờ phục vụ" : undefined} style={{ border:0,borderRadius:7,padding:"7px 10px",background:canUse?"#0F172A":"#E2E8F0",color:canUse?"#FFF":"#94A3B8",fontSize:11,fontWeight:700,cursor:canUse?"pointer":"not-allowed" }}>{busyId === booking.id ? "Đang lưu…" : booking.status === "USED" ? "Đã hoàn tất" : "Xác nhận phục vụ"}</button></td></tr>; })}
          {!loading && visibleBookings.length === 0 && <tr><td colSpan={7} style={{ padding:38,textAlign:"center",fontSize:12,color:"#64748B" }}>{bookings.length === 0 ? "Không có đơn nhà hàng trong ngày đã chọn." : "Không tìm thấy đơn nhà hàng khớp với từ khóa."}</td></tr>}
          {loading && <tr><td colSpan={7} style={{ padding:38,textAlign:"center",fontSize:12,color:"#64748B" }}>Đang tải đơn nhà hàng…</td></tr>}
        </tbody></table></div>
      </div>
    </div>
  );
}

const NAV: { id: NavPage; label: string; Icon: React.ElementType }[] = [
  { id:"restaurant",   label:"Điều phối nhà hàng",  Icon:Utensils },
  { id:"inventory",    label:"Kho & Minibar",       Icon:Package },
  { id:"transactions", label:"Nhập – Xuất kho",     Icon:ArrowLeftRight },
  { id:"pricing",      label:"Đề xuất giá dịch vụ", Icon:Tag },
  { id:"reports",      label:"Báo cáo tiêu thụ",    Icon:BarChart2 },
];

const NAV_LABELS: Record<NavPage, string> = {
  restaurant:   "Điều phối nhà hàng",
  inventory:    "Kho & Minibar",
  transactions: "Nhập – Xuất kho",
  pricing:      "Đề xuất giá dịch vụ",
  reports:      "Báo cáo tiêu thụ",
};

export default function KitchenInventory({ onBack }: { onBack: () => void }) {
  const [page, setPage] = useState<NavPage>("restaurant");
  const [globalSearch, setGlobalSearch] = useState("");
  const [priceRequests, setPriceRequests] = useState<PriceRequest[]>([]);
  const [liveItems, setLiveItems] = useState<InventoryItem[]>([]);
  const [liveTransactions, setLiveTransactions] = useState<Transaction[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(true);
  const [inventoryError, setInventoryError] = useState<string | null>(null);
  const [inventoryRefreshKey, setInventoryRefreshKey] = useState(0);
  const [movementDialog, setMovementDialog] = useState<{ serviceId?: string; type: MovementType; reason?: string } | null>(null);
  const [movementNotice, setMovementNotice] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<EmployeeProfileDto | null>(null);
  const [topProfileOpen, setTopProfileOpen] = useState(false);
  const [sidebarProfileOpen, setSidebarProfileOpen] = useState(false);
  const [restaurantDate, setRestaurantDate] = useState(() => localDateValue());
  const [restaurantBookings, setRestaurantBookings] = useState<RestaurantBooking[]>([]);
  const [restaurantLoading, setRestaurantLoading] = useState(false);
  const [restaurantError, setRestaurantError] = useState<string | null>(null);
  const [restaurantBusyId, setRestaurantBusyId] = useState<number | null>(null);
  const [restaurantRefreshKey, setRestaurantRefreshKey] = useState(0);

  const todayLabel = useMemo(() => new Date().toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" }), []);

  const liveUsage: MinibarUsage[] = liveTransactions.slice(0, 10).map(transaction => ({
    item: transaction.item,
    qty: transaction.qty,
    time: transaction.date,
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
        const mapped = services.map((service: Service, index): InventoryItem => {
          const category = service.category || "Dịch vụ";
          return {
            id: service.id,
            name: service.name,
            sku: service.id,
            category,
            unit: service.unit || "lượt",
            price: service.price,
            stock: service.stock,
            max: Math.max(service.stock, service.safety_threshold * 3, 1),
            reorder: service.safety_threshold,
            emoji: ["🍽️", "🧴", "🚗", "🧺", "🏊", "📦"][index % 6],
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
            date: new Date(movement.occurred_at).toLocaleString("vi-VN"),
            occurredAt: movement.occurred_at,
            type,
            movementType: movement.type,
            item: `${item.name} (${item.sku})`,
            qty: signedQuantity,
            amount: item.price * Math.abs(movement.quantity),
            staff: movement.actor_id,
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
    kitchenAccountingApi.priceRequests()
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
          const item = liveItems.find(entry => entry.id === approval.target_id);
          const newPrice = Number(requestedPrice);
          if (!item || !Number.isFinite(newPrice) || newPrice <= 0) return null;
          const status: PriceStatus = approval.status === "PENDING" ? "pending"
            : approval.status === "APPROVED" ? "approved"
            : approval.status === "REJECTED" ? "rejected"
            : approval.status === "EXPIRED" ? "expired" : "consumed";
          return {
            id: String(approval.id), item: item.name, sku: item.sku, currentPrice: item.price,
            newPrice, requestedBy: approval.requester, requestedAt: new Date(approval.requested_at).toLocaleString("vi-VN"),
            status, reason: approval.reason,
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

  const handleAddPriceRequest = async (req: PriceRequest): Promise<void> => {
    const service = liveItems.find(item => item.sku === req.sku || item.name === req.item);
    if (!service) throw new Error("Dịch vụ không còn trong danh mục; tải lại dữ liệu rồi thử lại.");
    const approval = await kitchenAccountingApi.submitPrice(service.id, {
      price: req.newPrice,
      reason: req.reason ?? "",
    }, newKitchenIdempotencyKey());
    setPriceRequests(prev => [{ ...req, id: String(approval.id), requestedBy: approval.requester,
      requestedAt: new Date(approval.requested_at).toLocaleString("vi-VN"), reason: approval.reason }, ...prev]);
  };

  useEffect(() => {
    let active = true;
    setRestaurantLoading(true);
    setRestaurantError(null);
    kitchenAccountingApi.restaurantBookings({ date: restaurantDate })
      .then(rows => { if (active) setRestaurantBookings(rows); })
      .catch(error => {
        console.warn("Không tải được đơn nhà hàng:", error);
        if (active) { setRestaurantBookings([]); setRestaurantError(apiErrorMessage(error, "Không tải được đơn nhà hàng.")); }
      })
      .finally(() => { if (active) setRestaurantLoading(false); });
    return () => { active = false; };
  }, [restaurantDate, restaurantRefreshKey]);

  const handleMarkRestaurantUsed = async (booking: RestaurantBooking) => {
    setRestaurantBusyId(booking.id);
    setRestaurantError(null);
    try {
      const updated = await kitchenAccountingApi.markRestaurantBookingUsed(booking.id);
      setRestaurantBookings(rows => rows.map(row => row.id === booking.id ? updated : row));
      setInventoryRefreshKey(key => key + 1);
    } catch (error) {
      setRestaurantError(apiErrorMessage(error, "Không thể xác nhận phục vụ."));
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
              <p style={{ fontSize:9,color:"#D97706",letterSpacing:"0.08em",textTransform:"uppercase",marginTop:2,fontWeight:600 }}>BẾP &amp; DỊCH VỤ ĂN UỐNG</p>
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
              {userProfile?.full_name ? userProfile.full_name.slice(0, 2).toUpperCase() : "FB"}
            </div>
            <div>
              <p style={{ fontSize:11,fontWeight:700,color:"#0F172A",lineHeight:1 }}>{userProfile?.full_name || "Bếp trưởng & Quản lý Kho"}</p>
              <p style={{ fontSize:10,color:"#94A3B8" }}>{userProfile?.role ? employeeRoleLabel(userProfile.role) : "Bộ phận Bếp & Nhà hàng"}</p>
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
            currentRoleLabel={userProfile?.role ? employeeRoleLabel(userProfile.role) : "Bếp trưởng & Nhà hàng"}
            departmentName="Bộ phận Bếp & Nhà hàng"
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
            <input aria-label="Tìm trong bộ phận bếp và nhà hàng" value={globalSearch} onChange={event => setGlobalSearch(event.target.value)} placeholder="Tìm mặt hàng, dịch vụ hoặc phòng..."
              style={{ width:"100%",height:34,paddingLeft:32,paddingRight:12,borderRadius:8,
                border:"1px solid #E2E8F0",background:"#F8FAFC",fontSize:12,outline:"none",boxSizing:"border-box" }} />
          </div>
          <div style={{ flex:1 }} />
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
                {userProfile?.full_name ? userProfile.full_name.slice(0, 2).toUpperCase() : "FB"}
              </div>
              <div>
                <p style={{ fontSize:12,fontWeight:700,color:"#0F172A",lineHeight:1 }}>{userProfile?.full_name || "Quản lý bếp & dịch vụ"}</p>
                <p style={{ fontSize:10,color:"#94A3B8" }}>{userProfile?.role ? employeeRoleLabel(userProfile.role) : "Bộ phận Bếp & Nhà hàng"}</p>
              </div>
              <ChevronDown size={12} style={{ color:"#94A3B8" }} />
            </div>
            <EmployeeProfileDropdown
              isOpen={topProfileOpen}
              onClose={()=>setTopProfileOpen(false)}
              onLogout={onBack}
              align="top-right"
            currentRoleLabel={userProfile?.role ? employeeRoleLabel(userProfile.role) : "Bếp trưởng & Nhà hàng"}
              departmentName="Bộ phận Bếp & Nhà hàng"
            />
          </div>
        </header>

        {/* PAGE TITLE (inventory only) */}
        {page === "inventory" && (
          <div style={{ padding:"14px 22px",background:"#FFF",borderBottom:"1px solid #E2E8F0",flexShrink:0 }}>
            <div style={{ display:"flex",alignItems:"flex-start",justifyContent:"space-between" }}>
              <div>
                <h1 style={{ fontSize:22,fontWeight:800,color:"#0F172A",marginBottom:3 }}>
                  Kho &amp; Minibar
                </h1>
                <p style={{ fontSize:13,color:"#64748B" }}>Quản lý vật tư bếp, hàng minibar và xuất cấp theo phòng</p>
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
          {page !== "restaurant" && <KpiBar items={liveItems} transactions={liveTransactions} priceRequests={priceRequests} />}

        {inventoryError && <div role="alert" style={{ display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,padding:"9px 16px",background:"#FFF1F2",borderBottom:"1px solid #FECDD3",color:"#BE123C",fontSize:12 }}>
          <span>{inventoryError}</span><button onClick={() => setInventoryRefreshKey(key => key + 1)} style={{ border:"1px solid #FDA4AF",borderRadius:7,background:"#FFF",padding:"5px 9px",color:"#9F1239",fontSize:11,fontWeight:700,cursor:"pointer" }}>Tải lại dữ liệu kho</button>
        </div>}
        {movementNotice && <div role="status" style={{ padding:"8px 16px",background:"#F0FDF4",borderBottom:"1px solid #BBF7D0",color:"#166534",fontSize:12 }}>{movementNotice}</div>}

        {/* CONTENT */}
        <div style={{ flex:1,display:"flex",overflow:"hidden" }}>
          {page === "restaurant" && <RestaurantScreen bookings={restaurantBookings} date={restaurantDate} loading={restaurantLoading} error={restaurantError} busyId={restaurantBusyId} searchQuery={globalSearch} onDateChange={setRestaurantDate} onRefresh={() => setRestaurantRefreshKey(key => key + 1)} onMarkUsed={booking => void handleMarkRestaurantUsed(booking)} />}
          {page === "inventory"    && (
            <InventoryScreen
              items={liveItems}
              usage={liveUsage}
              priceRequests={priceRequests}
              onOpenMovement={(serviceId,type,reason) => setMovementDialog({ serviceId,type,reason })}
              onSeeAll={() => setPage("transactions")}
              searchQuery={globalSearch}
              loading={inventoryLoading}
              onAddPriceRequest={handleAddPriceRequest}
              requesterName={userProfile?.full_name ? `${userProfile.full_name} (${employeeRoleLabel(userProfile.role)})` : "Bộ phận Bếp"}
            />
          )}
          {page === "transactions" && <TransactionsScreen transactions={liveTransactions} onOpenMovement={(type,reason) => setMovementDialog({ type,reason })} searchQuery={globalSearch} />}
          {page === "pricing"      && (
            <PricingScreen
              requests={priceRequests}
              items={liveItems}
              onAddPriceRequest={handleAddPriceRequest}
              searchQuery={globalSearch}
              requesterName={userProfile?.full_name ? `${userProfile.full_name} (${employeeRoleLabel(userProfile.role)})` : "Bộ phận Bếp"}
            />
          )}
          {page === "reports"      && <ReportsScreen items={liveItems} transactions={liveTransactions} />}
        </div>
      </div>
      {movementDialog && <InventoryMovementModal items={liveItems} initialServiceId={movementDialog.serviceId} initialType={movementDialog.type} initialReason={movementDialog.reason} onClose={() => setMovementDialog(null)} onSubmit={handleInventoryMovement} />}
    </div>
  );
}
