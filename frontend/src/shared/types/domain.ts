export type RoleId =
  | "customer"
  | "reception"
  | "housekeeping"
  | "maintenance"
  | "accounting"
  | "manager"
  | "director"
  | "admin"
  | "hr"
  | "staff"
  | "fnb";

export interface Role {
  id: RoleId;
  label: string;
  labelVi: string;
  desc: string;
  color: string;
  bg: string;
  icon: string;
}

export type RoomStatus = "available" | "occupied" | "housekeeping" | "maintenance" | "reserved";
export type CleanStatus = "clean" | "dirty" | "in-progress";

export interface Room {
  id: string;
  number: string;
  floor: number;
  type: "Standard" | "Superior" | "Deluxe" | "Suite" | "VIP Suite";
  roomTypeCode?: string;
  roomTypeName?: string;
  marketingName?: string;
  tagline?: string;
  pricePerNight: number;
  pricePerHour: number;
  status: RoomStatus;
  /** Có kết quả kiểm tra theo khoảng ngày đang tìm hay chưa. */
  availableForBooking?: boolean;
  cleanStatus: CleanStatus;
  guestName?: string;
  checkIn?: string;
  checkOut?: string;
  view: string;
  beds: string;
  area: number;
  maxOccupancy?: number;
  amenities: string[];
  image: string;
  description?: string;
  imageUrls?: string[];
}

export interface Booking {
  id: string;
  guestName: string;
  guestId: string;
  roomNumber: string;
  roomType: string;
  checkIn: string;
  checkOut: string;
  depositStatus: "paid" | "pending";
  totalAmount: number;
  type: "arrival" | "departure";
  nights: number;
  nationality: string;
  phone: string;
  paymentMethod: "cash" | "card" | "transfer";
}

export interface HousekeepingTask {
  id: string;
  roomNumber: string;
  floor: number;
  type: "checkout-clean" | "daily-service" | "deep-clean" | "inspection";
  status: "pending" | "in-progress" | "done";
  priority: "high" | "medium" | "low";
  assignedTo: string;
  requestTime: string;
  note?: string;
}

export interface StaffMember {
  id: string;
  name: string;
  role: RoleId;
  roleLabel: string;
  shift: "morning" | "afternoon" | "night";
  phone: string;
  status: "active" | "off" | "on-leave";
  avatar: string;
  joinDate: string;
}

export interface FinanceEntry {
  id: string;
  type: "income" | "expense";
  category: string;
  amount: number;
  method: "cash" | "card" | "transfer";
  time: string;
  note: string;
  approvedBy?: string;
}
