const express = require("express");
const sql = require("mssql");
const { MongoClient, ObjectId } = require("mongodb");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const multer = require("multer");
const cors = require("cors");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================
// MIDDLEWARE
// ============================================================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

// ============================================================
// DATABASE CONFIGURATION
// ============================================================
const sqlConfig = {
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  server: process.env.SQL_SERVER,
  database: process.env.SQL_DATABASE,
  options: {
    encrypt: false,
    trustServerCertificate: true,
    instanceName: process.env.SQL_INSTANCE,
  },
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
};

const mongoUrl = process.env.MONGO_URL;
const mongoDbName = process.env.MONGO_DB;
let mongoClient, mongoDB, sqlPool;

// Cloudinary Configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "nongsan-images",
    allowed_formats: ["jpg", "png", "jpeg", "webp"],
    transformation: [{ width: 800, height: 800, crop: "limit" }],
  },
});
const upload = multer({ storage: storage });

async function initializeDatabases() {
  try {
    console.log("Đang kết nối đến các database...");
    sqlPool = await sql.connect(sqlConfig);
    console.log("Kết nối SQL Server thành công!");

    mongoClient = new MongoClient(mongoUrl);
    await mongoClient.connect();
    mongoDB = mongoClient.db(mongoDbName);
    console.log("Kết nối MongoDB thành công!");
    console.log("Hệ thống sẵn sàng!\n");
  } catch (error) {
    console.error("Lỗi kết nối database:", error.message);
    process.exit(1);
  }
}

// GET: Lấy danh sách sản phẩm (có sort)
app.get("/api/products", async (req, res) => {
  try {
    const {
      vungmien,
      search,
      limit = 100,
      sortBy = "MaHangHoa",
      sortOrder = "DESC",
    } = req.query;

    const allowedSortColumns = [
      "MaHangHoa",
      "TenHangHoa",
      "DonGiaBan",
      "SoLuongTon",
      "VungMien",
    ];
    const orderBy = allowedSortColumns.includes(sortBy) ? sortBy : "MaHangHoa";
    const order = sortOrder.toUpperCase() === "ASC" ? "ASC" : "DESC";

    let query = `
      SELECT h.*, d.TenDanhMuc, ncc.TenNhaCungCap
      FROM HangHoa h
      LEFT JOIN DanhMuc d ON h.MaDanhMuc = d.MaDanhMuc
      LEFT JOIN NhaCungCap ncc ON h.MaNhaCungCap = ncc.MaNhaCungCap
      WHERE h.TrangThai = 1
    `;

    if (vungmien) query += ` AND h.VungMien = '${vungmien}'`;
    if (search) query += ` AND h.TenHangHoa LIKE N'%${search}%'`;
    query += ` ORDER BY h.${orderBy} ${order}`;
    query += ` OFFSET 0 ROWS FETCH NEXT ${limit} ROWS ONLY`;

    const result = await sqlPool.request().query(query);
    res.json({
      success: true,
      count: result.recordset.length,
      data: result.recordset,
    });
  } catch (error) {
    console.error("Lỗi GET /api/products:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy danh sách sản phẩm",
      error: error.message,
    });
  }
});

// GET: Lấy chi tiết sản phẩm (POLYGLOT PERSISTENCE)
app.get("/api/product/:id", async (req, res) => {
  try {
    const maHangHoa = parseInt(req.params.id);
    if (isNaN(maHangHoa)) {
      return res
        .status(400)
        .json({ success: false, message: "ID không hợp lệ" });
    }

    const sqlResult = await sqlPool
      .request()
      .input("MaHangHoa", sql.Int, maHangHoa).query(`
      SELECT h.*, d.TenDanhMuc, d.LoaiDanhMuc, ncc.TenNhaCungCap, ncc.DiaChi as DiaChiNCC, ncc.SoDienThoai as SDTNCC
      FROM HangHoa h
      LEFT JOIN DanhMuc d ON h.MaDanhMuc = d.MaDanhMuc
      LEFT JOIN NhaCungCap ncc ON h.MaNhaCungCap = ncc.MaNhaCungCap
      WHERE h.MaHangHoa = @MaHangHoa
    `);

    if (sqlResult.recordset.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy sản phẩm" });
    }

    const sqlData = sqlResult.recordset[0];
    const mongoData = await mongoDB
      .collection("hanghoa_details")
      .findOne({ MaHangHoa: maHangHoa });

    const fullProduct = {
      ...sqlData,
      MoTaChiTiet: mongoData?.MoTaChiTiet || "",
      ThongTinMoRong: mongoData?.ThongTinMoRong || {},
      DanhGia: mongoData?.DanhGia || [],
      HinhAnh: mongoData?.HinhAnh || [],
    };

    res.json({ success: true, data: fullProduct });
  } catch (error) {
    console.error("Lỗi GET /api/product/:id:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy chi tiết sản phẩm",
      error: error.message,
    });
  }
});

