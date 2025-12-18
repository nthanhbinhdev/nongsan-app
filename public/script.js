const API_URL = "http://localhost:3000/api";
let currentTab = "products";
let categories = [];
let suppliers = [];
let customers = [];
let products = [];

// Sort state
let sortConfig = {
  products: { by: "MaHangHoa", order: "DESC" },
  orders: { by: "NgayDatHang", order: "DESC" },
  customers: { by: "NgayDangKy", order: "DESC" },
};

// =================================================================
// INITIALIZATION
// =================================================================
document.addEventListener("DOMContentLoaded", () => {
  console.log("🌾 Dashboard khởi động...");
  loadCategories();
  loadSuppliers();
  loadCustomers();
  loadProducts();
  checkSystemHealth();
  setupEventListeners();
});

function setupEventListeners() {
  document
    .getElementById("region-filter")
    .addEventListener("change", loadCurrentTabData);

  const searchInput = document.getElementById("search-products");
  if (searchInput) {
    searchInput.addEventListener("keyup", (e) => {
      if (e.key === "Enter") loadProducts();
    });
  }
}

// =================================================================
// TAB SWITCHING
// =================================================================
function switchTab(tabName) {
  currentTab = tabName;

  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tabName);
  });

  document.querySelectorAll(".tab-content").forEach((content) => {
    content.classList.remove("active");
  });
  document.getElementById(`tab-${tabName}`).classList.add("active");

  loadCurrentTabData();
}

function loadCurrentTabData() {
  switch (currentTab) {
    case "products":
      loadProducts();
      break;
    case "orders":
      loadOrders();
      break;
    case "customers":
      loadCustomers();
      break;
    case "statistics":
      loadStatistics();
      break;
  }
}

// =================================================================
// SYSTEM HEALTH CHECK
// =================================================================
async function checkSystemHealth() {
  try {
    const response = await fetch(`${API_URL}/health`);
    const data = await response.json();
    const dot = document.getElementById("health-dot");

    if (data.success) {
      dot.classList.add("healthy");
      console.log("✅ Hệ thống hoạt động:", data);
    } else {
      dot.classList.remove("healthy");
      console.error("❌ Hệ thống lỗi:", data);
    }
  } catch (error) {
    console.error("❌ Không kết nối được server:", error);
    document.getElementById("health-dot").classList.remove("healthy");
  }
}

// =================================================================
// LOAD CATEGORIES, SUPPLIERS, CUSTOMERS
// =================================================================
async function loadCategories() {
  try {
    const response = await fetch(`${API_URL}/categories`);
    const data = await response.json();
    if (data.success) {
      categories = data.data;
      updateCategorySelect();
    }
  } catch (error) {
    console.error("Lỗi load danh mục:", error);
  }
}

async function loadSuppliers() {
  try {
    const response = await fetch(`${API_URL}/suppliers`);
    const data = await response.json();
    if (data.success) {
      suppliers = data.data;
      updateSupplierSelect();
    }
  } catch (error) {
    console.error("Lỗi load nhà cung cấp:", error);
  }
}

async function loadCustomersData() {
  try {
    const response = await fetch(`${API_URL}/customers?limit=500`);
    const data = await response.json();
    if (data.success) {
      customers = data.data;
      updateCustomerSelect();
    }
  } catch (error) {
    console.error("Lỗi load khách hàng:", error);
  }
}

function updateCategorySelect() {
  const select = document.getElementById("form-category");
  if (!select) return;
  select.innerHTML = '<option value="">Chọn danh mục</option>';
  categories.forEach((cat) => {
    select.innerHTML += `<option value="${cat.MaDanhMuc}">${cat.TenDanhMuc}</option>`;
  });
}

function updateSupplierSelect() {
  const select = document.getElementById("form-supplier");
  if (!select) return;
  select.innerHTML = '<option value="">Chọn nhà cung cấp</option>';
  suppliers.forEach((sup) => {
    select.innerHTML += `<option value="${sup.MaNhaCungCap}">${sup.TenNhaCungCap}</option>`;
  });
}

