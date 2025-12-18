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

// ============================================================
// PRODUCTS - CRUD
// ============================================================

// GET: Lấy danh sách sản phẩm
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

// GET: Lấy chi tiết sản phẩm
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

// POST: Thêm sản phẩm mới
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

    // Lưu ảnh vào MongoDB
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

// PUT: Cập nhật sản phẩm (SỬA LẠI ĐỂ XỬ LÝ ẢNH TỐT HƠN)
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
      DonGiaNhap,
      MaNhaCungCap,
      HanSuDung,
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
      .input("VungMien", sql.NVarChar, VungMien)
      .input("DonGiaNhap", sql.Decimal(18, 2), DonGiaNhap || 0)
      .input("MaNhaCungCap", sql.Int, MaNhaCungCap || null)
      .input("HanSuDung", sql.Date, HanSuDung || null).query(`
        UPDATE HangHoa 
        SET TenHangHoa = @TenHangHoa, MaDanhMuc = @MaDanhMuc, DonGiaBan = @DonGiaBan, 
            SoLuongTon = @SoLuongTon, DonViTinh = @DonViTinh, VungMien = @VungMien,
            DonGiaNhap = @DonGiaNhap, MaNhaCungCap = @MaNhaCungCap, HanSuDung = @HanSuDung
        WHERE MaHangHoa = @MaHangHoa
      `);

    // Cập nhật MongoDB
    const updateData = {
      TenHangHoa,
      MoTaChiTiet: MoTaChiTiet || "",
      updatedAt: new Date(),
    };

    // Nếu có ảnh mới, xóa ảnh cũ trên Cloudinary và cập nhật
    if (req.file) {
      const oldData = await mongoDB
        .collection("hanghoa_details")
        .findOne({ MaHangHoa: maHangHoa });

      if (oldData && oldData.HinhAnh && oldData.HinhAnh.length > 0) {
        // Xóa ảnh cũ trên Cloudinary
        for (const imgUrl of oldData.HinhAnh) {
          try {
            const publicId = extractPublicId(imgUrl);
            if (publicId) {
              await cloudinary.uploader.destroy(publicId);
              console.log(`Đã xóa ảnh cũ: ${publicId}`);
            }
          } catch (err) {
            console.error("Lỗi xóa ảnh cũ:", err.message);
          }
        }
      }

      updateData.HinhAnh = [req.file.path];
    }

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

// DELETE: Xóa sản phẩm (SQL + MongoDB + Cloudinary)
app.delete("/api/product/:id", async (req, res) => {
  try {
    const maHangHoa = parseInt(req.params.id);

    // 1. Lấy thông tin ảnh từ MongoDB
    const mongoData = await mongoDB
      .collection("hanghoa_details")
      .findOne({ MaHangHoa: maHangHoa });

    // 2. Xóa ảnh trên Cloudinary
    if (mongoData && mongoData.HinhAnh && mongoData.HinhAnh.length > 0) {
      for (const imgUrl of mongoData.HinhAnh) {
        try {
          const publicId = extractPublicId(imgUrl);
          if (publicId) {
            await cloudinary.uploader.destroy(publicId);
            console.log(`Đã xóa ảnh Cloudinary: ${publicId}`);
          }
        } catch (err) {
          console.error("Lỗi xóa ảnh Cloudinary:", err.message);
        }
      }
    }

    // 3. Xóa MongoDB
    await mongoDB
      .collection("hanghoa_details")
      .deleteOne({ MaHangHoa: maHangHoa });
    console.log(`Đã xóa MongoDB: MaHangHoa=${maHangHoa}`);

    // 4. Xóa SQL (soft delete)
    await sqlPool
      .request()
      .input("MaHangHoa", sql.Int, maHangHoa)
      .query("UPDATE HangHoa SET TrangThai = 0 WHERE MaHangHoa = @MaHangHoa");
    console.log(`Đã xóa SQL: MaHangHoa=${maHangHoa}`);

    res.json({ success: true, message: "Xóa sản phẩm thành công" });
  } catch (error) {
    console.error("Lỗi DELETE /api/product/:id:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi xóa sản phẩm",
      error: error.message,
    });
  }
});

// Helper: Extract Cloudinary public_id from URL
function extractPublicId(url) {
  try {
    const match = url.match(/\/([^\/]+)\.(jpg|jpeg|png|webp)$/);
    if (match) {
      return `nongsan-images/${match[1]}`;
    }
    return null;
  } catch (error) {
    return null;
  }
}