// POST: Thêm sản phẩm mới (có upload ảnh)
app.post("/api/product", upload.single("image"), async (req, res) => {
  try {
    const {
      TenHangHoa,
      MaDanhMuc,
      MaNhaCungCap,
      VungMien,
      DonViTinh,
      DonGiaNhap,
      DonGiaBan,
      SoLuongTon,
      HanSuDung,
      MoTaChiTiet,
    } = req.body;

    // Insert vào SQL Server
    const result = await sqlPool
      .request()
      .input("TenHangHoa", sql.NVarChar, TenHangHoa)
      .input("MaDanhMuc", sql.Int, MaDanhMuc)
      .input("MaNhaCungCap", sql.Int, MaNhaCungCap || null)
      .input("VungMien", sql.NVarChar, VungMien)
      .input("DonViTinh", sql.NVarChar, DonViTinh)
      .input("DonGiaNhap", sql.Decimal(18, 2), DonGiaNhap || 0)
      .input("DonGiaBan", sql.Decimal(18, 2), DonGiaBan)
      .input("SoLuongTon", sql.Int, SoLuongTon || 0)
      .input("HanSuDung", sql.Date, HanSuDung || null).query(`
        INSERT INTO HangHoa (TenHangHoa, MaDanhMuc, MaNhaCungCap, VungMien, DonViTinh, DonGiaNhap, DonGiaBan, SoLuongTon, HanSuDung)
        OUTPUT INSERTED.MaHangHoa
        VALUES (@TenHangHoa, @MaDanhMuc, @MaNhaCungCap, @VungMien, @DonViTinh, @DonGiaNhap, @DonGiaBan, @SoLuongTon, @HanSuDung)
      `);

    const newId = result.recordset[0].MaHangHoa;

    // Lưu ảnh vào MongoDB nếu có
    const imageUrl = req.file ? req.file.path : null;
    await mongoDB.collection("hanghoa_details").insertOne({
      MaHangHoa: newId,
      TenHangHoa: TenHangHoa,
      MoTaChiTiet: MoTaChiTiet || "",
      ThongTinMoRong: {},
      DanhGia: [],
      HinhAnh: imageUrl ? [imageUrl] : [],
      createdAt: new Date(),
    });

    res.json({
      success: true,
      message: "Thêm sản phẩm thành công",
      data: { MaHangHoa: newId, imageUrl },
    });
  } catch (error) {
    console.error("Lỗi POST /api/product:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi thêm sản phẩm",
      error: error.message,
    });
  }
});

