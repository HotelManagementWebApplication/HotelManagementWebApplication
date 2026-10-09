package com.hospitality.mis.dao.operations;

import com.hospitality.mis.entity.operations.EquipmentIncident;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

/** Temporary billing reader only; incident commands and operational queries use EquipmentIncidentDatabase. */
public interface EquipmentIncidentRepository extends JpaRepository<EquipmentIncident,Long> {
    List<EquipmentIncident> findByReservationId(Long reservationId);
}
