-- Clean, deterministic schema for the web hotel MIS.
-- This is a hard cut: the database must be empty before Flyway runs V1.
-- Do not add compatibility aliases, conditional DDL, or legacy table names here.

CREATE TABLE LoaiPhong (
    maLoaiPhong NVARCHAR(10) NOT NULL,
    ten NVARCHAR(50) NOT NULL,
    giaTheoNgay DECIMAL(12, 2) NOT NULL,
    moTa NVARCHAR(500),
    trangThaiDanhMuc NVARCHAR(30) COLLATE Vietnamese_100_CS_AS NOT NULL DEFAULT N'Đang hoạt động',
    nguoiCapNhatDanhMuc NVARCHAR(50),
    nguoiDuyetDanhMuc NVARCHAR(50),
    thoiDiemCapNhatDanhMuc DATETIME2(6),
    thoiDiemDuyetDanhMuc DATETIME2(6),
    maLoaiPhongGoc NVARCHAR(10),
    maLoaiPhongThayThe NVARCHAR(10),
    dienTich DECIMAL(8, 2),
    huongNhin NVARCHAR(100),
    giaTheoGio DECIMAL(12, 2) NOT NULL DEFAULT 0,
    loaiGiuong NVARCHAR(100),
    maHangPhong NVARCHAR(12) NOT NULL DEFAULT N'STD',
    soKhachToiDa INT NOT NULL DEFAULT 2,
    duongDanAnhBia NVARCHAR(500),
    khauHieuQuangBa NVARCHAR(500),
    tenQuangBa NVARCHAR(200),
    moTaQuangBa NVARCHAR(1200),
    CONSTRAINT pkLoaiPhong PRIMARY KEY (maLoaiPhong),
    CONSTRAINT fkLoaiPhong01 FOREIGN KEY (maLoaiPhongGoc) REFERENCES LoaiPhong (maLoaiPhong),
    CONSTRAINT fkLoaiPhong02 FOREIGN KEY (maLoaiPhongThayThe) REFERENCES LoaiPhong (maLoaiPhong),
    CONSTRAINT chkLoaiPhong01 CHECK (giaTheoNgay >= 0),
    CONSTRAINT chkLoaiPhong02 CHECK (giaTheoGio >= 0),
    CONSTRAINT chkLoaiPhong03 CHECK (dienTich IS NULL OR dienTich > 0),
    CONSTRAINT chkLoaiPhong04 CHECK (soKhachToiDa BETWEEN 1 AND 8),
    CONSTRAINT chkLoaiPhong05 CHECK (trangThaiDanhMuc IN (N'Bản nháp', N'Đang hoạt động', N'Bị từ chối', N'Ngừng kinh doanh'))
);


CREATE TABLE Phong (
    maPhong NVARCHAR(10) NOT NULL,
    maLoaiPhong NVARCHAR(10) NOT NULL,
    ten NVARCHAR(100),
    tang INT,
    moTa NVARCHAR(1200),
    trangThai NVARCHAR(30) COLLATE Vietnamese_100_CS_AS NOT NULL DEFAULT N'Sẵn sàng',
    phienBan BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT pkPhong PRIMARY KEY (maPhong),
    CONSTRAINT fkPhong01 FOREIGN KEY (maLoaiPhong) REFERENCES LoaiPhong (maLoaiPhong),
    CONSTRAINT chkPhong01 CHECK (tang IS NULL OR tang >= 0),
    CONSTRAINT chkPhong02 CHECK (trangThai IN (N'Sẵn sàng', N'Đang có khách', N'Đang dọn phòng', N'Đang bảo trì', N'Ngừng sử dụng', N'Đã giữ phòng')),
    CONSTRAINT chkPhong03 CHECK (phienBan >= 0)
);


CREATE TABLE KhachLuuTru (
    maKhachLuuTru BIGINT IDENTITY(1,1) NOT NULL,
    hoVaTen NVARCHAR(100) NOT NULL,
    diaChi NVARCHAR(255),
    soDienThoai NVARCHAR(15) NOT NULL,
    email NVARCHAR(100),
    soGiayToTuyThan NVARCHAR(12) NOT NULL,
    namSinh INT,
    hangThanhVien NVARCHAR(20) COLLATE Vietnamese_100_CS_AS NOT NULL DEFAULT N'Tiêu chuẩn',
    tongChiTieu DECIMAL(14, 2) NOT NULL DEFAULT 0,
    soLanHuyMuon INT NOT NULL DEFAULT 0,
    soLanLuuTruHoanThanh INT NOT NULL DEFAULT 0,
    soLanTraPhongMuon INT NOT NULL DEFAULT 0,
    biChanDatPhong BIT NOT NULL DEFAULT 0,
    phienBan BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT pkKhachLuuTru PRIMARY KEY (maKhachLuuTru),
    CONSTRAINT ukKhachLuuTru01 UNIQUE (soDienThoai),
    CONSTRAINT ukKhachLuuTru03 UNIQUE (soGiayToTuyThan),
    CONSTRAINT chkKhachLuuTru01 CHECK (namSinh IS NULL OR namSinh BETWEEN 1900 AND 2100),
    CONSTRAINT chkKhachLuuTru02 CHECK (tongChiTieu >= 0),
    CONSTRAINT chkKhachLuuTru03 CHECK (soLanHuyMuon >= 0),
    CONSTRAINT chkKhachLuuTru04 CHECK (soLanLuuTruHoanThanh >= 0),
    CONSTRAINT chkKhachLuuTru05 CHECK (soLanTraPhongMuon >= 0),
    CONSTRAINT chkKhachLuuTru06 CHECK (phienBan >= 0)
);


CREATE TABLE NhanVien (
    maNhanVien NVARCHAR(10) NOT NULL,
    hoVaTen NVARCHAR(100) NOT NULL,
    matKhau NVARCHAR(255) NOT NULL,
    vaiTro NVARCHAR(30) COLLATE Vietnamese_100_CS_AS NOT NULL,
    diaChi NVARCHAR(255),
    soDienThoai NVARCHAR(15) NOT NULL,
    duocKichHoat BIT NOT NULL DEFAULT 1,
    taiKhoanKhongBiKhoa BIT NOT NULL DEFAULT 1,
    soLanDangNhapThatBai INT NOT NULL DEFAULT 0,
    thoiDiemDangNhapThatBaiGanNhat DATETIMEOFFSET(6),
    thoiDiemDangNhapGanNhat DATETIMEOFFSET(6),
    trangThaiLamViec NVARCHAR(20) COLLATE Vietnamese_100_CS_AS NOT NULL DEFAULT N'Đang làm việc',
    ngayBatDauNghi DATE,
    ngayKetThucNghi DATE,
    email NVARCHAR(150),
    phaiDoiMatKhau BIT NOT NULL DEFAULT 0,
    CONSTRAINT pkNhanVien PRIMARY KEY (maNhanVien),
    CONSTRAINT ukNhanVien01 UNIQUE (soDienThoai),
    CONSTRAINT chkNhanVien01 CHECK (soLanDangNhapThatBai >= 0),
    CONSTRAINT chkNhanVien02 CHECK (trangThaiLamViec IN (N'Đang làm việc', N'Đang nghỉ phép', N'Đã nghỉ việc')),
    CONSTRAINT chkNhanVien03 CHECK (ngayBatDauNghi IS NULL OR ngayKetThucNghi IS NULL OR ngayKetThucNghi >= ngayBatDauNghi)
);


