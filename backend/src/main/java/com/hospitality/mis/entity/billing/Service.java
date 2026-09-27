/* Entity này lưu danh mục dịch vụ và đơn vị tính được dùng trong hóa đơn. */
package com.hospitality.mis.entity.billing;
import jakarta.persistence.*;
import java.math.BigDecimal;
@Entity @Table(name = "DichVu") @Access(AccessType.FIELD)
/** Danh mục dịch vụ và tồn kho dùng để lập dòng dịch vụ trên hóa đơn. */
public class Service {
    /** Mã dịch vụ nghiệp vụ, được tham chiếu bởi các dòng sử dụng dịch vụ. */
    @Id @Column(name="maDichVu", length=10) private String id;
    /** Tên hiển thị của dịch vụ. */
    @Column(name="ten", nullable=false, length=100) private String name;
    /** Đơn giá hiện tại của danh mục; giá lịch sử được chụp ở ServiceUsage. */
    @Column(name="gia", nullable=false, precision=10, scale=2) private BigDecimal price;
    /** Đơn vị tính, mặc định một lần sử dụng. */
    @jakarta.persistence.Convert(converter = com.hospitality.mis.persistence.VietnameseCodeConverters.ServiceUnitConverter.class)
    @Column(name="donViTinh", nullable=false, length=20) private String unit="lần";
    /** Nhóm hiển thị trên cổng khách hàng. */
    @jakarta.persistence.Convert(converter = com.hospitality.mis.persistence.VietnameseCodeConverters.ServiceCategoryConverter.class)
    @Column(name="danhMuc", nullable=false, length=50) private String category="other";
    /** Mô tả công khai của dịch vụ. */
    @Column(name="moTa", length=1000) private String description;
    /** URL ảnh đại diện công khai của dịch vụ. */
    @Column(name="duongDanAnh", length=500) private String imageUrl;
    /** Số lượng tồn kho hiện tại. */
    @Column(name="soLuongTonKho", nullable=false) private int stockQuantity;
    /** Ngưỡng cảnh báo khi tồn kho xuống thấp. */
    @Column(name="nguongAnToan", nullable=false) private int safetyThreshold;
    /** Chỉ dịch vụ active mới được đưa vào public catalog. */
    @Column(name="dangHoatDong", nullable=false) private boolean active = true;
    public String getId(){return id;} public void setId(String v){id=v;}
    public String getName(){return name;} public void setName(String v){name=v;}
    public BigDecimal getPrice(){return price;} public void setPrice(BigDecimal v){price=v;}
    public String getUnit(){return unit;} public void setUnit(String v){unit=v;}
    public String getCategory(){return category;} public void setCategory(String v){category=v;}
    public String getDescription(){return description;} public void setDescription(String v){description=v;}
    public String getImageUrl(){return imageUrl;} public void setImageUrl(String v){imageUrl=v;}
    public int getStockQuantity(){return stockQuantity;} public void setStockQuantity(int v){stockQuantity=v;}
    public int getSafetyThreshold(){return safetyThreshold;} public void setSafetyThreshold(int v){safetyThreshold=v;}
    public boolean isActive(){return active;} public void setActive(boolean v){active=v;}
}
