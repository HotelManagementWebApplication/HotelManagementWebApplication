-- V5__stored_procedures.sql
-- Demo baseline: one final definition per object.
-- Edit this owning file; do not create additional migrations.
-- Contents:
--   uspTaoDatPhong
--   uspLenhThanhToanCocOnline
--   uspKhoaHoaDon
--   uspLenhGiaoDichThanhToan
--   uspLenhHoaDon
--   uspPhatHanhBienLai
--   uspHetHanGiuCoc
--   uspLenhDatPhong
--   uspChuyenPhong
--   uspXacNhanSuDungDichVu
--   uspHuyDatDichVu
--   uspDieuChinhTonKho
--   uspPhanCongCa
--   uspDatDichVuKhachSan
--   uspHuyDichVuTheoDatPhong
--   uspCapNhatDoiSoatOta
--   uspPhatHanhHoaDonVat
--   uspLuuXmlHoaDonVat
--   uspNhapChamCong
--   uspTaoDonNghiPhep
--   uspQuyetDinhNghiPhep
--   uspTaoTaiSanKyThuat
--   uspCapNhatTaiSanKyThuat
--   uspSuaCaLamViec
--   uspChuyenTrangThaiCa
--   uspThemAnhPhong
--   uspXoaAnhPhong
--   uspTaoTienNghi
--   uspSuaTienNghi
--   uspGanTienNghiLoaiPhong
--   uspGhiBienDongKhoDichVu
--   uspThemThietBiPhong
--   uspSuaThietBiPhong
--   uspTaoPhieuBaoTri
--   uspChuyenTrangThaiBaoTri
--   uspTaoMauChecklistBuongPhong
--   uspGhiKetQuaChecklistBuongPhong
--   uspGhiKiemTraBuongPhong
--   uspKhoaChongTrungBuongPhong
--   uspLuuKetQuaChongTrungBuongPhong
--   uspTaoNhiemVuBuongPhong
--   uspCapNhatNhiemVuBuongPhong
--   uspLenhCongViecKyThuat
--   uspThemThongBao
--   uspDanhDauThongBaoDaGui
--   uspKhoaLenhSuCoThietBi
--   uspGhiSuCoThietBi
--   uspGhiNhatKyKiemSoat
--   uspNhanKhoaChongTrung
--   uspHoanThanhChongTrung
--   uspLenhPheDuyet
--   uspGhiButToanTaiChinh
--   uspLenhTaiChinh
--   uspKhoaChuTheDangNhap
--   uspKhoaMaLamMoiDangNhap
--   uspLenhMaLamMoiDangNhap
--   uspKhoaNhanVien
--   uspLenhNhanVien
--   uspKhoaDangKyTaiKhoan
--   uspLenhKhachLuuTru
--   uspLenhTaiKhoanKhachHang
--   uspKhoaDanhMucPhong
--   uspKhoaPhongNoiBo
--   uspChuyenTrangThaiPhong
--   uspLenhQuanTriPhong
--   uspLenhLoaiPhong
--   uspKhoaDichVuDanhMuc
--   uspLenhDanhMucDichVu

CREATE PROCEDURE dbo.uspTaoDatPhong
    @maKhachLuuTru BIGINT,
    @maNhanVien NVARCHAR(10) = NULL,
    @maTaiKhoanKhachHang BIGINT = NULL,
    @hinhThucThue NVARCHAR(20),
    @tienDatCoc DECIMAL(12,2),
    @khoaChongTrung NVARCHAR(100),
    @danhSachPhongJson NVARCHAR(MAX),
    @nguoiThucHien NVARCHAR(50),
    @thoiDiemHienTai DATETIME2(6),
    @trangThaiKhoiTao NVARCHAR(30)=N'Bản nháp',
    @phuongThucBaoDam NVARCHAR(20)=NULL,@maThanhToan NVARCHAR(40)=NULL,
    @hetHan DATETIME2(6)=NULL,@email NVARCHAR(150)=NULL,@nguon NVARCHAR(30)=N'Trực tiếp',
    @kiemTraCoc BIT=0
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    BEGIN TRY
        BEGIN TRANSACTION;

        IF @thoiDiemHienTai IS NULL OR @danhSachPhongJson IS NULL OR ISJSON(@danhSachPhongJson) <> 1
            THROW 51008, N'Dữ liệu đặt phòng không hợp lệ', 1;
        IF NOT EXISTS (SELECT 1 FROM dbo.KhachLuuTru WHERE maKhachLuuTru = @maKhachLuuTru)
            THROW 51001, N'Không tìm thấy khách lưu trú', 1;
        IF @maTaiKhoanKhachHang IS NOT NULL AND NOT EXISTS(SELECT 1 FROM dbo.TaiKhoanKhachHang
            WHERE maTaiKhoanKhachHang=@maTaiKhoanKhachHang AND maKhachLuuTru=@maKhachLuuTru)
            THROW 53402,N'Không tìm thấy tài khoản khách hàng',1;

        DECLARE @maDaCo BIGINT,@keyLock INT,@keyResource NVARCHAR(255)=N'ReservationCreate:'+@khoaChongTrung;
        EXEC @keyLock=sys.sp_getapplock @Resource=@keyResource,@LockMode=N'Exclusive',@LockOwner=N'Transaction',@LockTimeout=15000;
        IF @keyLock<0 THROW 51005,N'Không thể khóa idempotency booking',1;
        SELECT @maDaCo = maPhieuDatPhong
        FROM dbo.PhieuDatPhong
        WHERE khoaChongTrung = @khoaChongTrung;
        IF @maDaCo IS NOT NULL
        BEGIN
            THROW 51005,N'Idempotency key đã dùng cho booking khác',1;
        END;

        DECLARE @phong TABLE (
            maPhong NVARCHAR(10) PRIMARY KEY,
            thoiDiemNhanPhong DATETIME2(6) NOT NULL,
            thoiDiemTraPhong DATETIME2(6) NOT NULL,
            soLuongKhach INT NOT NULL
        );
        INSERT INTO @phong(maPhong, thoiDiemNhanPhong, thoiDiemTraPhong, soLuongKhach)
        SELECT maPhong, thoiDiemNhanPhong, thoiDiemTraPhong, soLuongKhach
        FROM OPENJSON(@danhSachPhongJson)
        WITH (
            maPhong NVARCHAR(10) '$.maPhong',
            thoiDiemNhanPhong DATETIME2(6) '$.thoiDiemNhanPhong',
            thoiDiemTraPhong DATETIME2(6) '$.thoiDiemTraPhong',
            soLuongKhach INT '$.soLuongKhach'
        );
        IF NOT EXISTS (SELECT 1 FROM @phong) OR (SELECT COUNT(*) FROM @phong) > 3
            THROW 51008, N'Mỗi đặt phòng phải có từ một đến ba phòng', 1;
        IF EXISTS (SELECT 1 FROM @phong WHERE thoiDiemNhanPhong >= thoiDiemTraPhong OR soLuongKhach <= 0)
            THROW 51008, N'Khoảng lưu trú hoặc số khách không hợp lệ', 1;

        DECLARE @maPhongKhoa NVARCHAR(10);
        DECLARE khoaPhong CURSOR LOCAL FAST_FORWARD FOR SELECT maPhong FROM @phong ORDER BY maPhong;
        OPEN khoaPhong;
        FETCH NEXT FROM khoaPhong INTO @maPhongKhoa;
        WHILE @@FETCH_STATUS = 0
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM dbo.Phong WITH (UPDLOCK, HOLDLOCK) WHERE maPhong = @maPhongKhoa)
                THROW 53403,N'Không tìm thấy phòng',1;
            IF EXISTS (SELECT 1 FROM dbo.Phong WHERE maPhong = @maPhongKhoa AND trangThai IN(N'Đang có khách',N'Đang dọn phòng',N'Đang bảo trì',N'Ngừng sử dụng'))
            BEGIN
                CLOSE khoaPhong; DEALLOCATE khoaPhong;
                THROW 51002, N'Phòng không ở trạng thái sẵn sàng', 1;
            END;
            FETCH NEXT FROM khoaPhong INTO @maPhongKhoa;
        END;
        CLOSE khoaPhong; DEALLOCATE khoaPhong;

        -- Creation has no reservation row yet. Existing commands lock booking,
        -- rooms by ID, then guest; creation also acquires guest after room locks.
        DECLARE @guestBlocked BIT;
        SELECT @guestBlocked=biChanDatPhong FROM dbo.KhachLuuTru WITH(UPDLOCK,HOLDLOCK) WHERE maKhachLuuTru=@maKhachLuuTru;
        IF @guestBlocked IS NULL THROW 51001,N'Không tìm thấy khách lưu trú',1;
        IF @guestBlocked=1 THROW 53401,N'Khách hàng đã bị khóa quyền đặt trước',1;

        IF EXISTS (
            SELECT 1 FROM @phong
            WHERE dbo.fnKiemTraPhongTrong(maPhong, thoiDiemNhanPhong, thoiDiemTraPhong, @thoiDiemHienTai, NULL) = 0
        ) THROW 51004, N'Phòng đã có lịch giao nhau', 1;
        IF EXISTS(SELECT 1 FROM @phong q JOIN dbo.Phong p ON p.maPhong=q.maPhong JOIN dbo.LoaiPhong l ON l.maLoaiPhong=p.maLoaiPhong
            WHERE q.soLuongKhach>l.soKhachToiDa) THROW 53404,N'Số khách vượt sức chứa phòng',1;
        IF @maTaiKhoanKhachHang IS NOT NULL
        BEGIN
            IF EXISTS(SELECT 1 FROM @phong WHERE thoiDiemNhanPhong<=@thoiDiemHienTai) THROW 53405,N'Giờ nhận phòng phải ở tương lai',1;
            IF EXISTS(SELECT 1 FROM @phong q JOIN dbo.Phong p ON p.maPhong=q.maPhong JOIN dbo.LoaiPhong l ON l.maLoaiPhong=p.maLoaiPhong
                WHERE l.trangThaiDanhMuc<>N'Đang hoạt động') THROW 53406,N'Loại phòng chưa được phê duyệt',1;
        END;
        DECLARE @cocBatBuoc DECIMAL(12,2);
        SELECT @cocBatBuoc=ROUND(SUM(dbo.fnTinhTongTienPhong(l.giaTheoNgay,l.giaTheoGio,q.thoiDiemNhanPhong,q.thoiDiemTraPhong,
            CASE WHEN @hinhThucThue=N'Theo giờ' THEN 1 ELSE 0 END,3))*0.5,2)
        FROM @phong q JOIN dbo.Phong p ON p.maPhong=q.maPhong JOIN dbo.LoaiPhong l ON l.maLoaiPhong=p.maLoaiPhong;
        IF @maTaiKhoanKhachHang IS NOT NULL SET @tienDatCoc=@cocBatBuoc;
        ELSE IF @kiemTraCoc=1 AND @tienDatCoc<>@cocBatBuoc THROW 53407,N'Tiền cọc phải bằng 50% giá phòng',1;

        INSERT INTO dbo.PhieuDatPhong(maKhachLuuTru, maNhanVien, maTaiKhoanKhachHang,
            hinhThucThue, tienDatCoc, khoaChongTrung, trangThai,thoiDiemDat,phuongThucBaoDam,
            maThanhToanDatCoc,thoiDiemHetHanThanhToanCoc,emailXacNhan,nguonDatPhong,trangThaiThanhToanCoc)
        VALUES(@maKhachLuuTru, @maNhanVien, @maTaiKhoanKhachHang,
            @hinhThucThue, @tienDatCoc, @khoaChongTrung, @trangThaiKhoiTao,@thoiDiemHienTai,@phuongThucBaoDam,
            @maThanhToan,@hetHan,@email,@nguon,CASE WHEN @phuongThucBaoDam=N'VNPay' THEN N'Chờ thanh toán'
                WHEN @maTaiKhoanKhachHang IS NULL AND @tienDatCoc>0 THEN N'Đã thanh toán' ELSE N'Không yêu cầu' END);
        DECLARE @maPhieuDatPhong BIGINT = SCOPE_IDENTITY();

        INSERT INTO dbo.ChiTietDatPhong(maPhieuDatPhong, maPhong, thoiDiemNhanPhong,
            thoiDiemTraPhong, thoiDiemTraPhongBanDau, trangThai, soLuongKhach)
        SELECT @maPhieuDatPhong, maPhong, thoiDiemNhanPhong, thoiDiemTraPhong,
               thoiDiemTraPhong, N'Đã giữ phòng', soLuongKhach
        FROM @phong;

        INSERT INTO dbo.NhatKyKiemSoat(nguoiThucHien, hanhDong, loaiDoiTuong,
            maDoiTuong, duLieuSau, khoaLienKet)
        VALUES(@nguoiThucHien, N'RESERVATION_CREATED', N'RESERVATION',
            CONVERT(NVARCHAR(100), @maPhieuDatPhong), @danhSachPhongJson, @khoaChongTrung);

        COMMIT TRANSACTION;
        SELECT @maPhieuDatPhong AS maPhieuDatPhong;
    END TRY
    BEGIN CATCH
        IF CURSOR_STATUS('local', 'khoaPhong') >= -1
        BEGIN
            IF CURSOR_STATUS('local', 'khoaPhong') > -1 CLOSE khoaPhong;
            DEALLOCATE khoaPhong;
        END;
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

-- =============================================================================
-- Online deposit command: VNPay attempts and provider finalization are serialized
-- with the reservation, invoice, payment, receipt, ledger and audit writes.
-- HMAC validation remains outside this database transaction.
-- =============================================================================
CREATE PROCEDURE dbo.uspLenhThanhToanCocOnline
 @command NVARCHAR(20),@reservation BIGINT=NULL,@customer BIGINT=NULL,
 @merchant NVARCHAR(100)=NULL,@paymentCode NVARCHAR(40)=NULL,
 @amount DECIMAL(12,2)=NULL,@responseCode NVARCHAR(10)=NULL,
 @providerTransaction NVARCHAR(100)=NULL,@bankCode NVARCHAR(20)=NULL,
 @cardType NVARCHAR(20)=NULL,@reference NVARCHAR(100)=NULL,
 @externalEvent NVARCHAR(100)=NULL,@method NVARCHAR(30)=NULL,
 @actor NVARCHAR(50),@now DATETIME2(6)
AS
BEGIN
 SET NOCOUNT ON;SET XACT_ABORT ON;
 BEGIN TRY
  BEGIN TRANSACTION;
  DECLARE @attempt BIGINT,@status NVARCHAR(20),@expires DATETIME2(6),
   @expected DECIMAL(12,2),@reservationStatus NVARCHAR(30),@depositStatus NVARCHAR(20),
   @pending NVARCHAR(20),@invoice BIGINT,@payment BIGINT,@receipt BIGINT,
   @email NVARCHAR(150),@rooms NVARCHAR(MAX),@priorPayment BIGINT,@eventLock INT,
   @eventKey NVARCHAR(100),@attemptAmount DECIMAL(12,2);

  IF @command=N'create'
  BEGIN
   SELECT @reservationStatus=trangThai,@depositStatus=trangThaiThanhToanCoc,
    @pending=loaiThayDoiDangCho,@expires=thoiDiemHetHanThanhToanCoc,
    @expected=CASE WHEN loaiThayDoiDangCho IS NULL THEN tienDatCoc ELSE tienDatCocBoSung END
   FROM dbo.PhieuDatPhong WITH(UPDLOCK,HOLDLOCK)
   WHERE maPhieuDatPhong=@reservation AND maTaiKhoanKhachHang=@customer AND phuongThucBaoDam=N'VNPay';
   IF @reservationStatus IS NULL THROW 53301,N'Không tìm thấy booking',1;
   IF @depositStatus<>N'Chờ thanh toán' OR NOT(@reservationStatus=N'Bản nháp'
      OR (@pending IS NOT NULL AND @reservationStatus IN(N'Đã xác nhận',N'Đã thanh toán cọc')))
    THROW 53302,N'Booking không còn chờ thanh toán cọc',1;
   IF @expires IS NULL OR @expires<=@now THROW 53303,N'Thời gian giữ phòng đã hết',1;
   SET @amount=@expected;
   IF @merchant IS NULL OR @amount<>@expected THROW 53304,N'Số tiền cọc không khớp booking',1;
   UPDATE dbo.YeuCauThanhToanVnpay SET trangThai=N'Đã hủy',thoiDiemHoanTat=@now,phienBan=phienBan+1
    WHERE maPhieuDatPhong=@reservation AND trangThai=N'Chờ thanh toán';
   INSERT dbo.YeuCauThanhToanVnpay(maPhieuDatPhong,maThamChieuMerchant,soTien,trangThai,thoiDiemTao,thoiDiemHetHan)
    VALUES(@reservation,@merchant,@amount,N'Chờ thanh toán',@now,@expires);
   SET @attempt=SCOPE_IDENTITY();
   INSERT dbo.NhatKyKiemSoat(nguoiThucHien,hanhDong,loaiDoiTuong,maDoiTuong,duLieuSau,khoaLienKet)
    VALUES(@actor,N'VNPAY_CHECKOUT_CREATED',N'VNPAY_PAYMENT_ATTEMPT',CONVERT(NVARCHAR(100),@attempt),N'Chờ thanh toán',@merchant);
   COMMIT TRANSACTION;
   SELECT * FROM dbo.vwYeuCauThanhToanVnpay WHERE maYeuCauThanhToanVnpay=@attempt;
   RETURN;
  END;

  IF @command=N'fail'
  BEGIN
   SELECT @attempt=maYeuCauThanhToanVnpay,@reservation=maPhieuDatPhong,@status=trangThai
    FROM dbo.YeuCauThanhToanVnpay WITH(UPDLOCK,HOLDLOCK) WHERE maThamChieuMerchant=@merchant;
   IF @attempt IS NULL THROW 53305,N'Không tìm thấy giao dịch VNPay',1;
   IF @status=N'Chờ thanh toán'
   BEGIN
    UPDATE dbo.YeuCauThanhToanVnpay SET trangThai=N'Thất bại',thoiDiemHoanTat=@now,
     maGiaoDichVnpay=@providerTransaction,maNganHang=@bankCode,loaiThe=@cardType,
     maPhanHoi=@responseCode,phienBan=phienBan+1 WHERE maYeuCauThanhToanVnpay=@attempt;
    INSERT dbo.NhatKyKiemSoat(nguoiThucHien,hanhDong,loaiDoiTuong,maDoiTuong,duLieuTruoc,duLieuSau,lyDo)
     VALUES(N'VNPAY',N'VNPAY_PAYMENT_FAILED',N'VNPAY_PAYMENT_ATTEMPT',CONVERT(NVARCHAR(100),@attempt),N'Chờ thanh toán',N'Thất bại',@responseCode);
   END;
   COMMIT TRANSACTION;
   SELECT * FROM dbo.vwYeuCauThanhToanVnpay WHERE maYeuCauThanhToanVnpay=@attempt;
   RETURN;
  END;

  IF @command<>N'finalize' THROW 51008,N'Lệnh thanh toán cọc không hợp lệ',1;
  IF NULLIF(LTRIM(RTRIM(@externalEvent)),N'') IS NULL OR @amount IS NULL OR @amount<=0
   THROW 53304,N'Dữ liệu thanh toán cọc không hợp lệ',1;
  DECLARE @eventResource NVARCHAR(255)=N'OnlineDeposit:'+@externalEvent;
  EXEC @eventLock=sys.sp_getapplock @Resource=@eventResource,@LockMode=N'Exclusive',@LockOwner=N'Transaction',@LockTimeout=15000;
  IF @eventLock<0 THROW 53309,N'Không thể khóa sự kiện thanh toán',1;
  SET @eventKey=N'GW:'+CONVERT(VARCHAR(64),HASHBYTES('SHA2_256',CONCAT(@merchant,N'|',@paymentCode,N'|',@amount,N'|',@reference,N'|',@method)),2);
  SELECT @priorPayment=maGiaoDichThanhToan,@invoice=maHoaDon
   FROM dbo.GiaoDichThanhToan WHERE maSuKienBenNgoai=@externalEvent;
  IF @priorPayment IS NOT NULL
  BEGIN
   IF NOT EXISTS(SELECT 1 FROM dbo.GiaoDichThanhToan WHERE maGiaoDichThanhToan=@priorPayment AND khoaChongTrung=@eventKey)
    THROW 53310,N'Sự kiện thanh toán đã dùng cho nội dung khác',1;
   SELECT @reservation=maPhieuDatPhong FROM dbo.HoaDon WHERE maHoaDon=@invoice;
   COMMIT TRANSACTION;
   SELECT @reservation AS maPhieuDatPhong,@priorPayment AS maGiaoDichThanhToan,N'Đã hoàn tất' AS trangThaiThanhToan,
    (SELECT trangThai FROM dbo.PhieuDatPhong WHERE maPhieuDatPhong=@reservation) AS trangThaiDatPhong,
    CAST(1 AS BIT) AS daXuLy,CAST(1 AS BIT) AS lapLai,
    (SELECT COALESCE(p.emailXacNhan,k.email) FROM dbo.PhieuDatPhong p JOIN dbo.KhachLuuTru k ON k.maKhachLuuTru=p.maKhachLuuTru WHERE p.maPhieuDatPhong=@reservation) AS email,
    (SELECT STRING_AGG(CONVERT(NVARCHAR(MAX),maPhong),N', ') WITHIN GROUP(ORDER BY maPhong) FROM dbo.ChiTietDatPhong WHERE maPhieuDatPhong=@reservation) AS phong;
   RETURN;
  END;

  IF @merchant IS NOT NULL
  BEGIN
   SELECT @reservation=maPhieuDatPhong FROM dbo.YeuCauThanhToanVnpay WHERE maThamChieuMerchant=@merchant;
   IF @reservation IS NULL THROW 53305,N'Không tìm thấy giao dịch VNPay',1;
  END
  ELSE
   SELECT @reservation=maPhieuDatPhong FROM dbo.PhieuDatPhong WHERE maThanhToanDatCoc=@paymentCode;
  IF @reservation IS NULL THROW 53306,N'Không tìm thấy mã thanh toán cọc',1;

  SELECT @reservationStatus=trangThai,@depositStatus=trangThaiThanhToanCoc,
   @pending=loaiThayDoiDangCho,@expires=thoiDiemHetHanThanhToanCoc,
   @expected=CASE WHEN loaiThayDoiDangCho IS NULL THEN tienDatCoc ELSE tienDatCocBoSung END
  FROM dbo.PhieuDatPhong WITH(UPDLOCK,HOLDLOCK) WHERE maPhieuDatPhong=@reservation;
  IF @merchant IS NOT NULL
  BEGIN
   SELECT @attempt=maYeuCauThanhToanVnpay,@status=trangThai
    FROM dbo.YeuCauThanhToanVnpay WITH(UPDLOCK,HOLDLOCK) WHERE maThamChieuMerchant=@merchant;
   SELECT @attemptAmount=soTien FROM dbo.YeuCauThanhToanVnpay WHERE maYeuCauThanhToanVnpay=@attempt;
   IF @amount<>@attemptAmount THROW 53304,N'Số tiền giao dịch VNPay không khớp',1;
   IF @status=N'Thành công'
   BEGIN
    THROW 53310,N'Yêu cầu VNPay đã hoàn tất bằng sự kiện khác',1;
   END;
   IF @status<>N'Chờ thanh toán' THROW 53307,N'Yêu cầu thanh toán không còn hiệu lực',1;
  END;
  IF @reservationStatus IN(N'Đã hủy',N'Không đến') THROW 53307,N'Booking không còn nhận thanh toán cọc',1;
  IF @depositStatus=N'Đã thanh toán' THROW 53308,N'Tiền cọc đã được xác nhận',1;
  IF @expires IS NOT NULL AND @expires<=@now THROW 53303,N'Mã thanh toán cọc đã hết hạn',1;
  IF @amount IS NULL OR @amount<>@expected THROW 53304,N'Số tiền cọc không khớp booking',1;

  SELECT @invoice=maHoaDon FROM dbo.HoaDon WITH(UPDLOCK,HOLDLOCK) WHERE maPhieuDatPhong=@reservation;
  IF @invoice IS NULL
  BEGIN
   INSERT dbo.HoaDon(maPhieuDatPhong,thoiDiemPhatHanh,tienDatCocDaTra,soTienPhaiTra,trangThai,phuongThucThanhToan)
    VALUES(@reservation,@now,@amount,0,N'Dự kiến',@method);SET @invoice=SCOPE_IDENTITY();
  END
  ELSE UPDATE dbo.HoaDon SET tienDatCocDaTra=CASE WHEN @pending IS NULL THEN @amount ELSE tienDatCocDaTra+@amount END,
   soTienPhaiTra=0,trangThai=N'Dự kiến',phuongThucThanhToan=@method,phienBan=phienBan+1 WHERE maHoaDon=@invoice;
  INSERT dbo.GiaoDichThanhToan(maHoaDon,soTien,phuongThuc,loai,trangThai,maThamChieu,thoiDiemPhatSinh,maNguoiThucHien,khoaChongTrung,maSuKienBenNgoai)
   VALUES(@invoice,@amount,@method,N'Thanh toán',N'Đã hoàn tất',@reference,@now,@actor,@eventKey,@externalEvent);
  SET @payment=SCOPE_IDENTITY();
  DECLARE @receiptNumber NVARCHAR(40)=CASE WHEN @pending IS NULL THEN N'DEP-VNPAY-'+CONVERT(NVARCHAR(20),@reservation)
    ELSE N'DEP-VNPAY-'+CONVERT(NVARCHAR(20),@reservation)+N'-'+CONVERT(NVARCHAR(20),@payment) END;
  INSERT dbo.BienLai(soBienLai,maHoaDon,soTien,phuongThuc,thoiDiemPhatHanh,nguoiPhatHanh)
   VALUES(@receiptNumber,@invoice,@amount,@method,@now,@actor);SET @receipt=SCOPE_IDENTITY();
  INSERT dbo.ButToanTaiChinh(loaiButToan,loaiNguon,maNguon,chieuButToan,soTien,maNguoiThucHien,thoiDiemPhatSinh,ghiChu,daChotSo)
   VALUES(N'PAYMENT_RECEIVED',N'PAYMENT_TRANSACTION',CONVERT(NVARCHAR(100),@payment),N'Ghi nợ',@amount,@actor,@now,N'DEPOSIT',1),
    (N'RECEIPT_ISSUED',N'RECEIPT',CONVERT(NVARCHAR(100),@receipt),N'Ghi nợ',@amount,@actor,@now,@method,1);
  IF @reservationStatus=N'Bản nháp' SET @reservationStatus=N'Đã thanh toán cọc';
  UPDATE dbo.PhieuDatPhong SET trangThai=@reservationStatus,trangThaiThanhToanCoc=N'Đã thanh toán',
   soPhutGiaHan=CASE WHEN @pending IS NULL THEN soPhutGiaHan ELSE soPhutGiaHan+DATEDIFF(MINUTE,thoiDiemTraPhongTruocThayDoi,(SELECT MAX(thoiDiemTraPhong) FROM dbo.ChiTietDatPhong WHERE maPhieuDatPhong=@reservation)) END,
   maThanhToanDatCoc=CASE WHEN @pending IS NULL THEN maThanhToanDatCoc ELSE NULL END,
   thoiDiemHetHanThanhToanCoc=CASE WHEN @pending IS NULL THEN thoiDiemHetHanThanhToanCoc ELSE NULL END,
   loaiThayDoiDangCho=NULL,thoiDiemNhanPhongTruocThayDoi=NULL,thoiDiemTraPhongTruocThayDoi=NULL,
   tienDatCocTruocThayDoi=NULL,tienDatCocBoSung=0,phienBan=phienBan+1 WHERE maPhieuDatPhong=@reservation;
  IF @attempt IS NOT NULL
  BEGIN
   UPDATE dbo.YeuCauThanhToanVnpay SET trangThai=N'Thành công',thoiDiemHoanTat=@now,
    maGiaoDichVnpay=@providerTransaction,maNganHang=@bankCode,loaiThe=@cardType,
    maPhanHoi=@responseCode,phienBan=phienBan+1 WHERE maYeuCauThanhToanVnpay=@attempt;
   UPDATE dbo.YeuCauThanhToanVnpay SET trangThai=N'Đã hủy',thoiDiemHoanTat=@now,phienBan=phienBan+1
    WHERE maPhieuDatPhong=@reservation AND maYeuCauThanhToanVnpay<>@attempt AND trangThai=N'Chờ thanh toán';
  END;
  INSERT dbo.NhatKyKiemSoat(nguoiThucHien,hanhDong,loaiDoiTuong,maDoiTuong,duLieuTruoc,duLieuSau,khoaLienKet)
   VALUES(@actor,CASE WHEN @pending IS NULL THEN N'DEPOSIT_PAYMENT_CONFIRMED' ELSE N'EXTENSION_DEPOSIT_PAYMENT_CONFIRMED' END,
    N'RESERVATION',CONVERT(NVARCHAR(100),@reservation),N'Chờ thanh toán',N'Đã thanh toán',@externalEvent);
  SELECT @email=COALESCE(p.emailXacNhan,k.email) FROM dbo.PhieuDatPhong p JOIN dbo.KhachLuuTru k ON k.maKhachLuuTru=p.maKhachLuuTru WHERE p.maPhieuDatPhong=@reservation;
  SELECT @rooms=STRING_AGG(CONVERT(NVARCHAR(MAX),maPhong),N', ') WITHIN GROUP(ORDER BY maPhong) FROM dbo.ChiTietDatPhong WHERE maPhieuDatPhong=@reservation;
  COMMIT TRANSACTION;
  SELECT @reservation AS maPhieuDatPhong,@payment AS maGiaoDichThanhToan,N'Đã hoàn tất' AS trangThaiThanhToan,
   @reservationStatus AS trangThaiDatPhong,CAST(1 AS BIT) AS daXuLy,CAST(0 AS BIT) AS lapLai,@email AS email,@rooms AS phong;
 END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK TRANSACTION;THROW;END CATCH;
END;
GO

-- =============================================================================
-- Payment ledger: invoice-first serialization, exact retry binding and refund
-- approval consumption are committed in the caller transaction.
-- =============================================================================
CREATE PROCEDURE dbo.uspKhoaHoaDon @invoice BIGINT AS
BEGIN
 SET NOCOUNT ON;
 SELECT maHoaDon FROM dbo.HoaDon WITH(UPDLOCK,HOLDLOCK) WHERE maHoaDon=@invoice;
END;
GO

CREATE PROCEDURE dbo.uspLenhGiaoDichThanhToan
 @command NVARCHAR(20),@invoice BIGINT,@amount DECIMAL(38,6),@method NVARCHAR(MAX),
 @reference NVARCHAR(MAX),@storedKey NVARCHAR(MAX),@actor NVARCHAR(MAX),
 @approval BIGINT,@now DATETIME2(6)
