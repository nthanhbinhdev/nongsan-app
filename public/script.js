const API_URL = "http://localhost:3000/api";
let currentTab = "products";
let categories = [];
let suppliers = [];
let customers = [];
let products = [];
let branches = [];
let warehouses = [];
let deleteCallback = null;

// Sort state
let sortConfig = {
  products: { by: "MaHangHoa", order: "DESC" },
  orders: { by: "NgayDatHang", order: "DESC" },
  customers: { by: "NgayDangKy", order: "DESC" },
  warehouses: { by: "MaKho", order: "DESC" },
};

// =================================================================
// INITIALIZATION
// =================================================================
document.addEventListener("DOMContentLoaded", () => {
  console.log("Dashboard khởi động...");
  loadCategories();
  loadSuppliers();
  loadCustomers();
  loadBranches();
  loadProducts();
  checkSystemHealth();
  setupEventListeners();
});

function setupEventListeners() {
  document
    .getElementById("region-filter")
    .addEventListener("change", loadCurrentTabData);

  const searchProducts = document.getElementById("search-products");
  if (searchProducts) {
    searchProducts.addEventListener("keyup", (e) => {
      if (e.key === "Enter") loadProducts();
    });
  }

  const searchOrders = document.getElementById("search-orders");
  if (searchOrders) {
    searchOrders.addEventListener("keyup", (e) => {
      if (e.key === "Enter") loadOrders();
    });
  }

  const searchCustomers = document.getElementById("search-customers");
  if (searchCustomers) {
    searchCustomers.addEventListener("keyup", (e) => {
      if (e.key === "Enter") loadCustomers();
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
    case "inventory":
      loadInventory();
      break;
    case "warehouses":
      loadWarehouses();
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
      console.log("Hệ thống hoạt động:", data);
    } else {
      dot.classList.remove("healthy");
      console.error("Hệ thống lỗi:", data);
    }
  } catch (error) {
    console.error("Không kết nối được server:", error);
    document.getElementById("health-dot").classList.remove("healthy");
  }
}

// =================================================================
// LOAD CATEGORIES, SUPPLIERS, CUSTOMERS, BRANCHES
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

async function loadCustomers() {
  try {
    const search = document.getElementById("search-customers")?.value || "";
    let url = `${API_URL}/customers?limit=500&sortBy=${sortConfig.customers.by}&sortOrder=${sortConfig.customers.order}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;

    const response = await fetch(url);
    const data = await response.json();
    if (data.success) {
      customers = data.data;
      updateCustomerSelect();
      if (currentTab === "customers") {
        renderCustomersTable(data.data);
        document.getElementById(
          "customers-count"
        ).textContent = `${data.count} khách hàng`;
      }
    }
  } catch (error) {
    console.error("Lỗi load khách hàng:", error);
  }
}

async function loadBranches() {
  try {
    const response = await fetch(`${API_URL}/branches`);
    const data = await response.json();
    if (data.success) {
      branches = data.data;
      updateBranchSelect();
    }
  } catch (error) {
    console.error("Lỗi load chi nhánh:", error);
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

function updateBranchSelect() {
  const select = document.getElementById("form-warehouse-branch");
  if (!select) return;
  select.innerHTML = '<option value="">Chọn chi nhánh</option>';
  branches.forEach((b) => {
    select.innerHTML += `<option value="${b.MaChiNhanh}">${b.TenChiNhanh} (${b.VungMien})</option>`;
  });
}

// =================================================================
// PRODUCTS - CRUD
// =================================================================
async function loadProducts() {
  const wrapper = document.getElementById("products-table");
  const region = document.getElementById("region-filter").value;
  const search = document.getElementById("search-products")?.value || "";

  wrapper.innerHTML = '<div class="loading">Đang tải dữ liệu...</div>';

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
      wrapper.innerHTML = '<div class="no-data">Không tìm thấy sản phẩm</div>';
    }
  } catch (error) {
    console.error("Lỗi load sản phẩm:", error);
    wrapper.innerHTML = '<div class="error">Lỗi kết nối server</div>';
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
          <button class="btn-danger btn-sm" onclick="confirmDeleteProduct(${
            p.MaHangHoa
          }, '${p.TenHangHoa}')">Xóa</button>
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
  content.innerHTML = '<div class="loading">Đang tải chi tiết...</div>';

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
      html += `<div class="no-image">Chưa có ảnh</div>`;
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
      html += `<div class="product-description"><h3>Mô tả chi tiết</h3><p>${p.MoTaChiTiet}</p></div>`;
    }

    if (p.ThongTinMoRong && Object.keys(p.ThongTinMoRong).length > 0) {
      html += `
        <div class="extended-info">
          <h3>Thông tin mở rộng</h3>
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
          <h3>Đánh giá</h3>
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
    }

    content.innerHTML = html;
  } catch (error) {
    console.error("Lỗi load chi tiết:", error);
    content.innerHTML = `<div class="error">Lỗi: ${error.message}</div>`;
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

      document.getElementById("form-image").value = "";

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
    showNotification("Lỗi tải sản phẩm: " + error.message, "error");
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
      showNotification(
        id ? "Cập nhật thành công!" : "Thêm sản phẩm thành công!",
        "success"
      );
      closeModal("modal-product-form");
      loadProducts();
    } else {
      showNotification("Lỗi: " + result.message, "error");
    }
  } catch (error) {
    showNotification("Lỗi khi lưu: " + error.message, "error");
  }
}

