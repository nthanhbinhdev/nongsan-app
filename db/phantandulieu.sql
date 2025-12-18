-- ============================================================================
-- SCRIPT DÀNH RIÊNG CHO MÁY DESKTOP-1RUUANR
-- Path: D:\ReplicationData
-- ============================================================================

USE master;
GO

-- 1. Xử lý cái Distribution DB cứng đầu trước
IF EXISTS (SELECT name FROM sys.databases WHERE name = N'distribution')
BEGIN
    -- Dòng này sẽ kill hết connection đang kết nối vào distribution
    ALTER DATABASE [distribution] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    
    -- Sau đó mới drop
    EXEC sp_dropdistributor @no_checks = 1, @ignore_distributor = 1;
END

-- =============================================================
-- 0. CẤU HÌNH BIẾN MÔI TRƯỜNG (KIỂM TRA KỸ PASSWORD Ở ĐÂY)
-- =============================================================
DECLARE @ServerName NVARCHAR(100) = N'DESKTOP-1RUUANR\SERVER'; -- Server Gốc
DECLARE @Client1 NVARCHAR(100) = N'DESKTOP-1RUUANR\CLIENT1';   -- Client Miền Bắc
DECLARE @Client2 NVARCHAR(100) = N'DESKTOP-1RUUANR\CLIENT2';   -- Client Miền Trung (Dự đoán)
DECLARE @Client3 NVARCHAR(100) = N'DESKTOP-1RUUANR\CLIENT3';   -- Client Miền Nam (Dự đoán)

DECLARE @ThuMucVatLy NVARCHAR(255) = N'D:\ReplicationData';   -- Ổ D theo yêu cầu
DECLARE @DuongDanMang NVARCHAR(255) = N'\\DESKTOP-1RUUANR\ReplicationData'; -- Folder Share
DECLARE @PassDB NVARCHAR(50) = N'123456'; -- <--- SỬA PASS NẾU KHÁC

-- =============================================================
-- PHẦN 1: DỌN DẸP SẠCH SẼ (CLEAN UP - NUCLEAR OPTION)
-- =============================================================
PRINT '>>> B1. DANG DON DEP HE THONG CU...';

-- Xóa Linked Server cũ
IF EXISTS (SELECT srvname FROM sys.sysservers WHERE srvname = 'LINK_MIENBAC') EXEC sp_dropserver 'LINK_MIENBAC', 'droplogins';
IF EXISTS (SELECT srvname FROM sys.sysservers WHERE srvname = 'LINK_MIENTRUNG') EXEC sp_dropserver 'LINK_MIENTRUNG', 'droplogins';
IF EXISTS (SELECT srvname FROM sys.sysservers WHERE srvname = 'LINK_MIENNAM') EXEC sp_dropserver 'LINK_MIENNAM', 'droplogins';

-- Xóa Replication trên Database
IF EXISTS (SELECT name FROM sys.databases WHERE name = 'NongSan_Master')
BEGIN
    USE NongSan_Master;
    EXEC sp_removedbreplication 'NongSan_Master';
END
GO

USE master;
-- Xóa Distributor cũ (Ép buộc xóa sạch sẽ)
IF EXISTS (SELECT * FROM sys.sysservers WHERE srvname = 'repl_distributor') 
    EXEC sp_dropdistributor @no_checks = 1, @ignore_distributor = 1;
GO

-- =============================================================
-- PHẦN 2: TẠO DISTRIBUTOR (TRỎ VÀO Ổ D)
-- =============================================================
PRINT '>>> B2. DANG CAU HINH DISTRIBUTOR (O D)...';

-- Khai báo lại biến (do GO ngắt batch)
DECLARE @ServerName NVARCHAR(100) = N'DESKTOP-1RUUANR\SERVER'; 
DECLARE @ThuMucVatLy NVARCHAR(255) = N'D:\ReplicationData'; 
DECLARE @DuongDanMang NVARCHAR(255) = N'\\DESKTOP-1RUUANR\ReplicationData';
DECLARE @PassDB NVARCHAR(50) = N'123456'; -- <--- SỬA PASS

