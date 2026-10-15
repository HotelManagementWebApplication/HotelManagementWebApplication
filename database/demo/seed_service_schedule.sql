-- Manual demo configuration. Keep existing configuration and custom prices.
-- Price units in DichVu (hour/day/etc.) stay unchanged.
SET NOCOUNT ON;
SET XACT_ABORT ON;
BEGIN TRANSACTION;
INSERT dbo.CauHinhLichDichVu(maDichVu,congSuat,donViKhaDung,soPhutMoiLuot,cachTinh)
SELECT s.id,s.capacity,s.unit,s.minutes,s.mode
FROM (VALUES
    (N'BADMINTON',2,N'sân',60,N'Theo thời lượng'),
    (N'TENNIS',2,N'sân',60,N'Theo thời lượng'),
    (N'PINGPONG',2,N'bàn',60,N'Theo thời lượng'),
    (N'MEETING',2,N'phòng',1440,N'Theo thời lượng'),
    (N'BOARDROOM',1,N'phòng',1440,N'Theo thời lượng'),
    (N'CITYTOUR',20,N'suất',240,N'Theo lượt'),
    (N'LIMO',3,N'xe',120,N'Theo lượt'),
    (N'BREAKFAST',40,N'suất',60,N'Theo lượt'),
    (N'MAMREST',60,N'suất',120,N'Theo lượt'),
    (N'SPAMASS',6,N'suất',60,N'Theo lượt'),
    (N'SPAFACIAL',4,N'suất',75,N'Theo lượt'),
    (N'STEAM',8,N'suất',60,N'Theo lượt'),
    (N'POOL',32,N'suất',1440,N'Theo ngày'),
    (N'GYM',20,N'suất',1440,N'Theo ngày'),
    (N'EXTRABED',12,N'giường',1440,N'Theo kỳ lưu trú'),
    (N'LNDRYEXP',18,N'món',240,N'Theo lượt'),
    (N'LNDRYSTD',24,N'lượt',1440,N'Qua đêm'),
    (N'PRESSING',15,N'món',60,N'Theo lượt'),
    (N'DECOR',8,N'bộ',120,N'Theo lượt'),
    (N'MINIBAR',36,N'bộ',60,N'Theo tồn kho')
) s(id,capacity,unit,minutes,mode)
JOIN dbo.DichVu d ON d.maDichVu=s.id
WHERE NOT EXISTS (SELECT 1 FROM dbo.CauHinhLichDichVu WITH(UPDLOCK,HOLDLOCK) WHERE maDichVu=s.id);

-- Existing housekeeping fixtures have no price; add demo unit prices only
-- where still zero, preserving any price users have already entered.
UPDATE d SET gia=p.price
FROM dbo.DichVu d JOIN (VALUES
    (N'DENTALKIT',12000),(N'COMBONE',5000),(N'TOWELRST',120000),
    (N'SOAPBAR',8000),(N'SHAMPOO',15000),(N'BODYWASH',15000),
    (N'SHWRCAP',3000),(N'VANITYKIT',7000)
) p(id,price) ON p.id=d.maDichVu WHERE d.gia=0;
COMMIT TRANSACTION;
