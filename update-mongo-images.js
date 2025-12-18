// ============================================================
// CẬP NHẬT URL ẢNH TỪ CLOUDINARY VÀO MONGODB
// Chạy sau khi upload-images.js hoàn tất
// ============================================================
require("dotenv").config();
const { MongoClient } = require("mongodb");
const fs = require("fs");

const mongoUrl = process.env.MONGO_URL || "mongodb://localhost:27017";
const mongoDbName = process.env.MONGO_DB || "nongsan_db";

// Dữ liệu chi tiết với URL ảnh thực từ Cloudinary
const productDetails = [
  {
    MaHangHoa: 1,
    TenHangHoa: "Rau muống sạch",
    MoTaChiTiet:
      "Rau muống hữu cơ, không thuốc trừ sâu, trồng tại vùng ngoại ô Hà Nội. Lá xanh tươi, thân giòn, giàu chất xơ và vitamin A, C.",
    ThongTinMoRong: {
      nguonGoc: "Hà Nội",
      cachCheBien: "Luộc, xào tỏi, canh chua",
      baoQuan: "Ngăn mát tủ lạnh 3-5 ngày",
      chungNhan: ["VietGAP"],
    },
    DanhGia: [
      {
        nguoiDanhGia: "Nguyễn Văn An",
        soSao: 5,
        noiDung: "Rau rất tươi, sạch, giao hàng nhanh!",
        ngayDanhGia: new Date("2024-12-10"),
      },
    ],
    HinhAnh: [], // Sẽ cập nhật từ Cloudinary
  },
  {
    MaHangHoa: 2,
    TenHangHoa: "Su hào trắng",
    MoTaChiTiet:
      "Su hào trắng Đà Lạt, củ tròn, giòn ngọt, thích hợp nấu canh, xào hoặc muối chua.",
    ThongTinMoRong: {
      nguonGoc: "Đà Lạt",
      cachCheBien: "Nấu canh, xào, muối chua",
      baoQuan: "Ngăn mát tủ lạnh 1 tuần",
    },
    DanhGia: [],
    HinhAnh: [],
  },
  {
    MaHangHoa: 3,
    TenHangHoa: "Cam Cao Phong",
    MoTaChiTiet:
      "Cam Cao Phong (Hòa Bình), vỏ xanh, múi ngọt thanh, giàu vitamin C. Đặc sản vùng cao, chất lượng VietGAP.",
    ThongTinMoRong: {
      nguonGoc: "Cao Phong, Hòa Bình",
      thanhPhan: "Vitamin C cao, ít đường",
      baoQuan: "Nơi khô ráo 7-10 ngày",
      chungNhan: ["VietGAP"],
    },
    DanhGia: [
      {
        nguoiDanhGia: "Trần Thị Bình",
        soSao: 5,
        noiDung: "Cam ngọt lịm, vỏ mỏng, nước nhiều!",
        ngayDanhGia: new Date("2024-12-12"),
      },
    ],
    HinhAnh: [],
  },
  {
    MaHangHoa: 4,
    TenHangHoa: "Chuối Laba",
    MoTaChiTiet:
      "Chuối Laba Quảng Nam, quả to, thịt vàng, ngọt đậm, thơm tự nhiên.",
    ThongTinMoRong: {
      nguonGoc: "Quảng Nam",
      cachDung: "Ăn tươi, làm bánh",
      baoQuan: "Nơi mát 5-7 ngày",
    },
    DanhGia: [],
    HinhAnh: [],
  },
  {
    MaHangHoa: 5,
    TenHangHoa: "Bưởi da xanh",
    MoTaChiTiet: "Bưởi da xanh Thanh Hóa, múi hồng, ngọt thanh, ít hạt.",
    ThongTinMoRong: {
      nguonGoc: "Thanh Hóa",
      cachDung: "Ăn tươi, làm nước ép",
      baoQuan: "Nơi khô ráo 2 tuần",
    },
    DanhGia: [],
    HinhAnh: [],
  },
  {
    MaHangHoa: 6,
    TenHangHoa: "Rau cải xoong",
    MoTaChiTiet:
      "Cải xoong Nhật, trồng tại vùng nước sạch chảy liên tục. Thân mập, lá xanh đậm, giòn ngọt, giàu vitamin K.",
    ThongTinMoRong: {
      nguonGoc: "Miền Trung",
      cachCheBien: "Luộc, nấu lẩu, ăn sống",
      baoQuan: "Ngăn mát 2-3 ngày",
    },
    DanhGia: [
      {
        nguoiDanhGia: "Lê Văn Tùng",
        soSao: 4,
        noiDung: "Rau giòn, ngọt, nhưng hơi ít",
        ngayDanhGia: new Date("2024-12-11"),
      },
    ],
    HinhAnh: [],
  },
  {
    MaHangHoa: 7,
    TenHangHoa: "Gạo ST25",
    MoTaChiTiet:
      "Gạo ngon nhất thế giới, hạt dài, trắng trong, không bạc bụng. Cơm dẻo thơm, ngọt tự nhiên, giữ được độ mềm lâu.",
    ThongTinMoRong: {
      nguonGoc: "Sóc Trăng",
      chungNhan: ["VietGAP", "GlobalGAP", "Organic"],
      cachNau: "Vo 2-3 lần, tỷ lệ gạo:nước = 1:1.2",
    },
    DanhGia: [
      {
        nguoiDanhGia: "Đặng Văn Hải",
        soSao: 5,
        noiDung: "Gạo ngon nhất từng ăn, cơm dẻo thơm!",
        ngayDanhGia: new Date("2024-12-13"),
      },
    ],
    HinhAnh: [],
  },
  {
    MaHangHoa: 8,
    TenHangHoa: "Xoài cát Hòa Lộc",
    MoTaChiTiet:
      "Vua của các loại xoài, trái to, màu vàng tươi, thịt mịn, ít xơ, ngọt lịm. Chỉ trồng được ở Tiền Giang.",
    ThongTinMoRong: {
      nguonGoc: "Tiền Giang",
      baoQuan: "Tủ lạnh khi chín",
      chungNhan: ["VietGAP"],
    },
    DanhGia: [
      {
        nguoiDanhGia: "Bùi Thị Mai",
        soSao: 5,
        noiDung: "Xoài ngọt như mật, thơm nức mũi!",
        ngayDanhGia: new Date("2024-12-14"),
      },
    ],
    HinhAnh: [],
  },
  {
    MaHangHoa: 9,
    TenHangHoa: "Dừa xiêm Bến Tre",
    MoTaChiTiet:
      "Dừa xiêm lùn, nước ngọt thanh, cơm dừa mỏng vừa ăn. Giải khát tuyệt vời.",
    ThongTinMoRong: {
      nguonGoc: "Bến Tre",
      cachDung: "Uống nước, nạo cơm làm bánh",
      baoQuan: "Nơi mát 5-7 ngày",
    },
    DanhGia: [],
    HinhAnh: [],
  },
  {
    MaHangHoa: 10,
    TenHangHoa: "Khoai lang mật",
    MoTaChiTiet:
      "Khoai lang mật Tà Nung, nướng lên chảy mật, ngọt lịm, ruột vàng cam. Giàu beta-carotene.",
    ThongTinMoRong: {
      nguonGoc: "Đà Lạt",
      cachCheBien: "Nướng, luộc, hấp, làm bánh",
      baoQuan: "Nơi khô ráo 2 tuần",
    },
    DanhGia: [
      {
        nguoiDanhGia: "Ngô Văn Cường",
        soSao: 5,
        noiDung: "Khoai ngọt, thơm, nướng lên chảy nước!",
        ngayDanhGia: new Date("2024-12-15"),
      },
    ],
    HinhAnh: [],
  },
  {
    MaHangHoa: 11,
    TenHangHoa: "Sầu riêng Monthong",
    MoTaChiTiet:
      "Sầu riêng Thái hạt lép, cơm vàng dày, béo ngậy, mùi thơm nồng nàn. Vị ngọt đậm đà.",
    ThongTinMoRong: {
      nguonGoc: "Miền Nam (giống Thái)",
      cachCheBien: "Ăn tươi, làm kem, sinh tố",
      baoQuan: "Tủ lạnh sau khi bóc 3 ngày",
    },
    DanhGia: [
      {
        nguoiDanhGia: "Lê Văn Cường",
        soSao: 5,
        noiDung: "Sầu riêng ngon tuyệt, cơm dày, ngọt béo!",
        ngayDanhGia: new Date("2024-12-16"),
      },
    ],
    HinhAnh: [],
  },
  {
    MaHangHoa: 12,
    TenHangHoa: "Chôm chôm nhãn",
    MoTaChiTiet:
      "Trái nhỏ, vỏ xanh vàng hoặc đỏ, gai ngắn. Cơm dày, giòn, tróc hạt, vị ngọt thanh.",
    ThongTinMoRong: {
      nguonGoc: "Miền Nam",
      cachDung: "Ăn tươi, làm mứt",
      baoQuan: "Tủ lạnh 5 ngày",
    },
    DanhGia: [],
    HinhAnh: [],
  },
];