AS
BEGIN
 SET NOCOUNT ON;SET XACT_ABORT ON;
 BEGIN TRY
  BEGIN TRANSACTION;
  DECLARE @due DECIMAL(19,2),@id BIGINT,@source BIGINT,@sourceMethod NVARCHAR(30),@net DECIMAL(19,2),@created BIT=0;
  SELECT @due=dbo.fnTinhSoDuHoaDon(maHoaDon) FROM dbo.HoaDon WITH(UPDLOCK,HOLDLOCK) WHERE maHoaDon=@invoice;
  IF @due IS NULL THROW 53101,N'Không tìm thấy hóa đơn',1;
  SELECT @id=maGiaoDichThanhToan FROM dbo.GiaoDichThanhToan WITH(UPDLOCK,HOLDLOCK) WHERE khoaChongTrung=@storedKey;
  IF @id IS NULL
  BEGIN
   IF @amount<=0 THROW 53102,N'Số tiền giao dịch phải lớn hơn 0',1;
   IF @command=N'payment'
   BEGIN
    IF @amount>@due THROW 53103,N'Số tiền thu vượt số dư hóa đơn',1;
    INSERT dbo.GiaoDichThanhToan(maHoaDon,soTien,phuongThuc,loai,trangThai,maThamChieu,thoiDiemPhatSinh,maNguoiThucHien,khoaChongTrung)
     VALUES(@invoice,@amount,@method,N'Thanh toán',N'Đã hoàn tất',@reference,@now,@actor,@storedKey);
   END
   ELSE IF @command=N'refund'
   BEGIN
    IF NOT EXISTS(SELECT 1 FROM dbo.YeuCauPheDuyet WITH(UPDLOCK,HOLDLOCK) WHERE maYeuCauPheDuyet=@approval
      AND hanhDong=N'Hoàn tiền thanh toán' AND maDoiTuong=CONVERT(NVARCHAR(100),@invoice)
      AND nguoiYeuCau=@actor AND trangThai=N'Đã sử dụng' AND soTien=@amount)
     THROW 52205,N'Cần approval hoàn tiền đã consume đúng yêu cầu',1;
    SELECT @net=COALESCE(SUM(CASE WHEN loai=N'Thanh toán' THEN soTien WHEN loai=N'Hoàn tiền' THEN -soTien ELSE 0 END),0)
     FROM dbo.GiaoDichThanhToan WITH(UPDLOCK,HOLDLOCK) WHERE maHoaDon=@invoice AND trangThai=N'Đã hoàn tất';
    IF @amount>@net THROW 53104,N'Số tiền hoàn vượt số tiền đã thu',1;
    SELECT TOP(1) @source=p.maGiaoDichThanhToan,@sourceMethod=p.phuongThuc
     FROM dbo.GiaoDichThanhToan p WITH(UPDLOCK,HOLDLOCK)
     WHERE p.maHoaDon=@invoice AND p.loai=N'Thanh toán' AND p.trangThai=N'Đã hoàn tất'
      AND p.soTien-COALESCE((SELECT SUM(r.soTien) FROM dbo.GiaoDichThanhToan r
       WHERE r.maHoaDon=@invoice AND r.loai=N'Hoàn tiền' AND r.trangThai=N'Đã hoàn tất'
        AND r.maThamChieu LIKE N'REFUND_OF:'+CONVERT(NVARCHAR(30),p.maGiaoDichThanhToan)+N':%'),0)>=@amount
     ORDER BY p.thoiDiemPhatSinh,p.maGiaoDichThanhToan;
    IF @source IS NULL THROW 53105,N'Không tìm thấy giao dịch gốc để hoàn tiền',1;
    INSERT dbo.GiaoDichThanhToan(maHoaDon,soTien,phuongThuc,loai,trangThai,maThamChieu,thoiDiemPhatSinh,maNguoiThucHien,khoaChongTrung)
     VALUES(@invoice,@amount,@sourceMethod,N'Hoàn tiền',N'Đã hoàn tất',N'REFUND_OF:'+CONVERT(NVARCHAR(30),@source)+N':'+@reference,@now,@actor,@storedKey);
   END
   ELSE THROW 51008,N'Lệnh giao dịch không hợp lệ',1;
   SET @id=SCOPE_IDENTITY();SET @created=1;
   INSERT dbo.ButToanTaiChinh(loaiButToan,loaiNguon,maNguon,chieuButToan,soTien,maNguoiThucHien,thoiDiemPhatSinh,ghiChu,daChotSo)
    VALUES(CASE WHEN @command=N'payment' THEN N'PAYMENT_RECEIVED' ELSE N'REFUND_ISSUED' END,N'PAYMENT_TRANSACTION',CONVERT(NVARCHAR(100),@id),
     CASE WHEN @command=N'payment' THEN N'Ghi nợ' ELSE N'Ghi có' END,@amount,@actor,@now,COALESCE(@reference,N''),1);
  END;
  SET @due=dbo.fnTinhSoDuHoaDon(@invoice);
  UPDATE dbo.HoaDon SET soTienPhaiTra=@due,trangThai=CASE WHEN @due=0 THEN N'Đã thanh toán' ELSE N'Chưa thanh toán' END,
   phuongThucThanhToan=COALESCE(@sourceMethod,@method),phienBan=phienBan+@created WHERE maHoaDon=@invoice;
  COMMIT TRANSACTION;
 END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK TRANSACTION;THROW;END CATCH;
END;
GO

-- =============================================================================
-- Receipt issue: unique number, invoice tender balance and ledger append are atomic.
-- =============================================================================
CREATE PROCEDURE dbo.uspLenhHoaDon
 @command NVARCHAR(30),@reservation BIGINT=NULL,@invoice BIGINT=NULL,@at DATETIME2(6)=NULL,
 @method NVARCHAR(30)=NULL,@delta DECIMAL(12,2)=NULL,@reason NVARCHAR(500)=NULL,@storedKey NVARCHAR(100)=NULL,
 @actor NVARCHAR(50),@approval BIGINT=NULL,@fingerprint NVARCHAR(64)=NULL,@customer BIGINT=NULL,@now DATETIME2(6)
AS
BEGIN
 SET NOCOUNT ON;SET XACT_ABORT ON;
 BEGIN TRY
  BEGIN TRANSACTION;
  DECLARE @state NVARCHAR(30),@deposit DECIMAL(12,2),@guest BIGINT,@actualIn DATETIME2(6),@rental NVARCHAR(20),
   @roomTotal DECIMAL(19,2)=0,@extension DECIMAL(19,2)=0,@late DECIMAL(19,2)=0,@serviceTotal DECIMAL(19,2)=0,
   @compensation DECIMAL(19,2)=0,@discount DECIMAL(19,2)=0,@total DECIMAL(19,2),@balance DECIMAL(19,2),
   @tier NVARCHAR(20),@newTier NVARCHAR(20),@source BIGINT,@payment BIGINT,@receipt BIGINT,
   @sourceAmount DECIMAL(12,2),@sourceMethod NVARCHAR(30),@room NVARCHAR(10),@locked BIGINT;
  IF @command IN(N'deposit',N'checkout')
  BEGIN
   SELECT @state=trangThai,@deposit=tienDatCoc,@guest=maKhachLuuTru,@actualIn=thoiDiemNhanPhongThucTe,@rental=hinhThucThue
    FROM dbo.PhieuDatPhong WITH(UPDLOCK,HOLDLOCK) WHERE maPhieuDatPhong=@reservation;
   IF @state IS NULL THROW 53408,N'Không tìm thấy đặt phòng',1;
   SELECT @invoice=maHoaDon FROM dbo.HoaDon WITH(UPDLOCK,HOLDLOCK) WHERE maPhieuDatPhong=@reservation;
   IF @command=N'deposit' AND @deposit<=0 BEGIN COMMIT TRANSACTION;RETURN;END;
   IF @command=N'deposit' AND EXISTS(SELECT 1 FROM dbo.GiaoDichThanhToan WHERE maHoaDon=@invoice AND loai=N'Thanh toán' AND(maThamChieu LIKE N'DEPOSIT:%' OR maSuKienBenNgoai IS NOT NULL))
    BEGIN COMMIT TRANSACTION;RETURN;END;
   IF @invoice IS NULL
   BEGIN
    INSERT dbo.HoaDon(maPhieuDatPhong,thoiDiemPhatHanh,trangThai) VALUES(@reservation,@now,N'Dự kiến');SET @invoice=SCOPE_IDENTITY();
   END;
  END
  ELSE
  BEGIN
   SELECT @locked=maHoaDon,@reservation=maPhieuDatPhong FROM dbo.HoaDon WITH(UPDLOCK,HOLDLOCK) WHERE maHoaDon=@invoice;
   IF @locked IS NULL THROW 53101,N'Không tìm thấy hóa đơn',1;
  END;

  IF @command=N'deposit'
  BEGIN
   INSERT dbo.GiaoDichThanhToan(maHoaDon,soTien,phuongThuc,loai,trangThai,maThamChieu,thoiDiemPhatSinh,maNguoiThucHien,khoaChongTrung)
    VALUES(@invoice,@deposit,N'Tiền mặt',N'Thanh toán',N'Đã hoàn tất',N'DEPOSIT:'+CONVERT(NVARCHAR(20),@reservation),@now,@actor,N'DEPOSIT:'+CONVERT(NVARCHAR(20),@reservation));
   SET @payment=SCOPE_IDENTITY();
   INSERT dbo.BienLai(soBienLai,maHoaDon,soTien,phuongThuc,thoiDiemPhatHanh,nguoiPhatHanh)
    VALUES(N'DEP-'+CONVERT(NVARCHAR(20),@reservation),@invoice,@deposit,N'Tiền mặt',@now,@actor);SET @receipt=SCOPE_IDENTITY();
   INSERT dbo.ButToanTaiChinh(loaiButToan,loaiNguon,maNguon,chieuButToan,soTien,maNguoiThucHien,thoiDiemPhatSinh,ghiChu,daChotSo)
    VALUES(N'PAYMENT_RECEIVED',N'PAYMENT_TRANSACTION',CONVERT(NVARCHAR(100),@payment),N'Ghi nợ',@deposit,@actor,@now,N'DEPOSIT',1),
     (N'RECEIPT_ISSUED',N'RECEIPT',CONVERT(NVARCHAR(100),@receipt),N'Ghi nợ',@deposit,@actor,@now,N'Tiền mặt',1);
   UPDATE dbo.HoaDon SET tienDatCocDaTra=@deposit,phuongThucThanhToan=N'Tiền mặt',trangThai=N'Dự kiến',phienBan=phienBan+1 WHERE maHoaDon=@invoice;
   UPDATE dbo.PhieuDatPhong SET trangThaiThanhToanCoc=N'Đã thanh toán',maThanhToanDatCoc=NULL,thoiDiemHetHanThanhToanCoc=NULL,phienBan=phienBan+1 WHERE maPhieuDatPhong=@reservation;
   INSERT dbo.NhatKyKiemSoat(nguoiThucHien,hanhDong,loaiDoiTuong,maDoiTuong,duLieuSau)
    VALUES(@actor,N'DEPOSIT_PAYMENT_RECORDED',N'PAYMENT_TRANSACTION',CONVERT(NVARCHAR(100),@payment),CONVERT(NVARCHAR(30),@deposit));
  END
  ELSE IF @command=N'checkout'
  BEGIN
   IF @state<>N'Đã nhận phòng' THROW 53410,N'Chỉ được checkout booking đang ở',1;
   IF @at IS NULL OR @actualIn IS NULL OR @at<=@actualIn THROW 53501,N'Giờ trả phải sau giờ nhận thực tế',1;
   DECLARE checkoutRooms CURSOR LOCAL FAST_FORWARD FOR SELECT maPhong FROM dbo.ChiTietDatPhong WHERE maPhieuDatPhong=@reservation ORDER BY maPhong;
   OPEN checkoutRooms;FETCH NEXT FROM checkoutRooms INTO @room;
   WHILE @@FETCH_STATUS=0
   BEGIN
    SELECT @room=maPhong FROM dbo.Phong WITH(UPDLOCK,HOLDLOCK) WHERE maPhong=@room;
    FETCH NEXT FROM checkoutRooms INTO @room;
   END;
   CLOSE checkoutRooms;DEALLOCATE checkoutRooms;
   SELECT @tier=hangThanhVien FROM dbo.KhachLuuTru WITH(UPDLOCK,HOLDLOCK) WHERE maKhachLuuTru=@guest;
   SELECT @roomTotal=COALESCE(SUM(CASE WHEN c.thoiDiemTraPhongBanDau>c.thoiDiemNhanPhong THEN dbo.fnTinhTongTienPhong(l.giaTheoNgay,l.giaTheoGio,c.thoiDiemNhanPhong,c.thoiDiemTraPhongBanDau,
     CASE WHEN @rental=N'Theo giờ' THEN 1 ELSE 0 END,3) ELSE 0 END),0),
    @extension=COALESCE(SUM(ROUND(l.giaTheoNgay/24.0,2)*CEILING(DATEDIFF_BIG(MINUTE,c.thoiDiemTraPhongBanDau,c.thoiDiemTraPhong)/60.0)),0),
    @late=COALESCE(SUM(CASE WHEN @at<=DATEADD(MINUTE,20,c.thoiDiemTraPhong) THEN 0
     WHEN CAST(@at AS DATE)>CAST(c.thoiDiemTraPhong AS DATE) THEN l.giaTheoNgay
     ELSE ROUND(l.giaTheoNgay*CASE WHEN CAST(@at AS TIME)<='14:00' THEN 0.15 WHEN CAST(@at AS TIME)<='16:00' THEN 0.20 WHEN CAST(@at AS TIME)<='18:00' THEN 0.50 ELSE 1 END,2) END),0)
   FROM dbo.ChiTietDatPhong c JOIN dbo.Phong p ON p.maPhong=c.maPhong JOIN dbo.LoaiPhong l ON l.maLoaiPhong=p.maLoaiPhong WHERE c.maPhieuDatPhong=@reservation;
   SET @serviceTotal=dbo.fnTinhTongTienDichVu(@reservation);
   SELECT @compensation=COALESCE(SUM(tienBoiThuong),0) FROM dbo.SuCoThietBi WHERE maPhieuDatPhong=@reservation;
   IF @late>0
   BEGIN
    UPDATE dbo.KhachLuuTru SET soLanTraPhongMuon=soLanTraPhongMuon+1,
     hangThanhVien=CASE WHEN soLanTraPhongMuon+1>3 THEN CASE hangThanhVien WHEN N'Bạch kim' THEN N'Vàng' WHEN N'Vàng' THEN N'Bạc' ELSE N'Tiêu chuẩn' END ELSE hangThanhVien END WHERE maKhachLuuTru=@guest;
    SELECT @newTier=hangThanhVien FROM dbo.KhachLuuTru WHERE maKhachLuuTru=@guest;
    IF @newTier<>@tier INSERT dbo.LichSuHangThanhVien(maKhachLuuTru,hangCu,hangMoi,lyDo,thoiDiemThayDoi) VALUES(@guest,@tier,@newTier,N'LATE_CHECKOUT',@now);
    SET @tier=@newTier;
   END;
   SET @discount=ROUND(@roomTotal*CASE @tier WHEN N'Bạc' THEN 0.05 WHEN N'Vàng' THEN 0.10 WHEN N'Bạch kim' THEN 0.15 ELSE 0 END,2);
   UPDATE dbo.HoaDon SET thoiDiemPhatHanh=@at,tongTienPhong=@roomTotal,tongTienDichVu=@serviceTotal,tienPhuThu=@late,
    phiGiaHan=@extension,tienBoiThuong=@compensation,tienGiamGia=@discount,phuongThucThanhToan=COALESCE(@method,phuongThucThanhToan),phienBan=phienBan+1 WHERE maHoaDon=@invoice;
   UPDATE dbo.PhieuDatPhong SET trangThai=N'Đã trả phòng',thoiDiemTraPhongThucTe=@at,phienBan=phienBan+1 WHERE maPhieuDatPhong=@reservation;
   UPDATE dbo.ChiTietDatPhong SET trangThai=N'Đã trả phòng' WHERE maPhieuDatPhong=@reservation;
   UPDATE p SET trangThai=N'Đang dọn phòng',phienBan=phienBan+1 FROM dbo.Phong p JOIN dbo.ChiTietDatPhong c ON c.maPhong=p.maPhong WHERE c.maPhieuDatPhong=@reservation;
   UPDATE dbo.DatDichVuKhachSan SET trangThai=N'Đã hủy' WHERE maPhieuDatPhong=@reservation AND trangThai=N'Đã xác nhận';
   UPDATE dbo.KhachLuuTru SET tongChiTieu=tongChiTieu+@roomTotal+@serviceTotal+@late+@extension+@compensation-@discount,phienBan=phienBan+1 WHERE maKhachLuuTru=@guest;
   -- VIP follows the confirmed rental product, not an elapsed-hour threshold.
   -- A standard package night is 14:00 to 12:00 next day (22 hours).
   -- Hourly bookings never earn a stay; a completed package earns one per booking.
   IF @rental=N'Theo gói'
   BEGIN
    UPDATE dbo.KhachLuuTru SET soLanLuuTruHoanThanh=soLanLuuTruHoanThanh+1,
     hangThanhVien=CASE WHEN soLanLuuTruHoanThanh+1>=50 THEN N'Bạch kim' WHEN soLanLuuTruHoanThanh+1>=25 THEN N'Vàng' WHEN soLanLuuTruHoanThanh+1>=10 THEN N'Bạc' ELSE N'Tiêu chuẩn' END WHERE maKhachLuuTru=@guest;
    SELECT @newTier=hangThanhVien FROM dbo.KhachLuuTru WHERE maKhachLuuTru=@guest;
    IF @newTier<>@tier INSERT dbo.LichSuHangThanhVien(maKhachLuuTru,hangCu,hangMoi,lyDo,thoiDiemThayDoi) VALUES(@guest,@tier,@newTier,N'COMPLETED_STAY',@now);
   END;
   SET @total=ROUND((@roomTotal+@serviceTotal+@late+@extension+@compensation-@discount)/1000.0,0)*1000;
   IF @total>0 INSERT dbo.ButToanTaiChinh(loaiButToan,loaiNguon,maNguon,chieuButToan,soTien,maNguoiThucHien,thoiDiemPhatSinh,ghiChu,daChotSo)
    VALUES(N'REVENUE_RECOGNIZED',N'INVOICE',CONVERT(NVARCHAR(100),@invoice),N'Ghi có',@total,@actor,@at,N'CHECKOUT',1);
   INSERT dbo.NhatKyKiemSoat(nguoiThucHien,hanhDong,loaiDoiTuong,maDoiTuong,duLieuSau)
    VALUES(@actor,N'INVOICE_RECONCILED',N'INVOICE',CONVERT(NVARCHAR(100),@invoice),CONVERT(NVARCHAR(30),@total)),
     (@actor,N'RESERVATION_CHECKED_OUT',N'RESERVATION',CONVERT(NVARCHAR(100),@reservation),CONVERT(NVARCHAR(40),@at,126));
  END
  ELSE IF @command=N'adjust'
  BEGIN
   IF @delta IS NULL OR @delta=0 OR NULLIF(LTRIM(RTRIM(@reason)),N'') IS NULL THROW 53502,N'Điều chỉnh phải có số tiền và lý do',1;
   IF EXISTS(SELECT 1 FROM dbo.DieuChinhHoaDon WHERE khoaChongTrung=@storedKey) BEGIN COMMIT TRANSACTION;RETURN;END;
   IF NOT EXISTS(SELECT 1 FROM dbo.YeuCauPheDuyet WITH(UPDLOCK,HOLDLOCK) WHERE maYeuCauPheDuyet=@approval
    AND hanhDong=N'Điều chỉnh thanh toán' AND maDoiTuong=CONVERT(NVARCHAR(100),@invoice) AND nguoiYeuCau=@actor
    AND trangThai=N'Đã sử dụng' AND soTien=ABS(@delta) AND dauVanTayDuLieu=@fingerprint) THROW 52205,N'Cần phê duyệt đúng nội dung điều chỉnh',1;
   SELECT @total=ROUND((tongTienPhong+tongTienDichVu+tienPhuThu+tienBoiThuong+phiGiaHan+tongTienDieuChinh-tienGiamGia)/1000.0,0)*1000 FROM dbo.HoaDon WHERE maHoaDon=@invoice;
   IF @total+@delta<0 THROW 53503,N'Điều chỉnh giảm không được làm tổng hóa đơn âm',1;
   INSERT dbo.DieuChinhHoaDon(maHoaDon,soTienChenhLech,lyDo,maNguoiThucHien,thoiDiemPhatSinh,khoaChongTrung) VALUES(@invoice,@delta,@reason,@actor,@now,@storedKey);
   SET @payment=SCOPE_IDENTITY();
   UPDATE dbo.HoaDon SET tongTienDieuChinh=tongTienDieuChinh+@delta,phienBan=phienBan+1 WHERE maHoaDon=@invoice;
   INSERT dbo.ButToanTaiChinh(loaiButToan,loaiNguon,maNguon,chieuButToan,soTien,maNguoiThucHien,thoiDiemPhatSinh,ghiChu,daChotSo)
    VALUES(N'INVOICE_ADJUSTMENT',N'INVOICE_ADJUSTMENT',CONVERT(NVARCHAR(100),@payment),CASE WHEN @delta>0 THEN N'Ghi có' ELSE N'Ghi nợ' END,ABS(@delta),@actor,@now,@reason,1);
   INSERT dbo.NhatKyKiemSoat(nguoiThucHien,hanhDong,loaiDoiTuong,maDoiTuong,duLieuTruoc,duLieuSau,lyDo)
    VALUES(@actor,N'INVOICE_ADJUSTED',N'INVOICE',CONVERT(NVARCHAR(100),@invoice),CONVERT(NVARCHAR(30),@total),CONVERT(NVARCHAR(30),@total+@delta),@reason);
  END
  ELSE IF @command IN(N'refund-deposit',N'cancel-refund')
  BEGIN
   SELECT @total=COALESCE(SUM(soDu),0) FROM dbo.vwSoDuTienCoc WHERE maHoaDon=@invoice AND soDu>0;
   IF @total<=0 THROW 53504,N'Tiền cọc đã được hoàn hoặc chưa ghi nhận',1;
   IF @customer IS NULL
   BEGIN
    IF NOT EXISTS(SELECT 1 FROM dbo.YeuCauPheDuyet WITH(UPDLOCK,HOLDLOCK) WHERE maYeuCauPheDuyet=@approval
     AND hanhDong=N'Hoàn tiền đặt cọc' AND maDoiTuong=CONVERT(NVARCHAR(100),@invoice) AND nguoiYeuCau=@actor
     AND trangThai=N'Đã sử dụng' AND soTien=@total AND dauVanTayDuLieu=@fingerprint) THROW 52205,N'Cần approval đúng nội dung hoàn cọc',1;
   END
   ELSE IF @command<>N'cancel-refund' OR NOT EXISTS(SELECT 1 FROM dbo.PhieuDatPhong WHERE maPhieuDatPhong=@reservation
    AND maTaiKhoanKhachHang=@customer AND trangThai=N'Đã hủy' AND ketQuaHuy=N'Hoàn tiền') THROW 53505,N'Không được tự hoàn cọc ngoài policy hủy đúng hạn',1;
   DECLARE deposits CURSOR LOCAL FAST_FORWARD FOR SELECT maGiaoDichThanhToan,phuongThuc,soDu FROM dbo.vwSoDuTienCoc WHERE maHoaDon=@invoice AND soDu>0 ORDER BY thoiDiemPhatSinh,maGiaoDichThanhToan;
   OPEN deposits;FETCH NEXT FROM deposits INTO @source,@sourceMethod,@sourceAmount;
   WHILE @@FETCH_STATUS=0
   BEGIN
    INSERT dbo.GiaoDichThanhToan(maHoaDon,soTien,phuongThuc,loai,trangThai,maThamChieu,thoiDiemPhatSinh,maNguoiThucHien,khoaChongTrung)
     VALUES(@invoice,@sourceAmount,@sourceMethod,N'Hoàn tiền',N'Đã hoàn tất',N'REFUND_OF:'+CONVERT(NVARCHAR(20),@source)+N':'+@command,@now,@actor,@storedKey+N':'+CONVERT(NVARCHAR(20),@source));
    SET @payment=SCOPE_IDENTITY();
    INSERT dbo.ButToanTaiChinh(loaiButToan,loaiNguon,maNguon,chieuButToan,soTien,maNguoiThucHien,thoiDiemPhatSinh,ghiChu,daChotSo)
     VALUES(N'REFUND_ISSUED',N'PAYMENT_TRANSACTION',CONVERT(NVARCHAR(100),@payment),N'Ghi có',@sourceAmount,@actor,@now,@command,1);
    INSERT dbo.NhatKyKiemSoat(nguoiThucHien,hanhDong,loaiDoiTuong,maDoiTuong,duLieuSau,lyDo)
     VALUES(@actor,CASE WHEN @command=N'cancel-refund' THEN N'DEPOSIT_REFUNDED_ON_CANCELLATION' ELSE N'DEPOSIT_REFUNDED' END,N'PAYMENT_TRANSACTION',CONVERT(NVARCHAR(100),@payment),CONVERT(NVARCHAR(30),@sourceAmount),N'REFUND_OF:'+CONVERT(NVARCHAR(20),@source));
    FETCH NEXT FROM deposits INTO @source,@sourceMethod,@sourceAmount;
   END;
   CLOSE deposits;DEALLOCATE deposits;
  END
  ELSE THROW 51008,N'Lệnh hóa đơn không hợp lệ',1;
  SELECT @deposit=COALESCE(SUM(CASE WHEN soDu>0 THEN soDu ELSE 0 END),0) FROM dbo.vwSoDuTienCoc WHERE maHoaDon=@invoice;
  SET @balance=dbo.fnTinhSoDuHoaDon(@invoice);
  UPDATE dbo.HoaDon SET tienDatCocDaTra=@deposit,soTienPhaiTra=@balance,
   trangThai=CASE WHEN @command=N'deposit' THEN N'Dự kiến' WHEN @balance=0 THEN N'Đã thanh toán' ELSE N'Chưa thanh toán' END,
   phienBan=phienBan+1 WHERE maHoaDon=@invoice;
  COMMIT TRANSACTION;
 END TRY BEGIN CATCH
  IF CURSOR_STATUS('local','checkoutRooms')>=-1 BEGIN IF CURSOR_STATUS('local','checkoutRooms')>-1 CLOSE checkoutRooms;DEALLOCATE checkoutRooms;END;
  IF CURSOR_STATUS('local','deposits')>=-1 BEGIN IF CURSOR_STATUS('local','deposits')>-1 CLOSE deposits;DEALLOCATE deposits;END;
  IF @@TRANCOUNT>0 ROLLBACK TRANSACTION;THROW;
 END CATCH;
END;
GO

CREATE PROCEDURE dbo.uspPhatHanhBienLai
 @invoice BIGINT,@number NVARCHAR(MAX),@amount DECIMAL(38,6),@method NVARCHAR(MAX),
 @actor NVARCHAR(MAX),@now DATETIME2(6)
AS
BEGIN
 SET NOCOUNT ON;SET XACT_ABORT ON;
 BEGIN TRY
  BEGIN TRANSACTION;
  DECLARE @existing BIGINT,@locked BIGINT,@paid DECIMAL(19,2),@issued DECIMAL(19,2),@id BIGINT;
  SELECT @existing=maBienLai FROM dbo.BienLai WITH(UPDLOCK,HOLDLOCK) WHERE soBienLai=@number;
  IF @existing IS NOT NULL THROW 53201,N'Số biên lai đã tồn tại',1;
  SELECT @locked=maHoaDon FROM dbo.HoaDon WITH(UPDLOCK,HOLDLOCK) WHERE maHoaDon=@invoice;
  IF @locked IS NULL THROW 53101,N'Không tìm thấy hóa đơn',1;
  SELECT @paid=COALESCE(SUM(CASE WHEN loai=N'Thanh toán' THEN soTien WHEN loai=N'Hoàn tiền' THEN -soTien ELSE 0 END),0)
   FROM dbo.GiaoDichThanhToan WITH(UPDLOCK,HOLDLOCK)
   WHERE maHoaDon=@invoice AND phuongThuc=@method AND trangThai=N'Đã hoàn tất';
  SELECT @issued=COALESCE(SUM(soTien),0) FROM dbo.BienLai WITH(UPDLOCK,HOLDLOCK) WHERE maHoaDon=@invoice AND phuongThuc=@method;
  IF @amount<=0 THROW 53202,N'Số tiền biên lai phải lớn hơn 0',1;
  IF @amount>@paid-@issued THROW 53203,N'Biên lai vượt số tiền đã thu chưa lập biên lai',1;
  INSERT dbo.BienLai(soBienLai,maHoaDon,soTien,phuongThuc,thoiDiemPhatHanh,nguoiPhatHanh)
   VALUES(@number,@invoice,@amount,@method,@now,@actor);SET @id=SCOPE_IDENTITY();
  INSERT dbo.ButToanTaiChinh(loaiButToan,loaiNguon,maNguon,chieuButToan,soTien,maNguoiThucHien,thoiDiemPhatSinh,ghiChu,daChotSo)
   VALUES(N'RECEIPT_ISSUED',N'RECEIPT',CONVERT(NVARCHAR(100),@id),N'Ghi nợ',@amount,@actor,@now,@method,1);
  COMMIT TRANSACTION;
 END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK TRANSACTION;THROW;END CATCH;
END;
GO

-- =============================================================================
-- Customer hold expiry: drafts expire, pending extensions roll back, and VNPay
-- attempts plus audit follow the reservation in the same batch transaction.
-- =============================================================================
CREATE PROCEDURE dbo.uspHetHanGiuCoc @now DATETIME2(6)
AS
BEGIN
 SET NOCOUNT ON;SET XACT_ABORT ON;
 BEGIN TRY
  BEGIN TRANSACTION;
  DECLARE @id BIGINT,@pending NVARCHAR(20),@status NVARCHAR(30),@oldIn DATETIME2(6),@oldOut DATETIME2(6),@oldDeposit DECIMAL(12,2),@paid NVARCHAR(20),@expires DATETIME2(6);
  DECLARE holds CURSOR LOCAL FAST_FORWARD FOR
   SELECT maPhieuDatPhong FROM dbo.PhieuDatPhong
   WHERE trangThaiThanhToanCoc=N'Chờ thanh toán' AND thoiDiemHetHanThanhToanCoc<=@now
    AND (trangThai=N'Bản nháp' OR loaiThayDoiDangCho IS NOT NULL) ORDER BY maPhieuDatPhong;
  OPEN holds;FETCH NEXT FROM holds INTO @id;
  WHILE @@FETCH_STATUS=0
  BEGIN
   SELECT @pending=loaiThayDoiDangCho,@status=trangThai,@oldIn=thoiDiemNhanPhongTruocThayDoi,
    @oldOut=thoiDiemTraPhongTruocThayDoi,@oldDeposit=tienDatCocTruocThayDoi,
    @paid=trangThaiThanhToanCoc,@expires=thoiDiemHetHanThanhToanCoc
   FROM dbo.PhieuDatPhong WITH(UPDLOCK,HOLDLOCK) WHERE maPhieuDatPhong=@id;
   -- The cursor is only a candidate list. A provider callback or a new hold
   -- may have committed while this worker waited for the reservation lock.
   IF @paid<>N'Chờ thanh toán' OR @expires IS NULL OR @expires>@now
   BEGIN FETCH NEXT FROM holds INTO @id;CONTINUE;END;
   IF @pending IS NOT NULL
   BEGIN
    UPDATE dbo.ChiTietDatPhong SET thoiDiemNhanPhong=@oldIn,thoiDiemTraPhong=@oldOut WHERE maPhieuDatPhong=@id;
    UPDATE dbo.PhieuDatPhong SET tienDatCoc=@oldDeposit,trangThaiThanhToanCoc=N'Đã thanh toán',
     maThanhToanDatCoc=NULL,thoiDiemHetHanThanhToanCoc=NULL,loaiThayDoiDangCho=NULL,
     thoiDiemNhanPhongTruocThayDoi=NULL,thoiDiemTraPhongTruocThayDoi=NULL,
     tienDatCocTruocThayDoi=NULL,tienDatCocBoSung=0,phienBan=phienBan+1 WHERE maPhieuDatPhong=@id;
    INSERT dbo.NhatKyKiemSoat(nguoiThucHien,hanhDong,loaiDoiTuong,maDoiTuong,duLieuTruoc,duLieuSau,lyDo)
     VALUES(N'SYSTEM',N'CUSTOMER_EXTENSION_PAYMENT_EXPIRED',N'RESERVATION',CONVERT(NVARCHAR(100),@id),N'PENDING',N'ROLLED_BACK',N'ADDITIONAL_DEPOSIT_TIMEOUT');
   END
   ELSE IF @status=N'Bản nháp'
   BEGIN
    UPDATE dbo.PhieuDatPhong SET trangThai=N'Đã hủy',trangThaiThanhToanCoc=N'Đã hết hạn',phienBan=phienBan+1 WHERE maPhieuDatPhong=@id;
    UPDATE dbo.ChiTietDatPhong SET trangThai=N'Đã hủy' WHERE maPhieuDatPhong=@id;
    INSERT dbo.NhatKyKiemSoat(nguoiThucHien,hanhDong,loaiDoiTuong,maDoiTuong,duLieuTruoc,duLieuSau,lyDo)
     VALUES(N'SYSTEM',N'CUSTOMER_RESERVATION_HOLD_EXPIRED',N'RESERVATION',CONVERT(NVARCHAR(100),@id),N'PENDING',N'EXPIRED',N'DEPOSIT_HOLD_TIMEOUT');
   END;
   UPDATE dbo.YeuCauThanhToanVnpay SET trangThai=N'Đã hết hạn',thoiDiemHoanTat=@now WHERE maPhieuDatPhong=@id AND trangThai=N'Chờ thanh toán';
   FETCH NEXT FROM holds INTO @id;
  END;
  CLOSE holds;DEALLOCATE holds;COMMIT TRANSACTION;
 END TRY BEGIN CATCH
  IF CURSOR_STATUS('local','holds')>=-1 BEGIN IF CURSOR_STATUS('local','holds')>-1 CLOSE holds;DEALLOCATE holds;END;
  IF @@TRANCOUNT>0 ROLLBACK TRANSACTION;THROW;
 END CATCH;
END;
GO

-- Reservation command owner used by both staff and customer use cases.
CREATE PROCEDURE dbo.uspLenhDatPhong
 @command NVARCHAR(30),@id BIGINT,@customer BIGINT=NULL,@roomsJson NVARCHAR(MAX)=NULL,
 @at DATETIME2(6)=NULL,@newIn DATETIME2(6)=NULL,@deposit DECIMAL(12,2)=NULL,
 @reason NVARCHAR(500)=NULL,@service NVARCHAR(10)=NULL,@quantity INT=NULL,
 @paymentCode NVARCHAR(40)=NULL,@expires DATETIME2(6)=NULL,@actor NVARCHAR(50),@now DATETIME2(6)