// ============================================================
// ORDERS - CRUD
// ============================================================

// [UPDATED] Lấy danh sách đơn hàng (Filter, Search, Sort, Pagination)
app.get("/api/orders", async (req, res) => {
  try {
    const {
      vungmien,
      search,
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
    if (search) query += ` AND k.TenKhachHang LIKE N'%${search}%'`;
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

app.post("/api/order", async (req, res) => {
  try {
    const { MaKhachHang, VungMien, TrangThaiDonHang, ChiTiet } = req.body;

    const tongTien = ChiTiet.reduce(
      (sum, item) => sum + item.SoLuong * item.DonGia,
      0
    );

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
    res.status(500).json({
      success: false,
      message: "Lỗi khi tạo đơn hàng",
      error: error.message,
    });
  }
});

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
    res.status(500).json({
      success: false,
      message: "Lỗi khi cập nhật đơn hàng",
      error: error.message,
    });
  }
});

// DELETE: Xóa đơn hàng (xóa chi tiết trước, sau đó xóa đơn)
app.delete("/api/order/:id", async (req, res) => {
  try {
    const maDonHang = req.params.id;

    // Xóa chi tiết đơn hàng trước
    await sqlPool
      .request()
      .input("MaDonHang", sql.UniqueIdentifier, maDonHang)
      .query("DELETE FROM ChiTietDonHang WHERE MaDonHang = @MaDonHang");

    // Xóa đơn hàng
    await sqlPool
      .request()
      .input("MaDonHang", sql.UniqueIdentifier, maDonHang)
      .query("DELETE FROM DonHang WHERE MaDonHang = @MaDonHang");

    res.json({ success: true, message: "Xóa đơn hàng thành công" });
  } catch (error) {
    console.error("Lỗi DELETE /api/order/:id:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi xóa đơn hàng",
      error: error.message,
    });
  }
});

// ============================================================
// CUSTOMERS - CRUD
// ============================================================

// [UPDATED] Lấy danh sách khách hàng (Filter, Search, Sort, Pagination)
app.get("/api/customers", async (req, res) => {
  try {
    const {
      vungmien,
      search,
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
    if (search) {
      query += ` AND (k.TenKhachHang LIKE N'%${search}%' OR k.SoDienThoai LIKE '%${search}%')`;
    }
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
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy chi tiết khách hàng",
      error: error.message,
    });
  }
});

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
    res.status(500).json({
      success: false,
      message: "Lỗi khi thêm khách hàng",
      error: error.message,
    });
  }
});

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
    res.status(500).json({
      success: false,
      message: "Lỗi khi cập nhật khách hàng",
      error: error.message,
    });
  }
});

// DELETE: Xóa khách hàng
app.delete("/api/customer/:id", async (req, res) => {
  try {
    const maKhachHang = parseInt(req.params.id);

    // Kiểm tra xem khách hàng có đơn hàng không
    const checkOrders = await sqlPool
      .request()
      .input("MaKhachHang", sql.Int, maKhachHang)
      .query(
        "SELECT COUNT(*) as Count FROM DonHang WHERE MaKhachHang = @MaKhachHang"
      );

    if (checkOrders.recordset[0].Count > 0) {
      return res.status(400).json({
        success: false,
        message:
          "Không thể xóa khách hàng đã có đơn hàng. Vui lòng xóa đơn hàng trước.",
      });
    }

    // Xóa khách hàng
    await sqlPool
      .request()
      .input("MaKhachHang", sql.Int, maKhachHang)
      .query("DELETE FROM KhachHang WHERE MaKhachHang = @MaKhachHang");

    res.json({ success: true, message: "Xóa khách hàng thành công" });
  } catch (error) {
    console.error("Lỗi DELETE /api/customer/:id:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi xóa khách hàng",
      error: error.message,
    });
  }
});

// ============================================================
// WAREHOUSE & INVENTORY - CRUD
// ============================================================

// GET: Lấy danh sách kho
app.get("/api/warehouses", async (req, res) => {
  try {
    const result = await sqlPool.request().query(`
      SELECT k.*, cn.TenChiNhanh, cn.VungMien
      FROM Kho k
      LEFT JOIN ChiNhanh cn ON k.MaChiNhanh = cn.MaChiNhanh
      WHERE k.TrangThai = 1
      ORDER BY k.MaKho DESC
    `);

    res.json({
      success: true,
      count: result.recordset.length,
      data: result.recordset,
    });
  } catch (error) {
    console.error("Lỗi GET /api/warehouses:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy danh sách kho",
      error: error.message,
    });
  }
});