// PUT: Cập nhật sản phẩm (có thể upload ảnh mới)
app.put("/api/product/:id", upload.single("image"), async (req, res) => {
  try {
    const maHangHoa = parseInt(req.params.id);
    const {
      TenHangHoa,
      MaDanhMuc,
      DonGiaBan,
      SoLuongTon,
      MoTaChiTiet,
      DonViTinh,
      VungMien,
    } = req.body;

    // Cập nhật SQL Server
    await sqlPool
      .request()
      .input("MaHangHoa", sql.Int, maHangHoa)
      .input("TenHangHoa", sql.NVarChar, TenHangHoa)
      .input("MaDanhMuc", sql.Int, MaDanhMuc)
      .input("DonGiaBan", sql.Decimal(18, 2), DonGiaBan)
      .input("SoLuongTon", sql.Int, SoLuongTon)
      .input("DonViTinh", sql.NVarChar, DonViTinh)
      .input("VungMien", sql.NVarChar, VungMien).query(`
        UPDATE HangHoa 
        SET TenHangHoa = @TenHangHoa, MaDanhMuc = @MaDanhMuc, DonGiaBan = @DonGiaBan, 
            SoLuongTon = @SoLuongTon, DonViTinh = @DonViTinh, VungMien = @VungMien
        WHERE MaHangHoa = @MaHangHoa
      `);

    // Cập nhật MongoDB
    const updateData = { updatedAt: new Date() };
    if (MoTaChiTiet !== undefined) updateData.MoTaChiTiet = MoTaChiTiet;
    if (req.file) updateData.$push = { HinhAnh: req.file.path };

    await mongoDB
      .collection("hanghoa_details")
      .updateOne(
        { MaHangHoa: maHangHoa },
        { $set: updateData },
        { upsert: true }
      );

    res.json({ success: true, message: "Cập nhật sản phẩm thành công" });
  } catch (error) {
    console.error("Lỗi PUT /api/product/:id:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi cập nhật sản phẩm",
      error: error.message,
    });
  }
});

// DELETE: Xóa sản phẩm (Soft delete)
app.delete("/api/product/:id", async (req, res) => {
  try {
    const maHangHoa = parseInt(req.params.id);
    await sqlPool
      .request()
      .input("MaHangHoa", sql.Int, maHangHoa)
      .query("UPDATE HangHoa SET TrangThai = 0 WHERE MaHangHoa = @MaHangHoa");

    res.json({ success: true, message: "Xóa sản phẩm thành công" });
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        message: "Lỗi khi xóa sản phẩm",
        error: error.message,
      });
  }
});


// GET: Lấy danh sách đơn hàng (có sort)
app.get("/api/orders", async (req, res) => {
  try {
    const {
      vungmien,
      limit = 100,
      sortBy = "NgayDatHang",
      sortOrder = "DESC",
    } = req.query;

    const allowedSortColumns = [
      "MaDonHang",
      "NgayDatHang",
      "TongTien",
      "TrangThaiDonHang",
    ];
    const orderBy = allowedSortColumns.includes(sortBy)
      ? sortBy
      : "NgayDatHang";
    const order = sortOrder.toUpperCase() === "ASC" ? "ASC" : "DESC";

    let query = `
      SELECT d.*, k.TenKhachHang, k.SoDienThoai, cn.TenChiNhanh
      FROM DonHang d
      LEFT JOIN KhachHang k ON d.MaKhachHang = k.MaKhachHang
      LEFT JOIN ChiNhanh cn ON d.MaChiNhanhXuLy = cn.MaChiNhanh
      WHERE 1=1
    `;

    if (vungmien) query += ` AND d.VungMien = '${vungmien}'`;
    query += ` ORDER BY d.${orderBy} ${order}`;
    query += ` OFFSET 0 ROWS FETCH NEXT ${limit} ROWS ONLY`;

    const result = await sqlPool.request().query(query);
    res.json({
      success: true,
      count: result.recordset.length,
      data: result.recordset,
    });
  } catch (error) {
    console.error("Lỗi GET /api/orders:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy danh sách đơn hàng",
      error: error.message,
    });
  }
});