CREATE TABLE PhieuDatPhong (
    maPhieuDatPhong BIGINT IDENTITY(1,1) NOT NULL,
    maKhachLuuTru BIGINT NOT NULL,
    maNhanVien NVARCHAR(10),
    maTaiKhoanKhachHang BIGINT,
    thoiDiemDat DATETIME2(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    tienDatCoc DECIMAL(12, 2) NOT NULL DEFAULT 0,
    trangThai NVARCHAR(30) COLLATE Vietnamese_100_CS_AS NOT NULL DEFAULT N'Bản nháp',
    hinhThucThue NVARCHAR(20) COLLATE Vietnamese_100_CS_AS NOT NULL DEFAULT N'Theo gói',
    thoiDiemNhanPhongThucTe DATETIME2(6),
    thoiDiemTraPhongThucTe DATETIME2(6),
    lyDoHuy NVARCHAR(500),
    ketQuaHuy NVARCHAR(30) COLLATE Vietnamese_100_CS_AS,
    soPhutGiaHan INT NOT NULL DEFAULT 0,
    khoaChongTrung NVARCHAR(100),
    maThanhToanDatCoc NVARCHAR(40),
    thoiDiemHetHanThanhToanCoc DATETIME2(6),
    trangThaiThanhToanCoc NVARCHAR(20) COLLATE Vietnamese_100_CS_AS NOT NULL DEFAULT N'Không yêu cầu',
    phuongThucBaoDam NVARCHAR(20) COLLATE Vietnamese_100_CS_AS,
    loaiThayDoiDangCho NVARCHAR(20) COLLATE Vietnamese_100_CS_AS,
    thoiDiemNhanPhongTruocThayDoi DATETIME2(6),
    thoiDiemTraPhongTruocThayDoi DATETIME2(6),
    tienDatCocTruocThayDoi DECIMAL(12, 2),
    tienDatCocBoSung DECIMAL(12, 2) NOT NULL DEFAULT 0,
    emailXacNhan NVARCHAR(150),
    nguonDatPhong NVARCHAR(30) COLLATE Vietnamese_100_CS_AS NOT NULL DEFAULT N'Trực tiếp',
    doanhThuGopOta DECIMAL(14,2) NOT NULL DEFAULT 0,
    hoaHongOta DECIMAL(14,2) NOT NULL DEFAULT 0,
    trangThaiDoiSoatOta NVARCHAR(20) COLLATE Vietnamese_100_CS_AS NOT NULL DEFAULT N'Không áp dụng',
    phienBan BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT pkPhieuDatPhong PRIMARY KEY (maPhieuDatPhong),
    CONSTRAINT fkPhieuDatPhong01 FOREIGN KEY (maKhachLuuTru) REFERENCES KhachLuuTru (maKhachLuuTru),
    CONSTRAINT fkPhieuDatPhong02 FOREIGN KEY (maNhanVien) REFERENCES NhanVien (maNhanVien),
    CONSTRAINT chkPhieuDatPhong01 CHECK (tienDatCoc >= 0),
    CONSTRAINT chkPhieuDatPhong02 CHECK (soPhutGiaHan >= 0),
    CONSTRAINT chkPhieuDatPhong03 CHECK (phienBan >= 0),
    CONSTRAINT chkPhieuDatPhong04 CHECK (ketQuaHuy IS NULL OR ketQuaHuy IN (N'Hoàn tiền', N'Không phát sinh hoàn tiền', N'Mất quyền hoàn tiền')),
    CONSTRAINT chkPhieuDatPhong05 CHECK (
        thoiDiemNhanPhongThucTe IS NULL OR thoiDiemTraPhongThucTe IS NULL OR thoiDiemTraPhongThucTe >= thoiDiemNhanPhongThucTe
    ),
    CONSTRAINT chkPhieuDatPhong06 CHECK (phuongThucBaoDam IS NULL OR phuongThucBaoDam IN (N'VNPay', N'Tại khách sạn')),
    CONSTRAINT chkPhieuDatPhong07 CHECK (loaiThayDoiDangCho IS NULL OR loaiThayDoiDangCho IN (N'Gia hạn')),
    CONSTRAINT chkPhieuDatPhong08 CHECK (tienDatCocBoSung >= 0),
    CONSTRAINT chkPhieuDatPhong09 CHECK (
        (loaiThayDoiDangCho IS NULL AND thoiDiemNhanPhongTruocThayDoi IS NULL AND thoiDiemTraPhongTruocThayDoi IS NULL
            AND tienDatCocTruocThayDoi IS NULL AND tienDatCocBoSung = 0)
        OR
        (loaiThayDoiDangCho IS NOT NULL AND thoiDiemNhanPhongTruocThayDoi IS NOT NULL AND thoiDiemTraPhongTruocThayDoi IS NOT NULL
            AND tienDatCocTruocThayDoi IS NOT NULL AND tienDatCocBoSung > 0)
    )
);

-- SQL Server treats NULL as a value in a regular UNIQUE constraint.  The
-- nullable deposit-payment reference is unique only when present (non-NULL)
-- references must be unique.

CREATE TABLE ChiTietDatPhong (
    maPhieuDatPhong BIGINT NOT NULL,
    maPhong NVARCHAR(10) NOT NULL,
    thoiDiemNhanPhong DATETIME2(6) NOT NULL,
    thoiDiemTraPhong DATETIME2(6) NOT NULL,
    thoiDiemTraPhongBanDau DATETIME2(6) NOT NULL,
    trangThai NVARCHAR(30) COLLATE Vietnamese_100_CS_AS NOT NULL DEFAULT N'Đã giữ phòng',
    soLanChuyenPhong INT NOT NULL DEFAULT 0,
    soLuongKhach INT NOT NULL DEFAULT 1,
    CONSTRAINT pkChiTietDatPhong PRIMARY KEY (maPhieuDatPhong, maPhong),
    CONSTRAINT fkChiTietDatPhong01 FOREIGN KEY (maPhieuDatPhong)
        REFERENCES PhieuDatPhong (maPhieuDatPhong) ON DELETE CASCADE,
    CONSTRAINT fkChiTietDatPhong02 FOREIGN KEY (maPhong) REFERENCES Phong (maPhong),
    CONSTRAINT chkChiTietDatPhong01 CHECK (thoiDiemTraPhong > thoiDiemNhanPhong),
    CONSTRAINT chkChiTietDatPhong02 CHECK (thoiDiemTraPhongBanDau >= thoiDiemNhanPhong AND thoiDiemTraPhong >= thoiDiemTraPhongBanDau),
    CONSTRAINT chkChiTietDatPhong03 CHECK (soLanChuyenPhong >= 0),
    CONSTRAINT chkChiTietDatPhong04 CHECK (soLuongKhach > 0),
    CONSTRAINT chkChiTietDatPhong05 CHECK (trangThai IN (N'Sẵn sàng', N'Đang có khách', N'Đang dọn phòng', N'Đang bảo trì', N'Ngừng sử dụng', N'Đã giữ phòng', N'Đã trả phòng', N'Đã hủy'))
);


CREATE TABLE ChuyenPhong (
    maChuyenPhong BIGINT IDENTITY(1,1) NOT NULL,
    maPhieuDatPhong BIGINT NOT NULL,
    maPhongCu NVARCHAR(10) NOT NULL,
    maPhongMoi NVARCHAR(10) NOT NULL,
    thoiDiemChuyenPhong DATETIME2(6),
    lyDo NVARCHAR(255),
    CONSTRAINT pkChuyenPhong PRIMARY KEY (maChuyenPhong),
    CONSTRAINT fkChuyenPhong01 FOREIGN KEY (maPhieuDatPhong)
        REFERENCES PhieuDatPhong (maPhieuDatPhong) ON DELETE CASCADE,
    CONSTRAINT fkChuyenPhong02 FOREIGN KEY (maPhongCu) REFERENCES Phong (maPhong),
    CONSTRAINT fkChuyenPhong03 FOREIGN KEY (maPhongMoi) REFERENCES Phong (maPhong),
    CONSTRAINT chkChuyenPhong01 CHECK (maPhongCu <> maPhongMoi)
);


CREATE TABLE DichVu (
    maDichVu NVARCHAR(10) NOT NULL,
    ten NVARCHAR(100) NOT NULL,
    gia DECIMAL(10, 2) NOT NULL,
    donViTinh NVARCHAR(20) COLLATE Vietnamese_100_CS_AS NOT NULL DEFAULT N'lần',
    soLuongTonKho INT NOT NULL DEFAULT 0,
    nguongAnToan INT NOT NULL DEFAULT 0,
    dangHoatDong BIT NOT NULL DEFAULT 1,
    danhMuc NVARCHAR(50) COLLATE Vietnamese_100_CS_AS NOT NULL DEFAULT N'Khác',
    moTa NVARCHAR(1000),
    duongDanAnh NVARCHAR(500),
    CONSTRAINT pkDichVu PRIMARY KEY (maDichVu),
    CONSTRAINT chkDichVu01 CHECK (gia >= 0),
    CONSTRAINT chkDichVu02 CHECK (soLuongTonKho >= 0),
    CONSTRAINT chkDichVu03 CHECK (nguongAnToan >= 0)
);


CREATE TABLE SuDungDichVu (
    maPhieuDatPhong BIGINT,
    maDichVu NVARCHAR(10) NOT NULL,
    ngaySuDung DATE NOT NULL,
    soLuong INT NOT NULL DEFAULT 1,
    donGia DECIMAL(12, 2) NOT NULL,
    CONSTRAINT pkSuDungDichVu PRIMARY KEY (maPhieuDatPhong, maDichVu, ngaySuDung),
    CONSTRAINT fkSuDungDichVu01 FOREIGN KEY (maPhieuDatPhong)
        REFERENCES PhieuDatPhong (maPhieuDatPhong) ON DELETE CASCADE,
    CONSTRAINT fkSuDungDichVu02 FOREIGN KEY (maDichVu) REFERENCES DichVu (maDichVu),
    CONSTRAINT chkSuDungDichVu01 CHECK (soLuong > 0),
    CONSTRAINT chkSuDungDichVu02 CHECK (donGia >= 0)
);


CREATE TABLE HoaDon (
    maHoaDon BIGINT IDENTITY(1,1) NOT NULL,
    maPhieuDatPhong BIGINT NOT NULL,
    thoiDiemPhatHanh DATETIME2(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    tienGiamGia DECIMAL(12, 2) NOT NULL DEFAULT 0,
    tienDatCocDaTra DECIMAL(12, 2) NOT NULL DEFAULT 0,
    phuongThucThanhToan NVARCHAR(30) COLLATE Vietnamese_100_CS_AS,
    trangThai NVARCHAR(30) COLLATE Vietnamese_100_CS_AS NOT NULL DEFAULT N'Chưa thanh toán',
    tongTienPhong DECIMAL(12, 2) NOT NULL DEFAULT 0,
    tongTienDichVu DECIMAL(12, 2) NOT NULL DEFAULT 0,
    soTienPhaiTra DECIMAL(12, 2) NOT NULL DEFAULT 0,
    tienPhuThu DECIMAL(12, 2) NOT NULL DEFAULT 0,
    tienBoiThuong DECIMAL(12, 2) NOT NULL DEFAULT 0,
    phiGiaHan DECIMAL(12, 2) NOT NULL DEFAULT 0,
    tongTienDieuChinh DECIMAL(12, 2) NOT NULL DEFAULT 0,
    phienBan BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT pkHoaDon PRIMARY KEY (maHoaDon),
    CONSTRAINT ukHoaDon01 UNIQUE (maPhieuDatPhong),
    CONSTRAINT fkHoaDon01 FOREIGN KEY (maPhieuDatPhong) REFERENCES PhieuDatPhong (maPhieuDatPhong),
    CONSTRAINT chkHoaDon01 CHECK (tienGiamGia >= 0),
    CONSTRAINT chkHoaDon02 CHECK (tienDatCocDaTra >= 0),
    CONSTRAINT chkHoaDon03 CHECK (tongTienPhong >= 0),
    CONSTRAINT chkHoaDon04 CHECK (tongTienDichVu >= 0),
    CONSTRAINT chkHoaDon05 CHECK (soTienPhaiTra >= 0),
    CONSTRAINT chkHoaDon06 CHECK (tienPhuThu >= 0),
    CONSTRAINT chkHoaDon07 CHECK (tienBoiThuong >= 0),
    CONSTRAINT chkHoaDon08 CHECK (phiGiaHan >= 0),
    CONSTRAINT chkHoaDon09 CHECK (phienBan >= 0)
);


CREATE TABLE DieuChinhHoaDon (
    maDieuChinhHoaDon BIGINT IDENTITY(1,1) NOT NULL,
    maHoaDon BIGINT NOT NULL,
    soTienChenhLech DECIMAL(12, 2) NOT NULL,
    lyDo NVARCHAR(500) NOT NULL,
    maNguoiThucHien NVARCHAR(50) NOT NULL,
    thoiDiemPhatSinh DATETIME2(6) NOT NULL,
    khoaChongTrung NVARCHAR(100) NOT NULL,
    CONSTRAINT pkDieuChinhHoaDon PRIMARY KEY (maDieuChinhHoaDon),
    CONSTRAINT ukDieuChinhHoaDon01 UNIQUE (khoaChongTrung),
    CONSTRAINT fkDieuChinhHoaDon01 FOREIGN KEY (maHoaDon) REFERENCES HoaDon (maHoaDon),
    CONSTRAINT chkDieuChinhHoaDon01 CHECK (soTienChenhLech <> 0)
);


CREATE TABLE PhieuBaoTri (
    maPhieuBaoTri NVARCHAR(10) NOT NULL,
    maPhong NVARCHAR(10) NOT NULL,
    loaiBaoTri NVARCHAR(100) NOT NULL,
    ngayDuKien DATE NOT NULL,
    trangThai NVARCHAR(30) COLLATE Vietnamese_100_CS_AS NOT NULL DEFAULT N'Chưa xử lý',
    moTa NVARCHAR(255),
    CONSTRAINT pkPhieuBaoTri PRIMARY KEY (maPhieuBaoTri),
    CONSTRAINT fkPhieuBaoTri01 FOREIGN KEY (maPhong) REFERENCES Phong (maPhong)
);


CREATE TABLE SuCoThietBi (
    maSuCoThietBi BIGINT IDENTITY(1,1) NOT NULL,
    maPhieuDatPhong BIGINT NULL,
    maPhong NVARCHAR(10) NOT NULL,
    tenThietBi NVARCHAR(100) NOT NULL,
    giaTriBanDau DECIMAL(14, 2) NOT NULL,
    ngayMua DATE NOT NULL,
    soLuong INT NOT NULL,
    tienBoiThuong DECIMAL(14, 2) NOT NULL,
    thoiDiemTao DATETIME2(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    mucDoNghiemTrong NVARCHAR(20) COLLATE Vietnamese_100_CS_AS NOT NULL DEFAULT N'Trung bình',
    trangThaiBanGiao NVARCHAR(20) COLLATE Vietnamese_100_CS_AS NOT NULL DEFAULT N'Đang mở',
    ghiChuBanGiao NVARCHAR(500),
    CONSTRAINT pkSuCoThietBi PRIMARY KEY (maSuCoThietBi),
    CONSTRAINT fkSuCoThietBi01 FOREIGN KEY (maPhieuDatPhong) REFERENCES PhieuDatPhong (maPhieuDatPhong),
    CONSTRAINT fkSuCoThietBi02 FOREIGN KEY (maPhong) REFERENCES Phong (maPhong),
    CONSTRAINT chkSuCoThietBi01 CHECK (giaTriBanDau >= 0),
    CONSTRAINT chkSuCoThietBi02 CHECK (soLuong > 0),
    CONSTRAINT chkSuCoThietBi03 CHECK (tienBoiThuong >= 0)
);


CREATE TABLE YeuCauPheDuyet (
    maYeuCauPheDuyet BIGINT IDENTITY(1,1) NOT NULL,
    nguoiYeuCau NVARCHAR(50) NOT NULL,
    hanhDong NVARCHAR(50) COLLATE Vietnamese_100_CS_AS NOT NULL,
    maDoiTuong NVARCHAR(100) NOT NULL,
    duLieuThayDoi NVARCHAR(MAX) NOT NULL,
    dauVanTayDuLieu NVARCHAR(64) NOT NULL,
    soTien DECIMAL(19, 4),
    khoaLienKet NVARCHAR(100),
    lyDo NVARCHAR(500) NOT NULL,
    mucDoRuiRo NVARCHAR(20) COLLATE Vietnamese_100_CS_AS NOT NULL DEFAULT N'Thấp',
    thoiDiemYeuCau DATETIMEOFFSET(6) NOT NULL,
    trangThai NVARCHAR(20) COLLATE Vietnamese_100_CS_AS NOT NULL DEFAULT N'Chờ phê duyệt',
    nguoiPheDuyet NVARCHAR(50),
    thoiDiemQuyetDinh DATETIMEOFFSET(6) NULL,
    thoiDiemHetHan DATETIMEOFFSET(6) NOT NULL,
    thoiDiemSuDung DATETIMEOFFSET(6) NULL,
    CONSTRAINT pkYeuCauPheDuyet PRIMARY KEY (maYeuCauPheDuyet)
);


CREATE TABLE NhatKyKiemSoat (
    maNhatKyKiemSoat BIGINT IDENTITY(1,1) NOT NULL,
    nguoiThucHien NVARCHAR(50) NOT NULL,
    hanhDong NVARCHAR(100) NOT NULL,
    loaiDoiTuong NVARCHAR(100) NOT NULL,
    maDoiTuong NVARCHAR(100) NOT NULL,
    duLieuTruoc NVARCHAR(MAX),
    duLieuSau NVARCHAR(MAX),
    lyDo NVARCHAR(500),
    khoaLienKet NVARCHAR(100),
    thoiDiemTao DATETIMEOFFSET(6) NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT pkNhatKyKiemSoat PRIMARY KEY (maNhatKyKiemSoat)
);


CREATE TABLE MaLamMoiDangNhap (
    maMaLamMoiDangNhap BIGINT IDENTITY(1,1) NOT NULL,
    maNhanVien NVARCHAR(10),
    maTaiKhoanKhachHang BIGINT,
    maNhomPhien NVARCHAR(36) NOT NULL,
    maBamToken NVARCHAR(64) NOT NULL,
    thoiDiemPhatHanh DATETIMEOFFSET(6) NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    thoiDiemHetHan DATETIMEOFFSET(6) NOT NULL,
    thoiDiemThuHoi DATETIMEOFFSET(6),
    maBamThayThe NVARCHAR(64),
    CONSTRAINT pkMaLamMoiDangNhap PRIMARY KEY (maMaLamMoiDangNhap),
    CONSTRAINT ukMaLamMoiDangNhap01 UNIQUE (maBamToken),
    CONSTRAINT fkMaLamMoiDangNhap01 FOREIGN KEY (maNhanVien) REFERENCES NhanVien (maNhanVien) ON DELETE CASCADE,
    CONSTRAINT chkMaLamMoiDangNhap01 CHECK ((maNhanVien IS NOT NULL AND maTaiKhoanKhachHang IS NULL) OR (maNhanVien IS NULL AND maTaiKhoanKhachHang IS NOT NULL))
);


CREATE TABLE TaiKhoanKhachHang (
    maTaiKhoanKhachHang BIGINT IDENTITY(1,1) NOT NULL,
    maKhachLuuTru BIGINT NOT NULL,
    soDienThoai NVARCHAR(15) NOT NULL,
    matKhau NVARCHAR(255) NOT NULL,
    duocKichHoat BIT NOT NULL DEFAULT 1,
    taiKhoanKhongBiKhoa BIT NOT NULL DEFAULT 1,
    CONSTRAINT pkTaiKhoanKhachHang PRIMARY KEY (maTaiKhoanKhachHang),
    CONSTRAINT ukTaiKhoanKhachHang01 UNIQUE (maKhachLuuTru),
    CONSTRAINT ukTaiKhoanKhachHang02 UNIQUE (soDienThoai),
    CONSTRAINT fkTaiKhoanKhachHang01 FOREIGN KEY (maKhachLuuTru) REFERENCES KhachLuuTru (maKhachLuuTru) ON DELETE CASCADE
);

ALTER TABLE PhieuDatPhong
    ADD CONSTRAINT fkPhieuDatPhong03
        FOREIGN KEY (maTaiKhoanKhachHang) REFERENCES TaiKhoanKhachHang (maTaiKhoanKhachHang);

CREATE TABLE YeuCauThanhToanVnpay (
    maYeuCauThanhToanVnpay BIGINT IDENTITY(1,1) NOT NULL,
    maPhieuDatPhong BIGINT NOT NULL,
    maThamChieuMerchant NVARCHAR(100) NOT NULL,
    soTien DECIMAL(12,2) NOT NULL,
    trangThai NVARCHAR(20) COLLATE Vietnamese_100_CS_AS NOT NULL DEFAULT N'Chờ thanh toán',
    thoiDiemTao DATETIME2(6) NOT NULL,
    thoiDiemHetHan DATETIME2(6) NOT NULL,
    thoiDiemHoanTat DATETIME2(6),
    maGiaoDichVnpay NVARCHAR(100),
    maNganHang NVARCHAR(20),
    loaiThe NVARCHAR(20),
    maPhanHoi NVARCHAR(10),
    phienBan BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT pkYeuCauThanhToanVnpay PRIMARY KEY (maYeuCauThanhToanVnpay),
    CONSTRAINT ukYeuCauThanhToanVnpay01 UNIQUE (maThamChieuMerchant),
    CONSTRAINT fkYeuCauThanhToanVnpay01 FOREIGN KEY (maPhieuDatPhong)
        REFERENCES PhieuDatPhong (maPhieuDatPhong),
    CONSTRAINT chkYeuCauThanhToanVnpay01 CHECK (soTien > 0),
    CONSTRAINT chkYeuCauThanhToanVnpay02 CHECK (thoiDiemHetHan > thoiDiemTao),
    CONSTRAINT chkYeuCauThanhToanVnpay03 CHECK (phienBan >= 0),
    CONSTRAINT chkYeuCauThanhToanVnpay04 CHECK (trangThai IN (N'Chờ thanh toán', N'Thành công', N'Thất bại', N'Đã hết hạn', N'Đã hủy'))
);


CREATE TABLE GiaoDichThanhToan (
    maGiaoDichThanhToan BIGINT IDENTITY(1,1) NOT NULL,
    maHoaDon BIGINT NOT NULL,
    soTien DECIMAL(12,2) NOT NULL,
    phuongThuc NVARCHAR(30) COLLATE Vietnamese_100_CS_AS NOT NULL,
    loai NVARCHAR(20) COLLATE Vietnamese_100_CS_AS NOT NULL,
    trangThai NVARCHAR(20) COLLATE Vietnamese_100_CS_AS NOT NULL DEFAULT N'Đã hoàn tất',
    maThamChieu NVARCHAR(100),
    thoiDiemPhatSinh DATETIME2(6) NOT NULL,
    maNguoiThucHien NVARCHAR(50) NOT NULL,
    khoaChongTrung NVARCHAR(100),
    maSuKienBenNgoai NVARCHAR(100),
    CONSTRAINT pkGiaoDichThanhToan PRIMARY KEY (maGiaoDichThanhToan),
    CONSTRAINT fkGiaoDichThanhToan01 FOREIGN KEY (maHoaDon) REFERENCES HoaDon (maHoaDon),
    CONSTRAINT chkGiaoDichThanhToan01 CHECK (soTien > 0)
);

-- Nullable external event IDs are unique only when present (filtered unique
-- NULL behavior; SQL Server requires a filtered index for this contract).

CREATE TABLE BienLai (
    maBienLai BIGINT IDENTITY(1,1) NOT NULL,
    soBienLai NVARCHAR(40) NOT NULL,
    maHoaDon BIGINT NOT NULL,
    soTien DECIMAL(12,2) NOT NULL,
    phuongThuc NVARCHAR(30) COLLATE Vietnamese_100_CS_AS NOT NULL,
    thoiDiemPhatHanh DATETIME2(6) NOT NULL,
    nguoiPhatHanh NVARCHAR(50) NOT NULL,
    CONSTRAINT pkBienLai PRIMARY KEY (maBienLai),
    CONSTRAINT ukBienLai01 UNIQUE (soBienLai),
    CONSTRAINT fkBienLai01 FOREIGN KEY (maHoaDon) REFERENCES HoaDon (maHoaDon),
    CONSTRAINT chkBienLai01 CHECK (soTien > 0)
);

CREATE TABLE BanGiaoTienCa (
    maBanGiaoTienCa BIGINT IDENTITY(1,1) NOT NULL,
    maCa NVARCHAR(30) COLLATE Vietnamese_100_CS_AS NOT NULL,
    nguoiBanGiao NVARCHAR(50) NOT NULL,
    nguoiNhanBanGiao NVARCHAR(50) NOT NULL,
    soTienDuKien DECIMAL(14,2) NOT NULL,
    soTienThucTe DECIMAL(14,2) NOT NULL,
    thoiDiemBanGiao DATETIME2(6) NOT NULL,
    ghiChu NVARCHAR(500),
    CONSTRAINT pkBanGiaoTienCa PRIMARY KEY (maBanGiaoTienCa)
);

CREATE TABLE KhoanChi (
    maKhoanChi BIGINT IDENTITY(1,1) NOT NULL,
    danhMuc NVARCHAR(100) NOT NULL,
    moTa NVARCHAR(255) NOT NULL,
    soTien DECIMAL(14,2) NOT NULL,
    nguoiChiTra NVARCHAR(50) NOT NULL,
    thoiDiemChiTra DATETIME2(6) NOT NULL,
    trangThai NVARCHAR(20) COLLATE Vietnamese_100_CS_AS NOT NULL DEFAULT N'Đã ghi nhận',
    CONSTRAINT pkKhoanChi PRIMARY KEY (maKhoanChi),
    CONSTRAINT chkKhoanChi01 CHECK (soTien > 0)
);

CREATE TABLE CongNoDoiTac (
    maCongNoDoiTac BIGINT IDENTITY(1,1) NOT NULL,
    tenDoiTac NVARCHAR(150) NOT NULL,
    maThamChieu NVARCHAR(80) NOT NULL,
    soTien DECIMAL(14,2) NOT NULL,
    soTienDaThanhToan DECIMAL(14,2) NOT NULL DEFAULT 0,
    trangThai NVARCHAR(30) COLLATE Vietnamese_100_CS_AS NOT NULL DEFAULT N'Chưa thanh toán',
    thoiDiemGhiNhan DATETIME2(6) NOT NULL,
    CONSTRAINT pkCongNoDoiTac PRIMARY KEY (maCongNoDoiTac),
    CONSTRAINT ukCongNoDoiTac01 UNIQUE (maThamChieu),
    CONSTRAINT chkCongNoDoiTac01 CHECK (soTien >= 0),
    CONSTRAINT chkCongNoDoiTac02 CHECK (soTienDaThanhToan >= 0 AND soTienDaThanhToan <= soTien)
);

CREATE TABLE BienDongKhoDichVu (
    maBienDongKhoDichVu BIGINT IDENTITY(1,1) NOT NULL,
    maDichVu NVARCHAR(10) NOT NULL,
    loai NVARCHAR(20) COLLATE Vietnamese_100_CS_AS NOT NULL,
    soLuong INT NOT NULL,
    maNguoiThucHien NVARCHAR(50) NOT NULL,
    thoiDiemPhatSinh DATETIME2(6) NOT NULL,
    lyDo NVARCHAR(255),
    CONSTRAINT pkBienDongKhoDichVu PRIMARY KEY (maBienDongKhoDichVu),
    CONSTRAINT fkBienDongKhoDichVu01 FOREIGN KEY (maDichVu) REFERENCES DichVu (maDichVu),
    CONSTRAINT chkBienDongKhoDichVu01 CHECK (soLuong <> 0)
);

CREATE TABLE ThietBiPhong (
    maThietBiPhong BIGINT IDENTITY(1,1) NOT NULL,
    maPhong NVARCHAR(10) NOT NULL,
    ten NVARCHAR(100) NOT NULL,
    giaTriBanDau DECIMAL(14,2) NOT NULL,
    ngayMua DATE NOT NULL,
    soLuong INT NOT NULL,
    dangHoatDong BIT NOT NULL DEFAULT 1,
    CONSTRAINT pkThietBiPhong PRIMARY KEY (maThietBiPhong),
    CONSTRAINT fkThietBiPhong01 FOREIGN KEY (maPhong) REFERENCES Phong (maPhong),
    CONSTRAINT chkThietBiPhong01 CHECK (giaTriBanDau >= 0),
    CONSTRAINT chkThietBiPhong02 CHECK (soLuong > 0)
);

CREATE TABLE LichSuHangThanhVien (
    maLichSuHangThanhVien BIGINT IDENTITY(1,1) NOT NULL,
    maKhachLuuTru BIGINT NOT NULL,
    hangCu NVARCHAR(20) COLLATE Vietnamese_100_CS_AS NOT NULL,
    hangMoi NVARCHAR(20) COLLATE Vietnamese_100_CS_AS NOT NULL,
    lyDo NVARCHAR(255) NOT NULL,
    thoiDiemThayDoi DATETIME2(6) NOT NULL,
    CONSTRAINT pkLichSuHangThanhVien PRIMARY KEY (maLichSuHangThanhVien),
    CONSTRAINT fkLichSuHangThanhVien01 FOREIGN KEY (maKhachLuuTru) REFERENCES KhachLuuTru (maKhachLuuTru)
);


CREATE TABLE TienNghi (
    maTienNghi BIGINT IDENTITY(1,1) NOT NULL,
    ten NVARCHAR(100) NOT NULL,
    dangHoatDong BIT NOT NULL DEFAULT 1,
    CONSTRAINT pkTienNghi PRIMARY KEY (maTienNghi),
    CONSTRAINT ukTienNghi01 UNIQUE (ten)
);

CREATE TABLE LoaiPhongTienNghi (
    maLoaiPhong NVARCHAR(10) NOT NULL,
    maTienNghi BIGINT NOT NULL,
    CONSTRAINT pkLoaiPhongTienNghi PRIMARY KEY (maLoaiPhong, maTienNghi),
    CONSTRAINT fkLoaiPhongTienNghi01 FOREIGN KEY (maLoaiPhong) REFERENCES LoaiPhong (maLoaiPhong),
    CONSTRAINT fkLoaiPhongTienNghi02 FOREIGN KEY (maTienNghi) REFERENCES TienNghi (maTienNghi)
);


CREATE TABLE HinhAnhPhong (
    maHinhAnhPhong BIGINT IDENTITY(1,1) NOT NULL,
    maPhong NVARCHAR(10) NOT NULL,
    duongDanTuongDoi NVARCHAR(255) NOT NULL,
    thuTuHienThi INT NOT NULL DEFAULT 0,
    laAnhBia BIT NOT NULL DEFAULT 0,
    loaiNoiDung NVARCHAR(40) NOT NULL,
    kichThuocByte BIGINT NOT NULL,
    dangHoatDong BIT NOT NULL DEFAULT 1,
    CONSTRAINT pkHinhAnhPhong PRIMARY KEY (maHinhAnhPhong),
    CONSTRAINT ukHinhAnhPhong01 UNIQUE (duongDanTuongDoi),
    CONSTRAINT fkHinhAnhPhong01 FOREIGN KEY (maPhong) REFERENCES Phong (maPhong),
    CONSTRAINT chkHinhAnhPhong01 CHECK (thuTuHienThi >= 0),
    CONSTRAINT chkHinhAnhPhong02 CHECK (kichThuocByte > 0 AND kichThuocByte <= 5242880)
);


CREATE TABLE BanGhiChongTrung (
    maBanGhiChongTrung BIGINT IDENTITY(1,1) NOT NULL,
    phamViLenh NVARCHAR(100) NOT NULL,
    khoaChongTrung NVARCHAR(100) NOT NULL,
    nguoiThucHien NVARCHAR(100) NOT NULL,
    maBamYeuCau NVARCHAR(64) NOT NULL,
    trangThai NVARCHAR(20) COLLATE Vietnamese_100_CS_AS NOT NULL,
    loaiPhanHoi NVARCHAR(255),
    phanHoiJson NVARCHAR(MAX),
    thoiDiemTao DATETIME2(6) NOT NULL,
    thoiDiemHoanThanh DATETIME2(6),
    phienBan BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT pkBanGhiChongTrung PRIMARY KEY (maBanGhiChongTrung),
    CONSTRAINT ukBanGhiChongTrung01 UNIQUE (phamViLenh, khoaChongTrung)
);


CREATE TABLE NhomKhoaChongTrung (
    maNhomKhoa SMALLINT NOT NULL,
    CONSTRAINT pkNhomKhoaChongTrung PRIMARY KEY (maNhomKhoa)
);

-- Fixed lock stripes are application infrastructure, not demo business data.
INSERT INTO NhomKhoaChongTrung (maNhomKhoa) VALUES
    (0),(1),(2),(3),(4),(5),(6),(7),(8),(9),(10),(11),(12),(13),(14),(15),
    (16),(17),(18),(19),(20),(21),(22),(23),(24),(25),(26),(27),(28),(29),(30),(31),
    (32),(33),(34),(35),(36),(37),(38),(39),(40),(41),(42),(43),(44),(45),(46),(47),
    (48),(49),(50),(51),(52),(53),(54),(55),(56),(57),(58),(59),(60),(61),(62),(63);

CREATE TABLE LichSuGiaLoaiPhong (
    maLichSuGiaLoaiPhong BIGINT IDENTITY(1,1) NOT NULL,
    maLoaiPhong NVARCHAR(10) NOT NULL,
    giaTheoNgay DECIMAL(12,2) NOT NULL,
    nguoiThayDoi NVARCHAR(50) NOT NULL,
    maYeuCauPheDuyet BIGINT,
    thoiDiemHieuLuc DATETIME2(6) NOT NULL,
    CONSTRAINT pkLichSuGiaLoaiPhong PRIMARY KEY (maLichSuGiaLoaiPhong),
    CONSTRAINT fkLichSuGiaLoaiPhong01 FOREIGN KEY (maLoaiPhong) REFERENCES LoaiPhong (maLoaiPhong),
    CONSTRAINT fkLichSuGiaLoaiPhong02 FOREIGN KEY (maYeuCauPheDuyet) REFERENCES YeuCauPheDuyet (maYeuCauPheDuyet)
);


CREATE TABLE NhiemVuBuongPhong (
    maNhiemVuBuongPhong BIGINT IDENTITY(1,1) NOT NULL,
    maPhong NVARCHAR(10) NOT NULL,
    nguoiDuocPhanCong NVARCHAR(10),
    trangThai NVARCHAR(30) COLLATE Vietnamese_100_CS_AS NOT NULL,
    daHoanThanhChecklist BIT NOT NULL DEFAULT 0,
    coSuCoChan BIT NOT NULL DEFAULT 0,
    ghiChu NVARCHAR(500),
    nguoiPhanCong NVARCHAR(10),
    thoiDiemCapNhat DATETIME2(6) NOT NULL,
    CONSTRAINT pkNhiemVuBuongPhong PRIMARY KEY (maNhiemVuBuongPhong),
    CONSTRAINT fkNhiemVuBuongPhong01 FOREIGN KEY (maPhong) REFERENCES Phong (maPhong),
    CONSTRAINT chkNhiemVuBuongPhong01 CHECK (trangThai IN (N'Cần dọn phòng',N'Đang thực hiện',N'Đã dọn xong',N'Sẵn sàng',N'Chờ kỹ thuật'))
);


CREATE TABLE PhieuCongViecKyThuat (
    maPhieuCongViecKyThuat BIGINT IDENTITY(1,1) NOT NULL,
    maPhong NVARCHAR(10) NOT NULL,
    maThietBiPhong BIGINT,
    nguoiDuocPhanCong NVARCHAR(10),
    doUuTien NVARCHAR(20) COLLATE Vietnamese_100_CS_AS NOT NULL,
    thoiHanSla DATETIME2(6),
    vatTuSuDung NVARCHAR(1000),
    ghiChuKetQua NVARCHAR(1000),
    ghiChuNghiemThu NVARCHAR(1000),
    nguoiNghiemThu NVARCHAR(50),
    thoiDiemNghiemThu DATETIME2(6),
    trangThai NVARCHAR(30) COLLATE Vietnamese_100_CS_AS NOT NULL,
    nguoiTao NVARCHAR(10) NOT NULL,
    thoiDiemTao DATETIME2(6) NOT NULL,
    thoiDiemCapNhat DATETIME2(6) NOT NULL,
    CONSTRAINT pkPhieuCongViecKyThuat PRIMARY KEY (maPhieuCongViecKyThuat),
    CONSTRAINT fkPhieuCongViecKyThuat01 FOREIGN KEY (maPhong) REFERENCES Phong (maPhong),
    CONSTRAINT fkPhieuCongViecKyThuat02 FOREIGN KEY (maThietBiPhong) REFERENCES ThietBiPhong (maThietBiPhong),
    CONSTRAINT chkPhieuCongViecKyThuat01 CHECK (trangThai IN (N'Mới tạo',N'Đã tiếp nhận',N'Đang thực hiện',N'Chờ nghiệm thu',N'Đã hoàn thành',N'Đã bàn giao phòng')),
    CONSTRAINT chkPhieuCongViecKyThuat02 CHECK (doUuTien IN (N'Thấp',N'Trung bình',N'Cao',N'Nghiêm trọng'))
);


CREATE TABLE LichSuGiaDichVu (
    maLichSuGiaDichVu BIGINT IDENTITY(1,1) NOT NULL,
    maDichVu NVARCHAR(10) NOT NULL,
    gia DECIMAL(10,2) NOT NULL,
    nguoiThayDoi NVARCHAR(50) NOT NULL,
    maYeuCauPheDuyet BIGINT,
    thoiDiemHieuLuc DATETIME2(6) NOT NULL,
    CONSTRAINT pkLichSuGiaDichVu PRIMARY KEY (maLichSuGiaDichVu),
    CONSTRAINT fkLichSuGiaDichVu01 FOREIGN KEY (maDichVu) REFERENCES DichVu (maDichVu),
    CONSTRAINT fkLichSuGiaDichVu02 FOREIGN KEY (maYeuCauPheDuyet) REFERENCES YeuCauPheDuyet (maYeuCauPheDuyet)
);


CREATE TABLE HangDoiThongBao (
    maThongBao BIGINT IDENTITY(1,1) NOT NULL,
    chuDe NVARCHAR(100) NOT NULL,
    vaiTroNguoiNhan NVARCHAR(30) COLLATE Vietnamese_100_CS_AS NOT NULL,
    noiDung NVARCHAR(MAX) NOT NULL,
    trangThai NVARCHAR(20) COLLATE Vietnamese_100_CS_AS NOT NULL,
    khoaChongLap NVARCHAR(150) NOT NULL,
    thoiDiemCoTheGui DATETIME2(6) NOT NULL,
    thoiDiemTao DATETIME2(6) NOT NULL,
    thoiDiemGui DATETIME2(6),
    CONSTRAINT pkHangDoiThongBao PRIMARY KEY (maThongBao),
    CONSTRAINT ukHangDoiThongBao01 UNIQUE (khoaChongLap)
);


CREATE TABLE CaLamViecNhanVien (
    maCaLamViecNhanVien BIGINT IDENTITY(1,1) NOT NULL,
    maNhanVien NVARCHAR(10) NOT NULL,
    ngayLamCa DATE NOT NULL,
    maCa NVARCHAR(30) COLLATE Vietnamese_100_CS_AS NOT NULL,
    thoiDiemBatDau DATETIME2(6) NOT NULL,
    thoiDiemKetThuc DATETIME2(6) NOT NULL,
    trangThai NVARCHAR(20) COLLATE Vietnamese_100_CS_AS NOT NULL,
    nguoiTao NVARCHAR(10) NOT NULL,
    CONSTRAINT pkCaLamViecNhanVien PRIMARY KEY (maCaLamViecNhanVien),
    CONSTRAINT fkCaLamViecNhanVien01 FOREIGN KEY (maNhanVien) REFERENCES NhanVien (maNhanVien),
    CONSTRAINT chkCaLamViecNhanVien01 CHECK (trangThai IN (N'Đã phân công',N'Đã bắt đầu',N'Đã hoàn thành',N'Đã hủy'))
);


CREATE TABLE MauChecklistBuongPhong (
    maMauChecklist BIGINT IDENTITY(1,1) NOT NULL,
    ten NVARCHAR(100) NOT NULL,
    dangHoatDong BIT NOT NULL DEFAULT 1,
    CONSTRAINT pkMauChecklistBuongPhong PRIMARY KEY (maMauChecklist),
    CONSTRAINT ukMauChecklistBuongPhong01 UNIQUE (ten)
);

CREATE TABLE KetQuaChecklistBuongPhong (
    maKetQuaChecklist BIGINT IDENTITY(1,1) NOT NULL,
    maNhiemVuBuongPhong BIGINT NOT NULL,
    hangMuc NVARCHAR(200) NOT NULL,
    datYeuCau BIT NOT NULL,
    ghiChu NVARCHAR(500),
    nguoiHoanThanh NVARCHAR(10) NOT NULL,
    thoiDiemHoanThanh DATETIME2(6) NOT NULL,
    CONSTRAINT pkKetQuaChecklistBuongPhong PRIMARY KEY (maKetQuaChecklist),
    CONSTRAINT fkKetQuaChecklistBuongPhong01 FOREIGN KEY (maNhiemVuBuongPhong) REFERENCES NhiemVuBuongPhong (maNhiemVuBuongPhong)
);


CREATE TABLE KiemTraBuongPhong (
    maKiemTraBuongPhong BIGINT IDENTITY(1,1) NOT NULL,
    maNhiemVuBuongPhong BIGINT NOT NULL,
    loaiKiemTra NVARCHAR(20) COLLATE Vietnamese_100_CS_AS NOT NULL,
    hangMuc NVARCHAR(100) NOT NULL,
    soLuong INT NOT NULL DEFAULT 0,
    tinhTrangHangMuc NVARCHAR(20) COLLATE Vietnamese_100_CS_AS NOT NULL,
    ghiChu NVARCHAR(500),
    nguoiHoanThanh NVARCHAR(10) NOT NULL,
    thoiDiemHoanThanh DATETIME2(6) NOT NULL,
    CONSTRAINT pkKiemTraBuongPhong PRIMARY KEY (maKiemTraBuongPhong),
    CONSTRAINT fkKiemTraBuongPhong01 FOREIGN KEY (maNhiemVuBuongPhong) REFERENCES NhiemVuBuongPhong (maNhiemVuBuongPhong)
);


CREATE TABLE ThanhToanCongNoDoiTac (
    maThanhToanCongNo BIGINT IDENTITY(1,1) NOT NULL,
    maCongNoDoiTac BIGINT NOT NULL,
    soTien DECIMAL(14,2) NOT NULL,
    nguoiThanhToan NVARCHAR(50) NOT NULL,
    thoiDiemThanhToan DATETIME2(6) NOT NULL,
    ghiChu NVARCHAR(500),
    CONSTRAINT pkThanhToanCongNoDoiTac PRIMARY KEY (maThanhToanCongNo),
    CONSTRAINT fkThanhToanCongNoDoiTac01 FOREIGN KEY (maCongNoDoiTac) REFERENCES CongNoDoiTac (maCongNoDoiTac),
    CONSTRAINT chkThanhToanCongNoDoiTac01 CHECK (soTien > 0)
);


CREATE TABLE ButToanTaiChinh (
    maButToanTaiChinh BIGINT IDENTITY(1,1) NOT NULL,
    loaiButToan NVARCHAR(40) NOT NULL,
    loaiNguon NVARCHAR(40) NOT NULL,
    maNguon NVARCHAR(100) NOT NULL,
    chieuButToan NVARCHAR(10) COLLATE Vietnamese_100_CS_AS NOT NULL,
    soTien DECIMAL(14,2) NOT NULL,
    maNguoiThucHien NVARCHAR(50) NOT NULL,
    thoiDiemPhatSinh DATETIME2(6) NOT NULL,
    ghiChu NVARCHAR(500),
    daChotSo BIT NOT NULL DEFAULT 1,
    CONSTRAINT pkButToanTaiChinh PRIMARY KEY (maButToanTaiChinh),
    CONSTRAINT chkButToanTaiChinh01 CHECK (chieuButToan IN (N'Ghi nợ',N'Ghi có')),
    CONSTRAINT chkButToanTaiChinh02 CHECK (soTien > 0)
);


CREATE TABLE SuKienDangNhapNhanVien (
    maSuKienDangNhap BIGINT IDENTITY(1,1) NOT NULL,
    maNhanVien NVARCHAR(10) NOT NULL,
    thoiDiemPhatSinh DATETIMEOFFSET(6) NOT NULL,
    ketQua NVARCHAR(20) COLLATE Vietnamese_100_CS_AS NOT NULL,
    CONSTRAINT pkSuKienDangNhapNhanVien PRIMARY KEY (maSuKienDangNhap),
    CONSTRAINT fkSuKienDangNhapNhanVien01 FOREIGN KEY (maNhanVien)
        REFERENCES NhanVien (maNhanVien) ON DELETE CASCADE,
    CONSTRAINT chkSuKienDangNhapNhanVien01 CHECK (ketQua IN (N'Thành công',N'Thất bại'))
);


CREATE TABLE HoaDonGiaTriGiaTang (
    maHoaDonGiaTriGiaTang BIGINT IDENTITY(1,1) NOT NULL,
    maHoaDon BIGINT NOT NULL,
    soHoaDonGiaTriGiaTang NVARCHAR(40) NOT NULL,
    thueSuat DECIMAL(5,2) NOT NULL DEFAULT 8.00,
    soTienChiuThue DECIMAL(14,2) NOT NULL,
    loaiKhachHang NVARCHAR(20) COLLATE Vietnamese_100_CS_AS NOT NULL DEFAULT N'Cá nhân',
    tenKhachHang NVARCHAR(200) NOT NULL,
    maSoThue NVARCHAR(30),
    tenCongTy NVARCHAR(200),
    diaChiCongTy NVARCHAR(500),
    trangThai NVARCHAR(30) COLLATE Vietnamese_100_CS_AS NOT NULL DEFAULT N'Bản nháp',
    trangThaiXml NVARCHAR(20) COLLATE Vietnamese_100_CS_AS NOT NULL DEFAULT N'Chưa xuất',
    noiDungXml NVARCHAR(MAX),
    thoiDiemPhatHanh DATETIME2(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    nguoiTao NVARCHAR(50) NOT NULL,
    CONSTRAINT pkHoaDonGiaTriGiaTang PRIMARY KEY (maHoaDonGiaTriGiaTang),
    CONSTRAINT ukHoaDonGiaTriGiaTang01 UNIQUE (maHoaDon),
    CONSTRAINT ukHoaDonGiaTriGiaTang02 UNIQUE (soHoaDonGiaTriGiaTang),
    CONSTRAINT fkHoaDonGiaTriGiaTang01 FOREIGN KEY (maHoaDon) REFERENCES HoaDon (maHoaDon),
    CONSTRAINT chkHoaDonGiaTriGiaTang01 CHECK (thueSuat >= 0 AND thueSuat <= 100),
    CONSTRAINT chkHoaDonGiaTriGiaTang02 CHECK (soTienChiuThue >= 0)
);

CREATE TABLE ChamCong (
    maChamCong BIGINT IDENTITY(1,1) NOT NULL,
    maNhanVien NVARCHAR(10) NOT NULL,
    ngayLamViec DATE NOT NULL,
    thoiDiemVaoCa DATETIME2(6),
    thoiDiemRaCa DATETIME2(6),
    trangThai NVARCHAR(20) COLLATE Vietnamese_100_CS_AS NOT NULL DEFAULT N'Có mặt',
    nguonDuLieu NVARCHAR(30) COLLATE Vietnamese_100_CS_AS NOT NULL DEFAULT N'Nhập thủ công',
    maSuKienThietBi NVARCHAR(100),
    ghiChu NVARCHAR(500),
    thoiDiemNhap DATETIME2(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    nguoiNhap NVARCHAR(50) NOT NULL,
    CONSTRAINT pkChamCong PRIMARY KEY (maChamCong),
    CONSTRAINT ukChamCong01 UNIQUE (maNhanVien, ngayLamViec),
    CONSTRAINT fkChamCong01 FOREIGN KEY (maNhanVien) REFERENCES NhanVien (maNhanVien),
    CONSTRAINT chkChamCong01 CHECK (nguonDuLieu IN (N'Nhập thủ công', N'Nhập từ máy chấm công'))
);

CREATE TABLE DonNghiPhep (
    maDonNghiPhep BIGINT IDENTITY(1,1) NOT NULL,
    maNhanVien NVARCHAR(10) NOT NULL,
    loaiNghiPhep NVARCHAR(30) COLLATE Vietnamese_100_CS_AS NOT NULL,
    ngayBatDau DATE NOT NULL,
    ngayKetThuc DATE NOT NULL,
    lyDo NVARCHAR(500) NOT NULL,
    maNhanVienDoiCa NVARCHAR(10),
    trangThai NVARCHAR(20) COLLATE Vietnamese_100_CS_AS NOT NULL DEFAULT N'Chờ phê duyệt',
    nguoiYeuCau NVARCHAR(50) NOT NULL,
    nguoiPheDuyet NVARCHAR(50),
    thoiDiemQuyetDinh DATETIME2(6),
    thoiDiemTao DATETIME2(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pkDonNghiPhep PRIMARY KEY (maDonNghiPhep),
    CONSTRAINT fkDonNghiPhep01 FOREIGN KEY (maNhanVien) REFERENCES NhanVien (maNhanVien),
    CONSTRAINT fkDonNghiPhep02 FOREIGN KEY (maNhanVienDoiCa) REFERENCES NhanVien (maNhanVien),
    CONSTRAINT chkDonNghiPhep01 CHECK (ngayKetThuc >= ngayBatDau),
    CONSTRAINT chkDonNghiPhepTrangThai CHECK (trangThai IN (N'Chờ phê duyệt', N'Đã phê duyệt', N'Bị từ chối'))
);


CREATE TABLE MatHangTonKho (
    maMatHang NVARCHAR(30) NOT NULL,
    ten NVARCHAR(150) NOT NULL,
    danhMuc NVARCHAR(30) COLLATE Vietnamese_100_CS_AS NOT NULL,
    donViTinh NVARCHAR(20) NOT NULL,
    soLuongHienTai INT NOT NULL DEFAULT 0,
    nguongAnToan INT NOT NULL DEFAULT 0,
    maDichVu NVARCHAR(10),
    dangHoatDong BIT NOT NULL DEFAULT 1,
    CONSTRAINT pkMatHangTonKho PRIMARY KEY (maMatHang),
    CONSTRAINT fkMatHangTonKho01 FOREIGN KEY (maDichVu) REFERENCES DichVu (maDichVu),
    CONSTRAINT chkMatHangTonKho01 CHECK (soLuongHienTai >= 0 AND nguongAnToan >= 0)
);

CREATE TABLE BienDongTonKho (
    maBienDongTonKho BIGINT IDENTITY(1,1) NOT NULL,
    maMatHang NVARCHAR(30) NOT NULL,
    loaiBienDong NVARCHAR(20) COLLATE Vietnamese_100_CS_AS NOT NULL,
    soLuong INT NOT NULL,
    maNguoiThucHien NVARCHAR(50) NOT NULL,
    thoiDiemPhatSinh DATETIME2(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    lyDo NVARCHAR(255),
    CONSTRAINT pkBienDongTonKho PRIMARY KEY (maBienDongTonKho),
    CONSTRAINT fkBienDongTonKho01 FOREIGN KEY (maMatHang) REFERENCES MatHangTonKho (maMatHang),
    CONSTRAINT chkBienDongTonKho01 CHECK (soLuong > 0)
);


CREATE TABLE TaiSanKyThuat (
    maTaiSanKyThuat NVARCHAR(30) NOT NULL,
    ten NVARCHAR(150) NOT NULL,
    danhMuc NVARCHAR(50) NOT NULL,
    loaiViTri NVARCHAR(20) COLLATE Vietnamese_100_CS_AS NOT NULL,
    maPhong NVARCHAR(10),
    tang INT,
    viTri NVARCHAR(150) NOT NULL,
    thuongHieuMau NVARCHAR(150),
    ngayLapDat DATE,
    ngayBaoTriTiepTheo DATE,
    trangThai NVARCHAR(30) COLLATE Vietnamese_100_CS_AS NOT NULL DEFAULT N'Tốt',
    giaTriBanDau DECIMAL(14,2) NOT NULL DEFAULT 0,
    ghiChu NVARCHAR(500),
    dangHoatDong BIT NOT NULL DEFAULT 1,
    CONSTRAINT pkTaiSanKyThuat PRIMARY KEY (maTaiSanKyThuat),
    CONSTRAINT fkTaiSanKyThuat01 FOREIGN KEY (maPhong) REFERENCES Phong (maPhong),
    CONSTRAINT chkTaiSanKyThuat01 CHECK (giaTriBanDau >= 0)
);


CREATE TABLE ChiTietTienBanGiao (
    maChiTietTienBanGiao BIGINT IDENTITY(1,1) NOT NULL,
    maBanGiaoTienCa BIGINT NOT NULL,
    menhGia DECIMAL(12,2) NOT NULL,
    soLuong INT NOT NULL,
    CONSTRAINT pkChiTietTienBanGiao PRIMARY KEY (maChiTietTienBanGiao),
    CONSTRAINT fkChiTietTienBanGiao01 FOREIGN KEY (maBanGiaoTienCa)
        REFERENCES BanGiaoTienCa (maBanGiaoTienCa) ON DELETE CASCADE,
    CONSTRAINT chkChiTietTienBanGiao01 CHECK (menhGia > 0 AND soLuong > 0)
);


CREATE TABLE DatDichVuKhachSan (
    maDatDichVuKhachSan BIGINT IDENTITY(1,1) NOT NULL,
    maPhieuDatPhong BIGINT NOT NULL,
    maPhong NVARCHAR(10) NOT NULL,
    maDichVu NVARCHAR(10) NOT NULL,
    thoiDiemDuKien DATETIME2(6) NOT NULL,
    buoiAn NVARCHAR(10) COLLATE Vietnamese_100_CS_AS,
    soLuong INT NOT NULL,
    soLuongMienPhi INT NOT NULL DEFAULT 0,
    donGia DECIMAL(12,2) NOT NULL,
    trangThai NVARCHAR(20) COLLATE Vietnamese_100_CS_AS NOT NULL DEFAULT N'Đã xác nhận',
    ghiChu NVARCHAR(500),
    khoaYeuCau NVARCHAR(100) NOT NULL,
    maBamYeuCau NCHAR(64) NOT NULL,
    nguoiTao NVARCHAR(80) NOT NULL,
    thoiDiemTao DATETIME2(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    thoiDiemSuDung DATETIME2(6),
    nguoiXacNhanSuDung NVARCHAR(80),
    CONSTRAINT pkDatDichVuKhachSan PRIMARY KEY (maDatDichVuKhachSan),
    CONSTRAINT ukDatDichVuKhachSan01 UNIQUE (khoaYeuCau),
    CONSTRAINT fkDatDichVuKhachSan01 FOREIGN KEY (maPhieuDatPhong, maPhong)
        REFERENCES ChiTietDatPhong (maPhieuDatPhong, maPhong),
    CONSTRAINT fkDatDichVuKhachSan02 FOREIGN KEY (maDichVu) REFERENCES DichVu (maDichVu),
    CONSTRAINT chkDatDichVuKhachSan01 CHECK (soLuong > 0 AND soLuongMienPhi >= 0 AND soLuongMienPhi <= soLuong),
    CONSTRAINT chkDatDichVuKhachSan02 CHECK (donGia >= 0),
    CONSTRAINT chkDatDichVuKhachSan03 CHECK (buoiAn IS NULL OR buoiAn IN (N'Bữa trưa', N'Bữa tối')),
    CONSTRAINT chkDatDichVuKhachSan04 CHECK (trangThai IN (N'Đã xác nhận', N'Đã sử dụng', N'Đã hủy'))
);


-- Final baseline table constraints. Later object types are owned by V2-V5.

ALTER TABLE BanGhiChongTrung ADD CONSTRAINT chkBanGhiChongTrungtrangThai CHECK (trangThai IN (N'Đang xử lý', N'Đã hoàn tất'));
ALTER TABLE BanGiaoTienCa ADD CONSTRAINT chkBanGiaoTienCamaCa CHECK (maCa IN (N'Ca sáng', N'Ca chiều', N'Ca đêm') OR (maCa NOT LIKE N'%[^-A-Za-z0-9_]%' COLLATE Latin1_General_100_BIN2 AND maCa LIKE N'[A-Za-z]%' COLLATE Latin1_General_100_BIN2 AND LEN(maCa) BETWEEN 1 AND 30));
ALTER TABLE BienDongKhoDichVu ADD CONSTRAINT chkBienDongKhoDichVuloai CHECK (loai IN (N'Nhập kho', N'Xuất kho', N'Điều chỉnh', N'Hao hụt', N'Hoàn kho'));
ALTER TABLE BienDongTonKho ADD CONSTRAINT chkBienDongTonKholoaiBienDong CHECK (loaiBienDong IN (N'Nhập kho', N'Hoàn kho', N'Xuất kho', N'Hao hụt', N'Điều chỉnh'));
ALTER TABLE BienLai ADD CONSTRAINT chkBienLaiphuongThuc CHECK (phuongThuc IN (N'Tiền mặt', N'Thẻ', N'Chuyển khoản ngân hàng'));
ALTER TABLE CaLamViecNhanVien ADD CONSTRAINT chkCaLamViecNhanVienmaCa CHECK (maCa IN (N'Ca sáng', N'Ca chiều', N'Ca đêm') OR (maCa NOT LIKE N'%[^-A-Za-z0-9_]%' COLLATE Latin1_General_100_BIN2 AND maCa LIKE N'[A-Za-z]%' COLLATE Latin1_General_100_BIN2 AND LEN(maCa) BETWEEN 1 AND 30));
ALTER TABLE ChamCong ADD CONSTRAINT chkChamCongtrangThai CHECK (trangThai IN (N'Có mặt', N'Đi muộn', N'Vắng mặt', N'Nghỉ phép'));
ALTER TABLE CongNoDoiTac ADD CONSTRAINT chkCongNoDoiTactrangThai CHECK (trangThai IN (N'Chưa thanh toán', N'Đã thanh toán một phần', N'Đã thanh toán', N'Đã hủy'));
ALTER TABLE DichVu ADD CONSTRAINT chkDichVudanhMuc CHECK (danhMuc IN (N'Dịch vụ doanh nghiệp', N'Nhà hàng cao cấp', N'Dịch vụ tại phòng', N'Giặt ủi', N'Khác', N'Giải trí', N'Spa', N'Đưa đón'));
ALTER TABLE DichVu ADD CONSTRAINT chkDichVudonViTinh CHECK (donViTinh IN (N'bộ', N'lần', N'suất', N'món', N'đêm', N'lượt', N'chuyến', N'khách', N'khách/ngày', N'giờ', N'ngày', N'chai', N'đơn vị'));
ALTER TABLE DonNghiPhep ADD CONSTRAINT chkDonNghiPheploaiNghiPhep CHECK (loaiNghiPhep IN (N'Nghỉ phép năm', N'Nghỉ ốm', N'Đổi ca trực', N'Việc riêng'));
ALTER TABLE GiaoDichThanhToan ADD CONSTRAINT chkGiaoDichThanhToanloai CHECK (loai IN (N'Thanh toán', N'Hoàn tiền'));
ALTER TABLE GiaoDichThanhToan ADD CONSTRAINT chkGiaoDichThanhToanphuongThuc CHECK (phuongThuc IN (N'Tiền mặt', N'Thẻ', N'Chuyển khoản ngân hàng'));
ALTER TABLE GiaoDichThanhToan ADD CONSTRAINT chkGiaoDichThanhToantrangThai CHECK (trangThai IN (N'Đã hoàn tất', N'Thất bại', N'Đã vô hiệu'));
ALTER TABLE HangDoiThongBao ADD CONSTRAINT chkHangDoiThongBaotrangThai CHECK (trangThai IN (N'Chờ gửi', N'Đã gửi', N'Gửi thất bại'));
ALTER TABLE HangDoiThongBao ADD CONSTRAINT chkHangDoiThongBaovaiTroNguoiNhan CHECK (vaiTroNguoiNhan IN (N'Quản trị viên', N'Giám đốc', N'Quản lý', N'Lễ tân', N'Kế toán', N'Buồng phòng', N'Kỹ thuật', N'Nhà bếp', N'Nhân viên', N'Nhân sự'));
ALTER TABLE HoaDon ADD CONSTRAINT chkHoaDonphuongThucThanhToan CHECK (phuongThucThanhToan IN (N'Tiền mặt', N'Thẻ', N'Chuyển khoản ngân hàng'));
ALTER TABLE HoaDon ADD CONSTRAINT chkHoaDontrangThai CHECK (trangThai IN (N'Đã thanh toán', N'Chưa thanh toán', N'Dự kiến'));
ALTER TABLE HoaDonGiaTriGiaTang ADD CONSTRAINT chkHoaDonGiaTriGiaTangloaiKhachHang CHECK (loaiKhachHang IN (N'Cá nhân', N'Doanh nghiệp'));
ALTER TABLE HoaDonGiaTriGiaTang ADD CONSTRAINT chkHoaDonGiaTriGiaTangtrangThai CHECK (trangThai IN (N'Bản nháp', N'Đã phát hành', N'Đã hủy'));
ALTER TABLE HoaDonGiaTriGiaTang ADD CONSTRAINT chkHoaDonGiaTriGiaTangtrangThaiXml CHECK (trangThaiXml IN (N'Chưa xuất', N'Đã xuất'));
ALTER TABLE KhachLuuTru ADD CONSTRAINT chkKhachLuuTruhangThanhVien CHECK (hangThanhVien IN (N'Tiêu chuẩn', N'Bạc', N'Vàng', N'Bạch kim'));
ALTER TABLE KhoanChi ADD CONSTRAINT chkKhoanChitrangThai CHECK (trangThai IN (N'Đã ghi nhận', N'Đã phê duyệt', N'Đã hủy'));
ALTER TABLE KiemTraBuongPhong ADD CONSTRAINT chkKiemTraBuongPhongloaiKiemTra CHECK (loaiKiemTra IN (N'Minibar', N'Tài sản phòng'));
ALTER TABLE KiemTraBuongPhong ADD CONSTRAINT chkKiemTraBuongPhongtinhTrangHangMuc CHECK (tinhTrangHangMuc IN (N'Bình thường', N'Hư hỏng', N'Thất lạc', N'Đã bổ sung'));
ALTER TABLE LichSuHangThanhVien ADD CONSTRAINT chkLichSuHangThanhVienhangCu CHECK (hangCu IN (N'Tiêu chuẩn', N'Bạc', N'Vàng', N'Bạch kim'));
ALTER TABLE LichSuHangThanhVien ADD CONSTRAINT chkLichSuHangThanhVienhangMoi CHECK (hangMoi IN (N'Tiêu chuẩn', N'Bạc', N'Vàng', N'Bạch kim'));
ALTER TABLE MatHangTonKho ADD CONSTRAINT chkMatHangTonKhodanhMuc CHECK (danhMuc IN (N'Đồ vải', N'Khăn', N'Đồ dùng', N'Minibar', N'Khác'));
ALTER TABLE NhanVien ADD CONSTRAINT chkNhanVienvaiTro CHECK (vaiTro IN (N'Quản trị viên', N'Giám đốc', N'Quản lý', N'Lễ tân', N'Kế toán', N'Buồng phòng', N'Kỹ thuật', N'Nhà bếp', N'Nhân viên', N'Nhân sự'));
ALTER TABLE PhieuBaoTri ADD CONSTRAINT chkPhieuBaoTritrangThai CHECK (trangThai IN (N'Chưa xử lý', N'Đang bảo trì', N'Đã hoàn thành'));
ALTER TABLE PhieuDatPhong ADD CONSTRAINT chkPhieuDatPhonghinhThucThue CHECK (hinhThucThue IN (N'Theo gói', N'Theo giờ'));
ALTER TABLE PhieuDatPhong ADD CONSTRAINT chkPhieuDatPhongnguonDatPhong CHECK (nguonDatPhong IN (N'Trực tiếp', N'AGODA', N'BOOKING_COM', N'EXPEDIA', N'AIRBNB'));
ALTER TABLE PhieuDatPhong ADD CONSTRAINT chkPhieuDatPhongtrangThaiDoiSoatOta CHECK (trangThaiDoiSoatOta IN (N'Không áp dụng', N'Chờ đối soát', N'Đã khớp', N'Có tranh chấp'));
ALTER TABLE PhieuDatPhong ADD CONSTRAINT chkPhieuDatPhongtrangThaiThanhToanCoc CHECK (trangThaiThanhToanCoc IN (N'Không yêu cầu', N'Chờ thanh toán', N'Đã thanh toán', N'Đã hết hạn'));
ALTER TABLE SuCoThietBi ADD CONSTRAINT chkSuCoThietBimucDoNghiemTrong CHECK (mucDoNghiemTrong IN (N'Thấp', N'Trung bình', N'Cao', N'Nghiêm trọng'));
ALTER TABLE SuCoThietBi ADD CONSTRAINT chkSuCoThietBitrangThaiBanGiao CHECK (trangThaiBanGiao IN (N'Đang mở', N'Đã tiếp nhận', N'Đã xử lý'));
ALTER TABLE SuKienDangNhapNhanVien ADD CONSTRAINT chkSuKienDangNhapNhanVienketQua CHECK (ketQua IN (N'Thành công', N'Thất bại'));
ALTER TABLE TaiSanKyThuat ADD CONSTRAINT chkTaiSanKyThuatloaiViTri CHECK (loaiViTri IN (N'Tòa nhà', N'Phòng'));
ALTER TABLE TaiSanKyThuat ADD CONSTRAINT chkTaiSanKyThuattrangThai CHECK (trangThai IN (N'Tốt', N'Cần bảo trì', N'Đang sửa chữa', N'Ngừng sử dụng'));
ALTER TABLE YeuCauPheDuyet ADD CONSTRAINT chkYeuCauPheDuyethanhDong CHECK (hanhDong IN (N'Kích hoạt loại phòng', N'Thay đổi giá dịch vụ', N'Hoàn tiền thanh toán', N'Hoàn tiền đặt cọc', N'Xóa hóa đơn', N'Điều chỉnh thanh toán', N'Điều chỉnh giá'));
ALTER TABLE YeuCauPheDuyet ADD CONSTRAINT chkYeuCauPheDuyetmucDoRuiRo CHECK (mucDoRuiRo IN (N'Thấp', N'Trung bình', N'Cao', N'Nghiêm trọng'));
ALTER TABLE YeuCauPheDuyet ADD CONSTRAINT chkYeuCauPheDuyettrangThai CHECK (trangThai IN (N'Chờ phê duyệt', N'Đã phê duyệt', N'Bị từ chối', N'Đã hết hạn', N'Đã sử dụng'));

CREATE TABLE HinhAnhLoaiPhong (
    maHinhAnhLoaiPhong BIGINT IDENTITY(1,1) NOT NULL,
    maLoaiPhong NVARCHAR(10) NOT NULL,
    duongDanAnh NVARCHAR(2048) NOT NULL,
    thuTuHienThi INT NOT NULL DEFAULT 0,
    CONSTRAINT pkHinhAnhLoaiPhong PRIMARY KEY (maHinhAnhLoaiPhong),
    CONSTRAINT ukHinhAnhLoaiPhong01 UNIQUE (maLoaiPhong, thuTuHienThi),
    CONSTRAINT fkHinhAnhLoaiPhong01 FOREIGN KEY (maLoaiPhong) REFERENCES LoaiPhong (maLoaiPhong) ON DELETE CASCADE,
    CONSTRAINT chkHinhAnhLoaiPhong01 CHECK (thuTuHienThi >= 0)
);

ALTER TABLE PhieuDatPhong
    ADD CONSTRAINT chkPhieuDatPhongtrangThai CHECK (trangThai IN (N'Bản nháp', N'Đã xác nhận', N'Đã thanh toán cọc', N'Đã nhận phòng', N'Đã trả phòng', N'Đã hủy', N'Không đến'));