-- Tạo Distributor
EXEC sp_adddistributor @distributor = @ServerName, @password = @PassDB;

-- Tạo Database Distribution
EXEC sp_adddistributiondb @database = N'distribution', 
    @data_folder = @ThuMucVatLy, 
    @log_folder = @ThuMucVatLy, 
    @security_mode = 1;

-- Đăng ký Publisher
EXEC sp_adddistpublisher @publisher = @ServerName, 
    @distribution_db = N'distribution', 
    @working_directory = @DuongDanMang, 
    @security_mode = 0, 
    @login = N'sa', 
    @password = @PassDB;
GO

-- =============================================================
-- PHẦN 3: TẠO PUBLICATION & FILTER
-- =============================================================
PRINT '>>> B3. DANG TAO PUBLICATION...';
USE NongSan_Master;
GO
EXEC sp_replicationdboption @dbname = N'NongSan_Master', @optname = N'publish', @value = N'true';
GO

DECLARE @PassDB NVARCHAR(50) = N'123456'; -- <--- SỬA PASS

-- --- MIỀN BẮC ---
EXEC sp_addpublication @publication = N'Pub_MienBac', @description = N'Data MB', @sync_method = N'concurrent', @status = N'active', @allow_push = N'true';
EXEC sp_addpublication_snapshot @publication = N'Pub_MienBac', @publisher_security_mode = 0, @publisher_login = N'sa', @publisher_password = @PassDB;

-- Thêm Articles cho Miền Bắc
EXEC sp_addarticle @publication = N'Pub_MienBac', @article = N'DonHang', @source_owner = N'dbo', @source_object = N'DonHang', @type = N'logbased';
EXEC sp_articlefilter @publication = N'Pub_MienBac', @article = N'DonHang', @filter_name = N'FLT_DonHang_MB', @filter_clause = N'VungMien = ''MienBac''';
EXEC sp_articleview @publication = N'Pub_MienBac', @article = N'DonHang', @view_name = N'VW_DonHang_MB', @filter_clause = N'VungMien = ''MienBac''';

EXEC sp_addarticle @publication = N'Pub_MienBac', @article = N'ChiTietDonHang', @source_owner = N'dbo', @source_object = N'ChiTietDonHang', @type = N'logbased';
EXEC sp_articlefilter @publication = N'Pub_MienBac', @article = N'ChiTietDonHang', @filter_name = N'FLT_CTDH_MB', @filter_clause = N'MaDonHang IN (SELECT MaDonHang FROM DonHang WHERE VungMien = ''MienBac'')';
EXEC sp_articleview @publication = N'Pub_MienBac', @article = N'ChiTietDonHang', @view_name = N'VW_CTDH_MB', @filter_clause = N'MaDonHang IN (SELECT MaDonHang FROM DonHang WHERE VungMien = ''MienBac'')';

EXEC sp_addarticle @publication = N'Pub_MienBac', @article = N'KhachHang', @source_owner = N'dbo', @source_object = N'KhachHang', @type = N'logbased';
EXEC sp_articlefilter @publication = N'Pub_MienBac', @article = N'KhachHang', @filter_name = N'FLT_KH_MB', @filter_clause = N'VungMien = ''MienBac''';
EXEC sp_articleview @publication = N'Pub_MienBac', @article = N'KhachHang', @view_name = N'VW_KH_MB', @filter_clause = N'VungMien = ''MienBac''';

-- Các bảng không lọc (Full data replication)
EXEC sp_addarticle @publication = N'Pub_MienBac', @article = N'HangHoa', @source_owner = N'dbo', @source_object = N'HangHoa', @type = N'logbased';
EXEC sp_addarticle @publication = N'Pub_MienBac', @article = N'DanhMuc', @source_owner = N'dbo', @source_object = N'DanhMuc', @type = N'logbased';
EXEC sp_addarticle @publication = N'Pub_MienBac', @article = N'ChiNhanh', @source_owner = N'dbo', @source_object = N'ChiNhanh', @type = N'logbased'; -- Thêm bảng Chi nhánh để link

