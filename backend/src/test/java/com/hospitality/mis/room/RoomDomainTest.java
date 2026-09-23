package com.hospitality.mis.room;

import com.hospitality.mis.entity.room.Room;
import com.hospitality.mis.entity.room.RoomType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/** Bảo vệ entity Room/RoomType và cột snake_case canonical. */
class RoomDomainTest {
    @Test
    /** Given hai model canonical, When soi JPA annotation, Then map đúng rooms và room_types. */
    void canonicalModelsAreTheSoleConcreteEntities() {
        assertThat(Room.class.isAnnotationPresent(Entity.class)).isTrue();
        assertThat(RoomType.class.isAnnotationPresent(Entity.class)).isTrue();
        assertThat(Room.class.getAnnotation(Table.class).name()).isEqualTo("rooms");
        assertThat(RoomType.class.getAnnotation(Table.class).name()).isEqualTo("room_types");
    }

    @Test
    /** Given field mapping, When đọc @Column, Then tên và length khớp schema v1. */
    void canonicalFieldsUseV1SnakeCaseColumns() throws Exception {
        assertColumn(Room.class, "id", "id", 10);
        assertColumn(Room.class, "name", "name", 100);
        assertColumn(Room.class, "floor", "floor", 0);
        assertColumn(Room.class, "description", "description", 1200);
        assertColumn(Room.class, "status", "status", 30);
        assertColumn(RoomType.class, "id", "id", 10);
        assertColumn(RoomType.class, "name", "name", 50);
        assertColumn(RoomType.class, "dailyPrice", "daily_price", 0);
        assertColumn(RoomType.class, "description", "description", 500);
    }

    /** Helper kiểm tra column name và length khi length được quy định. */
    private void assertColumn(Class<?> type, String field, String name, int length) throws Exception {
        Column column = type.getDeclaredField(field).getAnnotation(Column.class);
        assertThat(column.name()).isEqualTo(name);
        if (length > 0) assertThat(column.length()).isEqualTo(length);
    }
}
