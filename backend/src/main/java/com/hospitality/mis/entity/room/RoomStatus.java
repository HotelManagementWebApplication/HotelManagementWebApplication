package com.hospitality.mis.entity.room;



import com.fasterxml.jackson.annotation.JsonValue;





/**

 * Trạng thái phòng chuẩn với một giá trị canonical dùng cho JSON và persistence.

 */

public enum RoomStatus {

    /** Phòng sẵn sàng nhận khách. */
    READY("available", false),

    /** Phòng đang có khách ở. */
    OCCUPIED("occupied", false),

    /** Phòng đang được dọn và tạm thời không phân bổ. */
    CLEANING("cleaning", true),

    /** Phòng đang bảo trì và không phân bổ. */
    MAINTENANCE("maintenance", true),

    /** Phòng ngừng sử dụng và không phân bổ. */
    OUT_OF_SERVICE("out_of_service", true),

    /** Phòng đã được giữ cho một đặt phòng. */
    RESERVED("reserved", false),

    /** Phòng đã trả theo trạng thái nghiệp vụ hiện tại. */
    RETURNED("returned", false),

    /** Phòng/đặt phòng đã bị hủy. */
    CANCELLED("cancelled", false);



    /** Giá trị canonical lower_snake_case của trạng thái ở mọi boundary. */
    private final String canonicalValue;

    /** Cho biết trạng thái có chặn phân bổ phòng hay không. */
    private final boolean blocksAvailability;



    /** Gắn mã lưu trữ và cờ khả dụng cho từng trạng thái. */
    RoomStatus(String canonicalValue, boolean blocksAvailability) {

        this.canonicalValue = canonicalValue;

        this.blocksAvailability = blocksAvailability;

    }



    @JsonValue

    public String databaseCode() {

        return canonicalValue;

    }



    /** Trả về true nếu không được chọn phòng cho đặt phòng mới. */
    public boolean blocksAvailability() {

        return blocksAvailability;

    }

    /** Only these six values may be stored as the current operational room state. */
    public boolean isOperationalStatus() {
        return this != RETURNED && this != CANCELLED;
    }



    /** Đọc đúng giá trị canonical; mọi mã khác đều bị từ chối. */
    public static RoomStatus fromDatabaseCode(String value) {

        if (value == null) {

            throw new IllegalArgumentException("room status must not be null");

        }

        for (RoomStatus status : values()) {

            if (status.canonicalValue.equals(value)) {

                return status;

            }

        }

        throw new IllegalArgumentException("Unknown room status: " + value);

    }



    /** Đọc giá trị từ API theo cùng hợp đồng mã với cơ sở dữ liệu. */
    public static RoomStatus fromApiValue(String value) {
        return fromDatabaseCode(value);
    }
}
