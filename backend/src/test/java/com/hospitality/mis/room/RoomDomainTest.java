package com.hospitality.mis.room;

import com.hospitality.mis.entity.room.Room;
import com.hospitality.mis.entity.room.RoomType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/** Bảo vệ mapping vật lý tiếng Việt của entity Room/RoomType. */
class RoomDomainTest {
    @Test
    /** Given hai model chuẩn, When soi JPA annotation, Then tên bảng khớp schema tiếng Việt. */
    void canonicalModelsAreTheSoleConcreteEntities() {
        assertThat(Room.class.isAnnotationPresent(Entity.class)).isTrue();
        assertThat(RoomType.class.isAnnotationPresent(Entity.class)).isTrue();
        assertThat(Room.class.getAnnotation(Table.class).name()).isEqualTo("Phong");
        assertThat(RoomType.class.getAnnotation(Table.class).name()).isEqualTo("LoaiPhong");
    }

    @Test
    /** Given field mapping, When đọc @Column, Then tên và length khớp schema v1. */
    void canonicalFieldsUseVietnameseColumns() throws Exception {
        assertColumn(Room.class, "id", "maPhong", 10);
        assertColumn(Room.class, "name", "ten", 100);
        assertColumn(Room.class, "floor", "tang", 0);
        assertColumn(Room.class, "description", "moTa", 1200);
        assertColumn(Room.class, "status", "trangThai", 30);
        assertColumn(RoomType.class, "id", "maLoaiPhong", 10);
        assertColumn(RoomType.class, "name", "ten", 50);
        assertColumn(RoomType.class, "dailyPrice", "giaTheoNgay", 0);
        assertColumn(RoomType.class, "description", "moTa", 500);
    }

    /** Helper kiểm tra column name và length khi length được quy định. */
    private void assertColumn(Class<?> type, String field, String name, int length) throws Exception {
        Column column = type.getDeclaredField(field).getAnnotation(Column.class);
        assertThat(column.name()).isEqualTo(name);
        if (length > 0) assertThat(column.length()).isEqualTo(length);
    }
}