// GET: Lấy chi tiết đơn hàng
app.get("/api/order/:id", async (req, res) => {
  try {
    const maDonHang = req.params.id;
    const result = await sqlPool
      .request()
      .input("MaDonHang", sql.UniqueIdentifier, maDonHang).query(`
        SELECT d.*, k.TenKhachHang, k.Email, k.SoDienThoai, k.DiaChi,
               ct.MaChiTietDonHang, ct.MaHangHoa, ct.SoLuong, ct.DonGia, ct.ThanhTien,
               h.TenHangHoa, h.DonViTinh
        FROM DonHang d
        LEFT JOIN KhachHang k ON d.MaKhachHang = k.MaKhachHang
        LEFT JOIN ChiTietDonHang ct ON d.MaDonHang = ct.MaDonHang
        LEFT JOIN HangHoa h ON ct.MaHangHoa = h.MaHangHoa
        WHERE d.MaDonHang = @MaDonHang
      `);

    if (result.recordset.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy đơn hàng" });
    }

    const order = {
      MaDonHang: result.recordset[0].MaDonHang,
      NgayDatHang: result.recordset[0].NgayDatHang,
      TongTien: result.recordset[0].TongTien,
      TrangThaiDonHang: result.recordset[0].TrangThaiDonHang,
      VungMien: result.recordset[0].VungMien,
      MaKhachHang: result.recordset[0].MaKhachHang,
      KhachHang: {
        TenKhachHang: result.recordset[0].TenKhachHang,
        Email: result.recordset[0].Email,
        SoDienThoai: result.recordset[0].SoDienThoai,
        DiaChi: result.recordset[0].DiaChi,
      },
      ChiTiet: result.recordset.map((r) => ({
        MaHangHoa: r.MaHangHoa,
        TenHangHoa: r.TenHangHoa,
        SoLuong: r.SoLuong,
        DonGia: r.DonGia,
        ThanhTien: r.ThanhTien,
        DonViTinh: r.DonViTinh,
      })),
    };

    res.json({ success: true, data: order });
  } catch (error) {
    console.error("Lỗi GET /api/order/:id:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy chi tiết đơn hàng",
      error: error.message,
    });
  }
});

// POST: Tạo đơn hàng mới
app.post("/api/order", async (req, res) => {
  try {
    const { MaKhachHang, VungMien, TrangThaiDonHang, ChiTiet } = req.body;

    // Tính tổng tiền
    const tongTien = ChiTiet.reduce(
      (sum, item) => sum + item.SoLuong * item.DonGia,
      0
    );

    // Insert đơn hàng
    const orderResult = await sqlPool
      .request()
      .input("MaKhachHang", sql.Int, MaKhachHang)
      .input("VungMien", sql.NVarChar, VungMien)
      .input("TongTien", sql.Decimal(18, 2), tongTien)
      .input("TrangThaiDonHang", sql.NVarChar, TrangThaiDonHang || "Chờ xử lý")
      .input("NgayDatHang", sql.DateTime, new Date()).query(`
        INSERT INTO DonHang (MaKhachHang, VungMien, NgayDatHang, TongTien, TrangThaiDonHang)
        OUTPUT INSERTED.MaDonHang
        VALUES (@MaKhachHang, @VungMien, @NgayDatHang, @TongTien, @TrangThaiDonHang)
      `);

    const maDonHang = orderResult.recordset[0].MaDonHang;

    // Insert chi tiết đơn hàng
    for (const item of ChiTiet) {
      await sqlPool
        .request()
        .input("MaDonHang", sql.UniqueIdentifier, maDonHang)
        .input("MaHangHoa", sql.Int, item.MaHangHoa)
        .input("SoLuong", sql.Int, item.SoLuong)
        .input("DonGia", sql.Decimal(18, 2), item.DonGia)
        .input("ThanhTien", sql.Decimal(18, 2), item.SoLuong * item.DonGia)
        .query(`
          INSERT INTO ChiTietDonHang (MaDonHang, MaHangHoa, SoLuong, DonGia, ThanhTien)
          VALUES (@MaDonHang, @MaHangHoa, @SoLuong, @DonGia, @ThanhTien)
        `);
    }

    res.json({
      success: true,
      message: "Tạo đơn hàng thành công",
      data: { MaDonHang: maDonHang },
    });
  } catch (error) {
    console.error("Lỗi POST /api/order:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Lỗi khi tạo đơn hàng",
        error: error.message,
      });
  }
});

