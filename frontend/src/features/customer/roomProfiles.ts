import { Room } from "../../shared/types/domain";

export const getRoomFullName = (room: Room): string => {
  const typeName = room.marketingName?.trim() || room.roomTypeName?.trim();
  return typeName ? `${typeName} · ${room.number}` : `Phòng ${room.number}`;
};

export const getRoomDescription = (room: Room): string => {
  return room.description?.trim() ?? "";
};
