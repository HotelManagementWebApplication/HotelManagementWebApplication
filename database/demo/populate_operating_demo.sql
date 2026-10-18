-- Bổ sung khách sạn đang hoạt động vào demo hiện có. Chỉ chứa dữ liệu/lệnh nghiệp vụ.
-- Không xóa dữ liệu, không đổi mật khẩu có sẵn, không thay schema hoặc lịch sử Flyway.
-- Chạy qua populate_operating_demo.ps1 để có backup trước khi ghi vào QLKS local.
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET NUMERIC_ROUNDABORT OFF;

IF DB_NAME()<>N'QLKS' AND DB_NAME() NOT LIKE N'e2e[_]%'
    THROW 51000,N'Chỉ nạp vào QLKS demo local hoặc database e2e_ dùng tạm.',1;
IF NOT EXISTS(SELECT 1 FROM dbo.NhanVien WHERE maNhanVien=N'FRONTDESK')
    OR NOT EXISTS(SELECT 1 FROM dbo.NhanVien WHERE maNhanVien=N'HOUSEKEEP')
    OR NOT EXISTS(SELECT 1 FROM dbo.TaiKhoanKhachHang)
    THROW 51000,N'Cần bộ demo nền và tài khoản demo trước khi bổ sung.',1;

BEGIN TRY
 BEGIN TRANSACTION;
 DECLARE @lock INT;
 EXEC @lock=sys.sp_getapplock @Resource=N'operating-demo-v1',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=15000;
 IF @lock<0 THROW 51000,N'Đang có tiến trình nạp dữ liệu demo khác.',1;
 IF EXISTS(SELECT 1 FROM dbo.NhatKyKiemSoat WHERE khoaLienKet=N'OPERATING-DEMO-V1-COMPLETE')
 BEGIN
    COMMIT;
    PRINT N'Bộ dữ liệu hoạt động đã được nạp; không tạo bản sao hoặc ghi đè.';
    RETURN;
 END;

 DECLARE @now DATETIME2(6)=CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'SE Asia Standard Time' AS DATETIME2(6)),
    @today DATE,@shiftStart DATETIME2(6),@shift NVARCHAR(20),@hash NVARCHAR(64),@key NVARCHAR(100),@reason NVARCHAR(500);
 SET @today=CAST(@now AS DATE);
 SET @shift=CASE WHEN DATEPART(HOUR,@now) BETWEEN 6 AND 13 THEN N'Ca sáng'
    WHEN DATEPART(HOUR,@now) BETWEEN 14 AND 21 THEN N'Ca chiều' ELSE N'Ca đêm' END;
 SET @shiftStart=DATEADD(HOUR,CASE WHEN DATEPART(HOUR,@now)<6 THEN -2 WHEN DATEPART(HOUR,@now)<14 THEN 6
    WHEN DATEPART(HOUR,@now)<22 THEN 14 ELSE 22 END,CAST(@today AS DATETIME2));
 DECLARE @numbers TABLE(n INT PRIMARY KEY);
 INSERT @numbers SELECT a.n+10*b.n+1 FROM (VALUES(0),(1),(2),(3),(4),(5),(6),(7),(8),(9)) a(n)
    CROSS JOIN (VALUES(0),(1),(2),(3),(4),(5),(6),(7),(8),(9)) b(n);

 -- 1. Khách/tài khoản: 80 hồ sơ giả lập; điện thoại và email dành riêng cho demo.
 DECLARE @guests TABLE(n INT PRIMARY KEY,id BIGINT,account BIGINT);
 INSERT dbo.KhachLuuTru(hoVaTen,diaChi,soDienThoai,email,soGiayToTuyThan,namSinh)
 SELECT CONCAT(s.ho,N' ',g.ten),c.diaChi,CONCAT(N'0899',RIGHT(N'000000'+CONVERT(NVARCHAR(6),n.n),6)),
    CONCAT(N'ops.guest.',n.n,N'@example.test'),CONCAT(N'079100',RIGHT(N'000000'+CONVERT(NVARCHAR(6),n.n),6)),1970+n.n%32
 FROM @numbers n
 JOIN (VALUES(0,N'Nguyễn'),(1,N'Trần'),(2,N'Lê'),(3,N'Phạm'),(4,N'Hoàng'),(5,N'Võ'),(6,N'Đặng'),(7,N'Bùi')) s(i,ho) ON s.i=(n.n-1)%8
 JOIN (VALUES(0,N'Minh Anh'),(1,N'Quốc Bảo'),(2,N'Thùy Dương'),(3,N'Gia Huy'),(4,N'Ngọc Linh'),
    (5,N'Thanh Mai'),(6,N'Hoàng Nam'),(7,N'Bảo Ngọc'),(8,N'Đức Phúc'),(9,N'Phương Thảo')) g(i,ten) ON g.i=(n.n-1)/8
 JOIN (VALUES(0,N'Quận 1, TP.HCM'),(1,N'Hà Nội'),(2,N'Đà Nẵng'),(3,N'Cần Thơ'),(4,N'Đà Lạt'),
    (5,N'Biên Hòa, Đồng Nai'),(6,N'Nha Trang'),(7,N'Hải Phòng')) c(i,diaChi) ON c.i=n.n%8
 WHERE n.n<=80;
 INSERT @guests(n,id)
 SELECT TRY_CONVERT(INT,SUBSTRING(soDienThoai,5,6)),maKhachLuuTru FROM dbo.KhachLuuTru
 WHERE email LIKE N'ops.guest.%@example.test';
 INSERT dbo.TaiKhoanKhachHang(maKhachLuuTru,soDienThoai,matKhau,duocKichHoat,taiKhoanKhongBiKhoa)
 SELECT g.id,k.soDienThoai,p.matKhau,1,1 FROM @guests g JOIN dbo.KhachLuuTru k ON k.maKhachLuuTru=g.id
 CROSS JOIN (SELECT TOP(1) matKhau FROM dbo.TaiKhoanKhachHang ORDER BY maTaiKhoanKhachHang) p;
 UPDATE g SET account=t.maTaiKhoanKhachHang FROM @guests g JOIN dbo.TaiKhoanKhachHang t ON t.maKhachLuuTru=g.id;

 -- 2. Nhân sự: 24 nhân viên, hồ sơ, lịch ba tuần và bảng công hai tuần.
 DECLARE @staff TABLE(n INT PRIMARY KEY,id NVARCHAR(10),role NVARCHAR(30),base NVARCHAR(10));
 INSERT @staff
 SELECT n,CONCAT(CASE WHEN n<=8 THEN N'OPSHK' WHEN n<=12 THEN N'OPSTC' WHEN n<=16 THEN N'OPSFD'
    WHEN n<=19 THEN N'OPSKT' WHEN n<=22 THEN N'OPSAC' ELSE N'OPSHR' END,RIGHT(N'00'+CONVERT(NVARCHAR(2),n),2)),
    CASE WHEN n<=8 THEN N'Buồng phòng' WHEN n<=12 THEN N'Kỹ thuật' WHEN n<=16 THEN N'Lễ tân'
    WHEN n<=19 THEN N'Nhà bếp' WHEN n<=22 THEN N'Kế toán' ELSE N'Nhân sự' END,
    CASE WHEN n<=8 THEN N'HOUSEKEEP' WHEN n<=12 THEN N'TECHNICAL' WHEN n<=16 THEN N'FRONTDESK'
    WHEN n<=19 THEN N'KITCHEN' WHEN n<=22 THEN N'ACCOUNTING' ELSE N'HR' END
 FROM @numbers WHERE n<=24;
 INSERT dbo.NhanVien(maNhanVien,hoVaTen,matKhau,vaiTro,diaChi,soDienThoai,duocKichHoat,taiKhoanKhongBiKhoa,trangThaiLamViec)
 SELECT s.id,g.hoVaTen,b.matKhau,s.role,N'Thành phố Vũng Tàu',CONCAT(N'088800',RIGHT(N'0000'+CONVERT(NVARCHAR(4),s.n),4)),1,1,N'Đang làm việc'
 FROM @staff s JOIN @guests g0 ON g0.n=s.n+30 JOIN dbo.KhachLuuTru g ON g.maKhachLuuTru=g0.id
 JOIN dbo.NhanVien b ON b.maNhanVien=s.base;
 INSERT dbo.HoSoNhanSu(maNhanVien,gioiTinh,ngaySinh,soGiayToTuyThan,ngayVaoLam,loaiHopDong,nguoiCapNhat,thoiDiemCapNhat)
 SELECT id,CASE WHEN n%2=0 THEN N'Nam' ELSE N'Nữ' END,DATEFROMPARTS(1980+n%20,1+n%12,1+n%27),
    CONCAT(N'079200',RIGHT(N'000000'+CONVERT(NVARCHAR(6),n),6)),DATEADD(MONTH,-(3+n),@today),
    CASE WHEN n>22 THEN N'Thử việc' WHEN n%3=0 THEN N'Có thời hạn' ELSE N'Không thời hạn' END,N'HR',TODATETIMEOFFSET(@now,'+07:00') FROM @staff;
 INSERT dbo.CaLamViecNhanVien(maNhanVien,ngayLamCa,maCa,thoiDiemBatDau,thoiDiemKetThuc,trangThai,nguoiTao)
 SELECT s.id,CAST(DATEADD(DAY,n.n-15,@shiftStart) AS DATE),@shift,DATEADD(DAY,n.n-15,@shiftStart),
    DATEADD(HOUR,8,DATEADD(DAY,n.n-15,@shiftStart)),CASE WHEN n.n<15 THEN N'Đã hoàn thành' ELSE N'Đã phân công' END,N'HR'
 FROM @staff s CROSS JOIN @numbers n WHERE n.n<=22;
 -- Tài khoản chính cũng có ca đang hoạt động để thao tác demo ngay sau khi nạp.
 INSERT dbo.CaLamViecNhanVien(maNhanVien,ngayLamCa,maCa,thoiDiemBatDau,thoiDiemKetThuc,trangThai,nguoiTao)
 SELECT v.id,CAST(@shiftStart AS DATE),@shift,@shiftStart,DATEADD(HOUR,8,@shiftStart),N'Đã phân công',N'HR'
 FROM (VALUES(N'FRONTDESK'),(N'HOUSEKEEP'),(N'TECHNICAL'),(N'KITCHEN'),(N'ACCOUNTING'),(N'HR'),(N'MANAGER')) v(id)
 WHERE NOT EXISTS(SELECT 1 FROM dbo.CaLamViecNhanVien c WHERE c.maNhanVien=v.id AND c.trangThai<>N'Đã hủy'
    AND c.thoiDiemBatDau<DATEADD(HOUR,8,@shiftStart) AND c.thoiDiemKetThuc>@shiftStart);
 INSERT dbo.ChamCong(maNhanVien,ngayLamViec,thoiDiemVaoCa,thoiDiemRaCa,trangThai,nguonDuLieu,ghiChu,nguoiNhap)
 SELECT c.maNhanVien,c.ngayLamCa,DATEADD(MINUTE,CASE WHEN (s.n+DAY(c.ngayLamCa))%9=0 THEN 12 ELSE -4 END,c.thoiDiemBatDau),
    CASE WHEN c.thoiDiemKetThuc<@now THEN DATEADD(MINUTE,3,c.thoiDiemKetThuc) END,
    CASE WHEN (s.n+DAY(c.ngayLamCa))%9=0 THEN N'Đi muộn' ELSE N'Có mặt' END,N'Nhập thủ công',N'OPS-DEMO: dữ liệu bảng công vận hành',N'HR'
 FROM dbo.CaLamViecNhanVien c JOIN @staff s ON s.id=c.maNhanVien WHERE c.thoiDiemBatDau<=@now;
 INSERT dbo.DonNghiPhep(maNhanVien,loaiNghiPhep,ngayBatDau,ngayKetThuc,lyDo,trangThai,nguoiYeuCau,nguoiPheDuyet,thoiDiemQuyetDinh)
 SELECT s.id,CASE WHEN s.n%3=0 THEN N'Nghỉ ốm' ELSE N'Nghỉ phép năm' END,DATEADD(DAY,s.n+3,@today),DATEADD(DAY,s.n+4,@today),
    N'OPS-DEMO: nghỉ giải quyết công việc gia đình',CASE WHEN s.n%3=0 THEN N'Đã phê duyệt' WHEN s.n%3=1 THEN N'Chờ phê duyệt' ELSE N'Bị từ chối' END,
    s.id,CASE WHEN s.n%3<>1 THEN N'MANAGER' END,CASE WHEN s.n%3<>1 THEN @now END FROM @staff s WHERE s.n<=12;
 -- Ngày đã duyệt nghỉ không được còn lịch làm việc đang hoạt động.
 UPDATE c SET trangThai=N'Đã hủy' FROM dbo.CaLamViecNhanVien c JOIN @staff s ON s.id=c.maNhanVien
 JOIN dbo.DonNghiPhep d ON d.maNhanVien=c.maNhanVien AND d.trangThai=N'Đã phê duyệt'
 WHERE c.ngayLamCa BETWEEN d.ngayBatDau AND d.ngayKetThuc;
 INSERT dbo.SuKienDangNhapNhanVien(maNhanVien,thoiDiemPhatSinh,ketQua)
 SELECT s.id,TODATETIMEOFFSET(DATEADD(MINUTE,-(s.n+v.minutesAgo),@now),'+07:00'),
    CASE WHEN v.minutesAgo=100 AND s.n%5=0 THEN N'Thất bại' ELSE N'Thành công' END
 FROM @staff s CROSS JOIN (VALUES(100),(60),(1)) v(minutesAgo);

 -- 3. Kho: hàng tiêu hao, đồ vải, nhập hàng và giao dịch cấp/trả đã được duyệt.
 DECLARE @goods TABLE(id NVARCHAR(10) PRIMARY KEY,name NVARCHAR(100),category NVARCHAR(50),unit NVARCHAR(20),price DECIMAL(12,2),quantity INT,threshold INT,active BIT);
 INSERT @goods VALUES
 (N'OPSWATER',N'Nước khoáng minibar 500 ml',N'Thức uống',N'chai',15000,1200,100,1),
 (N'OPSBEER',N'Bia lon minibar 330 ml',N'Thức uống',N'lon',45000,480,60,1),
 (N'OPSSNACK',N'Hạt điều rang minibar',N'Món ăn',N'gói',30000,600,60,1),
 (N'OPSJUICE',N'Nước trái cây đóng chai',N'Thức uống',N'chai',35000,350,50,1),
 (N'OPSGLOVE',N'Găng tay vệ sinh',N'Vật dụng phòng',N'bộ',0,300,80,0),
 (N'OPSTRASH',N'Túi rác phòng khách',N'Vật dụng phòng',N'cuộn',0,18,40,0),
 (N'OPSBLANKET',N'Chăn mỏng dự phòng',N'Vật dụng phòng',N'cái',0,0,12,0),
 (N'OPSCLEAN',N'Dung dịch lau kính',N'Vật dụng phòng',N'chai',0,60,20,0);
 INSERT dbo.DichVu(maDichVu,ten,danhMuc,donViTinh,gia,soLuongTonKho,nguongAnToan,dangHoatDong,laTaiNguyen,moTa)
 SELECT id,name,category,unit,price,0,threshold,active,0,N'OPS-DEMO: danh mục minh họa vận hành nội bộ' FROM @goods;
 DECLARE @sku NVARCHAR(10),@qty INT,@stockTime DATETIME2(6)=DATEADD(DAY,-170,@now);
 DECLARE stock_cursor CURSOR LOCAL FAST_FORWARD FOR SELECT id,quantity FROM @goods WHERE quantity>0;
 OPEN stock_cursor;FETCH NEXT FROM stock_cursor INTO @sku,@qty;
 WHILE @@FETCH_STATUS=0
 BEGIN
    SET @key=N'OPS-RECEIVE-'+@sku;SET @hash=CONVERT(VARCHAR(64),HASHBYTES('SHA2_256',@key),2);
    EXEC dbo.uspGhiBienDongKhoDichVu @sku,N'Nhập kho',@qty,N'KITCHEN',N'OPS-DEMO: nhập hàng nhà cung cấp',@key,@hash,0,@stockTime,0;
    FETCH NEXT FROM stock_cursor INTO @sku,@qty;
 END;
 CLOSE stock_cursor;DEALLOCATE stock_cursor;

 -- 4. Lưu trú: 160 lượt lịch sử, 20 đang ở, 8 đến hôm nay, 32 tương lai, 6 chờ cọc,
 -- 10 đã hủy và 2 không đến. Giá phòng được chốt theo đúng danh mục từng phòng.
 DECLARE @rooms TABLE(n INT PRIMARY KEY,id NVARCHAR(10),price DECIMAL(12,2),hourPrice DECIMAL(12,2));
 INSERT @rooms SELECT ROW_NUMBER() OVER(ORDER BY TRY_CONVERT(INT,p.maPhong)),p.maPhong,t.giaTheoNgay,t.giaTheoGio
 FROM dbo.Phong p WITH(UPDLOCK,HOLDLOCK) JOIN dbo.LoaiPhong t ON t.maLoaiPhong=p.maLoaiPhong;
 DECLARE @roomCount INT=(SELECT COUNT(*) FROM @rooms),@i INT=1,@guestN INT,@room NVARCHAR(10),@guest BIGINT,@account BIGINT,
    @start DATETIME2(6),@finish DATETIME2(6),@booked DATETIME2(6),@rate DECIMAL(12,2),@hourRate DECIMAL(12,2),
    @state NVARCHAR(30),@detailState NVARCHAR(30),@depositState NVARCHAR(20),@deposit DECIMAL(12,2),@reservation BIGINT,@invoice BIGINT,
    @roomTotal DECIMAL(12,2),@serviceTotal DECIMAL(12,2),@total DECIMAL(12,2),@payment DECIMAL(12,2),@paymentTime DATETIME2(6),
    @method NVARCHAR(30),@receipt NVARCHAR(50),@reference NVARCHAR(100),@rental NVARCHAR(20),@category NVARCHAR(20),@tries INT;
 IF @roomCount<40 THROW 51000,N'Cần ít nhất 40 phòng demo để phân bố các kịch bản vận hành.',1;
 DECLARE @stays TABLE(n INT PRIMARY KEY,id BIGINT,invoice BIGINT,guest BIGINT,account BIGINT,room NVARCHAR(10),kind NVARCHAR(20));
 WHILE @i<=238
 BEGIN
    SET @category=CASE WHEN @i<=160 THEN N'HISTORY' WHEN @i<=180 THEN N'IN_HOUSE' WHEN @i<=188 THEN N'ARRIVAL'
       WHEN @i<=220 THEN N'FUTURE' WHEN @i<=226 THEN N'HOLD' WHEN @i<=236 THEN N'CANCELLED' ELSE N'NO_SHOW' END;
    SET @guestN=CASE WHEN @i<=50 THEN 1 WHEN @i<=75 THEN 2 WHEN @i<=85 THEN 3 WHEN @i<=160 THEN @i-82
       WHEN @i<=180 THEN @i-100 ELSE 1+(@i*7)%80 END;
    SELECT @guest=id,@account=account FROM @guests WHERE n=@guestN;
    SET @rental=CASE WHEN @category=N'FUTURE' AND @i%8=0 THEN N'Theo giờ' ELSE N'Theo gói' END;
    SET @start=DATEADD(HOUR,14,CAST(DATEADD(DAY,
       CASE WHEN @i<=50 THEN -3-3*@i WHEN @i<=75 THEN -5-5*(@i-50) WHEN @i<=85 THEN -5-7*(@i-75)
       WHEN @i<=160 THEN -5-(@i%80) WHEN @i<=180 THEN -1-(@i%3) WHEN @i<=188 THEN 0
       WHEN @i<=220 THEN 1+(@i%21) WHEN @i<=226 THEN 1+(@i%4) ELSE -3-(@i%10) END,@today) AS DATETIME2));
    SET @finish=CASE WHEN @rental=N'Theo giờ' THEN DATEADD(HOUR,3,@start)
       WHEN @category=N'IN_HOUSE' THEN DATEADD(HOUR,12,CAST(DATEADD(DAY,CASE WHEN @i%5=0 THEN 0 ELSE 1+@i%3 END,@today) AS DATETIME2))
       ELSE DATEADD(HOUR,-2,DATEADD(DAY,1+@i%3,@start)) END;
    SET @room=NULL;
    IF @category IN(N'IN_HOUSE',N'ARRIVAL',N'HOLD')
       SELECT TOP(1) @room=r.id FROM @rooms r JOIN dbo.Phong p ON p.maPhong=r.id
       WHERE p.trangThai=N'Sẵn sàng'
       AND NOT EXISTS(SELECT 1 FROM dbo.NhiemVuBuongPhong h WHERE h.maPhong=r.id AND h.trangThai<>N'Sẵn sàng')
       AND NOT EXISTS(SELECT 1 FROM dbo.ChiTietDatPhong c JOIN dbo.PhieuDatPhong b ON b.maPhieuDatPhong=c.maPhieuDatPhong
           WHERE c.maPhong=r.id AND c.trangThai IN(N'Đã giữ phòng',N'Giữ tạm phòng',N'Đang có khách')
             AND b.trangThai NOT IN(N'Đã hủy',N'Không đến') AND c.thoiDiemNhanPhong<@finish AND c.thoiDiemTraPhong>@start)
       ORDER BY CHECKSUM(r.id,@i),r.id;
    ELSE SELECT @room=id FROM @rooms WHERE n=1+(@i*7)%@roomCount;
    IF @room IS NULL THROW 51000,N'Không đủ phòng trống để nạp các tình huống đang vận hành.',1;
    SET @tries=0;
    WHILE @category NOT IN(N'CANCELLED',N'NO_SHOW') AND EXISTS(
       SELECT 1 FROM dbo.ChiTietDatPhong c JOIN dbo.PhieuDatPhong b ON b.maPhieuDatPhong=c.maPhieuDatPhong
       WHERE c.maPhong=@room AND c.trangThai<>N'Đã hủy' AND b.trangThai NOT IN(N'Đã hủy',N'Không đến')
           AND c.thoiDiemNhanPhong<@finish AND c.thoiDiemTraPhong>@start)
    BEGIN
       SET @start=DATEADD(DAY,CASE WHEN @category=N'HISTORY' THEN -1 ELSE 1 END,@start);
       SET @finish=DATEADD(DAY,CASE WHEN @category=N'HISTORY' THEN -1 ELSE 1 END,@finish);
       SET @tries+=1;IF @tries>180 THROW 51000,N'Không tìm được khoảng lưu trú không trùng.',1;
    END;
    SELECT @rate=price,@hourRate=hourPrice FROM @rooms WHERE id=@room;
    SET @state=CASE @category WHEN N'HISTORY' THEN N'Đã trả phòng' WHEN N'IN_HOUSE' THEN N'Đã nhận phòng'
       WHEN N'HOLD' THEN N'Chờ thanh toán' WHEN N'CANCELLED' THEN N'Đã hủy' WHEN N'NO_SHOW' THEN N'Không đến' ELSE N'Đã thanh toán cọc' END;
    SET @detailState=CASE @category WHEN N'HISTORY' THEN N'Đã trả phòng' WHEN N'IN_HOUSE' THEN N'Đang có khách'
       WHEN N'HOLD' THEN N'Giữ tạm phòng' WHEN N'CANCELLED' THEN N'Đã hủy' WHEN N'NO_SHOW' THEN N'Đã hủy' ELSE N'Đã giữ phòng' END;
    SET @roomTotal=CASE WHEN @rental=N'Theo giờ' THEN 3*@hourRate ELSE DATEDIFF(DAY,@start,@finish)*@rate END;
    SET @deposit=ROUND(@roomTotal/2000,0)*1000;
    SET @serviceTotal=CASE WHEN @category IN(N'HISTORY',N'IN_HOUSE') THEN (1+@i%3)*15000+@i%2*30000 ELSE 0 END;
    SET @total=ROUND((@roomTotal+@serviceTotal)/1000,0)*1000;
    SET @booked=DATEADD(DAY,-(2+@i%8),CASE WHEN @start<@now THEN @start ELSE @now END);
    SET @depositState=CASE WHEN @category=N'HOLD' THEN N'Chờ thanh toán' WHEN @category=N'CANCELLED' THEN N'Đã hết hạn' ELSE N'Đã thanh toán' END;
    SET @key=CONCAT(N'OPS-DEMO-RES-',@i);
    INSERT dbo.PhieuDatPhong(maKhachLuuTru,maNhanVien,maTaiKhoanKhachHang,thoiDiemDat,tienDatCoc,trangThai,hinhThucThue,
       thoiDiemNhanPhongThucTe,thoiDiemTraPhongThucTe,khoaChongTrung,trangThaiThanhToanCoc,phuongThucBaoDam,thoiDiemHetHanThanhToanCoc,
       lyDoHuy,emailXacNhan,nguonDatPhong,doanhThuGopOta,hoaHongOta,trangThaiDoiSoatOta)
    VALUES(@guest,N'FRONTDESK',@account,@booked,@deposit,@state,@rental,
       CASE WHEN @category IN(N'HISTORY',N'IN_HOUSE') THEN @start END,CASE WHEN @category=N'HISTORY' THEN @finish END,
       @key,@depositState,CASE WHEN @category=N'HOLD' OR @i%2=0 THEN N'Tại khách sạn' ELSE N'VNPay' END,
       CASE WHEN @category=N'HOLD' THEN DATEADD(MINUTE,10,@now) WHEN @category=N'CANCELLED' THEN DATEADD(MINUTE,10,@booked) END,
       CASE WHEN @category=N'CANCELLED' THEN N'OPS-DEMO: khách không thanh toán trong thời hạn giữ phòng' END,
       CONCAT(N'ops.guest.',@guestN,N'@example.test'),
       CASE WHEN @category IN(N'HISTORY',N'FUTURE') AND @i%4=0 THEN N'BOOKING_COM'
         WHEN @category IN(N'HISTORY',N'FUTURE') AND @i%7=0 THEN N'AGODA' ELSE N'Trực tiếp' END,
       CASE WHEN @category IN(N'HISTORY',N'FUTURE') AND (@i%4=0 OR @i%7=0) THEN @roomTotal ELSE 0 END,
       CASE WHEN @category IN(N'HISTORY',N'FUTURE') AND (@i%4=0 OR @i%7=0) THEN @roomTotal*0.15 ELSE 0 END,
       CASE WHEN @category IN(N'HISTORY',N'FUTURE') AND (@i%4=0 OR @i%7=0)
         THEN CASE WHEN @i%3=0 THEN N'Chờ đối soát' ELSE N'Đã khớp' END ELSE N'Không áp dụng' END);
    SET @reservation=SCOPE_IDENTITY();
    INSERT dbo.ChiTietDatPhong(maPhieuDatPhong,maPhong,thoiDiemNhanPhong,thoiDiemTraPhong,thoiDiemTraPhongBanDau,giaTheoNgayDaChot,giaTheoGioDaChot,trangThai,soLuongKhach)
    VALUES(@reservation,@room,@start,@finish,@finish,@rate,@hourRate,@detailState,CASE WHEN @i%4=0 THEN 2 ELSE 1 END);
    IF @category=N'IN_HOUSE' UPDATE dbo.Phong SET trangThai=N'Đang có khách',phienBan=phienBan+1 WHERE maPhong=@room;
    SET @invoice=NULL;
    IF @category NOT IN(N'CANCELLED',N'HOLD')
    BEGIN
       IF @category=N'NO_SHOW' SET @total=@deposit;
       INSERT dbo.HoaDon(maPhieuDatPhong,thoiDiemPhatHanh,tongTienPhong,tongTienDichVu,tienDatCocDaTra,soTienPhaiTra,tongTienDieuChinh,trangThai)
       VALUES(@reservation,@booked,CASE WHEN @category=N'NO_SHOW' THEN 0 ELSE @roomTotal END,@serviceTotal,@deposit,@total,
          CASE WHEN @category=N'NO_SHOW' THEN @deposit ELSE 0 END,N'Chưa thanh toán');
       SET @invoice=SCOPE_IDENTITY();
       IF @category=N'NO_SHOW'
          INSERT dbo.DieuChinhHoaDon(maHoaDon,soTienChenhLech,lyDo,maNguoiThucHien,thoiDiemPhatSinh,khoaChongTrung)
          VALUES(@invoice,@deposit,N'OPS-DEMO: không đến nhận phòng, mất tiền đặt cọc theo chính sách',N'FRONTDESK',@finish,@key);
       SET @method=CASE WHEN @i%2=0 THEN N'Tiền mặt' ELSE N'Chuyển khoản ngân hàng' END;
       SET @paymentTime=DATEADD(MINUTE,3,@booked);SET @key=CONCAT(N'OPS-DEMO-DEP-',@i);
       SET @reference=CONCAT(N'DEPOSIT:',@reservation);SET @receipt=CONCAT(N'OPS-DEP-',@reservation);
       EXEC dbo.uspLenhGiaoDichThanhToan N'payment',@invoice,@deposit,@method,@reference,@key,N'FRONTDESK',NULL,@paymentTime;
       EXEC dbo.uspPhatHanhBienLai @invoice,@receipt,@deposit,@method,N'FRONTDESK',@paymentTime;
       IF @category=N'HISTORY'
       BEGIN
          SET @method=CASE @i%3 WHEN 0 THEN N'Tiền mặt' WHEN 1 THEN N'Thẻ' ELSE N'Chuyển khoản ngân hàng' END;
          SET @payment=CASE WHEN @i%17=0 THEN ROUND((@total-@deposit)/2000,0)*1000 ELSE @total-@deposit END;
          SET @key=CONCAT(N'OPS-DEMO-FINAL-',@i);SET @reference=CONCAT(N'FINAL:',@reservation);SET @receipt=CONCAT(N'OPS-FINAL-',@reservation);
          IF @payment>0
          BEGIN
             EXEC dbo.uspLenhGiaoDichThanhToan N'payment',@invoice,@payment,@method,@reference,@key,N'FRONTDESK',NULL,@finish;
             EXEC dbo.uspPhatHanhBienLai @invoice,@receipt,@payment,@method,N'FRONTDESK',@finish;
          END;
       END;
       IF @category IN(N'HISTORY',N'NO_SHOW')
          INSERT dbo.ButToanTaiChinh(loaiButToan,loaiNguon,maNguon,chieuButToan,soTien,maNguoiThucHien,thoiDiemPhatSinh,ghiChu)
          VALUES(N'REVENUE_RECOGNIZED',N'INVOICE',CONVERT(NVARCHAR(100),@invoice),N'Ghi có',@total,N'FRONTDESK',@finish,
             CASE WHEN @category=N'NO_SHOW' THEN N'NO_SHOW_DEPOSIT_FORFEITED' ELSE N'CHECKOUT' END);
    END;
    IF @category IN(N'HISTORY',N'IN_HOUSE')
    BEGIN
       INSERT dbo.SuDungDichVu(maPhieuDatPhong,maDichVu,ngaySuDung,soLuong,donGia)
       VALUES(@reservation,N'OPSWATER',CAST(@start AS DATE),1+@i%3,15000);
       IF @i%2=1 INSERT dbo.SuDungDichVu(maPhieuDatPhong,maDichVu,ngaySuDung,soLuong,donGia)
          VALUES(@reservation,N'OPSSNACK',CAST(@start AS DATE),1,30000);
       SET @key=CONCAT(N'OPS-WATER-',@i);SET @hash=CONVERT(VARCHAR(64),HASHBYTES('SHA2_256',@key),2);SET @qty=1+@i%3;
       EXEC dbo.uspGhiBienDongKhoDichVu N'OPSWATER',N'Xuất kho',@qty,N'KITCHEN',N'OPS-DEMO: phục vụ khách lưu trú',@key,@hash,0,@start,0;
       IF @i%2=1
       BEGIN
          SET @key=CONCAT(N'OPS-SNACK-',@i);SET @hash=CONVERT(VARCHAR(64),HASHBYTES('SHA2_256',@key),2);
          EXEC dbo.uspGhiBienDongKhoDichVu N'OPSSNACK',N'Xuất kho',1,N'KITCHEN',N'OPS-DEMO: phục vụ khách lưu trú',@key,@hash,0,@start,0;
       END;
    END;
    INSERT @stays VALUES(@i,@reservation,@invoice,@guest,@account,@room,@category);
    SET @i+=1;
 END;

 -- Tham chiếu VNPay mô phỏng cho các khoản cọc online đã thu; không gọi ngân hàng.
 INSERT dbo.YeuCauThanhToanVnpay(maPhieuDatPhong,maThamChieuMerchant,soTien,trangThai,thoiDiemTao,thoiDiemHetHan,thoiDiemHoanTat,maGiaoDichVnpay,maNganHang,loaiThe,maPhanHoi)
 SELECT s.id,CONCAT(N'OPS-VNPAY-',s.id),b.tienDatCoc,N'Thành công',b.thoiDiemDat,DATEADD(MINUTE,10,b.thoiDiemDat),
    DATEADD(MINUTE,3,b.thoiDiemDat),CONCAT(N'OPS-BANK-',s.id),N'NCB',N'ATM',N'00'
 FROM @stays s JOIN dbo.PhieuDatPhong b ON b.maPhieuDatPhong=s.id
 WHERE b.phuongThucBaoDam=N'VNPay' AND b.trangThaiThanhToanCoc=N'Đã thanh toán';
 UPDATE b SET maThanhToanDatCoc=CONCAT(N'OPS-VNPAY-',b.maPhieuDatPhong) FROM dbo.PhieuDatPhong b JOIN @stays s ON s.id=b.maPhieuDatPhong
 WHERE b.phuongThucBaoDam=N'VNPay' AND b.trangThaiThanhToanCoc=N'Đã thanh toán';
 UPDATE p SET maSuKienBenNgoai=CONCAT(N'OPS-BANK-',s.id)
 FROM dbo.GiaoDichThanhToan p JOIN @stays s ON s.invoice=p.maHoaDon JOIN dbo.PhieuDatPhong b ON b.maPhieuDatPhong=s.id
 WHERE p.khoaChongTrung LIKE N'OPS-DEMO-DEP-%' AND b.phuongThucBaoDam=N'VNPay';

 -- Hạng VIP được tính từ chính các lượt đã checkout trong bộ dữ liệu này.
 UPDATE k SET soLanLuuTruHoanThanh=x.visits,tongChiTieu=x.total,
    hangThanhVien=CASE WHEN x.visits>=50 THEN N'Bạch kim' WHEN x.visits>=25 THEN N'Vàng' WHEN x.visits>=10 THEN N'Bạc' ELSE N'Tiêu chuẩn' END
 FROM dbo.KhachLuuTru k JOIN @guests g ON g.id=k.maKhachLuuTru
 CROSS APPLY(SELECT COUNT(*) visits,COALESCE(SUM(h.tongTienPhong+h.tongTienDichVu),0) total
    FROM @stays s JOIN dbo.HoaDon h ON h.maHoaDon=s.invoice WHERE s.guest=g.id AND s.kind=N'HISTORY') x;
 INSERT dbo.LichSuHangThanhVien(maKhachLuuTru,hangCu,hangMoi,lyDo,thoiDiemThayDoi)
 SELECT k.maKhachLuuTru,N'Tiêu chuẩn',k.hangThanhVien,N'OPS-DEMO: đủ số lượt lưu trú hoàn tất',@now
 FROM dbo.KhachLuuTru k JOIN @guests g ON g.id=k.maKhachLuuTru WHERE k.hangThanhVien<>N'Tiêu chuẩn';
 INSERT dbo.HoaDonGiaTriGiaTang(maHoaDon,soHoaDonGiaTriGiaTang,thueSuat,soTienChiuThue,loaiKhachHang,tenKhachHang,maSoThue,tenCongTy,diaChiCongTy,trangThai,nguoiTao,thoiDiemPhatHanh)
 SELECT h.maHoaDon,CONCAT(N'OPS-VAT-',h.maHoaDon),8,ROUND((h.tongTienPhong+h.tongTienDichVu)/1.08,2),
    CASE WHEN s.n%2=0 THEN N'Doanh nghiệp' ELSE N'Cá nhân' END,k.hoVaTen,
    CASE WHEN s.n%2=0 THEN N'0312345678' END,CASE WHEN s.n%2=0 THEN N'Công ty Du lịch Minh An (demo)' END,
    CASE WHEN s.n%2=0 THEN N'Quận 1, TP.HCM' END,CASE WHEN s.n%3=0 THEN N'Bản nháp' ELSE N'Đã phát hành' END,N'ACCOUNTING',b.thoiDiemTraPhongThucTe
 FROM @stays s JOIN dbo.HoaDon h ON h.maHoaDon=s.invoice JOIN dbo.PhieuDatPhong b ON b.maPhieuDatPhong=s.id
 JOIN dbo.KhachLuuTru k ON k.maKhachLuuTru=s.guest WHERE s.kind=N'HISTORY' AND s.n%5=0;

 -- 5. Buồng phòng/kỹ thuật: 10 phòng cần xử lý, checklist đầy đủ theo trạng thái.
 DECLARE @workRooms TABLE(n INT PRIMARY KEY,room NVARCHAR(10),task BIGINT);
 INSERT @workRooms(n,room)
 SELECT TOP(10) ROW_NUMBER() OVER(ORDER BY TRY_CONVERT(INT,p.maPhong)),p.maPhong FROM dbo.Phong p
 WHERE p.trangThai=N'Sẵn sàng' AND NOT EXISTS(SELECT 1 FROM dbo.NhiemVuBuongPhong h WHERE h.maPhong=p.maPhong)
 AND NOT EXISTS(SELECT 1 FROM dbo.ChiTietDatPhong c JOIN dbo.PhieuDatPhong b ON b.maPhieuDatPhong=c.maPhieuDatPhong
    WHERE c.maPhong=p.maPhong AND c.trangThai IN(N'Đã giữ phòng',N'Giữ tạm phòng',N'Đang có khách') AND b.trangThai NOT IN(N'Đã hủy',N'Không đến')
       AND c.thoiDiemNhanPhong<DATEADD(DAY,1,@now) AND c.thoiDiemTraPhong>@now)
 ORDER BY TRY_CONVERT(INT,p.maPhong);
 IF (SELECT COUNT(*) FROM @workRooms)<6 THROW 51000,N'Không đủ phòng cho kịch bản buồng phòng/kỹ thuật.',1;
 INSERT dbo.ThietBiPhong(maPhong,ten,giaTriBanDau,ngayMua,soLuong)
 SELECT r.id,v.name,v.price,DATEADD(MONTH,-(6+r.n%30),@today),1 FROM @rooms r
 CROSS JOIN (VALUES(N'Điều hòa',12000000),(N'Tivi',8500000),(N'Khóa cửa điện tử',2500000),(N'Máy sấy tóc',900000)) v(name,price)
 WHERE NOT EXISTS(SELECT 1 FROM dbo.ThietBiPhong t WHERE t.maPhong=r.id AND t.ten=v.name);
 INSERT dbo.NhiemVuBuongPhong(maPhong,nguoiDuocPhanCong,trangThai,daHoanThanhChecklist,coSuCoChan,ghiChu,nguoiPhanCong,thoiDiemCapNhat)
 SELECT room,CASE WHEN n<=5 THEN N'HOUSEKEEP' ELSE CONCAT(N'OPSHK',RIGHT(N'00'+CONVERT(NVARCHAR(2),n-5),2)) END,
    CASE WHEN n<=3 THEN N'Cần dọn phòng' WHEN n<=5 THEN N'Đang thực hiện' WHEN n<=7 THEN N'Đã dọn xong' ELSE N'Chờ kỹ thuật' END,
    CASE WHEN n>=6 THEN 1 ELSE 0 END,CASE WHEN n>=8 THEN 1 ELSE 0 END,
    CONCAT(N'OPS-DEMO: ',CASE WHEN n<=3 THEN N'khách vừa trả, chờ nhận việc' WHEN n<=5 THEN N'đang dọn, kiểm tra minibar'
       WHEN n<=7 THEN N'đã hoàn thành vệ sinh, chờ quản lý nghiệm thu' ELSE N'đã dọn, đang chờ kỹ thuật xử lý điều hòa' END),N'MANAGER',@now FROM @workRooms;
 UPDATE r SET task=t.maNhiemVuBuongPhong FROM @workRooms r JOIN dbo.NhiemVuBuongPhong t ON t.maPhong=r.room WHERE t.ghiChu LIKE N'OPS-DEMO:%';
 INSERT dbo.KetQuaChecklistBuongPhong(maNhiemVuBuongPhong,hangMuc,datYeuCau,ghiChu,nguoiHoanThanh,thoiDiemHoanThanh)
 SELECT r.task,t.ten,CASE WHEN r.n>=6 OR (r.n>=4 AND t.maMauChecklist%2=0) THEN 1 ELSE 0 END,
    N'OPS-DEMO: kiểm tra theo checklist ca',N'HOUSEKEEP',@now FROM @workRooms r CROSS JOIN dbo.MauChecklistBuongPhong t WHERE t.dangHoatDong=1;
 UPDATE p SET trangThai=CASE WHEN r.n>=8 THEN N'Đang bảo trì' ELSE N'Đang dọn phòng' END,phienBan=phienBan+1
 FROM dbo.Phong p JOIN @workRooms r ON r.room=p.maPhong;
 INSERT dbo.KiemTraBuongPhong(maNhiemVuBuongPhong,loaiKiemTra,hangMuc,soLuong,tinhTrangHangMuc,ghiChu,nguoiHoanThanh,thoiDiemHoanThanh)
 SELECT task,N'Minibar',N'Nước khoáng minibar',2+n%3,CASE WHEN n%2=0 THEN N'Đã bổ sung' ELSE N'Bình thường' END,
    N'OPS-DEMO: đối chiếu số lượng minibar trong phòng',N'HOUSEKEEP',@now FROM @workRooms;
 INSERT dbo.SuCoThietBi(maPhong,tenThietBi,giaTriBanDau,ngayMua,soLuong,tienBoiThuong,mucDoNghiemTrong,trangThaiBanGiao,ghiChuBanGiao)
 SELECT room,N'Điều hòa',12000000,DATEADD(YEAR,-2,@today),1,0,N'Cao',CASE WHEN n=8 THEN N'Đang mở' ELSE N'Đã tiếp nhận' END,
    N'OPS-DEMO: điều hòa không lạnh, không quy trách nhiệm khách' FROM @workRooms WHERE n>=8;
 INSERT dbo.PhieuCongViecKyThuat(maPhong,maThietBiPhong,nguoiDuocPhanCong,doUuTien,thoiHanSla,vatTuSuDung,ghiChuKetQua,ghiChuNghiemThu,nguoiNghiemThu,thoiDiemNghiemThu,trangThai,nguoiTao,thoiDiemTao,thoiDiemCapNhat)
 SELECT r.room,t.maThietBiPhong,N'TECHNICAL',CASE WHEN r.n>=8 THEN N'Cao' ELSE N'Trung bình' END,
    DATEADD(HOUR,CASE WHEN r.n=8 THEN -1 ELSE 4 END,@now),N'OPS-DEMO: kiểm tra gas, vệ sinh dàn lạnh',
    CASE WHEN r.n<=7 THEN N'Đã bảo dưỡng, thiết bị vận hành bình thường' WHEN r.n=10 THEN N'Đã sửa, cần quản lý nghiệm thu trước khi mở phòng' END,
    CASE WHEN r.n<=7 THEN N'Đã kiểm tra và chấp nhận kết quả kỹ thuật' END,CASE WHEN r.n<=7 THEN N'MANAGER' END,
    CASE WHEN r.n<=7 THEN DATEADD(MINUTE,-30,@now) END,
    CASE r.n WHEN 8 THEN N'Mới tạo' WHEN 9 THEN N'Đang thực hiện' WHEN 10 THEN N'Chờ nghiệm thu' ELSE N'Đã bàn giao phòng' END,
    N'HOUSEKEEP',DATEADD(HOUR,-3,@now),@now FROM @workRooms r JOIN dbo.ThietBiPhong t ON t.maPhong=r.room AND t.ten=N'Điều hòa';
 INSERT dbo.PhieuBaoTri(maPhieuBaoTri,maPhong,loaiBaoTri,ngayDuKien,trangThai,moTa)
 SELECT CONCAT(N'OPS-WO-',n),room,N'Bảo dưỡng định kỳ',DATEADD(DAY,n-3,@today),
    CASE WHEN n<=3 THEN N'Đã hoàn thành' WHEN n<=6 THEN N'Chưa xử lý' ELSE N'Đang bảo trì' END,N'OPS-DEMO: vệ sinh máy lạnh, kiểm tra điện và thoát nước' FROM @workRooms;
 INSERT dbo.TaiSanKyThuat(maTaiSanKyThuat,ten,danhMuc,loaiViTri,maPhong,tang,viTri,thuongHieuMau,ngayLapDat,ngayBaoTriTiepTheo,trangThai,giaTriBanDau,ghiChu)
 SELECT CONCAT(N'OPS-ASSET-',r.id),CONCAT(N'Điều hòa phòng ',r.id),N'HVAC',N'Phòng',r.id,p.tang,CONCAT(N'Phòng ',r.id),N'Daikin Inverter 1.5HP',
    DATEADD(MONTH,-18,@today),DATEADD(DAY,r.n%20-5,@today),CASE WHEN w.n>=8 THEN N'Đang sửa chữa' WHEN r.n%7=0 THEN N'Cần bảo trì' ELSE N'Tốt' END,
    12000000,N'OPS-DEMO: lịch bảo trì tài sản theo phòng' FROM @rooms r JOIN dbo.Phong p ON p.maPhong=r.id LEFT JOIN @workRooms w ON w.room=r.id;

 -- 6. Dịch vụ đang dùng/sắp dùng/đã hủy, tạo qua đúng procedure để hóa đơn và thanh toán khớp.
 DECLARE @serviceId BIGINT,@serviceAmount DECIMAL(12,2),@merchant NVARCHAR(100),@actor NVARCHAR(50),@serviceAt DATETIME2(6),@serviceCreated DATETIME2(6),@meal NVARCHAR(10);
 DECLARE service_cursor CURSOR LOCAL FAST_FORWARD FOR
 SELECT TOP(8) s.id,s.account,s.room FROM @stays s JOIN dbo.ChiTietDatPhong c ON c.maPhieuDatPhong=s.id AND c.maPhong=s.room
 WHERE s.kind=N'IN_HOUSE' AND c.thoiDiemTraPhong>DATEADD(HOUR,16,@now) ORDER BY s.n;
 OPEN service_cursor;FETCH NEXT FROM service_cursor INTO @reservation,@account,@room;
 SET @i=1;
 WHILE @@FETCH_STATUS=0
 BEGIN
    SET @actor=CONCAT(N'customer:',@account);SET @key=CONCAT(N'OPS-SVC-MEAL-',@i);
    SET @serviceAt=CASE WHEN CAST(@now AS TIME)<'12:30' THEN DATEADD(MINUTE,750,CAST(@today AS DATETIME2))
       WHEN CAST(@now AS TIME)<'20:00' THEN DATEADD(HOUR,20,CAST(@today AS DATETIME2))
       ELSE DATEADD(MINUTE,750,CAST(DATEADD(DAY,1,@today) AS DATETIME2)) END;
    SET @meal=CASE WHEN DATEPART(HOUR,@serviceAt)=20 THEN N'Bữa tối' ELSE N'Bữa trưa' END;
    EXEC dbo.uspDatDichVuKhachSan @reservation,@room,N'MAMREST',@serviceAt,1,@meal,N'OPS-DEMO: quyền lợi bữa ăn của khách lưu trú',@key,N'OPS-DEMO',@actor,@account,0,@now;
    SET @sku=CASE WHEN @i%2=0 THEN N'SPAMASS' ELSE N'LNDRYEXP' END;SET @key=CONCAT(N'OPS-SVC-PAID-',@i);
    SET @serviceCreated=DATEADD(MINUTE,CASE WHEN @i<=6 THEN -5 ELSE 0 END,@now);SET @serviceAt=DATEADD(MINUTE,CASE WHEN @i<=3 THEN -2 ELSE 60 END,@now);
    EXEC dbo.uspDatDichVuKhachSan @reservation,@room,@sku,@serviceAt,1,NULL,N'OPS-DEMO: đơn dịch vụ trong kỳ lưu trú',@key,N'OPS-DEMO',@actor,@account,0,@serviceCreated;
    IF @i<=6
    BEGIN
       SELECT @serviceId=maDatDichVuKhachSan,@serviceAmount=donGia*(soLuong-soLuongMienPhi) FROM dbo.DatDichVuKhachSan WHERE khoaYeuCau=@key;
       EXEC dbo.uspThanhToanDichVu @serviceId,@account,NULL,NULL,NULL,NULL,0,@serviceCreated;
       SET @merchant=CONCAT(N'SVC-',@serviceId);SET @reference=CONCAT(N'OPS-SVC-PAID-',@serviceId);
       EXEC dbo.uspThanhToanDichVu @serviceId,NULL,@merchant,@serviceAmount,@reference,N'00',1,@now;
       IF @i<=3 EXEC dbo.uspXacNhanSuDungDichVu @serviceId,N'KITCHEN',@now,@reservation;
       IF @i=6 EXEC dbo.uspHuyDatDichVu @serviceId,@actor,@account;
    END;
    SET @i+=1;FETCH NEXT FROM service_cursor INTO @reservation,@account,@room;
 END;
 CLOSE service_cursor;DEALLOCATE service_cursor;

 DECLARE @requestId BIGINT,@requestTime DATETIME2(6)=DATEADD(HOUR,-2,@now);
 SET @i=1;
 WHILE @i<=8
 BEGIN
    SET @sku=CASE @i%4 WHEN 0 THEN N'OPSGLOVE' WHEN 1 THEN N'OPSWATER' WHEN 2 THEN N'OPSSNACK' ELSE N'OPSTRASH' END;
    SET @key=CONCAT(N'OPS-STOCK-',@i);SET @qty=CASE WHEN @i<=4 THEN 10 ELSE 3 END;
    SET @reason=CASE WHEN @i<=4 THEN N'OPS-DEMO: cấp hàng đầu ca cho buồng phòng' ELSE N'OPS-DEMO: đề nghị cấp bổ sung cuối ca' END;
    EXEC dbo.uspLenhYeuCauKho N'create',NULL,@sku,@qty,NULL,N'HOUSEKEEP',@reason,@key,@requestTime,N'Cấp hàng';
    IF @i<=4
    BEGIN
       SELECT @requestId=maYeuCauKho FROM dbo.YeuCauKho WHERE nguoiGui=N'HOUSEKEEP' AND khoaChongTrung=@key;
       EXEC dbo.uspLenhYeuCauKho N'approve',@requestId,NULL,NULL,NULL,N'KITCHEN',N'Đã kiểm đếm và cấp hàng',NULL,@requestTime,NULL;
    END;
    SET @i+=1;
 END;
 EXEC dbo.uspLenhYeuCauKho N'create',NULL,N'OPSWATER',2,NULL,N'HOUSEKEEP',N'OPS-DEMO: hàng nguyên chai chưa sử dụng',N'OPS-STOCK-RETURN',@now,N'Trả hàng';
 EXEC dbo.uspLenhYeuCauKho N'create',NULL,N'OPSGLOVE',1,NULL,N'HOUSEKEEP',N'OPS-DEMO: găng tay rách trong ca',N'OPS-STOCK-DAMAGE',@now,N'Báo hỏng';

 -- 7. Kế toán: chi phí, công nợ, thanh toán nhà cung cấp và bàn giao tiền theo sổ thu.
 INSERT dbo.KhoanChi(danhMuc,moTa,soTien,phuongThucThanhToan,nguoiChiTra,thoiDiemChiTra,trangThai)
 SELECT CASE n%4 WHEN 0 THEN N'Điện nước' WHEN 1 THEN N'Vật tư vệ sinh' WHEN 2 THEN N'Bảo trì thiết bị' ELSE N'Thực phẩm nhà hàng' END,
    CONCAT(N'OPS-DEMO: chứng từ chi số ',n),350000+n*125000,N'Chuyển khoản ngân hàng',N'ACCOUNTING',DATEADD(DAY,-n,@now),N'Đã ghi nhận' FROM @numbers WHERE n<=30;
 INSERT dbo.ButToanTaiChinh(loaiButToan,loaiNguon,maNguon,chieuButToan,soTien,maNguoiThucHien,thoiDiemPhatSinh,ghiChu)
 SELECT N'EXPENSE',N'EXPENSE',CONVERT(NVARCHAR(100),maKhoanChi),N'Ghi nợ',soTien,N'ACCOUNTING',thoiDiemChiTra,moTa
 FROM dbo.KhoanChi WHERE moTa LIKE N'OPS-DEMO:%';
 INSERT dbo.CongNoDoiTac(tenDoiTac,maThamChieu,soTien,soTienDaThanhToan,trangThai,thoiDiemGhiNhan)
 SELECT CONCAT(CASE n%4 WHEN 0 THEN N'Công ty Đồ vải Sao Mai' WHEN 1 THEN N'Thực phẩm Sạch Vũng Tàu'
    WHEN 2 THEN N'Điện lạnh Minh Phát' ELSE N'Vật tư Khách sạn An Bình' END,N' - đợt ',n),CONCAT(N'OPS-SUPPLIER-',n),
    4000000+n*1500000,CASE n%3 WHEN 0 THEN 4000000+n*1500000 WHEN 1 THEN 0 ELSE (4000000+n*1500000)/2 END,
    CASE n%3 WHEN 0 THEN N'Đã thanh toán' WHEN 1 THEN N'Chưa thanh toán' ELSE N'Đã thanh toán một phần' END,DATEADD(DAY,-n*2,@now)
 FROM @numbers WHERE n<=12;
 INSERT dbo.ButToanTaiChinh(loaiButToan,loaiNguon,maNguon,chieuButToan,soTien,maNguoiThucHien,thoiDiemPhatSinh,ghiChu)
 SELECT N'PARTNER_DEBT_RECORDED',N'PARTNER_DEBT',CONVERT(NVARCHAR(100),maCongNoDoiTac),N'Ghi có',soTien,N'ACCOUNTING',thoiDiemGhiNhan,maThamChieu
 FROM dbo.CongNoDoiTac WHERE maThamChieu LIKE N'OPS-SUPPLIER-%';
 INSERT dbo.ThanhToanCongNoDoiTac(maCongNoDoiTac,soTien,phuongThucThanhToan,nguoiThanhToan,thoiDiemThanhToan,ghiChu)
 SELECT maCongNoDoiTac,soTienDaThanhToan,N'Chuyển khoản ngân hàng',N'ACCOUNTING',DATEADD(DAY,1,thoiDiemGhiNhan),N'OPS-DEMO: thanh toán nhà cung cấp theo chứng từ'
 FROM dbo.CongNoDoiTac WHERE maThamChieu LIKE N'OPS-SUPPLIER-%' AND soTienDaThanhToan>0;
 INSERT dbo.ButToanTaiChinh(loaiButToan,loaiNguon,maNguon,chieuButToan,soTien,maNguoiThucHien,thoiDiemPhatSinh,ghiChu)
 SELECT N'PARTNER_DEBT_SETTLEMENT',N'PARTNER_DEBT',CONVERT(NVARCHAR(100),maCongNoDoiTac),N'Ghi nợ',soTien,N'ACCOUNTING',thoiDiemThanhToan,ghiChu
 FROM dbo.ThanhToanCongNoDoiTac WHERE ghiChu LIKE N'OPS-DEMO:%';
 INSERT dbo.BanGiaoTienCa(maCa,nguoiBanGiao,nguoiNhanBanGiao,soTienDuKien,soTienThucTe,thoiDiemBanGiao,ghiChu,nguoiXacNhan,thoiDiemXacNhan)
 SELECT N'Ca chiều',p.maNguoiThucHien,N'ACCOUNTING',SUM(p.soTien),SUM(p.soTien),DATEADD(HOUR,23,CAST(CAST(p.thoiDiemPhatSinh AS DATE) AS DATETIME2)),
    N'OPS-DEMO: bàn giao tiền mặt theo các giao dịch thực thu',CASE WHEN DAY(p.thoiDiemPhatSinh)%3<>0 THEN N'ACCOUNTING' END,
    CASE WHEN DAY(p.thoiDiemPhatSinh)%3<>0 THEN DATEADD(HOUR,24,CAST(CAST(p.thoiDiemPhatSinh AS DATE) AS DATETIME2)) END
 FROM dbo.GiaoDichThanhToan p WHERE p.khoaChongTrung LIKE N'OPS-DEMO-%' AND p.phuongThuc=N'Tiền mặt' AND p.thoiDiemPhatSinh<CAST(@today AS DATETIME2)
 GROUP BY p.maNguoiThucHien,CAST(p.thoiDiemPhatSinh AS DATE),DAY(p.thoiDiemPhatSinh);
 INSERT dbo.ChiTietTienBanGiao(maBanGiaoTienCa,menhGia,soLuong)
 SELECT b.maBanGiaoTienCa,v.denom,q.quantity
 FROM dbo.BanGiaoTienCa b CROSS JOIN (VALUES(500000,NULL),(100000,500000),(50000,100000),(10000,50000),(5000,10000),(1000,5000)) v(denom,previous)
 CROSS APPLY(SELECT CONVERT(INT,(CASE WHEN v.previous IS NULL THEN b.soTienThucTe ELSE b.soTienThucTe%v.previous END)/v.denom) quantity) q
 WHERE b.ghiChu LIKE N'OPS-DEMO:%' AND q.quantity>0;

 -- 8. Hồ sơ tiếp nhận và hàng đợi phê duyệt để thử các màn hình quản lý.
 INSERT dbo.DeNghiTiepNhanNhanVien(maDeNghi,duLieuHoSo,vaiTroDeXuat,lyDo,trangThai,nguoiDeNghi,nguoiXetDuyet,lyDoQuyetDinh,phienBan,thoiDiemTao,thoiDiemGui,thoiDiemQuyetDinh)
 SELECT NEWID(),(SELECT CONCAT(N'Ứng viên ',n.n,N' Nguyễn Minh') AS full_name,CONCAT(N'08770000',RIGHT(N'00'+CONVERT(NVARCHAR(2),n.n),2)) AS phone,
    CONCAT(N'ops.applicant.',n.n,N'@example.test') AS email,N'Vũng Tàu' AS address,N'FEMALE' AS gender,N'1998-06-15' AS birth_date,
    CONCAT(N'0793000000',RIGHT(N'00'+CONVERT(NVARCHAR(2),n.n),2)) AS identity_number,CONVERT(NVARCHAR(10),DATEADD(DAY,7,@today),23) AS hire_date,N'PROBATION' AS contract_type FOR JSON PATH,WITHOUT_ARRAY_WRAPPER),
    CASE WHEN n.n%2=0 THEN N'Buồng phòng' ELSE N'Lễ tân' END,N'OPS-DEMO: bổ sung nhân sự mùa cao điểm',
    CASE WHEN n.n<=3 THEN N'Chờ duyệt' WHEN n.n=4 THEN N'Bản nháp' WHEN n.n=5 THEN N'Cần bổ sung' ELSE N'Bị từ chối' END,N'HR',
    CASE WHEN n.n>=5 THEN N'MANAGER' END,CASE WHEN n.n>=5 THEN N'Cần xác minh kinh nghiệm và hồ sơ trước khi tiếp nhận' END,1,
    TODATETIMEOFFSET(DATEADD(DAY,-2,@now),'+07:00'),CASE WHEN n.n<>4 THEN TODATETIMEOFFSET(DATEADD(DAY,-1,@now),'+07:00') END,
    CASE WHEN n.n>=5 THEN TODATETIMEOFFSET(@now,'+07:00') END FROM @numbers n WHERE n.n<=6;
 INSERT dbo.YeuCauPheDuyet(nguoiYeuCau,hanhDong,maDoiTuong,duLieuThayDoi,dauVanTayDuLieu,soTien,khoaLienKet,lyDo,mucDoRuiRo,thoiDiemYeuCau,thoiDiemHetHan)
 SELECT N'KITCHEN',N'Thay đổi giá dịch vụ',d.maDichVu,CONVERT(NVARCHAR(30),CONVERT(INT,d.gia+50000)),
    CONVERT(VARCHAR(64),HASHBYTES('SHA2_256',CONVERT(NVARCHAR(30),CONVERT(INT,d.gia+50000))),2),d.gia+50000,CONCAT(N'OPS-PRICE-',d.maDichVu),
    N'OPS-DEMO: đề xuất giá phục vụ mùa cao điểm',N'Trung bình',TODATETIMEOFFSET(@now,'+07:00'),TODATETIMEOFFSET(DATEADD(DAY,7,@now),'+07:00')
 FROM dbo.DichVu d WHERE d.maDichVu IN(N'BREAKFAST',N'LNDRYSTD',N'SPAFACIAL');

 -- Kiểm tra dữ liệu vừa tạo trước COMMIT; lỗi ở bất kỳ phần nào rollback toàn bộ.
 IF (SELECT COUNT(*) FROM @stays)<>238 THROW 51001,N'Chưa đủ kịch bản lưu trú.',1;
 IF EXISTS(SELECT 1 FROM @stays s JOIN dbo.HoaDon h ON h.maHoaDon=s.invoice
    WHERE ABS(h.soTienPhaiTra-dbo.fnTinhSoDuHoaDon(h.maHoaDon))>0.01)
    THROW 51002,N'Số dư hóa đơn không khớp sổ thanh toán.',1;
 IF EXISTS(SELECT 1 FROM dbo.ChiTietDatPhong a JOIN dbo.ChiTietDatPhong b ON a.maPhong=b.maPhong AND a.maPhieuDatPhong<b.maPhieuDatPhong
    WHERE (EXISTS(SELECT 1 FROM @stays s WHERE s.id=a.maPhieuDatPhong) OR EXISTS(SELECT 1 FROM @stays s WHERE s.id=b.maPhieuDatPhong))
    AND a.trangThai IN(N'Đã giữ phòng',N'Giữ tạm phòng',N'Đang có khách') AND b.trangThai IN(N'Đã giữ phòng',N'Giữ tạm phòng',N'Đang có khách')
    AND a.thoiDiemNhanPhong<b.thoiDiemTraPhong AND b.thoiDiemNhanPhong<a.thoiDiemTraPhong)
    THROW 51003,N'Có đặt phòng chồng lịch.',1;
 IF EXISTS(SELECT 1 FROM dbo.BanGiaoTienCa b OUTER APPLY(SELECT SUM(c.menhGia*c.soLuong) total FROM dbo.ChiTietTienBanGiao c WHERE c.maBanGiaoTienCa=b.maBanGiaoTienCa) cash
    WHERE b.ghiChu LIKE N'OPS-DEMO:%' AND ABS(b.soTienThucTe-COALESCE(cash.total,0))>0.01)
    THROW 51004,N'Mệnh giá kiểm đếm không khớp tiền bàn giao.',1;
 INSERT dbo.NhatKyKiemSoat(nguoiThucHien,hanhDong,loaiDoiTuong,maDoiTuong,duLieuSau,lyDo,khoaLienKet)
 VALUES(N'DEMO_SEED',N'OPERATING_DEMO_POPULATED',N'DEMO_DATA',N'OPERATING-DEMO-V1',
    N'80 guests; 24 employees; 238 reservations; linked invoices, payments, stock, housekeeping, technical and HR',
    N'Chủ repo yêu cầu bổ sung dữ liệu hệ thống đang hoạt động',N'OPERATING-DEMO-V1-COMPLETE');
 COMMIT;
 SELECT kind AS Scenario,COUNT(*) AS Reservations FROM @stays GROUP BY kind;
 PRINT N'Đã bổ sung dữ liệu hoạt động; giữ nguyên các hồ sơ có sẵn.';
END TRY
BEGIN CATCH
 IF @@TRANCOUNT>0 ROLLBACK;
 THROW;
END CATCH;
