package com.hospitality.mis.dao.room;
import com.hospitality.mis.entity.room.RoomStatus;




import jakarta.persistence.AttributeConverter;

import jakarta.persistence.Converter;

import java.util.Map;



/** Giữ mã JSON hiện hành nhưng lưu trạng thái phòng bằng tiếng Việt trong QLKS. */

@Converter(autoApply = false)

public class RoomStatusConverter implements AttributeConverter<RoomStatus, String> {

    private static final Map<RoomStatus, String> TO_DATABASE = Map.of(
            RoomStatus.READY, "Sẵn sàng",
            RoomStatus.OCCUPIED, "Đang có khách",
            RoomStatus.CLEANING, "Đang dọn phòng",
            RoomStatus.MAINTENANCE, "Đang bảo trì",
            RoomStatus.OUT_OF_SERVICE, "Ngừng sử dụng",
            RoomStatus.RESERVED, "Đã giữ phòng",
            RoomStatus.RETURNED, "Đã trả phòng",
            RoomStatus.CANCELLED, "Đã hủy");

    private static final Map<String, RoomStatus> FROM_DATABASE = TO_DATABASE.entrySet().stream()
            .collect(java.util.stream.Collectors.toUnmodifiableMap(Map.Entry::getValue, Map.Entry::getKey));

    @Override

    /** Ghi null thành null; mã API lower_snake_case không đi vào database. */
    public String convertToDatabaseColumn(RoomStatus status) {

        if (status == null) return null;
        String value = TO_DATABASE.get(status);
        if (value == null) throw new IllegalArgumentException("Unsupported room status: " + status);
        return value;

    }



    @Override

    /** Đọc null thành null; mọi giá trị database ngoài từ điển đều bị từ chối. */
    public RoomStatus convertToEntityAttribute(String databaseValue) {

        if (databaseValue == null) return null;
        RoomStatus status = FROM_DATABASE.get(databaseValue);
        if (status == null) throw new IllegalArgumentException("Unknown Vietnamese room status: " + databaseValue);
        return status;

    }

}
