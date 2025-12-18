// ============================================================
// SCRIPT UPLOAD HÌNH ẢNH LÊN CLOUDINARY
// Chạy: node upload-images.js
// ============================================================
require("dotenv").config();
const cloudinary = require("cloudinary").v2;
const fs = require("fs");
const path = require("path");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Mapping tên file với MaHangHoa
const imageMapping = {
  "rau-muong.jpg": 1,
  "su_hao.jpg": 2,
  "cam-cao-phong.jpg": 3,
  "chuoi_laba.jpg": 4,
  "buoi_da_xanh.jpg": 5,
  "cai-xoong.jpg": 6,
  "gao-st25-1.jpg": 7,
  "xoai-hoa-loc.jpg": 8,
  "dua-xiem.jpg": 9,
  "khoai-lang-mat.jpg": 10,
  "sau-rieng.jpg": 11,
  "chom-chom.jpg": 12,
};

// Thư mục chứa ảnh
const IMAGE_FOLDER = path.join(__dirname, "Product_Images");

async function uploadImages() {
  console.log("🚀 BẮT ĐẦU UPLOAD ẢNH LÊN CLOUDINARY...\n");

  const uploadedImages = {};
  const files = fs.readdirSync(IMAGE_FOLDER);

  for (const file of files) {
    if (!/\.(jpg|jpeg|png|webp)$/i.test(file)) continue;

    const filePath = path.join(IMAGE_FOLDER, file);
    const fileName = file.toLowerCase();

    // Tìm MaHangHoa tương ứng
    let maHangHoa = null;
    for (const [key, value] of Object.entries(imageMapping)) {
      if (fileName.includes(key.replace(/\.(jpg|jpeg|png)/i, ""))) {
        maHangHoa = value;
        break;
      }
    }

    try {
      console.log(`📤 Đang upload: ${file}...`);
      const result = await cloudinary.uploader.upload(filePath, {
        folder: "nongsan-images",
        public_id: `product_${maHangHoa || file.split(".")[0]}`,
        overwrite: true,
        transformation: [{ width: 800, height: 800, crop: "limit" }],
      });

      uploadedImages[maHangHoa || file] = result.secure_url;
      console.log(`✅ Thành công: ${result.secure_url}\n`);
    } catch (error) {
      console.error(`❌ Lỗi upload ${file}:`, error.message);
    }
  }

  // Xuất kết quả
  console.log("\n📋 KẾT QUẢ UPLOAD:");
  console.log(JSON.stringify(uploadedImages, null, 2));

  // Lưu vào file
  fs.writeFileSync(
    "uploaded-images.json",
    JSON.stringify(uploadedImages, null, 2)
  );
  console.log("\n💾 Đã lưu danh sách URL vào: uploaded-images.json");
}

uploadImages().catch(console.error);