-- --- MIỀN TRUNG ---
EXEC sp_addpublication @publication = N'Pub_MienTrung', @description = N'Data MT', @sync_method = N'concurrent', @status = N'active', @allow_push = N'true';
EXEC sp_addpublication_snapshot @publication = N'Pub_MienTrung', @publisher_security_mode = 0, @publisher_login = N'sa', @publisher_password = @PassDB;

EXEC sp_addarticle @publication = N'Pub_MienTrung', @article = N'DonHang', @source_owner = N'dbo', @source_object = N'DonHang', @type = N'logbased';
EXEC sp_articlefilter @publication = N'Pub_MienTrung', @article = N'DonHang', @filter_name = N'FLT_DonHang_MT', @filter_clause = N'VungMien = ''MienTrung''';
EXEC sp_articleview @publication = N'Pub_MienTrung', @article = N'DonHang', @view_name = N'VW_DonHang_MT', @filter_clause = N'VungMien = ''MienTrung''';

EXEC sp_addarticle @publication = N'Pub_MienTrung', @article = N'ChiTietDonHang', @source_owner = N'dbo', @source_object = N'ChiTietDonHang', @type = N'logbased';
EXEC sp_articlefilter @publication = N'Pub_MienTrung', @article = N'ChiTietDonHang', @filter_name = N'FLT_CTDH_MT', @filter_clause = N'MaDonHang IN (SELECT MaDonHang FROM DonHang WHERE VungMien = ''MienTrung'')';
EXEC sp_articleview @publication = N'Pub_MienTrung', @article = N'ChiTietDonHang', @view_name = N'VW_CTDH_MT', @filter_clause = N'MaDonHang IN (SELECT MaDonHang FROM DonHang WHERE VungMien = ''MienTrung'')';

EXEC sp_addarticle @publication = N'Pub_MienTrung', @article = N'KhachHang', @source_owner = N'dbo', @source_object = N'KhachHang', @type = N'logbased';
EXEC sp_articlefilter @publication = N'Pub_MienTrung', @article = N'KhachHang', @filter_name = N'FLT_KH_MT', @filter_clause = N'VungMien = ''MienTrung''';
EXEC sp_articleview @publication = N'Pub_MienTrung', @article = N'KhachHang', @view_name = N'VW_KH_MT', @filter_clause = N'VungMien = ''MienTrung''';

EXEC sp_addarticle @publication = N'Pub_MienTrung', @article = N'HangHoa', @source_owner = N'dbo', @source_object = N'HangHoa', @type = N'logbased';
EXEC sp_addarticle @publication = N'Pub_MienTrung', @article = N'DanhMuc', @source_owner = N'dbo', @source_object = N'DanhMuc', @type = N'logbased';
EXEC sp_addarticle @publication = N'Pub_MienTrung', @article = N'ChiNhanh', @source_owner = N'dbo', @source_object = N'ChiNhanh', @type = N'logbased';

-- --- MIỀN NAM ---
EXEC sp_addpublication @publication = N'Pub_MienNam', @description = N'Data MN', @sync_method = N'concurrent', @status = N'active', @allow_push = N'true';
EXEC sp_addpublication_snapshot @publication = N'Pub_MienNam', @publisher_security_mode = 0, @publisher_login = N'sa', @publisher_password = @PassDB;

EXEC sp_addarticle @publication = N'Pub_MienNam', @article = N'DonHang', @source_owner = N'dbo', @source_object = N'DonHang', @type = N'logbased';
EXEC sp_articlefilter @publication = N'Pub_MienNam', @article = N'DonHang', @filter_name = N'FLT_DonHang_MN', @filter_clause = N'VungMien = ''MienNam''';
EXEC sp_articleview @publication = N'Pub_MienNam', @article = N'DonHang', @view_name = N'VW_DonHang_MN', @filter_clause = N'VungMien = ''MienNam''';

