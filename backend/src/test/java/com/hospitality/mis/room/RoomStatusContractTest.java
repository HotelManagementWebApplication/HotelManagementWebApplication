package com.hospitality.mis.room;

import com.hospitality.mis.dao.room.RoomStatusConverter;
import com.hospitality.mis.entity.room.RoomStatus;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Bảo vệ mapping canonical của room-status ở API và persistence boundary. */
class RoomStatusContractTest {
    private static final Map<RoomStatus, String> OPERATIONAL_STATUS_VALUES = Map.of(
            RoomStatus.READY, "available",
            RoomStatus.OCCUPIED, "occupied",
            RoomStatus.CLEANING, "cleaning",
            RoomStatus.MAINTENANCE, "maintenance",
            RoomStatus.OUT_OF_SERVICE, "out_of_service",
            RoomStatus.RESERVED, "reserved");

    @Test
    void sixOperationalStatusesUseCanonicalLowerSnakeCaseValues() {
        assertThat(OPERATIONAL_STATUS_VALUES).allSatisfy((status, value) -> {
            assertThat(status.databaseCode()).isEqualTo(value);
            assertThat(RoomStatus.fromApiValue(value)).isSameAs(status);
            assertThat(status.isOperationalStatus()).isTrue();
        });
    }

    @Test
    void persistenceConverterUsesVietnameseDatabaseValues() {
        RoomStatusConverter converter = new RoomStatusConverter();

        assertThat(converter.convertToDatabaseColumn(RoomStatus.MAINTENANCE)).isEqualTo("Đang bảo trì");
        assertThat(converter.convertToEntityAttribute("Đang bảo trì")).isEqualTo(RoomStatus.MAINTENANCE);
        assertThat(converter.convertToDatabaseColumn(null)).isNull();
        assertThat(converter.convertToEntityAttribute(null)).isNull();
    }

    @Test
    void legacyAndNonCanonicalValuesFailFast() {
        assertThatThrownBy(() -> RoomStatus.fromApiValue("SAN_SANG"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> RoomStatus.fromDatabaseCode("READY"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> RoomStatus.fromDatabaseCode(" ready "))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
