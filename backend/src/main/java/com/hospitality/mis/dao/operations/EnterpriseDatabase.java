package com.hospitality.mis.dao.operations;

import com.hospitality.mis.common.exception.DomainException;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.sql.SQLException;
import java.util.List;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.math.BigDecimal;
import com.hospitality.mis.dto.operations.EnterpriseDtos;

/** Explicit enterprise read models and procedure calls. No generated entity writes. */
@Repository
public class EnterpriseDatabase {
    private final JdbcTemplate jdbc;
    public EnterpriseDatabase(JdbcTemplate jdbc) { this.jdbc=jdbc; }

    private <T> List<T> read(String sql, RowMapper<T> mapper, Object... args) {
        return jdbc.query(sql,mapper,args);
    }
    private void command(String sql,Object... args) {
        try { jdbc.update(sql,args); } catch(DataAccessException error) { throw translate(error); }
    }
    private long create(String sql,Object... args) {
        try { return jdbc.queryForObject(sql,Long.class,args); } catch(DataAccessException error) { throw translate(error); }
    }
    private static final String VAT="SELECT maHoaDonGiaTriGiaTang,maHoaDon,soHoaDonGiaTriGiaTang,thueSuat,soTienChiuThue,loaiKhachHang,tenKhachHang,maSoThue,tenCongTy,diaChiCongTy,trangThai,trangThaiXml,thoiDiemPhatHanh,nguoiTao FROM dbo.vwHoaDonGiaTriGiaTang";
    private static final String STOCK="SELECT maMatHang,ten,danhMuc,donViTinh,soLuongHienTai,nguongAnToan,maDichVu,dangHoatDong FROM dbo.vwTonKhoHienTai";
    public <T> List<T> ota(RowMapper<T> mapper) {
        return read("SELECT maPhieuDatPhong,hoVaTen,maPhong,nguonDatPhong,doanhThuGop,hoaHongOta,doanhThuRong,trangThaiDoiSoatOta,thoiDiemDat FROM dbo.vwDoiSoatOta ORDER BY thoiDiemDat DESC",mapper);
    }
    public void updateOta(long id,String status){command("EXEC dbo.uspCapNhatDoiSoatOta ?,?",id,status);}
    public <T> List<T> vatInvoices(RowMapper<T> mapper){return read(VAT+" ORDER BY thoiDiemPhatHanh DESC",mapper);}
    public <T> List<T> vatInvoice(long id,RowMapper<T> mapper){return read(VAT+" WHERE maHoaDonGiaTriGiaTang=?",mapper,id);}
    public long createVat(EnterpriseDtos.VatInvoiceRequest request,String number,BigDecimal rate,String customerType,String actor){
        return create("EXEC dbo.uspPhatHanhHoaDonVat ?,?,?,?,?,?,?,?,?,?",request.invoiceId(),number,rate,request.taxableAmount(),customerType,request.customerName().trim(),request.taxCode(),request.companyName(),request.companyAddress(),actor);
    }
    public void saveVatXml(long id,String xml){command("EXEC dbo.uspLuuXmlHoaDonVat ?,?",id,xml);}
    public <T> List<T> attendance(LocalDate date,RowMapper<T> mapper){
        String sql="SELECT maChamCong,maNhanVien,ngayLamViec,thoiDiemVaoCa,thoiDiemRaCa,trangThai,nguonDuLieu,maSuKienThietBi,ghiChu FROM dbo.vwChamCong";
        return date==null?read(sql+" ORDER BY ngayLamViec DESC,maNhanVien",mapper):read(sql+" WHERE ngayLamViec=? ORDER BY ngayLamViec DESC,maNhanVien",mapper,date);
    }
    public void importAttendance(String json,String actor){command("EXEC dbo.uspNhapChamCong ?,?",json,actor);}
    public <T> List<T> leaves(String status,RowMapper<T> mapper){
        String sql="SELECT maDonNghiPhep,maNhanVien,loaiNghiPhep,ngayBatDau,ngayKetThuc,lyDo,maNhanVienDoiCa,trangThai,nguoiYeuCau,nguoiPheDuyet,thoiDiemQuyetDinh,thoiDiemTao FROM dbo.vwDonNghiPhep";
        return status==null?read(sql+" ORDER BY thoiDiemTao DESC",mapper):read(sql+" WHERE trangThai=? ORDER BY thoiDiemTao DESC",mapper,status);
    }
    public long createLeave(EnterpriseDtos.LeaveRequest request,String type,String actor){return create("EXEC dbo.uspTaoDonNghiPhep ?,?,?,?,?,?,?",request.employeeId(),type,request.startDate(),request.endDate(),request.reason().trim(),request.shiftSwapWith(),actor);}
    public void decideLeave(long id,boolean approve,String actor){command("EXEC dbo.uspQuyetDinhNghiPhep ?,?,?",id,approve,actor);}
    public <T> List<T> linen(RowMapper<T> mapper){return read(STOCK+" WHERE danhMuc IN(N'Đồ vải',N'Khăn',N'Đồ dùng',N'Minibar') AND dangHoatDong=1 ORDER BY ten",mapper);}
    public <T> List<T> stock(String id,RowMapper<T> mapper){return read(STOCK+" WHERE maMatHang=?",mapper,id);}
    public void moveStock(EnterpriseDtos.StockMovementRequest request,String type,String actor,LocalDateTime now){command("EXEC dbo.uspDieuChinhTonKho ?,?,?,?,?,?",request.itemId(),type,request.quantity(),actor,request.reason(),now);}
    public <T> List<T> assets(RowMapper<T> mapper){return read("SELECT maTaiSanKyThuat,ten,danhMuc,loaiViTri,maPhong,tang,viTri,thuongHieuMau,ngayLapDat,ngayBaoTriTiepTheo,trangThai,giaTriBanDau,ghiChu,dangHoatDong FROM dbo.vwTaiSanKyThuat WHERE dangHoatDong=1 ORDER BY COALESCE(tang,0),ten",mapper);}
    public void createAsset(EnterpriseDtos.TechnicalAssetRequest request,String locationType,String status){command("EXEC dbo.uspTaoTaiSanKyThuat ?,?,?,?,?,?,?,?,?,?,?,?,?",request.id(),request.name(),request.category(),locationType,request.roomId(),request.floor(),request.location(),request.brandModel(),request.installedOn(),request.nextMaintenance(),status,request.originalValue()==null?BigDecimal.ZERO:request.originalValue(),request.note());}
    public void updateAsset(String id,String status){command("EXEC dbo.uspCapNhatTaiSanKyThuat ?,?",id,status);}
    private RuntimeException translate(DataAccessException error) {
        for(Throwable cause=error;cause!=null;cause=cause.getCause()) {
            if(cause instanceof SQLException sql) {
                String code=switch(sql.getErrorCode()) {
                    case 51006 -> "INSUFFICIENT_STOCK";
                    case 51201 -> "OTA_RESERVATION_NOT_FOUND";
                    case 51202 -> "VAT_EXISTS";
                    case 51203 -> "VAT_NOT_FOUND";
                    case 51204 -> "LEAVE_NOT_PENDING";
                    case 51205 -> "STOCK_ITEM_NOT_FOUND";
                    case 51206 -> "ASSET_NOT_FOUND";
                    case 51207 -> "INVOICE_NOT_FOUND";
                    case 51208 -> "INVALID_LEAVE_PERIOD";
                    case 51209 -> "INVALID_STOCK_MOVEMENT";
                    default -> null;
                };
                if(code!=null) return new DomainException(code,sql.getMessage());
            }
        }
        return error;
    }
}