function updateCustomerSelect() {
  const select = document.getElementById("form-order-customer");
  if (!select) return;
  select.innerHTML = '<option value="">Chọn khách hàng</option>';
  customers.forEach((c) => {
    select.innerHTML += `<option value="${c.MaKhachHang}">${c.TenKhachHang} - ${
      c.SoDienThoai || "N/A"
    }</option>`;
  });
}

// =================================================================
// PRODUCTS - CRUD
// =================================================================
async function loadProducts() {
  const wrapper = document.getElementById("products-table");
  const region = document.getElementById("region-filter").value;
  const search = document.getElementById("search-products")?.value || "";

  wrapper.innerHTML = '<div class="loading">⏳ Đang tải dữ liệu...</div>';

  try {
    let url = `${API_URL}/products?limit=100&sortBy=${sortConfig.products.by}&sortOrder=${sortConfig.products.order}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    if (region) url += `&vungmien=${region}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.success && data.data.length > 0) {
      products = data.data;
      renderProductsTable(data.data);
    } else {
      wrapper.innerHTML =
        '<div class="no-data">😢 Không tìm thấy sản phẩm</div>';
    }
  } catch (error) {
    console.error("Lỗi load sản phẩm:", error);
    wrapper.innerHTML = '<div class="error">❌ Lỗi kết nối server</div>';
  }
}

function renderProductsTable(products) {
  const wrapper = document.getElementById("products-table");
  const sortIcons = {
    MaHangHoa:
      sortConfig.products.by === "MaHangHoa"
        ? sortConfig.products.order === "ASC"
          ? "↑"
          : "↓"
        : "",
    TenHangHoa:
      sortConfig.products.by === "TenHangHoa"
        ? sortConfig.products.order === "ASC"
          ? "↑"
          : "↓"
        : "",
    DonGiaBan:
      sortConfig.products.by === "DonGiaBan"
        ? sortConfig.products.order === "ASC"
          ? "↑"
          : "↓"
        : "",
    SoLuongTon:
      sortConfig.products.by === "SoLuongTon"
        ? sortConfig.products.order === "ASC"
          ? "↑"
          : "↓"
        : "",
  };

  let html = `
    <table class="data-table">
      <thead>
        <tr>
          <th onclick="sortTable('products', 'MaHangHoa')" style="cursor:pointer">Mã ${sortIcons.MaHangHoa}</th>
          <th onclick="sortTable('products', 'TenHangHoa')" style="cursor:pointer">Tên sản phẩm ${sortIcons.TenHangHoa}</th>
          <th>Danh mục</th>
          <th>Vùng miền</th>
          <th onclick="sortTable('products', 'DonGiaBan')" style="cursor:pointer">Giá bán ${sortIcons.DonGiaBan}</th>
          <th onclick="sortTable('products', 'SoLuongTon')" style="cursor:pointer">Tồn kho ${sortIcons.SoLuongTon}</th>
          <th>Thao tác</th>
        </tr>
      </thead>
      <tbody>
  `;

  products.forEach((p) => {
    html += `
      <tr>
        <td><strong>#${p.MaHangHoa}</strong></td>
        <td><strong>${p.TenHangHoa}</strong></td>
        <td>${p.TenDanhMuc || "N/A"}</td>
        <td><span class="region-badge region-${p.VungMien}">${getRegionName(
      p.VungMien
    )}</span></td>
        <td><strong>${formatCurrency(p.DonGiaBan)}</strong></td>
        <td>${p.SoLuongTon} ${p.DonViTinh || ""}</td>
        <td>
          <button class="btn-primary btn-sm" onclick="viewProductDetail(${
            p.MaHangHoa
          })">Xem</button>
          <button class="btn-secondary btn-sm" onclick="editProduct(${
            p.MaHangHoa
          })">Sửa</button>
        </td>
      </tr>
    `;
  });

  html += `</tbody></table>`;
  wrapper.innerHTML = html;
}

