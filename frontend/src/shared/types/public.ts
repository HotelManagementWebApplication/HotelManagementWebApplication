export type PublicRoomStatus = "available" | "reserved" | "occupied" | "cleaning" | "maintenance" | "out_of_service";

export interface PublicRoomSummary {
  room_id: string;
  room_name: string;
  room_type_id: string;
  room_type_code: string;
  room_type_name: string;
  marketing_name: string | null;
  room_type_description: string | null;
  marketing_tagline: string | null;
  marketing_description: string | null;
  room_description: string | null;
  daily_price: number;
  hourly_price: number;
  area: number | null;
  view: string | null;
  bed_type: string | null;
  floor: number;
  status: PublicRoomStatus;
  image_url: string | null;
  amenities: string[];
  max_occupancy: number;
}

export interface PublicRoomDetail extends Omit<PublicRoomSummary, "image_url"> {
  room_type_description: string | null;
  description: string;
  image_urls: string[];
  amenities: string[];
}

export interface PublicRoomAvailability extends Omit<PublicRoomSummary, "status"> {
  current_status: PublicRoomStatus;
  available: boolean;
}

export interface PublicService {
  service_id: string;
  name: string;
  price: number;
  unit: string;
  category: string;
  description: string | null;
  image_url: string | null;
}

export interface CommercialSpace {
  id: string;
  partner_id: string;
  partner_name: string;
  name: string;
  floor: number;
  zone: string;
  access_policy: string;
  service_id: string | null;
}