function confirmDeleteProduct(id, name) {
  const message = `<p>Xác nhận xóa sản phẩm <strong>"${name}"</strong>?</p>
    <p class="warning-text">Hành động này sẽ xóa:</p>
    <ul>
      <li>Dữ liệu SQL Server</li>
      <li>Dữ liệu MongoDB</li>
      <li>Ảnh trên Cloudinary</li>
    </ul>`;

  document.getElementById("delete-message").innerHTML = message;
  document.getElementById("modal-confirm-delete").style.display = "block";
  deleteCallback = () => deleteProduct(id);
}

async function deleteProduct(id) {
  try {
    const response = await fetch(`${API_URL}/product/${id}`, {
      method: "DELETE",
    });
    const result = await response.json();

    if (result.success) {
      showNotification("Xóa sản phẩm thành công!", "success");
      closeModal("modal-confirm-delete");
      loadProducts();
    } else {
      showNotification("Lỗi: " + result.message, "error");
    }
  } catch (error) {
    showNotification("Lỗi khi xóa: " + error.message, "error");
  }
}

// =================================================================
// ORDERS
// =================================================================
async function loadOrders() {
  const wrapper = document.getElementById("orders-table");
  const region = document.getElementById("region-filter").value;
  const search = document.getElementById("search-orders")?.value || "";
  const countBadge = document.getElementById("orders-count");

  wrapper.innerHTML = '<div class="loading">Đang tải đơn hàng...</div>';

  try {
    let url = `${API_URL}/orders?limit=100&sortBy=${sortConfig.orders.by}&sortOrder=${sortConfig.orders.order}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
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
    wrapper.innerHTML = '<div class="error">Lỗi kết nối</div>';
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
          <button class="btn-secondary btn-sm" onclick="openEditOrderStatus('${
            o.MaDonHang
          }', '${o.TrangThaiDonHang}')">Cập nhật</button>
          <button class="btn-danger btn-sm" onclick="confirmDeleteOrder('${
            o.MaDonHang
          }', '${o.TenKhachHang}')">Xóa</button>
        </td>
      </tr>
    `;
  });

  html += `</tbody></table>`;
  wrapper.innerHTML = html;
}