// URL ảnh giả định - THAY BẰNG URL THỰC TỪ uploaded-images.json
const cloudinaryUrls = {
  1: "https://res.cloudinary.com/dznbskxv6/image/upload/v1/nongsan-images/product_1",
  2: "https://res.cloudinary.com/dznbskxv6/image/upload/v1/nongsan-images/product_2",
  3: "https://res.cloudinary.com/dznbskxv6/image/upload/v1/nongsan-images/product_3",
  4: "https://res.cloudinary.com/dznbskxv6/image/upload/v1/nongsan-images/product_4",
  5: "https://res.cloudinary.com/dznbskxv6/image/upload/v1/nongsan-images/product_5",
  6: "https://res.cloudinary.com/dznbskxv6/image/upload/v1/nongsan-images/product_6",
  7: "https://res.cloudinary.com/dznbskxv6/image/upload/v1/nongsan-images/product_7",
  8: "https://res.cloudinary.com/dznbskxv6/image/upload/v1/nongsan-images/product_8",
  9: "https://res.cloudinary.com/dznbskxv6/image/upload/v1/nongsan-images/product_9",
  10: "https://res.cloudinary.com/dznbskxv6/image/upload/v1/nongsan-images/product_10",
  11: "https://res.cloudinary.com/dznbskxv6/image/upload/v1/nongsan-images/product_11",
  12: "https://res.cloudinary.com/dznbskxv6/image/upload/v1/nongsan-images/product_12",
};

