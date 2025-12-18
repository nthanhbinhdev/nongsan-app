-- TRÊN INSTANCE SERVER (Publisher)
-- LƯU Ý: NẾU ĐÃ CÓ DB CŨ, HÃY DROP DATABASE CŨ TRƯỚC KHI CHẠY
-- USE master; DROP DATABASE NongSan_Master;

CREATE DATABASE NongSan_Master;
GO

USE NongSan_Master;
GO

-- ==================== TẠO BẢNG (STRUCTURED DATA ONLY) ====================

-- 1. Bảng ChiNhanh (Giữ lại thông tin địa lý để phân tán)
CREATE TABLE ChiNhanh (
    MaChiNhanh INT IDENTITY(1,1) PRIMARY KEY,
    TenChiNhanh NVARCHAR(100) NOT NULL,
    DiaChi NVARCHAR(255),
    VungMien NVARCHAR(50) NOT NULL, -- Key để phân mảnh ngang
    SoDienThoai VARCHAR(15),
    Email VARCHAR(100),
    NguoiQuanLy NVARCHAR(100),
    TrangThai BIT DEFAULT 1
);
GO

-- 2. Bảng DanhMuc
CREATE TABLE DanhMuc (
    MaDanhMuc INT IDENTITY(1,1) PRIMARY KEY,
    TenDanhMuc NVARCHAR(100) NOT NULL,
    MoTa NVARCHAR(255),
    LoaiDanhMuc NVARCHAR(50),
    TrangThai BIT DEFAULT 1
);
GO

-- 3. Bảng NhaCungCap
CREATE TABLE NhaCungCap (
    MaNhaCungCap INT IDENTITY(1,1) PRIMARY KEY,
    TenNhaCungCap NVARCHAR(150) NOT NULL,
    DiaChi NVARCHAR(255),
    SoDienThoai VARCHAR(15),
    Email VARCHAR(100),
    VungMien NVARCHAR(50),
    LoaiDoiTac NVARCHAR(50),
    TrangThai BIT DEFAULT 1
);
GO

-- 4. Bảng KhachHang
CREATE TABLE KhachHang (
    MaKhachHang INT IDENTITY(1,1) PRIMARY KEY,
    TenKhachHang NVARCHAR(150) NOT NULL,
    Email VARCHAR(100),
    SoDienThoai VARCHAR(15),
    DiaChi NVARCHAR(500),
    MaChiNhanhGanNhat INT,
    VungMien NVARCHAR(50),
    LoaiKhachHang NVARCHAR(50) DEFAULT N'Thường',
    NgayDangKy DATETIME DEFAULT GETDATE(),
    DiemTichLuy INT DEFAULT 0,
    FOREIGN KEY (MaChiNhanhGanNhat) REFERENCES ChiNhanh(MaChiNhanh)
);
GO

-- 5. Bảng HangHoa (Bảng trung tâm liên kết với MongoDB qua MaHangHoa)
CREATE TABLE HangHoa (
    MaHangHoa INT IDENTITY(1,1) PRIMARY KEY, -- ID này sẽ dùng để link sang MongoDB
    TenHangHoa NVARCHAR(150) NOT NULL,
    MaDanhMuc INT NOT NULL,
    MaNhaCungCap INT,
    VungMien NVARCHAR(50),
    DonViTinh NVARCHAR(20),
    DonGiaNhap DECIMAL(18,2),
    DonGiaBan DECIMAL(18,2),
    SoLuongTon INT DEFAULT 0,
    HanSuDung DATE,
    TrangThai BIT DEFAULT 1,
    FOREIGN KEY (MaDanhMuc) REFERENCES DanhMuc(MaDanhMuc),
    FOREIGN KEY (MaNhaCungCap) REFERENCES NhaCungCap(MaNhaCungCap)
);
GO

-- 6. Bảng DonHang
CREATE TABLE DonHang (
    MaDonHang UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    MaKhachHang INT NOT NULL,
    MaChiNhanhXuLy INT,
    VungMien NVARCHAR(50),
    NgayDatHang DATETIME DEFAULT GETDATE(),
    TongTien DECIMAL(18,2),
    TrangThaiDonHang NVARCHAR(50) DEFAULT N'Chờ xử lý',
    PhuongThucThanhToan NVARCHAR(50),
    FOREIGN KEY (MaKhachHang) REFERENCES KhachHang(MaKhachHang),
    FOREIGN KEY (MaChiNhanhXuLy) REFERENCES ChiNhanh(MaChiNhanh)
);
GO