AS
BEGIN
 SET NOCOUNT ON;SET XACT_ABORT ON;
 BEGIN TRY
  BEGIN TRANSACTION;
  DECLARE @state NVARCHAR(30),@paid NVARCHAR(20),@pending NVARCHAR(20),@method NVARCHAR(20),
   @version BIGINT,@guest BIGINT,@oldDeposit DECIMAL(12,2),@oldIn DATETIME2(6),@oldOut DATETIME2(6),
   @room NVARCHAR(10),@roomState NVARCHAR(30),@tier NVARCHAR(20),@newTier NVARCHAR(20),@late BIT=0;
  SELECT @state=trangThai,@paid=trangThaiThanhToanCoc,@pending=loaiThayDoiDangCho,
   @method=phuongThucBaoDam,@version=phienBan,@guest=maKhachLuuTru,@oldDeposit=tienDatCoc
  FROM dbo.PhieuDatPhong WITH(UPDLOCK,HOLDLOCK)
  WHERE maPhieuDatPhong=@id AND (@customer IS NULL OR maTaiKhoanKhachHang=@customer);
  IF @state IS NULL THROW 53408,N'Không tìm thấy đặt phòng',1;
  SELECT @oldIn=MIN(thoiDiemNhanPhong),@oldOut=MAX(thoiDiemTraPhong) FROM dbo.ChiTietDatPhong WITH(UPDLOCK,HOLDLOCK) WHERE maPhieuDatPhong=@id;
  IF @oldIn IS NULL THROW 53409,N'Đặt phòng không có phòng',1;
  DECLARE roomLocks CURSOR LOCAL FAST_FORWARD FOR SELECT maPhong FROM dbo.ChiTietDatPhong WHERE maPhieuDatPhong=@id ORDER BY maPhong;
  OPEN roomLocks;FETCH NEXT FROM roomLocks INTO @room;
  WHILE @@FETCH_STATUS=0
  BEGIN
   SELECT @roomState=trangThai FROM dbo.Phong WITH(UPDLOCK,HOLDLOCK) WHERE maPhong=@room;
   FETCH NEXT FROM roomLocks INTO @room;
  END;
  CLOSE roomLocks;DEALLOCATE roomLocks;

  IF @command=N'confirm'
  BEGIN
   IF @state<>N'Bản nháp' THROW 53410,N'Trạng thái đặt phòng không hợp lệ',1;
   IF @method=N'VNPay' AND @paid<>N'Đã thanh toán' THROW 53411,N'Booking VNPay phải thanh toán cọc trước khi xác nhận',1;
   IF EXISTS(SELECT 1 FROM dbo.ChiTietDatPhong c JOIN dbo.Phong p ON p.maPhong=c.maPhong WHERE c.maPhieuDatPhong=@id
    AND(p.trangThai IN(N'Đang có khách',N'Đang dọn phòng',N'Đang bảo trì',N'Ngừng sử dụng')
     OR dbo.fnKiemTraPhongTrong(c.maPhong,c.thoiDiemNhanPhong,c.thoiDiemTraPhong,@now,@id)=0))
    THROW 51004,N'Phòng không còn khả dụng để xác nhận',1;
   UPDATE dbo.PhieuDatPhong SET trangThai=N'Đã xác nhận',phienBan=phienBan+1 WHERE maPhieuDatPhong=@id;
   UPDATE p SET trangThai=N'Đã giữ phòng',phienBan=phienBan+1 FROM dbo.Phong p JOIN dbo.ChiTietDatPhong c ON c.maPhong=p.maPhong WHERE c.maPhieuDatPhong=@id;
  END
  ELSE IF @command=N'check-in'
  BEGIN
   IF @state NOT IN(N'Đã xác nhận',N'Đã thanh toán cọc') THROW 53410,N'Trạng thái đặt phòng không hợp lệ',1;
   IF @at IS NULL SET @at=@now;
   IF EXISTS(SELECT 1 FROM dbo.ChiTietDatPhong WHERE maPhieuDatPhong=@id AND @at<thoiDiemNhanPhong) THROW 53412,N'Không được nhận phòng sớm',1;
   IF EXISTS(SELECT 1 FROM dbo.ChiTietDatPhong WHERE maPhieuDatPhong=@id AND @at>=thoiDiemTraPhong) THROW 53413,N'Giờ nhận phải trước giờ trả dự kiến',1;
   IF EXISTS(SELECT 1 FROM dbo.ChiTietDatPhong c JOIN dbo.Phong p ON p.maPhong=c.maPhong WHERE c.maPhieuDatPhong=@id AND p.trangThai NOT IN(N'Sẵn sàng',N'Đã giữ phòng'))
    THROW 53414,N'Phòng chưa sẵn sàng để nhận khách',1;
   IF EXISTS(SELECT 1 FROM dbo.ChiTietDatPhong WHERE maPhieuDatPhong=@id AND dbo.fnKiemTraPhongTrong(maPhong,@at,thoiDiemTraPhong,@now,@id)=0)
    THROW 51004,N'Phòng có lịch giao nhau',1;
   UPDATE dbo.PhieuDatPhong SET trangThai=N'Đã nhận phòng',thoiDiemNhanPhongThucTe=@at,phienBan=phienBan+1 WHERE maPhieuDatPhong=@id;
   UPDATE dbo.ChiTietDatPhong SET trangThai=N'Đang có khách' WHERE maPhieuDatPhong=@id;
   UPDATE p SET trangThai=N'Đang có khách',phienBan=phienBan+1 FROM dbo.Phong p JOIN dbo.ChiTietDatPhong c ON c.maPhong=p.maPhong WHERE c.maPhieuDatPhong=@id;
  END
  ELSE IF @command=N'extend'
  BEGIN
   IF @state NOT IN(N'Đã xác nhận',N'Đã thanh toán cọc',N'Đã nhận phòng') THROW 53410,N'Trạng thái đặt phòng không hợp lệ',1;
   IF @at IS NULL OR EXISTS(SELECT 1 FROM dbo.ChiTietDatPhong WHERE maPhieuDatPhong=@id AND @at<=thoiDiemTraPhong) THROW 53415,N'Giờ trả mới phải sau giờ trả hiện tại',1;
   IF EXISTS(SELECT 1 FROM dbo.ChiTietDatPhong WHERE maPhieuDatPhong=@id AND @now>DATEADD(HOUR,-1,thoiDiemTraPhong)) THROW 53416,N'Gia hạn phải trước giờ trả ít nhất một giờ',1;
   IF EXISTS(SELECT 1 FROM dbo.ChiTietDatPhong WHERE maPhieuDatPhong=@id AND dbo.fnKiemTraPhongTrong(maPhong,thoiDiemNhanPhong,@at,@now,@id)=0) THROW 51004,N'Gia hạn giao nhau với booking khác',1;
   UPDATE dbo.PhieuDatPhong SET soPhutGiaHan=soPhutGiaHan+DATEDIFF(MINUTE,@oldOut,@at),phienBan=phienBan+1 WHERE maPhieuDatPhong=@id;
   UPDATE dbo.ChiTietDatPhong SET thoiDiemTraPhong=@at WHERE maPhieuDatPhong=@id;
  END
  ELSE IF @command=N'update'
  BEGIN
   IF @state NOT IN(N'Bản nháp',N'Đã xác nhận',N'Đã thanh toán cọc') THROW 53410,N'Trạng thái đặt phòng không hợp lệ',1;
   IF ISJSON(@roomsJson)<>1 THROW 51008,N'Lịch lưu trú không hợp lệ',1;
   DECLARE @next TABLE(room NVARCHAR(10) PRIMARY KEY,checkIn DATETIME2(6),checkOut DATETIME2(6));
   INSERT @next SELECT maPhong,thoiDiemNhanPhong,thoiDiemTraPhong FROM OPENJSON(@roomsJson)
    WITH(maPhong NVARCHAR(10),thoiDiemNhanPhong DATETIME2(6),thoiDiemTraPhong DATETIME2(6));
   IF (SELECT COUNT(*) FROM @next)<>(SELECT COUNT(*) FROM dbo.ChiTietDatPhong WHERE maPhieuDatPhong=@id)
    OR EXISTS(SELECT 1 FROM @next q WHERE NOT EXISTS(SELECT 1 FROM dbo.ChiTietDatPhong c WHERE c.maPhieuDatPhong=@id AND c.maPhong=q.room))
    THROW 53417,N'Cập nhật phải giữ nguyên tập phòng',1;
   IF EXISTS(SELECT 1 FROM @next WHERE checkIn IS NULL OR checkOut IS NULL OR checkIn>=checkOut) THROW 51008,N'Khoảng lưu trú không hợp lệ',1;
   IF EXISTS(SELECT 1 FROM @next WHERE dbo.fnKiemTraPhongTrong(room,checkIn,checkOut,@now,@id)=0) THROW 51004,N'Lịch mới có booking giao nhau',1;
   UPDATE c SET thoiDiemNhanPhong=q.checkIn,thoiDiemTraPhong=q.checkOut,thoiDiemTraPhongBanDau=q.checkOut FROM dbo.ChiTietDatPhong c JOIN @next q ON q.room=c.maPhong WHERE c.maPhieuDatPhong=@id;
   UPDATE dbo.PhieuDatPhong SET tienDatCoc=COALESCE(@deposit,tienDatCoc),phienBan=phienBan+1 WHERE maPhieuDatPhong=@id;
  END
  ELSE IF @command IN(N'customer-extend',N'customer-reschedule')
  BEGIN
   IF @customer IS NULL OR @state NOT IN(N'Đã xác nhận',N'Đã thanh toán cọc') THROW 53418,N'Chỉ booking đã xác nhận mới được thay đổi lịch',1;
   IF @paid<>N'Đã thanh toán' THROW 53411,N'Booking phải hoàn tất cọc trước khi thay đổi lịch',1;
   IF EXISTS(SELECT 1 FROM dbo.PhieuDatPhong WHERE maPhieuDatPhong=@id AND hinhThucThue<>N'Theo gói') THROW 53419,N'Chỉ booking theo gói được thay đổi ngày',1;
   IF @pending IS NOT NULL THROW 53420,N'Booking đang chờ cọc bổ sung',1;
   IF EXISTS(SELECT 1 FROM dbo.ChiTietDatPhong WHERE maPhieuDatPhong=@id AND(thoiDiemNhanPhong<>@oldIn OR thoiDiemTraPhong<>@oldOut)) THROW 53421,N'Các phòng phải cùng lịch lưu trú',1;
   IF @now>=DATEADD(HOUR,-48,@oldIn) THROW 53422,N'Chỉ được đổi ngày trước check-in hơn 48 giờ',1;
   IF EXISTS(SELECT 1 FROM dbo.ChiTietDatPhong c JOIN dbo.Phong p ON p.maPhong=c.maPhong WHERE c.maPhieuDatPhong=@id AND p.trangThai IN(N'Đang có khách',N'Đang dọn phòng',N'Đang bảo trì',N'Ngừng sử dụng')) THROW 53414,N'Phòng hiện không sẵn sàng',1;
   IF @command=N'customer-extend'
   BEGIN
    IF @newIn IS NOT NULL AND @newIn<>@oldOut THROW 53423,N'Phần gia hạn phải nối tiếp lịch cũ',1;
    SET @newIn=@oldIn;
    IF @at IS NULL OR @at<=@oldOut THROW 53415,N'Ngày trả mới phải sau ngày trả hiện tại',1;
   END
   ELSE
   BEGIN
    IF @newIn IS NULL OR @at IS NULL OR @newIn>=@at THROW 51008,N'Khoảng lưu trú không hợp lệ',1;
    IF @newIn<=@now THROW 53405,N'Giờ nhận phải ở tương lai',1;
    IF DATEDIFF_BIG(MICROSECOND,@newIn,@at)<>DATEDIFF_BIG(MICROSECOND,@oldIn,@oldOut) THROW 53424,N'Đổi ngày phải giữ nguyên thời lượng',1;
   END;
   IF EXISTS(SELECT 1 FROM dbo.ChiTietDatPhong WHERE maPhieuDatPhong=@id AND dbo.fnKiemTraPhongTrong(maPhong,@newIn,@at,@now,@id)=0) THROW 51004,N'Lịch mới có booking giao nhau',1;
   IF @command=N'customer-extend'
   BEGIN
    DECLARE @additional DECIMAL(12,2);
    SELECT @additional=ROUND(SUM(dbo.fnTinhTongTienPhong(l.giaTheoNgay,l.giaTheoGio,@oldOut,@at,0,3))*0.5,2)
     FROM dbo.ChiTietDatPhong c JOIN dbo.Phong p ON p.maPhong=c.maPhong JOIN dbo.LoaiPhong l ON l.maLoaiPhong=p.maLoaiPhong WHERE c.maPhieuDatPhong=@id;
    IF @additional<=0 THROW 53425,N'Không tính được cọc bổ sung',1;
    UPDATE dbo.PhieuDatPhong SET loaiThayDoiDangCho=N'Gia hạn',thoiDiemNhanPhongTruocThayDoi=@oldIn,thoiDiemTraPhongTruocThayDoi=@oldOut,
     tienDatCocTruocThayDoi=@oldDeposit,tienDatCocBoSung=@additional,tienDatCoc=@oldDeposit+@additional,
     phuongThucBaoDam=N'VNPay',maThanhToanDatCoc=@paymentCode,thoiDiemHetHanThanhToanCoc=@expires,trangThaiThanhToanCoc=N'Chờ thanh toán',phienBan=phienBan+1 WHERE maPhieuDatPhong=@id;
    UPDATE dbo.ChiTietDatPhong SET thoiDiemTraPhong=@at WHERE maPhieuDatPhong=@id;
   END
   ELSE
   BEGIN
    UPDATE dbo.ChiTietDatPhong SET thoiDiemNhanPhong=@newIn,thoiDiemTraPhong=@at,thoiDiemTraPhongBanDau=@at WHERE maPhieuDatPhong=@id;
    UPDATE dbo.PhieuDatPhong SET phienBan=phienBan+1 WHERE maPhieuDatPhong=@id;
   END;
  END
  ELSE IF @command IN(N'cancel',N'no-show')
  BEGIN
   IF @state NOT IN(N'Bản nháp',N'Đã xác nhận',N'Đã thanh toán cọc') THROW 53410,N'Trạng thái đặt phòng không hợp lệ',1;
   IF @customer IS NOT NULL AND @pending IS NOT NULL THROW 53426,N'Booking đang chờ thanh toán cọc bổ sung',1;
   IF @command=N'no-show' AND @now<@oldOut THROW 53427,N'Chỉ đánh dấu no-show sau khi lịch lưu trú kết thúc',1;
   IF @command=N'cancel' AND NULLIF(LTRIM(RTRIM(@reason)),N'') IS NULL THROW 53428,N'Hủy booking phải có lý do',1;
   IF @now>=@oldOut OR @command=N'no-show'
   BEGIN
    SET @state=N'Không đến';SET @reason=COALESCE(@reason,N'Khách không đến trước khi kỳ lưu trú kết thúc');
   END
   ELSE BEGIN SET @state=N'Đã hủy';IF @now>=DATEADD(HOUR,-48,@oldIn) SET @late=1;END;
   UPDATE dbo.PhieuDatPhong SET trangThai=@state,lyDoHuy=LTRIM(RTRIM(@reason)),
    ketQuaHuy=CASE WHEN @state=N'Không đến' OR @late=1 THEN N'Mất quyền hoàn tiền' WHEN @paid=N'Đã thanh toán' AND @oldDeposit>0 THEN N'Hoàn tiền' ELSE N'Không phát sinh hoàn tiền' END,
    phienBan=phienBan+1 WHERE maPhieuDatPhong=@id;
   UPDATE dbo.ChiTietDatPhong SET trangThai=N'Đã hủy' WHERE maPhieuDatPhong=@id;
   UPDATE dbo.DatDichVuKhachSan SET trangThai=N'Đã hủy' WHERE maPhieuDatPhong=@id AND trangThai=N'Đã xác nhận';
   UPDATE dbo.YeuCauThanhToanVnpay SET trangThai=N'Đã hủy',thoiDiemHoanTat=@now,phienBan=phienBan+1 WHERE maPhieuDatPhong=@id AND trangThai=N'Chờ thanh toán';
   IF @late=1
   BEGIN
    SELECT @tier=hangThanhVien FROM dbo.KhachLuuTru WITH(UPDLOCK,HOLDLOCK) WHERE maKhachLuuTru=@guest;
    UPDATE dbo.KhachLuuTru SET soLanHuyMuon=soLanHuyMuon+1,biChanDatPhong=CASE WHEN soLanHuyMuon+1>=4 THEN 1 ELSE biChanDatPhong END,
     hangThanhVien=CASE WHEN soLanHuyMuon+1>2 THEN CASE hangThanhVien WHEN N'Bạch kim' THEN N'Vàng' WHEN N'Vàng' THEN N'Bạc' ELSE N'Tiêu chuẩn' END ELSE hangThanhVien END,
     phienBan=phienBan+1 WHERE maKhachLuuTru=@guest;
    SELECT @newTier=hangThanhVien FROM dbo.KhachLuuTru WHERE maKhachLuuTru=@guest;
    IF @tier<>@newTier INSERT dbo.LichSuHangThanhVien(maKhachLuuTru,hangCu,hangMoi,lyDo,thoiDiemThayDoi) VALUES(@guest,@tier,@newTier,N'LATE_CANCELLATION',@now);
   END;
  END
  ELSE IF @command=N'service'
  BEGIN
   IF @state<>N'Đã nhận phòng' THROW 53410,N'Chỉ booking đang ở mới được dùng dịch vụ',1;
   DECLARE @price DECIMAL(12,2),@stock INT,@active BIT;
   SELECT @price=gia,@stock=soLuongTonKho,@active=dangHoatDong FROM dbo.DichVu WITH(UPDLOCK,HOLDLOCK) WHERE maDichVu=@service;
   IF @stock IS NULL THROW 53429,N'Không tìm thấy dịch vụ',1;
   IF @active<>1 OR @price<=0 THROW 53430,N'Dịch vụ đã ngừng bán hoặc chưa niêm yết giá',1;
   IF @quantity IS NULL OR @quantity<=0 THROW 51008,N'Số lượng phải lớn hơn 0',1;
   IF @stock<@quantity THROW 51006,N'Tồn kho không đủ',1;
   DECLARE @used DATE=CAST(COALESCE(@at,@now) AS DATE);
   IF EXISTS(SELECT 1 FROM dbo.SuDungDichVu WITH(UPDLOCK,HOLDLOCK) WHERE maPhieuDatPhong=@id AND maDichVu=@service AND ngaySuDung=@used)
    UPDATE dbo.SuDungDichVu SET soLuong=soLuong+@quantity WHERE maPhieuDatPhong=@id AND maDichVu=@service AND ngaySuDung=@used;
   ELSE INSERT dbo.SuDungDichVu(maPhieuDatPhong,maDichVu,ngaySuDung,soLuong,donGia) VALUES(@id,@service,@used,@quantity,@price);
   UPDATE dbo.DichVu SET soLuongTonKho=soLuongTonKho-@quantity WHERE maDichVu=@service;
   INSERT dbo.BienDongKhoDichVu(maDichVu,loai,soLuong,maNguoiThucHien,thoiDiemPhatSinh,lyDo)
    VALUES(@service,N'Xuất kho',@quantity,@actor,@now,N'RESERVATION_SERVICE:'+CONVERT(NVARCHAR(20),@id));
  END
  ELSE THROW 51008,N'Lệnh đặt phòng không hợp lệ',1;
  INSERT dbo.NhatKyKiemSoat(nguoiThucHien,hanhDong,loaiDoiTuong,maDoiTuong,duLieuSau,lyDo)
   VALUES(@actor,CASE @command WHEN N'confirm' THEN N'RESERVATION_CONFIRMED' WHEN N'check-in' THEN N'RESERVATION_CHECKED_IN'
    WHEN N'extend' THEN N'RESERVATION_EXTENDED' WHEN N'update' THEN N'RESERVATION_UPDATED' WHEN N'cancel' THEN CASE WHEN @state=N'Không đến' THEN N'RESERVATION_NO_SHOW' ELSE N'RESERVATION_CANCELLED' END
    WHEN N'no-show' THEN N'RESERVATION_NO_SHOW' WHEN N'service' THEN N'SERVICE_ADDED'
    WHEN N'customer-extend' THEN N'CUSTOMER_RESERVATION_EXTENSION_REQUESTED' ELSE N'CUSTOMER_RESERVATION_RESCHEDULED' END,
    N'RESERVATION',CONVERT(NVARCHAR(100),@id),COALESCE(CONVERT(NVARCHAR(40),@at,126),@state),@reason);
  COMMIT TRANSACTION;
 END TRY BEGIN CATCH
  IF CURSOR_STATUS('local','roomLocks')>=-1 BEGIN IF CURSOR_STATUS('local','roomLocks')>-1 CLOSE roomLocks;DEALLOCATE roomLocks;END;
  IF @@TRANCOUNT>0 ROLLBACK TRANSACTION;THROW;
 END CATCH;
END;
GO


-- =============================================================================
-- uspChuyenPhong
-- =============================================================================
CREATE PROCEDURE dbo.uspChuyenPhong
    @maPhieuDatPhong BIGINT,
    @maPhongCu NVARCHAR(10),
    @maPhongMoi NVARCHAR(10),
    @thoiDiemChuyen DATETIME2(6),
    @lyDo NVARCHAR(255),
    @nguoiThucHien NVARCHAR(50),
    @thoiDiemHienTai DATETIME2(6)
AS
BEGIN
    SET NOCOUNT ON; SET XACT_ABORT ON;
    BEGIN TRY
        BEGIN TRANSACTION;
        IF @maPhongCu=@maPhongMoi THROW 51008,N'Phòng đích phải khác phòng nguồn',1;
        IF NOT EXISTS(SELECT 1 FROM dbo.PhieuDatPhong WITH(UPDLOCK,HOLDLOCK) WHERE maPhieuDatPhong=@maPhieuDatPhong AND trangThai=N'Đã nhận phòng')
            THROW 51002,N'Chỉ chuyển phòng cho booking đã nhận phòng',1;
        DECLARE @maPhongKhoa NVARCHAR(10);
        DECLARE khoaHaiPhong CURSOR LOCAL FAST_FORWARD FOR SELECT maPhong FROM (VALUES(@maPhongCu),(@maPhongMoi)) p(maPhong) ORDER BY maPhong;
        OPEN khoaHaiPhong; FETCH NEXT FROM khoaHaiPhong INTO @maPhongKhoa;
        WHILE @@FETCH_STATUS=0 BEGIN
            IF NOT EXISTS(SELECT 1 FROM dbo.Phong WITH(UPDLOCK,HOLDLOCK) WHERE maPhong=@maPhongKhoa)
            BEGIN CLOSE khoaHaiPhong; DEALLOCATE khoaHaiPhong; THROW 51001,N'Không tìm thấy phòng',1; END;
            FETCH NEXT FROM khoaHaiPhong INTO @maPhongKhoa;
        END;
        CLOSE khoaHaiPhong; DEALLOCATE khoaHaiPhong;
        DECLARE @nhan DATETIME2(6),@tra DATETIME2(6),@traGoc DATETIME2(6),@soKhach INT,@soLan INT;
        SELECT @nhan=thoiDiemNhanPhong,@tra=thoiDiemTraPhong,@traGoc=thoiDiemTraPhongBanDau,@soKhach=soLuongKhach,@soLan=soLanChuyenPhong
        FROM dbo.ChiTietDatPhong WITH(UPDLOCK,HOLDLOCK)
        WHERE maPhieuDatPhong=@maPhieuDatPhong AND maPhong=@maPhongCu AND trangThai=N'Đang có khách';
        IF @tra IS NULL THROW 51001,N'Phòng nguồn không thuộc booking đang ở',1;
        IF @thoiDiemChuyen<=@nhan OR @thoiDiemChuyen>=@tra THROW 51008,N'Thời điểm chuyển phòng không hợp lệ',1;
        IF NOT EXISTS(SELECT 1 FROM dbo.Phong WHERE maPhong=@maPhongMoi AND trangThai=N'Sẵn sàng') THROW 51002,N'Phòng đích không sẵn sàng',1;
        IF dbo.fnKiemTraPhongTrong(@maPhongMoi,@thoiDiemChuyen,@tra,@thoiDiemHienTai,@maPhieuDatPhong)=0 THROW 51004,N'Phòng đích có lịch giao nhau',1;
        UPDATE dbo.ChiTietDatPhong SET thoiDiemTraPhong=@thoiDiemChuyen,thoiDiemTraPhongBanDau=@thoiDiemChuyen,trangThai=N'Đã hủy',soLanChuyenPhong=@soLan+1
        WHERE maPhieuDatPhong=@maPhieuDatPhong AND maPhong=@maPhongCu;
        INSERT INTO dbo.ChiTietDatPhong(maPhieuDatPhong,maPhong,thoiDiemNhanPhong,thoiDiemTraPhong,thoiDiemTraPhongBanDau,trangThai,soLanChuyenPhong,soLuongKhach)
        VALUES(@maPhieuDatPhong,@maPhongMoi,@thoiDiemChuyen,@tra,CASE WHEN @traGoc>@thoiDiemChuyen THEN @traGoc ELSE @thoiDiemChuyen END,N'Đang có khách',0,@soKhach);
        UPDATE dbo.Phong SET trangThai=N'Đang dọn phòng',phienBan=phienBan+1 WHERE maPhong=@maPhongCu;
        UPDATE dbo.Phong SET trangThai=N'Đang có khách',phienBan=phienBan+1 WHERE maPhong=@maPhongMoi;
        INSERT INTO dbo.ChuyenPhong(maPhieuDatPhong,maPhongCu,maPhongMoi,thoiDiemChuyenPhong,lyDo) VALUES(@maPhieuDatPhong,@maPhongCu,@maPhongMoi,@thoiDiemChuyen,@lyDo);
        INSERT INTO dbo.NhatKyKiemSoat(nguoiThucHien,hanhDong,loaiDoiTuong,maDoiTuong,duLieuTruoc,duLieuSau,lyDo)
        VALUES(@nguoiThucHien,N'ROOM_TRANSFERRED',N'RESERVATION',CONVERT(NVARCHAR(100),@maPhieuDatPhong),@maPhongCu,@maPhongMoi,@lyDo);
        COMMIT TRANSACTION;
    END TRY BEGIN CATCH
        IF CURSOR_STATUS('local','khoaHaiPhong')>=-1 BEGIN IF CURSOR_STATUS('local','khoaHaiPhong')>-1 CLOSE khoaHaiPhong; DEALLOCATE khoaHaiPhong; END;
        IF @@TRANCOUNT>0 ROLLBACK TRANSACTION; THROW;
    END CATCH;
END;
GO

-- =============================================================================
-- uspXacNhanSuDungDichVu
-- =============================================================================
CREATE PROCEDURE dbo.uspXacNhanSuDungDichVu
    @maDatDichVuKhachSan BIGINT,@nguoiThucHien NVARCHAR(50),@thoiDiemHienTai DATETIME2(6),
    @maPhieuDuKien BIGINT=NULL
AS
BEGIN
    SET NOCOUNT ON; SET XACT_ABORT ON;
    BEGIN TRY
        BEGIN TRANSACTION;
        DECLARE @maPhieu BIGINT,@maDichVu NVARCHAR(10),@soLuong INT,@trangThai NVARCHAR(20),@duKien DATETIME2(6),@trangThaiPhong NVARCHAR(30);
        SELECT @maPhieu=maPhieuDatPhong FROM dbo.DatDichVuKhachSan WHERE maDatDichVuKhachSan=@maDatDichVuKhachSan;
        IF @maPhieu IS NULL OR (@maPhieuDuKien IS NOT NULL AND @maPhieu<>@maPhieuDuKien)
            THROW 51101,N'Không tìm thấy dịch vụ trong booking',1;
        SELECT @trangThaiPhong=trangThai FROM dbo.PhieuDatPhong WITH(UPDLOCK,HOLDLOCK) WHERE maPhieuDatPhong=@maPhieu;
        IF @trangThaiPhong<>N'Đã nhận phòng' THROW 51002,N'Khách phải nhận phòng trước khi dùng dịch vụ',1;
        SELECT @maDichVu=maDichVu,@soLuong=soLuong,@trangThai=trangThai,@duKien=thoiDiemDuKien
        FROM dbo.DatDichVuKhachSan WITH(UPDLOCK,HOLDLOCK) WHERE maDatDichVuKhachSan=@maDatDichVuKhachSan;
        IF @trangThai=N'Đã sử dụng' BEGIN COMMIT; RETURN; END;
        IF @trangThai<>N'Đã xác nhận' THROW 51002,N'Dịch vụ đã bị hủy',1;
        IF @duKien>@thoiDiemHienTai THROW 51102,N'Chưa đến thời gian sử dụng dịch vụ',1;
        UPDATE dbo.DichVu WITH(UPDLOCK,HOLDLOCK) SET soLuongTonKho=soLuongTonKho-@soLuong
        WHERE maDichVu=@maDichVu AND dangHoatDong=1 AND soLuongTonKho>=@soLuong;
        IF @@ROWCOUNT<>1 THROW 51006,N'Dịch vụ đã hết khả dụng',1;
        UPDATE dbo.DatDichVuKhachSan SET trangThai=N'Đã sử dụng',thoiDiemSuDung=@thoiDiemHienTai,nguoiXacNhanSuDung=@nguoiThucHien
        WHERE maDatDichVuKhachSan=@maDatDichVuKhachSan;
        INSERT dbo.BienDongKhoDichVu(maDichVu,loai,soLuong,maNguoiThucHien,thoiDiemPhatSinh,lyDo)
        VALUES(@maDichVu,N'Xuất kho',@soLuong,@nguoiThucHien,@thoiDiemHienTai,N'HOTEL_SERVICE_BOOKING:'+CONVERT(NVARCHAR(30),@maDatDichVuKhachSan));
        INSERT dbo.NhatKyKiemSoat(nguoiThucHien,hanhDong,loaiDoiTuong,maDoiTuong,duLieuSau)
        VALUES(@nguoiThucHien,N'HOTEL_SERVICE_USED',N'RESERVATION',CONVERT(NVARCHAR(100),@maPhieu),CONVERT(NVARCHAR(100),@maDatDichVuKhachSan));
        COMMIT;
    END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK; THROW; END CATCH;
END;
GO

-- =============================================================================
-- uspHuyDatDichVu
-- =============================================================================
CREATE PROCEDURE dbo.uspHuyDatDichVu
    @maDatDichVuKhachSan BIGINT,@nguoiThucHien NVARCHAR(50),@maTaiKhoan BIGINT=NULL
AS
BEGIN
    SET NOCOUNT ON; SET XACT_ABORT ON;
    BEGIN TRY BEGIN TRANSACTION;
        DECLARE @maPhieu BIGINT,@owner BIGINT,@state NVARCHAR(20);
        SELECT @maPhieu=maPhieuDatPhong FROM dbo.DatDichVuKhachSan WHERE maDatDichVuKhachSan=@maDatDichVuKhachSan;
        SELECT @owner=maTaiKhoanKhachHang FROM dbo.PhieuDatPhong WITH(UPDLOCK,HOLDLOCK) WHERE maPhieuDatPhong=@maPhieu;
        IF @maPhieu IS NULL OR (@maTaiKhoan IS NOT NULL AND (@owner IS NULL OR @owner<>@maTaiKhoan)) THROW 51101,N'Không tìm thấy dịch vụ',1;
        SELECT @state=trangThai FROM dbo.DatDichVuKhachSan WITH(UPDLOCK,HOLDLOCK) WHERE maDatDichVuKhachSan=@maDatDichVuKhachSan;
        IF @state=N'Đã sử dụng' THROW 51002,N'Dịch vụ đã sử dụng không thể hủy',1;
        IF @state=N'Đã xác nhận'
        BEGIN
            UPDATE dbo.DatDichVuKhachSan SET trangThai=N'Đã hủy' WHERE maDatDichVuKhachSan=@maDatDichVuKhachSan;
            INSERT dbo.NhatKyKiemSoat(nguoiThucHien,hanhDong,loaiDoiTuong,maDoiTuong,duLieuSau)
            VALUES(@nguoiThucHien,N'HOTEL_SERVICE_CANCELLED',N'RESERVATION',CONVERT(NVARCHAR(100),@maPhieu),CONVERT(NVARCHAR(100),@maDatDichVuKhachSan));
        END;
        COMMIT;
    END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK; THROW; END CATCH;
END;
GO