// GET: Chi tiết kho
app.get("/api/warehouse/:id", async (req, res) => {
  try {
    const maKho = parseInt(req.params.id);
    const result = await sqlPool.request().input("MaKho", sql.Int, maKho)
      .query(`
        SELECT k.*, cn.TenChiNhanh, cn.VungMien
        FROM Kho k
        LEFT JOIN ChiNhanh cn ON k.MaChiNhanh = cn.MaChiNhanh
        WHERE k.MaKho = @MaKho
      `);

    if (result.recordset.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy kho" });
    }

    res.json({ success: true, data: result.recordset[0] });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy chi tiết kho",
      error: error.message,
    });
  }
});

// POST: Thêm kho mới
app.post("/api/warehouse", async (req, res) => {
  try {
    const { MaChiNhanh, TenKho, DiaChiKho, NguoiQuanLy, SucChua } = req.body;

    const result = await sqlPool
      .request()
      .input("MaChiNhanh", sql.Int, MaChiNhanh)
      .input("TenKho", sql.NVarChar, TenKho)
      .input("DiaChiKho", sql.NVarChar, DiaChiKho || null)
      .input("NguoiQuanLy", sql.NVarChar, NguoiQuanLy || null)
      .input("SucChua", sql.Int, SucChua || null).query(`
        INSERT INTO Kho (MaChiNhanh, TenKho, DiaChiKho, NguoiQuanLy, SucChua, TrangThai)
        OUTPUT INSERTED.MaKho
        VALUES (@MaChiNhanh, @TenKho, @DiaChiKho, @NguoiQuanLy, @SucChua, 1)
      `);

    res.json({
      success: true,
      message: "Thêm kho thành công",
      data: { MaKho: result.recordset[0].MaKho },
    });
  } catch (error) {
    console.error("Lỗi POST /api/warehouse:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi thêm kho",
      error: error.message,
    });
  }
});

// PUT: Cập nhật kho
app.put("/api/warehouse/:id", async (req, res) => {
  try {
    const maKho = parseInt(req.params.id);
    const { TenKho, DiaChiKho, NguoiQuanLy, SucChua } = req.body;

    await sqlPool
      .request()
      .input("MaKho", sql.Int, maKho)
      .input("TenKho", sql.NVarChar, TenKho)
      .input("DiaChiKho", sql.NVarChar, DiaChiKho)
      .input("NguoiQuanLy", sql.NVarChar, NguoiQuanLy)
      .input("SucChua", sql.Int, SucChua).query(`
        UPDATE Kho 
        SET TenKho = @TenKho, DiaChiKho = @DiaChiKho, 
            NguoiQuanLy = @NguoiQuanLy, SucChua = @SucChua
        WHERE MaKho = @MaKho
      `);

    res.json({ success: true, message: "Cập nhật kho thành công" });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi khi cập nhật kho",
      error: error.message,
    });
  }
});

// DELETE: Xóa kho
app.delete("/api/warehouse/:id", async (req, res) => {
  try {
    const maKho = parseInt(req.params.id);

    // Xóa tồn kho trước
    await sqlPool
      .request()
      .input("MaKho", sql.Int, maKho)
      .query("DELETE FROM TonKho WHERE MaKho = @MaKho");

    // Xóa kho (soft delete)
    await sqlPool
      .request()
      .input("MaKho", sql.Int, maKho)
      .query("UPDATE Kho SET TrangThai = 0 WHERE MaKho = @MaKho");

    res.json({ success: true, message: "Xóa kho thành công" });
  } catch (error) {
    console.error("Lỗi DELETE /api/warehouse/:id:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi xóa kho",
      error: error.message,
    });
  }
});