-- 7. Bảng ChiTietDonHang
CREATE TABLE ChiTietDonHang (
    MaChiTietDonHang INT IDENTITY(1,1) PRIMARY KEY,
    MaDonHang UNIQUEIDENTIFIER NOT NULL,
    MaHangHoa INT NOT NULL,
    SoLuong INT NOT NULL,
    DonGia DECIMAL(18,2) NOT NULL,
    ThanhTien DECIMAL(18,2) NOT NULL,
    FOREIGN KEY (MaDonHang) REFERENCES DonHang(MaDonHang),
    FOREIGN KEY (MaHangHoa) REFERENCES HangHoa(MaHangHoa)
);
GO

-- 8. Bảng Kho
CREATE TABLE Kho (
    MaKho INT IDENTITY(1,1) PRIMARY KEY,
    MaChiNhanh INT NOT NULL,
    TenKho NVARCHAR(100) NOT NULL,
    DiaChiKho NVARCHAR(255),
    NguoiQuanLy NVARCHAR(100),
    SucChua INT,
    TrangThai BIT DEFAULT 1,
    FOREIGN KEY (MaChiNhanh) REFERENCES ChiNhanh(MaChiNhanh)
);
GO

-- 9. Bảng TonKho
CREATE TABLE TonKho (
    MaTonKho INT IDENTITY(1,1) PRIMARY KEY,
    MaKho INT NOT NULL,
    MaHangHoa INT NOT NULL,
    MaChiNhanh INT,
    SoLuongTon INT DEFAULT 0,
    NgayCapNhat DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (MaKho) REFERENCES Kho(MaKho),
    FOREIGN KEY (MaHangHoa) REFERENCES HangHoa(MaHangHoa),
    FOREIGN KEY (MaChiNhanh) REFERENCES ChiNhanh(MaChiNhanh)
);
GO

-- ==================== INSERT DỮ LIỆU MẪU (ĐÃ LÀM SẠCH JSON) ====================

-- 1. Chèn ChiNhanh
INSERT INTO ChiNhanh (TenChiNhanh, DiaChi, VungMien, SoDienThoai, Email)
VALUES 
(N'Chi nhánh Miền Bắc - Hà Nội', N'123 Trần Duy Hưng, Hà Nội', 'MienBac', '0241234567', 'hn@nongsan.vn'),
(N'Chi nhánh Miền Trung - Đà Nẵng', N'456 Nguyễn Văn Linh, Đà Nẵng', 'MienTrung', '0236123456', 'dn@nongsan.vn'),
(N'Chi nhánh Miền Nam - TP.HCM', N'789 Lê Văn Việt, TP.HCM', 'MienNam', '0289876543', 'hcm@nongsan.vn');
GO

-- 2. Chèn DanhMuc
INSERT INTO DanhMuc (TenDanhMuc, MoTa, LoaiDanhMuc)
VALUES
(N'Rau củ quả', N'Các loại rau, củ, quả tươi sống', 'RauCu'),
(N'Trái cây', N'Trái cây theo mùa, đặc sản vùng miền', 'TraiCay'),
(N'Ngũ cốc', N'Gạo, đậu, ngô, lúa mì các loại', 'NguCoc'),
(N'Thực phẩm chế biến', N'Nông sản đã qua chế biến', 'CheBien');
GO

-- 3. Chèn NhaCungCap
INSERT INTO NhaCungCap (TenNhaCungCap, DiaChi, VungMien, LoaiDoiTac)
VALUES
(N'Nông trại Hữu cơ Việt', N'Lâm Đồng', 'MienNam', 'HopTacXa'),
(N'Hợp tác xã Nông sản Sạch', N'Hà Nội', 'MienBac', 'HopTacXa'),
(N'Trang trại Trái cây Miền Tây', N'Cần Thơ', 'MienNam', 'NongDan');
GO

-- 4. Chèn HangHoa (Dữ liệu cốt lõi, phần mô tả chi tiết sẽ nằm bên MongoDB)
INSERT INTO HangHoa (TenHangHoa, MaDanhMuc, MaNhaCungCap, VungMien, DonViTinh, DonGiaNhap, DonGiaBan, SoLuongTon)
VALUES
-- Miền Bắc
(N'Rau muống sạch', 1, 2, 'MienBac', N'Bó', 5000, 8000, 50),
(N'Su hào trắng', 1, 2, 'MienBac', N'Kg', 7000, 12000, 30),
(N'Cam Cao Phong', 2, 2, 'MienBac', N'Kg', 25000, 35000, 20),