-- =============================================================================
-- uspDieuChinhTonKho
-- =============================================================================
CREATE PROCEDURE dbo.uspDieuChinhTonKho
 @maMatHang NVARCHAR(30),@loaiBienDong NVARCHAR(20),@soLuong INT,@nguoiThucHien NVARCHAR(50),@lyDo NVARCHAR(255),@thoiDiem DATETIME2(6)
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 BEGIN TRY BEGIN TRANSACTION;
  IF @soLuong<=0 THROW 51008,N'Số lượng phải lớn hơn 0',1;
  DECLARE @hienTai INT,@tiep INT;
  SELECT @hienTai=soLuongHienTai FROM dbo.MatHangTonKho WITH(UPDLOCK,HOLDLOCK) WHERE maMatHang=@maMatHang AND dangHoatDong=1;
  IF @hienTai IS NULL THROW 51205,N'Không tìm thấy mặt hàng tồn kho',1;
  SET @tiep=CASE WHEN @loaiBienDong IN(N'Nhập kho',N'Hoàn kho') THEN @hienTai+@soLuong WHEN @loaiBienDong IN(N'Xuất kho',N'Hao hụt') THEN @hienTai-@soLuong WHEN @loaiBienDong=N'Điều chỉnh' THEN @soLuong END;
  IF @tiep IS NULL THROW 51209,N'Loại biến động tồn kho không hợp lệ',1;
  IF @tiep<0 THROW 51006,N'Tồn kho đồ vải không đủ',1;
  UPDATE dbo.MatHangTonKho SET soLuongHienTai=@tiep WHERE maMatHang=@maMatHang;
  INSERT dbo.BienDongTonKho(maMatHang,loaiBienDong,soLuong,maNguoiThucHien,thoiDiemPhatSinh,lyDo) VALUES(@maMatHang,@loaiBienDong,@soLuong,@nguoiThucHien,@thoiDiem,@lyDo);
  COMMIT TRANSACTION;
 END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK TRANSACTION; THROW; END CATCH;
END;
GO

-- =============================================================================
-- uspPhanCongCa
-- =============================================================================
CREATE PROCEDURE dbo.uspPhanCongCa
 @maNhanVien NVARCHAR(10),@ngayLamCa DATE,@maCa NVARCHAR(30),@thoiDiemBatDau DATETIME2(6),@thoiDiemKetThuc DATETIME2(6),@nguoiThucHien NVARCHAR(50)
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 BEGIN TRY BEGIN TRANSACTION;
  IF @thoiDiemBatDau>=@thoiDiemKetThuc OR CAST(@thoiDiemBatDau AS DATE)<>@ngayLamCa THROW 51008,N'Khoảng ca không hợp lệ',1;
  -- Assignment is allowed for historical HR records; coverage excludes unavailable staff.
  IF NOT EXISTS(SELECT 1 FROM dbo.NhanVien WITH(UPDLOCK,HOLDLOCK) WHERE maNhanVien=@maNhanVien) THROW 51301,N'Không tìm thấy nhân viên',1;
  IF dbo.fnKiemTraTrungCaLamViec(@maNhanVien,@thoiDiemBatDau,@thoiDiemKetThuc,NULL)=1 THROW 51004,N'Nhân viên đã có ca trùng thời gian',1;
  INSERT dbo.CaLamViecNhanVien(maNhanVien,ngayLamCa,maCa,thoiDiemBatDau,thoiDiemKetThuc,trangThai,nguoiTao)
  VALUES(@maNhanVien,@ngayLamCa,@maCa,@thoiDiemBatDau,@thoiDiemKetThuc,N'Đã phân công',@nguoiThucHien);
  DECLARE @ma BIGINT=SCOPE_IDENTITY();
  INSERT dbo.NhatKyKiemSoat(nguoiThucHien,hanhDong,loaiDoiTuong,maDoiTuong,duLieuSau)
  VALUES(@nguoiThucHien,N'EMPLOYEE_SHIFT_ASSIGNED',N'EMPLOYEE_SHIFT',CONVERT(NVARCHAR(100),@ma),@maNhanVien);
  COMMIT TRANSACTION; SELECT @ma AS maCaLamViecNhanVien;
 END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK TRANSACTION; THROW; END CATCH;
END;
GO

-- =============================================================================
-- uspDatDichVuKhachSan
-- =============================================================================
CREATE PROCEDURE dbo.uspDatDichVuKhachSan
    @maPhieu BIGINT,@maPhong NVARCHAR(10),@maDichVu NVARCHAR(10),@duKien DATETIME2(6),
    @soLuong INT,@buoiAn NVARCHAR(10),@ghiChu NVARCHAR(500),@khoa NVARCHAR(100),@bam NCHAR(64),
    @actor NVARCHAR(50),@maTaiKhoan BIGINT,@taiQuay BIT,@hienTai DATETIME2(6)
AS
BEGIN
    SET NOCOUNT ON; SET XACT_ABORT ON;
    BEGIN TRY
        BEGIN TRANSACTION;
        IF @soLuong IS NULL OR @soLuong<1 OR @duKien IS NULL THROW 51103,N'Thiếu thông tin đặt dịch vụ',1;
        IF @maDichVu=N'MAMREST' AND (@buoiAn IS NULL OR @buoiAn NOT IN(N'Bữa trưa',N'Bữa tối')) THROW 51104,N'Chọn bữa trưa hoặc bữa tối',1;
        IF @maDichVu<>N'MAMREST' AND @buoiAn IS NOT NULL THROW 51105,N'Dịch vụ này không dùng loại bữa ăn',1;
        IF @maDichVu=N'POOL' AND @taiQuay=0 THROW 51106,N'Hồ bơi chỉ cần xem thông tin, không đặt trước',1;
        -- Same key serializes independently of booking and does not range-lock other bookings.
        DECLARE @lockResult INT;
        DECLARE @resource NVARCHAR(255)=N'hotel-service:'+@khoa;
        EXEC @lockResult=sys.sp_getapplock @Resource=@resource,@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=10000;
        IF @lockResult<0 THROW 51005,N'Không thể khóa mã yêu cầu',1;
        DECLARE @id BIGINT,@bound NCHAR(64),@creator NVARCHAR(80);
        SELECT @id=maDatDichVuKhachSan,@bound=maBamYeuCau,@creator=nguoiTao FROM dbo.DatDichVuKhachSan WHERE khoaYeuCau=@khoa;
        IF @id IS NOT NULL
        BEGIN
            IF @bound<>@bam OR @creator<>@actor THROW 51005,N'Mã yêu cầu đã dùng cho thao tác khác',1;
            IF @taiQuay=1 EXEC dbo.uspXacNhanSuDungDichVu @id,@actor,@hienTai,@maPhieu;
            COMMIT; SELECT @id AS maDatDichVuKhachSan; RETURN;
        END;
        DECLARE @state NVARCHAR(30),@rental NVARCHAR(20),@deposit NVARCHAR(20),@owner BIGINT,@from DATETIME2(6),@to DATETIME2(6),@guests INT;
        SELECT @state=trangThai,@rental=hinhThucThue,@deposit=trangThaiThanhToanCoc,@owner=maTaiKhoanKhachHang
        FROM dbo.PhieuDatPhong WITH(UPDLOCK,HOLDLOCK) WHERE maPhieuDatPhong=@maPhieu;
        SELECT @from=thoiDiemNhanPhong,@to=thoiDiemTraPhong,@guests=soLuongKhach
        FROM dbo.ChiTietDatPhong WITH(UPDLOCK,HOLDLOCK) WHERE maPhieuDatPhong=@maPhieu AND maPhong=@maPhong;
        IF @state IS NULL OR @from IS NULL OR (@maTaiKhoan IS NOT NULL AND (@owner IS NULL OR @owner<>@maTaiKhoan))
            THROW 51001,N'Không tìm thấy phòng trong booking của khách',1;
        IF @state NOT IN(N'Đã thanh toán cọc',N'Đã xác nhận',N'Đã nhận phòng') THROW 51002,N'Booking chưa xác nhận tiền cọc',1;
        IF @maTaiKhoan IS NOT NULL AND @deposit<>N'Đã thanh toán' THROW 51107,N'Cần xác nhận tiền cọc trước khi đặt dịch vụ',1;
        IF @taiQuay=1 AND @state<>N'Đã nhận phòng' THROW 51002,N'Khách chưa nhận phòng',1;
        IF @duKien<@from OR @duKien>=@to THROW 51108,N'Thời gian dịch vụ phải nằm trong kỳ lưu trú',1;
        DECLARE @gia DECIMAL(12,2),@stock INT;
        SELECT @gia=gia,@stock=soLuongTonKho FROM dbo.DichVu WITH(UPDLOCK,HOLDLOCK) WHERE maDichVu=@maDichVu AND dangHoatDong=1;
        IF @gia IS NULL THROW 51109,N'Dịch vụ không còn phục vụ',1;
        IF @gia<=0 THROW 51110,N'Dịch vụ chưa có giá niêm yết',1;
        IF @stock<@soLuong THROW 51006,N'Dịch vụ đã hết khả dụng',1;
        DECLARE @allowance INT=CASE WHEN @rental=N'Theo gói' THEN CASE WHEN @maDichVu IN(N'BREAKFAST',N'MAMREST',N'POOL') THEN @guests WHEN @maDichVu=N'LNDRYSTD' THEN 1 ELSE 0 END ELSE 0 END;
        DECLARE @allocated INT=0,@historical INT=0,@free INT=0;
        IF @allowance>0
        BEGIN
            IF @maDichVu<>N'POOL'
            BEGIN
                SELECT @allocated=COALESCE(SUM(soLuongMienPhi),0) FROM dbo.DatDichVuKhachSan
                WHERE maPhieuDatPhong=@maPhieu AND maPhong=@maPhong AND maDichVu=@maDichVu AND CAST(thoiDiemDuKien AS DATE)=CAST(@duKien AS DATE)
                  AND (buoiAn=@buoiAn OR (buoiAn IS NULL AND @buoiAn IS NULL)) AND trangThai IN(N'Đã xác nhận',N'Đã sử dụng');
                IF @maDichVu IN(N'BREAKFAST',N'LNDRYSTD')
                    SELECT @historical=COALESCE(SUM(soLuong),0) FROM dbo.SuDungDichVu WHERE maPhieuDatPhong=@maPhieu AND maDichVu=@maDichVu AND ngaySuDung=CAST(@duKien AS DATE) AND donGia=0;
            END;
            SET @free=@allowance-@allocated-@historical;
            IF @free<0 SET @free=0;
            IF @free>@soLuong SET @free=@soLuong;
        END;
        INSERT dbo.DatDichVuKhachSan(maPhieuDatPhong,maPhong,maDichVu,thoiDiemDuKien,buoiAn,soLuong,soLuongMienPhi,donGia,trangThai,ghiChu,khoaYeuCau,maBamYeuCau,nguoiTao)
        VALUES(@maPhieu,@maPhong,@maDichVu,@duKien,@buoiAn,@soLuong,@free,@gia,N'Đã xác nhận',@ghiChu,@khoa,@bam,@actor);
        SET @id=CONVERT(BIGINT,SCOPE_IDENTITY());
        INSERT dbo.NhatKyKiemSoat(nguoiThucHien,hanhDong,loaiDoiTuong,maDoiTuong,duLieuSau)
        VALUES(@actor,N'HOTEL_SERVICE_BOOKED',N'RESERVATION',CONVERT(NVARCHAR(100),@maPhieu),CONVERT(NVARCHAR(100),@id));
        IF @taiQuay=1 EXEC dbo.uspXacNhanSuDungDichVu @id,@actor,@hienTai,@maPhieu;
        COMMIT; SELECT @id AS maDatDichVuKhachSan;
    END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK; THROW; END CATCH;
END;
GO

-- =============================================================================
-- uspHuyDichVuTheoDatPhong
-- =============================================================================
CREATE PROCEDURE dbo.uspHuyDichVuTheoDatPhong @maPhieu BIGINT,@actor NVARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON; SET XACT_ABORT ON;
    BEGIN TRY BEGIN TRANSACTION;
        DECLARE @id BIGINT,@count INT;
        SELECT @id=maPhieuDatPhong FROM dbo.PhieuDatPhong WITH(UPDLOCK,HOLDLOCK) WHERE maPhieuDatPhong=@maPhieu;
        UPDATE dbo.DatDichVuKhachSan SET trangThai=N'Đã hủy' WHERE maPhieuDatPhong=@maPhieu AND trangThai=N'Đã xác nhận';
        SET @count=@@ROWCOUNT;
        IF @count>0 INSERT dbo.NhatKyKiemSoat(nguoiThucHien,hanhDong,loaiDoiTuong,maDoiTuong,duLieuSau)
        VALUES(@actor,N'HOTEL_SERVICES_CANCELLED',N'RESERVATION',CONVERT(NVARCHAR(100),@maPhieu),CONVERT(NVARCHAR(100),@count));
        COMMIT;
    END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK; THROW; END CATCH;
END;
GO

-- =============================================================================
-- uspCapNhatDoiSoatOta
-- =============================================================================
CREATE PROCEDURE dbo.uspCapNhatDoiSoatOta @maPhieu BIGINT,@trangThai NVARCHAR(30) AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 BEGIN TRY BEGIN TRANSACTION;
  UPDATE dbo.PhieuDatPhong SET trangThaiDoiSoatOta=@trangThai WHERE maPhieuDatPhong=@maPhieu AND nguonDatPhong<>N'Trực tiếp';
  IF @@ROWCOUNT=0 THROW 51201,N'Không tìm thấy booking OTA',1;
  COMMIT TRANSACTION;
 END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK TRANSACTION; THROW; END CATCH;
END;
GO

-- =============================================================================
-- uspPhatHanhHoaDonVat
-- =============================================================================
CREATE PROCEDURE dbo.uspPhatHanhHoaDonVat
 @maHoaDon BIGINT,@soHoaDon NVARCHAR(40),@thueSuat DECIMAL(5,2),@soTienChiuThue DECIMAL(14,2),
 @loaiKhachHang NVARCHAR(20),@tenKhachHang NVARCHAR(200),@maSoThue NVARCHAR(30),@tenCongTy NVARCHAR(200),@diaChi NVARCHAR(500),@nguoiTao NVARCHAR(50)
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 BEGIN TRY BEGIN TRANSACTION;
  DECLARE @tong DECIMAL(14,2);
  SELECT @tong=soTienPhaiTra FROM dbo.HoaDon WITH(UPDLOCK,HOLDLOCK) WHERE maHoaDon=@maHoaDon;
  IF @tong IS NULL THROW 51207,N'Không tìm thấy hóa đơn thanh toán',1;
  IF EXISTS(SELECT 1 FROM dbo.HoaDonGiaTriGiaTang WHERE maHoaDon=@maHoaDon) THROW 51202,N'Hóa đơn VAT cho folio này đã tồn tại',1;
  INSERT dbo.HoaDonGiaTriGiaTang(maHoaDon,soHoaDonGiaTriGiaTang,thueSuat,soTienChiuThue,loaiKhachHang,tenKhachHang,maSoThue,tenCongTy,diaChiCongTy,trangThai,trangThaiXml,nguoiTao)
  VALUES(@maHoaDon,@soHoaDon,@thueSuat,COALESCE(@soTienChiuThue,@tong),@loaiKhachHang,@tenKhachHang,@maSoThue,@tenCongTy,@diaChi,N'Đã phát hành',N'Chưa xuất',@nguoiTao);
  DECLARE @ma BIGINT=SCOPE_IDENTITY();
  COMMIT TRANSACTION; SELECT @ma AS maHoaDonGiaTriGiaTang;
 END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK TRANSACTION; THROW; END CATCH;
END;
GO

-- =============================================================================
-- uspLuuXmlHoaDonVat
-- =============================================================================
CREATE PROCEDURE dbo.uspLuuXmlHoaDonVat @ma BIGINT,@xml NVARCHAR(MAX) AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 BEGIN TRY BEGIN TRANSACTION;
  UPDATE dbo.HoaDonGiaTriGiaTang SET trangThaiXml=N'Đã xuất',noiDungXml=@xml WHERE maHoaDonGiaTriGiaTang=@ma;
  IF @@ROWCOUNT=0 THROW 51203,N'Không tìm thấy hóa đơn VAT',1;
  COMMIT TRANSACTION;
 END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK TRANSACTION; THROW; END CATCH;
END;
GO

-- =============================================================================
-- uspNhapChamCong
-- =============================================================================
CREATE PROCEDURE dbo.uspNhapChamCong @duLieu NVARCHAR(MAX),@nguoiNhap NVARCHAR(50) AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 BEGIN TRY BEGIN TRANSACTION;
  IF ISJSON(@duLieu)<>1 THROW 51008,N'Dữ liệu chấm công không hợp lệ',1;
  DECLARE @rows TABLE(stt INT,maNhanVien NVARCHAR(10),ngay DATE,vao DATETIME2(6),ra DATETIME2(6),trangThai NVARCHAR(20),nguon NVARCHAR(30),suKien NVARCHAR(100),ghiChu NVARCHAR(500));
  INSERT @rows SELECT CONVERT(INT,j.[key]),r.* FROM OPENJSON(@duLieu) j CROSS APPLY OPENJSON(j.value)
   WITH(maNhanVien NVARCHAR(10),ngay DATE,vao DATETIME2(6),ra DATETIME2(6),trangThai NVARCHAR(20),nguon NVARCHAR(30),suKien NVARCHAR(100),ghiChu NVARCHAR(500)) r;
  DECLARE @nv NVARCHAR(10),@ngay DATE,@vao DATETIME2(6),@ra DATETIME2(6),@tt NVARCHAR(20),@nguon NVARCHAR(30),@event NVARCHAR(100),@note NVARCHAR(500);
  DECLARE rowsCursor CURSOR LOCAL FAST_FORWARD FOR SELECT maNhanVien,ngay,vao,ra,trangThai,nguon,suKien,ghiChu FROM @rows ORDER BY maNhanVien,ngay,stt;
  OPEN rowsCursor; FETCH NEXT FROM rowsCursor INTO @nv,@ngay,@vao,@ra,@tt,@nguon,@event,@note;
  WHILE @@FETCH_STATUS=0 BEGIN
   UPDATE dbo.ChamCong WITH(UPDLOCK,HOLDLOCK) SET thoiDiemVaoCa=@vao,thoiDiemRaCa=@ra,trangThai=@tt,nguonDuLieu=@nguon,maSuKienThietBi=@event,ghiChu=@note,nguoiNhap=@nguoiNhap,thoiDiemNhap=CURRENT_TIMESTAMP WHERE maNhanVien=@nv AND ngayLamViec=@ngay;
   IF @@ROWCOUNT=0 INSERT dbo.ChamCong(maNhanVien,ngayLamViec,thoiDiemVaoCa,thoiDiemRaCa,trangThai,nguonDuLieu,maSuKienThietBi,ghiChu,nguoiNhap) VALUES(@nv,@ngay,@vao,@ra,@tt,@nguon,@event,@note,@nguoiNhap);
   FETCH NEXT FROM rowsCursor INTO @nv,@ngay,@vao,@ra,@tt,@nguon,@event,@note;
  END;
  CLOSE rowsCursor; DEALLOCATE rowsCursor;
  COMMIT TRANSACTION;
 END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK TRANSACTION; THROW; END CATCH;
END;
GO

-- =============================================================================
-- uspTaoDonNghiPhep
-- =============================================================================
CREATE PROCEDURE dbo.uspTaoDonNghiPhep @nv NVARCHAR(10),@loai NVARCHAR(30),@tu DATE,@den DATE,@lyDo NVARCHAR(500),@doiCa NVARCHAR(10),@actor NVARCHAR(50) AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 BEGIN TRY BEGIN TRANSACTION;
  IF @den<@tu THROW 51208,N'Khoảng nghỉ không hợp lệ',1;
  INSERT dbo.DonNghiPhep(maNhanVien,loaiNghiPhep,ngayBatDau,ngayKetThuc,lyDo,maNhanVienDoiCa,nguoiYeuCau) VALUES(@nv,@loai,@tu,@den,@lyDo,@doiCa,@actor);
  DECLARE @ma BIGINT=SCOPE_IDENTITY(); COMMIT TRANSACTION; SELECT @ma AS maDonNghiPhep;
 END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK TRANSACTION; THROW; END CATCH;
END;
GO

-- =============================================================================
-- uspQuyetDinhNghiPhep
-- =============================================================================
CREATE PROCEDURE dbo.uspQuyetDinhNghiPhep @ma BIGINT,@chapNhan BIT,@actor NVARCHAR(50) AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 BEGIN TRY BEGIN TRANSACTION;
  UPDATE dbo.DonNghiPhep SET trangThai=CASE WHEN @chapNhan=1 THEN N'Đã phê duyệt' ELSE N'Bị từ chối' END,nguoiPheDuyet=@actor,thoiDiemQuyetDinh=CURRENT_TIMESTAMP WHERE maDonNghiPhep=@ma AND trangThai=N'Chờ phê duyệt';
  IF @@ROWCOUNT=0 THROW 51204,N'Đơn nghỉ không còn chờ duyệt',1;
  COMMIT TRANSACTION;
 END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK TRANSACTION; THROW; END CATCH;
END;
GO

-- =============================================================================
-- uspTaoTaiSanKyThuat
-- =============================================================================
CREATE PROCEDURE dbo.uspTaoTaiSanKyThuat
 @ma NVARCHAR(30),@ten NVARCHAR(150),@danhMuc NVARCHAR(50),@loaiViTri NVARCHAR(20),@phong NVARCHAR(10),@tang INT,@viTri NVARCHAR(150),@thuongHieu NVARCHAR(150),@lapDat DATE,@baoTri DATE,@trangThai NVARCHAR(30),@giaTri DECIMAL(14,2),@ghiChu NVARCHAR(500)
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 BEGIN TRY BEGIN TRANSACTION;
  INSERT dbo.TaiSanKyThuat(maTaiSanKyThuat,ten,danhMuc,loaiViTri,maPhong,tang,viTri,thuongHieuMau,ngayLapDat,ngayBaoTriTiepTheo,trangThai,giaTriBanDau,ghiChu) VALUES(@ma,@ten,@danhMuc,@loaiViTri,@phong,@tang,@viTri,@thuongHieu,@lapDat,@baoTri,@trangThai,@giaTri,@ghiChu);
  COMMIT TRANSACTION;
 END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK TRANSACTION; THROW; END CATCH;
END;
GO

-- =============================================================================
-- uspCapNhatTaiSanKyThuat
-- =============================================================================
CREATE PROCEDURE dbo.uspCapNhatTaiSanKyThuat @ma NVARCHAR(30),@trangThai NVARCHAR(30) AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 BEGIN TRY BEGIN TRANSACTION;
  UPDATE dbo.TaiSanKyThuat SET trangThai=@trangThai WHERE maTaiSanKyThuat=@ma;
  IF @@ROWCOUNT=0 THROW 51206,N'Không tìm thấy tài sản kỹ thuật',1;
  COMMIT TRANSACTION;
 END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK TRANSACTION; THROW; END CATCH;
END;
GO

-- =============================================================================
-- uspSuaCaLamViec
-- =============================================================================
CREATE PROCEDURE dbo.uspSuaCaLamViec @ma BIGINT,@ngay DATE,@ca NVARCHAR(30),@tu DATETIME2(6),@den DATETIME2(6),@actor NVARCHAR(50) AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 BEGIN TRY BEGIN TRANSACTION;
  DECLARE @nv NVARCHAR(10),@locked NVARCHAR(10),@trangThai NVARCHAR(20),@cu NVARCHAR(30);
  SELECT @nv=maNhanVien FROM dbo.CaLamViecNhanVien WHERE maCaLamViecNhanVien=@ma;
  IF @nv IS NULL THROW 51302,N'Không tìm thấy ca làm việc',1;
  SELECT @locked=maNhanVien FROM dbo.NhanVien WITH(UPDLOCK,HOLDLOCK) WHERE maNhanVien=@nv;
  SELECT @trangThai=trangThai,@cu=maCa FROM dbo.CaLamViecNhanVien WITH(UPDLOCK,HOLDLOCK) WHERE maCaLamViecNhanVien=@ma;
  IF @trangThai<>N'Đã phân công' THROW 51303,N'Chỉ ca ASSIGNED mới được sửa',1;
  IF @tu>=@den OR CAST(@tu AS DATE)<>@ngay THROW 51008,N'Khoảng ca hoặc shift_date không hợp lệ',1;
  IF dbo.fnKiemTraTrungCaLamViec(@nv,@tu,@den,@ma)=1 THROW 51004,N'Nhân viên đã có ca trùng thời gian',1;
  UPDATE dbo.CaLamViecNhanVien SET ngayLamCa=@ngay,maCa=@ca,thoiDiemBatDau=@tu,thoiDiemKetThuc=@den WHERE maCaLamViecNhanVien=@ma;
  DECLARE @before NVARCHAR(30)=CASE @cu WHEN N'Ca sáng' THEN N'MORNING' WHEN N'Ca chiều' THEN N'AFTERNOON' WHEN N'Ca đêm' THEN N'NIGHT' ELSE @cu END;
  DECLARE @after NVARCHAR(30)=CASE @ca WHEN N'Ca sáng' THEN N'MORNING' WHEN N'Ca chiều' THEN N'AFTERNOON' WHEN N'Ca đêm' THEN N'NIGHT' ELSE @ca END;
  INSERT dbo.NhatKyKiemSoat(nguoiThucHien,hanhDong,loaiDoiTuong,maDoiTuong,duLieuTruoc,duLieuSau) VALUES(@actor,N'EMPLOYEE_SHIFT_UPDATED',N'EMPLOYEE_SHIFT',CONVERT(NVARCHAR(100),@ma),@before,@after);
  COMMIT TRANSACTION;
 END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK TRANSACTION; THROW; END CATCH;
END;
GO

-- =============================================================================
-- uspChuyenTrangThaiCa
-- =============================================================================
CREATE PROCEDURE dbo.uspChuyenTrangThaiCa @ma BIGINT,@moi NVARCHAR(20),@actor NVARCHAR(50) AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 BEGIN TRY BEGIN TRANSACTION;
  DECLARE @nv NVARCHAR(10),@locked NVARCHAR(10),@cu NVARCHAR(20);
  SELECT @nv=maNhanVien FROM dbo.CaLamViecNhanVien WHERE maCaLamViecNhanVien=@ma;
  IF @nv IS NULL THROW 51302,N'Không tìm thấy ca làm việc',1;
  SELECT @locked=maNhanVien FROM dbo.NhanVien WITH(UPDLOCK,HOLDLOCK) WHERE maNhanVien=@nv;
  SELECT @cu=trangThai FROM dbo.CaLamViecNhanVien WITH(UPDLOCK,HOLDLOCK) WHERE maCaLamViecNhanVien=@ma;
  IF @moi NOT IN(N'Đã phân công',N'Đã bắt đầu',N'Đã hoàn thành',N'Đã hủy') THROW 51304,N'Trạng thái ca không hợp lệ',1;
  IF NOT(@moi=@cu OR (@cu=N'Đã phân công' AND @moi IN(N'Đã bắt đầu',N'Đã hủy')) OR (@cu=N'Đã bắt đầu' AND @moi IN(N'Đã hoàn thành',N'Đã hủy'))) THROW 51305,N'Chuyển trạng thái ca không hợp lệ',1;
  UPDATE dbo.CaLamViecNhanVien SET trangThai=@moi WHERE maCaLamViecNhanVien=@ma;
  DECLARE @before NVARCHAR(20)=CASE @cu WHEN N'Đã phân công' THEN N'ASSIGNED' WHEN N'Đã bắt đầu' THEN N'STARTED' WHEN N'Đã hoàn thành' THEN N'COMPLETED' WHEN N'Đã hủy' THEN N'CANCELLED' END;
  DECLARE @after NVARCHAR(20)=CASE @moi WHEN N'Đã phân công' THEN N'ASSIGNED' WHEN N'Đã bắt đầu' THEN N'STARTED' WHEN N'Đã hoàn thành' THEN N'COMPLETED' WHEN N'Đã hủy' THEN N'CANCELLED' END;
  INSERT dbo.NhatKyKiemSoat(nguoiThucHien,hanhDong,loaiDoiTuong,maDoiTuong,duLieuTruoc,duLieuSau) VALUES(@actor,N'EMPLOYEE_SHIFT_STATUS_CHANGED',N'EMPLOYEE_SHIFT',CONVERT(NVARCHAR(100),@ma),@before,@after);
  COMMIT TRANSACTION;
 END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK TRANSACTION; THROW; END CATCH;
END;
GO

-- =============================================================================
-- uspThemAnhPhong
-- =============================================================================
CREATE PROCEDURE dbo.uspThemAnhPhong @phong NVARCHAR(10),@duongDan NVARCHAR(255),@loai NVARCHAR(40),@kichThuoc BIGINT,@actor NVARCHAR(50) AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 BEGIN TRY BEGIN TRANSACTION;
  IF NOT EXISTS(SELECT 1 FROM dbo.Phong WITH(UPDLOCK,HOLDLOCK) WHERE maPhong=@phong) THROW 51401,N'Không tìm thấy phòng',1;
  DECLARE @count INT=(SELECT COUNT(*) FROM dbo.HinhAnhPhong WHERE maPhong=@phong AND dangHoatDong=1);
  IF @count>=10 THROW 51402,N'Mỗi phòng chỉ được tối đa 10 ảnh',1;
  INSERT dbo.HinhAnhPhong(maPhong,duongDanTuongDoi,thuTuHienThi,laAnhBia,loaiNoiDung,kichThuocByte) VALUES(@phong,@duongDan,@count,CASE WHEN @count=0 THEN 1 ELSE 0 END,@loai,@kichThuoc);
  DECLARE @ma BIGINT=SCOPE_IDENTITY();
  INSERT dbo.NhatKyKiemSoat(nguoiThucHien,hanhDong,loaiDoiTuong,maDoiTuong,duLieuSau) VALUES(@actor,N'ROOM_IMAGE_UPLOADED',N'ROOM_IMAGE',CONVERT(NVARCHAR(100),@ma),@duongDan);
  COMMIT TRANSACTION; SELECT @ma AS maHinhAnhPhong;
 END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK TRANSACTION; THROW; END CATCH;
END;
GO

-- =============================================================================
-- uspXoaAnhPhong
-- =============================================================================
CREATE PROCEDURE dbo.uspXoaAnhPhong @phong NVARCHAR(10),@ma BIGINT,@actor NVARCHAR(50) AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 BEGIN TRY BEGIN TRANSACTION;
  DECLARE @locked NVARCHAR(10),@duongDan NVARCHAR(255);
  SELECT @locked=maPhong FROM dbo.Phong WITH(UPDLOCK,HOLDLOCK) WHERE maPhong=@phong;
  SELECT @duongDan=duongDanTuongDoi FROM dbo.HinhAnhPhong WITH(UPDLOCK,HOLDLOCK) WHERE maHinhAnhPhong=@ma AND maPhong=@phong;
  IF @duongDan IS NULL THROW 51403,N'Không tìm thấy ảnh của phòng',1;
  UPDATE dbo.HinhAnhPhong SET dangHoatDong=0 WHERE maHinhAnhPhong=@ma;
  INSERT dbo.NhatKyKiemSoat(nguoiThucHien,hanhDong,loaiDoiTuong,maDoiTuong,duLieuTruoc) VALUES(@actor,N'ROOM_IMAGE_DELETED',N'ROOM_IMAGE',CONVERT(NVARCHAR(100),@ma),@duongDan);
  COMMIT TRANSACTION; SELECT @duongDan AS duongDanTuongDoi;
 END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK TRANSACTION; THROW; END CATCH;
END;
GO

-- =============================================================================
-- uspTaoTienNghi
-- =============================================================================
CREATE PROCEDURE dbo.uspTaoTienNghi @ten NVARCHAR(100),@actor NVARCHAR(50) AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 BEGIN TRY BEGIN TRANSACTION;
  IF EXISTS(SELECT 1 FROM dbo.TienNghi WITH(UPDLOCK,HOLDLOCK) WHERE ten=@ten) THROW 51404,N'Tiện nghi đã tồn tại',1;
  INSERT dbo.TienNghi(ten) VALUES(@ten); DECLARE @ma BIGINT=SCOPE_IDENTITY();
  INSERT dbo.NhatKyKiemSoat(nguoiThucHien,hanhDong,loaiDoiTuong,maDoiTuong,duLieuSau) VALUES(@actor,N'AMENITY_CREATED',N'AMENITY',CONVERT(NVARCHAR(100),@ma),@ten);
  COMMIT TRANSACTION; SELECT @ma AS maTienNghi;
 END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK TRANSACTION; THROW; END CATCH;
END;
GO

-- =============================================================================
-- uspSuaTienNghi
-- =============================================================================
CREATE PROCEDURE dbo.uspSuaTienNghi @ma BIGINT,@ten NVARCHAR(100),@active BIT,@actor NVARCHAR(50) AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 BEGIN TRY BEGIN TRANSACTION;
  UPDATE dbo.TienNghi SET ten=@ten,dangHoatDong=COALESCE(@active,dangHoatDong) WHERE maTienNghi=@ma;
  IF @@ROWCOUNT=0 THROW 51405,N'Không tìm thấy tiện nghi',1;
  INSERT dbo.NhatKyKiemSoat(nguoiThucHien,hanhDong,loaiDoiTuong,maDoiTuong,duLieuSau) VALUES(@actor,N'AMENITY_UPDATED',N'AMENITY',CONVERT(NVARCHAR(100),@ma),@ten);
  COMMIT TRANSACTION;
 END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK TRANSACTION; THROW; END CATCH;