// PUT: Cập nhật trạng thái đơn hàng
app.put("/api/order/:id", async (req, res) => {
  try {
    const maDonHang = req.params.id;
    const { TrangThaiDonHang } = req.body;

    await sqlPool
      .request()
      .input("MaDonHang", sql.UniqueIdentifier, maDonHang)
      .input("TrangThaiDonHang", sql.NVarChar, TrangThaiDonHang).query(`
        UPDATE DonHang 
        SET TrangThaiDonHang = @TrangThaiDonHang
        WHERE MaDonHang = @MaDonHang
      `);

    res.json({ success: true, message: "Cập nhật đơn hàng thành công" });
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        message: "Lỗi khi cập nhật đơn hàng",
        error: error.message,
      });
  }
});


// GET: Lấy danh sách khách hàng (có sort)
app.get("/api/customers", async (req, res) => {
  try {
    const {
      vungmien,
      limit = 100,
      sortBy = "NgayDangKy",
      sortOrder = "DESC",
    } = req.query;

    const allowedSortColumns = [
      "MaKhachHang",
      "TenKhachHang",
      "DiemTichLuy",
      "NgayDangKy",
    ];
    const orderBy = allowedSortColumns.includes(sortBy) ? sortBy : "NgayDangKy";
    const order = sortOrder.toUpperCase() === "ASC" ? "ASC" : "DESC";

    let query = `
      SELECT k.*, cn.TenChiNhanh
      FROM KhachHang k
      LEFT JOIN ChiNhanh cn ON k.MaChiNhanhGanNhat = cn.MaChiNhanh
      WHERE 1=1
    `;

    if (vungmien) query += ` AND k.VungMien = '${vungmien}'`;
    query += ` ORDER BY k.${orderBy} ${order}`;
    query += ` OFFSET 0 ROWS FETCH NEXT ${limit} ROWS ONLY`;

    const result = await sqlPool.request().query(query);
    res.json({
      success: true,
      count: result.recordset.length,
      data: result.recordset,
    });
  } catch (error) {
    console.error("Lỗi GET /api/customers:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy danh sách khách hàng",
      error: error.message,
    });
  }
});

// GET: Lấy chi tiết khách hàng
app.get("/api/customer/:id", async (req, res) => {
  try {
    const maKhachHang = parseInt(req.params.id);
    const result = await sqlPool
      .request()
      .input("MaKhachHang", sql.Int, maKhachHang).query(`
        SELECT k.*, cn.TenChiNhanh
        FROM KhachHang k
        LEFT JOIN ChiNhanh cn ON k.MaChiNhanhGanNhat = cn.MaChiNhanh
        WHERE k.MaKhachHang = @MaKhachHang
      `);

    if (result.recordset.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy khách hàng" });
    }

    res.json({ success: true, data: result.recordset[0] });
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        message: "Lỗi khi lấy chi tiết khách hàng",
        error: error.message,
      });
  }
});

// POST: Thêm khách hàng mới
app.post("/api/customer", async (req, res) => {
  try {
    const {
      TenKhachHang,
      Email,
      SoDienThoai,
      DiaChi,
      VungMien,
      LoaiKhachHang,
    } = req.body;

    const result = await sqlPool
      .request()
      .input("TenKhachHang", sql.NVarChar, TenKhachHang)
      .input("Email", sql.NVarChar, Email || null)
      .input("SoDienThoai", sql.NVarChar, SoDienThoai || null)
      .input("DiaChi", sql.NVarChar, DiaChi || null)
      .input("VungMien", sql.NVarChar, VungMien)
      .input("LoaiKhachHang", sql.NVarChar, LoaiKhachHang || "Thường")
      .input("NgayDangKy", sql.DateTime, new Date()).query(`
        INSERT INTO KhachHang (TenKhachHang, Email, SoDienThoai, DiaChi, VungMien, LoaiKhachHang, NgayDangKy, DiemTichLuy)
        OUTPUT INSERTED.MaKhachHang
        VALUES (@TenKhachHang, @Email, @SoDienThoai, @DiaChi, @VungMien, @LoaiKhachHang, @NgayDangKy, 0)
      `);

    res.json({
      success: true,
      message: "Thêm khách hàng thành công",
      data: { MaKhachHang: result.recordset[0].MaKhachHang },
    });
  } catch (error) {
    console.error("Lỗi POST /api/customer:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Lỗi khi thêm khách hàng",
        error: error.message,
      });
  }
});

