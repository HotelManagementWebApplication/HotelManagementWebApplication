package com.hospitality.mis.service.guest;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dao.guest.PublicCatalogDatabase;
import com.hospitality.mis.dao.room.RoomDatabase;
import com.hospitality.mis.dto.guest.PublicGuestDtos;
import com.hospitality.mis.entity.room.RoomAvailabilityPolicy;
import com.hospitality.mis.entity.room.RoomStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class PublicGuestPortalService {
    private final PublicCatalogDatabase catalog;
    private final RoomDatabase overlaps;
    private final java.time.Clock clock;
    private final RoomAvailabilityPolicy availabilityPolicy=new RoomAvailabilityPolicy();

    public PublicGuestPortalService(PublicCatalogDatabase catalog,RoomDatabase overlaps,java.time.Clock clock){this.catalog=catalog;this.overlaps=overlaps;this.clock=clock;}

    @Transactional(readOnly=true)
    public List<PublicGuestDtos.RoomSummary> rooms(String type){return catalog.rooms(type).stream().map(r->
            new PublicGuestDtos.RoomSummary(r.id(),r.name(),r.typeId(),r.typeCode(),r.typeName(),r.marketingName(),r.typeDescription(),r.tagline(),
                    r.marketingDescription(),r.description(),r.dailyPrice(),r.hourlyPrice(),r.area(),r.view(),r.bedType(),r.floor(),
                    publicStatus(r.status()),catalog.images(r).stream().findFirst().orElse(null),catalog.amenities(r.typeId()),r.maxOccupancy())).toList();}

    @Transactional(readOnly=true)
    public PublicGuestDtos.RoomDetail room(String id){
        var r=catalog.room(id).orElseThrow(()->new DomainException("ROOM_NOT_FOUND","Không tìm thấy phòng"));
        return new PublicGuestDtos.RoomDetail(r.id(),r.name(),r.typeId(),r.typeCode(),r.typeName(),r.marketingName(),r.typeDescription(),r.tagline(),
                r.marketingDescription(),r.description(),r.dailyPrice(),r.hourlyPrice(),r.area(),r.view(),r.bedType(),r.floor(),r.description(),
                publicStatus(r.status()),catalog.images(r),catalog.amenities(r.typeId()),r.maxOccupancy());
    }

    @Transactional(readOnly=true)
    public List<PublicGuestDtos.RoomAvailability> availability(LocalDateTime from,LocalDateTime to,String type){
        try{availabilityPolicy.validateInterval(from,to);}catch(IllegalArgumentException error){throw new DomainException("INVALID_INTERVAL","Thời gian nhận phải trước thời gian trả");}
        return catalog.rooms(type).stream().map(r->new PublicGuestDtos.RoomAvailability(r.id(),r.name(),r.typeId(),r.typeCode(),r.typeName(),r.marketingName(),
                r.typeDescription(),r.tagline(),r.marketingDescription(),r.description(),r.dailyPrice(),r.hourlyPrice(),r.area(),r.view(),r.bedType(),r.floor(),
                publicStatus(r.status()),availabilityPolicy.isAvailable(r.status(),overlaps.overlap(r.id(),from,to,LocalDateTime.now(clock))),
                catalog.images(r).stream().findFirst().orElse(null),catalog.amenities(r.typeId()),r.maxOccupancy())).toList();
    }

    @Transactional(readOnly=true)
    public List<PublicGuestDtos.ServiceSummary> services(){return catalog.services();}

    private PublicGuestDtos.PublicRoomStatus publicStatus(RoomStatus status){
        if(status==null)return PublicGuestDtos.PublicRoomStatus.OUT_OF_SERVICE;
        return switch(status){case READY->PublicGuestDtos.PublicRoomStatus.READY;case RESERVED->PublicGuestDtos.PublicRoomStatus.RESERVED;
            case OCCUPIED->PublicGuestDtos.PublicRoomStatus.OCCUPIED;case CLEANING->PublicGuestDtos.PublicRoomStatus.CLEANING;
            case MAINTENANCE->PublicGuestDtos.PublicRoomStatus.MAINTENANCE;
            case OUT_OF_SERVICE,RETURNED,CANCELLED->PublicGuestDtos.PublicRoomStatus.OUT_OF_SERVICE;};
    }
}
