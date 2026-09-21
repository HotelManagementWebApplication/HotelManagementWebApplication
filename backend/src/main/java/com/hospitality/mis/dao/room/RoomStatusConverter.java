package com.hospitality.mis.dao.room;
import com.hospitality.mis.entity.room.RoomStatus;




import jakarta.persistence.AttributeConverter;

import jakarta.persistence.Converter;



/** Lưu trạng thái phòng bằng đúng giá trị canonical của room-status contract. */

@Converter(autoApply = false)

public class RoomStatusConverter implements AttributeConverter<RoomStatus, String> {

    @Override

    /** Ghi null thành null; trạng thái khác dùng giá trị canonical lower_snake_case. */
    public String convertToDatabaseColumn(RoomStatus status) {

        return status == null ? null : status.databaseCode();

    }



    @Override

    /** Đọc null thành null; mọi giá trị không canonical bị từ chối. */
    public RoomStatus convertToEntityAttribute(String databaseValue) {

        return databaseValue == null ? null : RoomStatus.fromDatabaseCode(databaseValue);

    }

}