// GET: Lấy danh sách tồn kho
app.get("/api/inventory", async (req, res) => {
  try {
    const { vungmien } = req.query;

    let query = `
      SELECT tk.*, k.TenKho, cn.TenChiNhanh, cn.VungMien, h.TenHangHoa, h.DonViTinh
      FROM TonKho tk
      LEFT JOIN Kho k ON tk.MaKho = k.MaKho
      LEFT JOIN ChiNhanh cn ON tk.MaChiNhanh = cn.MaChiNhanh
      LEFT JOIN HangHoa h ON tk.MaHangHoa = h.MaHangHoa
      WHERE k.TrangThai = 1
    `;

    if (vungmien) query += ` AND cn.VungMien = '${vungmien}'`;
    query += ` ORDER BY tk.NgayCapNhat DESC`;

    const result = await sqlPool.request().query(query);
    res.json({
      success: true,
      count: result.recordset.length,
      data: result.recordset,
    });
  } catch (error) {
    console.error("Lỗi GET /api/inventory:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy danh sách tồn kho",
      error: error.message,
    });
  }
});

// PUT: Cập nhật số lượng tồn kho
app.put("/api/inventory/:id", async (req, res) => {
  try {
    const maTonKho = parseInt(req.params.id);
    const { SoLuongTon } = req.body;

    await sqlPool
      .request()
      .input("MaTonKho", sql.Int, maTonKho)
      .input("SoLuongTon", sql.Int, SoLuongTon)
      .input("NgayCapNhat", sql.DateTime, new Date()).query(`
        UPDATE TonKho 
        SET SoLuongTon = @SoLuongTon, NgayCapNhat = @NgayCapNhat
        WHERE MaTonKho = @MaTonKho
      `);

    res.json({ success: true, message: "Cập nhật tồn kho thành công" });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi khi cập nhật tồn kho",
      error: error.message,
    });
  }
});

// ============================================================
// CATEGORIES & SUPPLIERS - CRUD
// ============================================================

app.get("/api/categories", async (req, res) => {
  try {
    const result = await sqlPool
      .request()
      .query(
        "SELECT * FROM DanhMuc WHERE TrangThai = 1 ORDER BY MaDanhMuc DESC"
      );
    res.json({ success: true, data: result.recordset });
  } catch (error) {
    console.error("Lỗi GET /api/categories:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy danh mục",
      error: error.message,
    });
  }
});

app.post("/api/category", async (req, res) => {
  try {
    const { TenDanhMuc, LoaiDanhMuc } = req.body;

    const result = await sqlPool
      .request()
      .input("TenDanhMuc", sql.NVarChar, TenDanhMuc)
      .input("LoaiDanhMuc", sql.NVarChar, LoaiDanhMuc || null).query(`
        INSERT INTO DanhMuc (TenDanhMuc, LoaiDanhMuc, TrangThai)
        OUTPUT INSERTED.MaDanhMuc
        VALUES (@TenDanhMuc, @LoaiDanhMuc, 1)
      `);

    res.json({
      success: true,
      message: "Thêm danh mục thành công",
      data: { MaDanhMuc: result.recordset[0].MaDanhMuc },
    });
  } catch (error) {
    console.error("Lỗi POST /api/category:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi thêm danh mục",
      error: error.message,
    });
  }
});

app.put("/api/category/:id", async (req, res) => {
  try {
    const maDanhMuc = parseInt(req.params.id);
    const { TenDanhMuc, LoaiDanhMuc } = req.body;

    await sqlPool
      .request()
      .input("MaDanhMuc", sql.Int, maDanhMuc)
      .input("TenDanhMuc", sql.NVarChar, TenDanhMuc)
      .input("LoaiDanhMuc", sql.NVarChar, LoaiDanhMuc).query(`
        UPDATE DanhMuc 
        SET TenDanhMuc = @TenDanhMuc, LoaiDanhMuc = @LoaiDanhMuc
        WHERE MaDanhMuc = @MaDanhMuc
      `);

    res.json({ success: true, message: "Cập nhật danh mục thành công" });
  } catch (error) {
    console.error("Lỗi PUT /api/category/:id:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi cập nhật danh mục",
      error: error.message,
    });
  }
});

