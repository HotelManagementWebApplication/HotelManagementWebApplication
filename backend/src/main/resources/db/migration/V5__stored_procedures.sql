-- V5__stored_procedures.sql

-- =============================================================================
-- Nhân sự: cập nhật hồ sơ độc lập với tài khoản, tiếp nhận phải qua phê duyệt.
-- =============================================================================
CREATE PROCEDURE dbo.uspCapNhatHoSoNhanSu
    @maNhanVien NVARCHAR(10), @duLieu NVARCHAR(MAX), @phienBan BIGINT,
    @nguoiThucHien NVARCHAR(10), @thoiDiem DATETIMEOFFSET(6), @khoiTao BIT=0
AS
BEGIN
    SET NOCOUNT ON; SET XACT_ABORT ON;
    BEGIN TRY
        BEGIN TRANSACTION;
        DECLARE @vaiTro NVARCHAR(30),@khoa INT,@banCu BIGINT;
        SELECT @vaiTro=vaiTro FROM dbo.NhanVien WHERE maNhanVien=@nguoiThucHien AND duocKichHoat=1;
        IF (@khoiTao=0 AND (@vaiTro IS NULL OR @vaiTro<>N'Nhân sự')) OR
           (@khoiTao=1 AND (@vaiTro IS NULL OR @vaiTro NOT IN (N'Quản lý',N'Giám đốc')))
            THROW 53704,N'Không có quyền cập nhật hồ sơ nhân sự',1;
        EXEC @khoa=sys.sp_getapplock @Resource=N'identity-registration',@LockMode=N'Exclusive',@LockOwner=N'Transaction',@LockTimeout=15000;
        IF @khoa<0 THROW 53702,N'Hồ sơ đang được cập nhật. Vui lòng thử lại',1;
        IF NOT EXISTS(SELECT 1 FROM dbo.NhanVien WITH(UPDLOCK,HOLDLOCK) WHERE maNhanVien=@maNhanVien)
            THROW 53701,N'Không tìm thấy nhân viên',1;
        SELECT @banCu=phienBan FROM dbo.HoSoNhanSu WITH(UPDLOCK,HOLDLOCK) WHERE maNhanVien=@maNhanVien;
        IF COALESCE(@banCu,0)<>@phienBan THROW 53702,N'Hồ sơ vừa thay đổi. Hãy tải lại trước khi lưu',1;
        DECLARE @ten NVARCHAR(100)=JSON_VALUE(@duLieu,'$.full_name'),@dienThoai NVARCHAR(15)=JSON_VALUE(@duLieu,'$.phone'),
            @email NVARCHAR(150)=JSON_VALUE(@duLieu,'$.email'),@diaChi NVARCHAR(255)=JSON_VALUE(@duLieu,'$.address'),
            @giayTo NVARCHAR(12)=JSON_VALUE(@duLieu,'$.identity_number'),@ngaySinh DATE=TRY_CONVERT(DATE,JSON_VALUE(@duLieu,'$.birth_date')),
            @ngayVaoLam DATE=TRY_CONVERT(DATE,JSON_VALUE(@duLieu,'$.hire_date')),
            @gioiTinh NVARCHAR(20)=CASE JSON_VALUE(@duLieu,'$.gender') WHEN 'MALE' THEN N'Nam' WHEN 'FEMALE' THEN N'Nữ' WHEN 'OTHER' THEN N'Khác' WHEN 'UNDISCLOSED' THEN N'Không cung cấp' END,
            @hopDong NVARCHAR(20)=CASE JSON_VALUE(@duLieu,'$.contract_type') WHEN 'PROBATION' THEN N'Thử việc' WHEN 'PERMANENT' THEN N'Không thời hạn' WHEN 'FIXED_TERM' THEN N'Có thời hạn' WHEN 'SEASONAL' THEN N'Thời vụ' END;
        IF LEN(LTRIM(RTRIM(COALESCE(@ten,N''))))<2 OR @dienThoai IS NULL
            OR (@ngaySinh IS NOT NULL AND @ngaySinh>=CONVERT(DATE,@thoiDiem AT TIME ZONE 'SE Asia Standard Time'))
            OR (@ngaySinh IS NOT NULL AND @ngayVaoLam IS NOT NULL AND @ngayVaoLam<=@ngaySinh)
            OR (@khoiTao=1 AND (@email IS NULL OR @giayTo IS NULL OR @ngaySinh IS NULL OR @ngayVaoLam IS NULL OR @gioiTinh IS NULL OR @hopDong IS NULL))
            THROW 53708,N'Hồ sơ chưa đủ hoặc có thông tin không hợp lệ',1;
        IF EXISTS(SELECT 1 FROM dbo.NhanVien WITH(UPDLOCK,HOLDLOCK) WHERE soDienThoai=@dienThoai AND maNhanVien<>@maNhanVien)
            OR EXISTS(SELECT 1 FROM dbo.TaiKhoanKhachHang WITH(UPDLOCK,HOLDLOCK) WHERE soDienThoai=@dienThoai)
            THROW 53705,N'Số điện thoại đã được sử dụng',1;
        IF EXISTS(SELECT 1 FROM dbo.HoSoNhanSu WITH(UPDLOCK,HOLDLOCK) WHERE soGiayToTuyThan=@giayTo AND maNhanVien<>@maNhanVien)
            THROW 53706,N'Giấy tờ đã thuộc hồ sơ nhân viên khác',1;
        UPDATE dbo.NhanVien SET hoVaTen=@ten,soDienThoai=@dienThoai,email=@email,diaChi=@diaChi WHERE maNhanVien=@maNhanVien;
        IF @banCu IS NULL
            INSERT dbo.HoSoNhanSu(maNhanVien,gioiTinh,ngaySinh,soGiayToTuyThan,ngayVaoLam,loaiHopDong,phienBan,nguoiCapNhat,thoiDiemCapNhat)
            VALUES(@maNhanVien,@gioiTinh,@ngaySinh,@giayTo,@ngayVaoLam,@hopDong,1,@nguoiThucHien,@thoiDiem);
        ELSE
            UPDATE dbo.HoSoNhanSu SET gioiTinh=@gioiTinh,ngaySinh=@ngaySinh,soGiayToTuyThan=@giayTo,ngayVaoLam=@ngayVaoLam,
                loaiHopDong=@hopDong,phienBan=phienBan+1,nguoiCapNhat=@nguoiThucHien,thoiDiemCapNhat=@thoiDiem WHERE maNhanVien=@maNhanVien;
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT>0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

CREATE PROCEDURE dbo.uspKhoaDeNghiNhanVien @maDeNghi UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;
    SELECT * FROM dbo.DeNghiTiepNhanNhanVien WITH(UPDLOCK,HOLDLOCK) WHERE maDeNghi=@maDeNghi;
END;
GO

CREATE PROCEDURE dbo.uspLenhDeNghiNhanVien
    @lenh NVARCHAR(20),@maDeNghi UNIQUEIDENTIFIER,@duLieuHoSo NVARCHAR(MAX),@vaiTroDeXuat NVARCHAR(30),
    @lyDoQuyetDinh NVARCHAR(500),@phienBan BIGINT,@nguoiThucHien NVARCHAR(10),@maNhanVien NVARCHAR(10),
    @thoiDiem DATETIMEOFFSET(6),@lyDo NVARCHAR(500)
AS
BEGIN
    SET NOCOUNT ON; SET XACT_ABORT ON;
    BEGIN TRY
        BEGIN TRANSACTION;
        DECLARE @vaiTroNguoiGui NVARCHAR(30),@nguoiDeNghi NVARCHAR(10),@trangThai NVARCHAR(20),@banCu BIGINT,@vaiTroCu NVARCHAR(30),@duLieuCu NVARCHAR(MAX),@khoa INT;
        SELECT @vaiTroNguoiGui=vaiTro FROM dbo.NhanVien WHERE maNhanVien=@nguoiThucHien AND duocKichHoat=1;
        SELECT @nguoiDeNghi=nguoiDeNghi,@trangThai=trangThai,@banCu=phienBan,@vaiTroCu=vaiTroDeXuat,@duLieuCu=duLieuHoSo
            FROM dbo.DeNghiTiepNhanNhanVien WITH(UPDLOCK,HOLDLOCK) WHERE maDeNghi=@maDeNghi;
        IF COALESCE(@banCu,0)<>@phienBan THROW 53702,N'Đề nghị vừa thay đổi. Hãy tải lại',1;
        IF @lenh IN(N'save',N'submit')
        BEGIN
            IF @vaiTroNguoiGui IS NULL OR @vaiTroNguoiGui<>N'Nhân sự' OR (@nguoiDeNghi IS NOT NULL AND @nguoiDeNghi<>@nguoiThucHien)
                THROW 53704,N'Chỉ HR tạo đề nghị mới được sửa và gửi duyệt',1;
            IF @trangThai IS NOT NULL AND @trangThai NOT IN(N'Bản nháp',N'Cần bổ sung',N'Bị từ chối')
                THROW 53703,N'Đề nghị đang chờ duyệt hoặc đã được duyệt; không thể sửa',1;
            IF @lenh=N'save'
            BEGIN
                IF @banCu IS NULL
                    INSERT dbo.DeNghiTiepNhanNhanVien(maDeNghi,duLieuHoSo,vaiTroDeXuat,lyDo,nguoiDeNghi,thoiDiemTao)
                    VALUES(@maDeNghi,@duLieuHoSo,@vaiTroDeXuat,@lyDo,@nguoiThucHien,@thoiDiem);
                ELSE
                    UPDATE dbo.DeNghiTiepNhanNhanVien SET duLieuHoSo=@duLieuHoSo,vaiTroDeXuat=@vaiTroDeXuat,lyDo=@lyDo,
                        trangThai=N'Bản nháp',nguoiXetDuyet=NULL,lyDoQuyetDinh=NULL,thoiDiemQuyetDinh=NULL,phienBan=phienBan+1 WHERE maDeNghi=@maDeNghi;
            END
            ELSE
            BEGIN
                IF @banCu IS NULL THROW 53701,N'Phải lưu hồ sơ nháp trước khi gửi duyệt',1;
                DECLARE @dienThoai NVARCHAR(15)=JSON_VALUE(@duLieuCu,'$.phone'),@giayTo NVARCHAR(12)=JSON_VALUE(@duLieuCu,'$.identity_number');
                IF @dienThoai IS NULL OR @giayTo IS NULL OR JSON_VALUE(@duLieuCu,'$.email') IS NULL
                    OR JSON_VALUE(@duLieuCu,'$.gender') IS NULL OR TRY_CONVERT(DATE,JSON_VALUE(@duLieuCu,'$.birth_date')) IS NULL
                    OR TRY_CONVERT(DATE,JSON_VALUE(@duLieuCu,'$.hire_date')) IS NULL OR JSON_VALUE(@duLieuCu,'$.contract_type') IS NULL
                    THROW 53708,N'Phải bổ sung đầy đủ hồ sơ trước khi gửi duyệt',1;
                EXEC @khoa=sys.sp_getapplock @Resource=N'identity-registration',@LockMode=N'Exclusive',@LockOwner=N'Transaction',@LockTimeout=15000;
                IF @khoa<0 THROW 53702,N'Hồ sơ đang được xử lý. Vui lòng thử lại',1;
                IF EXISTS(SELECT 1 FROM dbo.NhanVien WHERE soDienThoai=@dienThoai) OR EXISTS(SELECT 1 FROM dbo.TaiKhoanKhachHang WHERE soDienThoai=@dienThoai)
                    THROW 53705,N'Số điện thoại đã có tài khoản',1;
                IF EXISTS(SELECT 1 FROM dbo.HoSoNhanSu WHERE soGiayToTuyThan=@giayTo) THROW 53706,N'Giấy tờ đã có hồ sơ nhân viên',1;
                IF EXISTS(SELECT 1 FROM dbo.DeNghiTiepNhanNhanVien WHERE maDeNghi<>@maDeNghi AND trangThai=N'Chờ duyệt' AND
                    (JSON_VALUE(duLieuHoSo,'$.phone')=@dienThoai OR JSON_VALUE(duLieuHoSo,'$.identity_number')=@giayTo))
                    THROW 53703,N'Nhân viên này đã có một đề nghị đang chờ duyệt',1;
                UPDATE dbo.DeNghiTiepNhanNhanVien SET trangThai=N'Chờ duyệt',thoiDiemGui=@thoiDiem,nguoiXetDuyet=NULL,lyDoQuyetDinh=NULL,
                    thoiDiemQuyetDinh=NULL,phienBan=phienBan+1 WHERE maDeNghi=@maDeNghi;
            END;
        END
        ELSE IF @lenh IN(N'approve',N'revise',N'reject')
        BEGIN
            IF @banCu IS NULL THROW 53701,N'Không tìm thấy đề nghị',1;
            IF @trangThai<>N'Chờ duyệt' THROW 53703,N'Đề nghị không còn chờ duyệt',1;
            IF @nguoiDeNghi=@nguoiThucHien THROW 53707,N'Không được tự duyệt đề nghị',1;
            IF @vaiTroNguoiGui IS NULL OR @vaiTroNguoiGui NOT IN(N'Quản lý',N'Giám đốc') OR
                (@vaiTroNguoiGui=N'Quản lý' AND @vaiTroCu NOT IN(N'Nhân sự',N'Lễ tân',N'Buồng phòng',N'Kỹ thuật',N'Nhà bếp',N'Kế toán'))
                THROW 53704,N'Vai trò đề xuất vượt quyền xét duyệt',1;
            IF LEN(LTRIM(RTRIM(COALESCE(@lyDoQuyetDinh,N''))))=0 THROW 53708,N'Phải ghi lý do xét duyệt',1;
            IF @lenh=N'approve' AND NOT EXISTS(SELECT 1 FROM dbo.NhanVien WHERE maNhanVien=@maNhanVien AND vaiTro=@vaiTroCu AND soDienThoai=JSON_VALUE(@duLieuCu,'$.phone'))
                THROW 53708,N'Tài khoản cấp phải khớp hồ sơ đã gửi duyệt',1;
            UPDATE dbo.DeNghiTiepNhanNhanVien SET trangThai=CASE @lenh WHEN N'approve' THEN N'Đã duyệt' WHEN N'revise' THEN N'Cần bổ sung' ELSE N'Bị từ chối' END,
                nguoiXetDuyet=@nguoiThucHien,lyDoQuyetDinh=@lyDoQuyetDinh,maNhanVien=CASE WHEN @lenh=N'approve' THEN @maNhanVien END,
                thoiDiemQuyetDinh=@thoiDiem,phienBan=phienBan+1 WHERE maDeNghi=@maDeNghi;
        END
        ELSE THROW 53703,N'Thao tác tiếp nhận không hợp lệ',1;
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT>0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

-- Mỗi đối tượng có một định nghĩa cuối cùng trong file sở hữu.
-- SP ở V5 xử lý lệnh nghiệp vụ; trigger ở V6 bảo vệ tính toàn vẹn dữ liệu.
-- Cách đọc:
--   @lenh chọn nhánh nghiệp vụ; giá trị lệnh giữ nguyên để bên gọi sử dụng.
--   UPDLOCK, HOLDLOCK giữ khóa tới hết giao dịch để kiểm tra và ghi nguyên tử.
--   Khóa chống trùng (idempotency) giúp lần gọi lại không ghi nghiệp vụ hai lần.
--   SP chỉ lấy khóa phải dùng trong giao dịch của bên gọi.
--   TRY/CATCH rollback khi lỗi; THROW trả lỗi gốc cho bên gọi.
-- Mục lục:
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

-- =============================================================================
-- uspTaoDatPhong
-- Tạo đặt phòng, kiểm tra lịch trống và lưu chi tiết phòng cùng nhật ký.
-- =============================================================================
CREATE PROCEDURE dbo.uspTaoDatPhong
    @maKhachLuuTru BIGINT,
    @maNhanVien NVARCHAR(10) = NULL,
    @maTaiKhoanKhachHang BIGINT = NULL,
    @hinhThucThue NVARCHAR(20),
    @tienDatCoc DECIMAL(12, 2),
    @khoaChongTrung NVARCHAR(100),
    @danhSachPhongJson NVARCHAR(MAX),
    @nguoiThucHien NVARCHAR(50),
    @thoiDiemHienTai DATETIME2(6),
    @trangThaiKhoiTao NVARCHAR(30) = N'Bản nháp',
    @phuongThucBaoDam NVARCHAR(20) = NULL,
    @maThanhToan NVARCHAR(40) = NULL,
    @hetHan DATETIME2(6) = NULL,
    @diaChiEmail NVARCHAR(150) = NULL,
    @nguon NVARCHAR(30) = N'Trực tiếp',
    @kiemTraCoc BIT = 0
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;
        IF @thoiDiemHienTai IS NULL
            OR @danhSachPhongJson IS NULL
            OR ISJSON(@danhSachPhongJson) <> 1
            THROW 51008, N'Dữ liệu đặt phòng không hợp lệ', 1;
        IF NOT EXISTS (
            SELECT 1
            FROM dbo.KhachLuuTru
            WHERE maKhachLuuTru = @maKhachLuuTru
        )
            THROW 51001, N'Không tìm thấy khách lưu trú', 1;
        IF @maTaiKhoanKhachHang IS NOT NULL
            AND NOT EXISTS (
                SELECT 1
                FROM dbo.TaiKhoanKhachHang
                WHERE maTaiKhoanKhachHang = @maTaiKhoanKhachHang
                    AND maKhachLuuTru = @maKhachLuuTru
            )
            THROW 53402, N'Không tìm thấy tài khoản khách hàng', 1;

        -- 1. Khóa mã yêu cầu để ngăn hai lần tạo booking dùng chung khóa chống trùng.
        DECLARE @maDaCo BIGINT, @ketQuaKhoaChongTrung INT, @taiNguyenKhoaChongTrung NVARCHAR(255) = N'ReservationCreate:' + @khoaChongTrung;
        EXEC @ketQuaKhoaChongTrung = sys.sp_getapplock @Resource = @taiNguyenKhoaChongTrung,
            @LockMode = N'Exclusive',
            @LockOwner = N'Transaction',
            @LockTimeout = 15000;
        IF @ketQuaKhoaChongTrung < 0
            THROW 51005, N'Không thể khóa idempotency booking', 1;
        SELECT @maDaCo = maPhieuDatPhong
        FROM dbo.PhieuDatPhong
        WHERE khoaChongTrung = @khoaChongTrung;
        IF @maDaCo IS NOT NULL
        BEGIN
            THROW 51005, N'Idempotency key đã dùng cho booking khác', 1;
        END;

        -- 2. Đọc danh sách phòng từ JSON và kiểm tra thời gian/số khách.
        DECLARE @phong TABLE (
            maPhong NVARCHAR(10) PRIMARY KEY,
            thoiDiemNhanPhong DATETIME2(6) NOT NULL,
            thoiDiemTraPhong DATETIME2(6) NOT NULL,
            soLuongKhach INT NOT NULL,
            giaTheoNgayDaChot DECIMAL(12, 2) NULL,
            giaTheoGioDaChot DECIMAL(12, 2) NULL
        );
        INSERT INTO @phong(
            maPhong,
            thoiDiemNhanPhong,
            thoiDiemTraPhong,
            soLuongKhach
        )
        SELECT maPhong,
            thoiDiemNhanPhong,
            thoiDiemTraPhong,
            soLuongKhach
        FROM OPENJSON(@danhSachPhongJson) WITH (
            maPhong NVARCHAR(10) '$.maPhong',
            thoiDiemNhanPhong DATETIME2(6) '$.thoiDiemNhanPhong',
            thoiDiemTraPhong DATETIME2(6) '$.thoiDiemTraPhong',
            soLuongKhach INT '$.soLuongKhach'
        );
        IF NOT EXISTS (
            SELECT 1
            FROM @phong
        )
            OR (
                SELECT COUNT(*)
                FROM @phong
            ) > 3
            THROW 51008, N'Mỗi đặt phòng phải có từ một đến ba phòng', 1;
        IF EXISTS (
            SELECT 1
            FROM @phong
            WHERE thoiDiemNhanPhong >= thoiDiemTraPhong
                OR soLuongKhach <= 0
        )
            THROW 51008, N'Khoảng lưu trú hoặc số khách không hợp lệ', 1;

        -- 3. Khóa từng phòng theo thứ tự mã để hạn chế deadlock giữa các booking.
        DECLARE @maPhongKhoa NVARCHAR(10);
        DECLARE khoaPhong CURSOR LOCAL FAST_FORWARD FOR
            SELECT maPhong
            FROM @phong
            ORDER BY maPhong;
        OPEN khoaPhong;
        FETCH NEXT FROM khoaPhong INTO @maPhongKhoa;
        WHILE @@FETCH_STATUS = 0
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM dbo.Phong WITH (UPDLOCK, HOLDLOCK)
                WHERE maPhong = @maPhongKhoa
            )
                THROW 53403, N'Không tìm thấy phòng', 1;
            IF EXISTS (
                SELECT 1
                FROM dbo.Phong
                WHERE maPhong = @maPhongKhoa
                    AND trangThai IN (N'Đang bảo trì', N'Ngừng sử dụng')
            )
            BEGIN
                CLOSE khoaPhong;
                DEALLOCATE khoaPhong;
                THROW 51002, N'Phòng không ở trạng thái sẵn sàng', 1;
            END;
            FETCH NEXT FROM khoaPhong INTO @maPhongKhoa;
        END;
        CLOSE khoaPhong;
        DEALLOCATE khoaPhong;

        -- Khi tạo mới chưa có booking để khóa. Các lệnh khác khóa booking,
        -- phòng theo mã rồi tới khách; tạo mới cũng khóa khách sau khi khóa phòng.
        DECLARE @khachBiChan BIT;
        SELECT @khachBiChan = biChanDatPhong
        FROM dbo.KhachLuuTru WITH (UPDLOCK, HOLDLOCK)
        WHERE maKhachLuuTru = @maKhachLuuTru;
        IF @khachBiChan IS NULL
            THROW 51001, N'Không tìm thấy khách lưu trú', 1;
        IF @khachBiChan = 1
            THROW 53401, N'Khách hàng đã bị khóa quyền đặt trước', 1;
        IF EXISTS (
            SELECT 1
            FROM @phong
            WHERE dbo.fnKiemTraPhongTrong(maPhong, thoiDiemNhanPhong, thoiDiemTraPhong, @thoiDiemHienTai, NULL) = 0
        )
            THROW 51004, N'Phòng đã có lịch giao nhau', 1;
        IF EXISTS (
            SELECT 1
            FROM @phong phongYeuCau
            JOIN dbo.Phong phong
                ON phong.maPhong = phongYeuCau.maPhong
            JOIN dbo.LoaiPhong loaiPhong
                ON loaiPhong.maLoaiPhong = phong.maLoaiPhong
            WHERE phongYeuCau.soLuongKhach > loaiPhong.soKhachToiDa
        )
            THROW 53404, N'Số khách vượt sức chứa phòng', 1;
        IF @maTaiKhoanKhachHang IS NOT NULL
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM @phong
                WHERE thoiDiemNhanPhong <= @thoiDiemHienTai
            )
                THROW 53405, N'Giờ nhận phòng phải ở tương lai', 1;
            IF EXISTS (
                SELECT 1
                FROM @phong phongYeuCau
                JOIN dbo.Phong phong
                    ON phong.maPhong = phongYeuCau.maPhong
                JOIN dbo.LoaiPhong loaiPhong
                    ON loaiPhong.maLoaiPhong = phong.maLoaiPhong
                WHERE loaiPhong.trangThaiDanhMuc <> N'Đang hoạt động'
            )
                THROW 53406, N'Loại phòng chưa được phê duyệt', 1;
        END;

        -- Chốt giá khi tạo booking. Phòng đã được khóa ở bước trên nên việc
        -- duyệt đổi loại phòng không thể thay giá giữa lúc đọc và lưu booking.
        UPDATE phongYeuCau
        SET giaTheoNgayDaChot = loaiPhong.giaTheoNgay,
            giaTheoGioDaChot = loaiPhong.giaTheoGio
        FROM @phong AS phongYeuCau
        JOIN dbo.Phong AS phong WITH (UPDLOCK, HOLDLOCK)
            ON phong.maPhong = phongYeuCau.maPhong
        JOIN dbo.LoaiPhong AS loaiPhong WITH (HOLDLOCK)
            ON loaiPhong.maLoaiPhong = phong.maLoaiPhong;

        -- 4. Tính tiền cọc từ giá đã chốt cho từng phòng.
        DECLARE @cocBatBuoc DECIMAL(12, 2);
        SELECT @cocBatBuoc = ROUND(SUM(dbo.fnTinhTongTienPhong(phongYeuCau.giaTheoNgayDaChot, phongYeuCau.giaTheoGioDaChot, phongYeuCau.thoiDiemNhanPhong, phongYeuCau.thoiDiemTraPhong, CASE
            WHEN @hinhThucThue = N'Theo giờ' THEN 1
            ELSE 0
        END, 3)) * 0.5, 2)
        FROM @phong phongYeuCau
        ;
        IF @maTaiKhoanKhachHang IS NOT NULL OR @tienDatCoc IS NULL
            SET @tienDatCoc = @cocBatBuoc;
        ELSE IF @kiemTraCoc = 1
            AND @tienDatCoc <> @cocBatBuoc
            THROW 53407, N'Tiền cọc phải bằng 50% giá phòng', 1;

        IF @maTaiKhoanKhachHang IS NOT NULL AND @phuongThucBaoDam <> N'VNPay'
            THROW 53411, N'Khách đặt trên website phải thanh toán cọc VNPay', 1;
        IF @trangThaiKhoiTao = N'Chờ thanh toán'
            AND (@hetHan IS NULL OR @hetHan <= @thoiDiemHienTai OR @tienDatCoc <= 0
                 OR @phuongThucBaoDam IS NULL)
            THROW 53411, N'Yêu cầu thu cọc phải có hạn giữ phòng và số tiền hợp lệ', 1;

        -- 5. Lưu booking và chi tiết các phòng sau khi mọi kiểm tra đã đạt.
        INSERT INTO dbo.PhieuDatPhong(
            maKhachLuuTru,
            maNhanVien,
            maTaiKhoanKhachHang,
            hinhThucThue,
            tienDatCoc,
            khoaChongTrung,
            trangThai,
            thoiDiemDat,
            phuongThucBaoDam,
            maThanhToanDatCoc,
            thoiDiemHetHanThanhToanCoc,
            emailXacNhan,
            nguonDatPhong,
            trangThaiThanhToanCoc
        )
        VALUES (
            @maKhachLuuTru,
            @maNhanVien,
            @maTaiKhoanKhachHang,
            @hinhThucThue,
            @tienDatCoc,
            @khoaChongTrung,
            @trangThaiKhoiTao,
            @thoiDiemHienTai,
            @phuongThucBaoDam,
            @maThanhToan,
            @hetHan,
            @diaChiEmail,
            @nguon,
            CASE
                WHEN @trangThaiKhoiTao = N'Chờ thanh toán' THEN N'Chờ thanh toán'
                WHEN @maTaiKhoanKhachHang IS NULL
                    AND @tienDatCoc > 0 THEN N'Đã thanh toán'
                ELSE N'Không yêu cầu'
            END
        );
        DECLARE @maPhieuDatPhong BIGINT = SCOPE_IDENTITY();
        INSERT INTO dbo.ChiTietDatPhong(
            maPhieuDatPhong,
            maPhong,
            thoiDiemNhanPhong,
            thoiDiemTraPhong,
            thoiDiemTraPhongBanDau,
            giaTheoNgayDaChot,
            giaTheoGioDaChot,
            trangThai,
            soLuongKhach
        )
        SELECT @maPhieuDatPhong,
            maPhong,
            thoiDiemNhanPhong,
            thoiDiemTraPhong,
            thoiDiemTraPhong,
            giaTheoNgayDaChot,
            giaTheoGioDaChot,
            CASE WHEN @trangThaiKhoiTao = N'Bản nháp' THEN N'Bản nháp'
                 WHEN @trangThaiKhoiTao = N'Chờ thanh toán' THEN N'Giữ tạm phòng'
                 ELSE N'Đã giữ phòng' END,
            soLuongKhach
        FROM @phong;

        -- 6. Ghi audit trong cùng giao dịch trước khi trả mã booking.
        INSERT INTO dbo.NhatKyKiemSoat(
            nguoiThucHien,
            hanhDong,
            loaiDoiTuong,
            maDoiTuong,
            duLieuSau,
            khoaLienKet
        )
        VALUES (
            @nguoiThucHien,
            N'RESERVATION_CREATED',
            N'RESERVATION',
            CONVERT(NVARCHAR(100), @maPhieuDatPhong),
            @danhSachPhongJson,
            @khoaChongTrung
        );
        COMMIT TRANSACTION;
        SELECT @maPhieuDatPhong AS maPhieuDatPhong;
    END TRY
    BEGIN CATCH
        IF CURSOR_STATUS('local', 'khoaPhong') >= - 1
        BEGIN
            IF CURSOR_STATUS('local', 'khoaPhong') > - 1
                CLOSE khoaPhong;
            DEALLOCATE khoaPhong;
        END;
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

-- =============================================================================
-- uspLenhThanhToanCocOnline
-- Tạo lần thanh toán VNPay hoặc xử lý kết quả thanh toán tiền cọc.
-- Đặt phòng, hóa đơn, thanh toán, biên lai, bút toán và audit cùng một giao dịch.
-- Bên gọi kiểm tra chữ ký HMAC trước khi gọi SP.
-- =============================================================================
CREATE PROCEDURE dbo.uspLenhThanhToanCocOnline
    @lenh NVARCHAR(20),
    @maPhieuDatPhong BIGINT = NULL,
    @maTaiKhoanKhachHang BIGINT = NULL,
    @maThamChieuDonViThanhToan NVARCHAR(100) = NULL,
    @maYeuCauThanhToan NVARCHAR(40) = NULL,
    @soTien DECIMAL(12, 2) = NULL,
    @maPhanHoi NVARCHAR(10) = NULL,
    @maGiaoDichNhaCungCap NVARCHAR(100) = NULL,
    @maNganHang NVARCHAR(20) = NULL,
    @loaiThe NVARCHAR(20) = NULL,
    @maThamChieu NVARCHAR(100) = NULL,
    @maSuKienBenNgoai NVARCHAR(100) = NULL,
    @phuongThucThanhToan NVARCHAR(30) = NULL,
    @nguoiThucHien NVARCHAR(50),
    @thoiDiemHienTai DATETIME2(6)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;
        DECLARE @maYeuCauThanhToanDaCo BIGINT,
            @trangThai NVARCHAR(20),
            @thoiDiemHetHan DATETIME2(6),
            @soTienDuKien DECIMAL(12, 2),
            @trangThaiDatPhong NVARCHAR(30),
            @trangThaiDatCoc NVARCHAR(20),
            @loaiThayDoiChoXacNhan NVARCHAR(20),
            @maHoaDon BIGINT,
            @maGiaoDichThanhToan BIGINT,
            @maBienLai BIGINT,
            @diaChiEmail NVARCHAR(150),
            @danhSachPhong NVARCHAR(MAX),
            @maThanhToanTruoc BIGINT,
            @ketQuaKhoaSuKien INT,
            @khoaSuKien NVARCHAR(100),
            @soTienYeuCauThanhToan DECIMAL(12, 2);

        -- Preserve verified money reported after a hold expired, without reclaiming a room.
        IF @lenh=N'review'
        BEGIN
            SELECT @maYeuCauThanhToanDaCo=maYeuCauThanhToanVnpay,@maPhieuDatPhong=maPhieuDatPhong,@trangThai=trangThai,@soTienDuKien=soTien
            FROM dbo.YeuCauThanhToanVnpay WITH(UPDLOCK,HOLDLOCK) WHERE maThamChieuMerchant=@maThamChieuDonViThanhToan;
            IF @maYeuCauThanhToanDaCo IS NULL OR @soTien<>@soTienDuKien OR @maPhanHoi<>N'00'
                THROW 53304,N'Thông tin giao dịch cần đối soát không hợp lệ',1;
            IF @trangThai NOT IN(N'Thành công',N'Cần đối soát')
            BEGIN
                UPDATE dbo.YeuCauThanhToanVnpay SET trangThai=N'Cần đối soát',maPhanHoi=@maPhanHoi,
                    maGiaoDichVnpay=@maGiaoDichNhaCungCap,maNganHang=@maNganHang,loaiThe=@loaiThe,
                    thoiDiemHoanTat=@thoiDiemHienTai,phienBan=phienBan+1 WHERE maYeuCauThanhToanVnpay=@maYeuCauThanhToanDaCo;
                DECLARE @noiDungDoiSoat NVARCHAR(MAX)=(SELECT @maPhieuDatPhong reservation_id,@soTien amount,
                    @maThamChieuDonViThanhToan merchant_reference,@maGiaoDichNhaCungCap provider_transaction FOR JSON PATH,WITHOUT_ARRAY_WRAPPER);
                INSERT dbo.HangDoiThongBao(chuDe,vaiTroNguoiNhan,noiDung,trangThai,khoaChongLap,thoiDiemCoTheGui,thoiDiemTao)
                VALUES(N'DEPOSIT_PAYMENT_REVIEW',N'Lễ tân',@noiDungDoiSoat,N'Chờ gửi',N'VNPAY-REVIEW:'+CONVERT(NVARCHAR(20),@maYeuCauThanhToanDaCo),@thoiDiemHienTai,@thoiDiemHienTai);
                INSERT dbo.NhatKyKiemSoat(nguoiThucHien,hanhDong,loaiDoiTuong,maDoiTuong,duLieuSau,lyDo)
                VALUES(N'VNPAY',N'DEPOSIT_PAYMENT_REQUIRES_REVIEW',N'RESERVATION',CONVERT(NVARCHAR(100),@maPhieuDatPhong),@noiDungDoiSoat,N'Không tự xác nhận lại booking không còn nhận cọc');
            END;
            COMMIT TRANSACTION;
            SELECT * FROM dbo.vwYeuCauThanhToanVnpay WHERE maYeuCauThanhToanVnpay=@maYeuCauThanhToanDaCo;
            RETURN;
        END;

        -- Tạo bản ghi mới.
        IF @lenh = N'create'
        BEGIN
            SELECT @trangThaiDatPhong = trangThai,
                @trangThaiDatCoc = trangThaiThanhToanCoc,
                @loaiThayDoiChoXacNhan = loaiThayDoiDangCho,
                @thoiDiemHetHan = thoiDiemHetHanThanhToanCoc,
                @soTienDuKien = CASE
                    WHEN loaiThayDoiDangCho IS NULL THEN tienDatCoc
                    ELSE tienDatCocBoSung
                END
            FROM dbo.PhieuDatPhong WITH (UPDLOCK, HOLDLOCK)
            WHERE maPhieuDatPhong = @maPhieuDatPhong
                AND maTaiKhoanKhachHang = @maTaiKhoanKhachHang
                AND phuongThucBaoDam = N'VNPay';
            IF @trangThaiDatPhong IS NULL
                THROW 53301, N'Không tìm thấy booking', 1;
            IF @trangThaiDatCoc <> N'Chờ thanh toán'
                OR NOT (
                    @trangThaiDatPhong = N'Chờ thanh toán'
                    OR (
                        @loaiThayDoiChoXacNhan IS NOT NULL
                        AND @trangThaiDatPhong IN (N'Đã xác nhận', N'Đã thanh toán cọc')
                    )
                )
                THROW 53302, N'Booking không còn chờ thanh toán cọc', 1;
            IF @thoiDiemHetHan IS NULL
                OR @thoiDiemHetHan <= @thoiDiemHienTai
                THROW 53303, N'Thời gian giữ phòng đã hết', 1;
            SET @soTien = @soTienDuKien;
            IF @maThamChieuDonViThanhToan IS NULL
                OR @soTien <> @soTienDuKien
                THROW 53304, N'Số tiền cọc không khớp booking', 1;
            UPDATE dbo.YeuCauThanhToanVnpay
            SET trangThai = N'Đã hủy', thoiDiemHoanTat = @thoiDiemHienTai, phienBan = phienBan + 1
            WHERE maPhieuDatPhong = @maPhieuDatPhong
                AND trangThai = N'Chờ thanh toán';
            INSERT dbo.YeuCauThanhToanVnpay(
                maPhieuDatPhong,
                maThamChieuMerchant,
                soTien,
                trangThai,
                thoiDiemTao,
                thoiDiemHetHan
            )
            VALUES (
                @maPhieuDatPhong,
                @maThamChieuDonViThanhToan,
                @soTien,
                N'Chờ thanh toán',
                @thoiDiemHienTai,
                @thoiDiemHetHan
            );
            SET @maYeuCauThanhToanDaCo = SCOPE_IDENTITY();
            INSERT dbo.NhatKyKiemSoat(
                nguoiThucHien,
                hanhDong,
                loaiDoiTuong,
                maDoiTuong,
                duLieuSau,
                khoaLienKet
            )
            VALUES (
                @nguoiThucHien,
                N'VNPAY_CHECKOUT_CREATED',
                N'VNPAY_PAYMENT_ATTEMPT',
                CONVERT(NVARCHAR(100), @maYeuCauThanhToanDaCo),
                N'Chờ thanh toán',
                @maThamChieuDonViThanhToan
            );
            COMMIT TRANSACTION;
            SELECT *
            FROM dbo.vwYeuCauThanhToanVnpay
            WHERE maYeuCauThanhToanVnpay = @maYeuCauThanhToanDaCo;
            RETURN;
        END;
        IF @lenh = N'fail'
        BEGIN
            SELECT @maYeuCauThanhToanDaCo = maYeuCauThanhToanVnpay,
                @maPhieuDatPhong = maPhieuDatPhong,
                @trangThai = trangThai
            FROM dbo.YeuCauThanhToanVnpay WITH (UPDLOCK, HOLDLOCK)
            WHERE maThamChieuMerchant = @maThamChieuDonViThanhToan;
            IF @maYeuCauThanhToanDaCo IS NULL
                THROW 53305, N'Không tìm thấy giao dịch VNPay', 1;
            IF @trangThai = N'Chờ thanh toán'
            BEGIN
                UPDATE dbo.YeuCauThanhToanVnpay
                SET trangThai = N'Thất bại',
                    thoiDiemHoanTat = @thoiDiemHienTai,
                    maGiaoDichVnpay = @maGiaoDichNhaCungCap,
                    maNganHang = @maNganHang,
                    loaiThe = @loaiThe,
                    maPhanHoi = @maPhanHoi,
                    phienBan = phienBan + 1
                WHERE maYeuCauThanhToanVnpay = @maYeuCauThanhToanDaCo;
                INSERT dbo.NhatKyKiemSoat(
                    nguoiThucHien,
                    hanhDong,
                    loaiDoiTuong,
                    maDoiTuong,
                    duLieuTruoc,
                    duLieuSau,
                    lyDo
                )
                VALUES (
                    N'VNPAY',
                    N'VNPAY_PAYMENT_FAILED',
                    N'VNPAY_PAYMENT_ATTEMPT',
                    CONVERT(NVARCHAR(100), @maYeuCauThanhToanDaCo),
                    N'Chờ thanh toán',
                    N'Thất bại',
                    @maPhanHoi
                );
            END;
            COMMIT TRANSACTION;
            SELECT *
            FROM dbo.vwYeuCauThanhToanVnpay
            WHERE maYeuCauThanhToanVnpay = @maYeuCauThanhToanDaCo;
            RETURN;
        END;
        IF @lenh <> N'finalize'
            THROW 51008, N'Lệnh thanh toán cọc không hợp lệ', 1;
        IF NULLIF(LTRIM(RTRIM(@maSuKienBenNgoai)), N'') IS NULL
            OR @soTien IS NULL
            OR @soTien <= 0
            THROW 53304, N'Dữ liệu thanh toán cọc không hợp lệ', 1;
        DECLARE @taiNguyenKhoaSuKien NVARCHAR(255) = N'OnlineDeposit:' + @maSuKienBenNgoai;
        EXEC @ketQuaKhoaSuKien = sys.sp_getapplock @Resource = @taiNguyenKhoaSuKien,
            @LockMode = N'Exclusive',
            @LockOwner = N'Transaction',
            @LockTimeout = 15000;
        IF @ketQuaKhoaSuKien < 0
            THROW 53309, N'Không thể khóa sự kiện thanh toán', 1;
        SET @khoaSuKien = N'GW:' + CONVERT(VARCHAR(64), HASHBYTES('SHA2_256', CONCAT(@maThamChieuDonViThanhToan, N'|', @maYeuCauThanhToan, N'|', @soTien, N'|', @maThamChieu, N'|', @phuongThucThanhToan)), 2);
        SELECT @maThanhToanTruoc = maGiaoDichThanhToan,
            @maHoaDon = maHoaDon
        FROM dbo.GiaoDichThanhToan
        WHERE maSuKienBenNgoai = @maSuKienBenNgoai;
        IF @maThanhToanTruoc IS NOT NULL
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM dbo.GiaoDichThanhToan
                WHERE maGiaoDichThanhToan = @maThanhToanTruoc
                    AND khoaChongTrung = @khoaSuKien
            )
                THROW 53310, N'Sự kiện thanh toán đã dùng cho nội dung khác', 1;
            SELECT @maPhieuDatPhong = maPhieuDatPhong
            FROM dbo.HoaDon
            WHERE maHoaDon = @maHoaDon;
            COMMIT TRANSACTION;
            SELECT @maPhieuDatPhong AS maPhieuDatPhong,
                @maThanhToanTruoc AS maGiaoDichThanhToan,
                N'Đã hoàn tất' AS trangThaiThanhToan,
                (
                    SELECT trangThai
                    FROM dbo.PhieuDatPhong
                    WHERE maPhieuDatPhong = @maPhieuDatPhong
                ) AS trangThaiDatPhong,
                CAST(1 AS BIT) AS daXuLy,
                CAST(1 AS BIT) AS lapLai,
                (
                    SELECT COALESCE(phieuDatPhong.emailXacNhan, khachLuuTru.email)
                    FROM dbo.PhieuDatPhong phieuDatPhong
                    JOIN dbo.KhachLuuTru khachLuuTru
                        ON khachLuuTru.maKhachLuuTru = phieuDatPhong.maKhachLuuTru
                    WHERE phieuDatPhong.maPhieuDatPhong = @maPhieuDatPhong
                ) AS email,
                (
                    SELECT STRING_AGG(CONVERT(NVARCHAR(MAX), maPhong), N', ') WITHIN GROUP(
                    ORDER BY maPhong)
                    FROM dbo.ChiTietDatPhong
                    WHERE maPhieuDatPhong = @maPhieuDatPhong
                ) AS phong;
            RETURN;
        END;
        IF @maThamChieuDonViThanhToan IS NOT NULL
        BEGIN
            SELECT @maPhieuDatPhong = maPhieuDatPhong
            FROM dbo.YeuCauThanhToanVnpay
            WHERE maThamChieuMerchant = @maThamChieuDonViThanhToan;
            IF @maPhieuDatPhong IS NULL
                THROW 53305, N'Không tìm thấy giao dịch VNPay', 1;
        END
        ELSE
            SELECT @maPhieuDatPhong = maPhieuDatPhong
            FROM dbo.PhieuDatPhong
            WHERE maThanhToanDatCoc = @maYeuCauThanhToan;
        IF @maPhieuDatPhong IS NULL
            THROW 53306, N'Không tìm thấy mã thanh toán cọc', 1;
        SELECT @trangThaiDatPhong = trangThai,
            @trangThaiDatCoc = trangThaiThanhToanCoc,
            @loaiThayDoiChoXacNhan = loaiThayDoiDangCho,
            @thoiDiemHetHan = thoiDiemHetHanThanhToanCoc,
            @soTienDuKien = CASE
                WHEN loaiThayDoiDangCho IS NULL THEN tienDatCoc
                ELSE tienDatCocBoSung
            END
        FROM dbo.PhieuDatPhong WITH (UPDLOCK, HOLDLOCK)
        WHERE maPhieuDatPhong = @maPhieuDatPhong;
        IF @maThamChieuDonViThanhToan IS NOT NULL
        BEGIN
            SELECT @maYeuCauThanhToanDaCo = maYeuCauThanhToanVnpay,
                @trangThai = trangThai
            FROM dbo.YeuCauThanhToanVnpay WITH (UPDLOCK, HOLDLOCK)
            WHERE maThamChieuMerchant = @maThamChieuDonViThanhToan;
            SELECT @soTienYeuCauThanhToan = soTien
            FROM dbo.YeuCauThanhToanVnpay
            WHERE maYeuCauThanhToanVnpay = @maYeuCauThanhToanDaCo;
            IF @soTien <> @soTienYeuCauThanhToan
                THROW 53304, N'Số tiền giao dịch VNPay không khớp', 1;
            IF @trangThai = N'Thành công'
            BEGIN
                THROW 53310, N'Yêu cầu VNPay đã hoàn tất bằng sự kiện khác', 1;
            END;
            IF @trangThai <> N'Chờ thanh toán'
                THROW 53307, N'Yêu cầu thanh toán không còn hiệu lực', 1;
        END;
        IF @trangThaiDatPhong <> N'Chờ thanh toán' AND @loaiThayDoiChoXacNhan IS NULL
            THROW 53307,N'Booking không còn chờ thanh toán cọc',1;
        IF @trangThaiDatPhong IN (N'Đã hủy', N'Không đến')
            THROW 53307, N'Booking không còn nhận thanh toán cọc', 1;
        IF @trangThaiDatCoc = N'Đã thanh toán'
            THROW 53308, N'Tiền cọc đã được xác nhận', 1;
        IF @thoiDiemHetHan IS NOT NULL
            AND @thoiDiemHetHan <= @thoiDiemHienTai
            THROW 53303, N'Mã thanh toán cọc đã hết hạn', 1;
        IF @soTien IS NULL
            OR @soTien <> @soTienDuKien
            THROW 53304, N'Số tiền cọc không khớp booking', 1;
        -- Serialize payment finalization with every allocator of these rooms.
        DECLARE @phongThanhToan NVARCHAR(10), @phongThanhToanDaKhoa NVARCHAR(10);
        DECLARE khoaPhongThanhToan CURSOR LOCAL FAST_FORWARD FOR
            SELECT maPhong FROM dbo.ChiTietDatPhong WHERE maPhieuDatPhong=@maPhieuDatPhong ORDER BY maPhong;
        OPEN khoaPhongThanhToan;
        FETCH NEXT FROM khoaPhongThanhToan INTO @phongThanhToan;
        WHILE @@FETCH_STATUS=0
        BEGIN
            SELECT @phongThanhToanDaKhoa=maPhong FROM dbo.Phong WITH(UPDLOCK,HOLDLOCK) WHERE maPhong=@phongThanhToan;
            FETCH NEXT FROM khoaPhongThanhToan INTO @phongThanhToan;
        END;
        CLOSE khoaPhongThanhToan;
        DEALLOCATE khoaPhongThanhToan;
        IF EXISTS(SELECT 1 FROM dbo.ChiTietDatPhong WHERE maPhieuDatPhong=@maPhieuDatPhong
            AND dbo.fnKiemTraPhongTrong(maPhong,thoiDiemNhanPhong,thoiDiemTraPhong,@thoiDiemHienTai,@maPhieuDatPhong)=0)
            THROW 51004,N'Phòng không còn khả dụng để xác nhận cọc',1;
        SELECT @maHoaDon = maHoaDon
        FROM dbo.HoaDon WITH (UPDLOCK, HOLDLOCK)
        WHERE maPhieuDatPhong = @maPhieuDatPhong;
        IF @maHoaDon IS NULL
        BEGIN
            INSERT dbo.HoaDon(
                maPhieuDatPhong,
                thoiDiemPhatHanh,
                tienDatCocDaTra,
                soTienPhaiTra,
                trangThai,
                phuongThucThanhToan
            )
            VALUES (
                @maPhieuDatPhong,
                @thoiDiemHienTai,
                @soTien,
                0,
                N'Dự kiến',
                @phuongThucThanhToan
            );
            SET @maHoaDon = SCOPE_IDENTITY();
        END
        ELSE
            UPDATE dbo.HoaDon
            SET tienDatCocDaTra = CASE
                WHEN @loaiThayDoiChoXacNhan IS NULL THEN @soTien
                ELSE tienDatCocDaTra + @soTien
            END,
                soTienPhaiTra = 0,
                trangThai = N'Dự kiến',
                phuongThucThanhToan = @phuongThucThanhToan,
                phienBan = phienBan + 1
            WHERE maHoaDon = @maHoaDon;
        INSERT dbo.GiaoDichThanhToan(
            maHoaDon,
            soTien,
            phuongThuc,
            loai,
            trangThai,
            maThamChieu,
            thoiDiemPhatSinh,
            maNguoiThucHien,
            khoaChongTrung,
            maSuKienBenNgoai
        )
        VALUES (
            @maHoaDon,
            @soTien,
            @phuongThucThanhToan,
            N'Thanh toán',
            N'Đã hoàn tất',
            @maThamChieu,
            @thoiDiemHienTai,
            @nguoiThucHien,
            @khoaSuKien,
            @maSuKienBenNgoai
        );
        SET @maGiaoDichThanhToan = SCOPE_IDENTITY();
        DECLARE @soBienLai NVARCHAR(40) = CASE
            WHEN @loaiThayDoiChoXacNhan IS NULL THEN N'DEP-VNPAY-' + CONVERT(NVARCHAR(20), @maPhieuDatPhong)
            ELSE N'DEP-VNPAY-' + CONVERT(NVARCHAR(20), @maPhieuDatPhong) + N'-' + CONVERT(NVARCHAR(20), @maGiaoDichThanhToan)
        END;
        INSERT dbo.BienLai(
            soBienLai,
            maHoaDon,
            soTien,
            phuongThuc,
            thoiDiemPhatHanh,
            nguoiPhatHanh
        )
        VALUES (
            @soBienLai,
            @maHoaDon,
            @soTien,
            @phuongThucThanhToan,
            @thoiDiemHienTai,
            @nguoiThucHien
        );
        SET @maBienLai = SCOPE_IDENTITY();
        INSERT dbo.ButToanTaiChinh(
            loaiButToan,
            loaiNguon,
            maNguon,
            chieuButToan,
            soTien,
            maNguoiThucHien,
            thoiDiemPhatSinh,
            ghiChu,
            daChotSo
        )
        VALUES (
            N'PAYMENT_RECEIVED',
            N'PAYMENT_TRANSACTION',
            CONVERT(NVARCHAR(100), @maGiaoDichThanhToan),
            N'Ghi nợ',
            @soTien,
            @nguoiThucHien,
            @thoiDiemHienTai,
            N'DEPOSIT',
            1
        ),
        (
            N'RECEIPT_ISSUED',
            N'RECEIPT',
            CONVERT(NVARCHAR(100), @maBienLai),
            N'Ghi nợ',
            @soTien,
            @nguoiThucHien,
            @thoiDiemHienTai,
            @phuongThucThanhToan,
            1
        );
        IF @trangThaiDatPhong = N'Chờ thanh toán'
            SET @trangThaiDatPhong = N'Đã thanh toán cọc';
        UPDATE dbo.PhieuDatPhong
        SET trangThai = @trangThaiDatPhong,
            trangThaiThanhToanCoc = N'Đã thanh toán',
            soPhutGiaHan = CASE
                WHEN @loaiThayDoiChoXacNhan IS NULL THEN soPhutGiaHan
                ELSE soPhutGiaHan + DATEDIFF(MINUTE, thoiDiemTraPhongTruocThayDoi,(
                    SELECT MAX(thoiDiemTraPhong)
                    FROM dbo.ChiTietDatPhong
                    WHERE maPhieuDatPhong = @maPhieuDatPhong
                ))
            END,
            maThanhToanDatCoc = CASE
                WHEN @loaiThayDoiChoXacNhan IS NULL THEN maThanhToanDatCoc
                ELSE NULL
            END,
            thoiDiemHetHanThanhToanCoc = CASE
                WHEN @loaiThayDoiChoXacNhan IS NULL THEN thoiDiemHetHanThanhToanCoc
                ELSE NULL
            END,
            loaiThayDoiDangCho = NULL,
            thoiDiemNhanPhongTruocThayDoi = NULL,
            thoiDiemTraPhongTruocThayDoi = NULL,
            tienDatCocTruocThayDoi = NULL,
            tienDatCocBoSung = 0,
            phienBan = phienBan + 1
        WHERE maPhieuDatPhong = @maPhieuDatPhong;
        UPDATE dbo.ChiTietDatPhong SET trangThai=N'Đã giữ phòng'
        WHERE maPhieuDatPhong=@maPhieuDatPhong AND trangThai=N'Giữ tạm phòng';
        IF @maYeuCauThanhToanDaCo IS NOT NULL
        BEGIN
            UPDATE dbo.YeuCauThanhToanVnpay
            SET trangThai = N'Thành công',
                thoiDiemHoanTat = @thoiDiemHienTai,
                maGiaoDichVnpay = @maGiaoDichNhaCungCap,
                maNganHang = @maNganHang,
                loaiThe = @loaiThe,
                maPhanHoi = @maPhanHoi,
                phienBan = phienBan + 1
            WHERE maYeuCauThanhToanVnpay = @maYeuCauThanhToanDaCo;
            UPDATE dbo.YeuCauThanhToanVnpay
            SET trangThai = N'Đã hủy', thoiDiemHoanTat = @thoiDiemHienTai, phienBan = phienBan + 1
            WHERE maPhieuDatPhong = @maPhieuDatPhong
                AND maYeuCauThanhToanVnpay <> @maYeuCauThanhToanDaCo
                AND trangThai = N'Chờ thanh toán';
        END;
        INSERT dbo.NhatKyKiemSoat(
            nguoiThucHien,
            hanhDong,
            loaiDoiTuong,
            maDoiTuong,
            duLieuTruoc,
            duLieuSau,
            khoaLienKet
        )
        VALUES (
            @nguoiThucHien,
            CASE
                WHEN @loaiThayDoiChoXacNhan IS NULL THEN N'DEPOSIT_PAYMENT_CONFIRMED'
                ELSE N'EXTENSION_DEPOSIT_PAYMENT_CONFIRMED'
            END,
            N'RESERVATION',
            CONVERT(NVARCHAR(100), @maPhieuDatPhong),
            N'Chờ thanh toán',
            N'Đã thanh toán',
            @maSuKienBenNgoai
        );
        SELECT @diaChiEmail = COALESCE(phieuDatPhong.emailXacNhan, khachLuuTru.email)
        FROM dbo.PhieuDatPhong phieuDatPhong
        JOIN dbo.KhachLuuTru khachLuuTru
            ON khachLuuTru.maKhachLuuTru = phieuDatPhong.maKhachLuuTru
        WHERE phieuDatPhong.maPhieuDatPhong = @maPhieuDatPhong;
        SELECT @danhSachPhong = STRING_AGG(CONVERT(NVARCHAR(MAX), maPhong), N', ') WITHIN GROUP(
        ORDER BY maPhong)
        FROM dbo.ChiTietDatPhong
        WHERE maPhieuDatPhong = @maPhieuDatPhong;
        COMMIT TRANSACTION;
        SELECT @maPhieuDatPhong AS maPhieuDatPhong,
            @maGiaoDichThanhToan AS maGiaoDichThanhToan,
            N'Đã hoàn tất' AS trangThaiThanhToan,
            @trangThaiDatPhong AS trangThaiDatPhong,
            CAST(1 AS BIT) AS daXuLy,
            CAST(0 AS BIT) AS lapLai,
            @diaChiEmail AS email,
            @danhSachPhong AS phong;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

-- =============================================================================
-- uspKhoaHoaDon
-- Khóa hóa đơn trong giao dịch của bên gọi để tuần tự hóa việc thu/hoàn tiền.
-- =============================================================================
CREATE PROCEDURE dbo.uspKhoaHoaDon
    @maHoaDon BIGINT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT maHoaDon
    FROM dbo.HoaDon WITH (UPDLOCK, HOLDLOCK)
    WHERE maHoaDon = @maHoaDon;
END;
GO

-- =============================================================================
-- uspLenhGiaoDichThanhToan
-- Thu tiền hoặc hoàn tiền; cập nhật bút toán và số dư hóa đơn.
-- Khóa hóa đơn trước; phê duyệt hoàn tiền phải khớp yêu cầu đã được sử dụng.
-- =============================================================================
CREATE PROCEDURE dbo.uspLenhGiaoDichThanhToan
    @lenh NVARCHAR(20),
    @maHoaDon BIGINT,
    @soTien DECIMAL(38, 6),
    @phuongThucThanhToan NVARCHAR(MAX),
    @maThamChieu NVARCHAR(MAX),
    @khoaChongTrung NVARCHAR(MAX),
    @nguoiThucHien NVARCHAR(MAX),
    @maPheDuyet BIGINT,
    @thoiDiemHienTai DATETIME2(6)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;
        DECLARE @soDuPhaiThu DECIMAL(19, 2),
            @maGiaoDichThanhToan BIGINT,
            @maThanhToanGoc BIGINT,
            @phuongThucThanhToanGoc NVARCHAR(30),
            @soTienRong DECIMAL(19, 2),
            @ketQuaKhoaTienMat INT,
            @thoiDiemTao BIT = 0;
        -- Các biến động quỹ tiền mặt phải dùng chung khóa với chi phí, công nợ và bàn giao.
        -- Điều này làm cho kiểm tra số dư và ghi nhận thu/hoàn tiền là một thao tác tuần tự.
        IF @phuongThucThanhToan = N'Tiền mặt'
        BEGIN
            EXEC @ketQuaKhoaTienMat = sys.sp_getapplock
                @Resource = N'finance-cash-custody',
                @LockMode = 'Exclusive',
                @LockOwner = 'Transaction',
                @LockTimeout = 15000;
            IF @ketQuaKhoaTienMat < 0
                THROW 52310, N'Không lấy được khóa quỹ', 1;
        END;
        SELECT @soDuPhaiThu = dbo.fnTinhSoDuHoaDon(maHoaDon)
        FROM dbo.HoaDon WITH (UPDLOCK, HOLDLOCK)
        WHERE maHoaDon = @maHoaDon;
        IF @soDuPhaiThu IS NULL
            THROW 53101, N'Không tìm thấy hóa đơn', 1;
        SELECT @maGiaoDichThanhToan = maGiaoDichThanhToan
        FROM dbo.GiaoDichThanhToan WITH (UPDLOCK, HOLDLOCK)
        WHERE khoaChongTrung = @khoaChongTrung;
        IF @maGiaoDichThanhToan IS NULL
        BEGIN
            IF @soTien <= 0
                THROW 53102, N'Số tiền giao dịch phải lớn hơn 0', 1;

            -- Thu tiền trong giới hạn số dư hóa đơn.
            IF @lenh = N'payment'
            BEGIN
                IF @soTien > @soDuPhaiThu
                    THROW 53103, N'Số tiền thu vượt số dư hóa đơn', 1;
                INSERT dbo.GiaoDichThanhToan(
                    maHoaDon,
                    soTien,
                    phuongThuc,
                    loai,
                    trangThai,
                    maThamChieu,
                    thoiDiemPhatSinh,
                    maNguoiThucHien,
                    khoaChongTrung
                )
                VALUES (
                    @maHoaDon,
                    @soTien,
                    @phuongThucThanhToan,
                    N'Thanh toán',
                    N'Đã hoàn tất',
                    @maThamChieu,
                    @thoiDiemHienTai,
                    @nguoiThucHien,
                    @khoaChongTrung
                );
            END

            -- Hoàn tiền từ giao dịch gốc sau khi kiểm tra phê duyệt.
            ELSE IF @lenh = N'refund'
            BEGIN
                IF NOT EXISTS (
                    SELECT 1
                    FROM dbo.YeuCauPheDuyet WITH (UPDLOCK, HOLDLOCK)
                    WHERE maYeuCauPheDuyet = @maPheDuyet
                        AND hanhDong = N'Hoàn tiền thanh toán'
                        AND maDoiTuong = CONVERT(NVARCHAR(100), @maHoaDon)
                        AND nguoiYeuCau = @nguoiThucHien
                        AND trangThai = N'Đã sử dụng'
                        AND soTien = @soTien
                )
                    THROW 52205, N'Cần approval hoàn tiền đã consume đúng yêu cầu', 1;
                SELECT @soTienRong = COALESCE(SUM(CASE
                    WHEN loai = N'Thanh toán' THEN soTien
                    WHEN loai = N'Hoàn tiền' THEN - soTien
                    ELSE 0
                END), 0)
                FROM dbo.GiaoDichThanhToan WITH (UPDLOCK, HOLDLOCK)
                WHERE maHoaDon = @maHoaDon
                    AND trangThai = N'Đã hoàn tất';
                IF @soTien > @soTienRong
                    THROW 53104, N'Số tiền hoàn vượt số tiền đã thu', 1;
                SELECT TOP(1) @maThanhToanGoc = thanhToanGoc.maGiaoDichThanhToan,
                    @phuongThucThanhToanGoc = thanhToanGoc.phuongThuc
                FROM dbo.GiaoDichThanhToan thanhToanGoc WITH (UPDLOCK, HOLDLOCK)
                WHERE thanhToanGoc.maHoaDon = @maHoaDon
                    AND thanhToanGoc.loai = N'Thanh toán'
                    AND thanhToanGoc.trangThai = N'Đã hoàn tất'
                    AND thanhToanGoc.phuongThuc = @phuongThucThanhToan
                    AND thanhToanGoc.soTien - COALESCE((
                        SELECT SUM(hoanTien.soTien)
                        FROM dbo.GiaoDichThanhToan hoanTien
                        WHERE hoanTien.maHoaDon = @maHoaDon
                            AND hoanTien.loai = N'Hoàn tiền'
                            AND hoanTien.trangThai = N'Đã hoàn tất'
                            AND hoanTien.maThamChieu LIKE N'REFUND_OF:' + CONVERT(NVARCHAR(30), thanhToanGoc.maGiaoDichThanhToan) + N':%'
                    ), 0) >= @soTien
                ORDER BY thanhToanGoc.thoiDiemPhatSinh, thanhToanGoc.maGiaoDichThanhToan;
                IF @maThanhToanGoc IS NULL
                    THROW 53105, N'Không tìm thấy giao dịch gốc để hoàn tiền', 1;
                IF @phuongThucThanhToanGoc = N'Tiền mặt'
                    AND dbo.fnSoDuTienMatNhanVien(@nguoiThucHien, @thoiDiemHienTai) < @soTien
                    THROW 52315, N'Số dư tiền mặt đang giữ không đủ để hoàn tiền', 1;
                INSERT dbo.GiaoDichThanhToan(
                    maHoaDon,
                    soTien,
                    phuongThuc,
                    loai,
                    trangThai,
                    maThamChieu,
                    thoiDiemPhatSinh,
                    maNguoiThucHien,
                    khoaChongTrung
                )
                VALUES (
                    @maHoaDon,
                    @soTien,
                    @phuongThucThanhToanGoc,
                    N'Hoàn tiền',
                    N'Đã hoàn tất',
                    N'REFUND_OF:' + CONVERT(NVARCHAR(30), @maThanhToanGoc) + N':' + @maThamChieu,
                    @thoiDiemHienTai,
                    @nguoiThucHien,
                    @khoaChongTrung
                );
            END
            ELSE
                THROW 51008, N'Lệnh giao dịch không hợp lệ', 1;
            SET @maGiaoDichThanhToan = SCOPE_IDENTITY();
            SET @thoiDiemTao = 1;
            INSERT dbo.ButToanTaiChinh(
                loaiButToan,
                loaiNguon,
                maNguon,
                chieuButToan,
                soTien,
                maNguoiThucHien,
                thoiDiemPhatSinh,
                ghiChu,
                daChotSo
            )
            VALUES (
                CASE
                    WHEN @lenh = N'payment' THEN N'PAYMENT_RECEIVED'
                    ELSE N'REFUND_ISSUED'
                END,
                N'PAYMENT_TRANSACTION',
                CONVERT(NVARCHAR(100), @maGiaoDichThanhToan),
                CASE
                    WHEN @lenh = N'payment' THEN N'Ghi nợ'
                    ELSE N'Ghi có'
                END,
                @soTien,
                @nguoiThucHien,
                @thoiDiemHienTai,
                COALESCE(@maThamChieu, N''),
                1
            );
        END;
        SET @soDuPhaiThu = dbo.fnTinhSoDuHoaDon(@maHoaDon);
        UPDATE dbo.HoaDon
        SET soTienPhaiTra = @soDuPhaiThu,
            trangThai = CASE
                WHEN @soDuPhaiThu = 0 THEN N'Đã thanh toán'
                ELSE N'Chưa thanh toán'
            END,
            phuongThucThanhToan = COALESCE(@phuongThucThanhToanGoc, @phuongThucThanhToan),
            phienBan = phienBan + @thoiDiemTao
        WHERE maHoaDon = @maHoaDon;
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

-- =============================================================================
-- uspLenhHoaDon
-- Xử lý cọc, checkout, điều chỉnh hóa đơn và hoàn cọc theo từng lệnh.
-- =============================================================================
CREATE PROCEDURE dbo.uspLenhHoaDon
    @lenh NVARCHAR(30),
    @maPhieuDatPhong BIGINT = NULL,
    @maHoaDon BIGINT = NULL,
    @thoiDiemThaoTac DATETIME2(6) = NULL,
    @phuongThucThanhToan NVARCHAR(30) = NULL,
    @soTienDieuChinh DECIMAL(12, 2) = NULL,
    @lyDo NVARCHAR(500) = NULL,
    @khoaChongTrung NVARCHAR(100) = NULL,
    @nguoiThucHien NVARCHAR(50),
    @maPheDuyet BIGINT = NULL,
    @maBamYeuCau NVARCHAR(64) = NULL,
    @maTaiKhoanKhachHang BIGINT = NULL,
    @thoiDiemHienTai DATETIME2(6)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;
        DECLARE @trangThaiDatPhong NVARCHAR(30),
            @tienDatCoc DECIMAL(12, 2),
            @maKhachLuuTru BIGINT,
            @thoiDiemNhanPhongThucTe DATETIME2(6),
            @hinhThucThue NVARCHAR(20),
            @tongTienPhong DECIMAL(19, 2) = 0,
            @tongTienGiaHan DECIMAL(19, 2) = 0,
            @phuThuTraMuon DECIMAL(19, 2) = 0,
            @tongTienDichVu DECIMAL(19, 2) = 0,
            @tongTienBoiThuong DECIMAL(19, 2) = 0,
            @soTienGiamGia DECIMAL(19, 2) = 0,
            @tongTienHoaDon DECIMAL(19, 2),
            @soDuPhaiThu DECIMAL(19, 2),
            @hangThanhVien NVARCHAR(20),
            @hangThanhVienMoi NVARCHAR(20),
            @maThanhToanGoc BIGINT,
            @maGiaoDichThanhToan BIGINT,
            @maBienLai BIGINT,
            @soTienThanhToanGoc DECIMAL(12, 2),
            @phuongThucThanhToanGoc NVARCHAR(30),
            @maPhongDaKhoa NVARCHAR(10),
            @maHoaDonDaKhoa BIGINT,
            @tienCocMatCanHoan DECIMAL(19, 2) = 0,
            @ketQuaKhoaTienMat INT;
        -- Khóa quỹ trước khi khóa hóa đơn, cùng thứ tự với mọi lệnh tiền mặt.
        -- Tránh deadlock giữa hoàn cọc (invoice → cash) và thu/hoàn tiền (cash → invoice).
        IF @lenh IN (N'refund-deposit', N'cancel-refund')
        BEGIN
            EXEC @ketQuaKhoaTienMat = sys.sp_getapplock
                @Resource = N'finance-cash-custody',
                @LockMode = 'Exclusive',
                @LockOwner = 'Transaction',
                @LockTimeout = 15000;
            IF @ketQuaKhoaTienMat < 0
                THROW 52310, N'Không khóa được số dư tiền mặt đang giữ', 1;
        END;
        IF @lenh IN (N'deposit', N'checkout')
        BEGIN
            SELECT @trangThaiDatPhong = trangThai,
                @tienDatCoc = tienDatCoc,
                @maKhachLuuTru = maKhachLuuTru,
                @thoiDiemNhanPhongThucTe = thoiDiemNhanPhongThucTe,
                @hinhThucThue = hinhThucThue
            FROM dbo.PhieuDatPhong WITH (UPDLOCK, HOLDLOCK)
            WHERE maPhieuDatPhong = @maPhieuDatPhong;
            IF @trangThaiDatPhong IS NULL
                THROW 53408, N'Không tìm thấy đặt phòng', 1;
            SELECT @maHoaDon = maHoaDon
            FROM dbo.HoaDon WITH (UPDLOCK, HOLDLOCK)
            WHERE maPhieuDatPhong = @maPhieuDatPhong;
            IF @lenh = N'deposit'
                AND @tienDatCoc <= 0
            BEGIN
                COMMIT TRANSACTION;
                RETURN;
            END;
            IF @lenh = N'deposit' AND EXISTS (
                SELECT 1
                FROM dbo.GiaoDichThanhToan
                WHERE maHoaDon = @maHoaDon
                    AND loai = N'Thanh toán'
                    AND (
                        maThamChieu LIKE N'DEPOSIT:%'
                        OR (
                            maSuKienBenNgoai IS NOT NULL
                            AND maSuKienBenNgoai NOT LIKE N'SVC:%'
                        )
                    )
            )
            BEGIN
                COMMIT TRANSACTION;
                RETURN;
            END;
            IF @maHoaDon IS NULL
            BEGIN
                INSERT dbo.HoaDon(maPhieuDatPhong, thoiDiemPhatHanh, trangThai)
                VALUES (@maPhieuDatPhong, @thoiDiemHienTai, N'Dự kiến');
                SET @maHoaDon = SCOPE_IDENTITY();
            END;
        END
        ELSE
        BEGIN
            SELECT @maHoaDonDaKhoa = maHoaDon,
                @maPhieuDatPhong = maPhieuDatPhong
            FROM dbo.HoaDon WITH (UPDLOCK, HOLDLOCK)
            WHERE maHoaDon = @maHoaDon;
            IF @maHoaDonDaKhoa IS NULL
                THROW 53101, N'Không tìm thấy hóa đơn', 1;
        END;

        -- Ghi nhận tiền cọc.
        IF @lenh = N'deposit'
        BEGIN
            IF NOT EXISTS(SELECT 1 FROM dbo.PhieuDatPhong WHERE maPhieuDatPhong=@maPhieuDatPhong AND trangThai=N'Đã thanh toán cọc' AND phuongThucBaoDam=N'Tại khách sạn')
                THROW 53411,N'Chưa xác nhận thực thu cọc tiền mặt tại quầy',1;
            INSERT dbo.GiaoDichThanhToan(
                maHoaDon,
                soTien,
                phuongThuc,
                loai,
                trangThai,
                maThamChieu,
                thoiDiemPhatSinh,
                maNguoiThucHien,
                khoaChongTrung
            )
            VALUES (
                @maHoaDon,
                @tienDatCoc,
                N'Tiền mặt',
                N'Thanh toán',
                N'Đã hoàn tất',
                N'DEPOSIT:' + CONVERT(NVARCHAR(20), @maPhieuDatPhong),
                @thoiDiemHienTai,
                @nguoiThucHien,
                N'DEPOSIT:' + CONVERT(NVARCHAR(20), @maPhieuDatPhong)
            );
            SET @maGiaoDichThanhToan = SCOPE_IDENTITY();
            INSERT dbo.BienLai(
                soBienLai,
                maHoaDon,
                soTien,
                phuongThuc,
                thoiDiemPhatHanh,
                nguoiPhatHanh
            )
            VALUES (
                N'DEP-' + CONVERT(NVARCHAR(20), @maPhieuDatPhong),
                @maHoaDon,
                @tienDatCoc,
                N'Tiền mặt',
                @thoiDiemHienTai,
                @nguoiThucHien
            );
            SET @maBienLai = SCOPE_IDENTITY();
            INSERT dbo.ButToanTaiChinh(
                loaiButToan,
                loaiNguon,
                maNguon,
                chieuButToan,
                soTien,
                maNguoiThucHien,
                thoiDiemPhatSinh,
                ghiChu,
                daChotSo
            )
            VALUES (
                N'PAYMENT_RECEIVED',
                N'PAYMENT_TRANSACTION',
                CONVERT(NVARCHAR(100), @maGiaoDichThanhToan),
                N'Ghi nợ',
                @tienDatCoc,
                @nguoiThucHien,
                @thoiDiemHienTai,
                N'DEPOSIT',
                1
            ),
            (
                N'RECEIPT_ISSUED',
                N'RECEIPT',
                CONVERT(NVARCHAR(100), @maBienLai),
                N'Ghi nợ',
                @tienDatCoc,
                @nguoiThucHien,
                @thoiDiemHienTai,
                N'Tiền mặt',
                1
            );
            UPDATE dbo.HoaDon
            SET tienDatCocDaTra = @tienDatCoc,
                phuongThucThanhToan = N'Tiền mặt',
                trangThai = N'Dự kiến',
                phienBan = phienBan + 1
            WHERE maHoaDon = @maHoaDon;
            UPDATE dbo.PhieuDatPhong
            SET trangThaiThanhToanCoc = N'Đã thanh toán',
                maThanhToanDatCoc = NULL,
                thoiDiemHetHanThanhToanCoc = NULL,
                phienBan = phienBan + 1
            WHERE maPhieuDatPhong = @maPhieuDatPhong;
            INSERT dbo.NhatKyKiemSoat(
                nguoiThucHien,
                hanhDong,
                loaiDoiTuong,
                maDoiTuong,
                duLieuSau
            )
            VALUES (
                @nguoiThucHien,
                N'DEPOSIT_PAYMENT_RECORDED',
                N'PAYMENT_TRANSACTION',
                CONVERT(NVARCHAR(100), @maGiaoDichThanhToan),
                CONVERT(NVARCHAR(30), @tienDatCoc)
            );
        END

        -- Tính tiền, cập nhật lưu trú và ghi nhận doanh thu khi trả phòng.
        ELSE IF @lenh = N'checkout'
        BEGIN
            IF @trangThaiDatPhong <> N'Đã nhận phòng'
                THROW 53410, N'Chỉ được checkout booking đang ở', 1;
            IF @thoiDiemThaoTac IS NULL
                OR @thoiDiemNhanPhongThucTe IS NULL
                OR @thoiDiemThaoTac <= @thoiDiemNhanPhongThucTe
                THROW 53501, N'Giờ trả phải sau giờ nhận thực tế', 1;
            -- Khóa phòng theo mã rồi khóa khách trước khi tính tiền checkout.
            DECLARE duyetPhongTra CURSOR LOCAL FAST_FORWARD FOR
                SELECT maPhong
                FROM dbo.ChiTietDatPhong
                WHERE maPhieuDatPhong = @maPhieuDatPhong
                ORDER BY maPhong;
            OPEN duyetPhongTra;
            FETCH NEXT FROM duyetPhongTra INTO @maPhongDaKhoa;
            WHILE @@FETCH_STATUS = 0
            BEGIN
                SELECT @maPhongDaKhoa = maPhong
                FROM dbo.Phong WITH (UPDLOCK, HOLDLOCK)
                WHERE maPhong = @maPhongDaKhoa;
                FETCH NEXT FROM duyetPhongTra INTO @maPhongDaKhoa;
            END;
            CLOSE duyetPhongTra;
            DEALLOCATE duyetPhongTra;
            SELECT @hangThanhVien = hangThanhVien
            FROM dbo.KhachLuuTru WITH (UPDLOCK, HOLDLOCK)
            WHERE maKhachLuuTru = @maKhachLuuTru;

            -- Khôi phục giờ bắt đầu gốc riêng cho từng phòng đang dùng.
            -- Lịch sử chuyển phòng là một chuỗi; không lấy MIN toàn booking vì
            -- các phòng trong cùng booking có thể có giờ nhận khác nhau.
            DECLARE @gioBatDauGoc TABLE (
                maPhong NVARCHAR(10) PRIMARY KEY,
                thoiDiemNhanPhong DATETIME2(6) NOT NULL
            );
            ;WITH roomStartChain AS (
                SELECT chiTiet.maPhieuDatPhong,
                    chiTiet.maPhong AS maPhongHienTai,
                    chiTiet.maPhong AS maPhongNguoc,
                    chiTiet.thoiDiemNhanPhong AS thoiDiemBatDau,
                    chiTiet.thoiDiemNhanPhong AS thoiDiemBatDauDoan
                FROM dbo.ChiTietDatPhong chiTiet
                WHERE chiTiet.maPhieuDatPhong = @maPhieuDatPhong
                    AND chiTiet.trangThai = N'Đang có khách'
                UNION ALL
                SELECT chuoi.maPhieuDatPhong,
                    chuoi.maPhongHienTai,
                    chiTietCu.maPhong,
                    chiTietCu.thoiDiemNhanPhong,
                    chuoi.thoiDiemBatDauDoan
                FROM roomStartChain chuoi
                JOIN dbo.ChuyenPhong chuyen
                    ON chuyen.maPhieuDatPhong = chuoi.maPhieuDatPhong
                    AND chuyen.maPhongMoi = chuoi.maPhongNguoc
                    AND chuyen.thoiDiemChuyenPhong = chuoi.thoiDiemBatDauDoan
                JOIN dbo.ChiTietDatPhong chiTietCu
                    ON chiTietCu.maPhieuDatPhong = chuoi.maPhieuDatPhong
                    AND chiTietCu.maPhong = chuyen.maPhongCu
            )
            INSERT @gioBatDauGoc(maPhong, thoiDiemNhanPhong)
            SELECT maPhongHienTai, MIN(thoiDiemBatDau)
            FROM roomStartChain
            GROUP BY maPhongHienTai
            OPTION (MAXRECURSION 1000);

            -- Tách tiền phòng gốc, tiền gia hạn và phụ thu trả muộn; chưa trừ giảm giá VIP.
            SELECT @tongTienPhong = COALESCE(SUM(CASE
                WHEN chiTiet.thoiDiemTraPhongBanDau > gioGoc.thoiDiemNhanPhong THEN dbo.fnTinhTongTienPhong(COALESCE(chiTiet.giaTheoNgayDaChot, loaiPhong.giaTheoNgay), COALESCE(chiTiet.giaTheoGioDaChot, loaiPhong.giaTheoGio), gioGoc.thoiDiemNhanPhong, chiTiet.thoiDiemTraPhongBanDau, CASE
                    WHEN @hinhThucThue = N'Theo giờ' THEN 1
                    ELSE 0
                END, 3)
                ELSE 0
            END), 0),
                @tongTienGiaHan = COALESCE(SUM(ROUND(COALESCE(chiTiet.giaTheoNgayDaChot, loaiPhong.giaTheoNgay) / 24.0, 2) * CEILING(DATEDIFF_BIG(MINUTE, chiTiet.thoiDiemTraPhongBanDau, chiTiet.thoiDiemTraPhong) / 60.0)), 0),
                @phuThuTraMuon = COALESCE(SUM(CASE
                    WHEN @thoiDiemThaoTac <= DATEADD(MINUTE, 20, chiTiet.thoiDiemTraPhong) THEN 0
                    WHEN CAST(@thoiDiemThaoTac AS DATE) > CAST(chiTiet.thoiDiemTraPhong AS DATE) THEN COALESCE(chiTiet.giaTheoNgayDaChot, loaiPhong.giaTheoNgay)
                    ELSE ROUND(COALESCE(chiTiet.giaTheoNgayDaChot, loaiPhong.giaTheoNgay) * CASE
                        WHEN CAST(@thoiDiemThaoTac AS TIME) <= '14:00' THEN 0.15
                        WHEN CAST(@thoiDiemThaoTac AS TIME) <= '16:00' THEN 0.20
                        WHEN CAST(@thoiDiemThaoTac AS TIME) <= '18:00' THEN 0.50
                        ELSE 1
                    END, 2)
                END), 0)
            FROM dbo.ChiTietDatPhong chiTiet
            JOIN dbo.Phong phong
                ON phong.maPhong = chiTiet.maPhong
            JOIN dbo.LoaiPhong loaiPhong
                ON loaiPhong.maLoaiPhong = phong.maLoaiPhong
            JOIN @gioBatDauGoc gioGoc
                ON gioGoc.maPhong = chiTiet.maPhong
            WHERE chiTiet.maPhieuDatPhong = @maPhieuDatPhong
                AND chiTiet.trangThai = N'Đang có khách';

            -- Cộng dịch vụ đã dùng và bồi thường thiết bị.
            SET @tongTienDichVu = dbo.fnTinhTongTienDichVu(@maPhieuDatPhong);
            SELECT @tongTienBoiThuong = COALESCE(SUM(tienBoiThuong), 0)
            FROM dbo.SuCoThietBi
            WHERE maPhieuDatPhong = @maPhieuDatPhong;
            IF @phuThuTraMuon > 0
            BEGIN
                UPDATE dbo.KhachLuuTru
                SET soLanTraPhongMuon = soLanTraPhongMuon + 1,
                    hangThanhVien = CASE
                        WHEN soLanTraPhongMuon + 1 > 3 THEN CASE hangThanhVien
                            WHEN N'Bạch kim' THEN N'Vàng'
                            WHEN N'Vàng' THEN N'Bạc'
                            ELSE N'Tiêu chuẩn'
                        END
                        ELSE hangThanhVien
                    END
                WHERE maKhachLuuTru = @maKhachLuuTru;
                SELECT @hangThanhVienMoi = hangThanhVien
                FROM dbo.KhachLuuTru
                WHERE maKhachLuuTru = @maKhachLuuTru;
                IF @hangThanhVienMoi <> @hangThanhVien
                    INSERT dbo.LichSuHangThanhVien(
                        maKhachLuuTru,
                        hangCu,
                        hangMoi,
                        lyDo,
                        thoiDiemThayDoi
                    )
                    VALUES (
                        @maKhachLuuTru,
                        @hangThanhVien,
                        @hangThanhVienMoi,
                        N'LATE_CHECKOUT',
                        @thoiDiemHienTai
                    );
                SET @hangThanhVien = @hangThanhVienMoi;
            END;

            -- Giảm giá VIP tính trên tiền phòng gốc sau khi xử lý vi phạm trả muộn.
            SET @soTienGiamGia = ROUND(@tongTienPhong * CASE @hangThanhVien
                WHEN N'Bạc' THEN 0.05
                WHEN N'Vàng' THEN 0.10
                WHEN N'Bạch kim' THEN 0.15
                ELSE 0
            END, 2);
            UPDATE dbo.HoaDon
            SET thoiDiemPhatHanh = @thoiDiemThaoTac,
                tongTienPhong = @tongTienPhong,
                tongTienDichVu = @tongTienDichVu,
                tienPhuThu = @phuThuTraMuon,
                phiGiaHan = @tongTienGiaHan,
                tienBoiThuong = @tongTienBoiThuong,
                tienGiamGia = @soTienGiamGia,
                phuongThucThanhToan = COALESCE(@phuongThucThanhToan, phuongThucThanhToan),
                phienBan = phienBan + 1
            WHERE maHoaDon = @maHoaDon;
            UPDATE dbo.PhieuDatPhong
            SET trangThai = N'Đã trả phòng', thoiDiemTraPhongThucTe = @thoiDiemThaoTac, phienBan = phienBan + 1
            WHERE maPhieuDatPhong = @maPhieuDatPhong;
            UPDATE phong
            SET trangThai = N'Đang dọn phòng', phienBan = phienBan + 1
            FROM dbo.Phong phong
            JOIN dbo.ChiTietDatPhong chiTiet
                ON chiTiet.maPhong = phong.maPhong
            WHERE chiTiet.maPhieuDatPhong = @maPhieuDatPhong
                AND chiTiet.trangThai = N'Đang có khách'
                AND phong.trangThai = N'Đang có khách';
            UPDATE dbo.ChiTietDatPhong
            SET trangThai = N'Đã trả phòng'
            WHERE maPhieuDatPhong = @maPhieuDatPhong
                AND trangThai = N'Đang có khách';
            UPDATE dbo.DatDichVuKhachSan
            SET trangThai = N'Đã hủy'
            WHERE maPhieuDatPhong = @maPhieuDatPhong
                AND trangThai IN (N'Đã xác nhận', N'Chờ thanh toán');
            UPDATE dbo.KhachLuuTru
            SET tongChiTieu = tongChiTieu + @tongTienPhong + @tongTienDichVu + @phuThuTraMuon + @tongTienGiaHan + @tongTienBoiThuong - @soTienGiamGia,
                phienBan = phienBan + 1
            WHERE maKhachLuuTru = @maKhachLuuTru;

            -- Lượt VIP dựa trên hình thức thuê đã xác nhận, không suy từ số giờ ở thực tế.
            -- Một đêm theo gói chuẩn từ 14:00 tới 12:00 hôm sau, tức 22 giờ.
            -- Thuê giờ không cộng lượt; booking theo gói hoàn tất được cộng một lượt.
            IF @hinhThucThue = N'Theo gói'
            BEGIN
                UPDATE dbo.KhachLuuTru
                SET soLanLuuTruHoanThanh = soLanLuuTruHoanThanh + 1
                WHERE maKhachLuuTru = @maKhachLuuTru;
                -- Chỉ thăng hạng khi vừa đạt mốc; lượt trả muộn phải giữ nguyên tác động hạ hạng.
                SELECT @hangThanhVienMoi = CASE soLanLuuTruHoanThanh
                    WHEN 10 THEN N'Bạc'
                    WHEN 25 THEN N'Vàng'
                    WHEN 50 THEN N'Bạch kim'
                    ELSE NULL
                END
                FROM dbo.KhachLuuTru
                WHERE maKhachLuuTru = @maKhachLuuTru;
                IF @phuThuTraMuon = 0
                    AND @hangThanhVienMoi IS NOT NULL
                    AND CASE @hangThanhVienMoi
                        WHEN N'Bạc' THEN 1
                        WHEN N'Vàng' THEN 2
                        WHEN N'Bạch kim' THEN 3
                        ELSE 0
                    END > CASE @hangThanhVien
                        WHEN N'Bạc' THEN 1
                        WHEN N'Vàng' THEN 2
                        WHEN N'Bạch kim' THEN 3
                        ELSE 0
                    END
                BEGIN
                    UPDATE dbo.KhachLuuTru
                    SET hangThanhVien = @hangThanhVienMoi
                    WHERE maKhachLuuTru = @maKhachLuuTru;
                    INSERT dbo.LichSuHangThanhVien(
                        maKhachLuuTru,
                        hangCu,
                        hangMoi,
                        lyDo,
                        thoiDiemThayDoi
                    )
                    VALUES (
                        @maKhachLuuTru,
                        @hangThanhVien,
                        @hangThanhVienMoi,
                        N'COMPLETED_STAY',
                        @thoiDiemHienTai
                    );
                END;
            END;

            -- Làm tròn tổng tiền và ghi bút toán doanh thu cùng audit checkout.
            SET @tongTienHoaDon = ROUND((@tongTienPhong + @tongTienDichVu + @phuThuTraMuon + @tongTienGiaHan + @tongTienBoiThuong - @soTienGiamGia) / 1000.0, 0) * 1000;
            IF @tongTienHoaDon > 0
                INSERT dbo.ButToanTaiChinh(
                    loaiButToan,
                    loaiNguon,
                    maNguon,
                    chieuButToan,
                    soTien,
                    maNguoiThucHien,
                    thoiDiemPhatSinh,
                    ghiChu,
                    daChotSo
                )
                VALUES (
                    N'REVENUE_RECOGNIZED',
                    N'INVOICE',
                    CONVERT(NVARCHAR(100), @maHoaDon),
                    N'Ghi có',
                    @tongTienHoaDon,
                    @nguoiThucHien,
                    @thoiDiemThaoTac,
                    N'CHECKOUT',
                    1
                );
            INSERT dbo.NhatKyKiemSoat(
                nguoiThucHien,
                hanhDong,
                loaiDoiTuong,
                maDoiTuong,
                duLieuSau
            )
            VALUES (
                @nguoiThucHien,
                N'INVOICE_RECONCILED',
                N'INVOICE',
                CONVERT(NVARCHAR(100), @maHoaDon),
                CONVERT(NVARCHAR(30), @tongTienHoaDon)
            ),
            (
                @nguoiThucHien,
                N'RESERVATION_CHECKED_OUT',
                N'RESERVATION',
                CONVERT(NVARCHAR(100), @maPhieuDatPhong),
                CONVERT(NVARCHAR(40), @thoiDiemThaoTac, 126)
            );
        END

        -- Điều chỉnh hóa đơn theo phê duyệt đã sử dụng.
        ELSE IF @lenh = N'adjust'
        BEGIN
            IF @soTienDieuChinh IS NULL
                OR @soTienDieuChinh = 0
                OR NULLIF(LTRIM(RTRIM(@lyDo)), N'') IS NULL
                THROW 53502, N'Điều chỉnh phải có số tiền và lý do', 1;
            IF EXISTS (
                SELECT 1
                FROM dbo.DieuChinhHoaDon
                WHERE khoaChongTrung = @khoaChongTrung
            )
            BEGIN
                COMMIT TRANSACTION;
                RETURN;
            END;
            IF NOT EXISTS (
                SELECT 1
                FROM dbo.YeuCauPheDuyet WITH (UPDLOCK, HOLDLOCK)
                WHERE maYeuCauPheDuyet = @maPheDuyet
                    AND hanhDong = N'Điều chỉnh thanh toán'
                    AND maDoiTuong = CONVERT(NVARCHAR(100), @maHoaDon)
                    AND nguoiYeuCau = @nguoiThucHien
                    AND trangThai = N'Đã sử dụng'
                    AND soTien = ABS(@soTienDieuChinh)
                    AND dauVanTayDuLieu = @maBamYeuCau
            )
                THROW 52205, N'Cần phê duyệt đúng nội dung điều chỉnh', 1;
            SELECT @tongTienHoaDon = ROUND((tongTienPhong + tongTienDichVu + tienPhuThu + tienBoiThuong + phiGiaHan + tongTienDieuChinh - tienGiamGia) / 1000.0, 0) * 1000
            FROM dbo.HoaDon
            WHERE maHoaDon = @maHoaDon;
            IF @tongTienHoaDon + @soTienDieuChinh < 0
                THROW 53503, N'Điều chỉnh giảm không được làm tổng hóa đơn âm', 1;
            INSERT dbo.DieuChinhHoaDon(
                maHoaDon,
                soTienChenhLech,
                lyDo,
                maNguoiThucHien,
                thoiDiemPhatSinh,
                khoaChongTrung
            )
            VALUES (
                @maHoaDon,
                @soTienDieuChinh,
                @lyDo,
                @nguoiThucHien,
                @thoiDiemHienTai,
                @khoaChongTrung
            );
            SET @maGiaoDichThanhToan = SCOPE_IDENTITY();
            UPDATE dbo.HoaDon
            SET tongTienDieuChinh = tongTienDieuChinh + @soTienDieuChinh, phienBan = phienBan + 1
            WHERE maHoaDon = @maHoaDon;
            INSERT dbo.ButToanTaiChinh(
                loaiButToan,
                loaiNguon,
                maNguon,
                chieuButToan,
                soTien,
                maNguoiThucHien,
                thoiDiemPhatSinh,
                ghiChu,
                daChotSo
            )
            VALUES (
                N'INVOICE_ADJUSTMENT',
                N'INVOICE_ADJUSTMENT',
                CONVERT(NVARCHAR(100), @maGiaoDichThanhToan),
                CASE
                    WHEN @soTienDieuChinh > 0 THEN N'Ghi có'
                    ELSE N'Ghi nợ'
                END,
                ABS(@soTienDieuChinh),
                @nguoiThucHien,
                @thoiDiemHienTai,
                @lyDo,
                1
            );
            INSERT dbo.NhatKyKiemSoat(
                nguoiThucHien,
                hanhDong,
                loaiDoiTuong,
                maDoiTuong,
                duLieuTruoc,
                duLieuSau,
                lyDo
            )
            VALUES (
                @nguoiThucHien,
                N'INVOICE_ADJUSTED',
                N'INVOICE',
                CONVERT(NVARCHAR(100), @maHoaDon),
                CONVERT(NVARCHAR(30), @tongTienHoaDon),
                CONVERT(NVARCHAR(30), @tongTienHoaDon + @soTienDieuChinh),
                @lyDo
            );
        END
        ELSE IF @lenh IN (N'refund-deposit', N'cancel-refund')
        BEGIN
            SELECT @tongTienHoaDon = COALESCE(SUM(soDu), 0)
            FROM dbo.vwSoDuTienCoc
            WHERE maHoaDon = @maHoaDon
                AND soDu > 0;
            IF @tongTienHoaDon <= 0
                THROW 53504, N'Tiền cọc đã được hoàn hoặc chưa ghi nhận', 1;
            IF @maTaiKhoanKhachHang IS NULL
            BEGIN
                IF NOT EXISTS (
                    SELECT 1
                    FROM dbo.YeuCauPheDuyet WITH (UPDLOCK, HOLDLOCK)
                    WHERE maYeuCauPheDuyet = @maPheDuyet
                        AND hanhDong = N'Hoàn tiền đặt cọc'
                        AND maDoiTuong = CONVERT(NVARCHAR(100), @maHoaDon)
                        AND nguoiYeuCau = @nguoiThucHien
                        AND trangThai = N'Đã sử dụng'
                        AND soTien = @tongTienHoaDon
                        AND dauVanTayDuLieu = @maBamYeuCau
                )
                    THROW 52205, N'Cần approval đúng nội dung hoàn cọc', 1;
            END
            ELSE IF @lenh <> N'cancel-refund'
                OR NOT EXISTS (
                    SELECT 1
                    FROM dbo.PhieuDatPhong
                    WHERE maPhieuDatPhong = @maPhieuDatPhong
                        AND maTaiKhoanKhachHang = @maTaiKhoanKhachHang
                        AND trangThai = N'Đã hủy'
                        AND ketQuaHuy = N'Hoàn tiền'
                )
                THROW 53505, N'Không được tự hoàn cọc ngoài policy hủy đúng hạn', 1;

            SELECT @tienCocMatCanHoan = COALESCE(SUM(soDu), 0)
            FROM dbo.vwSoDuTienCoc
            WHERE maHoaDon = @maHoaDon
                AND phuongThuc = N'Tiền mặt'
                AND soDu > 0;
            IF @tienCocMatCanHoan > 0
                AND dbo.fnSoDuTienMatNhanVien(@nguoiThucHien, @thoiDiemHienTai) < @tienCocMatCanHoan
                THROW 52315, N'Số dư tiền mặt đang giữ không đủ để hoàn cọc', 1;

            -- Hoàn lần lượt số dư của từng giao dịch cọc, giữ liên kết với giao dịch gốc.
            DECLARE duyetTienCoc CURSOR LOCAL FAST_FORWARD FOR
                SELECT maGiaoDichThanhToan,
                    phuongThuc,
                    soDu
                FROM dbo.vwSoDuTienCoc
                WHERE maHoaDon = @maHoaDon
                    AND soDu > 0
                ORDER BY thoiDiemPhatSinh, maGiaoDichThanhToan;
            OPEN duyetTienCoc;
            FETCH NEXT FROM duyetTienCoc INTO @maThanhToanGoc, @phuongThucThanhToanGoc, @soTienThanhToanGoc;
            WHILE @@FETCH_STATUS = 0
            BEGIN
                INSERT dbo.GiaoDichThanhToan(
                    maHoaDon,
                    soTien,
                    phuongThuc,
                    loai,
                    trangThai,
                    maThamChieu,
                    thoiDiemPhatSinh,
                    maNguoiThucHien,
                    khoaChongTrung
                )
                VALUES (
                    @maHoaDon,
                    @soTienThanhToanGoc,
                    @phuongThucThanhToanGoc,
                    N'Hoàn tiền',
                    N'Đã hoàn tất',
                    N'REFUND_OF:' + CONVERT(NVARCHAR(20), @maThanhToanGoc) + N':' + @lenh,
                    @thoiDiemHienTai,
                    @nguoiThucHien,
                    @khoaChongTrung + N':' + CONVERT(NVARCHAR(20), @maThanhToanGoc)
                );
                SET @maGiaoDichThanhToan = SCOPE_IDENTITY();
                INSERT dbo.ButToanTaiChinh(
                    loaiButToan,
                    loaiNguon,
                    maNguon,
                    chieuButToan,
                    soTien,
                    maNguoiThucHien,
                    thoiDiemPhatSinh,
                    ghiChu,
                    daChotSo
                )
                VALUES (
                    N'REFUND_ISSUED',
                    N'PAYMENT_TRANSACTION',
                    CONVERT(NVARCHAR(100), @maGiaoDichThanhToan),
                    N'Ghi có',
                    @soTienThanhToanGoc,
                    @nguoiThucHien,
                    @thoiDiemHienTai,
                    @lenh,
                    1
                );
                INSERT dbo.NhatKyKiemSoat(
                    nguoiThucHien,
                    hanhDong,
                    loaiDoiTuong,
                    maDoiTuong,
                    duLieuSau,
                    lyDo
                )
                VALUES (
                    @nguoiThucHien,
                    CASE
                        WHEN @lenh = N'cancel-refund' THEN N'DEPOSIT_REFUNDED_ON_CANCELLATION'
                        ELSE N'DEPOSIT_REFUNDED'
                    END,
                    N'PAYMENT_TRANSACTION',
                    CONVERT(NVARCHAR(100), @maGiaoDichThanhToan),
                    CONVERT(NVARCHAR(30), @soTienThanhToanGoc),
                    N'REFUND_OF:' + CONVERT(NVARCHAR(20), @maThanhToanGoc)
                );
                FETCH NEXT FROM duyetTienCoc INTO @maThanhToanGoc, @phuongThucThanhToanGoc, @soTienThanhToanGoc;
            END;
            CLOSE duyetTienCoc;
            DEALLOCATE duyetTienCoc;
        END
        ELSE
            THROW 51008, N'Lệnh hóa đơn không hợp lệ', 1;
        SELECT @tienDatCoc = COALESCE(SUM(CASE
            WHEN soDu > 0 THEN soDu
            ELSE 0
        END), 0)
        FROM dbo.vwSoDuTienCoc
        WHERE maHoaDon = @maHoaDon;

        -- Tính lại số dư hóa đơn sau khi nhánh nghiệp vụ hoàn tất.
        SET @soDuPhaiThu = dbo.fnTinhSoDuHoaDon(@maHoaDon);
        UPDATE dbo.HoaDon
        SET tienDatCocDaTra = @tienDatCoc,
            soTienPhaiTra = @soDuPhaiThu,
            trangThai = CASE
                WHEN @lenh = N'deposit' THEN N'Dự kiến'
                WHEN @soDuPhaiThu = 0 THEN N'Đã thanh toán'
                ELSE N'Chưa thanh toán'
            END,
            phienBan = phienBan + 1
        WHERE maHoaDon = @maHoaDon;
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF CURSOR_STATUS('local', 'duyetPhongTra') >= - 1
        BEGIN
            IF CURSOR_STATUS('local', 'duyetPhongTra') > - 1
                CLOSE duyetPhongTra;
            DEALLOCATE duyetPhongTra;
        END;
        IF CURSOR_STATUS('local', 'duyetTienCoc') >= - 1
        BEGIN
            IF CURSOR_STATUS('local', 'duyetTienCoc') > - 1
                CLOSE duyetTienCoc;
            DEALLOCATE duyetTienCoc;
        END;
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

-- =============================================================================
-- uspPhatHanhBienLai
-- Phát hành biên lai trong giới hạn tiền đã thu chưa lập biên lai.
-- Số biên lai, tiền thu còn được lập biên lai và bút toán được xử lý nguyên tử.
-- =============================================================================
CREATE PROCEDURE dbo.uspPhatHanhBienLai
    @maHoaDon BIGINT,
    @soBienLai NVARCHAR(MAX),
    @soTien DECIMAL(38, 6),
    @phuongThucThanhToan NVARCHAR(MAX),
    @nguoiThucHien NVARCHAR(MAX),
    @thoiDiemHienTai DATETIME2(6)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;
        DECLARE @maBienLaiDaCo BIGINT,
            @maDaKhoa BIGINT,
            @soTienDaThanhToan DECIMAL(19, 2),
            @thoiDiemCap DECIMAL(19, 2),
            @ma BIGINT;
        SELECT @maBienLaiDaCo = maBienLai
        FROM dbo.BienLai WITH (UPDLOCK, HOLDLOCK)
        WHERE soBienLai = @soBienLai;
        IF @maBienLaiDaCo IS NOT NULL
            THROW 53201, N'Số biên lai đã tồn tại', 1;
        SELECT @maDaKhoa = maHoaDon
        FROM dbo.HoaDon WITH (UPDLOCK, HOLDLOCK)
        WHERE maHoaDon = @maHoaDon;
        IF @maDaKhoa IS NULL
            THROW 53101, N'Không tìm thấy hóa đơn', 1;
        SELECT @soTienDaThanhToan = COALESCE(SUM(CASE
            WHEN loai = N'Thanh toán' THEN soTien
            WHEN loai = N'Hoàn tiền' THEN - soTien
            ELSE 0
        END), 0)
        FROM dbo.GiaoDichThanhToan WITH (UPDLOCK, HOLDLOCK)
        WHERE maHoaDon = @maHoaDon
            AND phuongThuc = @phuongThucThanhToan
            AND trangThai = N'Đã hoàn tất';
        SELECT @thoiDiemCap = COALESCE(SUM(soTien), 0)
        FROM dbo.BienLai WITH (UPDLOCK, HOLDLOCK)
        WHERE maHoaDon = @maHoaDon
            AND phuongThuc = @phuongThucThanhToan;
        IF @soTien <= 0
            THROW 53202, N'Số tiền biên lai phải lớn hơn 0', 1;
        IF @soTien > @soTienDaThanhToan - @thoiDiemCap
            THROW 53203, N'Biên lai vượt số tiền đã thu chưa lập biên lai', 1;
        INSERT dbo.BienLai(
            soBienLai,
            maHoaDon,
            soTien,
            phuongThuc,
            thoiDiemPhatHanh,
            nguoiPhatHanh
        )
        VALUES (
            @soBienLai,
            @maHoaDon,
            @soTien,
            @phuongThucThanhToan,
            @thoiDiemHienTai,
            @nguoiThucHien
        );
        SET @ma = SCOPE_IDENTITY();
        INSERT dbo.ButToanTaiChinh(
            loaiButToan,
            loaiNguon,
            maNguon,
            chieuButToan,
            soTien,
            maNguoiThucHien,
            thoiDiemPhatSinh,
            ghiChu,
            daChotSo
        )
        VALUES (
            N'RECEIPT_ISSUED',
            N'RECEIPT',
            CONVERT(NVARCHAR(100), @ma),
            N'Ghi nợ',
            @soTien,
            @nguoiThucHien,
            @thoiDiemHienTai,
            @phuongThucThanhToan,
            1
        );
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

-- =============================================================================
-- uspHetHanGiuCoc
-- Hủy booking nháp quá hạn cọc hoặc khôi phục lịch trước khi gia hạn chưa trả cọc.
-- =============================================================================
CREATE PROCEDURE dbo.uspHetHanGiuCoc
    @thoiDiemHienTai DATETIME2(6)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;
        DECLARE @maPhieuDatPhong BIGINT,
            @loaiThayDoiChoXacNhan NVARCHAR(20),
            @trangThaiDatPhong NVARCHAR(30),
            @thoiDiemNhanPhongTruoc DATETIME2(6),
            @thoiDiemTraPhongTruoc DATETIME2(6),
            @tienDatCocTruoc DECIMAL(12, 2),
            @trangThaiDatCoc NVARCHAR(20),
            @thoiDiemHetHanDatCoc DATETIME2(6);
        DECLARE duyetGiuCoc CURSOR LOCAL FAST_FORWARD FOR
            SELECT maPhieuDatPhong
            FROM dbo.PhieuDatPhong
            WHERE trangThaiThanhToanCoc = N'Chờ thanh toán'
                AND thoiDiemHetHanThanhToanCoc <= @thoiDiemHienTai
                AND (
                    trangThai = N'Chờ thanh toán'
                    OR loaiThayDoiDangCho IS NOT NULL
                )
            ORDER BY maPhieuDatPhong;
        OPEN duyetGiuCoc;
        FETCH NEXT FROM duyetGiuCoc INTO @maPhieuDatPhong;
        WHILE @@FETCH_STATUS = 0
        BEGIN
            SELECT @loaiThayDoiChoXacNhan = loaiThayDoiDangCho,
                @trangThaiDatPhong = trangThai,
                @thoiDiemNhanPhongTruoc = thoiDiemNhanPhongTruocThayDoi,
                @thoiDiemTraPhongTruoc = thoiDiemTraPhongTruocThayDoi,
                @tienDatCocTruoc = tienDatCocTruocThayDoi,
                @trangThaiDatCoc = trangThaiThanhToanCoc,
                @thoiDiemHetHanDatCoc = thoiDiemHetHanThanhToanCoc
            FROM dbo.PhieuDatPhong WITH (UPDLOCK, HOLDLOCK)
            WHERE maPhieuDatPhong = @maPhieuDatPhong;

            -- Cursor chỉ liệt kê ứng viên; callback thanh toán hoặc lần giữ chỗ mới
            -- có thể đã commit trong lúc tác vụ này chờ khóa booking. Cần kiểm tra lại.
            IF @trangThaiDatCoc <> N'Chờ thanh toán'
                OR @thoiDiemHetHanDatCoc IS NULL
                OR @thoiDiemHetHanDatCoc > @thoiDiemHienTai
            BEGIN
                FETCH NEXT FROM duyetGiuCoc INTO @maPhieuDatPhong;
                CONTINUE;
            END;
            IF @loaiThayDoiChoXacNhan IS NOT NULL
            BEGIN
                UPDATE dbo.ChiTietDatPhong
                SET thoiDiemNhanPhong = @thoiDiemNhanPhongTruoc, thoiDiemTraPhong = @thoiDiemTraPhongTruoc
                WHERE maPhieuDatPhong = @maPhieuDatPhong;
                UPDATE dbo.PhieuDatPhong
                SET tienDatCoc = @tienDatCocTruoc,
                    trangThaiThanhToanCoc = N'Đã thanh toán',
                    maThanhToanDatCoc = NULL,
                    thoiDiemHetHanThanhToanCoc = NULL,
                    loaiThayDoiDangCho = NULL,
                    thoiDiemNhanPhongTruocThayDoi = NULL,
                    thoiDiemTraPhongTruocThayDoi = NULL,
                    tienDatCocTruocThayDoi = NULL,
                    tienDatCocBoSung = 0,
                    phienBan = phienBan + 1
                WHERE maPhieuDatPhong = @maPhieuDatPhong;
                INSERT dbo.NhatKyKiemSoat(
                    nguoiThucHien,
                    hanhDong,
                    loaiDoiTuong,
                    maDoiTuong,
                    duLieuTruoc,
                    duLieuSau,
                    lyDo
                )
                VALUES (
                    N'SYSTEM',
                    N'CUSTOMER_EXTENSION_PAYMENT_EXPIRED',
                    N'RESERVATION',
                    CONVERT(NVARCHAR(100), @maPhieuDatPhong),
                    N'PENDING',
                    N'ROLLED_BACK',
                    N'ADDITIONAL_DEPOSIT_TIMEOUT'
                );
            END
            ELSE IF @trangThaiDatPhong = N'Chờ thanh toán'
            BEGIN
                UPDATE dbo.PhieuDatPhong
                SET trangThai = N'Đã hủy', trangThaiThanhToanCoc = N'Đã hết hạn', phienBan = phienBan + 1
                WHERE maPhieuDatPhong = @maPhieuDatPhong;
                UPDATE dbo.ChiTietDatPhong
                SET trangThai = N'Đã hủy'
                WHERE maPhieuDatPhong = @maPhieuDatPhong;
                INSERT dbo.NhatKyKiemSoat(
                    nguoiThucHien,
                    hanhDong,
                    loaiDoiTuong,
                    maDoiTuong,
                    duLieuTruoc,
                    duLieuSau,
                    lyDo
                )
                VALUES (
                    N'SYSTEM',
                    N'CUSTOMER_RESERVATION_HOLD_EXPIRED',
                    N'RESERVATION',
                    CONVERT(NVARCHAR(100), @maPhieuDatPhong),
                    N'PENDING',
                    N'EXPIRED',
                    N'DEPOSIT_HOLD_TIMEOUT'
                );
            END;
            UPDATE dbo.YeuCauThanhToanVnpay
            SET trangThai = N'Đã hết hạn', thoiDiemHoanTat = @thoiDiemHienTai
            WHERE maPhieuDatPhong = @maPhieuDatPhong
                AND trangThai = N'Chờ thanh toán';
            FETCH NEXT FROM duyetGiuCoc INTO @maPhieuDatPhong;
        END;
        CLOSE duyetGiuCoc;
        DEALLOCATE duyetGiuCoc;
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF CURSOR_STATUS('local', 'duyetGiuCoc') >= - 1
        BEGIN
            IF CURSOR_STATUS('local', 'duyetGiuCoc') > - 1
                CLOSE duyetGiuCoc;
            DEALLOCATE duyetGiuCoc;
        END;
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

-- =============================================================================
-- uspLenhDatPhong
-- Xác nhận, nhận phòng, đổi lịch, gia hạn, hủy hoặc thêm dịch vụ cho booking.
-- =============================================================================
CREATE PROCEDURE dbo.uspLenhDatPhong
    @lenh NVARCHAR(30),
    @maPhieuDatPhong BIGINT,
    @maTaiKhoanKhachHang BIGINT = NULL,
    @danhSachPhongJson NVARCHAR(MAX) = NULL,
    @thoiDiemThaoTac DATETIME2(6) = NULL,
    @thoiDiemNhanPhongMoi DATETIME2(6) = NULL,
    @tienDatCoc DECIMAL(12, 2) = NULL,
    @lyDo NVARCHAR(500) = NULL,
    @maDichVu NVARCHAR(10) = NULL,
    @soLuong INT = NULL,
    @maYeuCauThanhToan NVARCHAR(40) = NULL,
    @thoiDiemHetHan DATETIME2(6) = NULL,
    @nguoiThucHien NVARCHAR(50),
    @thoiDiemHienTai DATETIME2(6)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;
        DECLARE @trangThaiDatPhong NVARCHAR(30),
            @trangThaiDatCoc NVARCHAR(20),
            @loaiThayDoiChoXacNhan NVARCHAR(20),
            @phuongThucDatCoc NVARCHAR(20),
            @phienBanDatPhong BIGINT,
            @maKhachLuuTru BIGINT,
            @tienDatCocTruoc DECIMAL(12, 2),
            @thoiDiemNhanPhongTruoc DATETIME2(6),
            @thoiDiemTraPhongTruoc DATETIME2(6),
            @maPhongDaKhoa NVARCHAR(10),
            @trangThaiPhongDaKhoa NVARCHAR(30),
            @hangThanhVien NVARCHAR(20),
            @hangThanhVienMoi NVARCHAR(20),
            @huyDatPhongMuon BIT = 0;

        -- Đọc và khóa booking trong phạm vi tài khoản khách nếu được truyền vào.
        SELECT @trangThaiDatPhong = trangThai,
            @trangThaiDatCoc = trangThaiThanhToanCoc,
            @loaiThayDoiChoXacNhan = loaiThayDoiDangCho,
            @phuongThucDatCoc = phuongThucBaoDam,
            @phienBanDatPhong = phienBan,
            @maKhachLuuTru = maKhachLuuTru,
            @tienDatCocTruoc = tienDatCoc
        FROM dbo.PhieuDatPhong WITH (UPDLOCK, HOLDLOCK)
        WHERE maPhieuDatPhong = @maPhieuDatPhong
            AND (
                @maTaiKhoanKhachHang IS NULL
                OR maTaiKhoanKhachHang = @maTaiKhoanKhachHang
            );
        IF @trangThaiDatPhong IS NULL
            THROW 53408, N'Không tìm thấy đặt phòng', 1;
        SELECT @thoiDiemNhanPhongTruoc = MIN(thoiDiemNhanPhong),
            @thoiDiemTraPhongTruoc = MAX(thoiDiemTraPhong)
        FROM dbo.ChiTietDatPhong WITH (UPDLOCK, HOLDLOCK)
        WHERE maPhieuDatPhong = @maPhieuDatPhong;
        IF @thoiDiemNhanPhongTruoc IS NULL
            THROW 53409, N'Đặt phòng không có phòng', 1;

        -- Khóa các phòng theo mã trước khi kiểm tra lịch và đổi trạng thái.
        DECLARE duyetKhoaPhong CURSOR LOCAL FAST_FORWARD FOR
            SELECT maPhong
            FROM dbo.ChiTietDatPhong
            WHERE maPhieuDatPhong = @maPhieuDatPhong
            ORDER BY maPhong;
        OPEN duyetKhoaPhong;
        FETCH NEXT FROM duyetKhoaPhong INTO @maPhongDaKhoa;
        WHILE @@FETCH_STATUS = 0
        BEGIN
            SELECT @trangThaiPhongDaKhoa = trangThai
            FROM dbo.Phong WITH (UPDLOCK, HOLDLOCK)
            WHERE maPhong = @maPhongDaKhoa;
            FETCH NEXT FROM duyetKhoaPhong INTO @maPhongDaKhoa;
        END;
        CLOSE duyetKhoaPhong;
        DEALLOCATE duyetKhoaPhong;

        -- Lễ tân chỉ xác nhận sau khi thực sự nhận đủ số tiền cọc đã báo.
        IF @lenh = N'receive-deposit'
        BEGIN
            IF @trangThaiDatPhong <> N'Chờ thanh toán' OR @trangThaiDatCoc <> N'Chờ thanh toán'
                THROW 53410, N'Booking không còn chờ thu cọc', 1;
            IF @phuongThucDatCoc <> N'Tại khách sạn' OR @tienDatCocTruoc <= 0
                THROW 53411, N'Chỉ ghi nhận tiền mặt cho yêu cầu nộp cọc tại quầy', 1;
            IF NOT EXISTS(SELECT 1 FROM dbo.PhieuDatPhong WHERE maPhieuDatPhong=@maPhieuDatPhong
                AND thoiDiemHetHanThanhToanCoc>@thoiDiemHienTai)
                THROW 53303, N'Yêu cầu thu cọc đã hết hạn. Kiểm tra lại phòng trước khi tạo yêu cầu mới.', 1;
            IF EXISTS(SELECT 1 FROM dbo.ChiTietDatPhong WHERE maPhieuDatPhong=@maPhieuDatPhong
                AND dbo.fnKiemTraPhongTrong(maPhong,thoiDiemNhanPhong,thoiDiemTraPhong,@thoiDiemHienTai,@maPhieuDatPhong)=0)
                THROW 51004, N'Phòng không còn khả dụng để xác nhận', 1;
            UPDATE dbo.PhieuDatPhong SET trangThai=N'Đã thanh toán cọc',phienBan=phienBan+1
            WHERE maPhieuDatPhong=@maPhieuDatPhong;
            UPDATE dbo.ChiTietDatPhong SET trangThai=N'Đã giữ phòng'
            WHERE maPhieuDatPhong=@maPhieuDatPhong;
        END

        -- Nhận phòng.
        ELSE IF @lenh = N'check-in'
        BEGIN
            IF @trangThaiDatPhong NOT IN (N'Đã xác nhận', N'Đã thanh toán cọc')
                THROW 53410, N'Trạng thái đặt phòng không hợp lệ', 1;
            IF @trangThaiDatCoc <> N'Đã thanh toán' OR @tienDatCocTruoc <= 0
                THROW 53411, N'Phải xác nhận đã thu đủ tiền cọc trước khi nhận phòng', 1;
            IF @thoiDiemThaoTac IS NULL
                SET @thoiDiemThaoTac = @thoiDiemHienTai;
            IF EXISTS (
                SELECT 1
                FROM dbo.ChiTietDatPhong
                WHERE maPhieuDatPhong = @maPhieuDatPhong
                    AND @thoiDiemThaoTac < thoiDiemNhanPhong
            )
                THROW 53412, N'Không được nhận phòng sớm', 1;
            IF EXISTS (
                SELECT 1
                FROM dbo.ChiTietDatPhong
                WHERE maPhieuDatPhong = @maPhieuDatPhong
                    AND @thoiDiemThaoTac >= thoiDiemTraPhong
            )
                THROW 53413, N'Giờ nhận phải trước giờ trả dự kiến', 1;
            IF EXISTS (
                SELECT 1
                FROM dbo.ChiTietDatPhong chiTiet
                JOIN dbo.Phong phong
                    ON phong.maPhong = chiTiet.maPhong
                WHERE chiTiet.maPhieuDatPhong = @maPhieuDatPhong
                    AND phong.trangThai NOT IN (N'Sẵn sàng', N'Đã giữ phòng')
            )
                THROW 53414, N'Phòng chưa sẵn sàng để nhận khách', 1;
            IF EXISTS (
                SELECT 1
                FROM dbo.ChiTietDatPhong
                WHERE maPhieuDatPhong = @maPhieuDatPhong
                    AND dbo.fnKiemTraPhongTrong(maPhong, @thoiDiemThaoTac, thoiDiemTraPhong, @thoiDiemHienTai, @maPhieuDatPhong) = 0
            )
                THROW 51004, N'Phòng có lịch giao nhau', 1;
            UPDATE dbo.PhieuDatPhong
            SET trangThai = N'Đã nhận phòng', thoiDiemNhanPhongThucTe = @thoiDiemThaoTac, phienBan = phienBan + 1
            WHERE maPhieuDatPhong = @maPhieuDatPhong;
            UPDATE dbo.ChiTietDatPhong
            SET trangThai = N'Đang có khách'
            WHERE maPhieuDatPhong = @maPhieuDatPhong;
            UPDATE phong
            SET trangThai = N'Đang có khách', phienBan = phienBan + 1
            FROM dbo.Phong phong
            JOIN dbo.ChiTietDatPhong chiTiet
                ON chiTiet.maPhong = phong.maPhong
            WHERE chiTiet.maPhieuDatPhong = @maPhieuDatPhong;
        END

        -- Gia hạn tại quầy.
        ELSE IF @lenh = N'extend'
        BEGIN
            IF @trangThaiDatPhong NOT IN (N'Đã xác nhận', N'Đã thanh toán cọc', N'Đã nhận phòng')
                THROW 53410, N'Trạng thái đặt phòng không hợp lệ', 1;
            IF @thoiDiemThaoTac IS NULL OR EXISTS (
                SELECT 1
                FROM dbo.ChiTietDatPhong
                WHERE maPhieuDatPhong = @maPhieuDatPhong
                    AND @thoiDiemThaoTac <= thoiDiemTraPhong
            )
                THROW 53415, N'Giờ trả mới phải sau giờ trả hiện tại', 1;
            IF EXISTS (
                SELECT 1
                FROM dbo.ChiTietDatPhong
                WHERE maPhieuDatPhong = @maPhieuDatPhong
                    AND @thoiDiemHienTai > DATEADD(HOUR, - 1, thoiDiemTraPhong)
            )
                THROW 53416, N'Gia hạn phải trước giờ trả ít nhất một giờ', 1;
            IF EXISTS (
                SELECT 1
                FROM dbo.ChiTietDatPhong
                WHERE maPhieuDatPhong = @maPhieuDatPhong
                    AND dbo.fnKiemTraPhongTrong(maPhong, thoiDiemNhanPhong, @thoiDiemThaoTac, @thoiDiemHienTai, @maPhieuDatPhong) = 0
            )
                THROW 51004, N'Gia hạn giao nhau với booking khác', 1;
            UPDATE dbo.PhieuDatPhong
            SET soPhutGiaHan = soPhutGiaHan + DATEDIFF(MINUTE, @thoiDiemTraPhongTruoc, @thoiDiemThaoTac), phienBan = phienBan + 1
            WHERE maPhieuDatPhong = @maPhieuDatPhong;
            UPDATE dbo.ChiTietDatPhong
            SET thoiDiemTraPhong = @thoiDiemThaoTac
            WHERE maPhieuDatPhong = @maPhieuDatPhong;
        END

        -- Cập nhật thông tin hoặc trạng thái.
        ELSE IF @lenh = N'update'
        BEGIN
            IF @trangThaiDatPhong NOT IN (N'Bản nháp', N'Đã xác nhận', N'Đã thanh toán cọc')
                THROW 53410, N'Trạng thái đặt phòng không hợp lệ', 1;
            IF ISJSON(@danhSachPhongJson) <> 1
                THROW 51008, N'Lịch lưu trú không hợp lệ', 1;
            DECLARE @lichPhongMoi TABLE (room NVARCHAR(10) PRIMARY KEY, checkIn DATETIME2(6), checkOut DATETIME2(6));
            INSERT @lichPhongMoi
            SELECT maPhong,
                thoiDiemNhanPhong,
                thoiDiemTraPhong
            FROM OPENJSON(@danhSachPhongJson) WITH (maPhong NVARCHAR(10), thoiDiemNhanPhong DATETIME2(6), thoiDiemTraPhong DATETIME2(6));
            IF (
                SELECT COUNT(*)
                FROM @lichPhongMoi
            ) <>(
                SELECT COUNT(*)
                FROM dbo.ChiTietDatPhong
                WHERE maPhieuDatPhong = @maPhieuDatPhong
            ) OR EXISTS (
                SELECT 1
                FROM @lichPhongMoi lichPhongMoi
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM dbo.ChiTietDatPhong chiTiet
                    WHERE chiTiet.maPhieuDatPhong = @maPhieuDatPhong
                        AND chiTiet.maPhong = lichPhongMoi.room
                )
            )
                THROW 53417, N'Cập nhật phải giữ nguyên tập phòng', 1;
            IF EXISTS (
                SELECT 1
                FROM @lichPhongMoi
                WHERE checkIn IS NULL
                    OR checkOut IS NULL
                    OR checkIn >= checkOut
            )
                THROW 51008, N'Khoảng lưu trú không hợp lệ', 1;
            IF EXISTS (
                SELECT 1
                FROM @lichPhongMoi
                WHERE dbo.fnKiemTraPhongTrong(room, checkIn, checkOut, @thoiDiemHienTai, @maPhieuDatPhong) = 0
            )
                THROW 51004, N'Lịch mới có booking giao nhau', 1;
            UPDATE chiTiet
            SET thoiDiemNhanPhong = lichPhongMoi.checkIn, thoiDiemTraPhong = lichPhongMoi.checkOut, thoiDiemTraPhongBanDau = lichPhongMoi.checkOut
            FROM dbo.ChiTietDatPhong chiTiet
            JOIN @lichPhongMoi lichPhongMoi
                ON lichPhongMoi.room = chiTiet.maPhong
            WHERE chiTiet.maPhieuDatPhong = @maPhieuDatPhong;
            UPDATE dbo.PhieuDatPhong
            SET tienDatCoc = COALESCE(@tienDatCoc, tienDatCoc), phienBan = phienBan + 1
            WHERE maPhieuDatPhong = @maPhieuDatPhong;
        END
        ELSE IF @lenh IN (N'customer-extend', N'customer-reschedule')
        BEGIN
            IF @maTaiKhoanKhachHang IS NULL
                OR @trangThaiDatPhong NOT IN (N'Đã xác nhận', N'Đã thanh toán cọc')
                THROW 53418, N'Chỉ booking đã xác nhận mới được thay đổi lịch', 1;
            IF @trangThaiDatCoc <> N'Đã thanh toán'
                THROW 53411, N'Booking phải hoàn tất cọc trước khi thay đổi lịch', 1;
            IF EXISTS (
                SELECT 1
                FROM dbo.PhieuDatPhong
                WHERE maPhieuDatPhong = @maPhieuDatPhong
                    AND hinhThucThue <> N'Theo gói'
            )
                THROW 53419, N'Chỉ booking theo gói được thay đổi ngày', 1;
            IF @loaiThayDoiChoXacNhan IS NOT NULL
                THROW 53420, N'Booking đang chờ cọc bổ sung', 1;
            IF EXISTS (
                SELECT 1
                FROM dbo.ChiTietDatPhong
                WHERE maPhieuDatPhong = @maPhieuDatPhong
                    AND (
                        thoiDiemNhanPhong <> @thoiDiemNhanPhongTruoc
                        OR thoiDiemTraPhong <> @thoiDiemTraPhongTruoc
                    )
            )
                THROW 53421, N'Các phòng phải cùng lịch lưu trú', 1;
            IF @thoiDiemHienTai >= DATEADD(HOUR, - 48, @thoiDiemNhanPhongTruoc)
                THROW 53422, N'Chỉ được đổi ngày trước check-in hơn 48 giờ', 1;
            IF EXISTS (
                SELECT 1
                FROM dbo.ChiTietDatPhong chiTiet
                JOIN dbo.Phong phong
                    ON phong.maPhong = chiTiet.maPhong
                WHERE chiTiet.maPhieuDatPhong = @maPhieuDatPhong
                    AND phong.trangThai IN (N'Đang có khách', N'Đang dọn phòng', N'Đang bảo trì', N'Ngừng sử dụng')
            )
                THROW 53414, N'Phòng hiện không sẵn sàng', 1;

            -- Khách yêu cầu gia hạn và trả cọc bổ sung.
            IF @lenh = N'customer-extend'
            BEGIN
                IF @thoiDiemNhanPhongMoi IS NOT NULL
                    AND @thoiDiemNhanPhongMoi <> @thoiDiemTraPhongTruoc
                    THROW 53423, N'Phần gia hạn phải nối tiếp lịch cũ', 1;
                SET @thoiDiemNhanPhongMoi = @thoiDiemNhanPhongTruoc;
                IF @thoiDiemThaoTac IS NULL
                    OR @thoiDiemThaoTac <= @thoiDiemTraPhongTruoc
                    THROW 53415, N'Ngày trả mới phải sau ngày trả hiện tại', 1;
            END
            ELSE
            BEGIN
                IF @thoiDiemNhanPhongMoi IS NULL
                    OR @thoiDiemThaoTac IS NULL
                    OR @thoiDiemNhanPhongMoi >= @thoiDiemThaoTac
                    THROW 51008, N'Khoảng lưu trú không hợp lệ', 1;
                IF @thoiDiemNhanPhongMoi <= @thoiDiemHienTai
                    THROW 53405, N'Giờ nhận phải ở tương lai', 1;
                IF DATEDIFF_BIG(MICROSECOND, @thoiDiemNhanPhongMoi, @thoiDiemThaoTac) <> DATEDIFF_BIG(MICROSECOND, @thoiDiemNhanPhongTruoc, @thoiDiemTraPhongTruoc)
                    THROW 53424, N'Đổi ngày phải giữ nguyên thời lượng', 1;
            END;
            IF EXISTS (
                SELECT 1
                FROM dbo.ChiTietDatPhong
                WHERE maPhieuDatPhong = @maPhieuDatPhong
                    AND dbo.fnKiemTraPhongTrong(maPhong, @thoiDiemNhanPhongMoi, @thoiDiemThaoTac, @thoiDiemHienTai, @maPhieuDatPhong) = 0
            )
                THROW 51004, N'Lịch mới có booking giao nhau', 1;

            IF @lenh = N'customer-reschedule' AND EXISTS (
                SELECT 1
                FROM dbo.DatDichVuKhachSan dichVuDat
                WHERE dichVuDat.maPhieuDatPhong = @maPhieuDatPhong
                    AND dichVuDat.trangThai IN (N'Chờ thanh toán', N'Đã xác nhận')
                    AND (
                        dichVuDat.thoiDiemDuKien < @thoiDiemNhanPhongMoi
                        OR dichVuDat.thoiDiemKetThuc > @thoiDiemThaoTac
                    )
            )
                THROW 53610, N'Không thể đổi ngày vì có dịch vụ đã đặt nằm ngoài kỳ lưu trú mới', 1;

            -- Khách yêu cầu gia hạn và trả cọc bổ sung.
            IF @lenh = N'customer-extend'
            BEGIN
                DECLARE @tienDatCocBoSung DECIMAL(12, 2);
                SELECT @tienDatCocBoSung = ROUND(SUM(dbo.fnTinhTongTienPhong(COALESCE(chiTiet.giaTheoNgayDaChot, loaiPhong.giaTheoNgay), COALESCE(chiTiet.giaTheoGioDaChot, loaiPhong.giaTheoGio), @thoiDiemTraPhongTruoc, @thoiDiemThaoTac, 0, 3)) * 0.5, 2)
                FROM dbo.ChiTietDatPhong chiTiet
                JOIN dbo.Phong phong
                    ON phong.maPhong = chiTiet.maPhong
                JOIN dbo.LoaiPhong loaiPhong
                    ON loaiPhong.maLoaiPhong = phong.maLoaiPhong
                WHERE chiTiet.maPhieuDatPhong = @maPhieuDatPhong;
                IF @tienDatCocBoSung <= 0
                    THROW 53425, N'Không tính được cọc bổ sung', 1;
                UPDATE dbo.PhieuDatPhong
                SET loaiThayDoiDangCho = N'Gia hạn',
                    thoiDiemNhanPhongTruocThayDoi = @thoiDiemNhanPhongTruoc,
                    thoiDiemTraPhongTruocThayDoi = @thoiDiemTraPhongTruoc,
                    tienDatCocTruocThayDoi = @tienDatCocTruoc,
                    tienDatCocBoSung = @tienDatCocBoSung,
                    tienDatCoc = @tienDatCocTruoc + @tienDatCocBoSung,
                    phuongThucBaoDam = N'VNPay',
                    maThanhToanDatCoc = @maYeuCauThanhToan,
                    thoiDiemHetHanThanhToanCoc = @thoiDiemHetHan,
                    trangThaiThanhToanCoc = N'Chờ thanh toán',
                    phienBan = phienBan + 1
                WHERE maPhieuDatPhong = @maPhieuDatPhong;
                UPDATE dbo.ChiTietDatPhong
                SET thoiDiemTraPhong = @thoiDiemThaoTac
                WHERE maPhieuDatPhong = @maPhieuDatPhong;
            END
            ELSE
            BEGIN
                UPDATE dbo.ChiTietDatPhong
                SET thoiDiemNhanPhong = @thoiDiemNhanPhongMoi, thoiDiemTraPhong = @thoiDiemThaoTac, thoiDiemTraPhongBanDau = @thoiDiemThaoTac
                WHERE maPhieuDatPhong = @maPhieuDatPhong;
                UPDATE dbo.PhieuDatPhong
                SET phienBan = phienBan + 1
                WHERE maPhieuDatPhong = @maPhieuDatPhong;
            END;
        END
        ELSE IF @lenh IN (N'cancel', N'no-show')
        BEGIN
            IF @trangThaiDatPhong NOT IN (N'Bản nháp', N'Chờ thanh toán', N'Đã xác nhận', N'Đã thanh toán cọc')
                THROW 53410, N'Trạng thái đặt phòng không hợp lệ', 1;
            IF @maTaiKhoanKhachHang IS NOT NULL
                AND @loaiThayDoiChoXacNhan IS NOT NULL
                THROW 53426, N'Booking đang chờ thanh toán cọc bổ sung', 1;
            IF @lenh = N'no-show'
                AND @thoiDiemHienTai < @thoiDiemTraPhongTruoc
                THROW 53427, N'Chỉ đánh dấu no-show sau khi lịch lưu trú kết thúc', 1;
            IF @lenh = N'cancel'
                AND NULLIF(LTRIM(RTRIM(@lyDo)), N'') IS NULL
                THROW 53428, N'Hủy booking phải có lý do', 1;
            IF @thoiDiemHienTai >= @thoiDiemTraPhongTruoc
                OR @lenh = N'no-show'
            BEGIN
                SET @trangThaiDatPhong = N'Không đến';
                SET @lyDo = COALESCE(@lyDo, N'Khách không đến trước khi kỳ lưu trú kết thúc');
            END
            ELSE
            BEGIN
                SET @trangThaiDatPhong = N'Đã hủy';
                IF @trangThaiDatCoc = N'Đã thanh toán' AND @thoiDiemHienTai >= DATEADD(HOUR, - 48, @thoiDiemNhanPhongTruoc)
                    SET @huyDatPhongMuon = 1;
            END;
            UPDATE dbo.PhieuDatPhong
            SET trangThai = @trangThaiDatPhong,
                lyDoHuy = LTRIM(RTRIM(@lyDo)),
                ketQuaHuy = CASE
                    WHEN @trangThaiDatPhong = N'Không đến'
                        OR @huyDatPhongMuon = 1 THEN N'Mất quyền hoàn tiền'
                    WHEN @trangThaiDatCoc = N'Đã thanh toán'
                        AND @tienDatCocTruoc > 0 THEN N'Hoàn tiền'
                    ELSE N'Không phát sinh hoàn tiền'
                END,
                phienBan = phienBan + 1
            WHERE maPhieuDatPhong = @maPhieuDatPhong;
            UPDATE dbo.ChiTietDatPhong
            SET trangThai = N'Đã hủy'
            WHERE maPhieuDatPhong = @maPhieuDatPhong;
            UPDATE dbo.DatDichVuKhachSan
            SET trangThai = N'Đã hủy'
            WHERE maPhieuDatPhong = @maPhieuDatPhong
                AND trangThai IN (N'Đã xác nhận', N'Chờ thanh toán');
            UPDATE dbo.YeuCauThanhToanVnpay
            SET trangThai = N'Đã hủy', thoiDiemHoanTat = @thoiDiemHienTai, phienBan = phienBan + 1
            WHERE maPhieuDatPhong = @maPhieuDatPhong
                AND trangThai = N'Chờ thanh toán';
            IF @huyDatPhongMuon = 1
            BEGIN
                SELECT @hangThanhVien = hangThanhVien
                FROM dbo.KhachLuuTru WITH (UPDLOCK, HOLDLOCK)
                WHERE maKhachLuuTru = @maKhachLuuTru;
                UPDATE dbo.KhachLuuTru
                SET soLanHuyMuon = soLanHuyMuon + 1,
                    biChanDatPhong = CASE
                        WHEN soLanHuyMuon + 1 >= 4 THEN 1
                        ELSE biChanDatPhong
                    END,
                    hangThanhVien = CASE
                        WHEN soLanHuyMuon + 1 > 2 THEN CASE hangThanhVien
                            WHEN N'Bạch kim' THEN N'Vàng'
                            WHEN N'Vàng' THEN N'Bạc'
                            ELSE N'Tiêu chuẩn'
                        END
                        ELSE hangThanhVien
                    END,
                    phienBan = phienBan + 1
                WHERE maKhachLuuTru = @maKhachLuuTru;
                SELECT @hangThanhVienMoi = hangThanhVien
                FROM dbo.KhachLuuTru
                WHERE maKhachLuuTru = @maKhachLuuTru;
                IF @hangThanhVien <> @hangThanhVienMoi
                    INSERT dbo.LichSuHangThanhVien(
                        maKhachLuuTru,
                        hangCu,
                        hangMoi,
                        lyDo,
                        thoiDiemThayDoi
                    )
                    VALUES (
                        @maKhachLuuTru,
                        @hangThanhVien,
                        @hangThanhVienMoi,
                        N'LATE_CANCELLATION',
                        @thoiDiemHienTai
                    );
            END;
        END

        -- Ghi dịch vụ dùng trong thời gian khách đang ở.
        ELSE IF @lenh = N'service'
        BEGIN
            IF @trangThaiDatPhong <> N'Đã nhận phòng'
                THROW 53410, N'Chỉ booking đang ở mới được dùng dịch vụ', 1;
            DECLARE @giaDichVu DECIMAL(12, 2), @tonKhoDichVu INT, @dichVuConHoatDong BIT,
                @conTheSuDungDichVu BIGINT, @maNguonTonKhoDichVu NVARCHAR(10),
                @khoaTonKhoDichVu INT, @taiNguyenTonKhoDichVu NVARCHAR(255);
            SELECT @maNguonTonKhoDichVu = COALESCE(maNguonTaiNguyen, maDichVu)
            FROM dbo.DichVu
            WHERE maDichVu = @maDichVu;
            IF @maNguonTonKhoDichVu IS NULL
                THROW 53429, N'Không tìm thấy dịch vụ', 1;
            SET @taiNguyenTonKhoDichVu = N'service-booking:' + @maNguonTonKhoDichVu;
            EXEC @khoaTonKhoDichVu = sys.sp_getapplock
                @Resource = @taiNguyenTonKhoDichVu,
                @LockMode = 'Exclusive',
                @LockOwner = 'Transaction',
                @LockTimeout = 10000;
            IF @khoaTonKhoDichVu < 0
                THROW 51005, N'Dịch vụ đang được xử lý, vui lòng thử lại', 1;
            SELECT @giaDichVu = gia,
                @tonKhoDichVu = soLuongTonKho,
                @dichVuConHoatDong = dangHoatDong
            FROM dbo.DichVu WITH (UPDLOCK, HOLDLOCK)
            WHERE maDichVu = @maDichVu;
            IF @tonKhoDichVu IS NULL
                THROW 53429, N'Không tìm thấy dịch vụ', 1;
            IF @dichVuConHoatDong <> 1
                OR @giaDichVu <= 0
                THROW 53430, N'Dịch vụ đã ngừng bán hoặc chưa niêm yết giá', 1;
            IF @soLuong IS NULL
                OR @soLuong <= 0
                THROW 51008, N'Số lượng phải lớn hơn 0', 1;
            SELECT @conTheSuDungDichVu = conLai
            FROM dbo.fnKhaDungDichVu(
                COALESCE(@thoiDiemHienTai, @thoiDiemThaoTac, SYSDATETIME()),
                CONVERT(DATETIME2(6), '9999-12-31T23:59:59.999999')
            )
            WHERE maDichVu = @maDichVu;
            IF @tonKhoDichVu < @soLuong OR COALESCE(@conTheSuDungDichVu, 0) < @soLuong
                THROW 51006, N'Tồn kho không đủ', 1;
            DECLARE @ngaySuDungDichVu DATE = CAST(COALESCE(@thoiDiemThaoTac, @thoiDiemHienTai) AS DATE);
            IF EXISTS (
                SELECT 1
                FROM dbo.SuDungDichVu WITH (UPDLOCK, HOLDLOCK)
                WHERE maPhieuDatPhong = @maPhieuDatPhong
                    AND maDichVu = @maDichVu
                    AND ngaySuDung = @ngaySuDungDichVu
            )
                UPDATE dbo.SuDungDichVu
                SET soLuong = soLuong + @soLuong
                WHERE maPhieuDatPhong = @maPhieuDatPhong
                    AND maDichVu = @maDichVu
                    AND ngaySuDung = @ngaySuDungDichVu;
            ELSE
                INSERT dbo.SuDungDichVu(
                    maPhieuDatPhong,
                    maDichVu,
                    ngaySuDung,
                    soLuong,
                    donGia
                )
                VALUES (
                    @maPhieuDatPhong,
                    @maDichVu,
                    @ngaySuDungDichVu,
                    @soLuong,
                    @giaDichVu
                );
            UPDATE dbo.DichVu
            SET soLuongTonKho = soLuongTonKho - @soLuong
            WHERE maDichVu = @maDichVu
                AND soLuongTonKho >= @soLuong;
            IF @@ROWCOUNT <> 1
                THROW 51006, N'Tồn kho không đủ', 1;
            INSERT dbo.BienDongKhoDichVu(
                maDichVu,
                loai,
                soLuong,
                maNguoiThucHien,
                thoiDiemPhatSinh,
                lyDo
            )
            VALUES (
                @maDichVu,
                N'Xuất kho',
                @soLuong,
                @nguoiThucHien,
                @thoiDiemHienTai,
                N'RESERVATION_SERVICE:' + CONVERT(NVARCHAR(20), @maPhieuDatPhong)
            );
        END
        ELSE
            THROW 51008, N'Lệnh đặt phòng không hợp lệ', 1;

        -- Ghi đúng sự kiện của lệnh vừa xử lý trong cùng giao dịch.
        INSERT dbo.NhatKyKiemSoat(
            nguoiThucHien,
            hanhDong,
            loaiDoiTuong,
            maDoiTuong,
            duLieuSau,
            lyDo
        )
        VALUES (
            @nguoiThucHien,
            CASE @lenh
                WHEN N'receive-deposit' THEN N'RESERVATION_CASH_DEPOSIT_RECEIVED'
                WHEN N'check-in' THEN N'RESERVATION_CHECKED_IN'
                WHEN N'extend' THEN N'RESERVATION_EXTENDED'
                WHEN N'update' THEN N'RESERVATION_UPDATED'
                WHEN N'cancel' THEN CASE
                    WHEN @trangThaiDatPhong = N'Không đến' THEN N'RESERVATION_NO_SHOW'
                    ELSE N'RESERVATION_CANCELLED'
                END
                WHEN N'no-show' THEN N'RESERVATION_NO_SHOW'
                WHEN N'service' THEN N'SERVICE_ADDED'
                WHEN N'customer-extend' THEN N'CUSTOMER_RESERVATION_EXTENSION_REQUESTED'
                ELSE N'CUSTOMER_RESERVATION_RESCHEDULED'
            END,
            N'RESERVATION',
            CONVERT(NVARCHAR(100), @maPhieuDatPhong),
            COALESCE(CONVERT(NVARCHAR(40), @thoiDiemThaoTac, 126), @trangThaiDatPhong),
            @lyDo
        );
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF CURSOR_STATUS('local', 'duyetKhoaPhong') >= - 1
        BEGIN
            IF CURSOR_STATUS('local', 'duyetKhoaPhong') > - 1
                CLOSE duyetKhoaPhong;
            DEALLOCATE duyetKhoaPhong;
        END;
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

-- =============================================================================
-- uspChuyenPhong
-- Chuyển khách đang ở sang phòng trống và ghi lại lịch sử chuyển phòng.
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
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;
        IF @maPhongCu = @maPhongMoi
            THROW 51008, N'Phòng đích phải khác phòng nguồn', 1;
        IF NOT EXISTS (
            SELECT 1
            FROM dbo.PhieuDatPhong WITH (UPDLOCK, HOLDLOCK)
            WHERE maPhieuDatPhong = @maPhieuDatPhong
                AND trangThai = N'Đã nhận phòng'
        )
            THROW 51002, N'Chỉ chuyển phòng cho booking đã nhận phòng', 1;
        DECLARE @maPhongKhoa NVARCHAR(10);
        DECLARE khoaHaiPhong CURSOR LOCAL FAST_FORWARD FOR
            SELECT maPhong
            FROM (VALUES (@maPhongCu),(@maPhongMoi)) haiPhong(maPhong)
            ORDER BY maPhong;
        OPEN khoaHaiPhong;
        FETCH NEXT FROM khoaHaiPhong INTO @maPhongKhoa;
        WHILE @@FETCH_STATUS = 0
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM dbo.Phong WITH (UPDLOCK, HOLDLOCK)
                WHERE maPhong = @maPhongKhoa
            )
            BEGIN
                CLOSE khoaHaiPhong;
                DEALLOCATE khoaHaiPhong;
                THROW 51001, N'Không tìm thấy phòng', 1;
            END;
            FETCH NEXT FROM khoaHaiPhong INTO @maPhongKhoa;
        END;
        CLOSE khoaHaiPhong;
        DEALLOCATE khoaHaiPhong;
        DECLARE @nhan DATETIME2(6),
            @tra DATETIME2(6),
            @traGoc DATETIME2(6),
            @soKhach INT,
            @soKhachToiDa INT,
            @soLan INT,
            @giaTheoNgayDaChot DECIMAL(12, 2),
            @giaTheoGioDaChot DECIMAL(12, 2);
        SELECT @nhan = thoiDiemNhanPhong,
            @tra = thoiDiemTraPhong,
            @traGoc = thoiDiemTraPhongBanDau,
            @soKhach = soLuongKhach,
            @soLan = soLanChuyenPhong,
            @giaTheoNgayDaChot = giaTheoNgayDaChot,
            @giaTheoGioDaChot = giaTheoGioDaChot
        FROM dbo.ChiTietDatPhong WITH (UPDLOCK, HOLDLOCK)
        WHERE maPhieuDatPhong = @maPhieuDatPhong
            AND maPhong = @maPhongCu
            AND trangThai = N'Đang có khách';
        IF @tra IS NULL
            THROW 51001, N'Phòng nguồn không thuộc booking đang ở', 1;
        IF @thoiDiemChuyen <= @nhan
            OR @thoiDiemChuyen >= @tra
            THROW 51008, N'Thời điểm chuyển phòng không hợp lệ', 1;
        IF NOT EXISTS (
            SELECT 1
            FROM dbo.Phong
            WHERE maPhong = @maPhongMoi
                AND trangThai = N'Sẵn sàng'
        )
            THROW 51002, N'Phòng đích không sẵn sàng', 1;
        IF EXISTS (
            SELECT 1
            FROM dbo.ChiTietDatPhong
            WHERE maPhieuDatPhong = @maPhieuDatPhong
                AND maPhong = @maPhongMoi
        )
            THROW 51009, N'Phòng đích đã có trong lịch sử booking này; hãy chọn phòng khác', 1;
        SELECT @soKhachToiDa = loaiPhong.soKhachToiDa
        FROM dbo.Phong phong
        JOIN dbo.LoaiPhong loaiPhong
            ON loaiPhong.maLoaiPhong = phong.maLoaiPhong
        WHERE phong.maPhong = @maPhongMoi;
        IF @soKhach > @soKhachToiDa
            THROW 51004, N'Số khách vượt sức chứa của phòng đích', 1;
        IF EXISTS (
            SELECT 1
            FROM dbo.DatDichVuKhachSan dichVuDat
            WHERE dichVuDat.maPhieuDatPhong = @maPhieuDatPhong
                AND dichVuDat.maPhong = @maPhongCu
                AND dichVuDat.trangThai IN (N'Chờ thanh toán', N'Đã xác nhận')
                AND dichVuDat.thoiDiemDuKien < @tra
                AND dichVuDat.thoiDiemKetThuc > @thoiDiemChuyen
        )
            THROW 53610, N'Không thể chuyển phòng khi còn dịch vụ đã đặt trong thời gian sau lúc chuyển', 1;
        IF dbo.fnKiemTraPhongTrong(@maPhongMoi, @thoiDiemChuyen, @tra, @thoiDiemHienTai, @maPhieuDatPhong) = 0
            THROW 51004, N'Phòng đích có lịch giao nhau', 1;
        UPDATE dbo.ChiTietDatPhong
        SET thoiDiemTraPhong = @thoiDiemChuyen,
            thoiDiemTraPhongBanDau = @thoiDiemChuyen,
            trangThai = N'Đã hủy',
            soLanChuyenPhong = @soLan + 1
        WHERE maPhieuDatPhong = @maPhieuDatPhong
            AND maPhong = @maPhongCu;
        INSERT INTO dbo.ChiTietDatPhong(
            maPhieuDatPhong,
            maPhong,
            thoiDiemNhanPhong,
            thoiDiemTraPhong,
            thoiDiemTraPhongBanDau,
            giaTheoNgayDaChot,
            giaTheoGioDaChot,
            trangThai,
            soLanChuyenPhong,
            soLuongKhach
        )
        VALUES (
            @maPhieuDatPhong,
            @maPhongMoi,
            @thoiDiemChuyen,
            @tra,
            CASE
                WHEN @traGoc > @thoiDiemChuyen THEN @traGoc
                ELSE @thoiDiemChuyen
            END,
            @giaTheoNgayDaChot,
            @giaTheoGioDaChot,
            N'Đang có khách',
            0,
            @soKhach
        );
        UPDATE dbo.Phong
        SET trangThai = N'Đang dọn phòng', phienBan = phienBan + 1
        WHERE maPhong = @maPhongCu;
        UPDATE dbo.Phong
        SET trangThai = N'Đang có khách', phienBan = phienBan + 1
        WHERE maPhong = @maPhongMoi;
        INSERT INTO dbo.ChuyenPhong(
            maPhieuDatPhong,
            maPhongCu,
            maPhongMoi,
            thoiDiemChuyenPhong,
            lyDo
        )
        VALUES (
            @maPhieuDatPhong,
            @maPhongCu,
            @maPhongMoi,
            @thoiDiemChuyen,
            @lyDo
        );
        INSERT INTO dbo.NhatKyKiemSoat(
            nguoiThucHien,
            hanhDong,
            loaiDoiTuong,
            maDoiTuong,
            duLieuTruoc,
            duLieuSau,
            lyDo
        )
        VALUES (
            @nguoiThucHien,
            N'ROOM_TRANSFERRED',
            N'RESERVATION',
            CONVERT(NVARCHAR(100), @maPhieuDatPhong),
            @maPhongCu,
            @maPhongMoi,
            @lyDo
        );
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF CURSOR_STATUS('local', 'khoaHaiPhong') >= - 1
        BEGIN
            IF CURSOR_STATUS('local', 'khoaHaiPhong') > - 1
                CLOSE khoaHaiPhong;
            DEALLOCATE khoaHaiPhong;
        END;
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

-- =============================================================================
-- uspXacNhanSuDungDichVu
-- Xác nhận dịch vụ đã dùng, trừ tồn kho và ghi nhật ký trong cùng giao dịch.
-- =============================================================================
CREATE PROCEDURE dbo.uspXacNhanSuDungDichVu
    @maDatDichVuKhachSan BIGINT,
    @nguoiThucHien NVARCHAR(50),
    @thoiDiemHienTai DATETIME2(6),
    @maPhieuDuKien BIGINT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;
        DECLARE @maPhieu BIGINT,
            @maDichVu NVARCHAR(10),
            @soLuong INT,
            @trangThai NVARCHAR(20),
            @duKien DATETIME2(6),
            @trangThaiPhong NVARCHAR(30);
        SELECT @maPhieu = maPhieuDatPhong
        FROM dbo.DatDichVuKhachSan
        WHERE maDatDichVuKhachSan = @maDatDichVuKhachSan;
        IF @maPhieu IS NULL
            OR (
                @maPhieuDuKien IS NOT NULL
                AND @maPhieu <> @maPhieuDuKien
            )
            THROW 51101, N'Không tìm thấy dịch vụ trong booking', 1;
        DECLARE @serviceLock INT,@serviceResource NVARCHAR(255);
        SELECT @serviceResource=N'service-booking:'+COALESCE(d.maNguonTaiNguyen,d.maDichVu)
        FROM dbo.DatDichVuKhachSan b JOIN dbo.DichVu d ON d.maDichVu=b.maDichVu WHERE b.maDatDichVuKhachSan=@maDatDichVuKhachSan;
        EXEC @serviceLock=sys.sp_getapplock @Resource=@serviceResource,@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=10000;
        IF @serviceLock<0 THROW 51005,N'Dịch vụ đang được xử lý',1;
        SELECT @trangThaiPhong = trangThai
        FROM dbo.PhieuDatPhong WITH (UPDLOCK, HOLDLOCK)
        WHERE maPhieuDatPhong = @maPhieu;
        IF @trangThaiPhong <> N'Đã nhận phòng'
            THROW 51002, N'Khách phải nhận phòng trước khi dùng dịch vụ', 1;
        SELECT @maDichVu = maDichVu,
            @soLuong = soLuong,
            @trangThai = trangThai,
            @duKien = thoiDiemDuKien
        FROM dbo.DatDichVuKhachSan WITH (UPDLOCK, HOLDLOCK)
        WHERE maDatDichVuKhachSan = @maDatDichVuKhachSan;
        IF @trangThai = N'Đã sử dụng'
        BEGIN
            COMMIT;
            RETURN;
        END;
        IF @trangThai <> N'Đã xác nhận'
            THROW 51002, N'Dịch vụ chưa được xác nhận hoặc đã kết thúc', 1;
        IF @duKien > @thoiDiemHienTai
            THROW 51102, N'Chưa đến thời gian sử dụng dịch vụ', 1;
        IF (SELECT laTaiNguyen FROM dbo.DichVu WHERE maDichVu=@maDichVu)=0
        BEGIN
        UPDATE dbo.DichVu WITH (UPDLOCK, HOLDLOCK)
        SET soLuongTonKho = soLuongTonKho - @soLuong
        WHERE maDichVu = @maDichVu
            AND dangHoatDong = 1
            AND soLuongTonKho >= @soLuong;
        IF @@ROWCOUNT <> 1
            THROW 51006, N'Dịch vụ đã hết khả dụng', 1;
        END;
        UPDATE dbo.DatDichVuKhachSan
        SET trangThai = N'Đã sử dụng', thoiDiemSuDung = @thoiDiemHienTai, nguoiXacNhanSuDung = @nguoiThucHien
        WHERE maDatDichVuKhachSan = @maDatDichVuKhachSan;
        IF (SELECT laTaiNguyen FROM dbo.DichVu WHERE maDichVu=@maDichVu)=0
        INSERT dbo.BienDongKhoDichVu(
            maDichVu,
            loai,
            soLuong,
            maNguoiThucHien,
            thoiDiemPhatSinh,
            lyDo
        )
        VALUES (
            @maDichVu,
            N'Xuất kho',
            @soLuong,
            @nguoiThucHien,
            @thoiDiemHienTai,
            N'HOTEL_SERVICE_BOOKING:' + CONVERT(NVARCHAR(30), @maDatDichVuKhachSan)
        );
        INSERT dbo.NhatKyKiemSoat(
            nguoiThucHien,
            hanhDong,
            loaiDoiTuong,
            maDoiTuong,
            duLieuSau
        )
        VALUES (
            @nguoiThucHien,
            N'HOTEL_SERVICE_USED',
            N'RESERVATION',
            CONVERT(NVARCHAR(100), @maPhieu),
            CONVERT(NVARCHAR(100), @maDatDichVuKhachSan)
        );
        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK;
        THROW;
    END CATCH;
END;
GO

-- =============================================================================
-- uspHuyDatDichVu
-- Hủy dịch vụ chưa sử dụng sau khi kiểm tra booking và chủ tài khoản.
-- =============================================================================
CREATE PROCEDURE dbo.uspHuyDatDichVu
    @maDatDichVuKhachSan BIGINT,
    @nguoiThucHien NVARCHAR(50),
    @maTaiKhoan BIGINT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;
        DECLARE @maPhieu BIGINT, @maTaiKhoanChuDatPhong BIGINT, @trangThai NVARCHAR(20);
        SELECT @maPhieu = maPhieuDatPhong
        FROM dbo.DatDichVuKhachSan
        WHERE maDatDichVuKhachSan = @maDatDichVuKhachSan;
        SELECT @maTaiKhoanChuDatPhong = maTaiKhoanKhachHang
        FROM dbo.PhieuDatPhong WITH (UPDLOCK, HOLDLOCK)
        WHERE maPhieuDatPhong = @maPhieu;
        IF @maPhieu IS NULL
            OR (
                @maTaiKhoan IS NOT NULL
                AND (
                    @maTaiKhoanChuDatPhong IS NULL
                    OR @maTaiKhoanChuDatPhong <> @maTaiKhoan
                )
            )
            THROW 51101, N'Không tìm thấy dịch vụ', 1;
        SELECT @trangThai = trangThai
        FROM dbo.DatDichVuKhachSan WITH (UPDLOCK, HOLDLOCK)
        WHERE maDatDichVuKhachSan = @maDatDichVuKhachSan;
        IF @trangThai = N'Đã sử dụng'
            THROW 51002, N'Dịch vụ đã sử dụng không thể hủy', 1;
        IF @trangThai IN (N'Đã xác nhận',N'Chờ thanh toán')
        BEGIN
            UPDATE dbo.DatDichVuKhachSan
            SET trangThai = N'Đã hủy'
            WHERE maDatDichVuKhachSan = @maDatDichVuKhachSan;
            INSERT dbo.NhatKyKiemSoat(
                nguoiThucHien,
                hanhDong,
                loaiDoiTuong,
                maDoiTuong,
                duLieuSau
            )
            VALUES (
                @nguoiThucHien,
                N'HOTEL_SERVICE_CANCELLED',
                N'RESERVATION',
                CONVERT(NVARCHAR(100), @maPhieu),
                CONVERT(NVARCHAR(100), @maDatDichVuKhachSan)
            );
        END;
        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK;
        THROW;
    END CATCH;
END;
GO

-- =============================================================================
-- uspDieuChinhTonKho
-- Cập nhật tồn kho mặt hàng và ghi biến động; không cho tồn kho âm.
-- =============================================================================

-- =============================================================================
-- uspPhanCongCa
-- Phân công ca cho nhân viên sau khi khóa nhân viên và kiểm tra trùng giờ.
-- =============================================================================
CREATE PROCEDURE dbo.uspPhanCongCa
    @maNhanVien NVARCHAR(10),
    @ngayLamCa DATE,
    @maCa NVARCHAR(30),
    @thoiDiemBatDau DATETIME2(6),
    @thoiDiemKetThuc DATETIME2(6),
    @nguoiThucHien NVARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;
        IF @thoiDiemBatDau >= @thoiDiemKetThuc
            OR CAST(@thoiDiemBatDau AS DATE) <> @ngayLamCa
            THROW 51008, N'Khoảng ca không hợp lệ', 1;

        -- Cho phép lưu ca lịch sử; khi tính nhân sự trực sẽ loại nhân viên không sẵn sàng.
        IF NOT EXISTS (
            SELECT 1
            FROM dbo.NhanVien WITH (UPDLOCK, HOLDLOCK)
            WHERE maNhanVien = @maNhanVien
        )
            THROW 51301, N'Không tìm thấy nhân viên', 1;
        IF dbo.fnKiemTraTrungCaLamViec(@maNhanVien, @thoiDiemBatDau, @thoiDiemKetThuc, NULL) = 1
            THROW 51004, N'Nhân viên đã có ca trùng thời gian', 1;
        INSERT dbo.CaLamViecNhanVien(
            maNhanVien,
            ngayLamCa,
            maCa,
            thoiDiemBatDau,
            thoiDiemKetThuc,
            trangThai,
            nguoiTao
        )
        VALUES (
            @maNhanVien,
            @ngayLamCa,
            @maCa,
            @thoiDiemBatDau,
            @thoiDiemKetThuc,
            N'Đã phân công',
            @nguoiThucHien
        );
        DECLARE @ma BIGINT = SCOPE_IDENTITY();
        INSERT dbo.NhatKyKiemSoat(
            nguoiThucHien,
            hanhDong,
            loaiDoiTuong,
            maDoiTuong,
            duLieuSau
        )
        VALUES (
            @nguoiThucHien,
            N'EMPLOYEE_SHIFT_ASSIGNED',
            N'EMPLOYEE_SHIFT',
            CONVERT(NVARCHAR(100), @ma),
            @maNhanVien
        );
        COMMIT TRANSACTION;
        SELECT @ma AS maCaLamViecNhanVien;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

-- =============================================================================
-- uspDatDichVuKhachSan
-- Đặt dịch vụ theo booking/phòng, tính phần miễn phí và chống yêu cầu trùng.
-- =============================================================================
CREATE PROCEDURE dbo.uspDatDichVuKhachSan
    @maPhieu BIGINT,
    @maPhong NVARCHAR(10),
    @maDichVu NVARCHAR(10),
    @duKien DATETIME2(6),
    @soLuong INT,
    @buoiAn NVARCHAR(10),
    @ghiChu NVARCHAR(500),
    @khoa NVARCHAR(100),
    @bam NCHAR(64),
    @nguoiThucHien NVARCHAR(50),
    @maTaiKhoan BIGINT,
    @taiQuay BIT,
    @hienTai DATETIME2(6)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;
        IF @soLuong IS NULL
            OR @soLuong < 1
            OR @duKien IS NULL
            THROW 51103, N'Thiếu thông tin đặt dịch vụ', 1;
        IF @maDichVu = N'MAMREST'
            AND (
                @buoiAn IS NULL
                OR @buoiAn NOT IN (N'Bữa trưa', N'Bữa tối')
            )
            THROW 51104, N'Chọn bữa trưa hoặc bữa tối', 1;
        IF @maDichVu <> N'MAMREST'
            AND @buoiAn IS NOT NULL
            THROW 51105, N'Dịch vụ này không dùng loại bữa ăn', 1;
        IF @maDichVu = N'POOL'
            AND @taiQuay = 0
            THROW 51106, N'Hồ bơi chỉ cần xem thông tin, không đặt trước', 1;

        -- Khóa riêng theo mã yêu cầu để tuần tự hóa lần gọi trùng mà không khóa booking khác.
        DECLARE @ketQuaKhoaChongTrung INT;
        DECLARE @taiNguyenKhoaChongTrung NVARCHAR(255) = N'hotel-service:' + @khoa;
        EXEC @ketQuaKhoaChongTrung = sys.sp_getapplock @Resource = @taiNguyenKhoaChongTrung,
            @LockMode = 'Exclusive',
            @LockOwner = 'Transaction',
            @LockTimeout = 10000;
        IF @ketQuaKhoaChongTrung < 0
            THROW 51005, N'Không thể khóa mã yêu cầu', 1;
        DECLARE @maDatDichVu BIGINT, @maBamYeuCauDaLuu NCHAR(64), @nguoiThucHienDaLuu NVARCHAR(80);
        SELECT @maDatDichVu = maDatDichVuKhachSan,
            @maBamYeuCauDaLuu = maBamYeuCau,
            @nguoiThucHienDaLuu = nguoiTao
        FROM dbo.DatDichVuKhachSan
        WHERE khoaYeuCau = @khoa;

        -- Yêu cầu trùng chỉ được dùng lại nếu actor và nội dung khớp lần đầu.
        IF @maDatDichVu IS NOT NULL
        BEGIN
            IF @maBamYeuCauDaLuu <> @bam
                OR @nguoiThucHienDaLuu <> @nguoiThucHien
                THROW 51005, N'Mã yêu cầu đã dùng cho thao tác khác', 1;
            IF @taiQuay = 1
                EXEC dbo.uspXacNhanSuDungDichVu @maDatDichVu,
                    @nguoiThucHien,
                    @hienTai,
                    @maPhieu;
            COMMIT;
            SELECT @maDatDichVu AS maDatDichVuKhachSan;
            RETURN;
        END;

        DECLARE @lock INT,@pool NVARCHAR(10),@resource NVARCHAR(255);
        SELECT @pool=COALESCE(maNguonTaiNguyen,maDichVu) FROM dbo.DichVu WHERE maDichVu=@maDichVu;
        SET @resource=N'service-booking:'+COALESCE(@pool,@maDichVu);
        EXEC @lock=sys.sp_getapplock @Resource=@resource,@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=10000;
        IF @lock<0 THROW 51005,N'Dịch vụ đang được đặt, vui lòng thử lại',1;
        UPDATE dbo.DatDichVuKhachSan SET trangThai=N'Hết hạn'
        WHERE maDichVu=@maDichVu AND trangThai=N'Chờ thanh toán' AND hanThanhToan<=@hienTai;
        -- Khóa booking và chi tiết phòng rồi kiểm tra chủ tài khoản/kỳ lưu trú.
        DECLARE @trangThaiDatPhong NVARCHAR(30),
            @hinhThucThue NVARCHAR(20),
            @trangThaiDatCoc NVARCHAR(20),
            @maTaiKhoanKhachHang BIGINT,
            @thoiDiemNhanPhong DATETIME2(6),
            @thoiDiemTraPhong DATETIME2(6),
            @soKhach INT;
        SELECT @trangThaiDatPhong = trangThai,
            @hinhThucThue = hinhThucThue,
            @trangThaiDatCoc = trangThaiThanhToanCoc,
            @maTaiKhoanKhachHang = maTaiKhoanKhachHang
        FROM dbo.PhieuDatPhong WITH (UPDLOCK, HOLDLOCK)
        WHERE maPhieuDatPhong = @maPhieu;
        SELECT @thoiDiemNhanPhong = thoiDiemNhanPhong,
            @thoiDiemTraPhong = thoiDiemTraPhong,
            @soKhach = soLuongKhach
        FROM dbo.ChiTietDatPhong WITH (UPDLOCK, HOLDLOCK)
        WHERE maPhieuDatPhong = @maPhieu
            AND maPhong = @maPhong;
        IF @trangThaiDatPhong IS NULL
            OR @thoiDiemNhanPhong IS NULL
            OR (
                @maTaiKhoan IS NOT NULL
                AND (
                    @maTaiKhoanKhachHang IS NULL
                    OR @maTaiKhoanKhachHang <> @maTaiKhoan
                )
            )
            THROW 51001, N'Không tìm thấy phòng trong booking của khách', 1;
        IF @trangThaiDatPhong NOT IN (N'Đã thanh toán cọc', N'Đã xác nhận', N'Đã nhận phòng')
            THROW 51002, N'Booking chưa xác nhận tiền cọc', 1;
        IF @maTaiKhoan IS NOT NULL
            AND @trangThaiDatCoc <> N'Đã thanh toán'
            THROW 51107, N'Cần xác nhận tiền cọc trước khi đặt dịch vụ', 1;
        IF @taiQuay = 1
            AND @trangThaiDatPhong <> N'Đã nhận phòng'
            THROW 51002, N'Khách chưa nhận phòng', 1;
        IF @duKien < @thoiDiemNhanPhong
            OR @duKien >= @thoiDiemTraPhong
            THROW 51108, N'Thời gian dịch vụ phải nằm trong kỳ lưu trú', 1;
        DECLARE @giaDichVu DECIMAL(12, 2), @tonKhoDichVu INT,@phut INT,@resourceType BIT,@ketThuc DATETIME2(6);
        SELECT @giaDichVu = gia,
            @tonKhoDichVu = soLuongTonKho,@phut=thoiLuongPhut,@resourceType=laTaiNguyen
        FROM dbo.DichVu WITH (UPDLOCK, HOLDLOCK)
        WHERE maDichVu = @maDichVu
            AND dangHoatDong = 1;
        IF @giaDichVu IS NULL
            THROW 51109, N'Dịch vụ không còn phục vụ', 1;
        IF @giaDichVu <= 0
            THROW 51110, N'Dịch vụ chưa có giá niêm yết', 1;
        IF @resourceType=0 AND @tonKhoDichVu < @soLuong
            THROW 51006, N'Dịch vụ đã hết khả dụng', 1;

        IF @maTaiKhoan IS NOT NULL AND @duKien<@hienTai
            THROW 51108,N'Không đặt dịch vụ trong quá khứ',1;
        SET @ketThuc=DATEADD(MINUTE,@phut,@duKien);
        IF @ketThuc>@thoiDiemTraPhong THROW 51108,N'Dịch vụ kết thúc ngoài kỳ lưu trú',1;
        DECLARE @available BIGINT;
        SELECT @available=conLai FROM dbo.fnKhaDungDichVu(@duKien,@ketThuc) WHERE maDichVu=@maDichVu;
        IF @available IS NULL OR @available<CASE WHEN @resourceType=1 THEN 1 ELSE @soLuong END
            THROW 51006,N'Dịch vụ đã hết chỗ trong khoảng giờ này',1;
        -- Tính hạn mức miễn phí theo hình thức thuê, dịch vụ và số khách.
        DECLARE @dinhMucMienPhi INT = CASE
            WHEN @hinhThucThue = N'Theo gói' THEN CASE
                WHEN @maDichVu IN (N'BREAKFAST', N'MAMREST', N'POOL') THEN @soKhach
                WHEN @maDichVu = N'LNDRYSTD' THEN 1
                ELSE 0
            END
            ELSE 0
        END;
        DECLARE @soLuongMienPhiDaDat INT = 0, @soLuongMienPhiDaDung INT = 0, @soLuongMienPhi INT = 0;
        IF @dinhMucMienPhi > 0
        BEGIN
            IF @maDichVu <> N'POOL'
            BEGIN
                SELECT @soLuongMienPhiDaDat = COALESCE(SUM(soLuongMienPhi), 0)
                FROM dbo.DatDichVuKhachSan
                WHERE maPhieuDatPhong = @maPhieu
                    AND maPhong = @maPhong
                    AND maDichVu = @maDichVu
                    AND CAST(thoiDiemDuKien AS DATE) = CAST(@duKien AS DATE)
                    AND (
                        buoiAn = @buoiAn
                        OR (
                            buoiAn IS NULL
                            AND @buoiAn IS NULL
                        )
                    )
                    AND (trangThai IN (N'Đã xác nhận', N'Đã sử dụng') OR (trangThai=N'Chờ thanh toán' AND hanThanhToan>@hienTai));
                IF @maDichVu IN (N'BREAKFAST', N'LNDRYSTD')
                    SELECT @soLuongMienPhiDaDung = COALESCE(SUM(soLuong), 0)
                    FROM dbo.SuDungDichVu
                    WHERE maPhieuDatPhong = @maPhieu
                        AND maDichVu = @maDichVu
                        AND ngaySuDung = CAST(@duKien AS DATE)
                        AND donGia = 0;
            END;
            SET @soLuongMienPhi = @dinhMucMienPhi - @soLuongMienPhiDaDat - @soLuongMienPhiDaDung;
            IF @soLuongMienPhi < 0
                SET @soLuongMienPhi = 0;
            IF @soLuongMienPhi > @soLuong
                SET @soLuongMienPhi = @soLuong;
        END;

        -- Lưu số lượng miễn phí riêng; phần còn lại dùng đơn giá đã đọc dưới khóa.
        INSERT dbo.DatDichVuKhachSan(
            maPhieuDatPhong,
            maPhong,
            maDichVu,
            thoiDiemDuKien,
            buoiAn,
            soLuong,
            soLuongMienPhi,
            donGia,
            trangThai,
            ghiChu,thoiDiemKetThuc,hanThanhToan,
            khoaYeuCau,
            maBamYeuCau,
            nguoiTao
        )
        VALUES (
            @maPhieu,
            @maPhong,
            @maDichVu,
            @duKien,
            @buoiAn,
            @soLuong,
            @soLuongMienPhi,
            @giaDichVu,
            CASE WHEN @maTaiKhoan IS NOT NULL AND @soLuong>@soLuongMienPhi THEN N'Chờ thanh toán' ELSE N'Đã xác nhận' END,
            @ghiChu,@ketThuc,CASE WHEN @maTaiKhoan IS NOT NULL AND @soLuong>@soLuongMienPhi THEN DATEADD(MINUTE,10,@hienTai) END,
            @khoa,
            @bam,
            @nguoiThucHien
        );
        SET @maDatDichVu = CONVERT(BIGINT, SCOPE_IDENTITY());
        INSERT dbo.NhatKyKiemSoat(
            nguoiThucHien,
            hanhDong,
            loaiDoiTuong,
            maDoiTuong,
            duLieuSau
        )
        VALUES (
            @nguoiThucHien,
            N'HOTEL_SERVICE_BOOKED',
            N'RESERVATION',
            CONVERT(NVARCHAR(100), @maPhieu),
            CONVERT(NVARCHAR(100), @maDatDichVu)
        );
        IF @taiQuay = 1
            EXEC dbo.uspXacNhanSuDungDichVu @maDatDichVu,
                @nguoiThucHien,
                @hienTai,
                @maPhieu;
        COMMIT;
        SELECT @maDatDichVu AS maDatDichVuKhachSan;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK;
        THROW;
    END CATCH;
END;
GO

-- =============================================================================
-- uspHuyDichVuTheoDatPhong
-- Hủy toàn bộ dịch vụ chưa dùng của booking và ghi số lượng đã hủy.
-- =============================================================================
CREATE PROCEDURE dbo.uspHuyDichVuTheoDatPhong
    @maPhieu BIGINT,
    @nguoiThucHien NVARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;
        DECLARE @maDatDichVu BIGINT, @soLuong INT;
        SELECT @maDatDichVu = maPhieuDatPhong
        FROM dbo.PhieuDatPhong WITH (UPDLOCK, HOLDLOCK)
        WHERE maPhieuDatPhong = @maPhieu;
        UPDATE dbo.DatDichVuKhachSan
        SET trangThai = N'Đã hủy'
        WHERE maPhieuDatPhong = @maPhieu
            AND trangThai IN (N'Đã xác nhận',N'Chờ thanh toán');
        SET @soLuong = @@ROWCOUNT;
        IF @soLuong > 0
            INSERT dbo.NhatKyKiemSoat(
                nguoiThucHien,
                hanhDong,
                loaiDoiTuong,
                maDoiTuong,
                duLieuSau
            )
            VALUES (
                @nguoiThucHien,
                N'HOTEL_SERVICES_CANCELLED',
                N'RESERVATION',
                CONVERT(NVARCHAR(100), @maPhieu),
                CONVERT(NVARCHAR(100), @soLuong)
            );
        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK;
        THROW;
    END CATCH;
END;
GO

-- =============================================================================
-- uspCapNhatDoiSoatOta
-- Cập nhật trạng thái đối soát cho booking từ kênh OTA.
-- =============================================================================
CREATE PROCEDURE dbo.uspCapNhatDoiSoatOta
    @maPhieu BIGINT,
    @trangThai NVARCHAR(30)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;
        UPDATE dbo.PhieuDatPhong
        SET trangThaiDoiSoatOta = @trangThai
        WHERE maPhieuDatPhong = @maPhieu
            AND nguonDatPhong <> N'Trực tiếp';
        IF @@ROWCOUNT = 0
            THROW 51201, N'Không tìm thấy booking OTA', 1;
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

-- =============================================================================
-- uspPhatHanhHoaDonVat
-- Phát hành một hóa đơn VAT cho hóa đơn thanh toán đã tồn tại.
-- =============================================================================
CREATE PROCEDURE dbo.uspPhatHanhHoaDonVat
    @maHoaDon BIGINT,
    @soHoaDon NVARCHAR(40),
    @thueSuat DECIMAL(5, 2),
    @soTienChiuThue DECIMAL(14, 2),
    @loaiKhachHang NVARCHAR(20),
    @tenKhachHang NVARCHAR(200),
    @maSoThue NVARCHAR(30),
    @tenCongTy NVARCHAR(200),
    @diaChi NVARCHAR(500),
    @nguoiTao NVARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;
        DECLARE @tong DECIMAL(14, 2), @trangThaiHoaDon NVARCHAR(30);
        SELECT @tong = GREATEST(ROUND((tongTienPhong + tongTienDichVu + tienPhuThu + tienBoiThuong
            + phiGiaHan + tongTienDieuChinh - tienGiamGia)/1000.0,0)*1000,0), @trangThaiHoaDon = trangThai
        FROM dbo.HoaDon WITH (UPDLOCK, HOLDLOCK)
        WHERE maHoaDon = @maHoaDon;
        IF @tong IS NULL
            THROW 51207, N'Không tìm thấy hóa đơn thanh toán', 1;
        IF @trangThaiHoaDon = N'Dự kiến'
            THROW 51211, N'Hóa đơn dự kiến chưa được phát hành VAT', 1;
        -- Giá đã gồm VAT: tách thuế từ tổng tiền sau giảm giá, trước cọc và thanh toán.
        DECLARE @coSoTinhThue DECIMAL(14,2) = ROUND(@tong / (1 + @thueSuat / 100),2);
        IF @soTienChiuThue IS NOT NULL AND @soTienChiuThue <> @coSoTinhThue
            THROW 51212, N'Cơ sở tính VAT phải khớp hóa đơn, không được nhập tùy ý', 1;
        IF EXISTS (
            SELECT 1
            FROM dbo.HoaDonGiaTriGiaTang
            WHERE maHoaDon = @maHoaDon
        )
            THROW 51202, N'Hóa đơn VAT cho folio này đã tồn tại', 1;
        INSERT dbo.HoaDonGiaTriGiaTang(
            maHoaDon,
            soHoaDonGiaTriGiaTang,
            thueSuat,
            soTienChiuThue,
            loaiKhachHang,
            tenKhachHang,
            maSoThue,
            tenCongTy,
            diaChiCongTy,
            trangThai,
            trangThaiXml,
            nguoiTao
        )
        VALUES (
            @maHoaDon,
            @soHoaDon,
            @thueSuat,
            @coSoTinhThue,
            @loaiKhachHang,
            @tenKhachHang,
            @maSoThue,
            @tenCongTy,
            @diaChi,
            N'Đã phát hành',
            N'Chưa xuất',
            @nguoiTao
        );
        DECLARE @ma BIGINT = SCOPE_IDENTITY();
        COMMIT TRANSACTION;
        SELECT @ma AS maHoaDonGiaTriGiaTang;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

-- =============================================================================
-- uspLuuXmlHoaDonVat
-- Lưu nội dung XML và đánh dấu hóa đơn VAT đã xuất.
-- =============================================================================
CREATE PROCEDURE dbo.uspLuuXmlHoaDonVat
    @ma BIGINT,
    @xml NVARCHAR(MAX)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;
        UPDATE dbo.HoaDonGiaTriGiaTang
        SET trangThaiXml = N'Đã xuất', noiDungXml = @xml
        WHERE maHoaDonGiaTriGiaTang = @ma;
        IF @@ROWCOUNT = 0
            THROW 51203, N'Không tìm thấy hóa đơn VAT', 1;
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

-- =============================================================================
-- uspNhapChamCong
-- Nhập JSON chấm công, cập nhật hoặc thêm từng bản ghi theo nhân viên/ngày.
-- =============================================================================
CREATE PROCEDURE dbo.uspNhapChamCong
    @duLieu NVARCHAR(MAX),
    @nguoiNhap NVARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;
        IF ISJSON(@duLieu) <> 1
            THROW 51008, N'Dữ liệu chấm công không hợp lệ', 1;
        DECLARE @danhSachChamCong TABLE (
            stt INT,
            maNhanVien NVARCHAR(10),
            ngay DATE,
            vao DATETIME2(6),
            ra DATETIME2(6),
            trangThai NVARCHAR(20),
            nguon NVARCHAR(30),
            suKien NVARCHAR(100),
            ghiChu NVARCHAR(500)
        );
        INSERT @danhSachChamCong
        SELECT CONVERT(INT, duLieuChamCong.[key]),
            dongChamCong.*
        FROM OPENJSON(@duLieu) duLieuChamCong
        CROSS APPLY OPENJSON(duLieuChamCong.value) WITH (
            maNhanVien NVARCHAR(10),
            ngay DATE,
            vao DATETIME2(6),
            ra DATETIME2(6),
            trangThai NVARCHAR(20),
            nguon NVARCHAR(30),
            suKien NVARCHAR(100),
            ghiChu NVARCHAR(500)
        ) dongChamCong;
        DECLARE @nv NVARCHAR(10),
            @ngay DATE,
            @vao DATETIME2(6),
            @ra DATETIME2(6),
            @tt NVARCHAR(20),
            @nguon NVARCHAR(30),
            @maSuKien NVARCHAR(100),
            @ghiChu NVARCHAR(500);
        DECLARE duyetChamCong CURSOR LOCAL FAST_FORWARD FOR
            SELECT maNhanVien,
                ngay,
                vao,
                ra,
                trangThai,
                nguon,
                suKien,
                ghiChu
            FROM @danhSachChamCong
            ORDER BY maNhanVien, ngay, stt;
        OPEN duyetChamCong;
        FETCH NEXT FROM duyetChamCong INTO @nv, @ngay, @vao, @ra, @tt, @nguon, @maSuKien, @ghiChu;
        WHILE @@FETCH_STATUS = 0
        BEGIN
            UPDATE dbo.ChamCong WITH (UPDLOCK, HOLDLOCK)
            SET thoiDiemVaoCa = @vao,
                thoiDiemRaCa = @ra,
                trangThai = @tt,
                nguonDuLieu = @nguon,
                maSuKienThietBi = @maSuKien,
                ghiChu = @ghiChu,
                nguoiNhap = @nguoiNhap,
                thoiDiemNhap = CURRENT_TIMESTAMP
            WHERE maNhanVien = @nv
                AND ngayLamViec = @ngay;
            IF @@ROWCOUNT = 0
                INSERT dbo.ChamCong(
                    maNhanVien,
                    ngayLamViec,
                    thoiDiemVaoCa,
                    thoiDiemRaCa,
                    trangThai,
                    nguonDuLieu,
                    maSuKienThietBi,
                    ghiChu,
                    nguoiNhap
                )
                VALUES (
                    @nv,
                    @ngay,
                    @vao,
                    @ra,
                    @tt,
                    @nguon,
                    @maSuKien,
                    @ghiChu,
                    @nguoiNhap
                );
            FETCH NEXT FROM duyetChamCong INTO @nv, @ngay, @vao, @ra, @tt, @nguon, @maSuKien, @ghiChu;
        END;
        CLOSE duyetChamCong;
        DEALLOCATE duyetChamCong;
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

-- =============================================================================
-- uspTaoDonNghiPhep
-- Tạo đơn nghỉ phép hoặc đổi ca với khoảng ngày hợp lệ.
-- =============================================================================
CREATE PROCEDURE dbo.uspTaoDonNghiPhep
    @nv NVARCHAR(10),
    @loai NVARCHAR(30),
    @tu DATE,
    @den DATE,
    @lyDo NVARCHAR(500),
    @doiCa NVARCHAR(10),
    @nguoiThucHien NVARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;
        IF @den < @tu
            THROW 51208, N'Khoảng nghỉ không hợp lệ', 1;
        INSERT dbo.DonNghiPhep(
            maNhanVien,
            loaiNghiPhep,
            ngayBatDau,
            ngayKetThuc,
            lyDo,
            maNhanVienDoiCa,
            nguoiYeuCau
        )
        VALUES (
            @nv,
            @loai,
            @tu,
            @den,
            @lyDo,
            @doiCa,
            @nguoiThucHien
        );
        DECLARE @ma BIGINT = SCOPE_IDENTITY();
        COMMIT TRANSACTION;
        SELECT @ma AS maDonNghiPhep;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

-- =============================================================================
-- uspQuyetDinhNghiPhep
-- Duyệt hoặc từ chối đơn nghỉ phép còn đang chờ quyết định.
-- =============================================================================
CREATE PROCEDURE dbo.uspQuyetDinhNghiPhep
    @ma BIGINT,
    @chapNhan BIT,
    @nguoiThucHien NVARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;
        UPDATE dbo.DonNghiPhep
        SET trangThai = CASE
            WHEN @chapNhan = 1 THEN N'Đã phê duyệt'
            ELSE N'Bị từ chối'
        END,
            nguoiPheDuyet = @nguoiThucHien,
            thoiDiemQuyetDinh = CURRENT_TIMESTAMP
        WHERE maDonNghiPhep = @ma
            AND trangThai = N'Chờ phê duyệt';
        IF @@ROWCOUNT = 0
            THROW 51204, N'Đơn nghỉ không còn chờ duyệt', 1;
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

-- =============================================================================
-- uspTaoTaiSanKyThuat
-- Thêm hồ sơ tài sản kỹ thuật, vị trí và lịch bảo trì.
-- =============================================================================
CREATE PROCEDURE dbo.uspTaoTaiSanKyThuat
    @ma NVARCHAR(30),
    @ten NVARCHAR(150),
    @danhMuc NVARCHAR(50),
    @loaiViTri NVARCHAR(20),
    @phong NVARCHAR(10),
    @tang INT,
    @viTri NVARCHAR(150),
    @thuongHieu NVARCHAR(150),
    @lapDat DATE,
    @baoTri DATE,
    @trangThai NVARCHAR(30),
    @giaTri DECIMAL(14, 2),
    @ghiChu NVARCHAR(500)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;
        INSERT dbo.TaiSanKyThuat(
            maTaiSanKyThuat,
            ten,
            danhMuc,
            loaiViTri,
            maPhong,
            tang,
            viTri,
            thuongHieuMau,
            ngayLapDat,
            ngayBaoTriTiepTheo,
            trangThai,
            giaTriBanDau,
            ghiChu
        )
        VALUES (
            @ma,
            @ten,
            @danhMuc,
            @loaiViTri,
            @phong,
            @tang,
            @viTri,
            @thuongHieu,
            @lapDat,
            @baoTri,
            @trangThai,
            @giaTri,
            @ghiChu
        );
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

-- =============================================================================
-- uspCapNhatTaiSanKyThuat
-- Cập nhật trạng thái của tài sản kỹ thuật đã tồn tại.
-- =============================================================================
CREATE PROCEDURE dbo.uspCapNhatTaiSanKyThuat
    @ma NVARCHAR(30),
    @trangThai NVARCHAR(30)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;
        UPDATE dbo.TaiSanKyThuat
        SET trangThai = @trangThai
        WHERE maTaiSanKyThuat = @ma;
        IF @@ROWCOUNT = 0
            THROW 51206, N'Không tìm thấy tài sản kỹ thuật', 1;
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

-- =============================================================================
-- uspSuaCaLamViec
-- Sửa lịch ca đã phân công; khóa nhân viên trước khi kiểm tra trùng giờ.
-- =============================================================================
CREATE PROCEDURE dbo.uspSuaCaLamViec
    @ma BIGINT,
    @ngay DATE,
    @ca NVARCHAR(30),
    @tu DATETIME2(6),
    @den DATETIME2(6),
    @nguoiThucHien NVARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;
        DECLARE @nv NVARCHAR(10),
            @maDaKhoa NVARCHAR(10),
            @trangThai NVARCHAR(20),
            @cu NVARCHAR(30);
        SELECT @nv = maNhanVien
        FROM dbo.CaLamViecNhanVien
        WHERE maCaLamViecNhanVien = @ma;
        IF @nv IS NULL
            THROW 51302, N'Không tìm thấy ca làm việc', 1;
        SELECT @maDaKhoa = maNhanVien
        FROM dbo.NhanVien WITH (UPDLOCK, HOLDLOCK)
        WHERE maNhanVien = @nv;
        SELECT @trangThai = trangThai,
            @cu = maCa
        FROM dbo.CaLamViecNhanVien WITH (UPDLOCK, HOLDLOCK)
        WHERE maCaLamViecNhanVien = @ma;
        IF @trangThai <> N'Đã phân công'
            THROW 51303, N'Chỉ ca ASSIGNED mới được sửa', 1;
        IF @tu >= @den
            OR CAST(@tu AS DATE) <> @ngay
            THROW 51008, N'Khoảng ca hoặc shift_date không hợp lệ', 1;
        IF dbo.fnKiemTraTrungCaLamViec(@nv, @tu, @den, @ma) = 1
            THROW 51004, N'Nhân viên đã có ca trùng thời gian', 1;
        UPDATE dbo.CaLamViecNhanVien
        SET ngayLamCa = @ngay,
            maCa = @ca,
            thoiDiemBatDau = @tu,
            thoiDiemKetThuc = @den
        WHERE maCaLamViecNhanVien = @ma;
        DECLARE @duLieuTruoc NVARCHAR(30) = CASE @cu
            WHEN N'Ca sáng' THEN N'MORNING'
            WHEN N'Ca chiều' THEN N'AFTERNOON'
            WHEN N'Ca đêm' THEN N'NIGHT'
            ELSE @cu
        END;
        DECLARE @duLieuSau NVARCHAR(30) = CASE @ca
            WHEN N'Ca sáng' THEN N'MORNING'
            WHEN N'Ca chiều' THEN N'AFTERNOON'
            WHEN N'Ca đêm' THEN N'NIGHT'
            ELSE @ca
        END;
        INSERT dbo.NhatKyKiemSoat(
            nguoiThucHien,
            hanhDong,
            loaiDoiTuong,
            maDoiTuong,
            duLieuTruoc,
            duLieuSau
        )
        VALUES (
            @nguoiThucHien,
            N'EMPLOYEE_SHIFT_UPDATED',
            N'EMPLOYEE_SHIFT',
            CONVERT(NVARCHAR(100), @ma),
            @duLieuTruoc,
            @duLieuSau
        );
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

-- =============================================================================
-- uspChuyenTrangThaiCa
-- Chuyển trạng thái ca theo các bước hợp lệ và ghi nhật ký trước/sau.
-- =============================================================================
CREATE PROCEDURE dbo.uspChuyenTrangThaiCa
    @ma BIGINT,
    @moi NVARCHAR(20),
    @nguoiThucHien NVARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;
        DECLARE @nv NVARCHAR(10), @maDaKhoa NVARCHAR(10), @cu NVARCHAR(20);
        SELECT @nv = maNhanVien
        FROM dbo.CaLamViecNhanVien
        WHERE maCaLamViecNhanVien = @ma;
        IF @nv IS NULL
            THROW 51302, N'Không tìm thấy ca làm việc', 1;
        SELECT @maDaKhoa = maNhanVien
        FROM dbo.NhanVien WITH (UPDLOCK, HOLDLOCK)
        WHERE maNhanVien = @nv;
        SELECT @cu = trangThai
        FROM dbo.CaLamViecNhanVien WITH (UPDLOCK, HOLDLOCK)
        WHERE maCaLamViecNhanVien = @ma;
        IF @moi NOT IN (N'Đã phân công', N'Đã bắt đầu', N'Đã hoàn thành', N'Đã hủy')
            THROW 51304, N'Trạng thái ca không hợp lệ', 1;
        IF NOT (
            @moi = @cu
            OR (
                @cu = N'Đã phân công'
                AND @moi IN (N'Đã bắt đầu', N'Đã hủy')
            )
            OR (
                @cu = N'Đã bắt đầu'
                AND @moi IN (N'Đã hoàn thành', N'Đã hủy')
            )
        )
            THROW 51305, N'Chuyển trạng thái ca không hợp lệ', 1;
        UPDATE dbo.CaLamViecNhanVien
        SET trangThai = @moi
        WHERE maCaLamViecNhanVien = @ma;
        DECLARE @duLieuTruoc NVARCHAR(20) = CASE @cu
            WHEN N'Đã phân công' THEN N'ASSIGNED'
            WHEN N'Đã bắt đầu' THEN N'STARTED'
            WHEN N'Đã hoàn thành' THEN N'COMPLETED'
            WHEN N'Đã hủy' THEN N'CANCELLED'
        END;
        DECLARE @duLieuSau NVARCHAR(20) = CASE @moi
            WHEN N'Đã phân công' THEN N'ASSIGNED'
            WHEN N'Đã bắt đầu' THEN N'STARTED'
            WHEN N'Đã hoàn thành' THEN N'COMPLETED'
            WHEN N'Đã hủy' THEN N'CANCELLED'
        END;
        INSERT dbo.NhatKyKiemSoat(
            nguoiThucHien,
            hanhDong,
            loaiDoiTuong,
            maDoiTuong,
            duLieuTruoc,
            duLieuSau
        )
        VALUES (
            @nguoiThucHien,
            N'EMPLOYEE_SHIFT_STATUS_CHANGED',
            N'EMPLOYEE_SHIFT',
            CONVERT(NVARCHAR(100), @ma),
            @duLieuTruoc,
            @duLieuSau
        );
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

-- =============================================================================
-- uspThemAnhPhong
-- Thêm ảnh phòng trong giới hạn số ảnh; ảnh đầu tiên được chọn làm ảnh bìa.
-- =============================================================================
CREATE PROCEDURE dbo.uspThemAnhPhong
    @phong NVARCHAR(10),
    @duongDan NVARCHAR(255),
    @loai NVARCHAR(40),
    @kichThuoc BIGINT,
    @nguoiThucHien NVARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;
        IF NOT EXISTS (
            SELECT 1
            FROM dbo.Phong WITH (UPDLOCK, HOLDLOCK)
            WHERE maPhong = @phong
        )
            THROW 51401, N'Không tìm thấy phòng', 1;
        DECLARE @soLuong INT =(
            SELECT COUNT(*)
            FROM dbo.HinhAnhPhong
            WHERE maPhong = @phong
                AND dangHoatDong = 1
        );
        IF @soLuong >= 10
            THROW 51402, N'Mỗi phòng chỉ được tối đa 10 ảnh', 1;
        INSERT dbo.HinhAnhPhong(
            maPhong,
            duongDanTuongDoi,
            thuTuHienThi,
            laAnhBia,
            loaiNoiDung,
            kichThuocByte
        )
        VALUES (
            @phong,
            @duongDan,
            @soLuong,
            CASE
                WHEN @soLuong = 0 THEN 1
                ELSE 0
            END,
            @loai,
            @kichThuoc
        );
        DECLARE @ma BIGINT = SCOPE_IDENTITY();
        INSERT dbo.NhatKyKiemSoat(
            nguoiThucHien,
            hanhDong,
            loaiDoiTuong,
            maDoiTuong,
            duLieuSau
        )
        VALUES (
            @nguoiThucHien,
            N'ROOM_IMAGE_UPLOADED',
            N'ROOM_IMAGE',
            CONVERT(NVARCHAR(100), @ma),
            @duongDan
        );
        COMMIT TRANSACTION;
        SELECT @ma AS maHinhAnhPhong;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

-- =============================================================================
-- uspXoaAnhPhong
-- Ngừng sử dụng ảnh thuộc phòng và trả đường dẫn để bên gọi xử lý tệp.
-- =============================================================================
CREATE PROCEDURE dbo.uspXoaAnhPhong
    @phong NVARCHAR(10),
    @ma BIGINT,
    @nguoiThucHien NVARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;
        DECLARE @maDaKhoa NVARCHAR(10), @duongDan NVARCHAR(255);
        SELECT @maDaKhoa = maPhong
        FROM dbo.Phong WITH (UPDLOCK, HOLDLOCK)
        WHERE maPhong = @phong;
        SELECT @duongDan = duongDanTuongDoi
        FROM dbo.HinhAnhPhong WITH (UPDLOCK, HOLDLOCK)
        WHERE maHinhAnhPhong = @ma
            AND maPhong = @phong;
        IF @duongDan IS NULL
            THROW 51403, N'Không tìm thấy ảnh của phòng', 1;
        UPDATE dbo.HinhAnhPhong
        SET dangHoatDong = 0
        WHERE maHinhAnhPhong = @ma;
        INSERT dbo.NhatKyKiemSoat(
            nguoiThucHien,
            hanhDong,
            loaiDoiTuong,
            maDoiTuong,
            duLieuTruoc
        )
        VALUES (
            @nguoiThucHien,
            N'ROOM_IMAGE_DELETED',
            N'ROOM_IMAGE',
            CONVERT(NVARCHAR(100), @ma),
            @duongDan
        );
        COMMIT TRANSACTION;
        SELECT @duongDan AS duongDanTuongDoi;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

-- =============================================================================
-- uspTaoTienNghi
-- Tạo tiện nghi mới sau khi kiểm tra tên chưa tồn tại.
-- =============================================================================
CREATE PROCEDURE dbo.uspTaoTienNghi
    @ten NVARCHAR(100),
    @nguoiThucHien NVARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;
        IF EXISTS (
            SELECT 1
            FROM dbo.TienNghi WITH (UPDLOCK, HOLDLOCK)
            WHERE ten = @ten
        )
            THROW 51404, N'Tiện nghi đã tồn tại', 1;
        INSERT dbo.TienNghi(ten)
        VALUES (@ten);
        DECLARE @ma BIGINT = SCOPE_IDENTITY();
        INSERT dbo.NhatKyKiemSoat(
            nguoiThucHien,
            hanhDong,
            loaiDoiTuong,
            maDoiTuong,
            duLieuSau
        )
        VALUES (
            @nguoiThucHien,
            N'AMENITY_CREATED',
            N'AMENITY',
            CONVERT(NVARCHAR(100), @ma),
            @ten
        );
        COMMIT TRANSACTION;
        SELECT @ma AS maTienNghi;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

-- =============================================================================
-- uspSuaTienNghi
-- Sửa tên hoặc trạng thái hoạt động của tiện nghi.
-- =============================================================================
CREATE PROCEDURE dbo.uspSuaTienNghi
    @ma BIGINT,
    @ten NVARCHAR(100),
    @dangHoatDong BIT,
    @nguoiThucHien NVARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;
        UPDATE dbo.TienNghi
        SET ten = @ten, dangHoatDong = COALESCE(@dangHoatDong, dangHoatDong)
        WHERE maTienNghi = @ma;
        IF @@ROWCOUNT = 0
            THROW 51405, N'Không tìm thấy tiện nghi', 1;
        INSERT dbo.NhatKyKiemSoat(
            nguoiThucHien,
            hanhDong,
            loaiDoiTuong,
            maDoiTuong,
            duLieuSau
        )
        VALUES (
            @nguoiThucHien,
            N'AMENITY_UPDATED',
            N'AMENITY',
            CONVERT(NVARCHAR(100), @ma),
            @ten
        );
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

-- =============================================================================
-- uspGanTienNghiLoaiPhong
-- Kiểm tra danh sách tiện nghi rồi thay toàn bộ tiện nghi của loại phòng.
-- =============================================================================
CREATE PROCEDURE dbo.uspGanTienNghiLoaiPhong
    @loai NVARCHAR(10),
    @danhSachMaTienNghi NVARCHAR(MAX),
    @danhSachMaTienNghiNhatKy NVARCHAR(MAX),
    @nguoiThucHien NVARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;
        IF NOT EXISTS (
            SELECT 1
            FROM dbo.LoaiPhong WITH (UPDLOCK, HOLDLOCK)
            WHERE maLoaiPhong = @loai
        )
            THROW 51406, N'Không tìm thấy loại phòng', 1;
        IF ISJSON(@danhSachMaTienNghi) <> 1
            THROW 51008, N'Danh sách tiện nghi không hợp lệ', 1;
        DECLARE @tienNghiDuocChon TABLE (ma BIGINT PRIMARY KEY);
        INSERT @tienNghiDuocChon
        SELECT DISTINCT CONVERT(BIGINT, value)
        FROM OPENJSON(@danhSachMaTienNghi);
        IF EXISTS (
            SELECT ma
            FROM @tienNghiDuocChon
            EXCEPT
            SELECT maTienNghi
            FROM dbo.TienNghi WITH (HOLDLOCK)
        )
            THROW 51405, N'Có tiện nghi không tồn tại', 1;
        DELETE dbo.LoaiPhongTienNghi
        WHERE maLoaiPhong = @loai;
        INSERT dbo.LoaiPhongTienNghi(maLoaiPhong, maTienNghi)
        SELECT @loai,
            ma
        FROM @tienNghiDuocChon;
        INSERT dbo.NhatKyKiemSoat(
            nguoiThucHien,
            hanhDong,
            loaiDoiTuong,
            maDoiTuong,
            duLieuSau
        )
        VALUES (
            @nguoiThucHien,
            N'ROOM_TYPE_AMENITIES_REPLACED',
            N'ROOM_TYPE',
            @loai,
            @danhSachMaTienNghiNhatKy
        );
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

-- =============================================================================
-- uspGhiBienDongKhoDichVu
-- Ghi biến động tồn dịch vụ, nhật ký và kết quả chống trùng trong cùng giao dịch.
-- =============================================================================
CREATE PROCEDURE dbo.uspGhiBienDongKhoDichVu
    @dichVu NVARCHAR(10),
    @loai NVARCHAR(20),
    @soLuong INT,
    @nguoiThucHien NVARCHAR(50),
    @lyDo NVARCHAR(255),
    @khoaChongTrung NVARCHAR(100),
    @maBamYeuCau NVARCHAR(64),
    @maNhomKhoa SMALLINT,
    @thoiDiemHienTai DATETIME2(6),
    @traKetQua BIT=1
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;
        DECLARE @tonKhoHienTai INT,
            @maBanGhiChongTrung BIGINT,
            @nguoiThucHienTruoc NVARCHAR(100),
            @maBamYeuCauTruoc NVARCHAR(64),
            @phanHoiJson NVARCHAR(MAX),
            @trangThai NVARCHAR(20),
            @loaiPhanHoi NVARCHAR(255);
        SELECT @tonKhoHienTai = soLuongTonKho
        FROM dbo.DichVu WITH (UPDLOCK, HOLDLOCK)
        WHERE maDichVu = @dichVu;
        IF @tonKhoHienTai IS NULL
            THROW 51501, N'Không tìm thấy dịch vụ', 1;
        IF EXISTS(SELECT 1 FROM dbo.DichVu WHERE maDichVu=@dichVu AND laTaiNguyen=1)
            THROW 51504,N'Tài nguyên dịch vụ phải đổi bằng cấu hình sức chứa',1;
        IF NOT EXISTS (
            SELECT 1
            FROM dbo.NhomKhoaChongTrung WITH (UPDLOCK, HOLDLOCK)
            WHERE maNhomKhoa = @maNhomKhoa
        )
            THROW 51502, N'Thiếu bucket idempotency', 1;
        SELECT @maBanGhiChongTrung = maBanGhiChongTrung,
            @nguoiThucHienTruoc = nguoiThucHien,
            @maBamYeuCauTruoc = maBamYeuCau,
            @phanHoiJson = phanHoiJson,
            @trangThai = trangThai,
            @loaiPhanHoi = loaiPhanHoi
        FROM dbo.BanGhiChongTrung WITH (UPDLOCK, HOLDLOCK)
        WHERE phamViLenh = N'inventory-movement'
            AND khoaChongTrung = @khoaChongTrung;
        IF @maBanGhiChongTrung IS NOT NULL
        BEGIN
            IF @nguoiThucHienTruoc COLLATE Latin1_General_100_BIN2 <> @nguoiThucHien COLLATE Latin1_General_100_BIN2
                OR @maBamYeuCauTruoc <> @maBamYeuCau
                THROW 51005, N'Idempotency key đã được dùng cho yêu cầu khác hoặc actor khác', 1;
            IF @trangThai <> N'Đã hoàn tất'
                OR @phanHoiJson IS NULL
                THROW 51503, N'Yêu cầu cùng Idempotency-Key đang được xử lý', 1;
            IF @loaiPhanHoi <> N'com.hospitality.mis.dto.operations.InventoryMovementDtos$Response'
                THROW 51005, N'Kiểu kết quả idempotency không khớp', 1;
            COMMIT TRANSACTION;
            IF @traKetQua=1 SELECT @phanHoiJson AS phanHoiJson;
            RETURN;
        END;
        IF @soLuong = 0
            OR (
                @loai <> N'Điều chỉnh'
                AND @soLuong < 0
            )
            OR @loai NOT IN (N'Nhập kho', N'Xuất kho', N'Điều chỉnh', N'Hao hụt', N'Hoàn kho')
            THROW 51504, N'Số lượng hoặc loại biến động không hợp lệ', 1;
        DECLARE @soLuongDieuChinh BIGINT = CASE
            WHEN @loai IN (N'Xuất kho', N'Hao hụt') THEN - CONVERT(BIGINT, @soLuong)
            ELSE CONVERT(BIGINT, @soLuong)
        END;
        IF CONVERT(BIGINT, @tonKhoHienTai) + @soLuongDieuChinh < 0
            THROW 51006, N'Tồn kho không đủ', 1;
        IF CONVERT(BIGINT, @tonKhoHienTai) + @soLuongDieuChinh > 2147483647
            THROW 51504, N'Số lượng tồn vượt giới hạn', 1;
        IF CONVERT(BIGINT,@tonKhoHienTai)+@soLuongDieuChinh < (SELECT COALESCE(SUM(CONVERT(BIGINT,soLuong)),0) FROM dbo.DatDichVuKhachSan WHERE maDichVu=@dichVu AND (trangThai=N'Đã xác nhận' OR (trangThai=N'Chờ thanh toán' AND hanThanhToan>@thoiDiemHienTai)))
            THROW 51006,N'Tồn đã được giữ cho khách đặt dịch vụ',1;
        UPDATE dbo.DichVu
        SET soLuongTonKho = CONVERT(BIGINT, @tonKhoHienTai) + @soLuongDieuChinh
        WHERE maDichVu = @dichVu;
        INSERT dbo.BienDongKhoDichVu(
            maDichVu,
            loai,
            soLuong,
            maNguoiThucHien,
            thoiDiemPhatSinh,
            lyDo
        )
        VALUES (
            @dichVu,
            @loai,
            @soLuong,
            @nguoiThucHien,
            @thoiDiemHienTai,
            @lyDo
        );
        DECLARE @maBienDongKho BIGINT = SCOPE_IDENTITY();
        INSERT dbo.NhatKyKiemSoat(
            nguoiThucHien,
            hanhDong,
            loaiDoiTuong,
            maDoiTuong,
            duLieuSau,
            lyDo
        )
        VALUES (
            @nguoiThucHien,
            N'INVENTORY_MOVEMENT_RECORDED',
            N'SERVICE',
            @dichVu,
            CONVERT(NVARCHAR(100), @soLuongDieuChinh),
            @lyDo
        );
        SET @phanHoiJson =(
            SELECT @maBienDongKho AS id,
                @dichVu AS service_id,
                CASE @loai
                    WHEN N'Nhập kho' THEN 'RECEIVE'
                    WHEN N'Xuất kho' THEN 'ISSUE'
                    WHEN N'Điều chỉnh' THEN 'ADJUST'
                    WHEN N'Hao hụt' THEN 'WASTE'
                    ELSE 'RETURN'
                END AS type,
                @soLuong AS quantity,
                @nguoiThucHien AS actor_id,
                @thoiDiemHienTai AS occurred_at,
                @lyDo AS reason FOR JSON PATH, INCLUDE_NULL_VALUES, WITHOUT_ARRAY_WRAPPER
        );
        INSERT dbo.BanGhiChongTrung(
            phamViLenh,
            khoaChongTrung,
            nguoiThucHien,
            maBamYeuCau,
            trangThai,
            loaiPhanHoi,
            phanHoiJson,
            thoiDiemTao,
            thoiDiemHoanThanh
        )
        VALUES (
            N'inventory-movement',
            @khoaChongTrung,
            @nguoiThucHien,
            @maBamYeuCau,
            N'Đã hoàn tất',
            N'com.hospitality.mis.dto.operations.InventoryMovementDtos$Response',
            @phanHoiJson,
            @thoiDiemHienTai,
            @thoiDiemHienTai
        );
        COMMIT TRANSACTION;
        IF @traKetQua=1 SELECT @phanHoiJson AS phanHoiJson;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

-- =============================================================================
-- uspThemThietBiPhong
-- Thêm thiết bị phòng và lưu kết quả để trả lại khi nhận yêu cầu trùng.
-- =============================================================================
CREATE PROCEDURE dbo.uspThemThietBiPhong
    @maPhong NVARCHAR(100),
    @ten NVARCHAR(MAX),
    @giaTriBanDau DECIMAL(14, 2),
    @ngayMua DATE,
    @soLuong INT,
    @nguoiThucHien NVARCHAR(50),
    @khoaChongTrung NVARCHAR(100),
    @maBamYeuCau NVARCHAR(64),
    @maNhomKhoa SMALLINT,
    @thoiDiemHienTai DATETIME2(6)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;
        IF NOT EXISTS (
            SELECT 1
            FROM dbo.Phong WITH (UPDLOCK, HOLDLOCK)
            WHERE maPhong = @maPhong
        )
            THROW 51601, N'Không tìm thấy phòng', 1;
        IF NOT EXISTS (
            SELECT 1
            FROM dbo.NhomKhoaChongTrung WITH (UPDLOCK, HOLDLOCK)
            WHERE maNhomKhoa = @maNhomKhoa
        )
            THROW 51502, N'Thiếu bucket idempotency', 1;
        DECLARE @maThietBi BIGINT,
            @nguoiThucHienTruoc NVARCHAR(100),
            @maBamYeuCauTruoc NVARCHAR(64),
            @phanHoiJson NVARCHAR(MAX),
            @trangThai NVARCHAR(20),
            @loaiPhanHoi NVARCHAR(255);
        SELECT @maThietBi = maBanGhiChongTrung,
            @nguoiThucHienTruoc = nguoiThucHien,
            @maBamYeuCauTruoc = maBamYeuCau,
            @phanHoiJson = phanHoiJson,
            @trangThai = trangThai,
            @loaiPhanHoi = loaiPhanHoi
        FROM dbo.BanGhiChongTrung WITH (UPDLOCK, HOLDLOCK)
        WHERE phamViLenh = N'room-equipment'
            AND khoaChongTrung = @khoaChongTrung;
        IF @maThietBi IS NOT NULL
        BEGIN
            IF @nguoiThucHienTruoc COLLATE Latin1_General_100_BIN2 <> @nguoiThucHien COLLATE Latin1_General_100_BIN2
                OR @maBamYeuCauTruoc <> @maBamYeuCau
                THROW 51005, N'Idempotency key đã được dùng cho yêu cầu khác hoặc actor khác', 1;
            IF @trangThai <> N'Đã hoàn tất'
                OR @phanHoiJson IS NULL
                THROW 51503, N'Yêu cầu cùng Idempotency-Key đang được xử lý', 1;
            IF @loaiPhanHoi <> N'com.hospitality.mis.dto.room.RoomEquipmentDtos$Response'
                THROW 51005, N'Kiểu kết quả idempotency không khớp', 1;
            COMMIT TRANSACTION;
            SELECT @phanHoiJson AS phanHoiJson;
            RETURN;
        END;
        INSERT dbo.ThietBiPhong(
            maPhong,
            ten,
            giaTriBanDau,
            ngayMua,
            soLuong
        )
        VALUES (
            @maPhong,
            @ten,
            @giaTriBanDau,
            @ngayMua,
            @soLuong
        );
        SET @maThietBi = SCOPE_IDENTITY();
        INSERT dbo.NhatKyKiemSoat(
            nguoiThucHien,
            hanhDong,
            loaiDoiTuong,
            maDoiTuong,
            duLieuSau
        )
        VALUES (
            @nguoiThucHien,
            N'ROOM_EQUIPMENT_ADDED',
            N'ROOM',
            @maPhong,
            @ten
        );
        SET @phanHoiJson =(
            SELECT @maThietBi AS id,
                @maPhong AS room_id,
                @ten AS name,
                @giaTriBanDau AS original_value,
                @ngayMua AS purchased_on,
                @soLuong AS quantity,
                CAST(1 AS BIT) AS active FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
        );
        INSERT dbo.BanGhiChongTrung(
            phamViLenh,
            khoaChongTrung,
            nguoiThucHien,
            maBamYeuCau,
            trangThai,
            loaiPhanHoi,
            phanHoiJson,
            thoiDiemTao,
            thoiDiemHoanThanh
        )
        VALUES (
            N'room-equipment',
            @khoaChongTrung,
            @nguoiThucHien,
            @maBamYeuCau,
            N'Đã hoàn tất',
            N'com.hospitality.mis.dto.room.RoomEquipmentDtos$Response',
            @phanHoiJson,
            @thoiDiemHienTai,
            @thoiDiemHienTai
        );
        COMMIT TRANSACTION;
        SELECT @phanHoiJson AS phanHoiJson;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

-- =============================================================================
-- uspSuaThietBiPhong
-- Sửa thiết bị thuộc phòng sau khi khóa phòng và ghi nhật ký.
-- =============================================================================
CREATE PROCEDURE dbo.uspSuaThietBiPhong
    @maPhong NVARCHAR(100),
    @maThietBi BIGINT,
    @ten NVARCHAR(MAX),
    @giaTriBanDau DECIMAL(14, 2),
    @ngayMua DATE,
    @soLuong INT,
    @dangHoatDong BIT,
    @nguoiThucHien NVARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;
        DECLARE @maDaKhoa NVARCHAR(10);
        SELECT @maDaKhoa = maPhong
        FROM dbo.Phong WITH (UPDLOCK, HOLDLOCK)
        WHERE maPhong = @maPhong;
        UPDATE dbo.ThietBiPhong WITH (UPDLOCK)
        SET ten = @ten,
            giaTriBanDau = @giaTriBanDau,
            ngayMua = @ngayMua,
            soLuong = @soLuong,
            dangHoatDong = @dangHoatDong
        WHERE maThietBiPhong = @maThietBi
            AND maPhong = @maPhong;
        IF @@ROWCOUNT = 0
            THROW 51602, N'Không tìm thấy thiết bị trong phòng', 1;
        INSERT dbo.NhatKyKiemSoat(
            nguoiThucHien,
            hanhDong,
            loaiDoiTuong,
            maDoiTuong,
            duLieuSau
        )
        VALUES (
            @nguoiThucHien,
            N'ROOM_EQUIPMENT_UPDATED',
            N'ROOM_EQUIPMENT',
            CONVERT(NVARCHAR(100), @maThietBi),
            @maPhong
        );
        DECLARE @phanHoiJson NVARCHAR(MAX) =(
            SELECT @maThietBi AS id,
                @maPhong AS room_id,
                @ten AS name,
                @giaTriBanDau AS original_value,
                @ngayMua AS purchased_on,
                @soLuong AS quantity,
                @dangHoatDong AS active FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
        );
        COMMIT TRANSACTION;
        SELECT @phanHoiJson AS phanHoiJson;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

-- =============================================================================
-- uspTaoPhieuBaoTri
-- Tạo phiếu bảo trì và đưa phòng không có khách vào trạng thái bảo trì.
-- =============================================================================
CREATE PROCEDURE dbo.uspTaoPhieuBaoTri
    @maPhieuBaoTri NVARCHAR(100),
    @maPhong NVARCHAR(100),
    @loai NVARCHAR(MAX),
    @ngay DATE,
    @moTa NVARCHAR(MAX),
    @nguoiThucHien NVARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;
        IF EXISTS (
            SELECT 1
            FROM dbo.PhieuBaoTri WITH (UPDLOCK, HOLDLOCK)
            WHERE maPhieuBaoTri = @maPhieuBaoTri
        )
            THROW 51701, N'Mã phiếu bảo trì đã tồn tại', 1;
        DECLARE @trangThai NVARCHAR(30);
        SELECT @trangThai = trangThai
        FROM dbo.Phong WITH (UPDLOCK, HOLDLOCK)
        WHERE maPhong = @maPhong;
        IF @trangThai IS NULL
            THROW 51601, N'Không tìm thấy phòng', 1;
        IF @trangThai = N'Đang có khách'
            THROW 51702, N'Không thể đưa phòng đang có khách vào bảo trì', 1;
        IF @ngay IS NOT NULL AND dbo.fnKiemTraLichPhongTrong(
            @maPhong,
            CONVERT(DATETIME2(6), @ngay),
            DATEADD(DAY, 1, CONVERT(DATETIME2(6), @ngay)),
            SYSDATETIME(),
            NULL
        ) = 0
            THROW 51705, N'Ngày bảo trì trùng với lịch đặt phòng đang còn hiệu lực', 1;
        IF @ngay <= CONVERT(DATE, SYSDATETIME()) AND EXISTS (
            SELECT 1
            FROM dbo.ChiTietDatPhong chiTiet
            JOIN dbo.PhieuDatPhong phieu
                ON phieu.maPhieuDatPhong = chiTiet.maPhieuDatPhong
            WHERE chiTiet.maPhong = @maPhong
                AND chiTiet.thoiDiemTraPhong > SYSDATETIME()
                AND chiTiet.trangThai IN (N'Giữ tạm phòng', N'Đã giữ phòng', N'Đang có khách')
                AND (
                    phieu.trangThai IN (N'Đã xác nhận', N'Đã thanh toán cọc', N'Đã nhận phòng')
                    OR (
                        phieu.trangThai = N'Chờ thanh toán'
                        AND phieu.trangThaiThanhToanCoc = N'Chờ thanh toán'
                        AND phieu.thoiDiemHetHanThanhToanCoc > SYSDATETIME()
                    )
                )
        )
            THROW 51705, N'Không thể bắt đầu bảo trì khi phòng còn lượt ở hoặc booking tương lai', 1;
        INSERT dbo.PhieuBaoTri(
            maPhieuBaoTri,
            maPhong,
            loaiBaoTri,
            ngayDuKien,
            trangThai,
            moTa
        )
        VALUES (
            @maPhieuBaoTri,
            @maPhong,
            @loai,
            @ngay,
            N'Chưa xử lý',
            @moTa
        );
        -- Phiếu cho ngày tương lai chỉ khóa đúng ngày trong hàm khả dụng.
        -- Phiếu từ hôm nay trở về trước là yêu cầu bắt đầu ngay.
        IF @ngay <= CONVERT(DATE, SYSDATETIME())
            UPDATE dbo.Phong
            SET trangThai = N'Đang bảo trì', phienBan = phienBan + 1
            WHERE maPhong = @maPhong
                AND trangThai <> N'Đang bảo trì';
        INSERT dbo.NhatKyKiemSoat(
            nguoiThucHien,
            hanhDong,
            loaiDoiTuong,
            maDoiTuong,
            duLieuSau
        )
        VALUES (
            @nguoiThucHien,
            N'MAINTENANCE_CREATED',
            N'MAINTENANCE_WORK_ORDER',
            @maPhieuBaoTri,
            @maPhong
        );
        SELECT maPhieuBaoTri,
            maPhong,
            loaiBaoTri,
            ngayDuKien,
            trangThai,
            moTa
        FROM dbo.PhieuBaoTri
        WHERE maPhieuBaoTri = @maPhieuBaoTri;
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

-- =============================================================================
-- uspChuyenTrangThaiBaoTri
-- Chuyển trạng thái phiếu bảo trì và cập nhật trạng thái phòng tương ứng.
-- =============================================================================
CREATE PROCEDURE dbo.uspChuyenTrangThaiBaoTri
    @maPhieuBaoTri NVARCHAR(100),
    @trangThaiMoi NVARCHAR(30),
    @nguoiThucHien NVARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;
        DECLARE @maPhong NVARCHAR(10), @trangThaiTruoc NVARCHAR(30), @ngayDuKien DATE;
        SELECT @maPhong = maPhong,
            @trangThaiTruoc = trangThai,
            @ngayDuKien = ngayDuKien
        FROM dbo.PhieuBaoTri WITH (UPDLOCK, HOLDLOCK)
        WHERE maPhieuBaoTri = @maPhieuBaoTri;
        IF @maPhong IS NULL
            THROW 51703, N'Không tìm thấy phiếu bảo trì', 1;
        IF @trangThaiTruoc <> @trangThaiMoi
            AND NOT (
                (
                    @trangThaiTruoc = N'Chưa xử lý'
                    AND @trangThaiMoi = N'Đang bảo trì'
                )
                OR (
                    @trangThaiTruoc = N'Đang bảo trì'
                    AND @trangThaiMoi = N'Đã hoàn thành'
                )
            )
            THROW 51704, N'Trạng thái bảo trì không hợp lệ', 1;
        IF @trangThaiTruoc <> @trangThaiMoi
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM dbo.Phong WITH (UPDLOCK, HOLDLOCK)
                WHERE maPhong = @maPhong
            )
                THROW 51601, N'Room not found', 1;
            IF @trangThaiMoi = N'Đang bảo trì'
            BEGIN
                IF @ngayDuKien > CONVERT(DATE, SYSDATETIME())
                    THROW 51706, N'Chỉ được bắt đầu bảo trì từ ngày dự kiến trở đi', 1;
                IF EXISTS (
                    SELECT 1
                    FROM dbo.ChiTietDatPhong chiTiet
                    JOIN dbo.PhieuDatPhong phieu
                        ON phieu.maPhieuDatPhong = chiTiet.maPhieuDatPhong
                    WHERE chiTiet.maPhong = @maPhong
                        AND chiTiet.thoiDiemNhanPhong < DATEADD(DAY, 1, CONVERT(DATETIME2(6), @ngayDuKien))
                        AND chiTiet.thoiDiemTraPhong > CONVERT(DATETIME2(6), @ngayDuKien)
                        AND chiTiet.trangThai IN (N'Giữ tạm phòng', N'Đã giữ phòng', N'Đang có khách')
                        AND (
                            phieu.trangThai IN (N'Đã xác nhận', N'Đã thanh toán cọc', N'Đã nhận phòng')
                            OR (
                                phieu.trangThai = N'Chờ thanh toán'
                                AND phieu.trangThaiThanhToanCoc = N'Chờ thanh toán'
                                AND phieu.thoiDiemHetHanThanhToanCoc > SYSDATETIME()
                            )
                        )
                )
                    THROW 51705, N'Không thể bắt đầu bảo trì vì ngày dự kiến còn booking đang hiệu lực', 1;
            END;
            UPDATE dbo.PhieuBaoTri
            SET trangThai = @trangThaiMoi
            WHERE maPhieuBaoTri = @maPhieuBaoTri;
            DECLARE @trangThaiPhong NVARCHAR(30) = N'Đang bảo trì';
            IF @trangThaiMoi = N'Đang bảo trì'
                UPDATE dbo.Phong
                SET trangThai = N'Đang bảo trì', phienBan = phienBan + 1
                WHERE maPhong = @maPhong
                    AND trangThai <> N'Đang bảo trì';
            IF @trangThaiMoi = N'Đã hoàn thành'
                AND NOT EXISTS (
                    SELECT 1 FROM dbo.PhieuBaoTri
                    WHERE maPhong = @maPhong
                        AND maPhieuBaoTri <> @maPhieuBaoTri
                        AND trangThai <> N'Đã hoàn thành'
                )
                AND NOT EXISTS (
                    SELECT 1 FROM dbo.PhieuCongViecKyThuat
                    WHERE maPhong = @maPhong
                        AND trangThai <> N'Đã bàn giao phòng'
                )
                AND NOT EXISTS (
                    SELECT 1 FROM dbo.SuCoThietBi
                    WHERE maPhong = @maPhong
                        AND trangThaiBanGiao <> N'Đã xử lý'
                )
                AND NOT EXISTS (
                    SELECT 1 FROM dbo.NhiemVuBuongPhong
                    WHERE maPhong = @maPhong
                        AND trangThai <> N'Sẵn sàng'
                )
                SET @trangThaiPhong = N'Sẵn sàng';
            UPDATE dbo.Phong
            SET trangThai = @trangThaiPhong, phienBan = phienBan + 1
            WHERE maPhong = @maPhong
                AND trangThai = N'Đang bảo trì'
                AND trangThai <> @trangThaiPhong;
            INSERT dbo.NhatKyKiemSoat(
                nguoiThucHien,
                hanhDong,
                loaiDoiTuong,
                maDoiTuong,
                duLieuTruoc,
                duLieuSau
            )
            VALUES (
                @nguoiThucHien,
                N'MAINTENANCE_STATUS_CHANGED',
                N'MAINTENANCE_WORK_ORDER',
                @maPhieuBaoTri,
                CASE @trangThaiTruoc
                    WHEN N'Chưa xử lý' THEN N'CHUA_XU_LY'
                    WHEN N'Đang bảo trì' THEN N'DANG_BAO_TRI'
                    ELSE N'DA_HOAN_THANH'
                END,
                CASE @trangThaiMoi
                    WHEN N'Chưa xử lý' THEN N'CHUA_XU_LY'
                    WHEN N'Đang bảo trì' THEN N'DANG_BAO_TRI'
                    ELSE N'DA_HOAN_THANH'
                END
            );
        END;
        SELECT maPhieuBaoTri,
            maPhong,
            loaiBaoTri,
            ngayDuKien,
            trangThai,
            moTa
        FROM dbo.PhieuBaoTri
        WHERE maPhieuBaoTri = @maPhieuBaoTri;
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

-- =============================================================================
-- uspTaoMauChecklistBuongPhong
-- Thêm hạng mục checklist buồng phòng và ghi người tạo.
-- =============================================================================
CREATE PROCEDURE dbo.uspTaoMauChecklistBuongPhong
    @ten NVARCHAR(MAX),
    @nguoiThucHien NVARCHAR(MAX),
    @thoiDiemHienTai DATETIME2(6)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;
        INSERT dbo.MauChecklistBuongPhong(ten)
        VALUES (@ten);
        DECLARE @maMauChecklist BIGINT = SCOPE_IDENTITY();
        INSERT dbo.NhatKyKiemSoat(
            nguoiThucHien,
            hanhDong,
            loaiDoiTuong,
            maDoiTuong,
            duLieuSau,
            thoiDiemTao
        )
        VALUES (
            @nguoiThucHien,
            N'HOUSEKEEPING_CHECKLIST_TEMPLATE_CREATED',
            N'HOUSEKEEPING_CHECKLIST_TEMPLATE',
            N'new',
            @ten,
            TODATETIMEOFFSET(@thoiDiemHienTai, '+07:00')
        );
        COMMIT TRANSACTION;
        SELECT @maMauChecklist AS maMauChecklist,
            @ten AS ten,
            CAST(1 AS BIT) AS dangHoatDong;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

-- =============================================================================
-- uspGhiKetQuaChecklistBuongPhong
-- Ghi kết quả một hạng mục và tính lại mức hoàn thành checklist của nhiệm vụ.
-- =============================================================================
CREATE PROCEDURE dbo.uspGhiKetQuaChecklistBuongPhong
    @maNhiemVu BIGINT,
    @maHangMuc NVARCHAR(MAX),
    @datYeuCau BIT,
    @ghiChu NVARCHAR(MAX),
    @nguoiThucHien NVARCHAR(MAX),
    @laQuanLy BIT,
    @thoiDiemHienTai DATETIME2(6)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        -- Khóa phòng rồi khóa nhiệm vụ trước khi ghi checklist hoặc kiểm tra.
        -- Kiểm tra lại quyền/trạng thái dưới khóa, không dựa vào lần đọc Java trước đó.
        DECLARE @nguoiDuocPhanCong NVARCHAR(10), @trangThai NVARCHAR(30), @maPhongDaKhoa NVARCHAR(10);
        SELECT @maPhongDaKhoa = maPhong
        FROM dbo.NhiemVuBuongPhong
        WHERE maNhiemVuBuongPhong = @maNhiemVu;
        IF @maPhongDaKhoa IS NOT NULL
            SELECT @maPhongDaKhoa = maPhong
            FROM dbo.Phong WITH (UPDLOCK, HOLDLOCK)
            WHERE maPhong = @maPhongDaKhoa;
        SELECT @nguoiDuocPhanCong = nguoiDuocPhanCong,
            @trangThai = trangThai
        FROM dbo.NhiemVuBuongPhong WITH (UPDLOCK, HOLDLOCK)
        WHERE maNhiemVuBuongPhong = @maNhiemVu;
        IF @trangThai IS NULL
            THROW 51801, N'Không tìm thấy task dọn phòng', 1;
        IF @laQuanLy = 0
            AND (
                @nguoiDuocPhanCong IS NULL
                OR @nguoiDuocPhanCong COLLATE Latin1_General_100_BIN2 <> @nguoiThucHien COLLATE Latin1_General_100_BIN2
            )
            THROW 51802, N'Chỉ người được phân công hoặc quản lý mới được truy cập task', 1;
        IF @trangThai = N'Sẵn sàng'
            THROW 51803, N'Không thể thay đổi checklist của task đã READY', 1;
        IF NOT EXISTS (
            SELECT 1
            FROM dbo.MauChecklistBuongPhong WITH (HOLDLOCK)
            WHERE dangHoatDong = 1
                AND ten COLLATE Latin1_General_100_BIN2 = @maHangMuc COLLATE Latin1_General_100_BIN2
        )
            THROW 51804, N'Checklist item không tồn tại hoặc đã ngừng dùng', 1;
        INSERT dbo.KetQuaChecklistBuongPhong(
            maNhiemVuBuongPhong,
            hangMuc,
            datYeuCau,
            ghiChu,
            nguoiHoanThanh,
            thoiDiemHoanThanh
        )
        VALUES (
            @maNhiemVu,
            @maHangMuc,
            @datYeuCau,
            @ghiChu,
            @nguoiThucHien,
            @thoiDiemHienTai
        );
        DECLARE @maKetQuaChecklist BIGINT = SCOPE_IDENTITY(), @daHoanThanhChecklist BIT = 1;
        IF EXISTS (
            SELECT 1
            FROM dbo.MauChecklistBuongPhong mauChecklist WITH (HOLDLOCK)
            OUTER APPLY (
                SELECT TOP(1) ketQua.datYeuCau
                FROM dbo.KetQuaChecklistBuongPhong ketQua
                WHERE ketQua.maNhiemVuBuongPhong = @maNhiemVu
                    AND ketQua.hangMuc COLLATE Latin1_General_100_BIN2 = mauChecklist.ten COLLATE Latin1_General_100_BIN2
                ORDER BY ketQua.maKetQuaChecklist DESC
            ) ketQuaMoiNhat
            WHERE mauChecklist.dangHoatDong = 1
                AND ISNULL(ketQuaMoiNhat.datYeuCau, 0) = 0
        )
            SET @daHoanThanhChecklist = 0;
        UPDATE dbo.NhiemVuBuongPhong
        SET daHoanThanhChecklist = @daHoanThanhChecklist, thoiDiemCapNhat = @thoiDiemHienTai
        WHERE maNhiemVuBuongPhong = @maNhiemVu;
        INSERT dbo.NhatKyKiemSoat(
            nguoiThucHien,
            hanhDong,
            loaiDoiTuong,
            maDoiTuong,
            duLieuSau,
            thoiDiemTao
        )
        VALUES (
            @nguoiThucHien,
            N'HOUSEKEEPING_CHECKLIST_RESULT_RECORDED',
            N'HOUSEKEEPING_TASK',
            CONVERT(NVARCHAR(100), @maNhiemVu),
            @maHangMuc,
            TODATETIMEOFFSET(@thoiDiemHienTai, '+07:00')
        );
        COMMIT TRANSACTION;
        SELECT @maKetQuaChecklist AS maKetQuaChecklist,
            @maNhiemVu AS maNhiemVuBuongPhong,
            @maHangMuc AS hangMuc,
            @datYeuCau AS datYeuCau,
            @ghiChu AS ghiChu,
            @nguoiThucHien AS nguoiHoanThanh,
            @thoiDiemHienTai AS thoiDiemHoanThanh;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

-- =============================================================================
-- uspGhiKiemTraBuongPhong
-- Ghi kết quả kiểm tra buồng phòng theo người được phân công hoặc quản lý.
-- =============================================================================
CREATE PROCEDURE dbo.uspGhiKiemTraBuongPhong
    @maNhiemVu BIGINT,
    @loai NVARCHAR(MAX),
    @maHangMuc NVARCHAR(MAX),
    @soLuong INT,
    @tinhTrang NVARCHAR(MAX),
    @ghiChu NVARCHAR(MAX),
    @nguoiThucHien NVARCHAR(MAX),
    @laQuanLy BIT,
    @thoiDiemHienTai DATETIME2(6),
    @loaiHangMucApi NVARCHAR(20)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;
        DECLARE @nguoiDuocPhanCong NVARCHAR(10), @trangThai NVARCHAR(30), @maPhongDaKhoa NVARCHAR(10);
        SELECT @maPhongDaKhoa = maPhong
        FROM dbo.NhiemVuBuongPhong
        WHERE maNhiemVuBuongPhong = @maNhiemVu;
        IF @maPhongDaKhoa IS NOT NULL
            SELECT @maPhongDaKhoa = maPhong
            FROM dbo.Phong WITH (UPDLOCK, HOLDLOCK)
            WHERE maPhong = @maPhongDaKhoa;
        SELECT @nguoiDuocPhanCong = nguoiDuocPhanCong,
            @trangThai = trangThai
        FROM dbo.NhiemVuBuongPhong WITH (UPDLOCK, HOLDLOCK)
        WHERE maNhiemVuBuongPhong = @maNhiemVu;
        IF @trangThai IS NULL
            THROW 51801, N'Không tìm thấy task dọn phòng', 1;
        IF @laQuanLy = 0
            AND (
                @nguoiDuocPhanCong IS NULL
                OR @nguoiDuocPhanCong COLLATE Latin1_General_100_BIN2 <> @nguoiThucHien COLLATE Latin1_General_100_BIN2
            )
            THROW 51802, N'Chỉ người được phân công hoặc quản lý mới được truy cập task', 1;
        IF @trangThai = N'Sẵn sàng'
            THROW 51803, N'Không thể thêm inspection cho task đã READY', 1;
        IF @soLuong < 0
            THROW 51805, N'Inspection không hợp lệ', 1;
        INSERT dbo.KiemTraBuongPhong(
            maNhiemVuBuongPhong,
            loaiKiemTra,
            hangMuc,
            soLuong,
            tinhTrangHangMuc,
            ghiChu,
            nguoiHoanThanh,
            thoiDiemHoanThanh
        )
        VALUES (
            @maNhiemVu,
            @loai,
            @maHangMuc,
            @soLuong,
            @tinhTrang,
            @ghiChu,
            @nguoiThucHien,
            @thoiDiemHienTai
        );
        DECLARE @maKiemTraBuongPhong BIGINT = SCOPE_IDENTITY();
        INSERT dbo.NhatKyKiemSoat(
            nguoiThucHien,
            hanhDong,
            loaiDoiTuong,
            maDoiTuong,
            duLieuSau,
            thoiDiemTao
        )
        VALUES (
            @nguoiThucHien,
            N'HOUSEKEEPING_INSPECTION_RECORDED',
            N'HOUSEKEEPING_TASK',
            CONVERT(NVARCHAR(100), @maNhiemVu),
            @loaiHangMucApi + N':' + @maHangMuc,
            TODATETIMEOFFSET(@thoiDiemHienTai, '+07:00')
        );
        COMMIT TRANSACTION;
        SELECT @maKiemTraBuongPhong AS maKiemTraBuongPhong,
            @maNhiemVu AS maNhiemVuBuongPhong,
            @loai AS loaiKiemTra,
            @maHangMuc AS hangMuc,
            @soLuong AS soLuong,
            @tinhTrang AS tinhTrangHangMuc,
            @ghiChu AS ghiChu,
            @nguoiThucHien AS nguoiHoanThanh,
            @thoiDiemHienTai AS thoiDiemHoanThanh;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

-- =============================================================================
-- uspKhoaChongTrungBuongPhong
-- Khóa nhóm chống trùng và đọc kết quả cũ của lệnh buồng phòng.
-- Bên gọi phải đang giữ giao dịch; khóa còn hiệu lực tới khi giao dịch kết thúc.
-- =============================================================================
CREATE PROCEDURE dbo.uspKhoaChongTrungBuongPhong
    @phamViLenh NVARCHAR(100),
    @khoaChongTrung NVARCHAR(100),
    @nguoiThucHien NVARCHAR(MAX),
    @maBamYeuCau NVARCHAR(64),
    @maNhomKhoa SMALLINT,
    @phanHoiJson NVARCHAR(MAX) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    IF @@TRANCOUNT = 0
        THROW 51815, N'Idempotency cần transaction của command', 1;
    IF NOT EXISTS (
        SELECT 1
        FROM dbo.NhomKhoaChongTrung WITH (UPDLOCK, HOLDLOCK)
        WHERE maNhomKhoa = @maNhomKhoa
    )
        THROW 51502, N'Thiếu bucket idempotency', 1;
    DECLARE @maBanGhiChongTrung BIGINT,
        @nguoiThucHienTruoc NVARCHAR(100),
        @maBamYeuCauTruoc NVARCHAR(64),
        @trangThai NVARCHAR(20),
        @loaiPhanHoi NVARCHAR(255);
    SELECT @maBanGhiChongTrung = maBanGhiChongTrung,
        @nguoiThucHienTruoc = nguoiThucHien,
        @maBamYeuCauTruoc = maBamYeuCau,
        @phanHoiJson = phanHoiJson,
        @trangThai = trangThai,
        @loaiPhanHoi = loaiPhanHoi
    FROM dbo.BanGhiChongTrung WITH (UPDLOCK, HOLDLOCK)
    WHERE phamViLenh = @phamViLenh
        AND khoaChongTrung = @khoaChongTrung;
    IF @maBanGhiChongTrung IS NOT NULL
    BEGIN
        IF @nguoiThucHienTruoc COLLATE Latin1_General_100_BIN2 <> @nguoiThucHien COLLATE Latin1_General_100_BIN2
            OR @maBamYeuCauTruoc <> @maBamYeuCau
            THROW 51005, N'Idempotency key đã được dùng cho yêu cầu hoặc actor khác', 1;
        IF @trangThai <> N'Đã hoàn tất'
            OR @phanHoiJson IS NULL
            THROW 51503, N'Yêu cầu cùng Idempotency-Key đang được xử lý', 1;
        IF @loaiPhanHoi <> N'com.hospitality.mis.dto.operations.HousekeepingDtos$Response'
            THROW 51005, N'Kiểu kết quả idempotency không khớp', 1;
    END;
END;
GO

-- =============================================================================
-- uspLuuKetQuaChongTrungBuongPhong
-- Lưu phản hồi JSON của nhiệm vụ buồng phòng vào bản ghi chống trùng.
-- Phải gọi trong cùng giao dịch đã lấy khóa chống trùng.
-- =============================================================================
CREATE PROCEDURE dbo.uspLuuKetQuaChongTrungBuongPhong
    @phamViLenh NVARCHAR(100),
    @khoaChongTrung NVARCHAR(100),
    @nguoiThucHien NVARCHAR(MAX),
    @maBamYeuCau NVARCHAR(64),
    @thoiDiemHienTai DATETIME2(6),
    @maNhiemVu BIGINT,
    @phanHoiJson NVARCHAR(MAX) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    IF @@TRANCOUNT = 0
        THROW 51815, N'Idempotency cần transaction của command', 1;
    SET @phanHoiJson =(
        SELECT maNhiemVuBuongPhong AS id,
            maPhong AS room_id,
            nguoiDuocPhanCong AS assignee,
            CASE trangThai
                WHEN N'Cần dọn phòng' THEN N'NEEDS_CLEANING'
                WHEN N'Đang thực hiện' THEN N'IN_PROGRESS'
                WHEN N'Đã dọn xong' THEN N'CLEANED'
                WHEN N'Sẵn sàng' THEN N'READY'
                WHEN N'Chờ kỹ thuật' THEN N'WAITING_TECHNICAL'
            END AS status,
            daHoanThanhChecklist AS checklist_complete,
            coSuCoChan AS blocking_incident,
            ghiChu AS note,
            nguoiPhanCong AS assigned_by,
            thoiDiemCapNhat AS updated_at
        FROM dbo.NhiemVuBuongPhong
        WHERE maNhiemVuBuongPhong = @maNhiemVu FOR JSON PATH, INCLUDE_NULL_VALUES, WITHOUT_ARRAY_WRAPPER
    );
    INSERT dbo.BanGhiChongTrung(
        phamViLenh,
        khoaChongTrung,
        nguoiThucHien,
        maBamYeuCau,
        trangThai,
        loaiPhanHoi,
        phanHoiJson,
        thoiDiemTao,
        thoiDiemHoanThanh
    )
    VALUES (
        @phamViLenh,
        @khoaChongTrung,
        @nguoiThucHien,
        @maBamYeuCau,
        N'Đã hoàn tất',
        N'com.hospitality.mis.dto.operations.HousekeepingDtos$Response',
        @phanHoiJson,
        @thoiDiemHienTai,
        @thoiDiemHienTai
    );
END;
GO

-- =============================================================================
-- uspTaoNhiemVuBuongPhong
-- Tạo nhiệm vụ dọn phòng, cập nhật phòng và lưu kết quả chống trùng.
-- =============================================================================
CREATE PROCEDURE dbo.uspTaoNhiemVuBuongPhong
    @maPhong NVARCHAR(MAX),
    @nguoiDuocPhanCong NVARCHAR(MAX),
    @ghiChu NVARCHAR(MAX),
    @nguoiThucHien NVARCHAR(MAX),
    @khoaChongTrung NVARCHAR(100),
    @maBamYeuCau NVARCHAR(64),
    @maNhomKhoa SMALLINT,
    @thoiDiemHienTai DATETIME2(6)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;
        DECLARE @phanHoiJson NVARCHAR(MAX);
        EXEC dbo.uspKhoaChongTrungBuongPhong N'housekeeping-task-create',
            @khoaChongTrung,
            @nguoiThucHien,
            @maBamYeuCau,
            @maNhomKhoa,
            @phanHoiJson OUTPUT;
        IF @phanHoiJson IS NOT NULL
        BEGIN
            COMMIT TRANSACTION;
            SELECT @phanHoiJson AS phanHoiJson;
            RETURN;
        END;
        DECLARE @trangThaiPhong NVARCHAR(30);
        SELECT @trangThaiPhong = trangThai
        FROM dbo.Phong WITH (UPDLOCK, HOLDLOCK)
        WHERE maPhong = @maPhong;
        IF @trangThaiPhong IS NULL
            THROW 51601, N'Không tìm thấy phòng', 1;
        IF @trangThaiPhong = N'Đang có khách'
            THROW 51702, N'Không thể tạo task dọn phòng khi phòng đang có khách', 1;
        IF @trangThaiPhong = N'Ngừng sử dụng'
            OR (
                @trangThaiPhong = N'Đang bảo trì'
                AND (
                    NOT EXISTS (
                        SELECT 1
                        FROM dbo.PhieuCongViecKyThuat
                        WHERE maPhong = @maPhong
                            AND trangThai = N'Đã hoàn thành'
                    ) OR EXISTS (
                        SELECT 1
                        FROM dbo.PhieuCongViecKyThuat
                        WHERE maPhong = @maPhong
                            AND trangThai NOT IN (N'Đã hoàn thành', N'Đã bàn giao phòng')
                    )
                )
            )
            THROW 51806, N'Không thể tạo task dọn phòng khi phòng đang bị khóa kỹ thuật', 1;
        INSERT dbo.NhiemVuBuongPhong(
            maPhong,
            nguoiDuocPhanCong,
            trangThai,
            ghiChu,
            nguoiPhanCong,
            thoiDiemCapNhat
        )
        VALUES (
            @maPhong,
            @nguoiDuocPhanCong,
            N'Cần dọn phòng',
            @ghiChu,
            @nguoiThucHien,
            @thoiDiemHienTai
        );
        DECLARE @maNhiemVu BIGINT = SCOPE_IDENTITY();
        UPDATE dbo.Phong
        SET trangThai = N'Đang dọn phòng', phienBan = phienBan + 1
        WHERE maPhong = @maPhong
            AND trangThai <> N'Đang dọn phòng';
        INSERT dbo.NhatKyKiemSoat(
            nguoiThucHien,
            hanhDong,
            loaiDoiTuong,
            maDoiTuong,
            duLieuSau,
            thoiDiemTao
        )
        VALUES (
            @nguoiThucHien,
            N'HOUSEKEEPING_TASK_CREATED',
            N'HOUSEKEEPING_TASK',
            N'new',
            @maPhong,
            TODATETIMEOFFSET(@thoiDiemHienTai, '+07:00')
        );
        EXEC dbo.uspLuuKetQuaChongTrungBuongPhong N'housekeeping-task-create',
            @khoaChongTrung,
            @nguoiThucHien,
            @maBamYeuCau,
            @thoiDiemHienTai,
            @maNhiemVu,
            @phanHoiJson OUTPUT;
        COMMIT TRANSACTION;
        SELECT @phanHoiJson AS phanHoiJson;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

-- =============================================================================
-- uspCapNhatNhiemVuBuongPhong
-- Đổi người phụ trách hoặc trạng thái dọn phòng; kiểm tra checklist khi nghiệm thu.
-- =============================================================================
CREATE PROCEDURE dbo.uspCapNhatNhiemVuBuongPhong
    @maNhiemVu BIGINT,
    @trangThaiMoi NVARCHAR(30),
    @ghiChu NVARCHAR(MAX),
    @nguoiDuocPhanCong NVARCHAR(MAX),
    @nguoiThucHien NVARCHAR(MAX),
    @laQuanLy BIT,
    @khoaChongTrung NVARCHAR(100),
    @maBamYeuCau NVARCHAR(64),
    @maNhomKhoa SMALLINT,
    @thoiDiemHienTai DATETIME2(6)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;
        DECLARE @phanHoiJson NVARCHAR(MAX);
        EXEC dbo.uspKhoaChongTrungBuongPhong N'housekeeping-task-update',
            @khoaChongTrung,
            @nguoiThucHien,
            @maBamYeuCau,
            @maNhomKhoa,
            @phanHoiJson OUTPUT;
        IF @phanHoiJson IS NOT NULL
        BEGIN
            COMMIT TRANSACTION;
            SELECT @phanHoiJson AS phanHoiJson;
            RETURN;
        END;
        DECLARE @trangThaiTruoc NVARCHAR(30),
            @nguoiDuocPhanCongHienTai NVARCHAR(MAX),
            @maPhong NVARCHAR(10),
            @trangThaiPhong NVARCHAR(30),
            @coCongViecCanTro BIT = 0,
            @daHoanThanhChecklist BIT,
            @trangThaiPhongMoi NVARCHAR(30);

        -- Đọc mã phòng không thay đổi của nhiệm vụ; khóa phòng trước, nhiệm vụ sau.
        SELECT @maPhong = maPhong
        FROM dbo.NhiemVuBuongPhong
        WHERE maNhiemVuBuongPhong = @maNhiemVu;
        IF @maPhong IS NOT NULL
            SELECT @trangThaiPhong = trangThai
            FROM dbo.Phong WITH (UPDLOCK, HOLDLOCK)
            WHERE maPhong = @maPhong;
        SELECT @trangThaiTruoc = trangThai,
            @nguoiDuocPhanCongHienTai = nguoiDuocPhanCong,
            @maPhong = maPhong,
            @daHoanThanhChecklist = daHoanThanhChecklist
        FROM dbo.NhiemVuBuongPhong WITH (UPDLOCK, HOLDLOCK)
        WHERE maNhiemVuBuongPhong = @maNhiemVu;
        IF @trangThaiTruoc IS NULL
            THROW 51801, N'Không tìm thấy task dọn phòng', 1;
        IF @trangThaiMoi IS NULL
            THROW 51807, N'Trạng thái dọn phòng không hợp lệ', 1;
        IF @laQuanLy = 0
            AND (
                @nguoiDuocPhanCongHienTai IS NULL
                OR @nguoiDuocPhanCongHienTai COLLATE Latin1_General_100_BIN2 <> @nguoiThucHien COLLATE Latin1_General_100_BIN2
            )
            THROW 51802, N'Chỉ người được phân công mới được cập nhật task', 1;
        IF @trangThaiMoi = N'Sẵn sàng'
            AND @laQuanLy = 0
            THROW 51812, N'Chỉ quản lý mới được nghiệm thu phòng', 1;
        IF NOT (
            @trangThaiTruoc = @trangThaiMoi
            OR (
                @trangThaiTruoc = N'Cần dọn phòng'
                AND @trangThaiMoi IN (N'Đang thực hiện', N'Chờ kỹ thuật')
            )
            OR (
                @trangThaiTruoc = N'Đang thực hiện'
                AND @trangThaiMoi IN (N'Đã dọn xong', N'Chờ kỹ thuật')
            )
            OR (
                @trangThaiTruoc = N'Đã dọn xong'
                AND @trangThaiMoi IN (N'Sẵn sàng', N'Chờ kỹ thuật')
            )
            OR (
                @trangThaiTruoc = N'Chờ kỹ thuật'
                AND @trangThaiMoi IN (N'Đang thực hiện', N'Đã dọn xong')
            )
        )
            THROW 51808, N'Chuyển trạng thái dọn phòng không hợp lệ', 1;
        IF @nguoiDuocPhanCong IS NOT NULL
            AND (
                @nguoiDuocPhanCongHienTai IS NULL
                OR @nguoiDuocPhanCong COLLATE Latin1_General_100_BIN2 <> @nguoiDuocPhanCongHienTai COLLATE Latin1_General_100_BIN2
            )
        BEGIN
            IF @laQuanLy = 0
                THROW 51809, N'Chỉ Manager mới được đổi người phụ trách task', 1;
            IF LEN(@nguoiDuocPhanCong) = 0
                THROW 51810, N'Task phải có nhân viên housekeeping được phân công', 1;
            SET @nguoiDuocPhanCongHienTai = @nguoiDuocPhanCong;
        END;
        SELECT @trangThaiPhong = trangThai
        FROM dbo.Phong WITH (UPDLOCK, HOLDLOCK)
        WHERE maPhong = @maPhong;
        IF @trangThaiPhong IS NULL
            THROW 51601, N'Không tìm thấy phòng', 1;
        IF @trangThaiPhong = N'Đang có khách' AND @trangThaiMoi <> @trangThaiTruoc
            THROW 51702, N'Nhiệm vụ dọn phòng đã cũ; không thể đổi trạng thái phòng đang có khách', 1;
        IF @trangThaiPhong = N'Ngừng sử dụng' AND @trangThaiMoi <> @trangThaiTruoc
            THROW 51806, N'Phòng ngừng sử dụng không thể được mở bởi nhiệm vụ buồng phòng', 1;
        IF EXISTS (
            SELECT 1
            FROM dbo.SuCoThietBi WITH (HOLDLOCK)
            WHERE maPhong = @maPhong
                AND mucDoNghiemTrong IN (N'Cao', N'Nghiêm trọng')
                AND trangThaiBanGiao <> N'Đã xử lý'
        )
            SET @coCongViecCanTro = 1;
        IF @trangThaiMoi = N'Sẵn sàng'
        BEGIN
            SET @daHoanThanhChecklist = 1;
            IF NOT EXISTS (
                SELECT 1
                FROM dbo.MauChecklistBuongPhong WITH (HOLDLOCK)
                WHERE dangHoatDong = 1
            ) OR EXISTS (
                SELECT 1
                FROM dbo.MauChecklistBuongPhong mauChecklist WITH (HOLDLOCK)
                OUTER APPLY (
                    SELECT TOP(1) ketQua.datYeuCau
                    FROM dbo.KetQuaChecklistBuongPhong ketQua
                    WHERE ketQua.maNhiemVuBuongPhong = @maNhiemVu
                        AND ketQua.hangMuc COLLATE Latin1_General_100_BIN2 = mauChecklist.ten COLLATE Latin1_General_100_BIN2
                    ORDER BY ketQua.maKetQuaChecklist DESC
                ) ketQuaMoiNhat
                WHERE mauChecklist.dangHoatDong = 1
                    AND ISNULL(ketQuaMoiNhat.datYeuCau, 0) = 0
            )
                SET @daHoanThanhChecklist = 0;
            IF @daHoanThanhChecklist = 0
                OR @coCongViecCanTro = 1
                THROW 51811, N'Phòng chỉ READY sau khi hoàn thành checklist và không còn incident blocking', 1;
            IF EXISTS (
                SELECT 1
                FROM dbo.PhieuCongViecKyThuat
                WHERE maPhong = @maPhong
                    AND trangThai IN (N'Mới tạo', N'Đã tiếp nhận', N'Đang thực hiện', N'Chờ nghiệm thu')
            ) OR EXISTS (
                SELECT 1
                FROM dbo.PhieuBaoTri
                WHERE maPhong = @maPhong
                    AND trangThai <> N'Đã hoàn thành'
                    AND ngayDuKien <= CONVERT(DATE, @thoiDiemHienTai)
            )
                THROW 51806, N'Phòng còn công việc kỹ thuật hoặc bảo trì chưa hoàn tất', 1;
            IF @trangThaiPhong = N'Đang bảo trì'
                AND NOT EXISTS (
                    SELECT 1
                    FROM dbo.PhieuCongViecKyThuat
                    WHERE maPhong = @maPhong
                        AND trangThai = N'Đã hoàn thành'
                )
                AND NOT EXISTS (
                    SELECT 1
                    FROM dbo.PhieuBaoTri
                    WHERE maPhong = @maPhong
                        AND trangThai = N'Đã hoàn thành'
                )
                THROW 51806, N'Phòng đang bị khóa bảo trì và chưa có công việc hoàn tất để mở lại', 1;
        END;
        SET @trangThaiPhongMoi = CASE
            WHEN @trangThaiMoi = N'Sẵn sàng' THEN N'Sẵn sàng'
            WHEN @trangThaiMoi = N'Chờ kỹ thuật' THEN N'Đang bảo trì'
            ELSE N'Đang dọn phòng'
        END;
        IF @trangThaiMoi = N'Sẵn sàng' AND EXISTS (
            SELECT 1
            FROM dbo.PhieuCongViecKyThuat
            WHERE maPhong = @maPhong
                AND trangThai = N'Đã hoàn thành'
        )
            SET @trangThaiPhongMoi = N'Đang bảo trì';
        UPDATE dbo.NhiemVuBuongPhong
        SET trangThai = @trangThaiMoi,
            nguoiDuocPhanCong = @nguoiDuocPhanCongHienTai,
            ghiChu = COALESCE(@ghiChu, ghiChu),
            daHoanThanhChecklist = @daHoanThanhChecklist,
            coSuCoChan = @coCongViecCanTro,
            thoiDiemCapNhat = @thoiDiemHienTai
        WHERE maNhiemVuBuongPhong = @maNhiemVu;
        UPDATE dbo.Phong
        SET trangThai = @trangThaiPhongMoi, phienBan = phienBan + 1
        WHERE maPhong = @maPhong
            AND trangThai <> @trangThaiPhongMoi
            AND trangThai NOT IN (N'Đang có khách', N'Ngừng sử dụng')
            AND (
                trangThai <> N'Đang bảo trì'
                OR (
                    @trangThaiPhongMoi = N'Sẵn sàng'
                    AND EXISTS (
                        SELECT 1
                        FROM dbo.PhieuBaoTri
                        WHERE maPhong = @maPhong
                            AND trangThai = N'Đã hoàn thành'
                    )
                    AND NOT EXISTS (
                        SELECT 1
                        FROM dbo.PhieuCongViecKyThuat
                        WHERE maPhong = @maPhong
                            AND trangThai <> N'Đã bàn giao phòng'
                    )
                )
            );
        DECLARE @trangThaiApiTruoc NVARCHAR(30) = CASE @trangThaiTruoc
            WHEN N'Cần dọn phòng' THEN N'NEEDS_CLEANING'
            WHEN N'Đang thực hiện' THEN N'IN_PROGRESS'
            WHEN N'Đã dọn xong' THEN N'CLEANED'
            WHEN N'Sẵn sàng' THEN N'READY'
            WHEN N'Chờ kỹ thuật' THEN N'WAITING_TECHNICAL'
        END;
        DECLARE @trangThaiApiMoi NVARCHAR(30) = CASE @trangThaiMoi
            WHEN N'Cần dọn phòng' THEN N'NEEDS_CLEANING'
            WHEN N'Đang thực hiện' THEN N'IN_PROGRESS'
            WHEN N'Đã dọn xong' THEN N'CLEANED'
            WHEN N'Sẵn sàng' THEN N'READY'
            WHEN N'Chờ kỹ thuật' THEN N'WAITING_TECHNICAL'
        END;
        INSERT dbo.NhatKyKiemSoat(
            nguoiThucHien,
            hanhDong,
            loaiDoiTuong,
            maDoiTuong,
            duLieuTruoc,
            duLieuSau,
            thoiDiemTao
        )
        VALUES (
            @nguoiThucHien,
            N'HOUSEKEEPING_TASK_STATUS_CHANGED',
            N'HOUSEKEEPING_TASK',
            CONVERT(NVARCHAR(100), @maNhiemVu),
            @trangThaiApiTruoc,
            @trangThaiApiMoi,
            TODATETIMEOFFSET(@thoiDiemHienTai, '+07:00')
        );
        EXEC dbo.uspLuuKetQuaChongTrungBuongPhong N'housekeeping-task-update',
            @khoaChongTrung,
            @nguoiThucHien,
            @maBamYeuCau,
            @thoiDiemHienTai,
            @maNhiemVu,
            @phanHoiJson OUTPUT;
        COMMIT TRANSACTION;
        SELECT @phanHoiJson AS phanHoiJson;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

-- =============================================================================
-- uspLenhCongViecKyThuat
-- Tạo, cập nhật, nghiệm thu hoặc bàn giao phòng từ phiếu công việc kỹ thuật.
-- =============================================================================
CREATE PROCEDURE dbo.uspLenhCongViecKyThuat
    @lenh NVARCHAR(10),
    @maCongViecKyThuat BIGINT,
    @duLieuYeuCauJson NVARCHAR(MAX),
    @nguoiThucHien NVARCHAR(MAX),
    @laQuanLy BIT,
    @laKyThuat BIT,
    @khoaChongTrung NVARCHAR(100),
    @maBamYeuCau NVARCHAR(64),
    @maNhomKhoa SMALLINT,
    @thoiDiemHienTai DATETIME2(6)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;
        DECLARE @phamViLenh NVARCHAR(100) = CASE @lenh
            WHEN N'create' THEN N'technical-work-order-create'
            WHEN N'update' THEN N'technical-work-order-update'
            WHEN N'accept' THEN N'technical-work-order-accept'
            WHEN N'release' THEN N'technical-work-order-release'
        END;
        IF @phamViLenh IS NULL
            THROW 51901, N'Command kỹ thuật không hợp lệ', 1;
        IF NOT EXISTS (
            SELECT 1
            FROM dbo.NhomKhoaChongTrung WITH (UPDLOCK, HOLDLOCK)
            WHERE maNhomKhoa = @maNhomKhoa
        )
            THROW 51502, N'Thiếu bucket idempotency', 1;
        DECLARE @maBanGhiChongTrung BIGINT,
            @nguoiThucHienTruoc NVARCHAR(100),
            @maBamYeuCauTruoc NVARCHAR(64),
            @phanHoiJson NVARCHAR(MAX),
            @trangThaiChongTrung NVARCHAR(20),
            @loaiPhanHoi NVARCHAR(255);
        SELECT @maBanGhiChongTrung = maBanGhiChongTrung,
            @nguoiThucHienTruoc = nguoiThucHien,
            @maBamYeuCauTruoc = maBamYeuCau,
            @phanHoiJson = phanHoiJson,
            @trangThaiChongTrung = trangThai,
            @loaiPhanHoi = loaiPhanHoi
        FROM dbo.BanGhiChongTrung WITH (UPDLOCK, HOLDLOCK)
        WHERE phamViLenh = @phamViLenh
            AND khoaChongTrung = @khoaChongTrung;
        IF @maBanGhiChongTrung IS NOT NULL
        BEGIN
            IF @nguoiThucHienTruoc COLLATE Latin1_General_100_BIN2 <> @nguoiThucHien COLLATE Latin1_General_100_BIN2
                OR @maBamYeuCauTruoc <> @maBamYeuCau
                THROW 51005, N'Idempotency key đã được dùng cho yêu cầu hoặc actor khác', 1;
            IF @trangThaiChongTrung <> N'Đã hoàn tất'
                OR @phanHoiJson IS NULL
                THROW 51503, N'Yêu cầu cùng Idempotency-Key đang được xử lý', 1;
            IF @loaiPhanHoi <> N'com.hospitality.mis.dto.operations.TechnicalWorkOrderDtos$Response'
                THROW 51005, N'Kiểu kết quả idempotency không khớp', 1;
            COMMIT TRANSACTION;
            SELECT @phanHoiJson AS phanHoiJson;
            RETURN;
        END;
        DECLARE @maPhong NVARCHAR(MAX),
            @maThietBi BIGINT,
            @nguoiDuocPhanCong NVARCHAR(MAX),
            @mucUuTien NVARCHAR(MAX),
            @hanXuLy DATETIME2(6),
            @vatTuSuDung NVARCHAR(MAX),
            @trangThaiMoi NVARCHAR(MAX),
            @ghiChuKetQua NVARCHAR(MAX),
            @ghiChuNghiemThu NVARCHAR(MAX),
            @lyDoNghiemThu NVARCHAR(MAX),
            @ketQuaDeTrong BIT,
            @nghiemThuDeTrong BIT;
        SELECT @maPhong = roomId,
            @maThietBi = equipmentId,
            @nguoiDuocPhanCong = assignee,
            @mucUuTien = priority,
            @hanXuLy = slaDue,
            @vatTuSuDung = materials,
            @trangThaiMoi = nextStatus,
            @ghiChuKetQua = resultNote,
            @ghiChuNghiemThu = acceptanceNote,
            @lyDoNghiemThu = acceptanceReason,
            @ketQuaDeTrong = resultBlank,
            @nghiemThuDeTrong = acceptanceBlank
        FROM OPENJSON(@duLieuYeuCauJson) WITH (
            roomId NVARCHAR(MAX) '$.room',
            equipmentId BIGINT '$.equipment',
            assignee NVARCHAR(MAX) '$.assignee',
            priority NVARCHAR(MAX) '$.priority',
            slaDue DATETIME2(6) '$.sla',
            materials NVARCHAR(MAX) '$.materials',
            nextStatus NVARCHAR(MAX) '$.status',
            resultNote NVARCHAR(MAX) '$.result',
            acceptanceNote NVARCHAR(MAX) '$.acceptance',
            acceptanceReason NVARCHAR(MAX) '$.reason',
            resultBlank BIT '$.resultBlank',
            acceptanceBlank BIT '$.acceptanceBlank'
        );
        DECLARE @trangThaiPhong NVARCHAR(30),
            @trangThaiTruoc NVARCHAR(30),
            @nguoiDuocPhanCongHienTai NVARCHAR(MAX),
            @nguoiTao NVARCHAR(10),
            @nguoiNghiemThu NVARCHAR(50),
            @ketQuaDaLuu NVARCHAR(MAX),
            @hanhDong NVARCHAR(100),
            @trangThaiApiTruoc NVARCHAR(30),
            @trangThaiApiSau NVARCHAR(30),
            @maDoiTuong NVARCHAR(100),
            @duLieuSau NVARCHAR(MAX);

        -- Tạo bản ghi mới.
        IF @lenh = N'create'
        BEGIN
            SELECT @trangThaiPhong = trangThai
            FROM dbo.Phong WITH (UPDLOCK, HOLDLOCK)
            WHERE maPhong = @maPhong;
            IF @trangThaiPhong IS NULL
                THROW 51601, N'Không tìm thấy phòng', 1;
            IF @trangThaiPhong = N'Đang có khách'
                THROW 51702, N'Không thể tạo work order cho phòng đang có khách', 1;
            IF @trangThaiPhong = N'Ngừng sử dụng'
                THROW 51904, N'Không thể tạo work order cho phòng ngừng sử dụng', 1;
            IF EXISTS (
                SELECT 1
                FROM dbo.ChiTietDatPhong chiTiet
                JOIN dbo.PhieuDatPhong phieu
                    ON phieu.maPhieuDatPhong = chiTiet.maPhieuDatPhong
                WHERE chiTiet.maPhong = @maPhong
                    AND chiTiet.thoiDiemTraPhong > @thoiDiemHienTai
                    AND chiTiet.trangThai IN (N'Giữ tạm phòng', N'Đã giữ phòng', N'Đang có khách')
                    AND (
                        phieu.trangThai IN (N'Đã xác nhận', N'Đã thanh toán cọc', N'Đã nhận phòng')
                        OR (
                            phieu.trangThai = N'Chờ thanh toán'
                            AND phieu.trangThaiThanhToanCoc = N'Chờ thanh toán'
                            AND phieu.thoiDiemHetHanThanhToanCoc > @thoiDiemHienTai
                        )
                    )
            )
                THROW 51918, N'Không thể khóa phòng kỹ thuật khi còn khách hoặc booking chưa kết thúc', 1;
            IF @maThietBi IS NOT NULL
                AND NOT EXISTS (
                    SELECT 1
                    FROM dbo.ThietBiPhong
                    WHERE maThietBiPhong = @maThietBi
                        AND maPhong = @maPhong
                        AND dangHoatDong = 1
                )
                THROW 51602, N'Thiết bị active không thuộc phòng', 1;
            IF @nguoiDuocPhanCong IS NULL
                SET @nguoiDuocPhanCong = @nguoiThucHien;
            IF @laQuanLy = 0
                AND @nguoiThucHien COLLATE Latin1_General_100_BIN2 <> @nguoiDuocPhanCong COLLATE Latin1_General_100_BIN2
                THROW 51905, N'Technical chỉ được tự nhận work order của mình', 1;
            IF @mucUuTien IS NULL
                THROW 51902, N'Priority không hợp lệ', 1;
            INSERT dbo.PhieuCongViecKyThuat(
                maPhong,
                maThietBiPhong,
                nguoiDuocPhanCong,
                doUuTien,
                thoiHanSla,
                vatTuSuDung,
                trangThai,
                nguoiTao,
                thoiDiemTao,
                thoiDiemCapNhat
            )
            VALUES (
                @maPhong,
                @maThietBi,
                @nguoiDuocPhanCong,
                @mucUuTien,
                @hanXuLy,
                @vatTuSuDung,
                N'Mới tạo',
                @nguoiThucHien,
                @thoiDiemHienTai,
                @thoiDiemHienTai
            );
            SET @maCongViecKyThuat = SCOPE_IDENTITY();
            UPDATE dbo.Phong
            SET trangThai = N'Đang bảo trì', phienBan = phienBan + 1
            WHERE maPhong = @maPhong
                AND trangThai <> N'Đang bảo trì';
            SET @hanhDong = N'TECHNICAL_WORK_ORDER_CREATED';
            SET @maDoiTuong = N'new';
            SET @duLieuSau = @maPhong;
        END
        ELSE
        BEGIN
            SELECT @maPhong = maPhong,
                @maThietBi = COALESCE(@maThietBi, maThietBiPhong),
                @trangThaiTruoc = trangThai,
                @nguoiDuocPhanCongHienTai = nguoiDuocPhanCong,
                @nguoiTao = nguoiTao,
                @nguoiNghiemThu = nguoiNghiemThu,
                @ketQuaDaLuu = ghiChuKetQua
            FROM dbo.PhieuCongViecKyThuat WITH (UPDLOCK, HOLDLOCK)
            WHERE maPhieuCongViecKyThuat = @maCongViecKyThuat;
            IF @trangThaiTruoc IS NULL
                THROW 51906, N'Không tìm thấy work order', 1;
            SET @maDoiTuong = CONVERT(NVARCHAR(100), @maCongViecKyThuat);
            SET @trangThaiApiTruoc = CASE @trangThaiTruoc
                WHEN N'Mới tạo' THEN N'NEW'
                WHEN N'Đã tiếp nhận' THEN N'ACKNOWLEDGED'
                WHEN N'Đang thực hiện' THEN N'IN_PROGRESS'
                WHEN N'Chờ nghiệm thu' THEN N'WAITING_ACCEPTANCE'
                WHEN N'Đã hoàn thành' THEN N'COMPLETED'
                WHEN N'Đã bàn giao phòng' THEN N'ROOM_RELEASED'
            END;

            -- Cập nhật thông tin hoặc trạng thái.
            IF @lenh = N'update'
            BEGIN
                IF @nguoiDuocPhanCongHienTai IS NULL
                    OR (
                        @laQuanLy = 0
                        AND @nguoiDuocPhanCongHienTai COLLATE Latin1_General_100_BIN2 <> @nguoiThucHien COLLATE Latin1_General_100_BIN2
                    )
                    THROW 51907, N'Chỉ kỹ thuật viên được phân công mới được cập nhật work order', 1;
                IF @trangThaiTruoc IN (N'Đã hoàn thành', N'Đã bàn giao phòng')
                    THROW 51908, N'Work order đã nghiệm thu hoặc release không thể sửa bằng PATCH', 1;
                IF @trangThaiMoi IS NULL
                    THROW 51903, N'Trạng thái work order không hợp lệ', 1;
                IF NOT (
                    @trangThaiTruoc = @trangThaiMoi
                    OR (
                        @trangThaiTruoc = N'Mới tạo'
                        AND @trangThaiMoi = N'Đã tiếp nhận'
                    )
                    OR (
                        @trangThaiTruoc = N'Đã tiếp nhận'
                        AND @trangThaiMoi = N'Đang thực hiện'
                    )
                    OR (
                        @trangThaiTruoc = N'Đang thực hiện'
                        AND @trangThaiMoi = N'Chờ nghiệm thu'
                    )
                    OR (
                        @trangThaiTruoc = N'Chờ nghiệm thu'
                        AND @trangThaiMoi = N'Đã hoàn thành'
                    )
                )
                    THROW 51909, N'Chuyển trạng thái work order không hợp lệ', 1;
                IF @trangThaiMoi IN (N'Đã hoàn thành', N'Đã bàn giao phòng')
                    THROW 51910, N'Nghiệm thu và release phải dùng command riêng', 1;
                IF @nguoiDuocPhanCong IS NOT NULL
                    AND @nguoiDuocPhanCong COLLATE Latin1_General_100_BIN2 <> @nguoiDuocPhanCongHienTai COLLATE Latin1_General_100_BIN2
                BEGIN
                    IF @laQuanLy = 0
                        THROW 51905, N'Chỉ Manager mới được đổi người phụ trách work order', 1;
                    IF LEN(@nguoiDuocPhanCong) = 0
                        THROW 51911, N'Work order phải có nhân viên kỹ thuật được phân công', 1;
                    SET @nguoiDuocPhanCongHienTai = @nguoiDuocPhanCong;
                END;
                IF @trangThaiMoi = N'Chờ nghiệm thu'
                    AND (
                        (
                            @ghiChuKetQua IS NOT NULL
                            AND @ketQuaDeTrong = 1
                        )
                        OR (
                            @ghiChuKetQua IS NULL
                            AND (
                                @ketQuaDaLuu IS NULL
                                OR LEN(LTRIM(RTRIM(REPLACE(REPLACE(REPLACE(@ketQuaDaLuu, CHAR(9), N' '), CHAR(10), N' '), CHAR(13), N' ')))) = 0
                            )
                        )
                    )
                    THROW 51912, N'Phải ghi kết quả sửa trước khi chờ nghiệm thu', 1;
                UPDATE dbo.PhieuCongViecKyThuat
                SET trangThai = @trangThaiMoi,
                    nguoiDuocPhanCong = @nguoiDuocPhanCongHienTai,
                    vatTuSuDung = COALESCE(@vatTuSuDung, vatTuSuDung),
                    ghiChuKetQua = COALESCE(@ghiChuKetQua, ghiChuKetQua),
                    thoiDiemCapNhat = @thoiDiemHienTai
                WHERE maPhieuCongViecKyThuat = @maCongViecKyThuat;
                SET @hanhDong = N'TECHNICAL_WORK_ORDER_STATUS_CHANGED';
            END

            -- Nghiệm thu bởi người có quyền, tách biệt người tạo/người thực hiện.
            ELSE IF @lenh = N'accept'
            BEGIN
                IF @laQuanLy = 0
                    THROW 51913, N'Chỉ Manager, Director hoặc Admin được nghiệm thu', 1;
                IF @nguoiThucHien COLLATE Latin1_General_100_BIN2 = @nguoiTao COLLATE Latin1_General_100_BIN2
                    OR @nguoiThucHien COLLATE Latin1_General_100_BIN2 = @nguoiDuocPhanCongHienTai COLLATE Latin1_General_100_BIN2
                    THROW 51914, N'Người tạo hoặc người được giao không được tự nghiệm thu', 1;
                IF @trangThaiTruoc <> N'Chờ nghiệm thu'
                    THROW 51909, N'Chỉ work order chờ nghiệm thu mới được duyệt', 1;
                IF @ghiChuNghiemThu IS NULL
                    OR @nghiemThuDeTrong = 1
                    THROW 51915, N'Phải ghi nhận xét nghiệm thu', 1;
                SET @trangThaiMoi = N'Đã hoàn thành';
                UPDATE dbo.PhieuCongViecKyThuat
                SET trangThai = @trangThaiMoi,
                    ghiChuNghiemThu = @ghiChuNghiemThu,
                    nguoiNghiemThu = @nguoiThucHien,
                    thoiDiemNghiemThu = @thoiDiemHienTai,
                    thoiDiemCapNhat = @thoiDiemHienTai
                WHERE maPhieuCongViecKyThuat = @maCongViecKyThuat;
                IF @maThietBi IS NOT NULL
                BEGIN
                    UPDATE dbo.SuCoThietBi
                    SET trangThaiBanGiao = N'Đã xử lý',
                        ghiChuBanGiao = ISNULL(ghiChuBanGiao + N'; ', N'') + N'Đã nghiệm thu sửa chữa'
                    WHERE maPhong = @maPhong
                        AND trangThaiBanGiao <> N'Đã xử lý'
                        AND tenThietBi IN (SELECT ten FROM dbo.ThietBiPhong WHERE maThietBiPhong = @maThietBi);
                    UPDATE dbo.NhiemVuBuongPhong
                    SET coSuCoChan = CASE WHEN EXISTS (
                        SELECT 1
                        FROM dbo.SuCoThietBi
                        WHERE maPhong = @maPhong
                            AND mucDoNghiemTrong IN (N'Cao', N'Nghiêm trọng')
                            AND trangThaiBanGiao <> N'Đã xử lý'
                    ) THEN 1 ELSE 0 END
                    WHERE maPhong = @maPhong;
                END;
                SET @hanhDong = N'TECHNICAL_WORK_ORDER_ACCEPTED';
            END
            ELSE
            BEGIN
                IF @laKyThuat = 0
                    OR @nguoiDuocPhanCongHienTai IS NULL
                    OR @nguoiThucHien COLLATE Latin1_General_100_BIN2 <> @nguoiDuocPhanCongHienTai COLLATE Latin1_General_100_BIN2
                    THROW 51907, N'Chỉ kỹ thuật viên được phân công mới được release phòng', 1;
                IF @trangThaiTruoc <> N'Đã hoàn thành'
                    OR @nguoiNghiemThu IS NULL
                    THROW 51916, N'Work order chưa được Manager nghiệm thu', 1;
                SELECT @trangThaiPhong = trangThai
                FROM dbo.Phong WITH (UPDLOCK, HOLDLOCK)
                WHERE maPhong = @maPhong;
                IF @trangThaiPhong IS NULL
                    THROW 51601, N'Không tìm thấy phòng', 1;

                -- Thứ tự kiểm tra: công việc khác -> khách/booking đang ở -> điều kiện sẵn sàng.
                IF EXISTS (
                    SELECT 1
                    FROM dbo.PhieuCongViecKyThuat
                    WHERE maPhong = @maPhong
                        AND maPhieuCongViecKyThuat <> @maCongViecKyThuat
                        AND trangThai IN (N'Mới tạo', N'Đã tiếp nhận', N'Đang thực hiện', N'Chờ nghiệm thu')
                )
                    THROW 51917, N'Phòng còn work order kỹ thuật chưa hoàn tất', 1;
                IF @trangThaiPhong = N'Đang có khách'
                    THROW 51702, N'Không thể release phòng đang có khách', 1;
                IF dbo.fnKiemTraLichPhongTrong(@maPhong, @thoiDiemHienTai, DATEADD(MICROSECOND, 1, @thoiDiemHienTai), @thoiDiemHienTai, NULL) = 0
                    THROW 51918, N'Phòng đang có booking hoặc lưu trú hoạt động', 1;
                IF @maThietBi IS NOT NULL
                BEGIN
                    UPDATE dbo.SuCoThietBi
                    SET trangThaiBanGiao = N'Đã xử lý',
                        ghiChuBanGiao = ISNULL(ghiChuBanGiao + N'; ', N'') + N'Đã hoàn thành sửa chữa'
                    WHERE maPhong = @maPhong
                        AND trangThaiBanGiao <> N'Đã xử lý'
                        AND tenThietBi IN (SELECT ten FROM dbo.ThietBiPhong WHERE maThietBiPhong = @maThietBi);
                END;
                UPDATE dbo.NhiemVuBuongPhong
                SET coSuCoChan = CASE WHEN EXISTS (
                    SELECT 1
                    FROM dbo.SuCoThietBi
                    WHERE maPhong = @maPhong
                        AND mucDoNghiemTrong IN (N'Cao', N'Nghiêm trọng')
                        AND trangThaiBanGiao <> N'Đã xử lý'
                ) THEN 1 ELSE 0 END
                WHERE maPhong = @maPhong;
                DECLARE @trangThaiBuongPhong NVARCHAR(30), @daHoanThanhChecklist BIT, @coCongViecCanTro BIT;
                SELECT TOP(1) @trangThaiBuongPhong = trangThai,
                    @daHoanThanhChecklist = daHoanThanhChecklist,
                    @coCongViecCanTro = coSuCoChan
                FROM dbo.NhiemVuBuongPhong WITH (HOLDLOCK)
                WHERE maPhong = @maPhong
                ORDER BY thoiDiemCapNhat DESC, maNhiemVuBuongPhong DESC;
                IF @trangThaiBuongPhong IS NULL
                    OR @trangThaiBuongPhong NOT IN (N'Đã dọn xong', N'Chờ kỹ thuật', N'Sẵn sàng')
                    OR @daHoanThanhChecklist = 0
                    OR @coCongViecCanTro = 1 OR EXISTS (
                        SELECT 1
                        FROM dbo.SuCoThietBi WITH (HOLDLOCK)
                        WHERE maPhong = @maPhong
                            AND mucDoNghiemTrong IN (N'Cao', N'Nghiêm trọng')
                            AND trangThaiBanGiao <> N'Đã xử lý'
                    )
                    THROW 51919, N'Checklist housekeeping chưa hoàn tất hoặc còn incident blocking', 1;
                SET @trangThaiMoi = N'Đã bàn giao phòng';
                UPDATE dbo.PhieuCongViecKyThuat
                SET trangThai = @trangThaiMoi, thoiDiemCapNhat = @thoiDiemHienTai
                WHERE maPhieuCongViecKyThuat = @maCongViecKyThuat;
                UPDATE dbo.Phong
                SET trangThai = N'Sẵn sàng', phienBan = phienBan + 1
                WHERE maPhong = @maPhong
                    AND trangThai <> N'Sẵn sàng';
                SET @hanhDong = N'TECHNICAL_ROOM_RELEASED';
            END;
            SET @duLieuSau = CASE @trangThaiMoi
                WHEN N'Mới tạo' THEN N'NEW'
                WHEN N'Đã tiếp nhận' THEN N'ACKNOWLEDGED'
                WHEN N'Đang thực hiện' THEN N'IN_PROGRESS'
                WHEN N'Chờ nghiệm thu' THEN N'WAITING_ACCEPTANCE'
                WHEN N'Đã hoàn thành' THEN N'COMPLETED'
                WHEN N'Đã bàn giao phòng' THEN N'ROOM_RELEASED'
            END;
        END;
        INSERT dbo.NhatKyKiemSoat(
            nguoiThucHien,
            hanhDong,
            loaiDoiTuong,
            maDoiTuong,
            duLieuTruoc,
            duLieuSau,
            lyDo,
            thoiDiemTao
        )
        VALUES (
            @nguoiThucHien,
            @hanhDong,
            N'TECHNICAL_WORK_ORDER',
            @maDoiTuong,
            @trangThaiApiTruoc,
            @duLieuSau,
            CASE
                WHEN @lenh = N'accept' THEN @lyDoNghiemThu
                ELSE NULL
            END,
            TODATETIMEOFFSET(@thoiDiemHienTai, '+07:00')
        );
        SET @phanHoiJson =(
            SELECT maPhieuCongViecKyThuat AS id,
                maPhong AS room_id,
                maThietBiPhong AS equipment_id,
                nguoiDuocPhanCong AS assignee,
                CASE doUuTien
                    WHEN N'Thấp' THEN N'LOW'
                    WHEN N'Trung bình' THEN N'MEDIUM'
                    WHEN N'Cao' THEN N'HIGH'
                    WHEN N'Nghiêm trọng' THEN N'CRITICAL'
                END AS priority,
                thoiHanSla AS sla_due_at,
                vatTuSuDung AS materials,
                ghiChuKetQua AS result_note,
                ghiChuNghiemThu AS acceptance_note,
                nguoiNghiemThu AS accepted_by,
                thoiDiemNghiemThu AS accepted_at,
                CASE trangThai
                    WHEN N'Mới tạo' THEN N'NEW'
                    WHEN N'Đã tiếp nhận' THEN N'ACKNOWLEDGED'
                    WHEN N'Đang thực hiện' THEN N'IN_PROGRESS'
                    WHEN N'Chờ nghiệm thu' THEN N'WAITING_ACCEPTANCE'
                    WHEN N'Đã hoàn thành' THEN N'COMPLETED'
                    WHEN N'Đã bàn giao phòng' THEN N'ROOM_RELEASED'
                END AS status,
                nguoiTao AS created_by,
                thoiDiemTao AS created_at,
                thoiDiemCapNhat AS updated_at
            FROM dbo.PhieuCongViecKyThuat
            WHERE maPhieuCongViecKyThuat = @maCongViecKyThuat FOR JSON PATH, INCLUDE_NULL_VALUES, WITHOUT_ARRAY_WRAPPER
        );
        INSERT dbo.BanGhiChongTrung(
            phamViLenh,
            khoaChongTrung,
            nguoiThucHien,
            maBamYeuCau,
            trangThai,
            loaiPhanHoi,
            phanHoiJson,
            thoiDiemTao,
            thoiDiemHoanThanh
        )
        VALUES (
            @phamViLenh,
            @khoaChongTrung,
            @nguoiThucHien,
            @maBamYeuCau,
            N'Đã hoàn tất',
            N'com.hospitality.mis.dto.operations.TechnicalWorkOrderDtos$Response',
            @phanHoiJson,
            @thoiDiemHienTai,
            @thoiDiemHienTai
        );
        COMMIT TRANSACTION;
        SELECT @phanHoiJson AS phanHoiJson;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

-- =============================================================================
-- uspThemThongBao
-- Thêm thông báo vào hàng đợi nếu khóa chống lặp chưa có.
-- =============================================================================
CREATE PROCEDURE dbo.uspThemThongBao
    @chuDe NVARCHAR(MAX),
    @vaiTro NVARCHAR(MAX),
    @duLieuYeuCauJson NVARCHAR(MAX),
    @khoaChongTrung NVARCHAR(MAX),
    @thoiDiemHienTai DATETIME2(6),
    @maThongBao BIGINT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    SET @maThongBao = NULL;

    BEGIN TRY
        BEGIN TRANSACTION;
        SELECT @maThongBao = maThongBao
        FROM dbo.HangDoiThongBao WITH (UPDLOCK, HOLDLOCK)
        WHERE khoaChongLap = @khoaChongTrung;
        IF @maThongBao IS NULL
        BEGIN
            INSERT dbo.HangDoiThongBao(
                chuDe,
                vaiTroNguoiNhan,
                noiDung,
                trangThai,
                khoaChongLap,
                thoiDiemCoTheGui,
                thoiDiemTao
            )
            VALUES (
                @chuDe,
                @vaiTro,
                @duLieuYeuCauJson,
                N'Chờ gửi',
                @khoaChongTrung,
                @thoiDiemHienTai,
                @thoiDiemHienTai
            );
            SET @maThongBao = SCOPE_IDENTITY();
        END;
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

-- =============================================================================
-- uspDanhDauThongBaoDaGui
-- Đánh dấu thông báo đã gửi và trả lại bản ghi vừa cập nhật.
-- =============================================================================
CREATE PROCEDURE dbo.uspDanhDauThongBaoDaGui
    @maThongBao BIGINT,
    @thoiDiemHienTai DATETIME2(6)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;
        UPDATE dbo.HangDoiThongBao WITH (UPDLOCK, HOLDLOCK)
        SET trangThai = N'Đã gửi', thoiDiemGui = @thoiDiemHienTai
        WHERE maThongBao = @maThongBao;
        IF @@ROWCOUNT = 0
            THROW 52001, N'Không tìm thấy thông báo', 1;
        SELECT maThongBao,
            chuDe,
            vaiTroNguoiNhan,
            noiDung,
            trangThai,
            khoaChongLap,
            thoiDiemCoTheGui,
            thoiDiemTao,
            thoiDiemGui
        FROM dbo.HangDoiThongBao
        WHERE maThongBao = @maThongBao;
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

-- =============================================================================
-- uspKhoaLenhSuCoThietBi
-- Khóa dữ liệu của lệnh sự cố và trả ngữ cảnh hoặc kết quả đã xử lý.
-- Khóa cả danh sách thiết bị đang hoạt động để không đổi tên/thêm/xóa khi đang chọn.
-- SP này chỉ chuẩn bị dữ liệu; việc ghi sự cố do uspGhiSuCoThietBi thực hiện.
-- =============================================================================
CREATE PROCEDURE dbo.uspKhoaLenhSuCoThietBi
    @lenh NVARCHAR(20),
    @khoaChongTrung NVARCHAR(100),
    @nguoiThucHien NVARCHAR(MAX),
    @maBamYeuCau NVARCHAR(64),
    @maNhomKhoa SMALLINT,
    @maPhieuDatPhong BIGINT,
    @maPhong NVARCHAR(MAX),
    @maSuCo BIGINT,
    @nguCanhJson NVARCHAR(MAX) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    DECLARE @phamViLenh NVARCHAR(100) = CASE @lenh
        WHEN N'reservation' THEN N'equipment-incident'
        WHEN N'room' THEN N'room-incident'
        WHEN N'handoff' THEN N'equipment-incident-handoff'
    END;
    IF @phamViLenh IS NULL
        THROW 52108, N'Command sự cố không hợp lệ', 1;

    -- JDBC autoCommit=false mở giao dịch ngầm khi truy cập bảng đầu tiên;
    -- kiểm tra @@TRANCOUNT trước lần truy cập đó sẽ từ chối nhầm giao dịch hợp lệ.
    DECLARE @maNhomDaKhoa SMALLINT;
    SELECT @maNhomDaKhoa = maNhomKhoa
    FROM dbo.NhomKhoaChongTrung WITH (UPDLOCK, HOLDLOCK)
    WHERE maNhomKhoa = @maNhomKhoa;
    IF @@TRANCOUNT = 0
        THROW 51815, N'Incident cần transaction của command', 1;
    IF @maNhomDaKhoa IS NULL
        THROW 51502, N'Thiếu bucket idempotency', 1;
    DECLARE @maBanGhiChongTrung BIGINT,
        @nguoiThucHienTruoc NVARCHAR(100),
        @maBamYeuCauTruoc NVARCHAR(64),
        @trangThai NVARCHAR(20),
        @loaiPhanHoi NVARCHAR(255),
        @phanHoiJson NVARCHAR(MAX);
    SELECT @maBanGhiChongTrung = maBanGhiChongTrung,
        @nguoiThucHienTruoc = nguoiThucHien,
        @maBamYeuCauTruoc = maBamYeuCau,
        @trangThai = trangThai,
        @loaiPhanHoi = loaiPhanHoi,
        @phanHoiJson = phanHoiJson
    FROM dbo.BanGhiChongTrung WITH (UPDLOCK, HOLDLOCK)
    WHERE phamViLenh = @phamViLenh
        AND khoaChongTrung = @khoaChongTrung;
    IF @maBanGhiChongTrung IS NOT NULL
    BEGIN
        IF @nguoiThucHienTruoc COLLATE Latin1_General_100_BIN2 <> @nguoiThucHien COLLATE Latin1_General_100_BIN2
            OR @maBamYeuCauTruoc <> @maBamYeuCau
            THROW 51005, N'Idempotency key đã được dùng cho yêu cầu khác', 1;
        IF @trangThai <> N'Đã hoàn tất'
            OR @phanHoiJson IS NULL
            THROW 51503, N'Yêu cầu cùng key đang xử lý', 1;
        IF @loaiPhanHoi IS NULL
            OR @loaiPhanHoi <> N'com.hospitality.mis.dto.operations.EquipmentIncidentDtos$Response'
            THROW 51005, N'Kiểu kết quả idempotency không khớp', 1;
        SET @nguCanhJson =(
            SELECT @phanHoiJson AS replay FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
        );
        RETURN;
    END;
    IF @lenh = N'reservation'
    BEGIN
        DECLARE @trangThaiDatPhong NVARCHAR(30);
        SELECT @trangThaiDatPhong = trangThai
        FROM dbo.PhieuDatPhong WITH (UPDLOCK, HOLDLOCK)
        WHERE maPhieuDatPhong = @maPhieuDatPhong;
        IF @trangThaiDatPhong IS NULL
            THROW 52101, N'Không tìm thấy đặt phòng', 1;
        IF @trangThaiDatPhong <> N'Đã nhận phòng'
            THROW 52102, N'Chỉ ghi nhận sự cố khi khách đang ở', 1;
        IF NOT EXISTS (
            SELECT 1
            FROM dbo.ChiTietDatPhong WITH (UPDLOCK, HOLDLOCK)
            WHERE maPhieuDatPhong = @maPhieuDatPhong
                AND maPhong = @maPhong
                AND trangThai = N'Đang có khách'
        )
            THROW 52104, N'Phòng không thuộc đặt phòng này', 1;
    END;

    -- Chuyển trạng thái bàn giao sự cố.
    IF @lenh = N'handoff'
    BEGIN
        SELECT @maPhong = maPhong
        FROM dbo.SuCoThietBi
        WHERE maSuCoThietBi = @maSuCo;
        IF @maPhong IS NULL
            THROW 52103, N'Không tìm thấy sự cố', 1;
    END;
    IF NOT EXISTS (
        SELECT 1
        FROM dbo.Phong WITH (UPDLOCK, HOLDLOCK)
        WHERE maPhong = @maPhong
    )
        THROW 51601, N'Không tìm thấy phòng', 1;

    -- Chuyển trạng thái bàn giao sự cố.
    IF @lenh = N'handoff'
    BEGIN
        IF NOT EXISTS (
            SELECT 1
            FROM dbo.SuCoThietBi WITH (UPDLOCK, HOLDLOCK)
            WHERE maSuCoThietBi = @maSuCo
        )
            THROW 52103, N'Không tìm thấy sự cố', 1;
        SET @nguCanhJson = N'{}';
        RETURN;
    END;
    SET @nguCanhJson =(
        SELECT JSON_QUERY((
            SELECT maThietBiPhong AS id,
                maPhong AS room_id,
                ten AS name,
                giaTriBanDau AS original_value,
                ngayMua AS purchased_on,
                soLuong AS quantity,
                dangHoatDong AS active
            FROM dbo.ThietBiPhong WITH (UPDLOCK, HOLDLOCK)
            WHERE maPhong = @maPhong
                AND dangHoatDong = 1
            ORDER BY ten, maThietBiPhong FOR JSON PATH
        )) AS equipment FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
    );
END;
GO

-- =============================================================================
-- uspGhiSuCoThietBi
-- Ghi sự cố/bàn giao, bồi thường, nhật ký, thông báo và kết quả chống trùng.
-- Thứ tự khóa: nhóm chống trùng -> booking -> phòng -> thiết bị/sự cố -> hàng đợi.
-- Nếu bên gọi có giao dịch ngoài, khóa được giữ tới khi giao dịch ngoài kết thúc.
-- =============================================================================
CREATE PROCEDURE dbo.uspGhiSuCoThietBi
    @lenh NVARCHAR(20),
    @maSuCo BIGINT,
    @maPhieuDatPhong BIGINT,
    @maPhong NVARCHAR(MAX),
    @maThietBi BIGINT,
    @ten NVARCHAR(MAX),
    @tenChuanHoa NVARCHAR(MAX),
    @soLuong INT,
    @mucDoNghiemTrong NVARCHAR(20),
    @ghiChu NVARCHAR(MAX),
    @trangThaiMoi NVARCHAR(20),
    @duocPhepXuLy BIT,
    @nguoiThucHien NVARCHAR(MAX),
    @khoaChongTrung NVARCHAR(100),
    @maBamYeuCau NVARCHAR(64),
    @maNhomKhoa SMALLINT,
    @thoiDiemHienTai DATETIME2(6)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;
        DECLARE @nguCanhJson NVARCHAR(MAX),
            @phanHoiJson NVARCHAR(MAX),
            @phamViLenh NVARCHAR(100) = CASE @lenh
                WHEN N'reservation' THEN N'equipment-incident'
                WHEN N'room' THEN N'room-incident'
                WHEN N'handoff' THEN N'equipment-incident-handoff'
            END;
        EXEC dbo.uspKhoaLenhSuCoThietBi @lenh,
            @khoaChongTrung,
            @nguoiThucHien,
            @maBamYeuCau,
            @maNhomKhoa,
            @maPhieuDatPhong,
            @maPhong,
            @maSuCo,
            @nguCanhJson OUTPUT;

        -- OPENJSON đọc được phản hồi dài hơn giới hạn 4.000 ký tự của JSON_VALUE.
        SELECT @phanHoiJson = replay
        FROM OPENJSON(@nguCanhJson) WITH (replay NVARCHAR(MAX) '$.replay');
        IF @phanHoiJson IS NOT NULL
        BEGIN
            COMMIT TRANSACTION;
            SELECT @phanHoiJson AS phanHoiJson;
            RETURN;
        END;
        DECLARE @trangThaiTruoc NVARCHAR(20),
            @trangThaiApiTruoc NVARCHAR(20),
            @trangThaiApiSau NVARCHAR(20),
            @soTien DECIMAL(19, 2) = 0,
            @giaTriBanDau DECIMAL(14, 2) = 0,
            @ngayMua DATE = CAST(@thoiDiemHienTai AS DATE),
            @tenThietBiDaLuu NVARCHAR(100),
            @soLuongHienCo INT,
            @maSuKien BIGINT;

        -- Chuyển trạng thái bàn giao sự cố.
        IF @lenh = N'handoff'
        BEGIN
            SELECT @trangThaiTruoc = trangThaiBanGiao,
                @maPhong = maPhong
            FROM dbo.SuCoThietBi
            WHERE maSuCoThietBi = @maSuCo;
            IF @trangThaiMoi = N'Đã xử lý'
                AND @duocPhepXuLy = 0
                THROW 52109, N'Chỉ Technical hoặc Manager mới được resolve incident', 1;
            IF @trangThaiMoi IS NULL
                OR NOT (
                    @trangThaiTruoc = @trangThaiMoi
                    OR (
                        @trangThaiTruoc = N'Đang mở'
                        AND @trangThaiMoi = N'Đã tiếp nhận'
                    )
                    OR (
                        @trangThaiTruoc = N'Đã tiếp nhận'
                        AND @trangThaiMoi = N'Đã xử lý'
                    )
                )
                THROW 52110, N'Chuyển trạng thái handoff không hợp lệ', 1;
            UPDATE dbo.SuCoThietBi
            SET trangThaiBanGiao = @trangThaiMoi, ghiChuBanGiao = @ghiChu
            WHERE maSuCoThietBi = @maSuCo;
            IF @trangThaiMoi = N'Đã xử lý'
            BEGIN
                UPDATE dbo.NhiemVuBuongPhong
                SET coSuCoChan = CASE WHEN EXISTS (
                    SELECT 1
                    FROM dbo.SuCoThietBi
                    WHERE maPhong = @maPhong
                        AND mucDoNghiemTrong IN (N'Cao', N'Nghiêm trọng')
                        AND trangThaiBanGiao <> N'Đã xử lý'
                ) THEN 1 ELSE 0 END
                WHERE maPhong = @maPhong;
            END;
            SET @trangThaiApiTruoc = CASE @trangThaiTruoc
                WHEN N'Đang mở' THEN N'OPEN'
                WHEN N'Đã tiếp nhận' THEN N'ACKNOWLEDGED'
                WHEN N'Đã xử lý' THEN N'RESOLVED'
            END;
            SET @trangThaiApiSau = CASE @trangThaiMoi
                WHEN N'Đang mở' THEN N'OPEN'
                WHEN N'Đã tiếp nhận' THEN N'ACKNOWLEDGED'
                WHEN N'Đã xử lý' THEN N'RESOLVED'
            END;
            INSERT dbo.NhatKyKiemSoat(
                nguoiThucHien,
                hanhDong,
                loaiDoiTuong,
                maDoiTuong,
                duLieuTruoc,
                duLieuSau,
                lyDo,
                thoiDiemTao
            )
            VALUES (
                @nguoiThucHien,
                N'EQUIPMENT_INCIDENT_HANDOFF',
                N'EQUIPMENT_INCIDENT',
                CONVERT(NVARCHAR(30), @maSuCo),
                @trangThaiApiTruoc,
                @trangThaiApiSau,
                @ghiChu,
                TODATETIMEOFFSET(@thoiDiemHienTai, '+07:00')
            );
        END
        ELSE
        BEGIN
            SELECT @tenThietBiDaLuu = ten,
                @giaTriBanDau = giaTriBanDau,
                @ngayMua = ngayMua,
                @soLuongHienCo = soLuong
            FROM dbo.ThietBiPhong
            WHERE maThietBiPhong = @maThietBi
                AND maPhong = @maPhong
                AND dangHoatDong = 1;
            IF @lenh = N'reservation'
            BEGIN
                IF @tenThietBiDaLuu IS NULL
                    THROW 51602, N'Thiết bị active không thuộc phòng', 1;
                IF @soLuong > @soLuongHienCo
                    THROW 52106, N'Số lượng hư hỏng vượt số lượng thiết bị', 1;
                IF @ngayMua > CAST(@thoiDiemHienTai AS DATE)
                    THROW 52107, N'Ngày mua thiết bị không được sau ngày tính bồi thường', 1;
                SET @soTien = dbo.fnTinhBoiThuongThietBi(@giaTriBanDau, @ngayMua, @soLuong, CAST(@thoiDiemHienTai AS DATE));
            END;
            SET @mucDoNghiemTrong = COALESCE(@mucDoNghiemTrong, N'Trung bình');
            INSERT dbo.SuCoThietBi(
                maPhieuDatPhong,
                maPhong,
                tenThietBi,
                giaTriBanDau,
                ngayMua,
                soLuong,
                tienBoiThuong,
                thoiDiemTao,
                mucDoNghiemTrong,
                trangThaiBanGiao,
                ghiChuBanGiao
            )
            VALUES (
                CASE
                    WHEN @lenh = N'reservation' THEN @maPhieuDatPhong
                    ELSE NULL
                END,
                @maPhong,
                CASE
                    WHEN @lenh = N'reservation' THEN @tenThietBiDaLuu
                    ELSE @tenChuanHoa
                END,
                @giaTriBanDau,
                @ngayMua,
                @soLuong,
                @soTien,
                @thoiDiemHienTai,
                @mucDoNghiemTrong,
                N'Đang mở',
                CASE
                    WHEN @lenh = N'room' THEN @ghiChu
                    ELSE NULL
                END
            );
            SET @maSuCo = SCOPE_IDENTITY();
            INSERT dbo.NhatKyKiemSoat(
                nguoiThucHien,
                hanhDong,
                loaiDoiTuong,
                maDoiTuong,
                duLieuSau,
                lyDo,
                thoiDiemTao
            )
            VALUES (
                @nguoiThucHien,
                N'EQUIPMENT_INCIDENT_RECORDED',
                CASE
                    WHEN @lenh = N'reservation' THEN N'RESERVATION'
                    ELSE N'ROOM'
                END,
                CASE
                    WHEN @lenh = N'reservation' THEN CONVERT(NVARCHAR(30), @maPhieuDatPhong)
                    ELSE @maPhong
                END,
                CASE
                    WHEN @lenh = N'reservation' THEN CONVERT(NVARCHAR(40), @soTien)
                    ELSE @ten
                END,
                CASE
                    WHEN @lenh = N'room' THEN @ghiChu
                    ELSE NULL
                END,
                TODATETIMEOFFSET(@thoiDiemHienTai, '+07:00')
            );
            DECLARE @duLieuYeuCauJson NVARCHAR(MAX),
                @tienToMa NVARCHAR(50) = CASE
                    WHEN @lenh = N'room' THEN N'room-incident-'
                    ELSE N'equipment-incident-'
                END,
                @khoaChongTrungThongBao NVARCHAR(100);
            IF @lenh = N'room'
                SET @duLieuYeuCauJson =(
                    SELECT @maPhong AS room_id,
                        @ten AS equipment_name FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
                );
            ELSE
                SET @duLieuYeuCauJson =(
                    SELECT @maPhieuDatPhong AS reservation_id,
                        @maPhong AS room_id,
                        @soTien AS compensation FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
                );
            SET @khoaChongTrungThongBao = @tienToMa + CONVERT(NVARCHAR(30), @maSuCo);
            EXEC dbo.uspThemThongBao N'EQUIPMENT_INCIDENT',
                N'Lễ tân',
                @duLieuYeuCauJson,
                @khoaChongTrungThongBao,
                @thoiDiemHienTai,
                @maSuKien OUTPUT;
            SET @khoaChongTrungThongBao = @tienToMa + N'tech-' + CONVERT(NVARCHAR(30), @maSuCo);
            EXEC dbo.uspThemThongBao N'EQUIPMENT_INCIDENT',
                N'Kỹ thuật',
                @duLieuYeuCauJson,
                @khoaChongTrungThongBao,
                @thoiDiemHienTai,
                @maSuKien OUTPUT;
            IF @mucDoNghiemTrong IN (N'Cao', N'Nghiêm trọng')
            BEGIN
                SET @khoaChongTrungThongBao = @tienToMa + N'manager-' + CONVERT(NVARCHAR(30), @maSuCo);
                EXEC dbo.uspThemThongBao N'EQUIPMENT_INCIDENT',
                    N'Quản lý',
                    @duLieuYeuCauJson,
                    @khoaChongTrungThongBao,
                    @thoiDiemHienTai,
                    @maSuKien OUTPUT;
            END;
        END;
        SET @phanHoiJson =(
            SELECT maSuCoThietBi AS id,
                maPhieuDatPhong AS reservation_id,
                maPhong AS room_id,
                tenThietBi AS equipment_name,
                tienBoiThuong AS compensation,
                CASE mucDoNghiemTrong
                    WHEN N'Thấp' THEN N'LOW'
                    WHEN N'Trung bình' THEN N'MEDIUM'
                    WHEN N'Cao' THEN N'HIGH'
                    WHEN N'Nghiêm trọng' THEN N'CRITICAL'
                END AS severity,
                CASE trangThaiBanGiao
                    WHEN N'Đang mở' THEN N'OPEN'
                    WHEN N'Đã tiếp nhận' THEN N'ACKNOWLEDGED'
                    WHEN N'Đã xử lý' THEN N'RESOLVED'
                END AS handoff_status,
                ghiChuBanGiao AS handoff_note
            FROM dbo.SuCoThietBi
            WHERE maSuCoThietBi = @maSuCo FOR JSON PATH, INCLUDE_NULL_VALUES, WITHOUT_ARRAY_WRAPPER
        );
        IF @lenh = N'room'
            SET @phanHoiJson = JSON_MODIFY(@phanHoiJson, '$.compensation', CAST(0 AS INT));
        INSERT dbo.BanGhiChongTrung(
            phamViLenh,
            khoaChongTrung,
            nguoiThucHien,
            maBamYeuCau,
            trangThai,
            loaiPhanHoi,
            phanHoiJson,
            thoiDiemTao,
            thoiDiemHoanThanh
        )
        VALUES (
            @phamViLenh,
            @khoaChongTrung,
            @nguoiThucHien,
            @maBamYeuCau,
            N'Đã hoàn tất',
            N'com.hospitality.mis.dto.operations.EquipmentIncidentDtos$Response',
            @phanHoiJson,
            @thoiDiemHienTai,
            @thoiDiemHienTai
        );
        COMMIT TRANSACTION;
        SELECT @phanHoiJson AS phanHoiJson;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

-- =============================================================================
-- uspGhiNhatKyKiemSoat
-- Ghi thêm sự kiện audit; dùng chung giao dịch nghiệp vụ hoặc giao dịch bảo mật riêng.
-- Tham số MAX để SQL kiểm tra độ dài khi ghi, tránh cắt ngắn dữ liệu đầu vào.
-- =============================================================================
CREATE PROCEDURE dbo.uspGhiNhatKyKiemSoat
    @nguoiThucHien NVARCHAR(MAX),
    @hanhDong NVARCHAR(MAX),
    @loaiDoiTuong NVARCHAR(MAX),
    @maDoiTuong NVARCHAR(MAX),
    @duLieuTruoc NVARCHAR(MAX),
    @duLieuSau NVARCHAR(MAX),
    @lyDo NVARCHAR(MAX),
    @maLienKet NVARCHAR(MAX),
    @thoiDiemHienTai DATETIMEOFFSET(6)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;
        INSERT dbo.NhatKyKiemSoat(
            nguoiThucHien,
            hanhDong,
            loaiDoiTuong,
            maDoiTuong,
            duLieuTruoc,
            duLieuSau,
            lyDo,
            khoaLienKet,
            thoiDiemTao
        )
        VALUES (
            @nguoiThucHien,
            @hanhDong,
            @loaiDoiTuong,
            @maDoiTuong,
            @duLieuTruoc,
            @duLieuSau,
            @lyDo,
            @maLienKet,
            @thoiDiemHienTai
        );
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

-- =============================================================================
-- uspNhanKhoaChongTrung
-- Nhận quyền xử lý yêu cầu mới hoặc trả kết quả của yêu cầu đã hoàn tất.
-- Khóa được giữ trong giao dịch của bên gọi; kết quả chống trùng được lưu trong DB.
-- Truy cập bảng đầu tiên mở giao dịch ngầm của JDBC trước khi kiểm tra @@TRANCOUNT.
-- =============================================================================
CREATE PROCEDURE dbo.uspNhanKhoaChongTrung
    @phamViLenh NVARCHAR(MAX),
    @khoaChongTrung NVARCHAR(MAX),
    @nguoiThucHien NVARCHAR(MAX),
    @maBamYeuCau NVARCHAR(MAX),
    @maNhomKhoa SMALLINT,
    @thoiDiemHienTai DATETIME2(6)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    DECLARE @maDaKhoa SMALLINT,
        @maBanGhiChongTrung BIGINT,
        @nguoiThucHienTruoc NVARCHAR(100),
        @maBamYeuCauTruoc NVARCHAR(64),
        @trangThai NVARCHAR(20),
        @loaiPhanHoi NVARCHAR(255),
        @phanHoiJson NVARCHAR(MAX);
    SELECT @maDaKhoa = maNhomKhoa
    FROM dbo.NhomKhoaChongTrung WITH (UPDLOCK, HOLDLOCK)
    WHERE maNhomKhoa = @maNhomKhoa;
    IF @@TRANCOUNT = 0
        THROW 51815, N'Claim yêu cầu transaction của caller', 1;
    IF @maDaKhoa IS NULL
        THROW 51502, N'Thiếu bucket idempotency', 1;
    SELECT @maBanGhiChongTrung = maBanGhiChongTrung,
        @nguoiThucHienTruoc = nguoiThucHien,
        @maBamYeuCauTruoc = maBamYeuCau,
        @trangThai = trangThai,
        @loaiPhanHoi = loaiPhanHoi,
        @phanHoiJson = phanHoiJson
    FROM dbo.BanGhiChongTrung WITH (UPDLOCK, HOLDLOCK)
    WHERE phamViLenh = @phamViLenh
        AND khoaChongTrung = @khoaChongTrung;
    IF @maBanGhiChongTrung IS NOT NULL
    BEGIN
        IF @nguoiThucHienTruoc COLLATE Latin1_General_100_BIN2 <> @nguoiThucHien COLLATE Latin1_General_100_BIN2
            OR DATALENGTH(@nguoiThucHienTruoc) <> DATALENGTH(@nguoiThucHien)
            OR @maBamYeuCauTruoc COLLATE Latin1_General_100_BIN2 <> @maBamYeuCau COLLATE Latin1_General_100_BIN2
            OR DATALENGTH(@maBamYeuCauTruoc) <> DATALENGTH(@maBamYeuCau)
            THROW 51005, N'Actor hoặc payload không khớp idempotency', 1;
        IF @trangThai <> N'Đã hoàn tất'
            OR @phanHoiJson IS NULL
            THROW 51503, N'Yêu cầu idempotency đang xử lý', 1;
        SELECT CAST(0 AS BIT) AS fresh,
            @loaiPhanHoi AS responseType,
            @phanHoiJson AS responseJson;
        RETURN;
    END;
    INSERT dbo.BanGhiChongTrung(
        phamViLenh,
        khoaChongTrung,
        nguoiThucHien,
        maBamYeuCau,
        trangThai,
        thoiDiemTao
    )
    VALUES (
        @phamViLenh,
        @khoaChongTrung,
        @nguoiThucHien,
        @maBamYeuCau,
        N'Đang xử lý',
        @thoiDiemHienTai
    );
    SELECT CAST(1 AS BIT) AS fresh,
        CAST(NULL AS NVARCHAR(255)) AS responseType,
        CAST(NULL AS NVARCHAR(MAX)) AS responseJson;
END;
GO

-- =============================================================================
-- uspHoanThanhChongTrung
-- Hoàn tất đúng yêu cầu đã nhận và lưu kiểu/phản hồi JSON để xử lý lần gọi lại.
-- Phải hoàn tất trong cùng giao dịch đã nhận quyền xử lý yêu cầu.
-- =============================================================================
CREATE PROCEDURE dbo.uspHoanThanhChongTrung
    @phamViLenh NVARCHAR(MAX),
    @khoaChongTrung NVARCHAR(MAX),
    @nguoiThucHien NVARCHAR(MAX),
    @maBamYeuCau NVARCHAR(MAX),
    @loaiPhanHoi NVARCHAR(MAX),
    @phanHoiJson NVARCHAR(MAX),
    @thoiDiemHienTai DATETIME2(6)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY

        -- Phải hoàn tất yêu cầu trong cùng giao dịch đã nhận quyền xử lý.
        DECLARE @maBanGhiChongTrung BIGINT;
        SELECT @maBanGhiChongTrung = maBanGhiChongTrung
        FROM dbo.BanGhiChongTrung WITH (UPDLOCK, HOLDLOCK)
        WHERE phamViLenh = @phamViLenh
            AND khoaChongTrung = @khoaChongTrung
            AND trangThai = N'Đang xử lý'
            AND nguoiThucHien COLLATE Latin1_General_100_BIN2 = @nguoiThucHien COLLATE Latin1_General_100_BIN2
            AND DATALENGTH(nguoiThucHien) = DATALENGTH(@nguoiThucHien)
            AND maBamYeuCau COLLATE Latin1_General_100_BIN2 = @maBamYeuCau COLLATE Latin1_General_100_BIN2
            AND DATALENGTH(maBamYeuCau) = DATALENGTH(@maBamYeuCau);
        IF @@TRANCOUNT = 0
            THROW 51815, N'Complete yêu cầu transaction của caller', 1;
        IF @maBanGhiChongTrung IS NULL
            THROW 51005, N'Claim không còn hợp lệ', 1;
        IF ISJSON(@phanHoiJson, VALUE) <> 1
            THROW 51008, N'Kết quả idempotency phải là JSON hợp lệ', 1;
        UPDATE dbo.BanGhiChongTrung
        SET trangThai = N'Đã hoàn tất',
            loaiPhanHoi = @loaiPhanHoi,
            phanHoiJson = @phanHoiJson,
            thoiDiemHoanThanh = @thoiDiemHienTai,
            phienBan = phienBan + 1
        WHERE maBanGhiChongTrung = @maBanGhiChongTrung;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

-- =============================================================================
-- uspLenhPheDuyet
-- Tạo, duyệt, từ chối, hết hạn hoặc sử dụng phê duyệt đúng nội dung yêu cầu.
-- Việc sử dụng phê duyệt và thay đổi đối tượng phải cùng giao dịch của bên gọi.
-- =============================================================================
CREATE PROCEDURE dbo.uspLenhPheDuyet
    @lenh NVARCHAR(30),
    @maYeuCauPheDuyet BIGINT OUTPUT,
    @nguoiThucHien NVARCHAR(MAX),
    @hanhDong NVARCHAR(MAX),
    @maDoiTuong NVARCHAR(MAX),
    @duLieuYeuCauJson NVARCHAR(MAX),
    @maBamYeuCau NVARCHAR(MAX),
    @soTien DECIMAL(19, 4),
    @lyDo NVARCHAR(MAX),
    @mucDoRuiRo NVARCHAR(MAX),
    @khoaChongTrung NVARCHAR(MAX),
    @laGiamDoc BIT,
    @thoiDiemHienTai DATETIMEOFFSET(6)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        -- Tạo bản ghi mới.
        IF @lenh = N'create'
        BEGIN
            INSERT dbo.YeuCauPheDuyet(
                nguoiYeuCau,
                hanhDong,
                maDoiTuong,
                duLieuThayDoi,
                dauVanTayDuLieu,
                soTien,
                lyDo,
                mucDoRuiRo,
                thoiDiemYeuCau,
                trangThai,
                thoiDiemHetHan,
                khoaLienKet
            )
            VALUES (
                @nguoiThucHien,
                @hanhDong,
                @maDoiTuong,
                @duLieuYeuCauJson,
                @maBamYeuCau,
                @soTien,
                @lyDo,
                @mucDoRuiRo,
                @thoiDiemHienTai,
                N'Chờ phê duyệt',
                DATEADD(HOUR, 24, @thoiDiemHienTai),
                @khoaChongTrung
            );
            SET @maYeuCauPheDuyet = SCOPE_IDENTITY();
            INSERT dbo.NhatKyKiemSoat(
                nguoiThucHien,
                hanhDong,
                loaiDoiTuong,
                maDoiTuong,
                duLieuSau,
                lyDo,
                khoaLienKet,
                thoiDiemTao
            )
            VALUES (
                @nguoiThucHien,
                N'APPROVAL_REQUESTED',
                N'APPROVAL',
                CONVERT(NVARCHAR(100), @maYeuCauPheDuyet),
                N'PENDING',
                @lyDo,
                @khoaChongTrung,
                @thoiDiemHienTai
            );
        END

        -- Đánh dấu các yêu cầu đã hết hạn.
        ELSE IF @lenh = N'expire'
        BEGIN
            DECLARE @daHetHan TABLE (id BIGINT, reason NVARCHAR(500), correlation NVARCHAR(100));
            UPDATE dbo.YeuCauPheDuyet WITH (UPDLOCK, HOLDLOCK)
            SET trangThai = N'Đã hết hạn', thoiDiemQuyetDinh = @thoiDiemHienTai OUTPUT inserted.maYeuCauPheDuyet, inserted.lyDo, inserted.khoaLienKet INTO @daHetHan
            WHERE trangThai = N'Chờ phê duyệt'
                AND thoiDiemHetHan <= @thoiDiemHienTai;
            INSERT dbo.NhatKyKiemSoat(
                nguoiThucHien,
                hanhDong,
                loaiDoiTuong,
                maDoiTuong,
                duLieuTruoc,
                duLieuSau,
                lyDo,
                khoaLienKet,
                thoiDiemTao
            )
            SELECT N'SYSTEM',
                N'APPROVAL_EXPIRED',
                N'APPROVAL',
                CONVERT(NVARCHAR(100), id),
                N'PENDING',
                N'EXPIRED',
                reason,
                correlation,
                @thoiDiemHienTai
            FROM @daHetHan;
        END
        ELSE
        BEGIN
            DECLARE @nguoiYeuCau NVARCHAR(50),
                @trangThaiCu NVARCHAR(20),
                @hanhDongDaLuu NVARCHAR(50),
                @thoiDiemHetHan DATETIMEOFFSET(6),
                @lyDoDaLuu NVARCHAR(500),
                @maLienKet NVARCHAR(100),
                @trangThaiMoi NVARCHAR(20),
                @hanhDongNhatKy NVARCHAR(100);
            IF @lenh IN (N'require', N'consume-requester', N'consume-approver')
            BEGIN
                SET @maYeuCauPheDuyet = NULL;
                SELECT TOP(1) @maYeuCauPheDuyet = maYeuCauPheDuyet
                FROM dbo.YeuCauPheDuyet WITH (UPDLOCK, HOLDLOCK)
                WHERE hanhDong = @hanhDong
                    AND maDoiTuong = @maDoiTuong
                    AND trangThai = N'Đã phê duyệt'
                    AND thoiDiemSuDung IS NULL
                    AND dauVanTayDuLieu = @maBamYeuCau
                    AND (
                        (
                            @soTien IS NULL
                            AND soTien IS NULL
                        )
                        OR soTien = @soTien
                    )
                    AND (
                        @lenh = N'consume-approver'
                        OR (
                            nguoiYeuCau COLLATE Latin1_General_100_BIN2 = @nguoiThucHien COLLATE Latin1_General_100_BIN2
                            AND DATALENGTH(nguoiYeuCau) = DATALENGTH(@nguoiThucHien)
                        )
                    )
                ORDER BY maYeuCauPheDuyet DESC;
                IF @maYeuCauPheDuyet IS NULL
                    THROW 52205, N'Cần exact approval', 1;
            END;
            SELECT @nguoiYeuCau = nguoiYeuCau,
                @trangThaiCu = trangThai,
                @hanhDongDaLuu = hanhDong,
                @thoiDiemHetHan = thoiDiemHetHan,
                @lyDoDaLuu = lyDo,
                @maLienKet = khoaLienKet
            FROM dbo.YeuCauPheDuyet WITH (UPDLOCK, HOLDLOCK)
            WHERE maYeuCauPheDuyet = @maYeuCauPheDuyet;
            IF @nguoiYeuCau IS NULL
                THROW 52201, N'Không tìm thấy approval', 1;
            IF @lenh IN (N'approve', N'reject')
            BEGIN
                IF @trangThaiCu = N'Chờ phê duyệt'
                    AND @thoiDiemHetHan <= @thoiDiemHienTai
                    THROW 52202, N'Approval đã hết hạn', 1;
                IF @hanhDongDaLuu IN (N'Hoàn tiền thanh toán', N'Hoàn tiền đặt cọc')
                    AND @laGiamDoc = 0
                    THROW 52203, N'Chỉ DIRECTOR được duyệt hoàn tiền', 1;
                IF @trangThaiCu <> N'Chờ phê duyệt'
                    THROW 52204, N'Approval đã quyết định', 1;
                IF @nguoiYeuCau COLLATE Latin1_General_100_BIN2 = @nguoiThucHien COLLATE Latin1_General_100_BIN2
                    AND DATALENGTH(@nguoiYeuCau) = DATALENGTH(@nguoiThucHien)
                    THROW 52206, N'Không được tự duyệt', 1;
                SET @trangThaiMoi = CASE @lenh
                    WHEN N'approve' THEN N'Đã phê duyệt'
                    ELSE N'Bị từ chối'
                END;
                SET @hanhDongNhatKy = CASE @lenh
                    WHEN N'approve' THEN N'APPROVAL_APPROVED'
                    ELSE N'APPROVAL_REJECTED'
                END;
                UPDATE dbo.YeuCauPheDuyet
                SET trangThai = @trangThaiMoi, nguoiPheDuyet = @nguoiThucHien, thoiDiemQuyetDinh = @thoiDiemHienTai
                WHERE maYeuCauPheDuyet = @maYeuCauPheDuyet;
            END
            ELSE IF @lenh IN (N'require', N'consume-requester', N'consume-approver')
            BEGIN
                IF @thoiDiemHetHan <= @thoiDiemHienTai
                    THROW 52202, N'Approval đã hết hạn', 1;
                IF @lenh = N'consume-approver'
                    AND @nguoiYeuCau COLLATE Latin1_General_100_BIN2 = @nguoiThucHien COLLATE Latin1_General_100_BIN2
                    AND DATALENGTH(@nguoiYeuCau) = DATALENGTH(@nguoiThucHien)
                    THROW 52206, N'Requester không được tự kích hoạt', 1;
                IF @lenh <> N'require'
                BEGIN
                    SET @trangThaiMoi = N'Đã sử dụng';
                    SET @hanhDongNhatKy = N'APPROVAL_CONSUMED';
                    UPDATE dbo.YeuCauPheDuyet
                    SET trangThai = @trangThaiMoi, thoiDiemSuDung = @thoiDiemHienTai
                    WHERE maYeuCauPheDuyet = @maYeuCauPheDuyet
                        AND trangThai = N'Đã phê duyệt'
                        AND thoiDiemSuDung IS NULL;
                    IF @@ROWCOUNT <> 1
                        THROW 52205, N'Approval đã consume', 1;
                END;
            END
            ELSE
                THROW 51008, N'Lệnh approval không hợp lệ', 1;
            IF @hanhDongNhatKy IS NOT NULL
                INSERT dbo.NhatKyKiemSoat(
                    nguoiThucHien,
                    hanhDong,
                    loaiDoiTuong,
                    maDoiTuong,
                    duLieuTruoc,
                    duLieuSau,
                    lyDo,
                    khoaLienKet,
                    thoiDiemTao
                )
                VALUES (
                    @nguoiThucHien,
                    @hanhDongNhatKy,
                    N'APPROVAL',
                    CONVERT(NVARCHAR(100), @maYeuCauPheDuyet),
                    CASE @trangThaiCu
                        WHEN N'Chờ phê duyệt' THEN N'PENDING'
                        ELSE N'APPROVED'
                    END,
                    CASE @trangThaiMoi
                        WHEN N'Đã phê duyệt' THEN N'APPROVED'
                        WHEN N'Bị từ chối' THEN N'REJECTED'
                        ELSE N'CONSUMED'
                    END,
                    @lyDoDaLuu,
                    @maLienKet,
                    @thoiDiemHienTai
                );
        END;
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

-- =============================================================================
-- uspGhiButToanTaiChinh
-- Ghi thêm bút toán đã chốt; sửa sai bằng bút toán mới thay vì sửa lịch sử.
-- =============================================================================
CREATE PROCEDURE dbo.uspGhiButToanTaiChinh
    @loaiButToan NVARCHAR(MAX),
    @loaiNguon NVARCHAR(MAX),
    @maNguon NVARCHAR(MAX),
    @chieuButToan NVARCHAR(MAX),
    @soTien DECIMAL(38, 6),
    @nguoiThucHien NVARCHAR(MAX),
    @thoiDiemHienTai DATETIME2(6),
    @ghiChu NVARCHAR(MAX)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;
        INSERT dbo.ButToanTaiChinh(
            loaiButToan,
            loaiNguon,
            maNguon,
            chieuButToan,
            soTien,
            maNguoiThucHien,
            thoiDiemPhatSinh,
            ghiChu,
            daChotSo
        )
        VALUES (
            @loaiButToan,
            @loaiNguon,
            @maNguon,
            @chieuButToan,
            @soTien,
            @nguoiThucHien,
            @thoiDiemHienTai,
            @ghiChu,
            1
        );
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

-- =============================================================================
-- uspLenhTaiChinh
-- Ghi bàn giao tiền ca, khoản chi, công nợ hoặc thanh toán công nợ.
-- Bên gọi giữ khóa chống trùng; lịch sử, bút toán và audit cùng commit/rollback.
-- =============================================================================
CREATE PROCEDURE dbo.uspLenhTaiChinh
    @lenh NVARCHAR(20),
    @ma BIGINT OUTPUT,
    @nguoiThucHien NVARCHAR(MAX),
    @duLieuThuNhat NVARCHAR(MAX),
    @duLieuThuHai NVARCHAR(MAX),
    @soTien DECIMAL(38, 6),
    @danhSachMenhGiaJson NVARCHAR(MAX),
    @ghiChu NVARCHAR(MAX),
    @khoaChongTrung NVARCHAR(MAX),
    @soTienNhatKy NVARCHAR(MAX),
    @thoiDiemHienTai DATETIME2(6),
    @phuongThucThanhToan NVARCHAR(30) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;
        DECLARE @hanhDong NVARCHAR(100),
            @loaiNguon NVARCHAR(40),
            @loaiButToan NVARCHAR(40),
            @chieuButToan NVARCHAR(10),
            @soTienButToan DECIMAL(38, 6) = @soTien,
            @ghiChuButToan NVARCHAR(MAX) = @ghiChu,
            @ghiChuNhatKy NVARCHAR(MAX) = NULL;
        IF @soTien IS NULL
            OR @soTien < 0
            OR (
                @lenh <> N'handover'
                AND @soTien <= 0
            )
            THROW 51008, N'Số tiền không hợp lệ', 1;

        IF @lenh IN(N'expense',N'settle') AND (@phuongThucThanhToan IS NULL OR @phuongThucThanhToan NOT IN(N'Tiền mặt',N'Thẻ',N'Chuyển khoản ngân hàng'))
            THROW 52314, N'Khoản chi và thanh toán công nợ phải có phương thức hợp lệ', 1;
        IF @phuongThucThanhToan=N'Tiền mặt'
        BEGIN
            DECLARE @ketQuaKhoaChi INT;
            EXEC @ketQuaKhoaChi=sys.sp_getapplock @Resource=N'finance-cash-custody',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=15000;
            IF @ketQuaKhoaChi<0 THROW 52310,N'Không lấy được khóa quỹ',1;
            IF dbo.fnSoDuTienMatNhanVien(@nguoiThucHien,@thoiDiemHienTai)<@soTien
                THROW 52315,N'Số dư tiền mặt đang giữ không đủ để chi',1;
        END;
        -- Bàn giao tiền ca và tính chênh lệch từ sổ thanh toán.
        IF @lenh = N'handover'
        BEGIN

            -- Khóa các lần bàn giao của cùng thu ngân dù mỗi yêu cầu có khóa chống trùng khác nhau.
            DECLARE @taiNguyenKhoa NVARCHAR(255) = N'finance-cash-custody', @ketQuaKhoa INT;
            EXEC @ketQuaKhoa = sys.sp_getapplock @Resource = @taiNguyenKhoa,
                @LockMode = 'Exclusive',
                @LockOwner = 'Transaction',
                @LockTimeout = 15000;
            IF @ketQuaKhoa < 0
                THROW 52310, N'Không lấy được khóa ca tiền', 1;
            IF @nguoiThucHien = @duLieuThuHai OR NOT EXISTS (
                SELECT 1 FROM dbo.NhanVien WHERE maNhanVien = @duLieuThuHai
                    AND duocKichHoat = 1 AND taiKhoanKhongBiKhoa = 1 AND trangThaiLamViec = N'Đang làm việc'
                    AND vaiTro IN(N'Lễ tân',N'Kế toán',N'Quản lý',N'Giám đốc',N'Quản trị viên'))
                THROW 52312, N'Người nhận phải là nhân viên có quyền giữ quỹ đang làm việc, khác người giao', 1;
            IF EXISTS(SELECT 1 FROM dbo.BanGiaoTienCa WITH(UPDLOCK,HOLDLOCK)
                WHERE nguoiBanGiao = @nguoiThucHien AND maCa = @duLieuThuNhat
                    AND CONVERT(DATE,thoiDiemBanGiao) = CONVERT(DATE,@thoiDiemHienTai))
                THROW 52311, N'Nhân viên đã bàn giao ca này trong ngày; hãy tra lại biên bản', 1;
            DECLARE @soTienDuKien DECIMAL(19, 2), @chenhLech DECIMAL(19, 2);
            SET @soTienDuKien = dbo.fnSoDuTienMatNhanVien(@nguoiThucHien, @thoiDiemHienTai);
            SET @chenhLech = @soTien - @soTienDuKien;
            IF @chenhLech <> 0 AND NULLIF(LTRIM(RTRIM(@ghiChu)),N'') IS NULL
                THROW 52313, N'Bàn giao chênh lệch phải có ghi chú đối soát', 1;
            DECLARE @chiTietMenhGia TABLE (ordinal INT, denomination DECIMAL(38, 6), quantity INT);
            INSERT @chiTietMenhGia
            SELECT CONVERT(INT, duLieuMenhGia.[key]),
                duLieuSoTien.denomination,
                duLieuSoTien.quantity
            FROM OPENJSON(COALESCE(@danhSachMenhGiaJson, N'[]')) duLieuMenhGia
            CROSS APPLY OPENJSON(duLieuMenhGia.value) WITH (denomination DECIMAL(38, 6), quantity INT) duLieuSoTien;
            IF EXISTS (
                SELECT 1
                FROM @chiTietMenhGia
                WHERE denomination IS NULL
                    OR denomination <= 0
                    OR quantity IS NULL
                    OR quantity <= 0
            )
                THROW 52301, N'Mệnh giá không hợp lệ', 1;
            IF EXISTS (
                SELECT 1
                FROM @chiTietMenhGia
            )
                AND (
                    SELECT SUM(denomination * quantity)
                    FROM @chiTietMenhGia
                ) <> @soTien
                THROW 52302, N'Tổng mệnh giá không khớp', 1;
            INSERT dbo.BanGiaoTienCa(
                maCa,
                nguoiBanGiao,
                nguoiNhanBanGiao,
                soTienDuKien,
                soTienThucTe,
                thoiDiemBanGiao,
                ghiChu
            )
            VALUES (
                @duLieuThuNhat,
                @nguoiThucHien,
                @duLieuThuHai,
                @soTienDuKien,
                @soTien,
                @thoiDiemHienTai,
                @ghiChu
            );
            SET @ma = SCOPE_IDENTITY();
            INSERT dbo.ChiTietTienBanGiao(maBanGiaoTienCa, menhGia, soLuong)
            SELECT TOP(2147483647) @ma,
                denomination,
                quantity
            FROM @chiTietMenhGia
            ORDER BY ordinal;
            SET @soTienButToan = ABS(@chenhLech);
            SET @chieuButToan = CASE
                WHEN @chenhLech > 0 THEN N'Ghi nợ'
                ELSE N'Ghi có'
            END;
            SET @loaiNguon = N'CASH_HANDOVER';
            SET @loaiButToan = N'CASH_VARIANCE';
            SET @hanhDong = N'CASH_HANDOVER_RECORDED';
            SET @ghiChuNhatKy = @ghiChu;
        END

        -- Ghi khoản chi.
        ELSE IF @lenh = N'expense'
        BEGIN
            INSERT dbo.KhoanChi(
                danhMuc,
                moTa,
                soTien,
                nguoiChiTra,
                thoiDiemChiTra,phuongThucThanhToan
            )
            VALUES (
                @duLieuThuNhat,
                @duLieuThuHai,
                @soTien,
                @nguoiThucHien,
                @thoiDiemHienTai,@phuongThucThanhToan
            );
            SET @ma = SCOPE_IDENTITY();
            SET @loaiNguon = N'EXPENSE';
            SET @loaiButToan = N'EXPENSE';
            SET @hanhDong = N'EXPENSE_RECORDED';
            SET @chieuButToan = N'Ghi nợ';
            SET @ghiChuButToan = @duLieuThuHai;
        END

        -- Ghi công nợ.
        ELSE IF @lenh = N'debt'
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM dbo.CongNoDoiTac WITH (UPDLOCK, HOLDLOCK)
                WHERE maThamChieu = @duLieuThuHai
            )
                THROW 52303, N'Mã công nợ đã tồn tại', 1;
            INSERT dbo.CongNoDoiTac(
                tenDoiTac,
                maThamChieu,
                soTien,
                soTienDaThanhToan,
                trangThai,
                thoiDiemGhiNhan
            )
            VALUES (
                @duLieuThuNhat,
                @duLieuThuHai,
                @soTien,
                0,
                N'Chưa thanh toán',
                @thoiDiemHienTai
            );
            SET @ma = SCOPE_IDENTITY();
            SET @loaiNguon = N'PARTNER_DEBT';
            SET @loaiButToan = N'PARTNER_DEBT_RECORDED';
            SET @hanhDong = N'PARTNER_DEBT_RECORDED';
            SET @chieuButToan = N'Ghi có';
            SET @ghiChuButToan = @duLieuThuHai;
        END

        -- Thanh toán công nợ trong giới hạn số dư.
        ELSE IF @lenh = N'settle'
        BEGIN
            DECLARE @tongSoTien DECIMAL(14, 2), @soTienDaThanhToan DECIMAL(14, 2), @trangThai NVARCHAR(30);
            SELECT @tongSoTien = soTien,
                @soTienDaThanhToan = soTienDaThanhToan,
                @trangThai = trangThai
            FROM dbo.CongNoDoiTac WITH (UPDLOCK, HOLDLOCK)
            WHERE maCongNoDoiTac = @ma;
            IF @tongSoTien IS NULL
                THROW 52304, N'Không tìm thấy công nợ đối tác', 1;
            IF @trangThai IN (N'Đã hủy', N'Đã thanh toán')
                THROW 52305, N'Công nợ không còn số dư', 1;
            IF @soTienDaThanhToan + @soTien > @tongSoTien
                THROW 52306, N'Số tiền tất toán vượt số dư công nợ', 1;
            UPDATE dbo.CongNoDoiTac
            SET soTienDaThanhToan = @soTienDaThanhToan + @soTien,
                trangThai = CASE
                    WHEN @soTienDaThanhToan + @soTien = @tongSoTien THEN N'Đã thanh toán'
                    ELSE N'Đã thanh toán một phần'
                END
            WHERE maCongNoDoiTac = @ma;
            INSERT dbo.ThanhToanCongNoDoiTac(
                maCongNoDoiTac,
                soTien,
                nguoiThanhToan,
                thoiDiemThanhToan,
                ghiChu,phuongThucThanhToan
            )
            VALUES (
                @ma,
                @soTien,
                @nguoiThucHien,
                @thoiDiemHienTai,
                @ghiChu,@phuongThucThanhToan
            );
            SET @loaiNguon = N'PARTNER_DEBT';
            SET @loaiButToan = N'PARTNER_DEBT_SETTLEMENT';
            SET @hanhDong = N'PARTNER_DEBT_SETTLED';
            SET @chieuButToan = N'Ghi nợ';
            SET @ghiChuNhatKy = @ghiChu;
        END
        ELSE
            THROW 51008, N'Lệnh tài chính không hợp lệ', 1;
        IF @soTienButToan > 0
            INSERT dbo.ButToanTaiChinh(
                loaiButToan,
                loaiNguon,
                maNguon,
                chieuButToan,
                soTien,
                maNguoiThucHien,
                thoiDiemPhatSinh,
                ghiChu,
                daChotSo
            )
            VALUES (
                @loaiButToan,
                @loaiNguon,
                CONVERT(NVARCHAR(100), @ma),
                @chieuButToan,
                @soTienButToan,
                @nguoiThucHien,
                @thoiDiemHienTai,
                @ghiChuButToan,
                1
            );
        INSERT dbo.NhatKyKiemSoat(
            nguoiThucHien,
            hanhDong,
            loaiDoiTuong,
            maDoiTuong,
            duLieuSau,
            lyDo,
            khoaLienKet,
            thoiDiemTao
        )
        VALUES (
            @nguoiThucHien,
            @hanhDong,
            @loaiNguon,
            CONVERT(NVARCHAR(100), @ma),
            @soTienNhatKy,
            @ghiChuNhatKy,
            @khoaChongTrung,
            TODATETIMEOFFSET(@thoiDiemHienTai, '+07:00')
        );
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

-- =============================================================================
-- uspKhoaChuTheDangNhap
-- Lấy khóa chung của chủ tài khoản trước khi đổi phiên hoặc trạng thái tài khoản.
-- Lấy khóa này trước khóa dòng tài khoản/token khi cấp, thay hoặc thu hồi phiên.
-- Truy cập bảng đầu tiên mở giao dịch ngầm của JDBC.
-- =============================================================================
CREATE PROCEDURE dbo.uspKhoaChuTheDangNhap
    @maNhanVien NVARCHAR(MAX),
    @maTaiKhoanKhachHang BIGINT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    DECLARE @maKiemTra SMALLINT;
    SELECT @maKiemTra = maNhomKhoa
    FROM dbo.NhomKhoaChongTrung
    WHERE maNhomKhoa = 0;
    IF @@TRANCOUNT = 0
        THROW 51815, N'Identity lock yêu cầu caller transaction', 1;
    IF (
        @maNhanVien IS NULL
        AND @maTaiKhoanKhachHang IS NULL
    )
        OR (
            @maNhanVien IS NOT NULL
            AND @maTaiKhoanKhachHang IS NOT NULL
        )
        THROW 51008, N'Principal phải có đúng một owner', 1;
    DECLARE @taiNguyenKhoa NVARCHAR(255) = CASE
        WHEN @maNhanVien IS NOT NULL THEN N'identity:employee:' + @maNhanVien
        ELSE N'identity:customer:' + CONVERT(NVARCHAR(30), @maTaiKhoanKhachHang)
    END,
        @ketQuaKhoa INT;
    EXEC @ketQuaKhoa = sys.sp_getapplock @Resource = @taiNguyenKhoa,
        @LockMode = 'Exclusive',
        @LockOwner = 'Transaction',
        @LockTimeout = 15000;
    IF @ketQuaKhoa < 0
        THROW 52410, N'Không lấy được khóa principal', 1;
END;
GO

-- =============================================================================
-- uspKhoaMaLamMoiDangNhap
-- Đọc chủ token, khóa chủ tài khoản rồi khóa bản ghi refresh token.
-- Dùng cùng khóa chủ tài khoản khi thu hồi chuỗi token do phát hiện sử dụng lại.
-- =============================================================================
CREATE PROCEDURE dbo.uspKhoaMaLamMoiDangNhap
    @maBamLamMoi NVARCHAR(MAX)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    DECLARE @maNhanVien NVARCHAR(10), @maTaiKhoanKhachHang BIGINT;
    SELECT @maNhanVien = maNhanVien,
        @maTaiKhoanKhachHang = maTaiKhoanKhachHang
    FROM dbo.MaLamMoiDangNhap
    WHERE maBamToken = @maBamLamMoi;
    IF @maNhanVien IS NULL
        AND @maTaiKhoanKhachHang IS NULL
    BEGIN
        SELECT maMaLamMoiDangNhap,
            maNhanVien,
            maTaiKhoanKhachHang,
            maBamToken,
            maNhomPhien,
            thoiDiemPhatHanh,
            thoiDiemHetHan,
            thoiDiemThuHoi,
            maBamThayThe
        FROM dbo.vwMaLamMoiDangNhap
        WHERE 1 = 0;
        RETURN;
    END;
    EXEC dbo.uspKhoaChuTheDangNhap @maNhanVien, @maTaiKhoanKhachHang;
    SELECT maMaLamMoiDangNhap,
        maNhanVien,
        maTaiKhoanKhachHang,
        maBamToken,
        maNhomPhien,
        thoiDiemPhatHanh,
        thoiDiemHetHan,
        thoiDiemThuHoi,
        maBamThayThe
    FROM dbo.MaLamMoiDangNhap WITH (UPDLOCK, HOLDLOCK)
    WHERE maBamToken = @maBamLamMoi;
END;
GO

-- =============================================================================
-- uspLenhMaLamMoiDangNhap
-- Cấp, thay thế hoặc thu hồi refresh token dưới khóa của chủ tài khoản.
-- =============================================================================
CREATE PROCEDURE dbo.uspLenhMaLamMoiDangNhap
    @lenh NVARCHAR(20),
    @maNhanVien NVARCHAR(MAX),
    @maTaiKhoanKhachHang BIGINT,
    @maLamMoiHienTai BIGINT,
    @maBamLamMoi NVARCHAR(MAX),
    @maNhomLamMoi NVARCHAR(MAX),
    @thoiDiemCap DATETIMEOFFSET(6),
    @thoiDiemHetHan DATETIMEOFFSET(6),
    @thoiDiemHienTai DATETIMEOFFSET(6)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;
        EXEC dbo.uspKhoaChuTheDangNhap @maNhanVien, @maTaiKhoanKhachHang;
        IF @lenh IN (N'issue', N'rotate')
        BEGIN
            DECLARE @dangHoatDong BIT, @khongBiKhoa BIT;
            IF @maNhanVien IS NOT NULL
                SELECT @dangHoatDong = duocKichHoat,
                    @khongBiKhoa = taiKhoanKhongBiKhoa
                FROM dbo.NhanVien WITH (UPDLOCK, HOLDLOCK)
                WHERE maNhanVien = @maNhanVien;
            ELSE
                SELECT @dangHoatDong = duocKichHoat,
                    @khongBiKhoa = taiKhoanKhongBiKhoa
                FROM dbo.TaiKhoanKhachHang WITH (UPDLOCK, HOLDLOCK)
                WHERE maTaiKhoanKhachHang = @maTaiKhoanKhachHang;
            IF @dangHoatDong IS NULL
                THROW 52501, N'Không tìm thấy chủ tài khoản', 1;
            IF @dangHoatDong = 0
                THROW 52502, N'Tài khoản đã vô hiệu hóa', 1;
            IF @khongBiKhoa = 0
                THROW 52503, N'Tài khoản đã bị khóa', 1;

            -- Thu hồi token hiện tại trước khi cấp token thay thế.
            IF @lenh = N'rotate'
            BEGIN
                UPDATE dbo.MaLamMoiDangNhap WITH (UPDLOCK, HOLDLOCK)
                SET thoiDiemThuHoi = @thoiDiemHienTai, maBamThayThe = @maBamLamMoi
                WHERE maMaLamMoiDangNhap = @maLamMoiHienTai
                    AND thoiDiemThuHoi IS NULL
                    AND thoiDiemHetHan > @thoiDiemHienTai
                    AND maNhomPhien = @maNhomLamMoi
                    AND (
                        (
                            @maNhanVien IS NOT NULL
                            AND maNhanVien = @maNhanVien
                            AND maTaiKhoanKhachHang IS NULL
                        )
                        OR (
                            @maTaiKhoanKhachHang IS NOT NULL
                            AND maTaiKhoanKhachHang = @maTaiKhoanKhachHang
                            AND maNhanVien IS NULL
                        )
                    );
                IF @@ROWCOUNT <> 1
                    THROW 52501, N'Token không còn hiệu lực', 1;
            END;
            INSERT dbo.MaLamMoiDangNhap(
                maNhanVien,
                maTaiKhoanKhachHang,
                maBamToken,
                maNhomPhien,
                thoiDiemPhatHanh,
                thoiDiemHetHan
            )
            VALUES (
                @maNhanVien,
                @maTaiKhoanKhachHang,
                @maBamLamMoi,
                @maNhomLamMoi,
                @thoiDiemCap,
                @thoiDiemHetHan
            );
        END
        ELSE IF @lenh = N'revoke'
            UPDATE dbo.MaLamMoiDangNhap
            SET thoiDiemThuHoi = COALESCE(thoiDiemThuHoi, @thoiDiemHienTai)
            WHERE maMaLamMoiDangNhap = @maLamMoiHienTai
                AND (
                    (
                        @maNhanVien IS NOT NULL
                        AND maNhanVien = @maNhanVien
                    )
                    OR (
                        @maTaiKhoanKhachHang IS NOT NULL
                        AND maTaiKhoanKhachHang = @maTaiKhoanKhachHang
                    )
                );
        ELSE IF @lenh = N'family'
            UPDATE dbo.MaLamMoiDangNhap
            SET thoiDiemThuHoi = @thoiDiemHienTai
            WHERE maNhomPhien = @maNhomLamMoi
                AND thoiDiemThuHoi IS NULL
                AND (
                    (
                        @maNhanVien IS NOT NULL
                        AND maNhanVien = @maNhanVien
                    )
                    OR (
                        @maTaiKhoanKhachHang IS NOT NULL
                        AND maTaiKhoanKhachHang = @maTaiKhoanKhachHang
                    )
                );
        ELSE IF @lenh = N'all'
            UPDATE dbo.MaLamMoiDangNhap
            SET thoiDiemThuHoi = @thoiDiemHienTai
            WHERE thoiDiemThuHoi IS NULL
                AND (
                    (
                        @maNhanVien IS NOT NULL
                        AND maNhanVien = @maNhanVien
                    )
                    OR (
                        @maTaiKhoanKhachHang IS NOT NULL
                        AND maTaiKhoanKhachHang = @maTaiKhoanKhachHang
                    )
                );
        ELSE
            THROW 51008, N'Lệnh refresh token không hợp lệ', 1;
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

-- =============================================================================
-- uspKhoaNhanVien
-- Khóa chủ tài khoản rồi đọc hồ sơ nhân viên để bên gọi xử lý an toàn.
-- =============================================================================
CREATE PROCEDURE dbo.uspKhoaNhanVien
    @maNhanVien NVARCHAR(MAX)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    EXEC dbo.uspKhoaChuTheDangNhap @maNhanVien, NULL;
    SELECT maNhanVien,
        hoVaTen,
        matKhau,
        vaiTro,
        soDienThoai,
        diaChi,
        email,
        phaiDoiMatKhau,
        duocKichHoat,
        taiKhoanKhongBiKhoa,
        soLanDangNhapThatBai,
        thoiDiemDangNhapGanNhat,
        thoiDiemDangNhapThatBaiGanNhat,
        trangThaiLamViec,
        ngayBatDauNghi,
        ngayKetThucNghi
    FROM dbo.NhanVien WITH (UPDLOCK, HOLDLOCK)
    WHERE maNhanVien = @maNhanVien;
END;
GO

-- =============================================================================
-- uspLenhNhanVien
-- Tạo nhân viên, đổi mật khẩu/quyền/trạng thái và ghi nhận đăng nhập.
-- Bên gọi giữ khóa ngữ cảnh tới khi các bản ghi audit liên quan cùng commit.
-- =============================================================================
CREATE PROCEDURE dbo.uspLenhNhanVien
    @lenh NVARCHAR(20),
    @maNhanVien NVARCHAR(MAX) OUTPUT,
    @ten NVARCHAR(MAX) = NULL,
    @matKhau NVARCHAR(MAX) = NULL,
    @vaiTro NVARCHAR(MAX) = NULL,
    @soDienThoai NVARCHAR(MAX) = NULL,
    @diaChi NVARCHAR(MAX) = NULL,
    @diaChiEmail NVARCHAR(MAX) = NULL,
    @coGiaTri BIT = NULL,
    @tinhTrangLamViec NVARCHAR(MAX) = NULL,
    @ngayBatDauNghi DATE = NULL,
    @ngayKetThucNghi DATE = NULL,
    @thoiDiemHienTai DATETIMEOFFSET(6) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;
        IF @lenh IN (N'create', N'auto')
        BEGIN
            DECLARE @ketQuaKhoa INT;
            EXEC @ketQuaKhoa = sys.sp_getapplock @Resource = N'identity-registration',
                @LockMode = N'Exclusive',
                @LockOwner = N'Transaction',
                @LockTimeout = 15000;
            IF @ketQuaKhoa < 0
                THROW 52410, N'Không khóa được tài khoản', 1;

            -- Sinh mã nhân viên tiếp theo.
            IF @lenh = N'auto'
            BEGIN
                DECLARE @soThuTuTiepTheo BIGINT;
                SELECT @soThuTuTiepTheo = COALESCE(MAX(TRY_CONVERT(BIGINT, SUBSTRING(maNhanVien, LEN(@maNhanVien) + 1, 20))), 0) + 1
                FROM dbo.NhanVien WITH (UPDLOCK, HOLDLOCK)
                WHERE LEFT(maNhanVien, LEN(@maNhanVien)) = @maNhanVien
                    AND SUBSTRING(maNhanVien, LEN(@maNhanVien) + 1, 20) NOT LIKE N'%[^0-9]%'
                    AND LEN(maNhanVien) > LEN(@maNhanVien);
                SET @maNhanVien = @maNhanVien + CASE
                    WHEN @soThuTuTiepTheo < 10000 THEN RIGHT(N'0000' + CONVERT(NVARCHAR(20), @soThuTuTiepTheo), 4)
                    ELSE CONVERT(NVARCHAR(20), @soThuTuTiepTheo)
                END;
            END;
            IF EXISTS (
                SELECT 1
                FROM dbo.NhanVien WITH (UPDLOCK, HOLDLOCK)
                WHERE maNhanVien = @maNhanVien
            )
                THROW 52601, N'Mã nhân viên đã tồn tại', 1;
            IF EXISTS (
                SELECT 1
                FROM dbo.NhanVien WITH (UPDLOCK, HOLDLOCK)
                WHERE soDienThoai = @soDienThoai
            ) OR EXISTS (
                SELECT 1
                FROM dbo.TaiKhoanKhachHang WITH (UPDLOCK, HOLDLOCK)
                WHERE soDienThoai = @soDienThoai
            )
                THROW 52602, N'Số điện thoại đã được sử dụng', 1;
            INSERT dbo.NhanVien(
                maNhanVien,
                hoVaTen,
                matKhau,
                vaiTro,
                soDienThoai,
                diaChi,
                email,
                phaiDoiMatKhau
            )
            VALUES (
                @maNhanVien,
                @ten,
                @matKhau,
                @vaiTro,
                @soDienThoai,
                @diaChi,
                @diaChiEmail,
                COALESCE(@coGiaTri, 0)
            );
        END
        ELSE
        BEGIN
            EXEC dbo.uspKhoaChuTheDangNhap @maNhanVien, NULL;
            IF NOT EXISTS (
                SELECT 1
                FROM dbo.NhanVien WITH (UPDLOCK, HOLDLOCK)
                WHERE maNhanVien = @maNhanVien
            )
            BEGIN
                IF @lenh IN (N'failure', N'success')
                BEGIN
                    COMMIT TRANSACTION;
                    RETURN;
                END;
                THROW 52603, N'Không tìm thấy nhân viên', 1;
            END;
            IF @lenh IN (N'password', N'own-password')
                UPDATE dbo.NhanVien
                SET matKhau = @matKhau,
                    taiKhoanKhongBiKhoa = 1,
                    soLanDangNhapThatBai = 0,
                    phaiDoiMatKhau = CASE
                        WHEN @lenh = N'own-password' THEN 0
                        ELSE phaiDoiMatKhau
                    END
                WHERE maNhanVien = @maNhanVien;
            ELSE IF @lenh = N'enabled'
                UPDATE dbo.NhanVien
                SET duocKichHoat = @coGiaTri
                WHERE maNhanVien = @maNhanVien;
            ELSE IF @lenh = N'role'
                UPDATE dbo.NhanVien
                SET vaiTro = @vaiTro
                WHERE maNhanVien = @maNhanVien;

            -- Cập nhật trạng thái làm việc và ngày nghỉ.
            ELSE IF @lenh = N'employment'
            BEGIN
                IF (
                    @tinhTrangLamViec = N'Đang nghỉ phép'
                    AND (
                        @ngayBatDauNghi IS NULL
                        OR @ngayKetThucNghi IS NULL
                        OR @ngayKetThucNghi < @ngayBatDauNghi
                    )
                )
                    OR (
                        @tinhTrangLamViec <> N'Đang nghỉ phép'
                        AND (
                            @ngayBatDauNghi IS NOT NULL
                            OR @ngayKetThucNghi IS NOT NULL
                        )
                    )
                    THROW 52604, N'Khoảng ngày nghỉ không hợp lệ', 1;
                UPDATE dbo.NhanVien
                SET trangThaiLamViec = @tinhTrangLamViec,
                    ngayBatDauNghi = @ngayBatDauNghi,
                    ngayKetThucNghi = @ngayKetThucNghi,
                    duocKichHoat = CASE
                        WHEN @tinhTrangLamViec = N'Đã nghỉ việc' THEN 0
                        ELSE duocKichHoat
                    END
                WHERE maNhanVien = @maNhanVien;
            END

            -- Ghi nhận lần đăng nhập thất bại.
            ELSE IF @lenh = N'failure'
            BEGIN
                UPDATE dbo.NhanVien
                SET soLanDangNhapThatBai = soLanDangNhapThatBai + 1,
                    taiKhoanKhongBiKhoa = CASE
                        WHEN soLanDangNhapThatBai + 1 >= 5 THEN 0
                        ELSE taiKhoanKhongBiKhoa
                    END,
                    thoiDiemDangNhapThatBaiGanNhat = @thoiDiemHienTai
                WHERE maNhanVien = @maNhanVien;
                INSERT dbo.SuKienDangNhapNhanVien(maNhanVien, thoiDiemPhatSinh, ketQua)
                VALUES (@maNhanVien, @thoiDiemHienTai, N'Thất bại');
            END

            -- Ghi nhận lần đăng nhập thành công.
            ELSE IF @lenh = N'success'
            BEGIN
                UPDATE dbo.NhanVien
                SET soLanDangNhapThatBai = 0, thoiDiemDangNhapGanNhat = @thoiDiemHienTai
                WHERE maNhanVien = @maNhanVien;
                INSERT dbo.SuKienDangNhapNhanVien(maNhanVien, thoiDiemPhatSinh, ketQua)
                VALUES (@maNhanVien, @thoiDiemHienTai, N'Thành công');
            END
            ELSE
                THROW 51008, N'Lệnh nhân viên không hợp lệ', 1;
            IF (
                @lenh = N'enabled'
                AND @coGiaTri = 0
            )
                OR (
                    @lenh = N'employment'
                    AND @tinhTrangLamViec = N'Đã nghỉ việc'
                )
                EXEC dbo.uspLenhMaLamMoiDangNhap N'all',
                    @maNhanVien,
                    NULL,
                    NULL,
                    NULL,
                    NULL,
                    NULL,
                    NULL,
                    @thoiDiemHienTai;
        END;
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

-- =============================================================================
-- uspKhoaDangKyTaiKhoan
-- Khóa đăng ký chung để kiểm tra số điện thoại và email đã được sử dụng.
-- =============================================================================
CREATE PROCEDURE dbo.uspKhoaDangKyTaiKhoan
    @soDienThoai NVARCHAR(MAX) = NULL,
    @diaChiEmail NVARCHAR(MAX) = NULL,
    @traKetQuaKiemTra BIT = 1
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    DECLARE @maKiemTra INT =(
        SELECT maNhomKhoa
        FROM dbo.NhomKhoaChongTrung
        WHERE maNhomKhoa = 0
    ), @ketQuaKhoa INT;
    IF @@TRANCOUNT = 0
        THROW 51815, N'Lệnh đăng ký phải nằm trong transaction', 1;
    EXEC @ketQuaKhoa = sys.sp_getapplock @Resource = N'identity-registration',
        @LockMode = N'Exclusive',
        @LockOwner = N'Transaction',
        @LockTimeout = 15000;
    IF @ketQuaKhoa < 0
        THROW 52410, N'Không khóa được đăng ký tài khoản', 1;
    IF @traKetQuaKiemTra = 1
        SELECT CONVERT(BIT, CASE
            WHEN EXISTS (
                SELECT 1
                FROM dbo.NhanVien
                WHERE soDienThoai = @soDienThoai
            ) OR EXISTS (
                SELECT 1
                FROM dbo.TaiKhoanKhachHang
                WHERE soDienThoai = @soDienThoai
            ) THEN 1
            ELSE 0
        END) AS phoneUsed,
            CONVERT(BIT, CASE
                WHEN EXISTS (
                    SELECT 1
                    FROM dbo.vwTaiKhoanKhachHang
                    WHERE LOWER(email) = LOWER(@diaChiEmail)
                ) THEN 1
                ELSE 0
            END) AS emailUsed;
END;
GO

-- =============================================================================
-- uspLenhKhachLuuTru
-- Tạo hoặc sửa hồ sơ khách; kiểm tra phiên bản để tránh ghi đè cập nhật khác.
-- Cập nhật hồ sơ không ghi đè các bộ đếm chi tiêu, lưu trú hoặc vi phạm.
-- =============================================================================
CREATE PROCEDURE dbo.uspLenhKhachLuuTru
    @lenh NVARCHAR(20),
    @maKhachLuuTru BIGINT OUTPUT,
    @ten NVARCHAR(MAX),
    @soGiayTo NVARCHAR(MAX),
    @soDienThoai NVARCHAR(MAX),
    @diaChiEmail NVARCHAR(MAX),
    @diaChi NVARCHAR(MAX),
    @namSinh INT,
    @phienBan BIGINT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;
        EXEC dbo.uspKhoaDangKyTaiKhoan NULL, NULL, 0;

        -- Tạo bản ghi mới.
        IF @lenh = N'create'
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM dbo.KhachLuuTru WITH (UPDLOCK, HOLDLOCK)
                WHERE soDienThoai = @soDienThoai
            )
                THROW 52701, N'Số điện thoại khách hàng đã tồn tại', 1;
            IF EXISTS (
                SELECT 1
                FROM dbo.KhachLuuTru WITH (UPDLOCK, HOLDLOCK)
                WHERE soGiayToTuyThan = @soGiayTo
            )
                THROW 52702, N'Số giấy tờ khách hàng đã tồn tại', 1;
            INSERT dbo.KhachLuuTru(
                hoVaTen,
                soGiayToTuyThan,
                soDienThoai,
                email,
                diaChi,
                namSinh
            )
            VALUES (
                @ten,
                @soGiayTo,
                @soDienThoai,
                @diaChiEmail,
                @diaChi,
                @namSinh
            );
            SET @maKhachLuuTru = SCOPE_IDENTITY();
        END

        -- Cập nhật hồ sơ theo phiên bản.
        ELSE IF @lenh = N'profile'
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM dbo.KhachLuuTru WITH (UPDLOCK, HOLDLOCK)
                WHERE maKhachLuuTru = @maKhachLuuTru
            )
                THROW 52703, N'Không tìm thấy khách', 1;
            UPDATE dbo.KhachLuuTru
            SET hoVaTen = @ten,
                soGiayToTuyThan = @soGiayTo,
                email = COALESCE(@diaChiEmail, email),
                diaChi = COALESCE(@diaChi, diaChi),
                namSinh = COALESCE(@namSinh, namSinh),
                phienBan = phienBan + 1
            WHERE maKhachLuuTru = @maKhachLuuTru
                AND phienBan = @phienBan;
            IF @@ROWCOUNT <> 1
                THROW 51003, N'Hồ sơ khách đã thay đổi', 1;
        END
        ELSE
            THROW 51008, N'Lệnh khách không hợp lệ', 1;
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

-- =============================================================================
-- uspLenhTaiKhoanKhachHang
-- Đăng ký tài khoản gắn hồ sơ khách hoặc đổi mật khẩu trong cùng giao dịch.
-- =============================================================================
CREATE PROCEDURE dbo.uspLenhTaiKhoanKhachHang
    @lenh NVARCHAR(20),
    @maTaiKhoanKhachHang BIGINT OUTPUT,
    @soDienThoai NVARCHAR(MAX) = NULL,
    @ten NVARCHAR(MAX) = NULL,
    @soGiayTo NVARCHAR(MAX) = NULL,
    @diaChiEmail NVARCHAR(MAX) = NULL,
    @matKhau NVARCHAR(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        -- Đăng ký tài khoản và gắn hồ sơ khách.
        IF @lenh = N'register'
        BEGIN
            EXEC dbo.uspKhoaDangKyTaiKhoan NULL, NULL, 0;
            IF EXISTS (
                SELECT 1
                FROM dbo.TaiKhoanKhachHang WITH (UPDLOCK, HOLDLOCK)
                WHERE soDienThoai = @soDienThoai
            ) OR EXISTS (
                SELECT 1
                FROM dbo.NhanVien WITH (UPDLOCK, HOLDLOCK)
                WHERE soDienThoai = @soDienThoai
            )
                THROW 52602, N'Số điện thoại đã được sử dụng', 1;
            IF @diaChiEmail IS NOT NULL AND EXISTS (
                SELECT 1
                FROM dbo.vwTaiKhoanKhachHang
                WHERE LOWER(email) = LOWER(@diaChiEmail)
            )
                THROW 52704, N'Email đã được sử dụng', 1;
            DECLARE @maKhachLuuTru BIGINT, @soGiayToCu NVARCHAR(12);
            SELECT @maKhachLuuTru = maKhachLuuTru,
                @soGiayToCu = soGiayToTuyThan
            FROM dbo.KhachLuuTru WITH (UPDLOCK, HOLDLOCK)
            WHERE soDienThoai = @soDienThoai;
            IF @maKhachLuuTru IS NOT NULL
            BEGIN
                IF @soGiayTo COLLATE Latin1_General_100_BIN2 <> @soGiayToCu COLLATE Latin1_General_100_BIN2
                    OR DATALENGTH(@soGiayTo) <> DATALENGTH(@soGiayToCu)
                    THROW 52705, N'Giấy tờ không khớp hồ sơ khách', 1;
                IF @diaChiEmail IS NOT NULL
                    UPDATE dbo.KhachLuuTru
                    SET email = @diaChiEmail, phienBan = phienBan + 1
                    WHERE maKhachLuuTru = @maKhachLuuTru;
            END
            ELSE
            BEGIN
                EXEC dbo.uspLenhKhachLuuTru N'create',
                    @maKhachLuuTru OUTPUT,
                    @ten,
                    @soGiayTo,
                    @soDienThoai,
                    @diaChiEmail,
                    NULL,
                    NULL,
                    NULL;
            END;
            INSERT dbo.TaiKhoanKhachHang(maKhachLuuTru, soDienThoai, matKhau)
            VALUES (@maKhachLuuTru, @soDienThoai, @matKhau);
            SET @maTaiKhoanKhachHang = SCOPE_IDENTITY();
        END

        -- Đổi mật khẩu dưới khóa của chủ tài khoản.
        ELSE IF @lenh = N'password'
        BEGIN
            EXEC dbo.uspKhoaChuTheDangNhap NULL, @maTaiKhoanKhachHang;
            UPDATE dbo.TaiKhoanKhachHang WITH (UPDLOCK, HOLDLOCK)
            SET matKhau = @matKhau
            WHERE maTaiKhoanKhachHang = @maTaiKhoanKhachHang;
            IF @@ROWCOUNT <> 1
                THROW 52706, N'Không tìm thấy tài khoản khách hàng', 1;
        END
        ELSE
            THROW 51008, N'Lệnh tài khoản khách không hợp lệ', 1;
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

-- =============================================================================
-- uspKhoaDanhMucPhong
-- Khóa danh mục phòng trong giao dịch của bên gọi trước khi sửa phòng/loại phòng.
-- =============================================================================
CREATE PROCEDURE dbo.uspKhoaDanhMucPhong
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    DECLARE @maKiemTra INT =(
        SELECT maNhomKhoa
        FROM dbo.NhomKhoaChongTrung
        WHERE maNhomKhoa = 0
    ), @ketQuaKhoa INT;
    IF @@TRANCOUNT = 0
        THROW 51815, N'Catalog lock yêu cầu caller transaction', 1;
    EXEC @ketQuaKhoa = sys.sp_getapplock @Resource = N'room-catalog',
        @LockMode = N'Exclusive',
        @LockOwner = N'Transaction',
        @LockTimeout = 15000;
    IF @ketQuaKhoa < 0
        THROW 52810, N'Không khóa được catalog', 1;
END;
GO

-- =============================================================================
-- uspKhoaPhongNoiBo
-- Khóa một phòng và trả dữ liệu nội bộ trong giao dịch của bên gọi.
-- =============================================================================
CREATE PROCEDURE dbo.uspKhoaPhongNoiBo
    @maPhong NVARCHAR(MAX)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    DECLARE @maKiemTra NVARCHAR(10);
    SELECT @maKiemTra = maPhong
    FROM dbo.Phong WITH (UPDLOCK, HOLDLOCK)
    WHERE maPhong = @maPhong;
    IF @@TRANCOUNT = 0
        THROW 51815, N'Room lock yêu cầu caller transaction', 1;
    SELECT maPhong,
        ten,
        maLoaiPhong,
        tenLoaiPhong,
        giaTheoNgay,
        tang,
        trangThai,
        moTa,
        phienBan
    FROM dbo.vwPhongNoiBo
    WHERE maPhong = @maPhong;
END;
GO

-- =============================================================================
-- uspChuyenTrangThaiPhong
-- Chuyển trạng thái bảo trì/sẵn sàng theo quyền và phiên bản hiện tại của phòng.
-- =============================================================================
CREATE PROCEDURE dbo.uspChuyenTrangThaiPhong
    @maPhong NVARCHAR(MAX),
    @trangThaiMoi NVARCHAR(MAX),
    @phienBan BIGINT,
    @laKyThuat BIT,
    @laQuanLy BIT,
    @thoiDiemHienTai DATETIME2(6)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;
        DECLARE @trangThaiCu NVARCHAR(30), @phienBanHienTai BIGINT;
        SELECT @trangThaiCu = trangThai,
            @phienBanHienTai = phienBan
        FROM dbo.Phong WITH (UPDLOCK, HOLDLOCK)
        WHERE maPhong = @maPhong;
        IF @trangThaiCu IS NULL
            THROW 52801, N'Không tìm thấy phòng', 1;
        IF @trangThaiMoi NOT IN (N'Sẵn sàng', N'Đang có khách', N'Đang dọn phòng', N'Đang bảo trì', N'Ngừng sử dụng', N'Đã giữ phòng')
            OR @trangThaiMoi IS NULL
            THROW 52802, N'Trạng thái phòng không hợp lệ', 1;
        IF @phienBanHienTai <> @phienBan
            THROW 51003, N'Phòng đã thay đổi', 1;
        IF @trangThaiCu = @trangThaiMoi
        BEGIN
            COMMIT TRANSACTION;
            RETURN;
        END;
        IF @trangThaiCu = N'Sẵn sàng'
            AND @trangThaiMoi = N'Đang bảo trì'
        BEGIN
            IF @laKyThuat = 0
                AND @laQuanLy = 0
                THROW 52804, N'Chỉ kỹ thuật/quản lý được bắt đầu bảo trì', 1;
            IF EXISTS (
                SELECT 1
                FROM dbo.ChiTietDatPhong chiTiet
                JOIN dbo.PhieuDatPhong phieu
                    ON phieu.maPhieuDatPhong = chiTiet.maPhieuDatPhong
                WHERE chiTiet.maPhong = @maPhong
                    AND chiTiet.thoiDiemTraPhong > @thoiDiemHienTai
                    AND chiTiet.trangThai IN (N'Giữ tạm phòng', N'Đã giữ phòng', N'Đang có khách')
                    AND (
                        phieu.trangThai IN (N'Đã xác nhận', N'Đã thanh toán cọc', N'Đã nhận phòng')
                        OR (
                            phieu.trangThai = N'Chờ thanh toán'
                            AND phieu.trangThaiThanhToanCoc = N'Chờ thanh toán'
                            AND phieu.thoiDiemHetHanThanhToanCoc > @thoiDiemHienTai
                        )
                    )
            )
                THROW 52807, N'Không thể khóa phòng bảo trì khi còn khách hoặc booking chưa kết thúc', 1;
        END
        ELSE IF @trangThaiCu = N'Đang bảo trì'
            AND @trangThaiMoi = N'Sẵn sàng'
        BEGIN
            IF @laKyThuat = 1
                THROW 52805, N'Kỹ thuật phải dùng command release sau nghiệm thu', 1;
            IF @laQuanLy = 0
                THROW 52804, N'Không được tự mở khóa phòng', 1;
        END
        ELSE
            THROW 52806, N'Chuyển trạng thái phòng không hợp lệ', 1;
        IF @trangThaiMoi = N'Sẵn sàng'
            AND dbo.fnKiemTraLichPhongTrong(@maPhong, @thoiDiemHienTai, DATEADD(MICROSECOND, 1, @thoiDiemHienTai), @thoiDiemHienTai, NULL) = 0
            THROW 52807, N'Phòng đang có booking hoạt động', 1;
        UPDATE dbo.Phong
        SET trangThai = @trangThaiMoi, phienBan = phienBan + 1
        WHERE maPhong = @maPhong;
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

-- =============================================================================
-- uspLenhQuanTriPhong
-- Tạo hoặc sửa thông tin phòng; chỉ gán loại phòng đang hoạt động.
-- Đổi trạng thái vận hành dùng uspChuyenTrangThaiPhong.
-- =============================================================================
CREATE PROCEDURE dbo.uspLenhQuanTriPhong
    @lenh NVARCHAR(20),
    @maPhong NVARCHAR(MAX),
    @ten NVARCHAR(MAX),
    @maLoaiPhong NVARCHAR(MAX),
    @tang INT,
    @moTa NVARCHAR(MAX),
    @trangThaiBanDau NVARCHAR(MAX),
    @phienBan BIGINT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;
        EXEC dbo.uspKhoaDanhMucPhong;
        DECLARE @daTonTai BIT = 0, @phienBanHienTai BIGINT;
        SELECT @daTonTai = 1,
            @phienBanHienTai = phienBan
        FROM dbo.Phong WITH (UPDLOCK, HOLDLOCK)
        WHERE maPhong = @maPhong;
        IF @lenh = N'create'
            AND @daTonTai = 1
            THROW 52808, N'Mã phòng đã tồn tại', 1;
        IF @lenh = N'update'
            AND @daTonTai = 0
            THROW 52801, N'Không tìm thấy phòng', 1;
        IF NOT EXISTS (
            SELECT 1
            FROM dbo.LoaiPhong WITH (UPDLOCK, HOLDLOCK)
            WHERE maLoaiPhong = @maLoaiPhong
                AND trangThaiDanhMuc = N'Đang hoạt động'
        )
            THROW 52809, N'Chỉ loại phòng ACTIVE mới được gán phòng', 1;

        -- Tạo bản ghi mới.
        IF @lenh = N'create'
        BEGIN
            IF @trangThaiBanDau IS NOT NULL
                AND @trangThaiBanDau <> N'Sẵn sàng'
                THROW 52803, N'Phòng mới chỉ được tạo READY', 1;
            INSERT dbo.Phong(
                maPhong,
                ten,
                maLoaiPhong,
                tang,
                moTa,
                trangThai
            )
            VALUES (
                @maPhong,
                @ten,
                @maLoaiPhong,
                @tang,
                @moTa,
                N'Sẵn sàng'
            );
        END

        -- Cập nhật thông tin hoặc trạng thái.
        ELSE IF @lenh = N'update'
        BEGIN
            IF @phienBan <> @phienBanHienTai
                THROW 51003, N'Phòng đã thay đổi', 1;
            UPDATE dbo.Phong
            SET ten = @ten,
                maLoaiPhong = @maLoaiPhong,
                tang = @tang,
                moTa = @moTa,
                phienBan = phienBan + 1
            WHERE maPhong = @maPhong;
        END
        ELSE
            THROW 51008, N'Lệnh quản trị phòng không hợp lệ', 1;
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

-- =============================================================================
-- uspLenhLoaiPhong
-- Tạo bản nháp, sửa, từ chối hoặc kích hoạt loại phòng sau phê duyệt.
-- Thứ tự khóa: danh mục -> chống trùng ở bên gọi -> phòng theo mã -> loại phòng.
-- Kiểm tra phê duyệt đã sử dụng trước khi ghi lịch sử giá trong giao dịch.
-- =============================================================================
CREATE PROCEDURE dbo.uspLenhLoaiPhong
    @lenh NVARCHAR(20),
    @maLoaiPhong NVARCHAR(MAX),
    @ten NVARCHAR(MAX) = NULL,
    @giaTheoNgay DECIMAL(38, 6) = NULL,
    @moTa NVARCHAR(MAX) = NULL,
    @dienTich DECIMAL(38, 6) = NULL,
    @huongNhin NVARCHAR(MAX) = NULL,
    @giaTheoGio DECIMAL(38, 6) = NULL,
    @loaiGiuong NVARCHAR(MAX) = NULL,
    @nguoiThucHien NVARCHAR(MAX) = NULL,
    @thoiDiemHienTai DATETIME2(6) = NULL,
    @maLoaiPhongGoc NVARCHAR(MAX) = NULL,
    @maPheDuyet BIGINT = NULL,
    @nguoiPheDuyet NVARCHAR(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;
        EXEC dbo.uspKhoaDanhMucPhong;
        DECLARE @trangThai NVARCHAR(30), @maLoaiPhongGocCu NVARCHAR(10);
        SELECT @trangThai = trangThaiDanhMuc,
            @maLoaiPhongGocCu = maLoaiPhongGoc
        FROM dbo.LoaiPhong
        WHERE maLoaiPhong = @maLoaiPhong;
        IF @lenh IN (N'create', N'revision')
        BEGIN
            IF @trangThai IS NOT NULL
                THROW 52901, N'Loại phòng đã tồn tại', 1;
            IF @lenh = N'revision'
                AND NOT EXISTS (
                    SELECT 1
                    FROM dbo.LoaiPhong
                    WHERE maLoaiPhong = @maLoaiPhongGoc
                        AND trangThaiDanhMuc = N'Đang hoạt động'
                )
                THROW 52904, N'Bản gốc revision không còn ACTIVE', 1;
            INSERT dbo.LoaiPhong(
                maLoaiPhong,
                ten,
                giaTheoNgay,
                moTa,
                dienTich,
                huongNhin,
                giaTheoGio,
                loaiGiuong,
                trangThaiDanhMuc,
                nguoiCapNhatDanhMuc,
                thoiDiemCapNhatDanhMuc,
                maLoaiPhongGoc
            )
            VALUES (
                @maLoaiPhong,
                @ten,
                @giaTheoNgay,
                @moTa,
                @dienTich,
                @huongNhin,
                @giaTheoGio,
                @loaiGiuong,
                N'Bản nháp',
                @nguoiThucHien,
                @thoiDiemHienTai,
                CASE
                    WHEN @lenh = N'revision' THEN @maLoaiPhongGoc
                    ELSE NULL
                END
            );
        END
        ELSE
        BEGIN
            IF @trangThai IS NULL
                THROW 52902, N'Không tìm thấy loại phòng', 1;

            -- Cập nhật thông tin hoặc trạng thái.
            IF @lenh = N'update'
            BEGIN
                IF @trangThai = N'Đang hoạt động'
                    THROW 52903, N'Không sửa trực tiếp loại phòng ACTIVE', 1;
                UPDATE dbo.LoaiPhong
                SET ten = @ten,
                    giaTheoNgay = @giaTheoNgay,
                    moTa = @moTa,
                    dienTich = @dienTich,
                    huongNhin = @huongNhin,
                    giaTheoGio = @giaTheoGio,
                    loaiGiuong = @loaiGiuong,
                    trangThaiDanhMuc = N'Bản nháp',
                    nguoiCapNhatDanhMuc = @nguoiThucHien,
                    thoiDiemCapNhatDanhMuc = @thoiDiemHienTai,
                    nguoiDuyetDanhMuc = NULL,
                    thoiDiemDuyetDanhMuc = NULL
                WHERE maLoaiPhong = @maLoaiPhong;
            END
            ELSE IF @lenh = N'reject'
                UPDATE dbo.LoaiPhong
                SET trangThaiDanhMuc = N'Bị từ chối'
                WHERE maLoaiPhong = @maLoaiPhong
                    AND trangThaiDanhMuc <> N'Đang hoạt động';

            -- Kích hoạt bản đã được phê duyệt.
            ELSE IF @lenh = N'activate'
            BEGIN
                IF NOT EXISTS (
                    SELECT 1
                    FROM dbo.YeuCauPheDuyet WITH (UPDLOCK, HOLDLOCK)
                    WHERE maYeuCauPheDuyet = @maPheDuyet
                        AND maDoiTuong = @maLoaiPhong
                        AND hanhDong = N'Kích hoạt loại phòng'
                        AND trangThai = N'Đã sử dụng'
                        AND nguoiPheDuyet = @nguoiPheDuyet
                )
                    THROW 52205, N'Cần approval đã consume đúng loại phòng', 1;
                IF @maLoaiPhongGocCu IS NOT NULL
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1
                        FROM dbo.LoaiPhong
                        WHERE maLoaiPhong = @maLoaiPhongGocCu
                            AND trangThaiDanhMuc = N'Đang hoạt động'
                    )
                        THROW 52904, N'Bản gốc revision không còn ACTIVE', 1;
                    DECLARE @maPhong NVARCHAR(10);
                    DECLARE duyetPhongTheoLoai CURSOR LOCAL FAST_FORWARD FOR
                        SELECT maPhong
                        FROM dbo.Phong
                        WHERE maLoaiPhong = @maLoaiPhongGocCu
                        ORDER BY maPhong;
                    OPEN duyetPhongTheoLoai;
                    FETCH NEXT FROM duyetPhongTheoLoai INTO @maPhong;
                    WHILE @@FETCH_STATUS = 0
                    BEGIN
                        DECLARE @maDaKhoa NVARCHAR(10);
                        SELECT @maDaKhoa = maPhong
                        FROM dbo.Phong WITH (UPDLOCK, HOLDLOCK)
                        WHERE maPhong = @maPhong;
                        FETCH NEXT FROM duyetPhongTheoLoai INTO @maPhong;
                    END;
                    CLOSE duyetPhongTheoLoai;
                    DEALLOCATE duyetPhongTheoLoai;
                    UPDATE dbo.Phong
                    SET maLoaiPhong = @maLoaiPhong, phienBan = phienBan + 1
                    WHERE maLoaiPhong = @maLoaiPhongGocCu;
                    UPDATE dbo.LoaiPhong
                    SET trangThaiDanhMuc = N'Ngừng kinh doanh', maLoaiPhongThayThe = @maLoaiPhong
                    WHERE maLoaiPhong = @maLoaiPhongGocCu;
                END;
                UPDATE dbo.LoaiPhong
                SET trangThaiDanhMuc = N'Đang hoạt động', nguoiDuyetDanhMuc = @nguoiPheDuyet, thoiDiemDuyetDanhMuc = @thoiDiemHienTai
                WHERE maLoaiPhong = @maLoaiPhong;
                INSERT dbo.LichSuGiaLoaiPhong(
                    maLoaiPhong,
                    giaTheoNgay,
                    nguoiThayDoi,
                    maYeuCauPheDuyet,
                    thoiDiemHieuLuc
                )
                SELECT maLoaiPhong,
                    giaTheoNgay,
                    @nguoiPheDuyet,
                    @maPheDuyet,
                    @thoiDiemHienTai
                FROM dbo.LoaiPhong
                WHERE maLoaiPhong = @maLoaiPhong;
            END
            ELSE
                THROW 51008, N'Lệnh loại phòng không hợp lệ', 1;
        END;
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF CURSOR_STATUS('local', 'duyetPhongTheoLoai') >= - 1
        BEGIN
            IF CURSOR_STATUS('local', 'duyetPhongTheoLoai') > - 1
                CLOSE duyetPhongTheoLoai;
            DEALLOCATE duyetPhongTheoLoai;
        END;
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

-- =============================================================================
-- uspKhoaDichVuDanhMuc
-- Khóa dịch vụ trong giao dịch của bên gọi trước khi sửa giá hoặc tồn kho.
-- =============================================================================
CREATE PROCEDURE dbo.uspKhoaDichVuDanhMuc
    @maDichVu NVARCHAR(MAX)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    DECLARE @maDaKhoa NVARCHAR(10);
    SELECT @maDaKhoa = maDichVu
    FROM dbo.DichVu WITH (UPDLOCK, HOLDLOCK)
    WHERE maDichVu = @maDichVu;
    IF @@TRANCOUNT = 0
        THROW 51008, N'Khóa dịch vụ cần transaction của caller', 1;
END;
GO

-- =============================================================================
-- uspLenhDanhMucDichVu
-- Tạo dịch vụ hoặc áp dụng giá đã được phê duyệt và ghi lịch sử giá.
-- Khóa dịch vụ trước, giống luồng tồn kho; giá và lịch sử theo giao dịch của bên gọi.
-- =============================================================================
CREATE PROCEDURE dbo.uspLenhDanhMucDichVu
    @lenh NVARCHAR(20),
    @maDichVu NVARCHAR(MAX),
    @ten NVARCHAR(MAX),
    @gia DECIMAL(38, 6),
    @donViTinh NVARCHAR(MAX),
    @danhMuc NVARCHAR(MAX),
    @moTa NVARCHAR(MAX),
    @duongDanAnh NVARCHAR(MAX),
    @nguongTonKho INT,
    @nguoiThucHien NVARCHAR(MAX),
    @maPheDuyet BIGINT,
    @thoiDiemHienTai DATETIME2(6)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;
        DECLARE @daTonTai NVARCHAR(10);
        SELECT @daTonTai = maDichVu
        FROM dbo.DichVu WITH (UPDLOCK, HOLDLOCK)
        WHERE maDichVu = @maDichVu;

        -- Tạo bản ghi mới.
        IF @lenh IN (N'create', N'create-stock')
        BEGIN
            IF @daTonTai IS NOT NULL
                THROW 53001, N'Mã dịch vụ đã tồn tại', 1;
            INSERT dbo.DichVu(
                maDichVu,
                ten,
                gia,
                donViTinh,
                danhMuc,
                moTa,
                duongDanAnh,
                soLuongTonKho,
                nguongAnToan,
                dangHoatDong,laTaiNguyen
            )
            VALUES (
                @maDichVu,
                @ten,
                @gia,
                @donViTinh,
                @danhMuc,
                @moTa,
                @duongDanAnh,
                0,
                @nguongTonKho,
                CASE WHEN @lenh = N'create-stock' THEN 0 ELSE 1 END,
                CASE WHEN @danhMuc IN(N'Món ăn',N'Thức uống',N'Vật dụng phòng') THEN 0 ELSE 1 END
            );
        END

        -- Áp dụng giá đã được phê duyệt và lưu lịch sử.
        ELSE IF @lenh = N'price'
        BEGIN
            IF @daTonTai IS NULL
                THROW 53002, N'Không tìm thấy dịch vụ', 1;
            IF NOT EXISTS (
                SELECT 1
                FROM dbo.YeuCauPheDuyet WITH (UPDLOCK, HOLDLOCK)
                WHERE maYeuCauPheDuyet = @maPheDuyet
                    AND maDoiTuong = @maDichVu
                    AND hanhDong = N'Thay đổi giá dịch vụ'
                    AND trangThai = N'Đã sử dụng'
                    AND nguoiPheDuyet = @nguoiThucHien
                    AND soTien = @gia
            )
                THROW 52205, N'Cần approval đã consume đúng dịch vụ và giá', 1;
            UPDATE dbo.DichVu
            SET gia = @gia
            WHERE maDichVu = @maDichVu;
            INSERT dbo.LichSuGiaDichVu(
                maDichVu,
                gia,
                nguoiThayDoi,
                maYeuCauPheDuyet,
                thoiDiemHieuLuc
            )
            VALUES (
                @maDichVu,
                @gia,
                @nguoiThucHien,
                @maPheDuyet,
                @thoiDiemHienTai
            );
        END
        ELSE
            THROW 51008, N'Lệnh danh mục dịch vụ không hợp lệ', 1;
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

-- Yêu cầu kho: người gửi không tự quyết định; quyết định và biến động cùng transaction.
-- =============================================================================
-- uspLenhYeuCauKho: chuyển hàng nguyên tử giữa kho tổng và kho buồng phòng.
-- Khóa theo mặt hàng trước, tồn buồng phòng sau; retry không chuyển lần thứ hai.
-- =============================================================================
CREATE PROCEDURE dbo.uspLenhYeuCauKho
 @lenh NVARCHAR(20),@id BIGINT,@dichVu NVARCHAR(10),@soLuong INT,@phong NVARCHAR(10),
 @actor NVARCHAR(50),@lyDo NVARCHAR(255),@khoa NVARCHAR(100),@now DATETIME2(6),@loai NVARCHAR(20)
AS
BEGIN
 SET NOCOUNT ON;SET XACT_ABORT ON;
 BEGIN TRY
  BEGIN TRANSACTION;
  IF @lenh NOT IN(N'create',N'approve',N'reject') THROW 53704,N'Lệnh kho không hợp lệ',1;
  IF @lenh=N'create' AND NOT EXISTS(SELECT 1 FROM dbo.NhanVien WHERE maNhanVien=@actor AND vaiTro=N'Buồng phòng')
   THROW 53705,N'Chỉ Buồng phòng được gửi yêu cầu',1;
  IF @lenh<>N'create' AND NOT EXISTS(SELECT 1 FROM dbo.NhanVien WHERE maNhanVien=@actor AND vaiTro=N'Nhà bếp')
   THROW 53705,N'Chỉ Kho & Dịch vụ được xử lý',1;
  IF @lenh<>N'create' SELECT @dichVu=maDichVu FROM dbo.YeuCauKho WHERE maYeuCauKho=@id;
  DECLARE @ton INT,@nguoiGui NVARCHAR(50),@state NVARCHAR(20);
  SELECT @ton=soLuongTonKho FROM dbo.DichVu WITH(UPDLOCK,HOLDLOCK) WHERE maDichVu=@dichVu
   AND danhMuc IN(N'Món ăn',N'Thức uống',N'Vật dụng phòng') AND laTaiNguyen=0;
  IF @ton IS NULL THROW 53701,N'Không tìm thấy vật tư/hàng hóa',1;
  IF @lenh=N'create'
  BEGIN
   IF @soLuong IS NULL OR @soLuong<1 OR NULLIF(LTRIM(RTRIM(@lyDo)),N'') IS NULL OR
    NULLIF(@khoa,N'') IS NULL OR @loai NOT IN(N'Cấp hàng',N'Trả hàng',N'Báo hỏng')
    THROW 53706,N'Thiếu loại yêu cầu, số lượng hoặc lý do',1;
   IF @phong IS NOT NULL AND NOT EXISTS(SELECT 1 FROM dbo.Phong WHERE maPhong=@phong)
    THROW 53707,N'Không tìm thấy phòng',1;
   SELECT @id=maYeuCauKho FROM dbo.YeuCauKho WITH(UPDLOCK,HOLDLOCK) WHERE nguoiGui=@actor AND khoaChongTrung=@khoa;
   IF @id IS NOT NULL
   BEGIN
    IF NOT EXISTS(SELECT 1 FROM dbo.YeuCauKho WHERE maYeuCauKho=@id AND maDichVu=@dichVu AND soLuong=@soLuong AND
     loai=@loai AND ISNULL(maPhong,N'')=ISNULL(@phong,N'') AND lyDo=@lyDo)
     THROW 53702,N'Khóa yêu cầu đã dùng với nội dung khác',1;
   END
   ELSE BEGIN
    INSERT dbo.YeuCauKho(maDichVu,loai,soLuong,maPhong,nguoiGui,lyDo,khoaChongTrung,ngayGui)
    VALUES(@dichVu,@loai,@soLuong,@phong,@actor,@lyDo,@khoa,@now);SET @id=SCOPE_IDENTITY();
    INSERT dbo.NhatKyKiemSoat(nguoiThucHien,hanhDong,loaiDoiTuong,maDoiTuong,lyDo)
    VALUES(@actor,N'STOCK_REQUESTED',N'STOCK_REQUEST',CONVERT(NVARCHAR(30),@id),@lyDo);
   END
  END
  ELSE BEGIN
   SELECT @nguoiGui=nguoiGui,@state=trangThai,@soLuong=soLuong,@loai=loai FROM dbo.YeuCauKho WITH(UPDLOCK,HOLDLOCK) WHERE maYeuCauKho=@id;
   IF @state IS NULL THROW 53703,N'Không tìm thấy yêu cầu',1;
   IF @nguoiGui=@actor THROW 53705,N'Người gửi không tự xử lý yêu cầu',1;
   DECLARE @decision NVARCHAR(20)=CASE WHEN @lenh=N'approve' THEN N'Đã duyệt' ELSE N'Từ chối' END;
   IF @state NOT IN(N'Chờ duyệt',@decision) THROW 53704,N'Yêu cầu đã được xử lý',1;
   IF @state=N'Chờ duyệt'
   BEGIN
    IF @lenh=N'reject' AND NULLIF(LTRIM(RTRIM(@lyDo)),N'') IS NULL THROW 53706,N'Cần lý do từ chối',1;
    IF @lenh=N'approve'
    BEGIN
     DECLARE @tonBuongPhong INT;
     SELECT @tonBuongPhong=soLuongTon FROM dbo.TonKhoBuongPhong WITH(UPDLOCK,HOLDLOCK) WHERE maDichVu=@dichVu;
     SET @tonBuongPhong=COALESCE(@tonBuongPhong,0);
     IF @loai<>N'Cấp hàng' AND @tonBuongPhong<@soLuong
      THROW 53708,N'Tồn kho buồng phòng không đủ để trả hoặc ghi nhận hỏng',1;
     IF @loai=N'Cấp hàng' AND CONVERT(BIGINT,@tonBuongPhong)+@soLuong>2147483647
      THROW 53706,N'Tồn kho buồng phòng vượt giới hạn',1;
     IF @loai<>N'Báo hỏng'
     BEGIN
      DECLARE @movement NVARCHAR(20)=CASE WHEN @loai=N'Cấp hàng' THEN N'Xuất kho' ELSE N'Hoàn kho' END;
      DECLARE @key NVARCHAR(35)=N'stock-request-'+CONVERT(NVARCHAR(20),@id),
       @hash NVARCHAR(64)=CONVERT(NVARCHAR(64),HASHBYTES('SHA2_256',CONVERT(NVARCHAR(20),@id)),2),@bucket SMALLINT=0,
       @reason NVARCHAR(255)=@loai+N' #'+CONVERT(NVARCHAR(20),@id)+N' cho kho buồng phòng';
      EXEC dbo.uspGhiBienDongKhoDichVu @dichVu,@movement,@soLuong,@actor,@reason,@key,@hash,@bucket,@now,0;
     END
     IF NOT EXISTS(SELECT 1 FROM dbo.TonKhoBuongPhong WHERE maDichVu=@dichVu)
      INSERT dbo.TonKhoBuongPhong(maDichVu,soLuongTon) VALUES(@dichVu,0);
     UPDATE dbo.TonKhoBuongPhong
      SET soLuongTon=CASE WHEN @loai=N'Cấp hàng' THEN @tonBuongPhong+@soLuong ELSE @tonBuongPhong-@soLuong END
      WHERE maDichVu=@dichVu;
    END
    UPDATE dbo.YeuCauKho SET trangThai=@decision,nguoiDuyet=@actor,ghiChuDuyet=@lyDo,ngayDuyet=@now WHERE maYeuCauKho=@id;
    INSERT dbo.NhatKyKiemSoat(nguoiThucHien,hanhDong,loaiDoiTuong,maDoiTuong,lyDo)
    VALUES(@actor,N'STOCK_REQUEST_'+@lenh,N'STOCK_REQUEST',CONVERT(NVARCHAR(30),@id),@lyDo);
   END
  END
  COMMIT;SELECT * FROM dbo.vwYeuCauKho WHERE maYeuCauKho=@id;
 END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK;THROW;END CATCH;
END;
GO

-- Thời lượng duy nhất cho một lượt; lịch sử lưu sẵn thoiDiemKetThuc, không diễn giải lại.
CREATE PROCEDURE dbo.uspCauHinhDichVu
 @id NVARCHAR(10),@capacity INT,@minutes INT,@actor NVARCHAR(50),@reason NVARCHAR(255)
AS
BEGIN
 SET NOCOUNT ON;SET XACT_ABORT ON;
 BEGIN TRY BEGIN TRANSACTION;
  DECLARE @lock INT,@pool NVARCHAR(10),@resource NVARCHAR(255);
  SELECT @pool=COALESCE(maNguonTaiNguyen,maDichVu) FROM dbo.DichVu WHERE maDichVu=@id AND laTaiNguyen=1;
  IF @pool IS NULL THROW 53802,N'Không tìm thấy dịch vụ tài nguyên',1;
  SET @resource=N'service-booking:'+@pool;
  EXEC @lock=sys.sp_getapplock @Resource=@resource,@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=10000;
  IF @lock<0 THROW 53801,N'Dịch vụ đang được đặt',1;
  IF @capacity<1 OR @minutes<1 OR @minutes>10080 OR NULLIF(LTRIM(RTRIM(@reason)),N'') IS NULL
   THROW 53802,N'Cấu hình dịch vụ không hợp lệ',1;
  IF EXISTS(SELECT 1 FROM dbo.fnKhaDungDichVu(CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'SE Asia Standard Time' AS DATETIME2(6)),CONVERT(DATETIME2,'9999-12-31')) WHERE maDichVu=@id AND daDat>@capacity)
   THROW 53801,N'Số tài nguyên thấp hơn số đã được giữ chỗ',1;
  UPDATE dbo.DichVu SET soLuongTonKho=@capacity WHERE maDichVu=@pool;
  UPDATE dbo.DichVu SET thoiLuongPhut=@minutes WHERE maDichVu=@id AND laTaiNguyen=1;
  IF @@ROWCOUNT<>1 THROW 53802,N'Không tìm thấy dịch vụ tài nguyên',1;
  INSERT dbo.NhatKyKiemSoat(nguoiThucHien,hanhDong,loaiDoiTuong,maDoiTuong,lyDo)
  VALUES(@actor,N'SERVICE_CAPACITY_CHANGED',N'SERVICE',@id,@reason);
  COMMIT;
 END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK;THROW;END CATCH;
END;
GO

-- Backend-only provider finalization. Amount, owner, expiry and repeat events are checked under the booking lock.
CREATE PROCEDURE dbo.uspThanhToanDichVu
 @id BIGINT,@customer BIGINT,@merchant NVARCHAR(100),@amount DECIMAL(12,2),
 @provider NVARCHAR(100),@response NVARCHAR(20),@success BIT,@now DATETIME2(6)
AS
BEGIN
 SET NOCOUNT ON;SET XACT_ABORT ON;
 BEGIN TRY BEGIN TRANSACTION;
  DECLARE @reservation BIGINT,@reservationStatus NVARCHAR(30),@service NVARCHAR(10),@state NVARCHAR(20),@due DECIMAL(12,2),@paid DECIMAL(12,2),
   @expiry DATETIME2(6),@invoice BIGINT,@lock INT,@resource NVARCHAR(255),@existingMerchant NVARCHAR(100);
  SELECT @service=maDichVu,@reservation=maPhieuDatPhong FROM dbo.DatDichVuKhachSan WHERE maDatDichVuKhachSan=@id;
  IF @service IS NULL THROW 51101,N'Không tìm thấy lượt đặt dịch vụ',1;
  SELECT @resource=N'service-booking:'+COALESCE(maNguonTaiNguyen,maDichVu) FROM dbo.DichVu WHERE maDichVu=@service;
  EXEC @lock=sys.sp_getapplock @Resource=@resource,@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=10000;
  IF @lock<0 THROW 51005,N'Thanh toán đang được xử lý',1;
  SELECT @reservationStatus=trangThai
  FROM dbo.PhieuDatPhong WITH(UPDLOCK,HOLDLOCK)
  WHERE maPhieuDatPhong=@reservation
   AND (@customer IS NULL OR maTaiKhoanKhachHang=@customer);
  IF @reservationStatus IS NULL
   THROW 51001,N'Không tìm thấy đặt phòng của khách',1;
  SELECT @state=trangThai,@due=donGia*(soLuong-soLuongMienPhi),@paid=soTienDaThanhToan,
   @expiry=hanThanhToan,@existingMerchant=maThamChieuThanhToan
  FROM dbo.DatDichVuKhachSan WITH(UPDLOCK,HOLDLOCK) WHERE maDatDichVuKhachSan=@id;
  IF @merchant IS NULL
  BEGIN
   IF @reservationStatus NOT IN(N'Đã thanh toán cọc',N'Đã xác nhận',N'Đã nhận phòng')
    THROW 51112,N'Đặt phòng không còn hiệu lực để thanh toán dịch vụ',1;
   IF @state<>N'Chờ thanh toán' OR @expiry<=@now THROW 51112,N'Lượt đặt đã hết thời hạn thanh toán',1;
   IF @existingMerchant IS NULL UPDATE dbo.DatDichVuKhachSan
    SET maThamChieuThanhToan=N'SVC-'+CONVERT(NVARCHAR(20),@id) WHERE maDatDichVuKhachSan=@id;
   COMMIT;RETURN;
  END
  IF @existingMerchant IS NULL OR @existingMerchant<>@merchant OR @amount<>@due
   THROW 51113,N'Tham chiếu hoặc số tiền dịch vụ không khớp',1;
  IF @paid>0 BEGIN COMMIT;RETURN;END;
  UPDATE dbo.DatDichVuKhachSan SET maPhanHoiThanhToan=@response WHERE maDatDichVuKhachSan=@id;
  IF @success=0 BEGIN COMMIT;RETURN;END;
  IF @reservationStatus NOT IN(N'Đã thanh toán cọc',N'Đã xác nhận',N'Đã nhận phòng')
  BEGIN
   -- Giao dịch đã thành công sau khi booking đóng; giữ thông tin để đối soát, không xác nhận lại dịch vụ.
   UPDATE dbo.DatDichVuKhachSan
   SET maGiaoDichVnpay=@provider,maPhanHoiThanhToan=N'PARENT_CLOSED',thoiDiemThanhToan=@now
   WHERE maDatDichVuKhachSan=@id;
   INSERT dbo.NhatKyKiemSoat(nguoiThucHien,hanhDong,loaiDoiTuong,maDoiTuong,lyDo)
   VALUES(N'VNPAY',N'SERVICE_PAYMENT_PARENT_CLOSED',N'SERVICE_BOOKING',CONVERT(NVARCHAR(30),@id),
    CONCAT(N'amount=',CONVERT(NVARCHAR(40),@amount),N';provider=',LEFT(COALESCE(@provider,N''),100)));
   COMMIT;RETURN;
  END
  IF @state<>N'Chờ thanh toán' OR @expiry<=@now
  BEGIN
   -- Record the signed late event for manual reconciliation; never steal a released slot.
   UPDATE dbo.DatDichVuKhachSan SET maGiaoDichVnpay=@provider,maPhanHoiThanhToan=N'LATE',
    thoiDiemThanhToan=@now,trangThai=CASE WHEN trangThai=N'Chờ thanh toán' THEN N'Hết hạn' ELSE trangThai END
   WHERE maDatDichVuKhachSan=@id;
   INSERT dbo.NhatKyKiemSoat(nguoiThucHien,hanhDong,loaiDoiTuong,maDoiTuong,lyDo)
   VALUES(N'VNPAY',N'SERVICE_PAYMENT_LATE',N'SERVICE_BOOKING',CONVERT(NVARCHAR(30),@id),@provider);
   COMMIT;RETURN;
  END
  SELECT @invoice=maHoaDon FROM dbo.HoaDon WITH(UPDLOCK,HOLDLOCK) WHERE maPhieuDatPhong=@reservation;
  IF @invoice IS NULL THROW 51113,N'Booking chưa có hóa đơn đặt cọc',1;
  UPDATE dbo.DatDichVuKhachSan SET trangThai=N'Đã xác nhận',soTienDaThanhToan=@amount,
   maGiaoDichVnpay=@provider,thoiDiemThanhToan=@now WHERE maDatDichVuKhachSan=@id;
  UPDATE dbo.HoaDon SET tongTienDichVu=tongTienDichVu+@amount,phienBan=phienBan+1 WHERE maHoaDon=@invoice;
  INSERT dbo.GiaoDichThanhToan(maHoaDon,soTien,phuongThuc,loai,trangThai,maThamChieu,thoiDiemPhatSinh,maNguoiThucHien,khoaChongTrung,maSuKienBenNgoai)
  VALUES(@invoice,@amount,N'Chuyển khoản ngân hàng',N'Thanh toán',N'Đã hoàn tất',@provider,@now,N'VNPAY',@merchant,N'SVC:'+@provider);
  DECLARE @payment BIGINT=SCOPE_IDENTITY(),@receipt NVARCHAR(40)=N'SVC-VNPAY-'+CONVERT(NVARCHAR(20),@id);
  INSERT dbo.BienLai(soBienLai,maHoaDon,soTien,phuongThuc,thoiDiemPhatHanh,nguoiPhatHanh)
  VALUES(@receipt,@invoice,@amount,N'Chuyển khoản ngân hàng',@now,N'VNPAY');
  DECLARE @receiptId BIGINT=SCOPE_IDENTITY();
  INSERT dbo.ButToanTaiChinh(loaiButToan,loaiNguon,maNguon,chieuButToan,soTien,maNguoiThucHien,thoiDiemPhatSinh,ghiChu,daChotSo)
  VALUES(N'PAYMENT_RECEIVED',N'PAYMENT_TRANSACTION',CONVERT(NVARCHAR(100),@payment),N'Ghi nợ',@amount,N'VNPAY',@now,N'SERVICE_PREPAYMENT',1),
   (N'RECEIPT_ISSUED',N'RECEIPT',CONVERT(NVARCHAR(100),@receiptId),N'Ghi nợ',@amount,N'VNPAY',@now,N'SERVICE_PREPAYMENT',1);
  INSERT dbo.NhatKyKiemSoat(nguoiThucHien,hanhDong,loaiDoiTuong,maDoiTuong,lyDo)
  VALUES(N'VNPAY',N'SERVICE_PAID',N'SERVICE_BOOKING',CONVERT(NVARCHAR(30),@id),@provider);
  COMMIT;
 END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK;THROW;END CATCH;
END;
GO

CREATE PROCEDURE dbo.uspXacNhanBanGiao @id BIGINT,@actor NVARCHAR(50),@now DATETIME2(6)
AS
BEGIN
 SET NOCOUNT ON;SET XACT_ABORT ON;
 BEGIN TRY BEGIN TRANSACTION;
  IF NOT EXISTS(SELECT 1 FROM dbo.NhanVien WHERE maNhanVien=@actor AND vaiTro=N'Kế toán')
   THROW 52316,N'Chỉ kế toán được xác nhận bàn giao',1;
  DECLARE @receiver NVARCHAR(50),@confirmed NVARCHAR(50);
  SELECT @receiver=nguoiNhanBanGiao,@confirmed=nguoiXacNhan FROM dbo.BanGiaoTienCa WITH(UPDLOCK,HOLDLOCK) WHERE maBanGiaoTienCa=@id;
  IF @receiver IS NULL OR @receiver<>@actor THROW 52316,N'Chỉ người nhận được chỉ định mới được xác nhận',1;
  IF @confirmed IS NULL BEGIN
   UPDATE dbo.BanGiaoTienCa SET nguoiXacNhan=@actor,thoiDiemXacNhan=@now WHERE maBanGiaoTienCa=@id;
   INSERT dbo.NhatKyKiemSoat(nguoiThucHien,hanhDong,loaiDoiTuong,maDoiTuong)
   VALUES(@actor,N'CASH_HANDOVER_CONFIRMED',N'CASH_HANDOVER',CONVERT(NVARCHAR(30),@id));
  END
  COMMIT;
 END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK;THROW;END CATCH;
END;
GO