async function viewProductDetail(id) {
  const modal = document.getElementById("modal-product-detail");
  const content = document.getElementById("product-detail-content");

  modal.style.display = "block";
  content.innerHTML =
    '<div class="loading">⏳ Đang tải chi tiết từ SQL + MongoDB...</div>';

  try {
    const response = await fetch(`${API_URL}/product/${id}`);
    const result = await response.json();

    if (!result.success) throw new Error(result.message);

    const p = result.data;

    let html = `
      <div class="product-detail">
        <div class="product-header">
          <h2>${p.TenHangHoa}</h2>
          <span class="region-badge region-${p.VungMien}">${getRegionName(
      p.VungMien
    )}</span>
        </div>
    `;

    if (p.HinhAnh && p.HinhAnh.length > 0) {
      html += `<div class="product-images"><img src="${p.HinhAnh[0]}" alt="${p.TenHangHoa}" class="main-image" /></div>`;
    } else {
      html += `<div class="no-image">📷 Chưa có ảnh</div>`;
    }

    html += `
      <div class="product-info">
        <h3>Thông tin giá</h3>
        <div class="info-grid">
          <div><span>Giá bán:</span><strong>${formatCurrency(
            p.DonGiaBan
          )}</strong></div>
          <div><span>Giá nhập:</span><span>${formatCurrency(
            p.DonGiaNhap
          )}</span></div>
          <div><span>Tồn kho:</span><span>${p.SoLuongTon} ${
      p.DonViTinh
    }</span></div>
          <div><span>Đơn vị:</span><span>${p.DonViTinh || "N/A"}</span></div>
        </div>

        <h3>Chi tiết</h3>
        <div class="info-grid">
          <div><span>Danh mục:</span><span>${p.TenDanhMuc}</span></div>
          <div><span>Nhà cung cấp:</span><span>${
            p.TenNhaCungCap || "N/A"
          }</span></div>
          <div><span>Hạn sử dụng:</span><span>${
            p.HanSuDung
              ? new Date(p.HanSuDung).toLocaleDateString("vi-VN")
              : "N/A"
          }</span></div>
        </div>
      </div>
    `;

    if (p.MoTaChiTiet) {
      html += `<div class="product-description"><h3>Mô tả chi tiết (MongoDB)</h3><p>${p.MoTaChiTiet}</p></div>`;
    }

    if (p.ThongTinMoRong && Object.keys(p.ThongTinMoRong).length > 0) {
      html += `
        <div class="extended-info">
          <h3>ℹThông tin mở rộng (MongoDB)</h3>
          <div class="info-grid">
            ${Object.entries(p.ThongTinMoRong)
              .map(
                ([key, value]) =>
                  `<div><span>${key}:</span><span>${
                    Array.isArray(value) ? value.join(", ") : value
                  }</span></div>`
              )
              .join("")}
          </div>
        </div>
      `;
    }

    if (p.DanhGia && p.DanhGia.length > 0) {
      html += `
        <div class="reviews">
          <h3>⭐ Đánh giá (MongoDB)</h3>
          ${p.DanhGia.map(
            (r) => `
            <div class="review-item">
              <div><strong>${r.nguoiDanhGia}</strong> - ${"⭐".repeat(
              r.soSao
            )}</div>
              <p>${r.noiDung}</p>
              <small>${new Date(r.ngayDanhGia).toLocaleDateString(
                "vi-VN"
              )}</small>
            </div>
          `
          ).join("")}
        </div>
      `;
    };

    content.innerHTML = html;
  } catch (error) {
    console.error("Lỗi load chi tiết:", error);
    content.innerHTML = `<div class="error">❌ Lỗi: ${error.message}</div>`;
  }
}

function openAddProductModal() {
  document.getElementById("form-title").textContent = "Thêm sản phẩm mới";
  document.getElementById("product-form").reset();
  document.getElementById("form-product-id").value = "";
  document.getElementById("preview-image").style.display = "none";
  document.getElementById("modal-product-form").style.display = "block";
}