async function viewOrderDetail(id) {
  const modal = document.getElementById("modal-order-detail");
  const content = document.getElementById("order-detail-content");

  modal.style.display = "block";
  content.innerHTML = '<div class="loading">Đang tải chi tiết...</div>';

  try {
    const response = await fetch(`${API_URL}/order/${id}`);
    const result = await response.json();
    if (!result.success) throw new Error(result.message);

    const o = result.data;

    let html = `
      <div class="order-detail">
        <div class="order-header">
          <h2>Chi tiết đơn hàng</h2>
          <code>${id.substring(0, 8)}...</code>
        </div>
        
        <div class="order-info">
          <h3>Thông tin khách hàng</h3>
          <div class="info-grid">
            <div><span>Tên:</span><strong>${
              o.KhachHang.TenKhachHang
            }</strong></div>
            <div><span>SĐT:</span><span>${
              o.KhachHang.SoDienThoai || "N/A"
            }</span></div>
            <div><span>Email:</span><span>${
              o.KhachHang.Email || "N/A"
            }</span></div>
            <div><span>Địa chỉ:</span><span>${
              o.KhachHang.DiaChi || "N/A"
            }</span></div>
          </div>

          <h3>Thông tin đơn hàng</h3>
          <div class="info-grid">
            <div><span>Ngày đặt:</span><span>${new Date(
              o.NgayDatHang
            ).toLocaleString("vi-VN")}</span></div>
            <div><span>Trạng thái:</span><strong>${
              o.TrangThaiDonHang
            }</strong></div>
            <div><span>Vùng miền:</span><span class="region-badge region-${
              o.VungMien
            }">${getRegionName(o.VungMien)}</span></div>
            <div><span>Tổng tiền:</span><strong class="highlight">${formatCurrency(
              o.TongTien
            )}</strong></div>
          </div>

          <h3>Sản phẩm đặt hàng (${o.ChiTiet.length} mục)</h3>
          <table class="data-table">
            <thead>
              <tr>
                <th>Sản phẩm</th>
                <th>Đơn giá</th>
                <th>Số lượng</th>
                <th>Thành tiền</th>
              </tr>
            </thead>
            <tbody>
              ${o.ChiTiet.map(
                (item) => `
                <tr>
                  <td><strong>${item.TenHangHoa}</strong></td>
                  <td>${formatCurrency(item.DonGia)}</td>
                  <td>${item.SoLuong} ${item.DonViTinh}</td>
                  <td><strong>${formatCurrency(item.ThanhTien)}</strong></td>
                </tr>
              `
              ).join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;

    content.innerHTML = html;
  } catch (error) {
    content.innerHTML = `<div class="error">Lỗi: ${error.message}</div>`;
  }
}

function openEditOrderStatus(id, currentStatus) {
  document.getElementById("status-order-id").value = id;
  document.getElementById("status-current").value = currentStatus;
  document.getElementById("status-new").value = currentStatus;
  document.getElementById("modal-order-status").style.display = "block";
}

async function handleOrderStatusSubmit(e) {
  e.preventDefault();

  const id = document.getElementById("status-order-id").value;
  const newStatus = document.getElementById("status-new").value;

  try {
    const response = await fetch(`${API_URL}/order/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ TrangThaiDonHang: newStatus }),
    });
    const result = await response.json();

    if (result.success) {
      showNotification("Cập nhật thành công!", "success");
      closeModal("modal-order-status");
      loadOrders();
    } else {
      showNotification("Lỗi: " + result.message, "error");
    }
  } catch (error) {
    showNotification("Lỗi: " + error.message, "error");
  }
}

function confirmDeleteOrder(id, customerName) {
  const message = `<p>Xác nhận xóa đơn hàng của <strong>"${customerName}"</strong>?</p>
    <p>Mã đơn: <code>${id.substring(0, 8)}...</code></p>`;

  document.getElementById("delete-message").innerHTML = message;
  document.getElementById("modal-confirm-delete").style.display = "block";
  deleteCallback = () => deleteOrder(id);
}

async function deleteOrder(id) {
  try {
    const response = await fetch(`${API_URL}/order/${id}`, {
      method: "DELETE",
    });
    const result = await response.json();

    if (result.success) {
      showNotification("Xóa đơn hàng thành công!", "success");
      closeModal("modal-confirm-delete");
      loadOrders();
    } else {
      showNotification("Lỗi: " + result.message, "error");
    }
  } catch (error) {
    showNotification("Lỗi khi xóa: " + error.message, "error");
  }
}

function openAddOrderModal() {
  loadCustomers();
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

  if (items.length === 0) {
    showNotification("Vui lòng thêm ít nhất 1 sản phẩm!", "error");
    return;
  }

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
      showNotification("Tạo đơn hàng thành công!", "success");
      closeModal("modal-order-form");
      loadOrders();
    } else {
      showNotification("Lỗi: " + result.message, "error");
    }
  } catch (error) {
    showNotification("Lỗi: " + error.message, "error");
  }
}