EXEC sp_addarticle @publication = N'Pub_MienNam', @article = N'ChiTietDonHang', @source_owner = N'dbo', @source_object = N'ChiTietDonHang', @type = N'logbased';
EXEC sp_articlefilter @publication = N'Pub_MienNam', @article = N'ChiTietDonHang', @filter_name = N'FLT_CTDH_MN', @filter_clause = N'MaDonHang IN (SELECT MaDonHang FROM DonHang WHERE VungMien = ''MienNam'')';
EXEC sp_articleview @publication = N'Pub_MienNam', @article = N'ChiTietDonHang', @view_name = N'VW_CTDH_MN', @filter_clause = N'MaDonHang IN (SELECT MaDonHang FROM DonHang WHERE VungMien = ''MienNam'')';

EXEC sp_addarticle @publication = N'Pub_MienNam', @article = N'KhachHang', @source_owner = N'dbo', @source_object = N'KhachHang', @type = N'logbased';
EXEC sp_articlefilter @publication = N'Pub_MienNam', @article = N'KhachHang', @filter_name = N'FLT_KH_MN', @filter_clause = N'VungMien = ''MienNam''';
EXEC sp_articleview @publication = N'Pub_MienNam', @article = N'KhachHang', @view_name = N'VW_KH_MN', @filter_clause = N'VungMien = ''MienNam''';

EXEC sp_addarticle @publication = N'Pub_MienNam', @article = N'HangHoa', @source_owner = N'dbo', @source_object = N'HangHoa', @type = N'logbased';
EXEC sp_addarticle @publication = N'Pub_MienNam', @article = N'DanhMuc', @source_owner = N'dbo', @source_object = N'DanhMuc', @type = N'logbased';
EXEC sp_addarticle @publication = N'Pub_MienNam', @article = N'ChiNhanh', @source_owner = N'dbo', @source_object = N'ChiNhanh', @type = N'logbased';
GO

-- =============================================================
-- PHẦN 4: TẠO SUBSCRIPTION
-- =============================================================
PRINT '>>> B4. DANG DAY DU LIEU VE CLIENT (1, 2, 3)...';
DECLARE @PassDB NVARCHAR(50) = N'123456'; -- <--- SỬA PASS

-- Client 1: MIENBAC (NongSan_MienBac)
EXEC sp_addsubscription @publication = N'Pub_MienBac', @subscriber = N'DESKTOP-1RUUANR\CLIENT1', @destination_db = N'NongSan_MienBac', @subscription_type = N'Push', @sync_type = N'automatic';
EXEC sp_addpushsubscription_agent @publication = N'Pub_MienBac', @subscriber = N'DESKTOP-1RUUANR\CLIENT1', @subscriber_db = N'NongSan_MienBac', @subscriber_security_mode = 0, @subscriber_login = N'sa', @subscriber_password = @PassDB;

-- Client 2: MIENTRUNG (NongSan_MienTrung) - Giả định Client 2 là Miền Trung
EXEC sp_addsubscription @publication = N'Pub_MienTrung', @subscriber = N'DESKTOP-1RUUANR\CLIENT2', @destination_db = N'NongSan_MienTrung', @subscription_type = N'Push', @sync_type = N'automatic';
EXEC sp_addpushsubscription_agent @publication = N'Pub_MienTrung', @subscriber = N'DESKTOP-1RUUANR\CLIENT2', @subscriber_db = N'NongSan_MienTrung', @subscriber_security_mode = 0, @subscriber_login = N'sa', @subscriber_password = @PassDB;