async function editProduct(id) {
  try {
    const response = await fetch(`${API_URL}/product/${id}`);
    const result = await response.json();

    if (result.success) {
      const p = result.data;
      document.getElementById("form-title").textContent = "Sửa sản phẩm";
      document.getElementById("form-product-id").value = p.MaHangHoa;
      document.getElementById("form-name").value = p.TenHangHoa;
      document.getElementById("form-category").value = p.MaDanhMuc;
      document.getElementById("form-supplier").value = p.MaNhaCungCap || "";
      document.getElementById("form-region").value = p.VungMien;
      document.getElementById("form-unit").value = p.DonViTinh || "";
      document.getElementById("form-cost").value = p.DonGiaNhap || "";
      document.getElementById("form-price").value = p.DonGiaBan;
      document.getElementById("form-stock").value = p.SoLuongTon;
      document.getElementById("form-expiry").value = p.HanSuDung
        ? p.HanSuDung.split("T")[0]
        : "";
      document.getElementById("form-description").value = p.MoTaChiTiet || "";

      const preview = document.getElementById("preview-image");
      if (p.HinhAnh && p.HinhAnh[0]) {
        preview.src = p.HinhAnh[0];
        preview.style.display = "block";
      } else {
        preview.style.display = "none";
      }

      document.getElementById("modal-product-form").style.display = "block";
    }
  } catch (error) {
    alert("Lỗi tải sản phẩm: " + error.message);
  }
}

function previewProductImage(input) {
  const preview = document.getElementById("preview-image");
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = (e) => {
      preview.src = e.target.result;
      preview.style.display = "block";
    };
    reader.readAsDataURL(input.files[0]);
  }
}

async function handleProductSubmit(e) {
  e.preventDefault();

  const id = document.getElementById("form-product-id").value;
  const formData = new FormData();

  formData.append("TenHangHoa", document.getElementById("form-name").value);
  formData.append(
    "MaDanhMuc",
    parseInt(document.getElementById("form-category").value)
  );
  const supplierId = document.getElementById("form-supplier").value;
  if (supplierId) formData.append("MaNhaCungCap", parseInt(supplierId));
  formData.append("VungMien", document.getElementById("form-region").value);
  formData.append("DonViTinh", document.getElementById("form-unit").value);
  formData.append(
    "DonGiaNhap",
    parseFloat(document.getElementById("form-cost").value) || 0
  );
  formData.append(
    "DonGiaBan",
    parseFloat(document.getElementById("form-price").value)
  );
  formData.append(
    "SoLuongTon",
    parseInt(document.getElementById("form-stock").value)
  );
  const expiry = document.getElementById("form-expiry").value;
  if (expiry) formData.append("HanSuDung", expiry);
  formData.append(
    "MoTaChiTiet",
    document.getElementById("form-description").value
  );

  const imageFile = document.getElementById("form-image").files[0];
  if (imageFile) formData.append("image", imageFile);

  try {
    const url = id ? `${API_URL}/product/${id}` : `${API_URL}/product`;
    const method = id ? "PUT" : "POST";

    const response = await fetch(url, { method, body: formData });
    const result = await response.json();

    if (result.success) {
      alert(id ? "Cập nhật thành công!" : "Thêm sản phẩm thành công!");
      closeModal("modal-product-form");
      loadProducts();
    } else {
      alert("❌ Lỗi: " + result.message);
    }
  } catch (error) {
    alert("❌ Lỗi khi lưu: " + error.message);
  }
}