// =================================================================
// CUSTOMERS
// =================================================================
function renderCustomersTable(customers) {
  const wrapper = document.getElementById("customers-table");

  const sortIcons = {
    MaKhachHang:
      sortConfig.customers.by === "MaKhachHang"
        ? sortConfig.customers.order === "ASC"
          ? "↑"
          : "↓"
        : "",
    TenKhachHang:
      sortConfig.customers.by === "TenKhachHang"
        ? sortConfig.customers.order === "ASC"
          ? "↑"
          : "↓"
        : "",
    DiemTichLuy:
      sortConfig.customers.by === "DiemTichLuy"
        ? sortConfig.customers.order === "ASC"
          ? "↑"
          : "↓"
        : "",
    NgayDangKy:
      sortConfig.customers.by === "NgayDangKy"
        ? sortConfig.customers.order === "ASC"
          ? "↑"
          : "↓"
        : "",
  };

  let html = `
    <table class="data-table">
      <thead>
        <tr>
          <th onclick="sortTable('customers', 'MaKhachHang')" style="cursor:pointer">Mã KH ${sortIcons.MaKhachHang}</th>
          <th onclick="sortTable('customers', 'TenKhachHang')" style="cursor:pointer">Tên khách hàng ${sortIcons.TenKhachHang}</th>
          <th>Email</th>
          <th>SĐT</th>
          <th>Vùng miền</th>
          <th>Loại KH</th>
          <th onclick="sortTable('customers', 'DiemTichLuy')" style="cursor:pointer">Điểm ${sortIcons.DiemTichLuy}</th>
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
          <button class="btn-danger btn-sm" onclick="confirmDeleteCustomer(${
            c.MaKhachHang
          }, '${c.TenKhachHang}')">Xóa</button>
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
    showNotification("Lỗi tải khách hàng: " + error.message, "error");
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
      showNotification(
        id ? "Cập nhật thành công!" : "Thêm khách hàng thành công!",
        "success"
      );
      closeModal("modal-customer-form");
      loadCustomers();
    } else {
      showNotification("Lỗi: " + result.message, "error");
    }
  } catch (error) {
    showNotification("Lỗi: " + error.message, "error");
  }
}

function confirmDeleteCustomer(id, name) {
  const message = `<p>Xác nhận xóa khách hàng <strong>"${name}"</strong>?</p>
    <p class="warning-text">Lưu ý: Không thể xóa khách hàng đã có đơn hàng.</p>`;

  document.getElementById("delete-message").innerHTML = message;
  document.getElementById("modal-confirm-delete").style.display = "block";
  deleteCallback = () => deleteCustomer(id);
}

async function deleteCustomer(id) {
  try {
    const response = await fetch(`${API_URL}/customer/${id}`, {
      method: "DELETE",
    });
    const result = await response.json();

    if (result.success) {
      showNotification("Xóa khách hàng thành công!", "success");
      closeModal("modal-confirm-delete");
      loadCustomers();
    } else {
      showNotification(result.message, "error");
    }
  } catch (error) {
    showNotification("Lỗi khi xóa: " + error.message, "error");
  }
}

// =================================================================
// INVENTORY (TỒN KHO)
// =================================================================
async function loadInventory() {
  const wrapper = document.getElementById("inventory-table");
  const countBadge = document.getElementById("inventory-count");
  const region = document.getElementById("region-filter").value;

  wrapper.innerHTML = '<div class="loading">Đang tải tồn kho...</div>';

  try {
    let url = `${API_URL}/inventory`;
    if (region) url += `?vungmien=${region}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.success && data.data.length > 0) {
      countBadge.textContent = `${data.count} mục`;
      renderInventoryTable(data.data);
    } else {
      wrapper.innerHTML = '<div class="no-data">Không có dữ liệu tồn kho</div>';
      countBadge.textContent = "0 mục";
    }
  } catch (error) {
    wrapper.innerHTML = '<div class="error">Lỗi kết nối</div>';
  }
}