-- Client 3: MIENNAM (NongSan_MienNam) - Giả định Client 3 là Miền Nam
EXEC sp_addsubscription @publication = N'Pub_MienNam', @subscriber = N'DESKTOP-1RUUANR\CLIENT3', @destination_db = N'NongSan_MienNam', @subscription_type = N'Push', @sync_type = N'automatic';
EXEC sp_addpushsubscription_agent @publication = N'Pub_MienNam', @subscriber = N'DESKTOP-1RUUANR\CLIENT3', @subscriber_db = N'NongSan_MienNam', @subscriber_security_mode = 0, @subscriber_login = N'sa', @subscriber_password = @PassDB;
GO

-- =============================================================
-- PHẦN 5: KÍCH HOẠT ĐỒNG BỘ
-- =============================================================
PRINT '>>> B5. DANG CHAY SNAPSHOT...';
EXEC sp_startpublication_snapshot @publication = N'Pub_MienBac';
EXEC sp_startpublication_snapshot @publication = N'Pub_MienTrung';
EXEC sp_startpublication_snapshot @publication = N'Pub_MienNam';
GO

-- =============================================================
-- PHẦN 6: TẠO LINKED SERVER (CẬP NHẬT CHO CLIENT 1,2,3)
-- =============================================================
PRINT '>>> B6. TAO LINKED SERVER...';
USE master;
GO
DECLARE @Client1 NVARCHAR(100) = N'DESKTOP-1RUUANR\CLIENT1';
DECLARE @Client2 NVARCHAR(100) = N'DESKTOP-1RUUANR\CLIENT2';
DECLARE @Client3 NVARCHAR(100) = N'DESKTOP-1RUUANR\CLIENT3';
DECLARE @User NVARCHAR(50) = N'sa';
DECLARE @Pass NVARCHAR(50) = N'123456'; -- <--- SỬA PASS

-- Link MIEN BAC
IF EXISTS (SELECT srvname FROM sys.sysservers WHERE srvname = 'LINK_MIENBAC') EXEC sp_dropserver 'LINK_MIENBAC', 'droplogins';
EXEC sp_addlinkedserver @server = N'LINK_MIENBAC', @srvproduct=N'', @provider=N'SQLNCLI', @datasrc=@Client1;
EXEC sp_addlinkedsrvlogin @rmtsrvname=N'LINK_MIENBAC', @useself=N'False', @locallogin=NULL, @rmtuser=@User, @rmtpassword=@Pass;

-- Link MIEN TRUNG
IF EXISTS (SELECT srvname FROM sys.sysservers WHERE srvname = 'LINK_MIENTRUNG') EXEC sp_dropserver 'LINK_MIENTRUNG', 'droplogins';
EXEC sp_addlinkedserver @server = N'LINK_MIENTRUNG', @srvproduct=N'', @provider=N'SQLNCLI', @datasrc=@Client2;
EXEC sp_addlinkedsrvlogin @rmtsrvname=N'LINK_MIENTRUNG', @useself=N'False', @locallogin=NULL, @rmtuser=@User, @rmtpassword=@Pass;

-- Link MIEN NAM
IF EXISTS (SELECT srvname FROM sys.sysservers WHERE srvname = 'LINK_MIENNAM') EXEC sp_dropserver 'LINK_MIENNAM', 'droplogins';
EXEC sp_addlinkedserver @server = N'LINK_MIENNAM', @srvproduct=N'', @provider=N'SQLNCLI', @datasrc=@Client3;
EXEC sp_addlinkedsrvlogin @rmtsrvname=N'LINK_MIENNAM', @useself=N'False', @locallogin=NULL, @rmtuser=@User, @rmtpassword=@Pass;

-- Bật quyền truy xuất dữ liệu
EXEC sp_serveroption @server = @Client1, @optname = 'DATA ACCESS', @optvalue = 'TRUE';
EXEC sp_serveroption @server = @Client2, @optname = 'DATA ACCESS', @optvalue = 'TRUE';
EXEC sp_serveroption @server = @Client3, @optname = 'DATA ACCESS', @optvalue = 'TRUE';

PRINT '>>> DONE! HE THONG DA DUOC RESET TOAN DIEN. HAY KIEM TRA JOB!';
GO