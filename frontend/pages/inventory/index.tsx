import React, { useEffect, useMemo, useState } from "react";

type Branch = { id: number; name: string };

type Category = {
  id: number;
  branchId: number;
  name: string;
  isActive: boolean;
};

type ProductRow = {
  id: number;
  branchId: number;
  categoryId: number;
  name: string;
  code: string | null;
  price: number;
  isActive: boolean;
  category?: Category;
  stockOnHand?: number;
};

export default function InventoryPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState<string>("");

  const [categories, setCategories] = useState<Category[]>([]);
  const [catLoading, setCatLoading] = useState(false);
  const [catError, setCatError] = useState("");

  const [products, setProducts] = useState<ProductRow[]>([]);
  const [prodLoading, setProdLoading] = useState(false);
  const [prodError, setProdError] = useState("");

  const [newCategoryName, setNewCategoryName] = useState("");

  const [categoryFilterId, setCategoryFilterId] = useState<string>("");
  const [productQuery, setProductQuery] = useState("");

  const [newProduct, setNewProduct] = useState({
    categoryId: "",
    name: "",
    code: "",
    price: "",
    isActive: true,
  });

  // editing state
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");

  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [editingProduct, setEditingProduct] = useState({
    categoryId: "",
    name: "",
    code: "",
    price: "",
    isActive: true,
  });

  // stock adjust modal
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustProduct, setAdjustProduct] = useState<ProductRow | null>(null);
  const [adjustQty, setAdjustQty] = useState<string>("");
  const [adjustNote, setAdjustNote] = useState<string>("");

  // Load branches
  useEffect(() => {
    fetch("/api/branches")
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setBranches(list);
        if (!branchId && list.length) setBranchId(String(list[0].id));
      })
      .catch(() => setBranches([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedBranchIdNum = useMemo(() => Number(branchId), [branchId]);

  const loadCategories = async () => {
    if (!selectedBranchIdNum || Number.isNaN(selectedBranchIdNum)) return;
    setCatLoading(true);
    setCatError("");
    try {
      const res = await fetch(`/api/inventory/categories?branchId=${selectedBranchIdNum}`);
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error((data && data.error) || "Failed to load categories");
      setCategories(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setCategories([]);
      setCatError(e.message || "Failed to load categories");
    } finally {
      setCatLoading(false);
    }
  };

  const loadProducts = async () => {
    if (!selectedBranchIdNum || Number.isNaN(selectedBranchIdNum)) return;
    setProdLoading(true);
    setProdError("");
    try {
      const params = new URLSearchParams();
      params.set("branchId", String(selectedBranchIdNum));
      if (categoryFilterId) params.set("categoryId", categoryFilterId);
      if (productQuery.trim()) params.set("q", productQuery.trim());

      const res = await fetch(`/api/inventory/products?${params.toString()}`);
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error((data && data.error) || "Failed to load products");

      setProducts(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setProducts([]);
      setProdError(e.message || "Failed to load products");
    } finally {
      setProdLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedBranchIdNum || Number.isNaN(selectedBranchIdNum)) return;
    void loadCategories();
    void loadProducts();
    // reset filters when branch changes
    setCategoryFilterId("");
    setProductQuery("");
    setNewProduct((p) => ({ ...p, categoryId: "" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBranchIdNum]);

  const createCategory = async () => {
    if (!selectedBranchIdNum || Number.isNaN(selectedBranchIdNum)) return;
    const name = newCategoryName.trim();
    if (!name) return;

    try {
      const res = await fetch("/api/inventory/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchId: selectedBranchIdNum, name }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error((data && data.error) || "Failed to create category");
      setNewCategoryName("");
      await loadCategories();
    } catch (e: any) {
      setCatError(e.message || "Failed to create category");
    }
  };

  const saveCategory = async (id: number) => {
    const name = editingCategoryName.trim();
    if (!name) return;

    try {
      const res = await fetch(`/api/inventory/categories/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error((data && data.error) || "Failed to update category");
      setEditingCategoryId(null);
      setEditingCategoryName("");
      await loadCategories();
      await loadProducts(); // category name shown in product list
    } catch (e: any) {
      setCatError(e.message || "Failed to update category");
    }
  };

  const createProduct = async () => {
    if (!selectedBranchIdNum || Number.isNaN(selectedBranchIdNum)) return;

    const categoryIdNum = Number(newProduct.categoryId);
    const name = newProduct.name.trim();
    const code = newProduct.code.trim();
    const priceNum = Number(newProduct.price);

    if (!categoryIdNum || Number.isNaN(categoryIdNum)) {
      setProdError("Category is required");
      return;
    }
    if (!name) {
      setProdError("Product name is required");
      return;
    }
    if (Number.isNaN(priceNum) || priceNum < 0) {
      setProdError("Price must be >= 0");
      return;
    }

    try {
      const res = await fetch("/api/inventory/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: selectedBranchIdNum,
          categoryId: categoryIdNum,
          name,
          code: code || null,
          price: priceNum,
          isActive: newProduct.isActive,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error((data && data.error) || "Failed to create product");

      setNewProduct({ categoryId: "", name: "", code: "", price: "", isActive: true });
      await loadProducts();
    } catch (e: any) {
      setProdError(e.message || "Failed to create product");
    }
  };

  const startEditProduct = (p: ProductRow) => {
    setEditingProductId(p.id);
    setEditingProduct({
      categoryId: String(p.categoryId),
      name: p.name,
      code: p.code || "",
      price: String(p.price),
      isActive: p.isActive,
    });
  };

  const saveProduct = async (id: number) => {
    const categoryIdNum = Number(editingProduct.categoryId);
    const name = editingProduct.name.trim();
    const code = editingProduct.code.trim();
    const priceNum = Number(editingProduct.price);

    if (!categoryIdNum || Number.isNaN(categoryIdNum)) {
      setProdError("Category is required");
      return;
    }
    if (!name) {
      setProdError("Product name is required");
      return;
    }
    if (Number.isNaN(priceNum) || priceNum < 0) {
      setProdError("Price must be >= 0");
      return;
    }

    try {
      const res = await fetch(`/api/inventory/products/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId: categoryIdNum,
          name,
          code: code || null,
          price: priceNum,
          isActive: editingProduct.isActive,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error((data && data.error) || "Failed to update product");

      setEditingProductId(null);
      await loadProducts();
    } catch (e: any) {
      setProdError(e.message || "Failed to update product");
    }
  };

  const openAdjust = (p: ProductRow) => {
    setAdjustProduct(p);
    setAdjustQty("");
    setAdjustNote("");
    setAdjustOpen(true);
  };

  const submitAdjust = async () => {
    if (!adjustProduct) return;
    const qty = Number(adjustQty);
    if (!Number.isFinite(qty) || qty === 0) {
      setProdError("Adjustment quantity must be non-zero");
      return;
    }

    try {
      const res = await fetch(`/api/inventory/products/${adjustProduct.id}/adjust`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: selectedBranchIdNum,
          quantityDelta: Math.trunc(qty),
          note: adjustNote || null,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error((data && data.error) || "Failed to adjust stock");

      setAdjustOpen(false);
      setAdjustProduct(null);
      await loadProducts();
    } catch (e: any) {
      setProdError(e.message || "Failed to adjust stock");
    }
  };

  return (
    <main style={{ maxWidth: 1100, margin: "16px auto", padding: 24, fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: 20, margin: "0 0 12px" }}>Inventory</h1>

      {/* Branch */}
      <div style={{ marginBottom: 12, display: "flex", gap: 8, alignItems: "center" }}>
        <label style={{ fontSize: 13 }}>Branch:</label>
        <select
          value={branchId}
          onChange={(e) => setBranchId(e.target.value)}
          style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid #d1d5db" }}
        >
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 12 }}>
        {/* Categories */}
        <section style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 8, padding: 12 }}>
          <h2 style={{ margin: "0 0 8px", fontSize: 16 }}>Categories</h2>

          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <input
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="New category name"
              style={{ flex: 1, padding: "6px 8px", borderRadius: 6, border: "1px solid #d1d5db" }}
            />
            <button onClick={createCategory} style={{ padding: "6px 10px", borderRadius: 6, border: "none", background: "#2563eb", color: "white" }}>
              Add
            </button>
          </div>

          {catLoading ? (
            <div style={{ color: "#6b7280" }}>Loading…</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {categories.map((c) => (
                <div key={c.id} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  {editingCategoryId === c.id ? (
                    <>
                      <input
                        value={editingCategoryName}
                        onChange={(e) => setEditingCategoryName(e.target.value)}
                        style={{ flex: 1, padding: "6px 8px", borderRadius: 6, border: "1px solid #d1d5db" }}
                      />
                      <button onClick={() => saveCategory(c.id)} style={{ padding: "6px 8px" }}>
                        Save
                      </button>
                      <button onClick={() => setEditingCategoryId(null)} style={{ padding: "6px 8px" }}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setCategoryFilterId(String(c.id))}
                        style={{
                          flex: 1,
                          textAlign: "left",
                          padding: "6px 8px",
                          borderRadius: 6,
                          border: categoryFilterId === String(c.id) ? "1px solid #2563eb" : "1px solid #e5e7eb",
                          background: categoryFilterId === String(c.id) ? "#eff6ff" : "white",
                          cursor: "pointer",
                        }}
                      >
                        {c.name}
                      </button>
                      <button
                        onClick={() => {
                          setEditingCategoryId(c.id);
                          setEditingCategoryName(c.name);
                        }}
                        style={{ padding: "6px 8px" }}
                      >
                        Edit
                      </button>
                    </>
                  )}
                </div>
              ))}

              {categories.length === 0 && <div style={{ color: "#6b7280" }}>No categories.</div>}
            </div>
          )}

          {catError && <div style={{ marginTop: 8, color: "#b91c1c", fontSize: 12 }}>{catError}</div>}
        </section>

        {/* Products */}
        <section style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 8, padding: 12 }}>
          <h2 style={{ margin: "0 0 8px", fontSize: 16 }}>Products</h2>

          {/* Filters */}
          <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
            <select
              value={categoryFilterId}
              onChange={(e) => setCategoryFilterId(e.target.value)}
              style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid #d1d5db" }}
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <input
              value={productQuery}
              onChange={(e) => setProductQuery(e.target.value)}
              placeholder="Search name/code…"
              style={{ flex: 1, minWidth: 180, padding: "6px 8px", borderRadius: 6, border: "1px solid #d1d5db" }}
            />

            <button onClick={loadProducts} style={{ padding: "6px 10px" }}>
              Search
            </button>
          </div>

          {/* Create product */}
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 10, marginBottom: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Add product</div>
            <div style={{ display: "grid", gridTemplateColumns: "200px 1fr 140px 120px 100px", gap: 8 }}>
              <select
                value={newProduct.categoryId}
                onChange={(e) => setNewProduct((p) => ({ ...p, categoryId: e.target.value }))}
                style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid #d1d5db" }}
              >
                <option value="">Category (required)</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              <input
                value={newProduct.name}
                onChange={(e) => setNewProduct((p) => ({ ...p, name: e.target.value }))}
                placeholder="Name"
                style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid #d1d5db" }}
              />

              <input
                value={newProduct.code}
                onChange={(e) => setNewProduct((p) => ({ ...p, code: e.target.value }))}
                placeholder="Code (optional)"
                style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid #d1d5db" }}
              />

              <input
                value={newProduct.price}
                onChange={(e) => setNewProduct((p) => ({ ...p, price: e.target.value }))}
                placeholder="Price"
                style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid #d1d5db" }}
              />

              <button onClick={createProduct} style={{ borderRadius: 6, border: "none", background: "#16a34a", color: "white" }}>
                Save
              </button>
            </div>
          </div>

          {prodLoading ? (
            <div style={{ color: "#6b7280" }}>Loading…</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #e5e7eb" }}>Name</th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #e5e7eb" }}>Category</th>
                  <th style={{ textAlign: "right", padding: 8, borderBottom: "1px solid #e5e7eb" }}>Price</th>
                  <th style={{ textAlign: "right", padding: 8, borderBottom: "1px solid #e5e7eb" }}>Stock</th>
                  <th style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>Active</th>
                  <th style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }} />
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id}>
                    {editingProductId === p.id ? (
                      <>
                        <td style={{ padding: 8 }}>
                          <input value={editingProduct.name} onChange={(e) => setEditingProduct((x) => ({ ...x, name: e.target.value }))} />
                        </td>
                        <td style={{ padding: 8 }}>
                          <select value={editingProduct.categoryId} onChange={(e) => setEditingProduct((x) => ({ ...x, categoryId: e.target.value }))}>
                            {categories.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td style={{ padding: 8, textAlign: "right" }}>
                          <input value={editingProduct.price} onChange={(e) => setEditingProduct((x) => ({ ...x, price: e.target.value }))} />
                        </td>
                        <td style={{ padding: 8, textAlign: "right" }}>{p.stockOnHand ?? 0}</td>
                        <td style={{ padding: 8, textAlign: "center" }}>
                          <input
                            type="checkbox"
                            checked={editingProduct.isActive}
                            onChange={(e) => setEditingProduct((x) => ({ ...x, isActive: e.target.checked }))}
                          />
                        </td>
                        <td style={{ padding: 8, textAlign: "right" }}>
                          <button onClick={() => saveProduct(p.id)} style={{ marginRight: 6 }}>
                            Save
                          </button>
                          <button onClick={() => setEditingProductId(null)}>Cancel</button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td style={{ padding: 8 }}>{p.name}</td>
                        <td style={{ padding: 8 }}>{(p as any).category?.name || p.categoryId}</td>
                        <td style={{ padding: 8, textAlign: "right" }}>{Number(p.price).toLocaleString("mn-MN")}</td>
                        <td style={{ padding: 8, textAlign: "right" }}>{p.stockOnHand ?? 0}</td>
                        <td style={{ padding: 8, textAlign: "center" }}>{p.isActive ? "Yes" : "No"}</td>
                        <td style={{ padding: 8, textAlign: "right" }}>
                          <button onClick={() => startEditProduct(p)} style={{ marginRight: 6 }}>
                            Edit
                          </button>
                          <button onClick={() => openAdjust(p)}>Adjust</button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
                {products.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: 8, color: "#6b7280" }}>
                      No products.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {prodError && <div style={{ marginTop: 8, color: "#b91c1c", fontSize: 12 }}>{prodError}</div>}
        </section>
      </div>

      {/* Adjust modal */}
      {adjustOpen && adjustProduct && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 60,
          }}
          onClick={() => setAdjustOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: 420, background: "white", borderRadius: 8, padding: 14 }}
          >
            <h3 style={{ marginTop: 0 }}>Adjust stock</h3>
            <div style={{ marginBottom: 6, color: "#6b7280" }}>{adjustProduct.name}</div>

            <label style={{ display: "block", fontSize: 13, marginBottom: 6 }}>
              Quantity delta (use negative to subtract):
              <input
                value={adjustQty}
                onChange={(e) => setAdjustQty(e.target.value)}
                placeholder="e.g. 10 or -2"
                style={{ width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid #d1d5db", marginTop: 4 }}
              />
            </label>

            <label style={{ display: "block", fontSize: 13, marginBottom: 10 }}>
              Note (optional):
              <input
                value={adjustNote}
                onChange={(e) => setAdjustNote(e.target.value)}
                placeholder="Reason"
                style={{ width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid #d1d5db", marginTop: 4 }}
              />
            </label>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={() => setAdjustOpen(false)}>Cancel</button>
              <button onClick={submitAdjust} style={{ border: "none", borderRadius: 6, background: "#16a34a", color: "white", padding: "6px 10px" }}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