app.delete("/api/category/:id", async (req, res) => {
  try {
    const maDanhMuc = parseInt(req.params.id);

    // Kiểm tra xem có sản phẩm nào thuộc danh mục này không
    const checkProducts = await sqlPool
      .request()
      .input("MaDanhMuc", sql.Int, maDanhMuc)
      .query(
        "SELECT COUNT(*) as Count FROM HangHoa WHERE MaDanhMuc = @MaDanhMuc"
      );

    if (checkProducts.recordset[0].Count > 0) {
      return res.status(400).json({
        success: false,
        message: "Không thể xóa danh mục đang có sản phẩm",
      });
    }

    await sqlPool
      .request()
      .input("MaDanhMuc", sql.Int, maDanhMuc)
      .query("UPDATE DanhMuc SET TrangThai = 0 WHERE MaDanhMuc = @MaDanhMuc");

    res.json({ success: true, message: "Xóa danh mục thành công" });
  } catch (error) {
    console.error("Lỗi DELETE /api/category/:id:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi xóa danh mục",
      error: error.message,
    });
  }
});

app.get("/api/suppliers", async (req, res) => {
  try {
    const result = await sqlPool
      .request()
      .query(
        "SELECT * FROM NhaCungCap WHERE TrangThai = 1 ORDER BY MaNhaCungCap DESC"
      );
    res.json({ success: true, data: result.recordset });
  } catch (error) {
    console.error("Lỗi GET /api/suppliers:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy nhà cung cấp",
      error: error.message,
    });
  }
});

app.post("/api/supplier", async (req, res) => {
  try {
    const { TenNhaCungCap, DiaChi, SoDienThoai, Email } = req.body;

    const result = await sqlPool
      .request()
      .input("TenNhaCungCap", sql.NVarChar, TenNhaCungCap)
      .input("DiaChi", sql.NVarChar, DiaChi || null)
      .input("SoDienThoai", sql.NVarChar, SoDienThoai || null)
      .input("Email", sql.NVarChar, Email || null).query(`
        INSERT INTO NhaCungCap (TenNhaCungCap, DiaChi, SoDienThoai, Email, TrangThai)
        OUTPUT INSERTED.MaNhaCungCap
        VALUES (@TenNhaCungCap, @DiaChi, @SoDienThoai, @Email, 1)
      `);

    res.json({
      success: true,
      message: "Thêm nhà cung cấp thành công",
      data: { MaNhaCungCap: result.recordset[0].MaNhaCungCap },
    });
  } catch (error) {
    console.error("Lỗi POST /api/supplier:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi thêm nhà cung cấp",
      error: error.message,
    });
  }
});

app.put("/api/supplier/:id", async (req, res) => {
  try {
    const maNhaCungCap = parseInt(req.params.id);
    const { TenNhaCungCap, DiaChi, SoDienThoai, Email } = req.body;

    await sqlPool
      .request()
      .input("MaNhaCungCap", sql.Int, maNhaCungCap)
      .input("TenNhaCungCap", sql.NVarChar, TenNhaCungCap)
      .input("DiaChi", sql.NVarChar, DiaChi)
      .input("SoDienThoai", sql.NVarChar, SoDienThoai)
      .input("Email", sql.NVarChar, Email).query(`
        UPDATE NhaCungCap 
        SET TenNhaCungCap = @TenNhaCungCap, DiaChi = @DiaChi, 
            SoDienThoai = @SoDienThoai, Email = @Email
        WHERE MaNhaCungCap = @MaNhaCungCap
      `);

    res.json({ success: true, message: "Cập nhật nhà cung cấp thành công" });
  } catch (error) {
    console.error("Lỗi PUT /api/supplier/:id:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi cập nhật nhà cung cấp",
      error: error.message,
    });
  }
});

app.delete("/api/supplier/:id", async (req, res) => {
  try {
    const maNhaCungCap = parseInt(req.params.id);

    // Kiểm tra xem có sản phẩm nào từ nhà cung cấp này không
    const checkProducts = await sqlPool
      .request()
      .input("MaNhaCungCap", sql.Int, maNhaCungCap)
      .query(
        "SELECT COUNT(*) as Count FROM HangHoa WHERE MaNhaCungCap = @MaNhaCungCap"
      );

    if (checkProducts.recordset[0].Count > 0) {
      return res.status(400).json({
        success: false,
        message: "Không thể xóa nhà cung cấp đang có sản phẩm",
      });
    }

    await sqlPool
      .request()
      .input("MaNhaCungCap", sql.Int, maNhaCungCap)
      .query(
        "UPDATE NhaCungCap SET TrangThai = 0 WHERE MaNhaCungCap = @MaNhaCungCap"
      );

    res.json({ success: true, message: "Xóa nhà cung cấp thành công" });
  } catch (error) {
    console.error("Lỗi DELETE /api/supplier/:id:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi xóa nhà cung cấp",
      error: error.message,
    });
  }
});

