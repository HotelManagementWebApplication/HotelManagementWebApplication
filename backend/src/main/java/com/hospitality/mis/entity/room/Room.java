package com.hospitality.mis.entity.room;

import com.hospitality.mis.dao.room.RoomStatusConverter;
import jakarta.persistence.Access;
import jakarta.persistence.AccessType;

import jakarta.persistence.Column;

import jakarta.persistence.Convert;

import jakarta.persistence.Id;

import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.ForeignKey;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.Version;



/**

 * Trạng thái phòng chuẩn và ánh xạ lưu trữ các thuộc tính vô hướng.

 *

 * Chủ thể JPA cụ thể duy nhất của bảng {@code rooms}.
 */
@Entity
@Table(name = "Phong")
@Access(AccessType.FIELD)
public class Room {
    @Id

    @Column(name = "maPhong", length = 10, nullable = false)
    /** Mã phòng nghiệp vụ, được dùng trong đặt phòng và tồn phòng. */
    private String id;



    @Column(name = "ten", length = 100)
    private String name;



    @Column(name = "tang")
    private Integer floor;



    @Column(name = "moTa", length = 1200)
    private String description;



    @Convert(converter = RoomStatusConverter.class)

    @Column(name = "trangThai", length = 30, nullable = false)
    /** Trạng thái vận hành quyết định phòng có thể phân bổ hay không. */
    private RoomStatus status = RoomStatus.READY;



    @Version

    @Column(name = "phienBan", nullable = false)
    /** Phiên bản lạc quan, ngăn hai thao tác đồng thời ghi đè trạng thái phòng. */
    private long version;



    /** Constructor rỗng dành cho JPA. */
    public Room() {
    }

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "maLoaiPhong", nullable = false, foreignKey = @ForeignKey(name = "fkPhong01"))
    private RoomType roomType;


    public String getId() {

        return id;

    }



    public void setId(String id) {

        this.id = id;

    }



    public RoomType getRoomType() { return roomType; }
    public void setRoomType(RoomType roomType) { this.roomType = roomType; }


    public String getName() {

        return name;

    }



    public void setName(String name) {

        this.name = name;

    }



    public Integer getFloor() {

        return floor;

    }



    public void setFloor(Integer floor) {

        this.floor = floor;

    }



    public String getDescription() {

        return description;

    }



    public void setDescription(String description) {

        this.description = description;

    }



    public RoomStatus getStatus() {

        return status;

    }



    /** Cập nhật trạng thái sau khi kiểm tra status không null ở biên entity. */
    public void setStatus(RoomStatus status) {

        if (status == null) {

            throw new IllegalArgumentException("status must not be null");

        }

        this.status = status;

    }



    public long getVersion() {

        return version;

    }

}