// =================================================================
// ORDERS
// =================================================================
async function loadOrders() {
  const wrapper = document.getElementById("orders-table");
  const region = document.getElementById("region-filter").value;
  const countBadge = document.getElementById("orders-count");

  wrapper.innerHTML = '<div class="loading">Đang tải đơn hàng...</div>';

  try {
    let url = `${API_URL}/orders?limit=100&sortBy=${sortConfig.orders.by}&sortOrder=${sortConfig.orders.order}`;
    if (region) url += `&vungmien=${region}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.success && data.data.length > 0) {
      countBadge.textContent = `${data.count} đơn hàng`;
      renderOrdersTable(data.data);
    } else {
      wrapper.innerHTML = '<div class="no-data">Không có đơn hàng</div>';
      countBadge.textContent = "0 đơn hàng";
    }
  } catch (error) {
    wrapper.innerHTML = '<div class="error">Lỗi kết nối :(</div>';
  }
}

function renderOrdersTable(orders) {
  const wrapper = document.getElementById("orders-table");

  let html = `
    <table class="data-table">
      <thead>
        <tr>
          <th onclick="sortTable('orders', 'MaDonHang')" style="cursor:pointer">Mã đơn</th>
          <th>Khách hàng</th>
          <th>Vùng miền</th>
          <th onclick="sortTable('orders', 'NgayDatHang')" style="cursor:pointer">Ngày đặt</th>
          <th onclick="sortTable('orders', 'TongTien')" style="cursor:pointer">Tổng tiền</th>
          <th>Trạng thái</th>
          <th>Thao tác</th>
        </tr>
      </thead>
      <tbody>
  `;

  orders.forEach((o) => {
    html += `
      <tr>
        <td><code>${o.MaDonHang.substring(0, 8)}...</code></td>
        <td><strong>${o.TenKhachHang}</strong></td>
        <td><span class="region-badge region-${o.VungMien}">${getRegionName(
      o.VungMien
    )}</span></td>
        <td>${new Date(o.NgayDatHang).toLocaleDateString("vi-VN")}</td>
        <td><strong>${formatCurrency(o.TongTien)}</strong></td>
        <td>${o.TrangThaiDonHang}</td>
        <td>
          <button class="btn-primary btn-sm" onclick="viewOrderDetail('${
            o.MaDonHang
          }')">Xem</button>
          <button class="btn-secondary btn-sm" onclick="editOrderStatus('${
            o.MaDonHang
          }', '${o.TrangThaiDonHang}')">Cập nhật</button>
        </td>
      </tr>
    `;
  });

  html += `</tbody></table>`;
  wrapper.innerHTML = html;
}

async function viewOrderDetail(id) {
  try {
    const response = await fetch(`${API_URL}/order/${id}`);
    const result = await response.json();
    if (!result.success) throw new Error(result.message);

    const o = result.data;
    alert(
      `Đơn hàng: ${id}\nKhách: ${
        o.KhachHang.TenKhachHang
      }\nTổng: ${formatCurrency(o.TongTien)}\nChi tiết: ${
        o.ChiTiet.length
      } sản phẩm`
    );
  } catch (error) {
    alert("Lỗi: " + error.message);
  }
}

async function editOrderStatus(id, currentStatus) {
  const statuses = ["Chờ xử lý", "Đang giao", "Hoàn thành", "Đã hủy"];
  const newStatus = prompt(
    `Trạng thái hiện tại: ${currentStatus}\n\nChọn trạng thái mới:\n${statuses
      .map((s, i) => `${i + 1}. ${s}`)
      .join("\n")}`
  );

  if (!newStatus || isNaN(newStatus)) return;
  const status = statuses[parseInt(newStatus) - 1];
  if (!status) return alert("Lựa chọn không hợp lệ");

  try {
    const response = await fetch(`${API_URL}/order/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ TrangThaiDonHang: status }),
    });
    const result = await response.json();
    if (result.success) {
      alert("Cập nhật thành công!");
      loadOrders();
    } else {
      alert("Lỗi: " + result.message);
    }
  } catch (error) {
    alert("Lỗi: " + error.message);
  }
}

function openAddOrderModal() {
  loadCustomersData();
  document.getElementById("modal-order-form").style.display = "block";
  document.getElementById("order-items-list").innerHTML = "";
}

function addOrderItem() {
  const container = document.getElementById("order-items-list");
  const itemDiv = document.createElement("div");
  itemDiv.className = "order-item-row";
  itemDiv.innerHTML = `
    <select class="product-select" required>
      <option value="">Chọn sản phẩm</option>
      ${products
        .map(
          (p) =>
            `<option value="${p.MaHangHoa}" data-price="${p.DonGiaBan}">${
              p.TenHangHoa
            } - ${formatCurrency(p.DonGiaBan)}</option>`
        )
        .join("")}
    </select>
    <input type="number" class="quantity-input" placeholder="SL" min="1" value="1" required />
    <button type="button" class="btn-danger btn-sm" onclick="this.parentElement.remove()">Xóa</button>
  `;
  container.appendChild(itemDiv);
}