END;
GO

-- =============================================================================
-- uspGanTienNghiLoaiPhong
-- =============================================================================
CREATE PROCEDURE dbo.uspGanTienNghiLoaiPhong @loai NVARCHAR(10),@ids NVARCHAR(MAX),@auditIds NVARCHAR(MAX),@actor NVARCHAR(50) AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 BEGIN TRY BEGIN TRANSACTION;
  IF NOT EXISTS(SELECT 1 FROM dbo.LoaiPhong WITH(UPDLOCK,HOLDLOCK) WHERE maLoaiPhong=@loai) THROW 51406,N'Không tìm thấy loại phòng',1;
  IF ISJSON(@ids)<>1 THROW 51008,N'Danh sách tiện nghi không hợp lệ',1;
  DECLARE @selected TABLE(ma BIGINT PRIMARY KEY);
  INSERT @selected SELECT DISTINCT CONVERT(BIGINT,value) FROM OPENJSON(@ids);
  IF EXISTS(SELECT ma FROM @selected EXCEPT SELECT maTienNghi FROM dbo.TienNghi WITH(HOLDLOCK)) THROW 51405,N'Có tiện nghi không tồn tại',1;
  DELETE dbo.LoaiPhongTienNghi WHERE maLoaiPhong=@loai;
  INSERT dbo.LoaiPhongTienNghi(maLoaiPhong,maTienNghi) SELECT @loai,ma FROM @selected;
  INSERT dbo.NhatKyKiemSoat(nguoiThucHien,hanhDong,loaiDoiTuong,maDoiTuong,duLieuSau) VALUES(@actor,N'ROOM_TYPE_AMENITIES_REPLACED',N'ROOM_TYPE',@loai,@auditIds);
  COMMIT TRANSACTION;
 END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK TRANSACTION; THROW; END CATCH;
END;
GO

-- =============================================================================
-- uspGhiBienDongKhoDichVu
-- =============================================================================
CREATE PROCEDURE dbo.uspGhiBienDongKhoDichVu
 @dichVu NVARCHAR(10),@loai NVARCHAR(20),@soLuong INT,@actor NVARCHAR(50),@lyDo NVARCHAR(255),
 @key NVARCHAR(100),@hash NVARCHAR(64),@bucket SMALLINT,@now DATETIME2(6)
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 BEGIN TRY BEGIN TRANSACTION;
  DECLARE @stock INT,@record BIGINT,@oldActor NVARCHAR(100),@oldHash NVARCHAR(64),@json NVARCHAR(MAX),@status NVARCHAR(20),@responseType NVARCHAR(255);
  SELECT @stock=soLuongTonKho FROM dbo.DichVu WITH(UPDLOCK,HOLDLOCK) WHERE maDichVu=@dichVu;
  IF @stock IS NULL THROW 51501,N'Không tìm thấy dịch vụ',1;
  IF NOT EXISTS(SELECT 1 FROM dbo.NhomKhoaChongTrung WITH(UPDLOCK,HOLDLOCK) WHERE maNhomKhoa=@bucket) THROW 51502,N'Thiếu bucket idempotency',1;
  SELECT @record=maBanGhiChongTrung,@oldActor=nguoiThucHien,@oldHash=maBamYeuCau,@json=phanHoiJson,@status=trangThai,@responseType=loaiPhanHoi
  FROM dbo.BanGhiChongTrung WITH(UPDLOCK,HOLDLOCK) WHERE phamViLenh=N'inventory-movement' AND khoaChongTrung=@key;
  IF @record IS NOT NULL
  BEGIN
   IF @oldActor COLLATE Latin1_General_100_BIN2<>@actor COLLATE Latin1_General_100_BIN2 OR @oldHash<>@hash THROW 51005,N'Idempotency key đã được dùng cho yêu cầu khác hoặc actor khác',1;
   IF @status<>N'Đã hoàn tất' OR @json IS NULL THROW 51503,N'Yêu cầu cùng Idempotency-Key đang được xử lý',1;
   IF @responseType<>N'com.hospitality.mis.dto.operations.InventoryMovementDtos$Response' THROW 51005,N'Kiểu kết quả idempotency không khớp',1;
   COMMIT TRANSACTION; SELECT @json AS phanHoiJson; RETURN;
  END;
  IF @soLuong=0 OR (@loai<>N'Điều chỉnh' AND @soLuong<0) OR @loai NOT IN(N'Nhập kho',N'Xuất kho',N'Điều chỉnh',N'Hao hụt',N'Hoàn kho') THROW 51504,N'Số lượng hoặc loại biến động không hợp lệ',1;
  DECLARE @delta BIGINT=CASE WHEN @loai IN(N'Xuất kho',N'Hao hụt') THEN -CONVERT(BIGINT,@soLuong) ELSE CONVERT(BIGINT,@soLuong) END;
  IF CONVERT(BIGINT,@stock)+@delta<0 THROW 51006,N'Tồn kho không đủ',1;
  IF CONVERT(BIGINT,@stock)+@delta>2147483647 THROW 51504,N'Số lượng tồn vượt giới hạn',1;
  UPDATE dbo.DichVu SET soLuongTonKho=CONVERT(BIGINT,@stock)+@delta WHERE maDichVu=@dichVu;
  INSERT dbo.BienDongKhoDichVu(maDichVu,loai,soLuong,maNguoiThucHien,thoiDiemPhatSinh,lyDo) VALUES(@dichVu,@loai,@soLuong,@actor,@now,@lyDo);
  DECLARE @id BIGINT=SCOPE_IDENTITY();
  INSERT dbo.NhatKyKiemSoat(nguoiThucHien,hanhDong,loaiDoiTuong,maDoiTuong,duLieuSau,lyDo)
  VALUES(@actor,N'INVENTORY_MOVEMENT_RECORDED',N'SERVICE',@dichVu,CONVERT(NVARCHAR(100),@delta),@lyDo);
  SET @json=(SELECT @id AS id,@dichVu AS service_id,CASE @loai WHEN N'Nhập kho' THEN 'RECEIVE' WHEN N'Xuất kho' THEN 'ISSUE' WHEN N'Điều chỉnh' THEN 'ADJUST' WHEN N'Hao hụt' THEN 'WASTE' ELSE 'RETURN' END AS type,@soLuong AS quantity,@actor AS actor_id,@now AS occurred_at,@lyDo AS reason FOR JSON PATH,INCLUDE_NULL_VALUES,WITHOUT_ARRAY_WRAPPER);
  INSERT dbo.BanGhiChongTrung(phamViLenh,khoaChongTrung,nguoiThucHien,maBamYeuCau,trangThai,loaiPhanHoi,phanHoiJson,thoiDiemTao,thoiDiemHoanThanh)
  VALUES(N'inventory-movement',@key,@actor,@hash,N'Đã hoàn tất',N'com.hospitality.mis.dto.operations.InventoryMovementDtos$Response',@json,@now,@now);
  COMMIT TRANSACTION; SELECT @json AS phanHoiJson;
 END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK TRANSACTION; THROW; END CATCH;
END;
GO

-- =============================================================================
-- uspThemThietBiPhong
-- =============================================================================
CREATE PROCEDURE dbo.uspThemThietBiPhong
 @room NVARCHAR(100),@name NVARCHAR(MAX),@value DECIMAL(14,2),@purchased DATE,@quantity INT,
 @actor NVARCHAR(50),@key NVARCHAR(100),@hash NVARCHAR(64),@bucket SMALLINT,@now DATETIME2(6)
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 BEGIN TRY BEGIN TRANSACTION;
  IF NOT EXISTS(SELECT 1 FROM dbo.Phong WITH(UPDLOCK,HOLDLOCK) WHERE maPhong=@room) THROW 51601,N'Không tìm thấy phòng',1;
  IF NOT EXISTS(SELECT 1 FROM dbo.NhomKhoaChongTrung WITH(UPDLOCK,HOLDLOCK) WHERE maNhomKhoa=@bucket) THROW 51502,N'Thiếu bucket idempotency',1;
  DECLARE @id BIGINT,@oldActor NVARCHAR(100),@oldHash NVARCHAR(64),@json NVARCHAR(MAX),@status NVARCHAR(20),@responseType NVARCHAR(255);
  SELECT @id=maBanGhiChongTrung,@oldActor=nguoiThucHien,@oldHash=maBamYeuCau,@json=phanHoiJson,@status=trangThai,@responseType=loaiPhanHoi
  FROM dbo.BanGhiChongTrung WITH(UPDLOCK,HOLDLOCK) WHERE phamViLenh=N'room-equipment' AND khoaChongTrung=@key;
  IF @id IS NOT NULL
  BEGIN
   IF @oldActor COLLATE Latin1_General_100_BIN2<>@actor COLLATE Latin1_General_100_BIN2 OR @oldHash<>@hash THROW 51005,N'Idempotency key đã được dùng cho yêu cầu khác hoặc actor khác',1;
   IF @status<>N'Đã hoàn tất' OR @json IS NULL THROW 51503,N'Yêu cầu cùng Idempotency-Key đang được xử lý',1;
   IF @responseType<>N'com.hospitality.mis.dto.room.RoomEquipmentDtos$Response' THROW 51005,N'Kiểu kết quả idempotency không khớp',1;
   COMMIT TRANSACTION; SELECT @json AS phanHoiJson; RETURN;
  END;
  INSERT dbo.ThietBiPhong(maPhong,ten,giaTriBanDau,ngayMua,soLuong) VALUES(@room,@name,@value,@purchased,@quantity);
  SET @id=SCOPE_IDENTITY();
  INSERT dbo.NhatKyKiemSoat(nguoiThucHien,hanhDong,loaiDoiTuong,maDoiTuong,duLieuSau) VALUES(@actor,N'ROOM_EQUIPMENT_ADDED',N'ROOM',@room,@name);
  SET @json=(SELECT @id AS id,@room AS room_id,@name AS name,@value AS original_value,@purchased AS purchased_on,@quantity AS quantity,CAST(1 AS BIT) AS active FOR JSON PATH,WITHOUT_ARRAY_WRAPPER);
  INSERT dbo.BanGhiChongTrung(phamViLenh,khoaChongTrung,nguoiThucHien,maBamYeuCau,trangThai,loaiPhanHoi,phanHoiJson,thoiDiemTao,thoiDiemHoanThanh)
  VALUES(N'room-equipment',@key,@actor,@hash,N'Đã hoàn tất',N'com.hospitality.mis.dto.room.RoomEquipmentDtos$Response',@json,@now,@now);
  COMMIT TRANSACTION; SELECT @json AS phanHoiJson;
 END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK TRANSACTION; THROW; END CATCH;
END;
GO

-- =============================================================================
-- uspSuaThietBiPhong
-- =============================================================================
CREATE PROCEDURE dbo.uspSuaThietBiPhong
 @room NVARCHAR(100),@id BIGINT,@name NVARCHAR(MAX),@value DECIMAL(14,2),@purchased DATE,@quantity INT,@active BIT,@actor NVARCHAR(50)
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 BEGIN TRY BEGIN TRANSACTION;
  DECLARE @locked NVARCHAR(10);
  SELECT @locked=maPhong FROM dbo.Phong WITH(UPDLOCK,HOLDLOCK) WHERE maPhong=@room;
  UPDATE dbo.ThietBiPhong WITH(UPDLOCK) SET ten=@name,giaTriBanDau=@value,ngayMua=@purchased,soLuong=@quantity,dangHoatDong=@active WHERE maThietBiPhong=@id AND maPhong=@room;
  IF @@ROWCOUNT=0 THROW 51602,N'Không tìm thấy thiết bị trong phòng',1;
  INSERT dbo.NhatKyKiemSoat(nguoiThucHien,hanhDong,loaiDoiTuong,maDoiTuong,duLieuSau) VALUES(@actor,N'ROOM_EQUIPMENT_UPDATED',N'ROOM_EQUIPMENT',CONVERT(NVARCHAR(100),@id),@room);
  DECLARE @json NVARCHAR(MAX)=(SELECT @id AS id,@room AS room_id,@name AS name,@value AS original_value,@purchased AS purchased_on,@quantity AS quantity,@active AS active FOR JSON PATH,WITHOUT_ARRAY_WRAPPER);
  COMMIT TRANSACTION; SELECT @json AS phanHoiJson;
 END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK TRANSACTION; THROW; END CATCH;
END;
GO

-- =============================================================================
-- uspTaoPhieuBaoTri
-- =============================================================================
CREATE PROCEDURE dbo.uspTaoPhieuBaoTri
 @id NVARCHAR(100),@room NVARCHAR(100),@type NVARCHAR(MAX),@date DATE,@description NVARCHAR(MAX),@actor NVARCHAR(50)
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 BEGIN TRY BEGIN TRANSACTION;
  IF EXISTS(SELECT 1 FROM dbo.PhieuBaoTri WITH(UPDLOCK,HOLDLOCK) WHERE maPhieuBaoTri=@id) THROW 51701,N'Mã phiếu bảo trì đã tồn tại',1;
  DECLARE @status NVARCHAR(30);
  SELECT @status=trangThai FROM dbo.Phong WITH(UPDLOCK,HOLDLOCK) WHERE maPhong=@room;
  IF @status IS NULL THROW 51601,N'Không tìm thấy phòng',1;
  IF @status=N'Đang có khách' THROW 51702,N'Không thể đưa phòng đang có khách vào bảo trì',1;
  INSERT dbo.PhieuBaoTri(maPhieuBaoTri,maPhong,loaiBaoTri,ngayDuKien,trangThai,moTa) VALUES(@id,@room,@type,@date,N'Chưa xử lý',@description);
  UPDATE dbo.Phong SET trangThai=N'Đang bảo trì',phienBan=phienBan+1 WHERE maPhong=@room AND trangThai<>N'Đang bảo trì';
  INSERT dbo.NhatKyKiemSoat(nguoiThucHien,hanhDong,loaiDoiTuong,maDoiTuong,duLieuSau) VALUES(@actor,N'MAINTENANCE_CREATED',N'MAINTENANCE_WORK_ORDER',@id,@room);
  SELECT maPhieuBaoTri,maPhong,loaiBaoTri,ngayDuKien,trangThai,moTa FROM dbo.PhieuBaoTri WHERE maPhieuBaoTri=@id;
  COMMIT TRANSACTION;
 END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK TRANSACTION; THROW; END CATCH;
END;
GO

-- =============================================================================
-- uspChuyenTrangThaiBaoTri
-- =============================================================================
CREATE PROCEDURE dbo.uspChuyenTrangThaiBaoTri @id NVARCHAR(100),@next NVARCHAR(30),@actor NVARCHAR(50) AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 BEGIN TRY BEGIN TRANSACTION;
  DECLARE @room NVARCHAR(10),@before NVARCHAR(30);
  SELECT @room=maPhong,@before=trangThai FROM dbo.PhieuBaoTri WITH(UPDLOCK,HOLDLOCK) WHERE maPhieuBaoTri=@id;
  IF @room IS NULL THROW 51703,N'Không tìm thấy phiếu bảo trì',1;
  IF @before<>@next AND NOT((@before=N'Chưa xử lý' AND @next=N'Đang bảo trì') OR (@before=N'Đang bảo trì' AND @next=N'Đã hoàn thành')) THROW 51704,N'Trạng thái bảo trì không hợp lệ',1;
  IF @before<>@next
  BEGIN
   IF NOT EXISTS(SELECT 1 FROM dbo.Phong WITH(UPDLOCK,HOLDLOCK) WHERE maPhong=@room) THROW 51601,N'Room not found',1;
   UPDATE dbo.PhieuBaoTri SET trangThai=@next WHERE maPhieuBaoTri=@id;
   DECLARE @roomStatus NVARCHAR(30)=CASE WHEN @next=N'Đã hoàn thành' THEN N'Sẵn sàng' ELSE N'Đang bảo trì' END;
   UPDATE dbo.Phong SET trangThai=@roomStatus,phienBan=phienBan+1 WHERE maPhong=@room AND trangThai<>@roomStatus;
   INSERT dbo.NhatKyKiemSoat(nguoiThucHien,hanhDong,loaiDoiTuong,maDoiTuong,duLieuTruoc,duLieuSau)
   VALUES(@actor,N'MAINTENANCE_STATUS_CHANGED',N'MAINTENANCE_WORK_ORDER',@id,
    CASE @before WHEN N'Chưa xử lý' THEN N'CHUA_XU_LY' WHEN N'Đang bảo trì' THEN N'DANG_BAO_TRI' ELSE N'DA_HOAN_THANH' END,
    CASE @next WHEN N'Chưa xử lý' THEN N'CHUA_XU_LY' WHEN N'Đang bảo trì' THEN N'DANG_BAO_TRI' ELSE N'DA_HOAN_THANH' END);
  END;
  SELECT maPhieuBaoTri,maPhong,loaiBaoTri,ngayDuKien,trangThai,moTa FROM dbo.PhieuBaoTri WHERE maPhieuBaoTri=@id;
  COMMIT TRANSACTION;
 END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK TRANSACTION; THROW; END CATCH;
END;
GO

-- =============================================================================
-- uspTaoMauChecklistBuongPhong
-- =============================================================================
CREATE PROCEDURE dbo.uspTaoMauChecklistBuongPhong @name NVARCHAR(MAX),@actor NVARCHAR(MAX),@now DATETIME2(6)
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 BEGIN TRY BEGIN TRANSACTION;
  INSERT dbo.MauChecklistBuongPhong(ten) VALUES(@name);
  DECLARE @id BIGINT=SCOPE_IDENTITY();
  INSERT dbo.NhatKyKiemSoat(nguoiThucHien,hanhDong,loaiDoiTuong,maDoiTuong,duLieuSau,thoiDiemTao)
  VALUES(@actor,N'HOUSEKEEPING_CHECKLIST_TEMPLATE_CREATED',N'HOUSEKEEPING_CHECKLIST_TEMPLATE',N'new',@name,TODATETIMEOFFSET(@now,'+07:00'));
  COMMIT TRANSACTION;
  SELECT @id AS maMauChecklist,@name AS ten,CAST(1 AS BIT) AS dangHoatDong;
 END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK TRANSACTION; THROW; END CATCH;
END;
GO

-- =============================================================================
-- uspGhiKetQuaChecklistBuongPhong
-- =============================================================================
CREATE PROCEDURE dbo.uspGhiKetQuaChecklistBuongPhong
 @task BIGINT,@item NVARCHAR(MAX),@passed BIT,@note NVARCHAR(MAX),@actor NVARCHAR(MAX),@management BIT,@now DATETIME2(6)
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 BEGIN TRY BEGIN TRANSACTION;
  -- Every checklist/inspection writer locks the task first. Scope/state are
  -- rechecked under this lock, not trusted from an earlier Java read.
  DECLARE @assignee NVARCHAR(10),@status NVARCHAR(30),@lockedRoom NVARCHAR(10);
  SELECT @lockedRoom=maPhong FROM dbo.NhiemVuBuongPhong WHERE maNhiemVuBuongPhong=@task;
  IF @lockedRoom IS NOT NULL SELECT @lockedRoom=maPhong FROM dbo.Phong WITH(UPDLOCK,HOLDLOCK) WHERE maPhong=@lockedRoom;
  SELECT @assignee=nguoiDuocPhanCong,@status=trangThai FROM dbo.NhiemVuBuongPhong WITH(UPDLOCK,HOLDLOCK) WHERE maNhiemVuBuongPhong=@task;
  IF @status IS NULL THROW 51801,N'Không tìm thấy task dọn phòng',1;
  IF @management=0 AND (@assignee IS NULL OR @assignee COLLATE Latin1_General_100_BIN2<>@actor COLLATE Latin1_General_100_BIN2)
   THROW 51802,N'Chỉ người được phân công hoặc quản lý mới được truy cập task',1;
  IF @status=N'Sẵn sàng' THROW 51803,N'Không thể thay đổi checklist của task đã READY',1;
  IF NOT EXISTS(SELECT 1 FROM dbo.MauChecklistBuongPhong WITH(HOLDLOCK) WHERE dangHoatDong=1 AND ten COLLATE Latin1_General_100_BIN2=@item COLLATE Latin1_General_100_BIN2)
   THROW 51804,N'Checklist item không tồn tại hoặc đã ngừng dùng',1;
  INSERT dbo.KetQuaChecklistBuongPhong(maNhiemVuBuongPhong,hangMuc,datYeuCau,ghiChu,nguoiHoanThanh,thoiDiemHoanThanh)
  VALUES(@task,@item,@passed,@note,@actor,@now);
  DECLARE @id BIGINT=SCOPE_IDENTITY(),@complete BIT=1;
  IF EXISTS(
   SELECT 1 FROM dbo.MauChecklistBuongPhong t WITH(HOLDLOCK)
   OUTER APPLY(SELECT TOP(1) r.datYeuCau FROM dbo.KetQuaChecklistBuongPhong r
    WHERE r.maNhiemVuBuongPhong=@task AND r.hangMuc COLLATE Latin1_General_100_BIN2=t.ten COLLATE Latin1_General_100_BIN2 ORDER BY r.maKetQuaChecklist DESC) latest
   WHERE t.dangHoatDong=1 AND ISNULL(latest.datYeuCau,0)=0
  ) SET @complete=0;
  UPDATE dbo.NhiemVuBuongPhong SET daHoanThanhChecklist=@complete,thoiDiemCapNhat=@now WHERE maNhiemVuBuongPhong=@task;
  INSERT dbo.NhatKyKiemSoat(nguoiThucHien,hanhDong,loaiDoiTuong,maDoiTuong,duLieuSau,thoiDiemTao)
  VALUES(@actor,N'HOUSEKEEPING_CHECKLIST_RESULT_RECORDED',N'HOUSEKEEPING_TASK',CONVERT(NVARCHAR(100),@task),@item,TODATETIMEOFFSET(@now,'+07:00'));
  COMMIT TRANSACTION;
  SELECT @id AS maKetQuaChecklist,@task AS maNhiemVuBuongPhong,@item AS hangMuc,@passed AS datYeuCau,@note AS ghiChu,@actor AS nguoiHoanThanh,@now AS thoiDiemHoanThanh;
 END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK TRANSACTION; THROW; END CATCH;
END;
GO

-- =============================================================================
-- uspGhiKiemTraBuongPhong
-- =============================================================================
CREATE PROCEDURE dbo.uspGhiKiemTraBuongPhong
 @task BIGINT,@type NVARCHAR(MAX),@item NVARCHAR(MAX),@quantity INT,@condition NVARCHAR(MAX),@note NVARCHAR(MAX),@actor NVARCHAR(MAX),@management BIT,@now DATETIME2(6),@apiType NVARCHAR(20)
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 BEGIN TRY BEGIN TRANSACTION;
  DECLARE @assignee NVARCHAR(10),@status NVARCHAR(30),@lockedRoom NVARCHAR(10);
  SELECT @lockedRoom=maPhong FROM dbo.NhiemVuBuongPhong WHERE maNhiemVuBuongPhong=@task;
  IF @lockedRoom IS NOT NULL SELECT @lockedRoom=maPhong FROM dbo.Phong WITH(UPDLOCK,HOLDLOCK) WHERE maPhong=@lockedRoom;
  SELECT @assignee=nguoiDuocPhanCong,@status=trangThai FROM dbo.NhiemVuBuongPhong WITH(UPDLOCK,HOLDLOCK) WHERE maNhiemVuBuongPhong=@task;
  IF @status IS NULL THROW 51801,N'Không tìm thấy task dọn phòng',1;
  IF @management=0 AND (@assignee IS NULL OR @assignee COLLATE Latin1_General_100_BIN2<>@actor COLLATE Latin1_General_100_BIN2)
   THROW 51802,N'Chỉ người được phân công hoặc quản lý mới được truy cập task',1;
  IF @status=N'Sẵn sàng' THROW 51803,N'Không thể thêm inspection cho task đã READY',1;
  IF @quantity<0 THROW 51805,N'Inspection không hợp lệ',1;
  INSERT dbo.KiemTraBuongPhong(maNhiemVuBuongPhong,loaiKiemTra,hangMuc,soLuong,tinhTrangHangMuc,ghiChu,nguoiHoanThanh,thoiDiemHoanThanh)
  VALUES(@task,@type,@item,@quantity,@condition,@note,@actor,@now);
  DECLARE @id BIGINT=SCOPE_IDENTITY();
  INSERT dbo.NhatKyKiemSoat(nguoiThucHien,hanhDong,loaiDoiTuong,maDoiTuong,duLieuSau,thoiDiemTao)
  VALUES(@actor,N'HOUSEKEEPING_INSPECTION_RECORDED',N'HOUSEKEEPING_TASK',CONVERT(NVARCHAR(100),@task),@apiType+N':'+@item,TODATETIMEOFFSET(@now,'+07:00'));
  COMMIT TRANSACTION;
  SELECT @id AS maKiemTraBuongPhong,@task AS maNhiemVuBuongPhong,@type AS loaiKiemTra,@item AS hangMuc,@quantity AS soLuong,@condition AS tinhTrangHangMuc,@note AS ghiChu,@actor AS nguoiHoanThanh,@now AS thoiDiemHoanThanh;
 END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK TRANSACTION; THROW; END CATCH;
END;
GO

-- =============================================================================
-- uspKhoaChongTrungBuongPhong
-- =============================================================================
CREATE PROCEDURE dbo.uspKhoaChongTrungBuongPhong
 @scope NVARCHAR(100),@key NVARCHAR(100),@actor NVARCHAR(MAX),@hash NVARCHAR(64),@bucket SMALLINT,@json NVARCHAR(MAX) OUTPUT
AS
BEGIN
 SET NOCOUNT ON;
 IF @@TRANCOUNT=0 THROW 51815,N'Idempotency cần transaction của command',1;
 IF NOT EXISTS(SELECT 1 FROM dbo.NhomKhoaChongTrung WITH(UPDLOCK,HOLDLOCK) WHERE maNhomKhoa=@bucket) THROW 51502,N'Thiếu bucket idempotency',1;
 DECLARE @id BIGINT,@oldActor NVARCHAR(100),@oldHash NVARCHAR(64),@status NVARCHAR(20),@type NVARCHAR(255);
 SELECT @id=maBanGhiChongTrung,@oldActor=nguoiThucHien,@oldHash=maBamYeuCau,@json=phanHoiJson,@status=trangThai,@type=loaiPhanHoi
 FROM dbo.BanGhiChongTrung WITH(UPDLOCK,HOLDLOCK) WHERE phamViLenh=@scope AND khoaChongTrung=@key;
 IF @id IS NOT NULL
 BEGIN
  IF @oldActor COLLATE Latin1_General_100_BIN2<>@actor COLLATE Latin1_General_100_BIN2 OR @oldHash<>@hash THROW 51005,N'Idempotency key đã được dùng cho yêu cầu hoặc actor khác',1;
  IF @status<>N'Đã hoàn tất' OR @json IS NULL THROW 51503,N'Yêu cầu cùng Idempotency-Key đang được xử lý',1;
  IF @type<>N'com.hospitality.mis.dto.operations.HousekeepingDtos$Response' THROW 51005,N'Kiểu kết quả idempotency không khớp',1;
 END;
END;
GO

-- =============================================================================
-- uspLuuKetQuaChongTrungBuongPhong
-- =============================================================================
CREATE PROCEDURE dbo.uspLuuKetQuaChongTrungBuongPhong
 @scope NVARCHAR(100),@key NVARCHAR(100),@actor NVARCHAR(MAX),@hash NVARCHAR(64),@now DATETIME2(6),@task BIGINT,@json NVARCHAR(MAX) OUTPUT
AS
BEGIN
 SET NOCOUNT ON;
 IF @@TRANCOUNT=0 THROW 51815,N'Idempotency cần transaction của command',1;
 SET @json=(SELECT maNhiemVuBuongPhong AS id,maPhong AS room_id,nguoiDuocPhanCong AS assignee,
  CASE trangThai WHEN N'Cần dọn phòng' THEN N'NEEDS_CLEANING' WHEN N'Đang thực hiện' THEN N'IN_PROGRESS' WHEN N'Đã dọn xong' THEN N'CLEANED' WHEN N'Sẵn sàng' THEN N'READY' WHEN N'Chờ kỹ thuật' THEN N'WAITING_TECHNICAL' END AS status,
  daHoanThanhChecklist AS checklist_complete,coSuCoChan AS blocking_incident,ghiChu AS note,nguoiPhanCong AS assigned_by,thoiDiemCapNhat AS updated_at
  FROM dbo.NhiemVuBuongPhong WHERE maNhiemVuBuongPhong=@task FOR JSON PATH,INCLUDE_NULL_VALUES,WITHOUT_ARRAY_WRAPPER);
 INSERT dbo.BanGhiChongTrung(phamViLenh,khoaChongTrung,nguoiThucHien,maBamYeuCau,trangThai,loaiPhanHoi,phanHoiJson,thoiDiemTao,thoiDiemHoanThanh)
 VALUES(@scope,@key,@actor,@hash,N'Đã hoàn tất',N'com.hospitality.mis.dto.operations.HousekeepingDtos$Response',@json,@now,@now);
END;
GO

-- =============================================================================
-- uspTaoNhiemVuBuongPhong
-- =============================================================================
CREATE PROCEDURE dbo.uspTaoNhiemVuBuongPhong
 @room NVARCHAR(MAX),@assignee NVARCHAR(MAX),@note NVARCHAR(MAX),@actor NVARCHAR(MAX),@key NVARCHAR(100),@hash NVARCHAR(64),@bucket SMALLINT,@now DATETIME2(6)
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 BEGIN TRY BEGIN TRANSACTION;
  DECLARE @json NVARCHAR(MAX);
  EXEC dbo.uspKhoaChongTrungBuongPhong N'housekeeping-task-create',@key,@actor,@hash,@bucket,@json OUTPUT;
  IF @json IS NOT NULL BEGIN COMMIT TRANSACTION;SELECT @json AS phanHoiJson;RETURN;END;
  DECLARE @roomStatus NVARCHAR(30);
  SELECT @roomStatus=trangThai FROM dbo.Phong WITH(UPDLOCK,HOLDLOCK) WHERE maPhong=@room;
  IF @roomStatus IS NULL THROW 51601,N'Không tìm thấy phòng',1;
  IF @roomStatus=N'Đang có khách' THROW 51702,N'Không thể tạo task dọn phòng khi phòng đang có khách',1;
  IF @roomStatus=N'Ngừng sử dụng' OR (@roomStatus=N'Đang bảo trì' AND
   (NOT EXISTS(SELECT 1 FROM dbo.PhieuCongViecKyThuat WHERE maPhong=@room AND trangThai=N'Đã hoàn thành') OR
    EXISTS(SELECT 1 FROM dbo.PhieuCongViecKyThuat WHERE maPhong=@room AND trangThai NOT IN(N'Đã hoàn thành',N'Đã bàn giao phòng'))))
   THROW 51806,N'Không thể tạo task dọn phòng khi phòng đang bị khóa kỹ thuật',1;
  INSERT dbo.NhiemVuBuongPhong(maPhong,nguoiDuocPhanCong,trangThai,ghiChu,nguoiPhanCong,thoiDiemCapNhat)
  VALUES(@room,@assignee,N'Cần dọn phòng',@note,@actor,@now);
  DECLARE @task BIGINT=SCOPE_IDENTITY();
  UPDATE dbo.Phong SET trangThai=N'Đang dọn phòng',phienBan=phienBan+1 WHERE maPhong=@room AND trangThai<>N'Đang dọn phòng';
  INSERT dbo.NhatKyKiemSoat(nguoiThucHien,hanhDong,loaiDoiTuong,maDoiTuong,duLieuSau,thoiDiemTao)
  VALUES(@actor,N'HOUSEKEEPING_TASK_CREATED',N'HOUSEKEEPING_TASK',N'new',@room,TODATETIMEOFFSET(@now,'+07:00'));
  EXEC dbo.uspLuuKetQuaChongTrungBuongPhong N'housekeeping-task-create',@key,@actor,@hash,@now,@task,@json OUTPUT;
  COMMIT TRANSACTION;SELECT @json AS phanHoiJson;
 END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK TRANSACTION;THROW;END CATCH;
END;
GO

