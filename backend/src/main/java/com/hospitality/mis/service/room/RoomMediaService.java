package com.hospitality.mis.service.room;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dao.room.RoomMediaDatabase;
import com.hospitality.mis.dto.room.RoomMediaDtos;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;
import java.util.List;

/** Files remain outside SQL; procedures own metadata, limits, mappings and audit. */
@Service
public class RoomMediaService {
    private final RoomMediaDatabase database;
    private final RoomImageStorage storage;
    public RoomMediaService(RoomMediaDatabase database,RoomImageStorage storage){this.database=database;this.storage=storage;}
    public RoomMediaDtos.ImageResponse upload(String room,MultipartFile file,String actor){
        database.requireRoom(room);
        if(database.imageCount(room)>=10)throw new DomainException("ROOM_IMAGE_LIMIT","Mỗi phòng chỉ được tối đa 10 ảnh");
        var stored=storage.store(room,file);
        try{
            var result=database.upload(room,stored,actor);
            if(TransactionSynchronizationManager.isSynchronizationActive())TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization(){
                @Override public void afterCompletion(int status){if(status!=STATUS_COMMITTED)storage.delete(stored.relativePath());}
            });
            return result;
        }catch(RuntimeException error){storage.delete(stored.relativePath());throw error;}
    }
    public void delete(String room,Long id,String actor){
        String path=database.delete(room,id,actor);
        if(TransactionSynchronizationManager.isSynchronizationActive())TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization(){
            @Override public void afterCommit(){storage.delete(path);}
        });else storage.delete(path);
    }
    @Transactional(readOnly=true)
    public RoomMediaDtos.RoomMediaResponse get(String room){database.requireRoom(room);return new RoomMediaDtos.RoomMediaResponse(room,database.images(room),database.amenityNames(room));}
    public RoomMediaDtos.AmenityResponse createAmenity(RoomMediaDtos.CreateAmenityRequest request,String actor){return database.createAmenity(name(request==null?null:request.name()),actor);}
    @Transactional(readOnly=true)
    public List<RoomMediaDtos.AmenityResponse> listAmenities(){return database.amenities();}
    public RoomMediaDtos.AmenityResponse updateAmenity(Long id,RoomMediaDtos.UpdateAmenityRequest request,String actor){
        database.amenity(id);
        return database.updateAmenity(id,name(request==null?null:request.name()),request.active(),actor);
    }
    public List<RoomMediaDtos.AmenityResponse> assignAmenities(String type,RoomMediaDtos.AssignAmenitiesRequest request,String actor){
        List<Long> ids=request==null||request.amenityIds()==null?List.of():request.amenityIds().stream().distinct().toList();
        return database.assign(type,ids,actor);
    }
    private String name(String value){if(value==null||value.isBlank())throw new DomainException("AMENITY_NAME_REQUIRED","Tên tiện nghi là bắt buộc");return value.trim();}
}