// ============================================================
// BRANCHES
// ============================================================

app.get("/api/branches", async (req, res) => {
  try {
    const result = await sqlPool
      .request()
      .query(
        "SELECT * FROM ChiNhanh WHERE TrangThai = 1 ORDER BY MaChiNhanh DESC"
      );
    res.json({
      success: true,
      count: result.recordset.length,
      data: result.recordset,
    });
  } catch (error) {
    console.error("Lỗi GET /api/branches:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy danh sách chi nhánh",
      error: error.message,
    });
  }
});

app.get("/api/branch/:id", async (req, res) => {
  try {
    const maChiNhanh = parseInt(req.params.id);
    const result = await sqlPool
      .request()
      .input("MaChiNhanh", sql.Int, maChiNhanh)
      .query("SELECT * FROM ChiNhanh WHERE MaChiNhanh = @MaChiNhanh");

    if (result.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy chi nhánh",
      });
    }

    res.json({ success: true, data: result.recordset[0] });
  } catch (error) {
    console.error("Lỗi GET /api/branch/:id:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy chi tiết chi nhánh",
      error: error.message,
    });
  }
});

// ============================================================
// HEALTH CHECK & STATISTICS
// ============================================================

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
    console.error("Lỗi Health Check:", error);
    res.status(500).json({
      success: false,
      status: "Unhealthy",
      error: error.message,
    });
  }
});

app.get("/api/statistics", async (req, res) => {
  try {
    const sqlStats = await sqlPool.request().query(`
      SELECT VungMien, 
             COUNT(*) as SoLuongSanPham, 
             SUM(SoLuongTon) as TongSoLuongTon, 
             AVG(DonGiaBan) as GiaTrungBinh
      FROM HangHoa 
      WHERE TrangThai = 1 
      GROUP BY VungMien
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
      data: {
        theoVungMien: sqlStats.recordset,
        tongQuan: mongoStats[0] || {},
      },
    });
  } catch (error) {
    console.error("Lỗi GET /api/statistics:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy thống kê",
      error: error.message,
    });
  }
});

// ============================================================
// ERROR HANDLING
// ============================================================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "API endpoint không tồn tại",
    path: req.path,
    method: req.method,
  });
});

app.use((error, req, res, next) => {
  console.error("Server Error:", error);
  res.status(500).json({
    success: false,
    message: "Lỗi server nội bộ",
    error: process.env.NODE_ENV === "development" ? error.message : undefined,
  });
});

// ============================================================
// GRACEFUL SHUTDOWN
// ============================================================

process.on("SIGINT", async () => {
  console.log("\nĐang đóng kết nối database...");
  try {
    if (sqlPool) await sqlPool.close();
    if (mongoClient) await mongoClient.close();
    console.log("Đã đóng kết nối. Tạm biệt!");
    process.exit(0);
  } catch (error) {
    console.error("Lỗi khi đóng kết nối:", error);
    process.exit(1);
  }
});

process.on("SIGTERM", async () => {
  console.log("\nNhận tín hiệu SIGTERM...");
  try {
    if (sqlPool) await sqlPool.close();
    if (mongoClient) await mongoClient.close();
    console.log("Đã đóng kết nối an toàn");
    process.exit(0);
  } catch (error) {
    console.error("Lỗi khi đóng kết nối:", error);
    process.exit(1);
  }
});

// ============================================================
// START SERVER
// ============================================================

initializeDatabases()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`
╔═══════════════════════════════════════════════════════╗
║   HỆ THỐNG QUẢN LÝ NÔNG SẢN PHÂN TÁN                 ║
║   Polyglot Persistence Architecture                   ║
╠═══════════════════════════════════════════════════════╣
║   Server: http://localhost:${PORT}                       ║
║   Dashboard: http://localhost:${PORT}/                   ║
║   Health Check: http://localhost:${PORT}/api/health      ║
║   Statistics: http://localhost:${PORT}/api/statistics    ║
╠═══════════════════════════════════════════════════════╣
║   Database Status:                                    ║
║   SQL Server - Connected                              ║
║   MongoDB - Connected                                 ║
║   Cloudinary - Configured                             ║
╚═══════════════════════════════════════════════════════╝
    `);
    });
  })
  .catch((error) => {
    console.error("Khởi động server thất bại:", error);
    process.exit(1);
  });