-- =============================================================================
-- uspCapNhatNhiemVuBuongPhong
-- =============================================================================
CREATE PROCEDURE dbo.uspCapNhatNhiemVuBuongPhong
 @task BIGINT,@next NVARCHAR(30),@note NVARCHAR(MAX),@assignee NVARCHAR(MAX),@actor NVARCHAR(MAX),@management BIT,@key NVARCHAR(100),@hash NVARCHAR(64),@bucket SMALLINT,@now DATETIME2(6)
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 BEGIN TRY BEGIN TRANSACTION;
  DECLARE @json NVARCHAR(MAX);
  EXEC dbo.uspKhoaChongTrungBuongPhong N'housekeeping-task-update',@key,@actor,@hash,@bucket,@json OUTPUT;
  IF @json IS NOT NULL BEGIN COMMIT TRANSACTION;SELECT @json AS phanHoiJson;RETURN;END;
  DECLARE @before NVARCHAR(30),@assigned NVARCHAR(MAX),@room NVARCHAR(10),@roomStatus NVARCHAR(30),@blocking BIT=0,@complete BIT,@newRoomStatus NVARCHAR(30);
  -- Discover the immutable room FK, then lock room before the task.
  SELECT @room=maPhong FROM dbo.NhiemVuBuongPhong WHERE maNhiemVuBuongPhong=@task;
  IF @room IS NOT NULL SELECT @roomStatus=trangThai FROM dbo.Phong WITH(UPDLOCK,HOLDLOCK) WHERE maPhong=@room;
  SELECT @before=trangThai,@assigned=nguoiDuocPhanCong,@room=maPhong,@complete=daHoanThanhChecklist FROM dbo.NhiemVuBuongPhong WITH(UPDLOCK,HOLDLOCK) WHERE maNhiemVuBuongPhong=@task;
  IF @before IS NULL THROW 51801,N'Không tìm thấy task dọn phòng',1;
  IF @next IS NULL THROW 51807,N'Trạng thái dọn phòng không hợp lệ',1;
  IF @management=0 AND (@assigned IS NULL OR @assigned COLLATE Latin1_General_100_BIN2<>@actor COLLATE Latin1_General_100_BIN2) THROW 51802,N'Chỉ người được phân công mới được cập nhật task',1;
  IF @next=N'Sẵn sàng' AND @management=0 THROW 51812,N'Chỉ quản lý mới được nghiệm thu phòng',1;
  IF NOT(@before=@next OR (@before=N'Cần dọn phòng' AND @next IN(N'Đang thực hiện',N'Chờ kỹ thuật')) OR
   (@before=N'Đang thực hiện' AND @next IN(N'Đã dọn xong',N'Chờ kỹ thuật')) OR
   (@before=N'Đã dọn xong' AND @next IN(N'Sẵn sàng',N'Chờ kỹ thuật')) OR
   (@before=N'Chờ kỹ thuật' AND @next IN(N'Đang thực hiện',N'Đã dọn xong')))
   THROW 51808,N'Chuyển trạng thái dọn phòng không hợp lệ',1;
  IF @assignee IS NOT NULL AND (@assigned IS NULL OR @assignee COLLATE Latin1_General_100_BIN2<>@assigned COLLATE Latin1_General_100_BIN2)
  BEGIN
   IF @management=0 THROW 51809,N'Chỉ Manager mới được đổi người phụ trách task',1;
   IF LEN(@assignee)=0 THROW 51810,N'Task phải có nhân viên housekeeping được phân công',1;
   SET @assigned=@assignee;
  END;
  SELECT @roomStatus=trangThai FROM dbo.Phong WITH(UPDLOCK,HOLDLOCK) WHERE maPhong=@room;
  IF @roomStatus IS NULL THROW 51601,N'Không tìm thấy phòng',1;
  IF EXISTS(SELECT 1 FROM dbo.SuCoThietBi WITH(HOLDLOCK) WHERE maPhong=@room AND mucDoNghiemTrong IN(N'Cao',N'Nghiêm trọng') AND trangThaiBanGiao<>N'Đã xử lý') SET @blocking=1;
  IF @next=N'Sẵn sàng'
  BEGIN
   SET @complete=1;
   IF NOT EXISTS(SELECT 1 FROM dbo.MauChecklistBuongPhong WITH(HOLDLOCK) WHERE dangHoatDong=1) OR EXISTS(
    SELECT 1 FROM dbo.MauChecklistBuongPhong t WITH(HOLDLOCK)
    OUTER APPLY(SELECT TOP(1) r.datYeuCau FROM dbo.KetQuaChecklistBuongPhong r WHERE r.maNhiemVuBuongPhong=@task AND r.hangMuc COLLATE Latin1_General_100_BIN2=t.ten COLLATE Latin1_General_100_BIN2 ORDER BY r.maKetQuaChecklist DESC) latest
    WHERE t.dangHoatDong=1 AND ISNULL(latest.datYeuCau,0)=0) SET @complete=0;
   IF @complete=0 OR @blocking=1 THROW 51811,N'Phòng chỉ READY sau khi hoàn thành checklist và không còn incident blocking',1;
   IF @roomStatus=N'Đang bảo trì' THROW 51806,N'Phòng đang bị maintenance khóa',1;
  END;
  SET @newRoomStatus=CASE WHEN @next=N'Sẵn sàng' THEN N'Sẵn sàng' WHEN @next=N'Chờ kỹ thuật' THEN N'Đang bảo trì' ELSE N'Đang dọn phòng' END;
  IF @next=N'Sẵn sàng' AND EXISTS(SELECT 1 FROM dbo.PhieuCongViecKyThuat WHERE maPhong=@room AND trangThai=N'Đã hoàn thành') SET @newRoomStatus=N'Đang bảo trì';
  UPDATE dbo.NhiemVuBuongPhong SET trangThai=@next,nguoiDuocPhanCong=@assigned,ghiChu=COALESCE(@note,ghiChu),daHoanThanhChecklist=@complete,coSuCoChan=@blocking,thoiDiemCapNhat=@now WHERE maNhiemVuBuongPhong=@task;
  UPDATE dbo.Phong SET trangThai=@newRoomStatus,phienBan=phienBan+1 WHERE maPhong=@room AND trangThai<>@newRoomStatus;
  DECLARE @beforeApi NVARCHAR(30)=CASE @before WHEN N'Cần dọn phòng' THEN N'NEEDS_CLEANING' WHEN N'Đang thực hiện' THEN N'IN_PROGRESS' WHEN N'Đã dọn xong' THEN N'CLEANED' WHEN N'Sẵn sàng' THEN N'READY' WHEN N'Chờ kỹ thuật' THEN N'WAITING_TECHNICAL' END;
  DECLARE @nextApi NVARCHAR(30)=CASE @next WHEN N'Cần dọn phòng' THEN N'NEEDS_CLEANING' WHEN N'Đang thực hiện' THEN N'IN_PROGRESS' WHEN N'Đã dọn xong' THEN N'CLEANED' WHEN N'Sẵn sàng' THEN N'READY' WHEN N'Chờ kỹ thuật' THEN N'WAITING_TECHNICAL' END;
  INSERT dbo.NhatKyKiemSoat(nguoiThucHien,hanhDong,loaiDoiTuong,maDoiTuong,duLieuTruoc,duLieuSau,thoiDiemTao)
  VALUES(@actor,N'HOUSEKEEPING_TASK_STATUS_CHANGED',N'HOUSEKEEPING_TASK',CONVERT(NVARCHAR(100),@task),@beforeApi,@nextApi,TODATETIMEOFFSET(@now,'+07:00'));
  EXEC dbo.uspLuuKetQuaChongTrungBuongPhong N'housekeeping-task-update',@key,@actor,@hash,@now,@task,@json OUTPUT;
  COMMIT TRANSACTION;SELECT @json AS phanHoiJson;
 END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK TRANSACTION;THROW;END CATCH;
END;
GO

-- =============================================================================
-- uspLenhCongViecKyThuat
-- =============================================================================
CREATE PROCEDURE dbo.uspLenhCongViecKyThuat
 @command NVARCHAR(10),@id BIGINT,@payload NVARCHAR(MAX),@actor NVARCHAR(MAX),@management BIT,@technical BIT,
 @key NVARCHAR(100),@hash NVARCHAR(64),@bucket SMALLINT,@now DATETIME2(6)
AS
BEGIN
 SET NOCOUNT ON;SET XACT_ABORT ON;
 BEGIN TRY BEGIN TRANSACTION;
  DECLARE @scope NVARCHAR(100)=CASE @command WHEN N'create' THEN N'technical-work-order-create' WHEN N'update' THEN N'technical-work-order-update' WHEN N'accept' THEN N'technical-work-order-accept' WHEN N'release' THEN N'technical-work-order-release' END;
  IF @scope IS NULL THROW 51901,N'Command kỹ thuật không hợp lệ',1;
  IF NOT EXISTS(SELECT 1 FROM dbo.NhomKhoaChongTrung WITH(UPDLOCK,HOLDLOCK) WHERE maNhomKhoa=@bucket) THROW 51502,N'Thiếu bucket idempotency',1;
  DECLARE @claim BIGINT,@oldActor NVARCHAR(100),@oldHash NVARCHAR(64),@json NVARCHAR(MAX),@claimStatus NVARCHAR(20),@responseType NVARCHAR(255);
  SELECT @claim=maBanGhiChongTrung,@oldActor=nguoiThucHien,@oldHash=maBamYeuCau,@json=phanHoiJson,@claimStatus=trangThai,@responseType=loaiPhanHoi FROM dbo.BanGhiChongTrung WITH(UPDLOCK,HOLDLOCK) WHERE phamViLenh=@scope AND khoaChongTrung=@key;
  IF @claim IS NOT NULL
  BEGIN
   IF @oldActor COLLATE Latin1_General_100_BIN2<>@actor COLLATE Latin1_General_100_BIN2 OR @oldHash<>@hash THROW 51005,N'Idempotency key đã được dùng cho yêu cầu hoặc actor khác',1;
   IF @claimStatus<>N'Đã hoàn tất' OR @json IS NULL THROW 51503,N'Yêu cầu cùng Idempotency-Key đang được xử lý',1;
   IF @responseType<>N'com.hospitality.mis.dto.operations.TechnicalWorkOrderDtos$Response' THROW 51005,N'Kiểu kết quả idempotency không khớp',1;
   COMMIT TRANSACTION;SELECT @json AS phanHoiJson;RETURN;
  END;
  DECLARE @room NVARCHAR(MAX),@equipment BIGINT,@assignee NVARCHAR(MAX),@priority NVARCHAR(MAX),@sla DATETIME2(6),@materials NVARCHAR(MAX),@next NVARCHAR(MAX),@result NVARCHAR(MAX),@acceptance NVARCHAR(MAX),@reason NVARCHAR(MAX),@resultBlank BIT,@acceptanceBlank BIT;
  SELECT @room=roomId,@equipment=equipmentId,@assignee=assignee,@priority=priority,@sla=slaDue,@materials=materials,@next=nextStatus,@result=resultNote,@acceptance=acceptanceNote,@reason=acceptanceReason,@resultBlank=resultBlank,@acceptanceBlank=acceptanceBlank
  FROM OPENJSON(@payload) WITH(roomId NVARCHAR(MAX) '$.room',equipmentId BIGINT '$.equipment',assignee NVARCHAR(MAX) '$.assignee',priority NVARCHAR(MAX) '$.priority',slaDue DATETIME2(6) '$.sla',materials NVARCHAR(MAX) '$.materials',nextStatus NVARCHAR(MAX) '$.status',resultNote NVARCHAR(MAX) '$.result',acceptanceNote NVARCHAR(MAX) '$.acceptance',acceptanceReason NVARCHAR(MAX) '$.reason',resultBlank BIT '$.resultBlank',acceptanceBlank BIT '$.acceptanceBlank');
  DECLARE @roomStatus NVARCHAR(30),@before NVARCHAR(30),@assigned NVARCHAR(MAX),@creator NVARCHAR(10),@acceptedBy NVARCHAR(50),@storedResult NVARCHAR(MAX),@action NVARCHAR(100),@beforeApi NVARCHAR(30),@afterApi NVARCHAR(30),@target NVARCHAR(100),@afterData NVARCHAR(MAX);
  IF @command=N'create'
  BEGIN
   SELECT @roomStatus=trangThai FROM dbo.Phong WITH(UPDLOCK,HOLDLOCK) WHERE maPhong=@room;
   IF @roomStatus IS NULL THROW 51601,N'Không tìm thấy phòng',1;
   IF @roomStatus=N'Đang có khách' THROW 51702,N'Không thể tạo work order cho phòng đang có khách',1;
   IF @roomStatus=N'Ngừng sử dụng' THROW 51904,N'Không thể tạo work order cho phòng ngừng sử dụng',1;
   IF @equipment IS NOT NULL AND NOT EXISTS(SELECT 1 FROM dbo.ThietBiPhong WHERE maThietBiPhong=@equipment AND maPhong=@room AND dangHoatDong=1) THROW 51602,N'Thiết bị active không thuộc phòng',1;
   IF @assignee IS NULL SET @assignee=@actor;
   IF @management=0 AND @actor COLLATE Latin1_General_100_BIN2<>@assignee COLLATE Latin1_General_100_BIN2 THROW 51905,N'Technical chỉ được tự nhận work order của mình',1;
   IF @priority IS NULL THROW 51902,N'Priority không hợp lệ',1;
   INSERT dbo.PhieuCongViecKyThuat(maPhong,maThietBiPhong,nguoiDuocPhanCong,doUuTien,thoiHanSla,vatTuSuDung,trangThai,nguoiTao,thoiDiemTao,thoiDiemCapNhat)
   VALUES(@room,@equipment,@assignee,@priority,@sla,@materials,N'Mới tạo',@actor,@now,@now);
   SET @id=SCOPE_IDENTITY();
   UPDATE dbo.Phong SET trangThai=N'Đang bảo trì',phienBan=phienBan+1 WHERE maPhong=@room AND trangThai<>N'Đang bảo trì';
   SET @action=N'TECHNICAL_WORK_ORDER_CREATED';SET @target=N'new';SET @afterData=@room;
  END
  ELSE
  BEGIN
   SELECT @room=maPhong,@before=trangThai,@assigned=nguoiDuocPhanCong,@creator=nguoiTao,@acceptedBy=nguoiNghiemThu,@storedResult=ghiChuKetQua FROM dbo.PhieuCongViecKyThuat WITH(UPDLOCK,HOLDLOCK) WHERE maPhieuCongViecKyThuat=@id;
   IF @before IS NULL THROW 51906,N'Không tìm thấy work order',1;
   SET @target=CONVERT(NVARCHAR(100),@id);
   SET @beforeApi=CASE @before WHEN N'Mới tạo' THEN N'NEW' WHEN N'Đã tiếp nhận' THEN N'ACKNOWLEDGED' WHEN N'Đang thực hiện' THEN N'IN_PROGRESS' WHEN N'Chờ nghiệm thu' THEN N'WAITING_ACCEPTANCE' WHEN N'Đã hoàn thành' THEN N'COMPLETED' WHEN N'Đã bàn giao phòng' THEN N'ROOM_RELEASED' END;
   IF @command=N'update'
   BEGIN
    IF @assigned IS NULL OR (@management=0 AND @assigned COLLATE Latin1_General_100_BIN2<>@actor COLLATE Latin1_General_100_BIN2) THROW 51907,N'Chỉ kỹ thuật viên được phân công mới được cập nhật work order',1;
    IF @before IN(N'Đã hoàn thành',N'Đã bàn giao phòng') THROW 51908,N'Work order đã nghiệm thu hoặc release không thể sửa bằng PATCH',1;
    IF @next IS NULL THROW 51903,N'Trạng thái work order không hợp lệ',1;
    IF NOT(@before=@next OR (@before=N'Mới tạo' AND @next=N'Đã tiếp nhận') OR (@before=N'Đã tiếp nhận' AND @next=N'Đang thực hiện') OR (@before=N'Đang thực hiện' AND @next=N'Chờ nghiệm thu') OR (@before=N'Chờ nghiệm thu' AND @next=N'Đã hoàn thành')) THROW 51909,N'Chuyển trạng thái work order không hợp lệ',1;
    IF @next IN(N'Đã hoàn thành',N'Đã bàn giao phòng') THROW 51910,N'Nghiệm thu và release phải dùng command riêng',1;
    IF @assignee IS NOT NULL AND @assignee COLLATE Latin1_General_100_BIN2<>@assigned COLLATE Latin1_General_100_BIN2
    BEGIN
     IF @management=0 THROW 51905,N'Chỉ Manager mới được đổi người phụ trách work order',1;
     IF LEN(@assignee)=0 THROW 51911,N'Work order phải có nhân viên kỹ thuật được phân công',1;
     SET @assigned=@assignee;
    END;
    IF @next=N'Chờ nghiệm thu' AND ((@result IS NOT NULL AND @resultBlank=1) OR (@result IS NULL AND (@storedResult IS NULL OR LEN(LTRIM(RTRIM(REPLACE(REPLACE(REPLACE(@storedResult,CHAR(9),N' '),CHAR(10),N' '),CHAR(13),N' '))))=0))) THROW 51912,N'Phải ghi kết quả sửa trước khi chờ nghiệm thu',1;
    UPDATE dbo.PhieuCongViecKyThuat SET trangThai=@next,nguoiDuocPhanCong=@assigned,vatTuSuDung=COALESCE(@materials,vatTuSuDung),ghiChuKetQua=COALESCE(@result,ghiChuKetQua),thoiDiemCapNhat=@now WHERE maPhieuCongViecKyThuat=@id;
    SET @action=N'TECHNICAL_WORK_ORDER_STATUS_CHANGED';
   END
   ELSE IF @command=N'accept'
   BEGIN
    IF @management=0 THROW 51913,N'Chỉ Manager, Director hoặc Admin được nghiệm thu',1;
    IF @actor COLLATE Latin1_General_100_BIN2=@creator COLLATE Latin1_General_100_BIN2 OR @actor COLLATE Latin1_General_100_BIN2=@assigned COLLATE Latin1_General_100_BIN2 THROW 51914,N'Người tạo hoặc người được giao không được tự nghiệm thu',1;
    IF @before<>N'Chờ nghiệm thu' THROW 51909,N'Chỉ work order chờ nghiệm thu mới được duyệt',1;
    IF @acceptance IS NULL OR @acceptanceBlank=1 THROW 51915,N'Phải ghi nhận xét nghiệm thu',1;
    SET @next=N'Đã hoàn thành';
    UPDATE dbo.PhieuCongViecKyThuat SET trangThai=@next,ghiChuNghiemThu=@acceptance,nguoiNghiemThu=@actor,thoiDiemNghiemThu=@now,thoiDiemCapNhat=@now WHERE maPhieuCongViecKyThuat=@id;
    SET @action=N'TECHNICAL_WORK_ORDER_ACCEPTED';
   END
   ELSE
   BEGIN
    IF @technical=0 OR @assigned IS NULL OR @actor COLLATE Latin1_General_100_BIN2<>@assigned COLLATE Latin1_General_100_BIN2 THROW 51907,N'Chỉ kỹ thuật viên được phân công mới được release phòng',1;
    IF @before<>N'Đã hoàn thành' OR @acceptedBy IS NULL THROW 51916,N'Work order chưa được Manager nghiệm thu',1;
    SELECT @roomStatus=trangThai FROM dbo.Phong WITH(UPDLOCK,HOLDLOCK) WHERE maPhong=@room;
    IF @roomStatus IS NULL THROW 51601,N'Không tìm thấy phòng',1;
    -- Preserve guard precedence: other orders, occupied/booking, then readiness.
    IF EXISTS(SELECT 1 FROM dbo.PhieuCongViecKyThuat WHERE maPhong=@room AND maPhieuCongViecKyThuat<>@id AND trangThai IN(N'Mới tạo',N'Đã tiếp nhận',N'Đang thực hiện',N'Chờ nghiệm thu')) THROW 51917,N'Phòng còn work order kỹ thuật chưa hoàn tất',1;
    IF @roomStatus=N'Đang có khách' THROW 51702,N'Không thể release phòng đang có khách',1;
    IF dbo.fnKiemTraPhongTrong(@room,@now,DATEADD(MICROSECOND,1,@now),@now,NULL)=0 THROW 51918,N'Phòng đang có booking hoặc lưu trú hoạt động',1;
    DECLARE @hkStatus NVARCHAR(30),@checklist BIT,@blocking BIT;
    SELECT TOP(1) @hkStatus=trangThai,@checklist=daHoanThanhChecklist,@blocking=coSuCoChan FROM dbo.NhiemVuBuongPhong WITH(HOLDLOCK) WHERE maPhong=@room ORDER BY thoiDiemCapNhat DESC,maNhiemVuBuongPhong DESC;
    IF @hkStatus IS NULL OR @hkStatus NOT IN(N'Đã dọn xong',N'Chờ kỹ thuật',N'Sẵn sàng') OR @checklist=0 OR @blocking=1 OR EXISTS(SELECT 1 FROM dbo.SuCoThietBi WITH(HOLDLOCK) WHERE maPhong=@room AND mucDoNghiemTrong IN(N'Cao',N'Nghiêm trọng') AND trangThaiBanGiao<>N'Đã xử lý') THROW 51919,N'Checklist housekeeping chưa hoàn tất hoặc còn incident blocking',1;
    SET @next=N'Đã bàn giao phòng';
    UPDATE dbo.PhieuCongViecKyThuat SET trangThai=@next,thoiDiemCapNhat=@now WHERE maPhieuCongViecKyThuat=@id;
    UPDATE dbo.Phong SET trangThai=N'Sẵn sàng',phienBan=phienBan+1 WHERE maPhong=@room AND trangThai<>N'Sẵn sàng';
    SET @action=N'TECHNICAL_ROOM_RELEASED';
   END;
   SET @afterData=CASE @next WHEN N'Mới tạo' THEN N'NEW' WHEN N'Đã tiếp nhận' THEN N'ACKNOWLEDGED' WHEN N'Đang thực hiện' THEN N'IN_PROGRESS' WHEN N'Chờ nghiệm thu' THEN N'WAITING_ACCEPTANCE' WHEN N'Đã hoàn thành' THEN N'COMPLETED' WHEN N'Đã bàn giao phòng' THEN N'ROOM_RELEASED' END;
  END;
  INSERT dbo.NhatKyKiemSoat(nguoiThucHien,hanhDong,loaiDoiTuong,maDoiTuong,duLieuTruoc,duLieuSau,lyDo,thoiDiemTao) VALUES(@actor,@action,N'TECHNICAL_WORK_ORDER',@target,@beforeApi,@afterData,CASE WHEN @command=N'accept' THEN @reason ELSE NULL END,TODATETIMEOFFSET(@now,'+07:00'));
  SET @json=(SELECT maPhieuCongViecKyThuat AS id,maPhong AS room_id,maThietBiPhong AS equipment_id,nguoiDuocPhanCong AS assignee,
   CASE doUuTien WHEN N'Thấp' THEN N'LOW' WHEN N'Trung bình' THEN N'MEDIUM' WHEN N'Cao' THEN N'HIGH' WHEN N'Nghiêm trọng' THEN N'CRITICAL' END AS priority,
   thoiHanSla AS sla_due_at,vatTuSuDung AS materials,ghiChuKetQua AS result_note,ghiChuNghiemThu AS acceptance_note,nguoiNghiemThu AS accepted_by,thoiDiemNghiemThu AS accepted_at,
   CASE trangThai WHEN N'Mới tạo' THEN N'NEW' WHEN N'Đã tiếp nhận' THEN N'ACKNOWLEDGED' WHEN N'Đang thực hiện' THEN N'IN_PROGRESS' WHEN N'Chờ nghiệm thu' THEN N'WAITING_ACCEPTANCE' WHEN N'Đã hoàn thành' THEN N'COMPLETED' WHEN N'Đã bàn giao phòng' THEN N'ROOM_RELEASED' END AS status,
   nguoiTao AS created_by,thoiDiemTao AS created_at,thoiDiemCapNhat AS updated_at FROM dbo.PhieuCongViecKyThuat WHERE maPhieuCongViecKyThuat=@id FOR JSON PATH,INCLUDE_NULL_VALUES,WITHOUT_ARRAY_WRAPPER);
  INSERT dbo.BanGhiChongTrung(phamViLenh,khoaChongTrung,nguoiThucHien,maBamYeuCau,trangThai,loaiPhanHoi,phanHoiJson,thoiDiemTao,thoiDiemHoanThanh) VALUES(@scope,@key,@actor,@hash,N'Đã hoàn tất',N'com.hospitality.mis.dto.operations.TechnicalWorkOrderDtos$Response',@json,@now,@now);
  COMMIT TRANSACTION;SELECT @json AS phanHoiJson;
 END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK TRANSACTION;THROW;END CATCH;
END;
GO

-- =============================================================================
-- uspThemThongBao
-- =============================================================================
CREATE PROCEDURE dbo.uspThemThongBao
 @topic NVARCHAR(MAX),@role NVARCHAR(MAX),@payload NVARCHAR(MAX),@key NVARCHAR(MAX),@now DATETIME2(6),@id BIGINT OUTPUT
AS
BEGIN
 SET NOCOUNT ON;SET XACT_ABORT ON;
 SET @id=NULL;
 BEGIN TRY BEGIN TRANSACTION;
  SELECT @id=maThongBao FROM dbo.HangDoiThongBao WITH(UPDLOCK,HOLDLOCK) WHERE khoaChongLap=@key;
  IF @id IS NULL
  BEGIN
   INSERT dbo.HangDoiThongBao(chuDe,vaiTroNguoiNhan,noiDung,trangThai,khoaChongLap,thoiDiemCoTheGui,thoiDiemTao)
   VALUES(@topic,@role,@payload,N'Chờ gửi',@key,@now,@now);
   SET @id=SCOPE_IDENTITY();
  END;
  COMMIT TRANSACTION;
 END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK TRANSACTION;THROW;END CATCH;
END;
GO

-- =============================================================================
-- uspDanhDauThongBaoDaGui
-- =============================================================================
CREATE PROCEDURE dbo.uspDanhDauThongBaoDaGui @id BIGINT,@now DATETIME2(6)
AS
BEGIN
 SET NOCOUNT ON;SET XACT_ABORT ON;
 BEGIN TRY BEGIN TRANSACTION;
  UPDATE dbo.HangDoiThongBao WITH(UPDLOCK,HOLDLOCK) SET trangThai=N'Đã gửi',thoiDiemGui=@now WHERE maThongBao=@id;
  IF @@ROWCOUNT=0 THROW 52001,N'Không tìm thấy thông báo',1;
  SELECT maThongBao,chuDe,vaiTroNguoiNhan,noiDung,trangThai,khoaChongLap,thoiDiemCoTheGui,thoiDiemTao,thoiDiemGui FROM dbo.HangDoiThongBao WHERE maThongBao=@id;
  COMMIT TRANSACTION;
 END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK TRANSACTION;THROW;END CATCH;
END;
GO

-- =============================================================================
-- uspKhoaLenhSuCoThietBi: transaction-bound context and durable replay.
-- The complete active registry is locked so Java's exact equalsIgnoreCase
-- selection cannot race a rename/add/remove. No business writes happen here.
-- =============================================================================
CREATE PROCEDURE dbo.uspKhoaLenhSuCoThietBi
 @command NVARCHAR(20),@key NVARCHAR(100),@actor NVARCHAR(MAX),@hash NVARCHAR(64),@bucket SMALLINT,
 @reservation BIGINT,@room NVARCHAR(MAX),@id BIGINT,@context NVARCHAR(MAX) OUTPUT
AS
BEGIN
 SET NOCOUNT ON;SET XACT_ABORT ON;
 DECLARE @scope NVARCHAR(100)=CASE @command WHEN N'reservation' THEN N'equipment-incident' WHEN N'room' THEN N'room-incident' WHEN N'handoff' THEN N'equipment-incident-handoff' END;
 IF @scope IS NULL THROW 52108,N'Command sự cố không hợp lệ',1;
 -- JDBC autoCommit=false starts its implicit transaction on the first table
 -- access; checking @@TRANCOUNT before that access incorrectly rejects it.
 DECLARE @lockedBucket SMALLINT;
 SELECT @lockedBucket=maNhomKhoa FROM dbo.NhomKhoaChongTrung WITH(UPDLOCK,HOLDLOCK) WHERE maNhomKhoa=@bucket;
 IF @@TRANCOUNT=0 THROW 51815,N'Incident cần transaction của command',1;
 IF @lockedBucket IS NULL THROW 51502,N'Thiếu bucket idempotency',1;
 DECLARE @record BIGINT,@oldActor NVARCHAR(100),@oldHash NVARCHAR(64),@status NVARCHAR(20),@type NVARCHAR(255),@json NVARCHAR(MAX);
 SELECT @record=maBanGhiChongTrung,@oldActor=nguoiThucHien,@oldHash=maBamYeuCau,@status=trangThai,@type=loaiPhanHoi,@json=phanHoiJson
 FROM dbo.BanGhiChongTrung WITH(UPDLOCK,HOLDLOCK) WHERE phamViLenh=@scope AND khoaChongTrung=@key;
 IF @record IS NOT NULL
 BEGIN
  IF @oldActor COLLATE Latin1_General_100_BIN2<>@actor COLLATE Latin1_General_100_BIN2 OR @oldHash<>@hash THROW 51005,N'Idempotency key đã được dùng cho yêu cầu khác',1;
  IF @status<>N'Đã hoàn tất' OR @json IS NULL THROW 51503,N'Yêu cầu cùng key đang xử lý',1;
  IF @type IS NULL OR @type<>N'com.hospitality.mis.dto.operations.EquipmentIncidentDtos$Response' THROW 51005,N'Kiểu kết quả idempotency không khớp',1;
  SET @context=(SELECT @json AS replay FOR JSON PATH,WITHOUT_ARRAY_WRAPPER);RETURN;
 END;
 IF @command=N'reservation'
 BEGIN
  DECLARE @reservationStatus NVARCHAR(30);
  SELECT @reservationStatus=trangThai FROM dbo.PhieuDatPhong WITH(UPDLOCK,HOLDLOCK) WHERE maPhieuDatPhong=@reservation;
  IF @reservationStatus IS NULL THROW 52101,N'Không tìm thấy đặt phòng',1;
  IF @reservationStatus<>N'Đã nhận phòng' THROW 52102,N'Chỉ ghi nhận sự cố khi khách đang ở',1;
  IF NOT EXISTS(SELECT 1 FROM dbo.ChiTietDatPhong WITH(UPDLOCK,HOLDLOCK) WHERE maPhieuDatPhong=@reservation AND maPhong=@room AND trangThai=N'Đang có khách') THROW 52104,N'Phòng không thuộc đặt phòng này',1;
 END;
 IF @command=N'handoff'
 BEGIN
  SELECT @room=maPhong FROM dbo.SuCoThietBi WHERE maSuCoThietBi=@id;
  IF @room IS NULL THROW 52103,N'Không tìm thấy sự cố',1;
 END;
 IF NOT EXISTS(SELECT 1 FROM dbo.Phong WITH(UPDLOCK,HOLDLOCK) WHERE maPhong=@room) THROW 51601,N'Không tìm thấy phòng',1;
 IF @command=N'handoff'
 BEGIN
  IF NOT EXISTS(SELECT 1 FROM dbo.SuCoThietBi WITH(UPDLOCK,HOLDLOCK) WHERE maSuCoThietBi=@id) THROW 52103,N'Không tìm thấy sự cố',1;
  SET @context=N'{}';RETURN;
 END;
 SET @context=(SELECT JSON_QUERY((SELECT maThietBiPhong AS id,maPhong AS room_id,ten AS name,giaTriBanDau AS original_value,ngayMua AS purchased_on,soLuong AS quantity,dangHoatDong AS active
  FROM dbo.ThietBiPhong WITH(UPDLOCK,HOLDLOCK) WHERE maPhong=@room AND dangHoatDong=1 ORDER BY ten,maThietBiPhong FOR JSON PATH)) AS equipment FOR JSON PATH,WITHOUT_ARRAY_WRAPPER);
END;
GO

-- =============================================================================
-- uspGhiSuCoThietBi: snapshot, compensation, state, audit, outbox and replay
-- are committed together. Lock order: bucket -> reservation -> room -> registry/
-- incident -> outbox; the caller may retain these locks until its outer commit.
-- =============================================================================
CREATE PROCEDURE dbo.uspGhiSuCoThietBi
 @command NVARCHAR(20),@id BIGINT,@reservation BIGINT,@room NVARCHAR(MAX),@equipment BIGINT,@name NVARCHAR(MAX),
 @normalizedName NVARCHAR(MAX),@quantity INT,@severity NVARCHAR(20),@note NVARCHAR(MAX),@next NVARCHAR(20),@mayResolve BIT,
 @actor NVARCHAR(MAX),@key NVARCHAR(100),@hash NVARCHAR(64),@bucket SMALLINT,@now DATETIME2(6)