-- Miền Trung
(N'Chuối Laba', 2, 1, 'MienTrung', N'Nải', 15000, 25000, 40),
(N'Bưởi da xanh', 2, 1, 'MienTrung', N'Quả', 40000, 60000, 15),
(N'Rau cải xoong', 1, 1, 'MienTrung', N'Bó', 8000, 13000, 25),

-- Miền Nam
(N'Gạo ST25', 3, 3, 'MienNam', N'Kg', 20000, 28000, 100),
(N'Xoài cát Hòa Lộc', 2, 3, 'MienNam', N'Kg', 30000, 45000, 35),
(N'Dừa xiêm Bến Tre', 2, 3, 'MienNam', N'Quả', 15000, 22000, 60),
(N'Khoai lang mật', 1, 3, 'MienNam', N'Kg', 12000, 18000, 45),
(N'Sầu riêng Monthong', 2, 3, 'MienNam', N'Kg', 80000, 120000, 12),
(N'Chôm chôm nhãn', 2, 3, 'MienNam', N'Kg', 35000, 50000, 28);
GO

-- 5. Chèn KhachHang
INSERT INTO KhachHang (TenKhachHang, Email, SoDienThoai, DiaChi, MaChiNhanhGanNhat, VungMien)
VALUES
(N'Nguyễn Văn An', 'an.nguyen@gmail.com', '0912345678', N'Hà Nội', 1, 'MienBac'),
(N'Trần Thị Bình', 'binh.tran@gmail.com', '0923456789', N'Đà Nẵng', 2, 'MienTrung'),
(N'Lê Văn Cường', 'cuong.le@gmail.com', '0934567890', N'TP.HCM', 3, 'MienNam'),
-- Khách thêm
(N'Nguyễn Thị Hà', 'ha.nguyen@gmail.com', '0911111111', N'Ba Đình, Hà Nội', 1, 'MienBac'),
(N'Trần Văn Nam', 'nam.tran@gmail.com', '0922222222', N'Cầu Giấy, Hà Nội', 1, 'MienBac'),
(N'Phạm Thu Hường', 'huong.pham@gmail.com', '0933333333', N'Hai Bà Trưng, Hà Nội', 1, 'MienBac'),
(N'Lê Văn Tùng', 'tung.le@gmail.com', '0944444444', N'Hải Châu, Đà Nẵng', 2, 'MienTrung'),
(N'Hoàng Thị Lan', 'lan.hoang@gmail.com', '0955555555', N'Thanh Khê, Đà Nẵng', 2, 'MienTrung'),
(N'Võ Minh Anh', 'anh.vo@gmail.com', '0966666666', N'Sơn Trà, Đà Nẵng', 2, 'MienTrung'),
(N'Đặng Văn Hải', 'hai.dang@gmail.com', '0977777777', N'Quận 1, TP.HCM', 3, 'MienNam'),
(N'Bùi Thị Mai', 'mai.bui@gmail.com', '0988888888', N'Quận 3, TP.HCM', 3, 'MienNam'),
(N'Ngô Văn Cường', 'cuong.ngo@gmail.com', '0999999999', N'Quận 7, TP.HCM', 3, 'MienNam');
GO

-- 6. Chèn Kho
INSERT INTO Kho (MaChiNhanh, TenKho, DiaChiKho, SucChua)
VALUES
(1, N'Kho Hà Nội - Chính', N'123 Trần Duy Hưng, Hà Nội', 5000),
(2, N'Kho Đà Nẵng - Chính', N'456 Nguyễn Văn Linh, Đà Nẵng', 4000),
(3, N'Kho TP.HCM - Chính', N'789 Lê Văn Việt, TP.HCM', 6000);
GO

-- 7. Chèn TonKho
INSERT INTO TonKho (MaKho, MaHangHoa, MaChiNhanh, SoLuongTon)
VALUES
(1, 1, 1, 50), (1, 2, 1, 30), (1, 3, 1, 20),
(2, 4, 2, 40), (2, 5, 2, 15), (2, 6, 2, 25),
(3, 7, 3, 100), (3, 8, 3, 35), (3, 9, 3, 60), (3, 10, 3, 45), (3, 11, 3, 12), (3, 12, 3, 28);
GO