function renderInventoryTable(inventory) {
  const wrapper = document.getElementById("inventory-table");

  let html = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Mã</th>
          <th>Sản phẩm</th>
          <th>Kho</th>
          <th>Chi nhánh</th>
          <th>Vùng miền</th>
          <th>Số lượng tồn</th>
          <th>Ngày cập nhật</th>
          <th>Thao tác</th>
        </tr>
      </thead>
      <tbody>
  `;

  inventory.forEach((item) => {
    html += `
      <tr>
        <td><strong>#${item.MaTonKho}</strong></td>
        <td><strong>${item.TenHangHoa}</strong></td>
        <td>${item.TenKho}</td>
        <td>${item.TenChiNhanh}</td>
        <td><span class="region-badge region-${item.VungMien}">${getRegionName(
      item.VungMien
    )}</span></td>
        <td><strong>${item.SoLuongTon} ${item.DonViTinh || ""}</strong></td>
        <td>${new Date(item.NgayCapNhat).toLocaleDateString("vi-VN")}</td>
        <td>
          <button class="btn-primary btn-sm" onclick="viewInventoryDetail(${
            item.MaTonKho
          })">Xem</button>
          <button class="btn-secondary btn-sm" onclick="openInventoryUpdate(${
            item.MaTonKho
          }, '${item.TenHangHoa}', '${item.TenKho}', ${
      item.SoLuongTon
    })">Cập nhật</button>
        </td>
      </tr>
    `;
  });

  html += `</tbody></table>`;
  wrapper.innerHTML = html;
}

async function viewInventoryDetail(id) {
  const modal = document.getElementById("modal-inventory-detail");
  const content = document.getElementById("inventory-detail-content");

  modal.style.display = "block";
  content.innerHTML = '<div class="loading">Đang tải chi tiết...</div>';

  try {
    const response = await fetch(`${API_URL}/inventory`);
    const data = await response.json();
    const item = data.data.find((i) => i.MaTonKho === id);

    if (!item) throw new Error("Không tìm thấy thông tin");

    let html = `
      <div class="inventory-detail">
        <h2>Chi tiết tồn kho #${item.MaTonKho}</h2>
        <div class="info-grid">
          <div><span>Sản phẩm:</span><strong>${item.TenHangHoa}</strong></div>
          <div><span>Kho:</span><span>${item.TenKho}</span></div>
          <div><span>Chi nhánh:</span><span>${item.TenChiNhanh}</span></div>
          <div><span>Vùng miền:</span><span class="region-badge region-${
            item.VungMien
          }">${getRegionName(item.VungMien)}</span></div>
          <div><span>Số lượng tồn:</span><strong class="highlight">${
            item.SoLuongTon
          } ${item.DonViTinh || ""}</strong></div>
          <div><span>Ngày cập nhật:</span><span>${new Date(
            item.NgayCapNhat
          ).toLocaleString("vi-VN")}</span></div>
        </div>
      </div>
    `;

    content.innerHTML = html;
  } catch (error) {
    content.innerHTML = `<div class="error">Lỗi: ${error.message}</div>`;
  }
}

function openInventoryUpdate(id, productName, warehouseName, currentQty) {
  document.getElementById("form-inventory-id").value = id;
  document.getElementById("form-inventory-product").value = productName;
  document.getElementById("form-inventory-warehouse").value = warehouseName;
  document.getElementById("form-inventory-current").value = currentQty;
  document.getElementById("form-inventory-new").value = currentQty;
  document.getElementById("modal-inventory-update").style.display = "block";
}

async function handleInventoryUpdate(e) {
  e.preventDefault();

  const id = document.getElementById("form-inventory-id").value;
  const newQty = document.getElementById("form-inventory-new").value;

  try {
    const response = await fetch(`${API_URL}/inventory/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ SoLuongTon: parseInt(newQty) }),
    });

    const result = await response.json();
    if (result.success) {
      showNotification("Cập nhật tồn kho thành công!", "success");
      closeModal("modal-inventory-update");
      loadInventory();
    } else {
      showNotification("Lỗi: " + result.message, "error");
    }
  } catch (error) {
    showNotification("Lỗi: " + error.message, "error");
  }
}

// =================================================================
// WAREHOUSES & INVENTORY
// =================================================================
async function loadWarehouses() {
  const wrapper = document.getElementById("warehouses-table");
  wrapper.innerHTML = '<div class="loading">Đang tải kho...</div>';

  try {
    const response = await fetch(`${API_URL}/warehouses`);
    const data = await response.json();

    if (data.success && data.data.length > 0) {
      warehouses = data.data;
      renderWarehousesTable(data.data);
      document.getElementById(
        "warehouses-count"
      ).textContent = `${data.count} kho`;
    } else {
      wrapper.innerHTML = '<div class="no-data">Không có kho</div>';
      document.getElementById("warehouses-count").textContent = "0 kho";
    }
  } catch (error) {
    wrapper.innerHTML = '<div class="error">Lỗi kết nối</div>';
  }
}