AS
BEGIN
 SET NOCOUNT ON;SET XACT_ABORT ON;
 BEGIN TRY BEGIN TRANSACTION;
  DECLARE @context NVARCHAR(MAX),@json NVARCHAR(MAX),@scope NVARCHAR(100)=CASE @command WHEN N'reservation' THEN N'equipment-incident' WHEN N'room' THEN N'room-incident' WHEN N'handoff' THEN N'equipment-incident-handoff' END;
  EXEC dbo.uspKhoaLenhSuCoThietBi @command,@key,@actor,@hash,@bucket,@reservation,@room,@id,@context OUTPUT;
  -- OPENJSON avoids JSON_VALUE's 4,000-character response limit.
  SELECT @json=replay FROM OPENJSON(@context) WITH(replay NVARCHAR(MAX) '$.replay');
  IF @json IS NOT NULL BEGIN COMMIT TRANSACTION;SELECT @json AS phanHoiJson;RETURN;END;
  DECLARE @before NVARCHAR(20),@beforeApi NVARCHAR(20),@afterApi NVARCHAR(20),@amount DECIMAL(19,2)=0,@original DECIMAL(14,2)=0,@purchase DATE=CAST(@now AS DATE),@registryName NVARCHAR(100),@available INT,@event BIGINT;
  IF @command=N'handoff'
  BEGIN
   SELECT @before=trangThaiBanGiao FROM dbo.SuCoThietBi WHERE maSuCoThietBi=@id;
   IF @next=N'Đã xử lý' AND @mayResolve=0 THROW 52109,N'Chỉ Technical hoặc Manager mới được resolve incident',1;
   IF @next IS NULL OR NOT(@before=@next OR(@before=N'Đang mở' AND @next=N'Đã tiếp nhận') OR(@before=N'Đã tiếp nhận' AND @next=N'Đã xử lý')) THROW 52110,N'Chuyển trạng thái handoff không hợp lệ',1;
   UPDATE dbo.SuCoThietBi SET trangThaiBanGiao=@next,ghiChuBanGiao=@note WHERE maSuCoThietBi=@id;
   SET @beforeApi=CASE @before WHEN N'Đang mở' THEN N'OPEN' WHEN N'Đã tiếp nhận' THEN N'ACKNOWLEDGED' WHEN N'Đã xử lý' THEN N'RESOLVED' END;
   SET @afterApi=CASE @next WHEN N'Đang mở' THEN N'OPEN' WHEN N'Đã tiếp nhận' THEN N'ACKNOWLEDGED' WHEN N'Đã xử lý' THEN N'RESOLVED' END;
   INSERT dbo.NhatKyKiemSoat(nguoiThucHien,hanhDong,loaiDoiTuong,maDoiTuong,duLieuTruoc,duLieuSau,lyDo,thoiDiemTao)
   VALUES(@actor,N'EQUIPMENT_INCIDENT_HANDOFF',N'EQUIPMENT_INCIDENT',CONVERT(NVARCHAR(30),@id),@beforeApi,@afterApi,@note,TODATETIMEOFFSET(@now,'+07:00'));
  END
  ELSE
  BEGIN
   SELECT @registryName=ten,@original=giaTriBanDau,@purchase=ngayMua,@available=soLuong FROM dbo.ThietBiPhong WHERE maThietBiPhong=@equipment AND maPhong=@room AND dangHoatDong=1;
   IF @command=N'reservation'
   BEGIN
    IF @registryName IS NULL THROW 51602,N'Thiết bị active không thuộc phòng',1;
    IF @quantity>@available THROW 52106,N'Số lượng hư hỏng vượt số lượng thiết bị',1;
    IF @purchase>CAST(@now AS DATE) THROW 52107,N'Ngày mua thiết bị không được sau ngày tính bồi thường',1;
    SET @amount=dbo.fnTinhBoiThuongThietBi(@original,@purchase,@quantity,CAST(@now AS DATE));
   END;
   SET @severity=COALESCE(@severity,N'Trung bình');
   INSERT dbo.SuCoThietBi(maPhieuDatPhong,maPhong,tenThietBi,giaTriBanDau,ngayMua,soLuong,tienBoiThuong,thoiDiemTao,mucDoNghiemTrong,trangThaiBanGiao,ghiChuBanGiao)
   VALUES(CASE WHEN @command=N'reservation' THEN @reservation ELSE NULL END,@room,CASE WHEN @command=N'reservation' THEN @registryName ELSE @normalizedName END,@original,@purchase,@quantity,@amount,@now,@severity,N'Đang mở',CASE WHEN @command=N'room' THEN @note ELSE NULL END);
   SET @id=SCOPE_IDENTITY();
   INSERT dbo.NhatKyKiemSoat(nguoiThucHien,hanhDong,loaiDoiTuong,maDoiTuong,duLieuSau,lyDo,thoiDiemTao)
   VALUES(@actor,N'EQUIPMENT_INCIDENT_RECORDED',CASE WHEN @command=N'reservation' THEN N'RESERVATION' ELSE N'ROOM' END,
    CASE WHEN @command=N'reservation' THEN CONVERT(NVARCHAR(30),@reservation) ELSE @room END,
    CASE WHEN @command=N'reservation' THEN CONVERT(NVARCHAR(40),@amount) ELSE @name END,CASE WHEN @command=N'room' THEN @note ELSE NULL END,TODATETIMEOFFSET(@now,'+07:00'));
   DECLARE @payload NVARCHAR(MAX),@prefix NVARCHAR(50)=CASE WHEN @command=N'room' THEN N'room-incident-' ELSE N'equipment-incident-' END,@dedupe NVARCHAR(100);
   IF @command=N'room' SET @payload=(SELECT @room AS room_id,@name AS equipment_name FOR JSON PATH,WITHOUT_ARRAY_WRAPPER);
   ELSE SET @payload=(SELECT @reservation AS reservation_id,@room AS room_id,@amount AS compensation FOR JSON PATH,WITHOUT_ARRAY_WRAPPER);
   SET @dedupe=@prefix+CONVERT(NVARCHAR(30),@id);EXEC dbo.uspThemThongBao N'EQUIPMENT_INCIDENT',N'Lễ tân',@payload,@dedupe,@now,@event OUTPUT;
   SET @dedupe=@prefix+N'tech-'+CONVERT(NVARCHAR(30),@id);EXEC dbo.uspThemThongBao N'EQUIPMENT_INCIDENT',N'Kỹ thuật',@payload,@dedupe,@now,@event OUTPUT;
   IF @severity IN(N'Cao',N'Nghiêm trọng') BEGIN SET @dedupe=@prefix+N'manager-'+CONVERT(NVARCHAR(30),@id);EXEC dbo.uspThemThongBao N'EQUIPMENT_INCIDENT',N'Quản lý',@payload,@dedupe,@now,@event OUTPUT;END;
  END;
  SET @json=(SELECT maSuCoThietBi AS id,maPhieuDatPhong AS reservation_id,maPhong AS room_id,tenThietBi AS equipment_name,tienBoiThuong AS compensation,
   CASE mucDoNghiemTrong WHEN N'Thấp' THEN N'LOW' WHEN N'Trung bình' THEN N'MEDIUM' WHEN N'Cao' THEN N'HIGH' WHEN N'Nghiêm trọng' THEN N'CRITICAL' END AS severity,
   CASE trangThaiBanGiao WHEN N'Đang mở' THEN N'OPEN' WHEN N'Đã tiếp nhận' THEN N'ACKNOWLEDGED' WHEN N'Đã xử lý' THEN N'RESOLVED' END AS handoff_status,
   ghiChuBanGiao AS handoff_note FROM dbo.SuCoThietBi WHERE maSuCoThietBi=@id FOR JSON PATH,INCLUDE_NULL_VALUES,WITHOUT_ARRAY_WRAPPER);
  IF @command=N'room' SET @json=JSON_MODIFY(@json,'$.compensation',CAST(0 AS INT));
  INSERT dbo.BanGhiChongTrung(phamViLenh,khoaChongTrung,nguoiThucHien,maBamYeuCau,trangThai,loaiPhanHoi,phanHoiJson,thoiDiemTao,thoiDiemHoanThanh)
  VALUES(@scope,@key,@actor,@hash,N'Đã hoàn tất',N'com.hospitality.mis.dto.operations.EquipmentIncidentDtos$Response',@json,@now,@now);
  COMMIT TRANSACTION;SELECT @json AS phanHoiJson;
 END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK TRANSACTION;THROW;END CATCH;
END;
GO

-- =============================================================================
-- Audit: append only; transaction joins the business command or security REQUIRES_NEW.
-- MAX inputs deliberately preserve storage-length validation instead of truncation.
-- =============================================================================
CREATE PROCEDURE dbo.uspGhiNhatKyKiemSoat
 @actor NVARCHAR(MAX),@action NVARCHAR(MAX),@entityType NVARCHAR(MAX),@entityId NVARCHAR(MAX),
 @before NVARCHAR(MAX),@after NVARCHAR(MAX),@reason NVARCHAR(MAX),@correlation NVARCHAR(MAX),@now DATETIMEOFFSET(6)
AS
BEGIN
 SET NOCOUNT ON;SET XACT_ABORT ON;
 BEGIN TRY
  BEGIN TRANSACTION;
  INSERT dbo.NhatKyKiemSoat(nguoiThucHien,hanhDong,loaiDoiTuong,maDoiTuong,duLieuTruoc,duLieuSau,lyDo,khoaLienKet,thoiDiemTao)
  VALUES(@actor,@action,@entityType,@entityId,@before,@after,@reason,@correlation,@now);
  COMMIT TRANSACTION;
 END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK TRANSACTION;THROW;END CATCH;
END;
GO

-- =============================================================================
-- Durable idempotency: bucket lock held by caller transaction, no process-local fallback.
-- The first table access opens JDBC's implicit transaction before checking its scope.
-- =============================================================================
CREATE PROCEDURE dbo.uspNhanKhoaChongTrung
 @scope NVARCHAR(MAX),@key NVARCHAR(MAX),@actor NVARCHAR(MAX),@hash NVARCHAR(MAX),@bucket SMALLINT,@now DATETIME2(6)
AS
BEGIN
 SET NOCOUNT ON;SET XACT_ABORT ON;
 DECLARE @locked SMALLINT,@id BIGINT,@oldActor NVARCHAR(100),@oldHash NVARCHAR(64),
  @status NVARCHAR(20),@type NVARCHAR(255),@json NVARCHAR(MAX);
 SELECT @locked=maNhomKhoa FROM dbo.NhomKhoaChongTrung WITH(UPDLOCK,HOLDLOCK) WHERE maNhomKhoa=@bucket;
 IF @@TRANCOUNT=0 THROW 51815,N'Claim yêu cầu transaction của caller',1;
 IF @locked IS NULL THROW 51502,N'Thiếu bucket idempotency',1;
 SELECT @id=maBanGhiChongTrung,@oldActor=nguoiThucHien,@oldHash=maBamYeuCau,@status=trangThai,@type=loaiPhanHoi,@json=phanHoiJson
 FROM dbo.BanGhiChongTrung WITH(UPDLOCK,HOLDLOCK) WHERE phamViLenh=@scope AND khoaChongTrung=@key;
 IF @id IS NOT NULL
 BEGIN
  IF @oldActor COLLATE Latin1_General_100_BIN2<>@actor COLLATE Latin1_General_100_BIN2
   OR DATALENGTH(@oldActor)<>DATALENGTH(@actor)
   OR @oldHash COLLATE Latin1_General_100_BIN2<>@hash COLLATE Latin1_General_100_BIN2
   OR DATALENGTH(@oldHash)<>DATALENGTH(@hash) THROW 51005,N'Actor hoặc payload không khớp idempotency',1;
  IF @status<>N'Đã hoàn tất' OR @json IS NULL THROW 51503,N'Yêu cầu idempotency đang xử lý',1;
  SELECT CAST(0 AS BIT) AS fresh,@type AS responseType,@json AS responseJson;RETURN;
 END;
 INSERT dbo.BanGhiChongTrung(phamViLenh,khoaChongTrung,nguoiThucHien,maBamYeuCau,trangThai,thoiDiemTao)
 VALUES(@scope,@key,@actor,@hash,N'Đang xử lý',@now);
 SELECT CAST(1 AS BIT) AS fresh,CAST(NULL AS NVARCHAR(255)) AS responseType,CAST(NULL AS NVARCHAR(MAX)) AS responseJson;
END;
GO

CREATE PROCEDURE dbo.uspHoanThanhChongTrung
 @scope NVARCHAR(MAX),@key NVARCHAR(MAX),@actor NVARCHAR(MAX),@hash NVARCHAR(MAX),
 @type NVARCHAR(MAX),@json NVARCHAR(MAX),@now DATETIME2(6)
AS
BEGIN
 SET NOCOUNT ON;SET XACT_ABORT ON;
 BEGIN TRY
  -- This command must not complete a claim in a different transaction.
  DECLARE @id BIGINT;
  SELECT @id=maBanGhiChongTrung FROM dbo.BanGhiChongTrung WITH(UPDLOCK,HOLDLOCK)
   WHERE phamViLenh=@scope AND khoaChongTrung=@key AND trangThai=N'Đang xử lý'
    AND nguoiThucHien COLLATE Latin1_General_100_BIN2=@actor COLLATE Latin1_General_100_BIN2
    AND DATALENGTH(nguoiThucHien)=DATALENGTH(@actor)
    AND maBamYeuCau COLLATE Latin1_General_100_BIN2=@hash COLLATE Latin1_General_100_BIN2
    AND DATALENGTH(maBamYeuCau)=DATALENGTH(@hash);
  IF @@TRANCOUNT=0 THROW 51815,N'Complete yêu cầu transaction của caller',1;
  IF @id IS NULL THROW 51005,N'Claim không còn hợp lệ',1;
  IF ISJSON(@json,VALUE)<>1 THROW 51008,N'Kết quả idempotency phải là JSON hợp lệ',1;
  UPDATE dbo.BanGhiChongTrung SET trangThai=N'Đã hoàn tất',loaiPhanHoi=@type,phanHoiJson=@json,
   thoiDiemHoanThanh=@now,phienBan=phienBan+1 WHERE maBanGhiChongTrung=@id;
 END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK TRANSACTION;THROW;END CATCH;
END;
GO

-- =============================================================================
-- Approval lifecycle and exact binding. Caller transaction also owns target mutation.
-- =============================================================================
CREATE PROCEDURE dbo.uspLenhPheDuyet
 @command NVARCHAR(30),@id BIGINT OUTPUT,@actor NVARCHAR(MAX),@action NVARCHAR(MAX),
 @target NVARCHAR(MAX),@payload NVARCHAR(MAX),@hash NVARCHAR(MAX),@amount DECIMAL(19,4),
 @reason NVARCHAR(MAX),@risk NVARCHAR(MAX),@key NVARCHAR(MAX),@director BIT,@now DATETIMEOFFSET(6)
AS
BEGIN
 SET NOCOUNT ON;SET XACT_ABORT ON;
 BEGIN TRY
  BEGIN TRANSACTION;
  IF @command=N'create'
  BEGIN
   INSERT dbo.YeuCauPheDuyet(nguoiYeuCau,hanhDong,maDoiTuong,duLieuThayDoi,dauVanTayDuLieu,soTien,lyDo,
    mucDoRuiRo,thoiDiemYeuCau,trangThai,thoiDiemHetHan,khoaLienKet)
   VALUES(@actor,@action,@target,@payload,@hash,@amount,@reason,@risk,@now,N'Chờ phê duyệt',DATEADD(HOUR,24,@now),@key);
   SET @id=SCOPE_IDENTITY();
   INSERT dbo.NhatKyKiemSoat(nguoiThucHien,hanhDong,loaiDoiTuong,maDoiTuong,duLieuSau,lyDo,khoaLienKet,thoiDiemTao)
   VALUES(@actor,N'APPROVAL_REQUESTED',N'APPROVAL',CONVERT(NVARCHAR(100),@id),N'PENDING',@reason,@key,@now);
  END
  ELSE IF @command=N'expire'
  BEGIN
   DECLARE @expired TABLE(id BIGINT,reason NVARCHAR(500),correlation NVARCHAR(100));
   UPDATE dbo.YeuCauPheDuyet WITH(UPDLOCK,HOLDLOCK) SET trangThai=N'Đã hết hạn',thoiDiemQuyetDinh=@now
    OUTPUT inserted.maYeuCauPheDuyet,inserted.lyDo,inserted.khoaLienKet INTO @expired
    WHERE trangThai=N'Chờ phê duyệt' AND thoiDiemHetHan<=@now;
   INSERT dbo.NhatKyKiemSoat(nguoiThucHien,hanhDong,loaiDoiTuong,maDoiTuong,duLieuTruoc,duLieuSau,lyDo,khoaLienKet,thoiDiemTao)
    SELECT N'SYSTEM',N'APPROVAL_EXPIRED',N'APPROVAL',CONVERT(NVARCHAR(100),id),N'PENDING',N'EXPIRED',reason,correlation,@now FROM @expired;
  END
  ELSE
  BEGIN
   DECLARE @requester NVARCHAR(50),@oldStatus NVARCHAR(20),@storedAction NVARCHAR(50),
    @expires DATETIMEOFFSET(6),@storedReason NVARCHAR(500),@correlation NVARCHAR(100),@newStatus NVARCHAR(20),@auditAction NVARCHAR(100);
   IF @command IN(N'require',N'consume-requester',N'consume-approver')
   BEGIN
    SET @id=NULL;
    SELECT TOP(1) @id=maYeuCauPheDuyet FROM dbo.YeuCauPheDuyet WITH(UPDLOCK,HOLDLOCK)
     WHERE hanhDong=@action AND maDoiTuong=@target AND trangThai=N'Đã phê duyệt' AND thoiDiemSuDung IS NULL
      AND dauVanTayDuLieu=@hash AND ((@amount IS NULL AND soTien IS NULL) OR soTien=@amount)
      AND (@command=N'consume-approver' OR
       (nguoiYeuCau COLLATE Latin1_General_100_BIN2=@actor COLLATE Latin1_General_100_BIN2 AND DATALENGTH(nguoiYeuCau)=DATALENGTH(@actor)))
     ORDER BY maYeuCauPheDuyet DESC;
    IF @id IS NULL THROW 52205,N'Cần exact approval',1;
   END;
   SELECT @requester=nguoiYeuCau,@oldStatus=trangThai,@storedAction=hanhDong,@expires=thoiDiemHetHan,@storedReason=lyDo,@correlation=khoaLienKet
    FROM dbo.YeuCauPheDuyet WITH(UPDLOCK,HOLDLOCK) WHERE maYeuCauPheDuyet=@id;
   IF @requester IS NULL THROW 52201,N'Không tìm thấy approval',1;
   IF @command IN(N'approve',N'reject')
   BEGIN
    IF @oldStatus=N'Chờ phê duyệt' AND @expires<=@now THROW 52202,N'Approval đã hết hạn',1;
    IF @storedAction IN(N'Hoàn tiền thanh toán',N'Hoàn tiền đặt cọc') AND @director=0 THROW 52203,N'Chỉ DIRECTOR được duyệt hoàn tiền',1;
    IF @oldStatus<>N'Chờ phê duyệt' THROW 52204,N'Approval đã quyết định',1;
    IF @requester COLLATE Latin1_General_100_BIN2=@actor COLLATE Latin1_General_100_BIN2 AND DATALENGTH(@requester)=DATALENGTH(@actor) THROW 52206,N'Không được tự duyệt',1;
    SET @newStatus=CASE @command WHEN N'approve' THEN N'Đã phê duyệt' ELSE N'Bị từ chối' END;
    SET @auditAction=CASE @command WHEN N'approve' THEN N'APPROVAL_APPROVED' ELSE N'APPROVAL_REJECTED' END;
    UPDATE dbo.YeuCauPheDuyet SET trangThai=@newStatus,nguoiPheDuyet=@actor,thoiDiemQuyetDinh=@now WHERE maYeuCauPheDuyet=@id;
   END
   ELSE IF @command IN(N'require',N'consume-requester',N'consume-approver')
   BEGIN
    IF @expires<=@now THROW 52202,N'Approval đã hết hạn',1;
    IF @command=N'consume-approver' AND @requester COLLATE Latin1_General_100_BIN2=@actor COLLATE Latin1_General_100_BIN2 AND DATALENGTH(@requester)=DATALENGTH(@actor) THROW 52206,N'Requester không được tự kích hoạt',1;
    IF @command<>N'require'
    BEGIN
     SET @newStatus=N'Đã sử dụng';SET @auditAction=N'APPROVAL_CONSUMED';
     UPDATE dbo.YeuCauPheDuyet SET trangThai=@newStatus,thoiDiemSuDung=@now WHERE maYeuCauPheDuyet=@id AND trangThai=N'Đã phê duyệt' AND thoiDiemSuDung IS NULL;
     IF @@ROWCOUNT<>1 THROW 52205,N'Approval đã consume',1;
    END;
   END
   ELSE THROW 51008,N'Lệnh approval không hợp lệ',1;
   IF @auditAction IS NOT NULL
    INSERT dbo.NhatKyKiemSoat(nguoiThucHien,hanhDong,loaiDoiTuong,maDoiTuong,duLieuTruoc,duLieuSau,lyDo,khoaLienKet,thoiDiemTao)
    VALUES(@actor,@auditAction,N'APPROVAL',CONVERT(NVARCHAR(100),@id),
     CASE @oldStatus WHEN N'Chờ phê duyệt' THEN N'PENDING' ELSE N'APPROVED' END,
     CASE @newStatus WHEN N'Đã phê duyệt' THEN N'APPROVED' WHEN N'Bị từ chối' THEN N'REJECTED' ELSE N'CONSUMED' END,@storedReason,@correlation,@now);
  END;
  COMMIT TRANSACTION;
 END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK TRANSACTION;THROW;END CATCH;
END;
GO

-- =============================================================================
-- Finalized ledger append. There is deliberately no ledger UPDATE/DELETE command.
-- =============================================================================
CREATE PROCEDURE dbo.uspGhiButToanTaiChinh
 @type NVARCHAR(MAX),@sourceType NVARCHAR(MAX),@sourceId NVARCHAR(MAX),@direction NVARCHAR(MAX),
 @amount DECIMAL(38,6),@actor NVARCHAR(MAX),@now DATETIME2(6),@note NVARCHAR(MAX)
AS
BEGIN
 SET NOCOUNT ON;SET XACT_ABORT ON;
 BEGIN TRY
  BEGIN TRANSACTION;
  INSERT dbo.ButToanTaiChinh(loaiButToan,loaiNguon,maNguon,chieuButToan,soTien,maNguoiThucHien,thoiDiemPhatSinh,ghiChu,daChotSo)
  VALUES(@type,@sourceType,@sourceId,@direction,@amount,@actor,@now,@note,1);
  COMMIT TRANSACTION;
 END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK TRANSACTION;THROW;END CATCH;
END;
GO

-- =============================================================================
-- Finance commands: handover/denominations, expense, debt and settlement.
-- Durable claim is held by the caller; history, ledger and audit are one transaction.
-- =============================================================================
CREATE PROCEDURE dbo.uspLenhTaiChinh
 @command NVARCHAR(20),@id BIGINT OUTPUT,@actor NVARCHAR(MAX),@first NVARCHAR(MAX),@second NVARCHAR(MAX),
 @amount DECIMAL(38,6),@denominations NVARCHAR(MAX),@note NVARCHAR(MAX),@key NVARCHAR(MAX),@auditAmount NVARCHAR(MAX),@now DATETIME2(6)
AS
BEGIN
 SET NOCOUNT ON;SET XACT_ABORT ON;
 BEGIN TRY
  BEGIN TRANSACTION;
  DECLARE @action NVARCHAR(100),@source NVARCHAR(40),@type NVARCHAR(40),@direction NVARCHAR(10),
   @ledgerAmount DECIMAL(38,6)=@amount,@ledgerNote NVARCHAR(MAX)=@note,@auditNote NVARCHAR(MAX)=NULL;
  IF @amount IS NULL OR @amount<0 OR (@command<>N'handover' AND @amount<=0) THROW 51008,N'Số tiền không hợp lệ',1;
  IF @command=N'handover'
  BEGIN
   -- Serialize periods for one cashier even when requests have different idempotency keys.
   DECLARE @resource NVARCHAR(255)=N'finance-handover:'+@actor,@lock INT;
   EXEC @lock=sys.sp_getapplock @Resource=@resource,@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=15000;
   IF @lock<0 THROW 52310,N'Không lấy được khóa ca tiền',1;
   DECLARE @from DATETIME2(6)='1970-01-01',@expected DECIMAL(19,2),@variance DECIMAL(19,2);
   SELECT TOP(1) @from=thoiDiemBanGiao FROM dbo.BanGiaoTienCa WITH(UPDLOCK,HOLDLOCK) WHERE nguoiBanGiao=@actor ORDER BY thoiDiemBanGiao DESC,maBanGiaoTienCa DESC;
   SET @expected=dbo.fnTienMatRongTheoCa(@actor,@from,@now);SET @variance=@amount-@expected;
   DECLARE @lines TABLE(ordinal INT,denomination DECIMAL(38,6),quantity INT);
   INSERT @lines SELECT CONVERT(INT,j.[key]),p.denomination,p.quantity FROM OPENJSON(COALESCE(@denominations,N'[]')) j
    CROSS APPLY OPENJSON(j.value) WITH(denomination DECIMAL(38,6),quantity INT) p;
   IF EXISTS(SELECT 1 FROM @lines WHERE denomination IS NULL OR denomination<=0 OR quantity IS NULL OR quantity<=0) THROW 52301,N'Mệnh giá không hợp lệ',1;
   IF EXISTS(SELECT 1 FROM @lines) AND (SELECT SUM(denomination*quantity) FROM @lines)<>@amount THROW 52302,N'Tổng mệnh giá không khớp',1;
   INSERT dbo.BanGiaoTienCa(maCa,nguoiBanGiao,nguoiNhanBanGiao,soTienDuKien,soTienThucTe,thoiDiemBanGiao,ghiChu)
    VALUES(@first,@actor,@second,@expected,@amount,@now,@note);SET @id=SCOPE_IDENTITY();
   INSERT dbo.ChiTietTienBanGiao(maBanGiaoTienCa,menhGia,soLuong) SELECT TOP(2147483647) @id,denomination,quantity FROM @lines ORDER BY ordinal;
   SET @ledgerAmount=ABS(@variance);SET @direction=CASE WHEN @variance>0 THEN N'Ghi nợ' ELSE N'Ghi có' END;
   SET @source=N'CASH_HANDOVER';SET @type=N'CASH_VARIANCE';SET @action=N'CASH_HANDOVER_RECORDED';SET @auditNote=@note;
  END
  ELSE IF @command=N'expense'
  BEGIN
   INSERT dbo.KhoanChi(danhMuc,moTa,soTien,nguoiChiTra,thoiDiemChiTra) VALUES(@first,@second,@amount,@actor,@now);SET @id=SCOPE_IDENTITY();
   SET @source=N'EXPENSE';SET @type=N'EXPENSE';SET @action=N'EXPENSE_RECORDED';SET @direction=N'Ghi nợ';SET @ledgerNote=@second;
  END
  ELSE IF @command=N'debt'
  BEGIN
   IF EXISTS(SELECT 1 FROM dbo.CongNoDoiTac WITH(UPDLOCK,HOLDLOCK) WHERE maThamChieu=@second) THROW 52303,N'Mã công nợ đã tồn tại',1;
   INSERT dbo.CongNoDoiTac(tenDoiTac,maThamChieu,soTien,soTienDaThanhToan,trangThai,thoiDiemGhiNhan)
    VALUES(@first,@second,@amount,0,N'Chưa thanh toán',@now);SET @id=SCOPE_IDENTITY();
   SET @source=N'PARTNER_DEBT';SET @type=N'PARTNER_DEBT_RECORDED';SET @action=N'PARTNER_DEBT_RECORDED';SET @direction=N'Ghi có';SET @ledgerNote=@second;
  END
  ELSE IF @command=N'settle'
  BEGIN
   DECLARE @total DECIMAL(14,2),@paid DECIMAL(14,2),@status NVARCHAR(30);
   SELECT @total=soTien,@paid=soTienDaThanhToan,@status=trangThai FROM dbo.CongNoDoiTac WITH(UPDLOCK,HOLDLOCK) WHERE maCongNoDoiTac=@id;
   IF @total IS NULL THROW 52304,N'Không tìm thấy công nợ đối tác',1;
   IF @status IN(N'Đã hủy',N'Đã thanh toán') THROW 52305,N'Công nợ không còn số dư',1;
   IF @paid+@amount>@total THROW 52306,N'Số tiền tất toán vượt số dư công nợ',1;
   UPDATE dbo.CongNoDoiTac SET soTienDaThanhToan=@paid+@amount,trangThai=CASE WHEN @paid+@amount=@total THEN N'Đã thanh toán' ELSE N'Đã thanh toán một phần' END WHERE maCongNoDoiTac=@id;
   INSERT dbo.ThanhToanCongNoDoiTac(maCongNoDoiTac,soTien,nguoiThanhToan,thoiDiemThanhToan,ghiChu) VALUES(@id,@amount,@actor,@now,@note);
   SET @source=N'PARTNER_DEBT';SET @type=N'PARTNER_DEBT_SETTLEMENT';SET @action=N'PARTNER_DEBT_SETTLED';SET @direction=N'Ghi nợ';SET @auditNote=@note;
  END
  ELSE THROW 51008,N'Lệnh tài chính không hợp lệ',1;
  IF @ledgerAmount>0
   INSERT dbo.ButToanTaiChinh(loaiButToan,loaiNguon,maNguon,chieuButToan,soTien,maNguoiThucHien,thoiDiemPhatSinh,ghiChu,daChotSo)
    VALUES(@type,@source,CONVERT(NVARCHAR(100),@id),@direction,@ledgerAmount,@actor,@now,@ledgerNote,1);
  INSERT dbo.NhatKyKiemSoat(nguoiThucHien,hanhDong,loaiDoiTuong,maDoiTuong,duLieuSau,lyDo,khoaLienKet,thoiDiemTao)
   VALUES(@actor,@action,@source,CONVERT(NVARCHAR(100),@id),@auditAmount,@auditNote,@key,TODATETIMEOFFSET(@now,'+07:00'));
  COMMIT TRANSACTION;
 END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK TRANSACTION;THROW;END CATCH;
END;
GO

-- =============================================================================
-- Shared principal transaction lock. First table access starts JDBC implicit TX.
-- Auth issue/rotate/revoke and identity state changes must take this lock first.
-- =============================================================================
CREATE PROCEDURE dbo.uspKhoaChuTheDangNhap @employee NVARCHAR(MAX),@customer BIGINT
AS
BEGIN
 SET NOCOUNT ON;SET XACT_ABORT ON;
 DECLARE @probe SMALLINT;
 SELECT @probe=maNhomKhoa FROM dbo.NhomKhoaChongTrung WHERE maNhomKhoa=0;
 IF @@TRANCOUNT=0 THROW 51815,N'Identity lock yêu cầu caller transaction',1;
 IF (@employee IS NULL AND @customer IS NULL) OR (@employee IS NOT NULL AND @customer IS NOT NULL) THROW 51008,N'Principal phải có đúng một owner',1;
 DECLARE @resource NVARCHAR(255)=CASE WHEN @employee IS NOT NULL THEN N'identity:employee:'+@employee ELSE N'identity:customer:'+CONVERT(NVARCHAR(30),@customer) END,@lock INT;
 EXEC @lock=sys.sp_getapplock @Resource=@resource,@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=15000;
 IF @lock<0 THROW 52410,N'Không lấy được khóa principal',1;
END;
GO

-- =============================================================================
-- Token row preparation: read owner, then principal lock, then token row lock.
-- Returns the locked projection; replay revokes every successor under the same lock.
-- =============================================================================
CREATE PROCEDURE dbo.uspKhoaMaLamMoiDangNhap @hash NVARCHAR(MAX)
AS
BEGIN
 SET NOCOUNT ON;SET XACT_ABORT ON;
 DECLARE @employee NVARCHAR(10),@customer BIGINT;
 SELECT @employee=maNhanVien,@customer=maTaiKhoanKhachHang FROM dbo.MaLamMoiDangNhap WHERE maBamToken=@hash;
 IF @employee IS NULL AND @customer IS NULL
 BEGIN
  SELECT maMaLamMoiDangNhap,maNhanVien,maTaiKhoanKhachHang,maBamToken,maNhomPhien,thoiDiemPhatHanh,thoiDiemHetHan,thoiDiemThuHoi,maBamThayThe FROM dbo.vwMaLamMoiDangNhap WHERE 1=0;RETURN;
 END;
 EXEC dbo.uspKhoaChuTheDangNhap @employee,@customer;
 SELECT maMaLamMoiDangNhap,maNhanVien,maTaiKhoanKhachHang,maBamToken,maNhomPhien,thoiDiemPhatHanh,thoiDiemHetHan,thoiDiemThuHoi,maBamThayThe
 FROM dbo.MaLamMoiDangNhap WITH(UPDLOCK,HOLDLOCK) WHERE maBamToken=@hash;
END;
GO

-- =============================================================================
-- Refresh token issue/rotate/revoke. All commands serialize by principal.
-- =============================================================================
CREATE PROCEDURE dbo.uspLenhMaLamMoiDangNhap
 @command NVARCHAR(20),@employee NVARCHAR(MAX),@customer BIGINT,@current BIGINT,@hash NVARCHAR(MAX),
 @family NVARCHAR(MAX),@issued DATETIMEOFFSET(6),@expires DATETIMEOFFSET(6),@now DATETIMEOFFSET(6)