async function updateMongoImages() {
  let client;
  try {
    console.log("🔌 Đang kết nối MongoDB...");
    client = new MongoClient(mongoUrl);
    await client.connect();
    const db = client.db(mongoDbName);
    console.log("Kết nối MongoDB thành công!");

    // Đọc URL từ file nếu có
    let uploadedUrls = cloudinaryUrls;
    if (fs.existsSync("uploaded-images.json")) {
      uploadedUrls = JSON.parse(
        fs.readFileSync("uploaded-images.json", "utf8")
      );
      console.log("Đã load URL từ uploaded-images.json");
    }

    // Xóa collection cũ
    try {
      await db.collection("hanghoa_details").drop();
      console.log("Đã xóa collection cũ");
    } catch (error) {
      console.log("ℹ Collection chưa tồn tại, tạo mới...");
    }

    // Gán URL ảnh cho từng sản phẩm
    productDetails.forEach((product) => {
      const url = uploadedUrls[product.MaHangHoa];
      if (url) {
        product.HinhAnh = [url];
      }
    });

    // Insert dữ liệu
    const result = await db
      .collection("hanghoa_details")
      .insertMany(productDetails);

    console.log(
      `Đã insert ${result.insertedCount} sản phẩm với ảnh Cloudinary!`
    );

    // Hiển thị mẫu
    console.log("\n📸 Mẫu dữ liệu (3 sản phẩm đầu):");
    const samples = await db
      .collection("hanghoa_details")
      .find({})
      .limit(3)
      .toArray();

    samples.forEach((s) => {
      console.log(`\n- ${s.TenHangHoa}: ${s.HinhAnh[0] || "Chưa có ảnh"}`);
    });

    console.log(
      "\nHOÀN THÀNH! MongoDB đã được cập nhật với URL ảnh từ Cloudinary."
    );
  } catch (error) {
    console.error("❌ Lỗi:", error.message);
  } finally {
    if (client) {
      await client.close();
      console.log("Đã đóng kết nối MongoDB");
    }
  }
}

updateMongoImages();