function renderWarehousesTable(warehouses) {
  const wrapper = document.getElementById("warehouses-table");

  let html = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Mã kho</th>
          <th>Tên kho</th>
          <th>Chi nhánh</th>
          <th>Vùng miền</th>
          <th>Địa chỉ</th>
          <th>Người quản lý</th>
          <th>Sức chứa</th>
          <th>Thao tác</th>
        </tr>
      </thead>
      <tbody>
  `;

  warehouses.forEach((w) => {
    html += `
      <tr>
        <td><strong>#${w.MaKho}</strong></td>
        <td><strong>${w.TenKho}</strong></td>
        <td>${w.TenChiNhanh || "N/A"}</td>
        <td><span class="region-badge region-${w.VungMien}">${getRegionName(
      w.VungMien
    )}</span></td>
        <td>${w.DiaChiKho || "N/A"}</td>
        <td>${w.NguoiQuanLy || "N/A"}</td>
        <td>${w.SucChua || "N/A"}</td>
        <td>
          <button class="btn-secondary btn-sm" onclick="editWarehouse(${
            w.MaKho
          })">Sửa</button>
        </td>
      </tr>
    `;
  });

  html += `</tbody></table>`;
  wrapper.innerHTML = html;
}

function openAddWarehouseModal() {
  document.getElementById("warehouse-form").reset();
  document.getElementById("form-warehouse-id").value = "";
  document.getElementById("warehouse-form-title").textContent = "Thêm kho mới";
  document.getElementById("modal-warehouse-form").style.display = "block";
}

async function editWarehouse(id) {
  try {
    const response = await fetch(`${API_URL}/warehouse/${id}`);
    const result = await response.json();

    if (result.success) {
      const w = result.data;
      document.getElementById("warehouse-form-title").textContent = "Sửa kho";
      document.getElementById("form-warehouse-id").value = w.MaKho;
      document.getElementById("form-warehouse-name").value = w.TenKho;
      document.getElementById("form-warehouse-branch").value = w.MaChiNhanh;
      document.getElementById("form-warehouse-address").value =
        w.DiaChiKho || "";
      document.getElementById("form-warehouse-manager").value =
        w.NguoiQuanLy || "";
      document.getElementById("form-warehouse-capacity").value =
        w.SucChua || "";

      document.getElementById("modal-warehouse-form").style.display = "block";
    }
  } catch (error) {
    showNotification("Lỗi tải kho: " + error.message, "error");
  }
}

async function handleWarehouseSubmit(e) {
  e.preventDefault();

  const id = document.getElementById("form-warehouse-id").value;
  const data = {
    TenKho: document.getElementById("form-warehouse-name").value,
    MaChiNhanh: parseInt(
      document.getElementById("form-warehouse-branch").value
    ),
    DiaChiKho: document.getElementById("form-warehouse-address").value,
    NguoiQuanLy: document.getElementById("form-warehouse-manager").value,
    SucChua:
      parseInt(document.getElementById("form-warehouse-capacity").value) ||
      null,
  };

  try {
    const url = id ? `${API_URL}/warehouse/${id}` : `${API_URL}/warehouse`;
    const method = id ? "PUT" : "POST";

    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    const result = await response.json();
    if (result.success) {
      showNotification(
        id ? "Cập nhật thành công!" : "Thêm kho thành công!",
        "success"
      );
      closeModal("modal-warehouse-form");
      loadWarehouses();
    } else {
      showNotification("Lỗi: " + result.message, "error");
    }
  } catch (error) {
    showNotification("Lỗi: " + error.message, "error");
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
          <h3>MongoDB</h3>
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
    wrapper.innerHTML = '<div class="error">Lỗi tải thống kê</div>';
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
// MODAL & DELETE CONFIRMATION
// =================================================================
function closeModal(modalId) {
  document.getElementById(modalId).style.display = "none";
}

function confirmDelete() {
  if (deleteCallback) {
    deleteCallback();
    deleteCallback = null;
  }
}

// =================================================================
// NOTIFICATION SYSTEM
// =================================================================
function showNotification(message, type = "info") {
  const existingNotif = document.querySelector(".notification");
  if (existingNotif) {
    existingNotif.remove();
  }

  const notif = document.createElement("div");
  notif.className = `notification notification-${type}`;
  notif.innerHTML = `
    <span>${message}</span>
    <button onclick="this.parentElement.remove()">×</button>
  `;

  document.body.appendChild(notif);

  setTimeout(() => {
    notif.classList.add("show");
  }, 10);

  setTimeout(() => {
    notif.classList.remove("show");
    setTimeout(() => notif.remove(), 300);
  }, 3000);
}

// =================================================================
// UTILITIES
// =================================================================
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