// PUT: Cập nhật khách hàng
app.put("/api/customer/:id", async (req, res) => {
  try {
    const maKhachHang = parseInt(req.params.id);
    const { TenKhachHang, Email, SoDienThoai, DiaChi, LoaiKhachHang } =
      req.body;

    await sqlPool
      .request()
      .input("MaKhachHang", sql.Int, maKhachHang)
      .input("TenKhachHang", sql.NVarChar, TenKhachHang)
      .input("Email", sql.NVarChar, Email)
      .input("SoDienThoai", sql.NVarChar, SoDienThoai)
      .input("DiaChi", sql.NVarChar, DiaChi)
      .input("LoaiKhachHang", sql.NVarChar, LoaiKhachHang).query(`
        UPDATE KhachHang 
        SET TenKhachHang = @TenKhachHang, Email = @Email, SoDienThoai = @SoDienThoai,
            DiaChi = @DiaChi, LoaiKhachHang = @LoaiKhachHang
        WHERE MaKhachHang = @MaKhachHang
      `);

    res.json({ success: true, message: "Cập nhật khách hàng thành công" });
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        message: "Lỗi khi cập nhật khách hàng",
        error: error.message,
      });
  }
});


app.get("/api/categories", async (req, res) => {
  try {
    const result = await sqlPool
      .request()
      .query("SELECT * FROM DanhMuc WHERE TrangThai = 1");
    res.json({ success: true, data: result.recordset });
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        message: "Lỗi khi lấy danh mục",
        error: error.message,
      });
  }
});

app.get("/api/suppliers", async (req, res) => {
  try {
    const result = await sqlPool
      .request()
      .query("SELECT * FROM NhaCungCap WHERE TrangThai = 1");
    res.json({ success: true, data: result.recordset });
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        message: "Lỗi khi lấy nhà cung cấp",
        error: error.message,
      });
  }
});


app.get("/api/health", async (req, res) => {
  try {
    await sqlPool.request().query("SELECT 1");
    await mongoDB.admin().ping();
    res.json({
      success: true,
      status: "Healthy",
      databases: {
        sqlServer: "Connected",
        mongoDB: "Connected",
        cloudinary: "Configured",
      },
      timestamp: new Date(),
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, status: "Unhealthy", error: error.message });
  }
});

app.get("/api/statistics", async (req, res) => {
  try {
    const sqlStats = await sqlPool.request().query(`
      SELECT VungMien, COUNT(*) as SoLuongSanPham, SUM(SoLuongTon) as TongSoLuongTon, AVG(DonGiaBan) as GiaTrungBinh
      FROM HangHoa WHERE TrangThai = 1 GROUP BY VungMien
    `);

    const mongoStats = await mongoDB
      .collection("hanghoa_details")
      .aggregate([
        {
          $group: {
            _id: null,
            tongSanPhamCoChiTiet: { $sum: 1 },
            tongDanhGia: { $sum: { $size: "$DanhGia" } },
          },
        },
      ])
      .toArray();

    res.json({
      success: true,
      data: { theoVungMien: sqlStats.recordset, tongQuan: mongoStats[0] || {} },
    });
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        message: "Lỗi khi lấy thống kê",
        error: error.message,
      });
  }
});



app.use((req, res) => {
  res
    .status(404)
    .json({ success: false, message: "API endpoint không tồn tại" });
});

process.on("SIGINT", async () => {
  console.log("\n Đang đóng kết nối database...");
  if (sqlPool) await sqlPool.close();
  if (mongoClient) await mongoClient.close();
  console.log("Đã đóng kết nối. Tạm biệt!");
  process.exit(0);
});

initializeDatabases().then(() => {
  app.listen(PORT, () => {
    console.log(`
HỆ THỐNG QUẢN LÝ NÔNG SẢN PHÂN TÁN
Server đang chạy tại: http://localhost:${PORT}
Dashboard: http://localhost:${PORT}/
    `);
  });
});
