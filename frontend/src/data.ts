import { Room, Booking, HousekeepingTask, StaffMember, FinanceEntry } from "./types";

export const rooms: Room[] = [];
export const arrivals: Booking[] = [];
export const departures: Booking[] = [];
export const housekeepingTasks: HousekeepingTask[] = [];
export const staff: StaffMember[] = [];
export const financeToday: FinanceEntry[] = [];
export const notifications: { id: number; title: string; desc: string; time: string; type: string; urgent: boolean }[] = [];