AS
BEGIN
 SET NOCOUNT ON;SET XACT_ABORT ON;
 BEGIN TRY
  BEGIN TRANSACTION;
  EXEC dbo.uspKhoaChuTheDangNhap @employee,@customer;
  IF @command IN(N'issue',N'rotate')
  BEGIN
   DECLARE @enabled BIT,@unlocked BIT;
   IF @employee IS NOT NULL SELECT @enabled=duocKichHoat,@unlocked=taiKhoanKhongBiKhoa FROM dbo.NhanVien WITH(UPDLOCK,HOLDLOCK) WHERE maNhanVien=@employee;
   ELSE SELECT @enabled=duocKichHoat,@unlocked=taiKhoanKhongBiKhoa FROM dbo.TaiKhoanKhachHang WITH(UPDLOCK,HOLDLOCK) WHERE maTaiKhoanKhachHang=@customer;
   IF @enabled IS NULL THROW 52501,N'Không tìm thấy chủ tài khoản',1;
   IF @enabled=0 THROW 52502,N'Tài khoản đã vô hiệu hóa',1;
   IF @unlocked=0 THROW 52503,N'Tài khoản đã bị khóa',1;
   IF @command=N'rotate'
   BEGIN
    UPDATE dbo.MaLamMoiDangNhap WITH(UPDLOCK,HOLDLOCK) SET thoiDiemThuHoi=@now,maBamThayThe=@hash
     WHERE maMaLamMoiDangNhap=@current AND thoiDiemThuHoi IS NULL AND thoiDiemHetHan>@now
      AND maNhomPhien=@family AND ((@employee IS NOT NULL AND maNhanVien=@employee AND maTaiKhoanKhachHang IS NULL)
       OR (@customer IS NOT NULL AND maTaiKhoanKhachHang=@customer AND maNhanVien IS NULL));
    IF @@ROWCOUNT<>1 THROW 52501,N'Token không còn hiệu lực',1;
   END;
   INSERT dbo.MaLamMoiDangNhap(maNhanVien,maTaiKhoanKhachHang,maBamToken,maNhomPhien,thoiDiemPhatHanh,thoiDiemHetHan)
    VALUES(@employee,@customer,@hash,@family,@issued,@expires);
  END
  ELSE IF @command=N'revoke'
   UPDATE dbo.MaLamMoiDangNhap SET thoiDiemThuHoi=COALESCE(thoiDiemThuHoi,@now)
    WHERE maMaLamMoiDangNhap=@current AND ((@employee IS NOT NULL AND maNhanVien=@employee) OR (@customer IS NOT NULL AND maTaiKhoanKhachHang=@customer));
  ELSE IF @command=N'family'
   UPDATE dbo.MaLamMoiDangNhap SET thoiDiemThuHoi=@now WHERE maNhomPhien=@family AND thoiDiemThuHoi IS NULL
    AND ((@employee IS NOT NULL AND maNhanVien=@employee) OR (@customer IS NOT NULL AND maTaiKhoanKhachHang=@customer));
  ELSE IF @command=N'all'
   UPDATE dbo.MaLamMoiDangNhap SET thoiDiemThuHoi=@now WHERE thoiDiemThuHoi IS NULL
    AND ((@employee IS NOT NULL AND maNhanVien=@employee) OR (@customer IS NOT NULL AND maTaiKhoanKhachHang=@customer));
  ELSE THROW 51008,N'Lệnh refresh token không hợp lệ',1;
  COMMIT TRANSACTION;
 END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK TRANSACTION;THROW;END CATCH;
END;
GO

-- =============================================================================
-- Employee command context: principal lock precedes row/token locks.
-- =============================================================================
CREATE PROCEDURE dbo.uspKhoaNhanVien @employee NVARCHAR(MAX)
AS
BEGIN
 SET NOCOUNT ON;SET XACT_ABORT ON;
 EXEC dbo.uspKhoaChuTheDangNhap @employee,NULL;
 SELECT maNhanVien,hoVaTen,matKhau,vaiTro,soDienThoai,diaChi,email,phaiDoiMatKhau,duocKichHoat,taiKhoanKhongBiKhoa,soLanDangNhapThatBai,thoiDiemDangNhapGanNhat,thoiDiemDangNhapThatBaiGanNhat,trangThaiLamViec,ngayBatDauNghi,ngayKetThucNghi
 FROM dbo.NhanVien WITH(UPDLOCK,HOLDLOCK) WHERE maNhanVien=@employee;
END;
GO

-- =============================================================================
-- Employee creation, account state, role and login event commands.
-- Caller retains the context lock until all companion audit writes commit.
-- =============================================================================
CREATE PROCEDURE dbo.uspLenhNhanVien
 @command NVARCHAR(20),@employee NVARCHAR(MAX) OUTPUT,@name NVARCHAR(MAX)=NULL,@password NVARCHAR(MAX)=NULL,
 @role NVARCHAR(MAX)=NULL,@phone NVARCHAR(MAX)=NULL,@address NVARCHAR(MAX)=NULL,@email NVARCHAR(MAX)=NULL,
 @flag BIT=NULL,@employment NVARCHAR(MAX)=NULL,@leaveStart DATE=NULL,@leaveEnd DATE=NULL,@now DATETIMEOFFSET(6)=NULL
AS
BEGIN
 SET NOCOUNT ON;SET XACT_ABORT ON;
 BEGIN TRY
  BEGIN TRANSACTION;
  IF @command IN(N'create',N'auto')
  BEGIN
   DECLARE @result INT;
   EXEC @result=sys.sp_getapplock @Resource=N'identity-registration',@LockMode=N'Exclusive',@LockOwner=N'Transaction',@LockTimeout=15000;
   IF @result<0 THROW 52410,N'Không khóa được tài khoản',1;
   IF @command=N'auto'
   BEGIN
    DECLARE @next BIGINT;
    SELECT @next=COALESCE(MAX(TRY_CONVERT(BIGINT,SUBSTRING(maNhanVien,LEN(@employee)+1,20))),0)+1 FROM dbo.NhanVien WITH(UPDLOCK,HOLDLOCK)
     WHERE LEFT(maNhanVien,LEN(@employee))=@employee AND SUBSTRING(maNhanVien,LEN(@employee)+1,20) NOT LIKE N'%[^0-9]%' AND LEN(maNhanVien)>LEN(@employee);
    SET @employee=@employee+CASE WHEN @next<10000 THEN RIGHT(N'0000'+CONVERT(NVARCHAR(20),@next),4) ELSE CONVERT(NVARCHAR(20),@next) END;
   END;
   IF EXISTS(SELECT 1 FROM dbo.NhanVien WITH(UPDLOCK,HOLDLOCK) WHERE maNhanVien=@employee) THROW 52601,N'Mã nhân viên đã tồn tại',1;
   IF EXISTS(SELECT 1 FROM dbo.NhanVien WITH(UPDLOCK,HOLDLOCK) WHERE soDienThoai=@phone) OR EXISTS(SELECT 1 FROM dbo.TaiKhoanKhachHang WITH(UPDLOCK,HOLDLOCK) WHERE soDienThoai=@phone) THROW 52602,N'Số điện thoại đã được sử dụng',1;
   INSERT dbo.NhanVien(maNhanVien,hoVaTen,matKhau,vaiTro,soDienThoai,diaChi,email,phaiDoiMatKhau) VALUES(@employee,@name,@password,@role,@phone,@address,@email,COALESCE(@flag,0));
  END
  ELSE
  BEGIN
   EXEC dbo.uspKhoaChuTheDangNhap @employee,NULL;
   IF NOT EXISTS(SELECT 1 FROM dbo.NhanVien WITH(UPDLOCK,HOLDLOCK) WHERE maNhanVien=@employee)
   BEGIN
    IF @command IN(N'failure',N'success') BEGIN COMMIT TRANSACTION;RETURN;END;
    THROW 52603,N'Không tìm thấy nhân viên',1;
   END;
   IF @command IN(N'password',N'own-password')
    UPDATE dbo.NhanVien SET matKhau=@password,taiKhoanKhongBiKhoa=1,soLanDangNhapThatBai=0,phaiDoiMatKhau=CASE WHEN @command=N'own-password' THEN 0 ELSE phaiDoiMatKhau END WHERE maNhanVien=@employee;
   ELSE IF @command=N'enabled' UPDATE dbo.NhanVien SET duocKichHoat=@flag WHERE maNhanVien=@employee;
   ELSE IF @command=N'role' UPDATE dbo.NhanVien SET vaiTro=@role WHERE maNhanVien=@employee;
   ELSE IF @command=N'employment'
   BEGIN
    IF (@employment=N'Đang nghỉ phép' AND (@leaveStart IS NULL OR @leaveEnd IS NULL OR @leaveEnd<@leaveStart)) OR (@employment<>N'Đang nghỉ phép' AND (@leaveStart IS NOT NULL OR @leaveEnd IS NOT NULL)) THROW 52604,N'Khoảng ngày nghỉ không hợp lệ',1;
    UPDATE dbo.NhanVien SET trangThaiLamViec=@employment,ngayBatDauNghi=@leaveStart,ngayKetThucNghi=@leaveEnd,duocKichHoat=CASE WHEN @employment=N'Đã nghỉ việc' THEN 0 ELSE duocKichHoat END WHERE maNhanVien=@employee;
   END
   ELSE IF @command=N'failure'
   BEGIN
    UPDATE dbo.NhanVien SET soLanDangNhapThatBai=soLanDangNhapThatBai+1,taiKhoanKhongBiKhoa=CASE WHEN soLanDangNhapThatBai+1>=5 THEN 0 ELSE taiKhoanKhongBiKhoa END,thoiDiemDangNhapThatBaiGanNhat=@now WHERE maNhanVien=@employee;
    INSERT dbo.SuKienDangNhapNhanVien(maNhanVien,thoiDiemPhatSinh,ketQua) VALUES(@employee,@now,N'Thất bại');
   END
   ELSE IF @command=N'success'
   BEGIN
    UPDATE dbo.NhanVien SET soLanDangNhapThatBai=0,thoiDiemDangNhapGanNhat=@now WHERE maNhanVien=@employee;
    INSERT dbo.SuKienDangNhapNhanVien(maNhanVien,thoiDiemPhatSinh,ketQua) VALUES(@employee,@now,N'Thành công');
   END
   ELSE THROW 51008,N'Lệnh nhân viên không hợp lệ',1;
   IF (@command=N'enabled' AND @flag=0) OR (@command=N'employment' AND @employment=N'Đã nghỉ việc')
    EXEC dbo.uspLenhMaLamMoiDangNhap N'all',@employee,NULL,NULL,NULL,NULL,NULL,NULL,@now;
  END;
  COMMIT TRANSACTION;
 END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK TRANSACTION;THROW;END CATCH;
END;
GO

-- =============================================================================
-- Shared registration lock protects cross-principal phone and guest identity.
-- =============================================================================
CREATE PROCEDURE dbo.uspKhoaDangKyTaiKhoan @phone NVARCHAR(MAX)=NULL,@email NVARCHAR(MAX)=NULL,@result BIT=1
AS
BEGIN
 SET NOCOUNT ON;SET XACT_ABORT ON;
 DECLARE @probe INT=(SELECT maNhomKhoa FROM dbo.NhomKhoaChongTrung WHERE maNhomKhoa=0),@lock INT;
 IF @@TRANCOUNT=0 THROW 51815,N'Lệnh đăng ký phải nằm trong transaction',1;
 EXEC @lock=sys.sp_getapplock @Resource=N'identity-registration',@LockMode=N'Exclusive',@LockOwner=N'Transaction',@LockTimeout=15000;
 IF @lock<0 THROW 52410,N'Không khóa được đăng ký tài khoản',1;
 IF @result=1 SELECT CONVERT(BIT,CASE WHEN EXISTS(SELECT 1 FROM dbo.NhanVien WHERE soDienThoai=@phone) OR EXISTS(SELECT 1 FROM dbo.TaiKhoanKhachHang WHERE soDienThoai=@phone) THEN 1 ELSE 0 END) AS phoneUsed,
 CONVERT(BIT,CASE WHEN EXISTS(SELECT 1 FROM dbo.vwTaiKhoanKhachHang WHERE LOWER(email)=LOWER(@email)) THEN 1 ELSE 0 END) AS emailUsed;
END;
GO

-- =============================================================================
-- Guest profile creation/update. Version conflicts never overwrite counters.
-- =============================================================================
CREATE PROCEDURE dbo.uspLenhKhachLuuTru
 @command NVARCHAR(20),@id BIGINT OUTPUT,@name NVARCHAR(MAX),@identity NVARCHAR(MAX),@phone NVARCHAR(MAX),
 @email NVARCHAR(MAX),@address NVARCHAR(MAX),@birthYear INT,@version BIGINT=NULL
AS
BEGIN
 SET NOCOUNT ON;SET XACT_ABORT ON;
 BEGIN TRY
  BEGIN TRANSACTION;
  EXEC dbo.uspKhoaDangKyTaiKhoan NULL,NULL,0;
  IF @command=N'create'
  BEGIN
   IF EXISTS(SELECT 1 FROM dbo.KhachLuuTru WITH(UPDLOCK,HOLDLOCK) WHERE soDienThoai=@phone) THROW 52701,N'Số điện thoại khách hàng đã tồn tại',1;
   IF EXISTS(SELECT 1 FROM dbo.KhachLuuTru WITH(UPDLOCK,HOLDLOCK) WHERE soGiayToTuyThan=@identity) THROW 52702,N'Số giấy tờ khách hàng đã tồn tại',1;
   INSERT dbo.KhachLuuTru(hoVaTen,soGiayToTuyThan,soDienThoai,email,diaChi,namSinh) VALUES(@name,@identity,@phone,@email,@address,@birthYear);
   SET @id=SCOPE_IDENTITY();
  END
  ELSE IF @command=N'profile'
  BEGIN
   IF NOT EXISTS(SELECT 1 FROM dbo.KhachLuuTru WITH(UPDLOCK,HOLDLOCK) WHERE maKhachLuuTru=@id) THROW 52703,N'Không tìm thấy khách',1;
   UPDATE dbo.KhachLuuTru SET hoVaTen=@name,soGiayToTuyThan=@identity,email=COALESCE(@email,email),diaChi=COALESCE(@address,diaChi),namSinh=COALESCE(@birthYear,namSinh),phienBan=phienBan+1 WHERE maKhachLuuTru=@id AND phienBan=@version;
   IF @@ROWCOUNT<>1 THROW 51003,N'Hồ sơ khách đã thay đổi',1;
  END
  ELSE THROW 51008,N'Lệnh khách không hợp lệ',1;
  COMMIT TRANSACTION;
 END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK TRANSACTION;THROW;END CATCH;
END;
GO

-- =============================================================================
-- Customer registration and password commands; guest/account writes atomic.
-- =============================================================================
CREATE PROCEDURE dbo.uspLenhTaiKhoanKhachHang
 @command NVARCHAR(20),@id BIGINT OUTPUT,@phone NVARCHAR(MAX)=NULL,@name NVARCHAR(MAX)=NULL,
 @identity NVARCHAR(MAX)=NULL,@email NVARCHAR(MAX)=NULL,@password NVARCHAR(MAX)=NULL
AS
BEGIN
 SET NOCOUNT ON;SET XACT_ABORT ON;
 BEGIN TRY
  BEGIN TRANSACTION;
  IF @command=N'register'
  BEGIN
   EXEC dbo.uspKhoaDangKyTaiKhoan NULL,NULL,0;
   IF EXISTS(SELECT 1 FROM dbo.TaiKhoanKhachHang WITH(UPDLOCK,HOLDLOCK) WHERE soDienThoai=@phone) OR EXISTS(SELECT 1 FROM dbo.NhanVien WITH(UPDLOCK,HOLDLOCK) WHERE soDienThoai=@phone) THROW 52602,N'Số điện thoại đã được sử dụng',1;
   IF @email IS NOT NULL AND EXISTS(SELECT 1 FROM dbo.vwTaiKhoanKhachHang WHERE LOWER(email)=LOWER(@email)) THROW 52704,N'Email đã được sử dụng',1;
   DECLARE @guest BIGINT,@oldIdentity NVARCHAR(12);
   SELECT @guest=maKhachLuuTru,@oldIdentity=soGiayToTuyThan FROM dbo.KhachLuuTru WITH(UPDLOCK,HOLDLOCK) WHERE soDienThoai=@phone;
   IF @guest IS NOT NULL
   BEGIN
    IF @identity COLLATE Latin1_General_100_BIN2<>@oldIdentity COLLATE Latin1_General_100_BIN2 OR DATALENGTH(@identity)<>DATALENGTH(@oldIdentity) THROW 52705,N'Giấy tờ không khớp hồ sơ khách',1;
    IF @email IS NOT NULL UPDATE dbo.KhachLuuTru SET email=@email,phienBan=phienBan+1 WHERE maKhachLuuTru=@guest;
   END
   ELSE
   BEGIN
    EXEC dbo.uspLenhKhachLuuTru N'create',@guest OUTPUT,@name,@identity,@phone,@email,NULL,NULL,NULL;
   END;
   INSERT dbo.TaiKhoanKhachHang(maKhachLuuTru,soDienThoai,matKhau) VALUES(@guest,@phone,@password);
   SET @id=SCOPE_IDENTITY();
  END
  ELSE IF @command=N'password'
  BEGIN
   EXEC dbo.uspKhoaChuTheDangNhap NULL,@id;
   UPDATE dbo.TaiKhoanKhachHang WITH(UPDLOCK,HOLDLOCK) SET matKhau=@password WHERE maTaiKhoanKhachHang=@id;
   IF @@ROWCOUNT<>1 THROW 52706,N'Không tìm thấy tài khoản khách hàng',1;
  END
  ELSE THROW 51008,N'Lệnh tài khoản khách không hợp lệ',1;
  COMMIT TRANSACTION;
 END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK TRANSACTION;THROW;END CATCH;
END;
GO

-- =============================================================================
-- Shared room-catalog lock; room locks always precede type row writes.
-- =============================================================================
CREATE PROCEDURE dbo.uspKhoaDanhMucPhong
AS
BEGIN
 SET NOCOUNT ON;SET XACT_ABORT ON;
 DECLARE @probe INT=(SELECT maNhomKhoa FROM dbo.NhomKhoaChongTrung WHERE maNhomKhoa=0),@result INT;
 IF @@TRANCOUNT=0 THROW 51815,N'Catalog lock yêu cầu caller transaction',1;
 EXEC @result=sys.sp_getapplock @Resource=N'room-catalog',@LockMode=N'Exclusive',@LockOwner=N'Transaction',@LockTimeout=15000;
 IF @result<0 THROW 52810,N'Không khóa được catalog',1;
END;
GO

CREATE PROCEDURE dbo.uspKhoaPhongNoiBo @id NVARCHAR(MAX)
AS
BEGIN
 SET NOCOUNT ON;SET XACT_ABORT ON;
 DECLARE @probe NVARCHAR(10);
 SELECT @probe=maPhong FROM dbo.Phong WITH(UPDLOCK,HOLDLOCK) WHERE maPhong=@id;
 IF @@TRANCOUNT=0 THROW 51815,N'Room lock yêu cầu caller transaction',1;
 SELECT maPhong,ten,maLoaiPhong,tenLoaiPhong,giaTheoNgay,tang,trangThai,moTa,phienBan FROM dbo.vwPhongNoiBo WHERE maPhong=@id;
END;
GO

-- =============================================================================
-- Operational room status: same-state is a no-op, release uses overlap function.
-- =============================================================================
CREATE PROCEDURE dbo.uspChuyenTrangThaiPhong @id NVARCHAR(MAX),@next NVARCHAR(MAX),@version BIGINT,@technical BIT,@management BIT,@now DATETIME2(6)
AS
BEGIN
 SET NOCOUNT ON;SET XACT_ABORT ON;
 BEGIN TRY
  BEGIN TRANSACTION;
  DECLARE @old NVARCHAR(30),@actual BIGINT;
  SELECT @old=trangThai,@actual=phienBan FROM dbo.Phong WITH(UPDLOCK,HOLDLOCK) WHERE maPhong=@id;
  IF @old IS NULL THROW 52801,N'Không tìm thấy phòng',1;
  IF @next NOT IN(N'Sẵn sàng',N'Đang có khách',N'Đang dọn phòng',N'Đang bảo trì',N'Ngừng sử dụng',N'Đã giữ phòng') OR @next IS NULL THROW 52802,N'Trạng thái phòng không hợp lệ',1;
  IF @actual<>@version THROW 51003,N'Phòng đã thay đổi',1;
  IF @old=@next BEGIN COMMIT TRANSACTION;RETURN;END;
  IF @old=N'Sẵn sàng' AND @next=N'Đang bảo trì'
  BEGIN
   IF @technical=0 AND @management=0 THROW 52804,N'Chỉ kỹ thuật/quản lý được bắt đầu bảo trì',1;
  END
  ELSE IF @old=N'Đang bảo trì' AND @next=N'Sẵn sàng'
  BEGIN
   IF @technical=1 THROW 52805,N'Kỹ thuật phải dùng command release sau nghiệm thu',1;
   IF @management=0 THROW 52804,N'Không được tự mở khóa phòng',1;
  END
  ELSE THROW 52806,N'Chuyển trạng thái phòng không hợp lệ',1;
  IF @next=N'Sẵn sàng' AND dbo.fnKiemTraPhongTrong(@id,@now,DATEADD(MICROSECOND,1,@now),@now,NULL)=0 THROW 52807,N'Phòng đang có booking hoạt động',1;
  UPDATE dbo.Phong SET trangThai=@next,phienBan=phienBan+1 WHERE maPhong=@id;
  COMMIT TRANSACTION;
 END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK TRANSACTION;THROW;END CATCH;
END;
GO

-- =============================================================================
-- Room administration: ACTIVE type only; status delegated to operational command.
-- =============================================================================
CREATE PROCEDURE dbo.uspLenhQuanTriPhong
 @command NVARCHAR(20),@id NVARCHAR(MAX),@name NVARCHAR(MAX),@type NVARCHAR(MAX),@floor INT,@description NVARCHAR(MAX),@initial NVARCHAR(MAX),@version BIGINT
AS
BEGIN
 SET NOCOUNT ON;SET XACT_ABORT ON;
 BEGIN TRY
  BEGIN TRANSACTION;
  EXEC dbo.uspKhoaDanhMucPhong;
  DECLARE @exists BIT=0,@actual BIGINT;
  SELECT @exists=1,@actual=phienBan FROM dbo.Phong WITH(UPDLOCK,HOLDLOCK) WHERE maPhong=@id;
  IF @command=N'create' AND @exists=1 THROW 52808,N'Mã phòng đã tồn tại',1;
  IF @command=N'update' AND @exists=0 THROW 52801,N'Không tìm thấy phòng',1;
  IF NOT EXISTS(SELECT 1 FROM dbo.LoaiPhong WITH(UPDLOCK,HOLDLOCK) WHERE maLoaiPhong=@type AND trangThaiDanhMuc=N'Đang hoạt động') THROW 52809,N'Chỉ loại phòng ACTIVE mới được gán phòng',1;
  IF @command=N'create'
  BEGIN
   IF @initial IS NOT NULL AND @initial<>N'Sẵn sàng' THROW 52803,N'Phòng mới chỉ được tạo READY',1;
   INSERT dbo.Phong(maPhong,ten,maLoaiPhong,tang,moTa,trangThai) VALUES(@id,@name,@type,@floor,@description,N'Sẵn sàng');
  END
  ELSE IF @command=N'update'
  BEGIN
   IF @version<>@actual THROW 51003,N'Phòng đã thay đổi',1;
   UPDATE dbo.Phong SET ten=@name,maLoaiPhong=@type,tang=@floor,moTa=@description,phienBan=phienBan+1 WHERE maPhong=@id;
  END
  ELSE THROW 51008,N'Lệnh quản trị phòng không hợp lệ',1;
  COMMIT TRANSACTION;
 END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK TRANSACTION;THROW;END CATCH;
END;
GO

-- =============================================================================
-- Room-type draft/revision/activation commands. Catalog mutex precedes durable
-- claim, then ordered room locks, then type writes. Approval is consumed in the
-- caller transaction and checked again before a price-history row is inserted.
-- =============================================================================
CREATE PROCEDURE dbo.uspLenhLoaiPhong
 @command NVARCHAR(20),@id NVARCHAR(MAX),@name NVARCHAR(MAX)=NULL,@daily DECIMAL(38,6)=NULL,@description NVARCHAR(MAX)=NULL,
 @area DECIMAL(38,6)=NULL,@view NVARCHAR(MAX)=NULL,@hourly DECIMAL(38,6)=NULL,@bed NVARCHAR(MAX)=NULL,
 @actor NVARCHAR(MAX)=NULL,@now DATETIME2(6)=NULL,@source NVARCHAR(MAX)=NULL,@approval BIGINT=NULL,@approver NVARCHAR(MAX)=NULL
AS
BEGIN
 SET NOCOUNT ON;SET XACT_ABORT ON;
 BEGIN TRY
  BEGIN TRANSACTION;
  EXEC dbo.uspKhoaDanhMucPhong;
  DECLARE @status NVARCHAR(30),@previous NVARCHAR(10);
  SELECT @status=trangThaiDanhMuc,@previous=maLoaiPhongGoc FROM dbo.LoaiPhong WHERE maLoaiPhong=@id;
  IF @command IN(N'create',N'revision')
  BEGIN
   IF @status IS NOT NULL THROW 52901,N'Loại phòng đã tồn tại',1;
   IF @command=N'revision' AND NOT EXISTS(SELECT 1 FROM dbo.LoaiPhong WHERE maLoaiPhong=@source AND trangThaiDanhMuc=N'Đang hoạt động') THROW 52904,N'Bản gốc revision không còn ACTIVE',1;
   INSERT dbo.LoaiPhong(maLoaiPhong,ten,giaTheoNgay,moTa,dienTich,huongNhin,giaTheoGio,loaiGiuong,trangThaiDanhMuc,nguoiCapNhatDanhMuc,thoiDiemCapNhatDanhMuc,maLoaiPhongGoc)
    VALUES(@id,@name,@daily,@description,@area,@view,@hourly,@bed,N'Bản nháp',@actor,@now,CASE WHEN @command=N'revision' THEN @source ELSE NULL END);
  END
  ELSE
  BEGIN
   IF @status IS NULL THROW 52902,N'Không tìm thấy loại phòng',1;
   IF @command=N'update'
   BEGIN
    IF @status=N'Đang hoạt động' THROW 52903,N'Không sửa trực tiếp loại phòng ACTIVE',1;
    UPDATE dbo.LoaiPhong SET ten=@name,giaTheoNgay=@daily,moTa=@description,dienTich=@area,huongNhin=@view,giaTheoGio=@hourly,loaiGiuong=@bed,
     trangThaiDanhMuc=N'Bản nháp',nguoiCapNhatDanhMuc=@actor,thoiDiemCapNhatDanhMuc=@now,nguoiDuyetDanhMuc=NULL,thoiDiemDuyetDanhMuc=NULL WHERE maLoaiPhong=@id;
   END
   ELSE IF @command=N'reject' UPDATE dbo.LoaiPhong SET trangThaiDanhMuc=N'Bị từ chối' WHERE maLoaiPhong=@id AND trangThaiDanhMuc<>N'Đang hoạt động';
   ELSE IF @command=N'activate'
   BEGIN
    IF NOT EXISTS(SELECT 1 FROM dbo.YeuCauPheDuyet WITH(UPDLOCK,HOLDLOCK) WHERE maYeuCauPheDuyet=@approval AND maDoiTuong=@id AND hanhDong=N'Kích hoạt loại phòng' AND trangThai=N'Đã sử dụng' AND nguoiPheDuyet=@approver) THROW 52205,N'Cần approval đã consume đúng loại phòng',1;
    IF @previous IS NOT NULL
    BEGIN
     IF NOT EXISTS(SELECT 1 FROM dbo.LoaiPhong WHERE maLoaiPhong=@previous AND trangThaiDanhMuc=N'Đang hoạt động') THROW 52904,N'Bản gốc revision không còn ACTIVE',1;
     DECLARE @room NVARCHAR(10);
     DECLARE catalogRooms CURSOR LOCAL FAST_FORWARD FOR SELECT maPhong FROM dbo.Phong WHERE maLoaiPhong=@previous ORDER BY maPhong;
     OPEN catalogRooms;FETCH NEXT FROM catalogRooms INTO @room;
     WHILE @@FETCH_STATUS=0
     BEGIN
      DECLARE @locked NVARCHAR(10);
      SELECT @locked=maPhong FROM dbo.Phong WITH(UPDLOCK,HOLDLOCK) WHERE maPhong=@room;
      FETCH NEXT FROM catalogRooms INTO @room;
     END;
     CLOSE catalogRooms;DEALLOCATE catalogRooms;
     UPDATE dbo.Phong SET maLoaiPhong=@id,phienBan=phienBan+1 WHERE maLoaiPhong=@previous;
     UPDATE dbo.LoaiPhong SET trangThaiDanhMuc=N'Ngừng kinh doanh',maLoaiPhongThayThe=@id WHERE maLoaiPhong=@previous;
    END;
    UPDATE dbo.LoaiPhong SET trangThaiDanhMuc=N'Đang hoạt động',nguoiDuyetDanhMuc=@approver,thoiDiemDuyetDanhMuc=@now WHERE maLoaiPhong=@id;
    INSERT dbo.LichSuGiaLoaiPhong(maLoaiPhong,giaTheoNgay,nguoiThayDoi,maYeuCauPheDuyet,thoiDiemHieuLuc) SELECT maLoaiPhong,giaTheoNgay,@approver,@approval,@now FROM dbo.LoaiPhong WHERE maLoaiPhong=@id;
   END
   ELSE THROW 51008,N'Lệnh loại phòng không hợp lệ',1;
  END;
  COMMIT TRANSACTION;
 END TRY BEGIN CATCH
  IF CURSOR_STATUS('local','catalogRooms')>=-1 BEGIN IF CURSOR_STATUS('local','catalogRooms')>-1 CLOSE catalogRooms;DEALLOCATE catalogRooms;END;
  IF @@TRANCOUNT>0 ROLLBACK TRANSACTION;THROW;
 END CATCH;
END;
GO

-- =============================================================================
-- Service catalog: service-first lock order shared with inventory commands.
-- Price, consumed approval, history and caller audit commit or roll back together.
-- =============================================================================
CREATE PROCEDURE dbo.uspKhoaDichVuDanhMuc @id NVARCHAR(MAX)
AS
BEGIN
 SET NOCOUNT ON;SET XACT_ABORT ON;
 DECLARE @locked NVARCHAR(10);
 SELECT @locked=maDichVu FROM dbo.DichVu WITH(UPDLOCK,HOLDLOCK) WHERE maDichVu=@id;
 IF @@TRANCOUNT=0 THROW 51008,N'Khóa dịch vụ cần transaction của caller',1;
END;
GO
CREATE PROCEDURE dbo.uspLenhDanhMucDichVu
 @command NVARCHAR(20),@id NVARCHAR(MAX),@name NVARCHAR(MAX),@price DECIMAL(38,6),
 @unit NVARCHAR(MAX),@category NVARCHAR(MAX),@description NVARCHAR(MAX),@image NVARCHAR(MAX),
 @threshold INT,@actor NVARCHAR(MAX),@approval BIGINT,@now DATETIME2(6)
AS
BEGIN
 SET NOCOUNT ON;SET XACT_ABORT ON;
 BEGIN TRY
  BEGIN TRANSACTION;
  DECLARE @exists NVARCHAR(10);
  SELECT @exists=maDichVu FROM dbo.DichVu WITH(UPDLOCK,HOLDLOCK) WHERE maDichVu=@id;
  IF @command=N'create'
  BEGIN
   IF @exists IS NOT NULL THROW 53001,N'Mã dịch vụ đã tồn tại',1;
   INSERT dbo.DichVu(maDichVu,ten,gia,donViTinh,danhMuc,moTa,duongDanAnh,soLuongTonKho,nguongAnToan,dangHoatDong)
   VALUES(@id,@name,@price,@unit,@category,@description,@image,0,@threshold,1);
  END
  ELSE IF @command=N'price'
  BEGIN
   IF @exists IS NULL THROW 53002,N'Không tìm thấy dịch vụ',1;
   IF NOT EXISTS(SELECT 1 FROM dbo.YeuCauPheDuyet WITH(UPDLOCK,HOLDLOCK) WHERE maYeuCauPheDuyet=@approval
    AND maDoiTuong=@id AND hanhDong=N'Thay đổi giá dịch vụ' AND trangThai=N'Đã sử dụng' AND nguoiPheDuyet=@actor
    AND soTien=@price) THROW 52205,N'Cần approval đã consume đúng dịch vụ và giá',1;
   UPDATE dbo.DichVu SET gia=@price WHERE maDichVu=@id;
   INSERT dbo.LichSuGiaDichVu(maDichVu,gia,nguoiThayDoi,maYeuCauPheDuyet,thoiDiemHieuLuc)
    VALUES(@id,@price,@actor,@approval,@now);
  END
  ELSE THROW 51008,N'Lệnh danh mục dịch vụ không hợp lệ',1;
  COMMIT TRANSACTION;
 END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK TRANSACTION;THROW;END CATCH;
END;
GO
