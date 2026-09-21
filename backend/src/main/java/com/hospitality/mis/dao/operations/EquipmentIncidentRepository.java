package com.hospitality.mis.dao.operations;



import com.hospitality.mis.entity.operations.EquipmentIncident;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import jakarta.persistence.LockModeType;
import org.springframework.data.repository.query.Param;

import java.util.List;
import com.hospitality.mis.entity.operations.IncidentHandoffStatus;
import com.hospitality.mis.entity.operations.IncidentSeverity;



/** Kho sự cố thiết bị liên kết với các đặt phòng. */
public interface EquipmentIncidentRepository extends JpaRepository<EquipmentIncident, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select i from EquipmentIncident i where i.id = :id")
    java.util.Optional<EquipmentIncident> findForUpdateById(@Param("id") Long id);

    /** Bounded, stable incident page used by the front-desk dashboard. */
    @EntityGraph(attributePaths = {"reservation", "room"})
    @Query("select i from EquipmentIncident i order by i.id asc")
    Page<EquipmentIncident> dashboardPage(Pageable pageable);

    /** Incident query used by housekeeping/technical handoff; all filters are optional and explicit. */
    @EntityGraph(attributePaths = {"reservation", "room"})
    @Query("select i from EquipmentIncident i left join i.reservation r "
            + "where (:roomId is null or i.room.id = :roomId) "
            + "and (:reservationId is null or (r is not null and r.id = :reservationId)) "
            + "and (:handoffStatus is null or i.handoffStatus = :handoffStatus) "
            + "order by i.id asc")
    List<EquipmentIncident> findForOperations(@Param("roomId") String roomId,
                                               @Param("reservationId") Long reservationId,
                                               @Param("handoffStatus") IncidentHandoffStatus handoffStatus);

    /** Lấy các sự cố thiết bị gắn với một đặt phòng để theo dõi vận hành. */
    List<EquipmentIncident> findByReservationId(Long reservationId);
    boolean existsByRoomIdAndSeverityInAndHandoffStatusNot(String roomId, List<IncidentSeverity> severities,
                                                            IncidentHandoffStatus status);
}