-- 8. Chèn DonHang (Giữ nguyên logic giao dịch)
INSERT INTO DonHang (MaDonHang, MaKhachHang, MaChiNhanhXuLy, VungMien, TongTien, TrangThaiDonHang)
VALUES
(NEWID(), 1, 1, 'MienBac', 150000, N'Đã giao'),
(NEWID(), 2, 1, 'MienBac', 230000, N'Đang xử lý'),
(NEWID(), 3, 1, 'MienBac', 180000, N'Đã giao'),
(NEWID(), 4, 2, 'MienTrung', 320000, N'Đã giao'),
(NEWID(), 5, 2, 'MienTrung', 275000, N'Đang xử lý'),
(NEWID(), 6, 2, 'MienTrung', 190000, N'Đã giao'),
(NEWID(), 7, 3, 'MienNam', 420000, N'Đã giao'),
(NEWID(), 8, 3, 'MienNam', 310000, N'Đang xử lý'),
(NEWID(), 9, 3, 'MienNam', 280000, N'Đã giao');
GO

-- 9. Chèn ChiTietDonHang
-- (Do dùng NEWID() nên phần này cần lấy lại ID động, đoạn code cũ của bạn vẫn ổn nhưng để chạy 1 lần từ đầu thì cần khai báo lại biến)
DECLARE @DonHangMB1 UNIQUEIDENTIFIER, @DonHangMB2 UNIQUEIDENTIFIER, @DonHangMB3 UNIQUEIDENTIFIER;
DECLARE @DonHangMT1 UNIQUEIDENTIFIER, @DonHangMT2 UNIQUEIDENTIFIER, @DonHangMT3 UNIQUEIDENTIFIER;
DECLARE @DonHangMN1 UNIQUEIDENTIFIER, @DonHangMN2 UNIQUEIDENTIFIER, @DonHangMN3 UNIQUEIDENTIFIER;

-- Lấy ID đơn hàng dựa vào Khách Hàng (giả định mỗi khách 1 đơn để demo)
SELECT TOP 1 @DonHangMB1 = MaDonHang FROM DonHang WHERE MaKhachHang = 1;
SELECT TOP 1 @DonHangMB2 = MaDonHang FROM DonHang WHERE MaKhachHang = 2;
SELECT TOP 1 @DonHangMB3 = MaDonHang FROM DonHang WHERE MaKhachHang = 3;

SELECT TOP 1 @DonHangMT1 = MaDonHang FROM DonHang WHERE MaKhachHang = 4;
SELECT TOP 1 @DonHangMT2 = MaDonHang FROM DonHang WHERE MaKhachHang = 5;
SELECT TOP 1 @DonHangMT3 = MaDonHang FROM DonHang WHERE MaKhachHang = 6;

SELECT TOP 1 @DonHangMN1 = MaDonHang FROM DonHang WHERE MaKhachHang = 7;
SELECT TOP 1 @DonHangMN2 = MaDonHang FROM DonHang WHERE MaKhachHang = 8;
SELECT TOP 1 @DonHangMN3 = MaDonHang FROM DonHang WHERE MaKhachHang = 9;

INSERT INTO ChiTietDonHang (MaDonHang, MaHangHoa, SoLuong, DonGia, ThanhTien)
VALUES
(@DonHangMB1, 1, 2, 8000, 16000),  
(@DonHangMB1, 3, 3, 35000, 105000), 
(@DonHangMB2, 2, 5, 12000, 60000),  
(@DonHangMB2, 1, 4, 8000, 32000),   
(@DonHangMB3, 3, 2, 35000, 70000), 

(@DonHangMT1, 4, 3, 25000, 75000),  
(@DonHangMT1, 5, 2, 60000, 120000), 
(@DonHangMT2, 6, 4, 13000, 52000),  
(@DonHangMT3, 4, 5, 25000, 125000), 

(@DonHangMN1, 8, 3, 45000, 135000), 
(@DonHangMN1, 9, 2, 22000, 44000),  
(@DonHangMN2, 7, 5, 28000, 140000), 
(@DonHangMN3, 10, 4, 18000, 72000);
GO

-- Cập nhật tổng tiền chuẩn xác
UPDATE DonHang 
SET TongTien = (
    SELECT SUM(ThanhTien) 
    FROM ChiTietDonHang 
    WHERE ChiTietDonHang.MaDonHang = DonHang.MaDonHang
)
WHERE TongTien IS NULL OR TongTien = 0;
GO