async function handleOrderSubmit(e) {
  e.preventDefault();

  const customerId = document.getElementById("form-order-customer").value;
  const region = document.getElementById("form-order-region").value;

  const items = [];
  document
    .querySelectorAll("#order-items-list .order-item-row")
    .forEach((row) => {
      const select = row.querySelector(".product-select");
      const quantity = row.querySelector(".quantity-input").value;
      const price = select.options[select.selectedIndex].dataset.price;

      if (select.value && quantity) {
        items.push({
          MaHangHoa: parseInt(select.value),
          SoLuong: parseInt(quantity),
          DonGia: parseFloat(price),
        });
      }
    });

  if (items.length === 0) return alert("Vui lòng thêm ít nhất 1 sản phẩm!");

  try {
    const response = await fetch(`${API_URL}/order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        MaKhachHang: parseInt(customerId),
        VungMien: region,
        TrangThaiDonHang: "Chờ xử lý",
        ChiTiet: items,
      }),
    });

    const result = await response.json();
    if (result.success) {
      alert("Tạo đơn hàng thành công!");
      closeModal("modal-order-form");
      loadOrders();
    } else {
      alert("Lỗi: " + result.message);
    }
  } catch (error) {
    alert("Lỗi: " + error.message);
  }
}

// =================================================================
// CUSTOMERS
// =================================================================
async function loadCustomers() {
  const wrapper = document.getElementById("customers-table");
  const region = document.getElementById("region-filter").value;
  const countBadge = document.getElementById("customers-count");

  wrapper.innerHTML = '<div class="loading">Đang tải khách hàng...</div>';

  try {
    let url = `${API_URL}/customers?limit=100&sortBy=${sortConfig.customers.by}&sortOrder=${sortConfig.customers.order}`;
    if (region) url += `&vungmien=${region}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.success && data.data.length > 0) {
      countBadge.textContent = `${data.count} khách hàng`;
      renderCustomersTable(data.data);
    } else {
      wrapper.innerHTML = '<div class="no-data">Không có khách hàng</div>';
      countBadge.textContent = "0 khách hàng";
    }
  } catch (error) {
    wrapper.innerHTML = '<div class="error">Lỗi kết nối :(</div>';
  }
}

function renderCustomersTable(customers) {
  const wrapper = document.getElementById("customers-table");

  let html = `
    <table class="data-table">
      <thead>
        <tr>
          <th onclick="sortTable('customers', 'MaKhachHang')" style="cursor:pointer">Mã KH</th>
          <th onclick="sortTable('customers', 'TenKhachHang')" style="cursor:pointer">Tên khách hàng</th>
          <th>Email</th>
          <th>SĐT</th>
          <th>Vùng miền</th>
          <th>Loại KH</th>
          <th onclick="sortTable('customers', 'DiemTichLuy')" style="cursor:pointer">Điểm</th>
          <th>Thao tác</th>
        </tr>
      </thead>
      <tbody>
  `;

  customers.forEach((c) => {
    html += `
      <tr>
        <td><strong>#${c.MaKhachHang}</strong></td>
        <td><strong>${c.TenKhachHang}</strong></td>
        <td>${c.Email || "N/A"}</td>
        <td>${c.SoDienThoai || "N/A"}</td>
        <td><span class="region-badge region-${c.VungMien}">${getRegionName(
      c.VungMien
    )}</span></td>
        <td>${c.LoaiKhachHang}</td>
        <td><strong>${c.DiemTichLuy}</strong></td>
        <td>
          <button class="btn-secondary btn-sm" onclick="editCustomer(${
            c.MaKhachHang
          })">Sửa</button>
        </td>
      </tr>
    `;
  });

  html += `</tbody></table>`;
  wrapper.innerHTML = html;
}

function openAddCustomerModal() {
  document.getElementById("customer-form").reset();
  document.getElementById("form-customer-id").value = "";
  document.getElementById("customer-form-title").textContent =
    "Thêm khách hàng mới";
  document.getElementById("modal-customer-form").style.display = "block";
}

async function editCustomer(id) {
  try {
    const response = await fetch(`${API_URL}/customer/${id}`);
    const result = await response.json();

    if (result.success) {
      const c = result.data;
      document.getElementById("customer-form-title").textContent =
        "Sửa khách hàng";
      document.getElementById("form-customer-id").value = c.MaKhachHang;
      document.getElementById("form-customer-name").value = c.TenKhachHang;
      document.getElementById("form-customer-email").value = c.Email || "";
      document.getElementById("form-customer-phone").value =
        c.SoDienThoai || "";
      document.getElementById("form-customer-address").value = c.DiaChi || "";
      document.getElementById("form-customer-region").value = c.VungMien;
      document.getElementById("form-customer-type").value = c.LoaiKhachHang;

      document.getElementById("modal-customer-form").style.display = "block";
    }
  } catch (error) {
    alert("Lỗi tải khách hàng: " + error.message);
  }
}

async function handleCustomerSubmit(e) {
  e.preventDefault();

  const id = document.getElementById("form-customer-id").value;
  const data = {
    TenKhachHang: document.getElementById("form-customer-name").value,
    Email: document.getElementById("form-customer-email").value,
    SoDienThoai: document.getElementById("form-customer-phone").value,
    DiaChi: document.getElementById("form-customer-address").value,
    VungMien: document.getElementById("form-customer-region").value,
    LoaiKhachHang: document.getElementById("form-customer-type").value,
  };

  try {
    const url = id ? `${API_URL}/customer/${id}` : `${API_URL}/customer`;
    const method = id ? "PUT" : "POST";

    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    const result = await response.json();
    if (result.success) {
      alert(id ? "Cập nhật thành công!" : "Thêm khách hàng thành công!");
      closeModal("modal-customer-form");
      loadCustomers();
    } else {
      alert("Lỗi: " + result.message);
    }
  } catch (error) {
    alert("Lỗi: " + error.message);
  }
}

// =================================================================
// STATISTICS
// =================================================================
async function loadStatistics() {
  const wrapper = document.getElementById("statistics-content");
  wrapper.innerHTML = '<div class="loading">Đang tải thống kê...</div>';

  try {
    const response = await fetch(`${API_URL}/statistics`);
    const result = await response.json();

    if (result.success) {
      const stats = result.data;
      let html = ``;
      stats.theoVungMien.forEach((region) => {
        html += `
          <div class="stat-card">
            <h3>${getRegionName(region.VungMien)}</h3>
            <div class="stat-value">${region.SoLuongSanPham}</div>
            <div class="stat-label">Sản phẩm</div>
            <hr />
            <div class="stat-detail">Tồn kho: <strong>${
              region.TongSoLuongTon
            }</strong></div>
            <div class="stat-detail">Giá TB: <strong>${formatCurrency(
              region.GiaTrungBinh
            )}</strong></div>
          </div>
        `;
      });

      html += `
        <div class="stat-card">
          <h3>🍃 MongoDB</h3>
          <div class="stat-value">${
            stats.tongQuan.tongSanPhamCoChiTiet || 0
          }</div>
          <div class="stat-label">Sản phẩm có chi tiết</div>
          <hr />
          <div class="stat-detail">Đánh giá: <strong>${
            stats.tongQuan.tongDanhGia || 0
          }</strong></div>
        </div>
      `;

      wrapper.innerHTML = html;
    }
  } catch (error) {
    wrapper.innerHTML = '<div class="error">Lỗi tải thống kê :(</div>';
  }
}

// =================================================================
// SORT TABLE
// =================================================================
function sortTable(table, column) {
  if (sortConfig[table].by === column) {
    sortConfig[table].order =
      sortConfig[table].order === "ASC" ? "DESC" : "ASC";
  } else {
    sortConfig[table].by = column;
    sortConfig[table].order = "ASC";
  }
  loadCurrentTabData();
}

// =================================================================
// UTILITIES
// =================================================================
function closeModal(modalId) {
  document.getElementById(modalId).style.display = "none";
}

function getRegionName(code) {
  const names = {
    MienBac: "Miền Bắc",
    MienTrung: "Miền Trung",
    MienNam: "Miền Nam",
  };
  return names[code] || code;
}

function formatCurrency(value) {
  if (!value) return "N/A";
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(value);
}

window.onclick = function (event) {
  if (event.target.classList.contains("modal")) {
    event.target.style.display = "none";
  }
};
