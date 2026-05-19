import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";

type Branch = { id: number; name: string };

type Category = {
  id: number;
  branchId: number;
  name: string;
  isActive: boolean;
  _count?: { products: number };
};

type ProductRow = {
  id: number;
  branchId: number;
  categoryId: number;
  name: string;
  code: string | null;
  price: number;
  description: string | null;
  imagePaths: string[];
  isActive: boolean;
  category?: Category;
  stockOnHand?: number;
};

const MAX_IMAGES = 3;

async function uploadProductImage(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/uploads/product-image", {
    method: "POST",
    credentials: "include",
    body: fd,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error((data && data.error) || "Зураг upload алдаа.");
  }
  return String(data?.filePath || "");
}

export default function SupplyOthersPage() {
  const { me, loading: authLoading } = useAuth();
  const canManage = me?.role === "admin" || me?.role === "super_admin";

  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState<string>("");

  const [categories, setCategories] = useState<Category[]>([]);
  const [catLoading, setCatLoading] = useState(false);
  const [catError, setCatError] = useState("");
  const [showArchivedCategories, setShowArchivedCategories] = useState(true);

  const [products, setProducts] = useState<ProductRow[]>([]);
  const [prodLoading, setProdLoading] = useState(false);
  const [prodError, setProdError] = useState("");
  const [showArchivedProducts, setShowArchivedProducts] = useState(true);

  const [newCategoryName, setNewCategoryName] = useState("");
  const [categoryFilterId, setCategoryFilterId] = useState<string>("");
  const [productQuery, setProductQuery] = useState("");

  const [newProduct, setNewProduct] = useState({
    categoryId: "",
    name: "",
    code: "",
    price: "",
    description: "",
    imagePaths: [] as string[],
    isActive: true,
  });
  const [newImageUploading, setNewImageUploading] = useState(false);

  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");

  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [editingProduct, setEditingProduct] = useState({
    categoryId: "",
    name: "",
    code: "",
    price: "",
    description: "",
    imagePaths: [] as string[],
    isActive: true,
  });
  const [editImageUploading, setEditImageUploading] = useState(false);

  const selectedBranchIdNum = useMemo(() => Number(branchId), [branchId]);

  useEffect(() => {
    fetch("/api/branches")
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setBranches(list);
        if (!branchId && list.length) {
          setBranchId(String(list[0].id));
        }
      })
      .catch(() => setBranches([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadCategories = async () => {
    if (!selectedBranchIdNum || Number.isNaN(selectedBranchIdNum)) return;
    setCatLoading(true);
    setCatError("");
    try {
      const res = await fetch(
        `/api/inventory/categories?branchId=${selectedBranchIdNum}&includeInactive=true`
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error((data && data.error) || "Ангиллын жагсаалт ачаалж чадсангүй.");
      }
      setCategories(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setCategories([]);
      setCatError(e.message || "Ангиллын жагсаалт ачаалж чадсангүй.");
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
      if (!showArchivedProducts) params.set("onlyActive", "true");

      const res = await fetch(`/api/inventory/products?${params.toString()}`);
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error((data && data.error) || "Барааны жагсаалт ачаалж чадсангүй.");
      }
      setProducts(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setProducts([]);
      setProdError(e.message || "Барааны жагсаалт ачаалж чадсангүй.");
    } finally {
      setProdLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedBranchIdNum || Number.isNaN(selectedBranchIdNum)) return;
    void loadCategories();
    void loadProducts();
    setCategoryFilterId("");
    setProductQuery("");
    setNewProduct((prev) => ({ ...prev, categoryId: "" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBranchIdNum]);

  useEffect(() => {
    if (!selectedBranchIdNum || Number.isNaN(selectedBranchIdNum)) return;
    void loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showArchivedProducts, categoryFilterId]);

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
      if (!res.ok) {
        throw new Error((data && data.error) || "Ангилал нэмэхэд алдаа гарлаа.");
      }
      setNewCategoryName("");
      await loadCategories();
    } catch (e: any) {
      setCatError(e.message || "Ангилал нэмэхэд алдаа гарлаа.");
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
      if (!res.ok) {
        throw new Error((data && data.error) || "Ангилал засахад алдаа гарлаа.");
      }
      setEditingCategoryId(null);
      setEditingCategoryName("");
      await loadCategories();
      await loadProducts();
    } catch (e: any) {
      setCatError(e.message || "Ангилал засахад алдаа гарлаа.");
    }
  };

  const toggleCategoryArchived = async (category: Category) => {
    try {
      const res = await fetch(`/api/inventory/categories/${category.id}/archive`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !category.isActive }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error((data && data.error) || "Ангиллын төлөв өөрчлөхөд алдаа гарлаа.");
      }
      await loadCategories();
      await loadProducts();
    } catch (e: any) {
      setCatError(e.message || "Ангиллын төлөв өөрчлөхөд алдаа гарлаа.");
    }
  };

  const deleteCategory = async (category: Category) => {
    const ok = window.confirm(`"${category.name}" ангиллыг бүр мөсөн устгах уу?`);
    if (!ok) return;
    try {
      const res = await fetch(`/api/inventory/categories/${category.id}`, {
        method: "DELETE",
      });
      if (res.status === 204) {
        if (categoryFilterId === String(category.id)) {
          setCategoryFilterId("");
        }
        await loadCategories();
        await loadProducts();
        return;
      }
      const data = await res.json().catch(() => null);
      throw new Error((data && data.error) || "Ангилал устгахад алдаа гарлаа.");
    } catch (e: any) {
      setCatError(e.message || "Ангилал устгахад алдаа гарлаа.");
    }
  };

  const createProduct = async () => {
    if (!selectedBranchIdNum || Number.isNaN(selectedBranchIdNum)) return;
    const categoryIdNum = Number(newProduct.categoryId);
    const name = newProduct.name.trim();
    const code = newProduct.code.trim();
    const priceNum = Number(newProduct.price);
    const description = newProduct.description.trim();

    if (!categoryIdNum || Number.isNaN(categoryIdNum)) {
      setProdError("Ангилал сонгоно уу.");
      return;
    }
    if (!name) {
      setProdError("Барааны нэр заавал.");
      return;
    }
    if (Number.isNaN(priceNum) || priceNum < 0) {
      setProdError("Үнэ 0-ээс багагүй тоо байх ёстой.");
      return;
    }
    if (newProduct.imagePaths.length > MAX_IMAGES) {
      setProdError(`Зураг ${MAX_IMAGES}-аас их байж болохгүй.`);
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
          description: description || null,
          imagePaths: newProduct.imagePaths,
          isActive: newProduct.isActive,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error((data && data.error) || "Бараа нэмэхэд алдаа гарлаа.");
      }
      setNewProduct((prev) => ({
        ...prev,
        name: "",
        code: "",
        price: "",
        description: "",
        imagePaths: [],
      }));
      setCategoryFilterId("");
      setProductQuery("");
      await loadProducts();
    } catch (e: any) {
      setProdError(e.message || "Бараа нэмэхэд алдаа гарлаа.");
    }
  };

  const startEditProduct = (p: ProductRow) => {
    setEditingProductId(p.id);
    setEditingProduct({
      categoryId: String(p.categoryId),
      name: p.name,
      code: p.code || "",
      price: String(p.price),
      description: p.description || "",
      imagePaths: Array.isArray(p.imagePaths) ? p.imagePaths : [],
      isActive: p.isActive,
    });
  };

  const saveProduct = async (id: number) => {
    const categoryIdNum = Number(editingProduct.categoryId);
    const name = editingProduct.name.trim();
    const code = editingProduct.code.trim();
    const priceNum = Number(editingProduct.price);
    const description = editingProduct.description.trim();

    if (!categoryIdNum || Number.isNaN(categoryIdNum)) {
      setProdError("Ангилал сонгоно уу.");
      return;
    }
    if (!name) {
      setProdError("Барааны нэр заавал.");
      return;
    }
    if (Number.isNaN(priceNum) || priceNum < 0) {
      setProdError("Үнэ 0-ээс багагүй тоо байх ёстой.");
      return;
    }
    if (editingProduct.imagePaths.length > MAX_IMAGES) {
      setProdError(`Зураг ${MAX_IMAGES}-аас их байж болохгүй.`);
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
          description: description || null,
          imagePaths: editingProduct.imagePaths,
          isActive: editingProduct.isActive,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error((data && data.error) || "Бараа засахад алдаа гарлаа.");
      }
      setEditingProductId(null);
      await loadProducts();
    } catch (e: any) {
      setProdError(e.message || "Бараа засахад алдаа гарлаа.");
    }
  };

  const toggleProductArchived = async (product: ProductRow) => {
    try {
      const res = await fetch(`/api/inventory/products/${product.id}/archive`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !product.isActive }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error((data && data.error) || "Барааны төлөв өөрчлөхөд алдаа гарлаа.");
      }
      await loadProducts();
    } catch (e: any) {
      setProdError(e.message || "Барааны төлөв өөрчлөхөд алдаа гарлаа.");
    }
  };

  const deleteProduct = async (product: ProductRow) => {
    const ok = window.confirm(`"${product.name}" барааг бүр мөсөн устгах уу?`);
    if (!ok) return;
    try {
      const res = await fetch(`/api/inventory/products/${product.id}`, {
        method: "DELETE",
      });
      if (res.status === 204) {
        if (editingProductId === product.id) {
          setEditingProductId(null);
        }
        await loadProducts();
        return;
      }
      const data = await res.json().catch(() => null);
      throw new Error((data && data.error) || "Бараа устгахад алдаа гарлаа.");
    } catch (e: any) {
      setProdError(e.message || "Бараа устгахад алдаа гарлаа.");
    }
  };

  const handleAddNewProductImage = async (file?: File) => {
    if (!file) return;
    if (newProduct.imagePaths.length >= MAX_IMAGES) {
      setProdError(`Нэг бараанд хамгийн ихдээ ${MAX_IMAGES} зураг оруулна.`);
      return;
    }
    setProdError("");
    setNewImageUploading(true);
    try {
      const path = await uploadProductImage(file);
      setNewProduct((prev) => ({
        ...prev,
        imagePaths: [...prev.imagePaths, path].slice(0, MAX_IMAGES),
      }));
    } catch (e: any) {
      setProdError(e.message || "Зураг upload алдаа.");
    } finally {
      setNewImageUploading(false);
    }
  };

  const handleAddEditProductImage = async (file?: File) => {
    if (!file) return;
    if (editingProduct.imagePaths.length >= MAX_IMAGES) {
      setProdError(`Нэг бараанд хамгийн ихдээ ${MAX_IMAGES} зураг оруулна.`);
      return;
    }
    setProdError("");
    setEditImageUploading(true);
    try {
      const path = await uploadProductImage(file);
      setEditingProduct((prev) => ({
        ...prev,
        imagePaths: [...prev.imagePaths, path].slice(0, MAX_IMAGES),
      }));
    } catch (e: any) {
      setProdError(e.message || "Зураг upload алдаа.");
    } finally {
      setEditImageUploading(false);
    }
  };

  if (authLoading) {
    return (
      <main style={{ maxWidth: 960, margin: "16px auto", padding: 24 }}>
        Ачааллаж байна...
      </main>
    );
  }

  if (!canManage) {
    return (
      <main style={{ maxWidth: 960, margin: "16px auto", padding: 24 }}>
        <h1 style={{ marginTop: 0, fontSize: 20 }}>Хангамж - Бусад</h1>
        <div style={{ color: "#b91c1c" }}>Хандах эрхгүй.</div>
      </main>
    );
  }

  const visibleCategories = showArchivedCategories
    ? categories
    : categories.filter((c) => c.isActive);

  return (
    <main
      style={{
        maxWidth: 1240,
        margin: "16px auto",
        padding: 24,
        fontFamily: "sans-serif",
      }}
    >
      <h1 style={{ fontSize: 22, margin: "0 0 12px" }}>Хангамж - Бусад</h1>
      <p style={{ margin: "0 0 16px", color: "#6b7280", fontSize: 13 }}>
        Ангилал үүсгэх, бараа бүртгэх, үнэ/тайлбар/зураг удирдах, мөн архивлах болон устгах.
      </p>

      <div
        style={{
          marginBottom: 12,
          display: "flex",
          gap: 8,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <label style={{ fontSize: 13 }}>Салбар:</label>
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

      <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 12 }}>
        <section
          style={{
            background: "white",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            padding: 12,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <h2 style={{ margin: 0, fontSize: 16 }}>Ангилал</h2>
            <label style={{ fontSize: 12 }}>
              <input
                type="checkbox"
                checked={showArchivedCategories}
                onChange={(e) => setShowArchivedCategories(e.target.checked)}
                style={{ marginRight: 6 }}
              />
              Архивтай нь
            </label>
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <input
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="Ангиллын нэр"
              style={{
                flex: 1,
                padding: "6px 8px",
                borderRadius: 6,
                border: "1px solid #d1d5db",
              }}
            />
            <button
              onClick={createCategory}
              style={{
                padding: "6px 10px",
                borderRadius: 6,
                border: "none",
                background: "#2563eb",
                color: "white",
              }}
            >
              Нэмэх
            </button>
          </div>

          {catLoading ? (
            <div style={{ color: "#6b7280" }}>Уншиж байна…</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {visibleCategories.map((c) => (
                <div
                  key={c.id}
                  style={{
                    display: "flex",
                    gap: 6,
                    alignItems: "center",
                    border: "1px solid #f3f4f6",
                    borderRadius: 8,
                    padding: 6,
                  }}
                >
                  {editingCategoryId === c.id ? (
                    <>
                      <input
                        value={editingCategoryName}
                        onChange={(e) => setEditingCategoryName(e.target.value)}
                        style={{
                          flex: 1,
                          padding: "6px 8px",
                          borderRadius: 6,
                          border: "1px solid #d1d5db",
                        }}
                      />
                      <button onClick={() => saveCategory(c.id)} style={{ padding: "6px 8px" }}>
                        Хадгалах
                      </button>
                      <button
                        onClick={() => setEditingCategoryId(null)}
                        style={{ padding: "6px 8px" }}
                      >
                        Болих
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
                          border:
                            categoryFilterId === String(c.id)
                              ? "1px solid #2563eb"
                              : "1px solid #e5e7eb",
                          background:
                            categoryFilterId === String(c.id) ? "#eff6ff" : "white",
                          cursor: "pointer",
                        }}
                      >
                        {c.name}{" "}
                        <span style={{ color: "#6b7280", fontSize: 12 }}>
                          ({c._count?.products ?? 0})
                        </span>
                        {!c.isActive && (
                          <span style={{ marginLeft: 6, color: "#b45309", fontSize: 12 }}>
                            архив
                          </span>
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setEditingCategoryId(c.id);
                          setEditingCategoryName(c.name);
                        }}
                        style={{ padding: "6px 8px" }}
                      >
                        Засах
                      </button>
                      <button
                        onClick={() => toggleCategoryArchived(c)}
                        style={{ padding: "6px 8px" }}
                      >
                        {c.isActive ? "Архив" : "Сэргээх"}
                      </button>
                      <button
                        onClick={() => deleteCategory(c)}
                        style={{ padding: "6px 8px", color: "#b91c1c" }}
                      >
                        Устгах
                      </button>
                    </>
                  )}
                </div>
              ))}

              {visibleCategories.length === 0 && (
                <div style={{ color: "#6b7280" }}>Ангилал алга.</div>
              )}
            </div>
          )}

          {catError && (
            <div style={{ marginTop: 8, color: "#b91c1c", fontSize: 12 }}>{catError}</div>
          )}
        </section>

        <section
          style={{
            background: "white",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            padding: 12,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <h2 style={{ margin: 0, fontSize: 16 }}>Бараа</h2>
            <label style={{ fontSize: 12 }}>
              <input
                type="checkbox"
                checked={showArchivedProducts}
                onChange={(e) => setShowArchivedProducts(e.target.checked)}
                style={{ marginRight: 6 }}
              />
              Архивтай нь
            </label>
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
            <select
              value={categoryFilterId}
              onChange={(e) => setCategoryFilterId(e.target.value)}
              style={{
                padding: "6px 8px",
                borderRadius: 6,
                border: "1px solid #d1d5db",
              }}
            >
              <option value="">Бүх ангилал</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <input
              value={productQuery}
              onChange={(e) => setProductQuery(e.target.value)}
              placeholder="Нэр/код хайх..."
              style={{
                flex: 1,
                minWidth: 180,
                padding: "6px 8px",
                borderRadius: 6,
                border: "1px solid #d1d5db",
              }}
            />

            <button onClick={loadProducts} style={{ padding: "6px 10px" }}>
              Хайх
            </button>
          </div>

          <div
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              padding: 10,
              marginBottom: 12,
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Бараа нэмэх</div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "170px 1fr 130px 100px",
                gap: 8,
                marginBottom: 8,
              }}
            >
              <select
                value={newProduct.categoryId}
                onChange={(e) => setNewProduct((p) => ({ ...p, categoryId: e.target.value }))}
                style={{
                  padding: "6px 8px",
                  borderRadius: 6,
                  border: "1px solid #d1d5db",
                }}
              >
                <option value="">Ангилал (заавал)</option>
                {categories.filter((c) => c.isActive).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <input
                value={newProduct.name}
                onChange={(e) => setNewProduct((p) => ({ ...p, name: e.target.value }))}
                placeholder="Нэр"
                style={{
                  padding: "6px 8px",
                  borderRadius: 6,
                  border: "1px solid #d1d5db",
                }}
              />
              <input
                value={newProduct.code}
                onChange={(e) => setNewProduct((p) => ({ ...p, code: e.target.value }))}
                placeholder="Код"
                style={{
                  padding: "6px 8px",
                  borderRadius: 6,
                  border: "1px solid #d1d5db",
                }}
              />
              <input
                value={newProduct.price}
                onChange={(e) => setNewProduct((p) => ({ ...p, price: e.target.value }))}
                placeholder="Үнэ"
                style={{
                  padding: "6px 8px",
                  borderRadius: 6,
                  border: "1px solid #d1d5db",
                }}
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
              <textarea
                value={newProduct.description}
                onChange={(e) => setNewProduct((p) => ({ ...p, description: e.target.value }))}
                placeholder="Тайлбар"
                rows={2}
                style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid #d1d5db" }}
              />
              <button
                onClick={createProduct}
                style={{
                  borderRadius: 6,
                  border: "none",
                  background: "#16a34a",
                  color: "white",
                  minWidth: 120,
                }}
              >
                Хадгалах
              </button>
            </div>

            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>
                Зураг ({newProduct.imagePaths.length}/{MAX_IMAGES})
              </div>
              <input
                type="file"
                accept="image/*"
                disabled={newImageUploading || newProduct.imagePaths.length >= MAX_IMAGES}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  await handleAddNewProductImage(file);
                  e.target.value = "";
                }}
              />
              <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                {newProduct.imagePaths.map((path, idx) => (
                  <div key={`${path}-${idx}`} style={{ position: "relative" }}>
                    <img
                      src={path}
                      alt={`new-product-image-${idx + 1}`}
                      style={{
                        width: 72,
                        height: 72,
                        objectFit: "cover",
                        borderRadius: 6,
                        border: "1px solid #e5e7eb",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setNewProduct((prev) => ({
                          ...prev,
                          imagePaths: prev.imagePaths.filter((_, i) => i !== idx),
                        }))
                      }
                      style={{
                        position: "absolute",
                        top: -8,
                        right: -8,
                        borderRadius: "50%",
                        border: "none",
                        width: 20,
                        height: 20,
                        background: "#dc2626",
                        color: "white",
                        cursor: "pointer",
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {prodLoading ? (
            <div style={{ color: "#6b7280" }}>Уншиж байна…</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #e5e7eb" }}>
                    Нэр
                  </th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #e5e7eb" }}>
                    Ангилал
                  </th>
                  <th style={{ textAlign: "right", padding: 8, borderBottom: "1px solid #e5e7eb" }}>
                    Үнэ
                  </th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #e5e7eb" }}>
                    Тайлбар
                  </th>
                  <th style={{ textAlign: "center", padding: 8, borderBottom: "1px solid #e5e7eb" }}>
                    Зураг
                  </th>
                  <th style={{ textAlign: "center", padding: 8, borderBottom: "1px solid #e5e7eb" }}>
                    Төлөв
                  </th>
                  <th style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }} />
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id}>
                    {editingProductId === p.id ? (
                      <>
                        <td style={{ padding: 8 }}>
                          <input
                            value={editingProduct.name}
                            onChange={(e) =>
                              setEditingProduct((x) => ({ ...x, name: e.target.value }))
                            }
                          />
                        </td>
                        <td style={{ padding: 8 }}>
                          <select
                            value={editingProduct.categoryId}
                            onChange={(e) =>
                              setEditingProduct((x) => ({ ...x, categoryId: e.target.value }))
                            }
                          >
                            {categories.filter((c) => c.isActive).map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td style={{ padding: 8, textAlign: "right" }}>
                          <input
                            value={editingProduct.price}
                            onChange={(e) =>
                              setEditingProduct((x) => ({ ...x, price: e.target.value }))
                            }
                          />
                        </td>
                        <td style={{ padding: 8 }}>
                          <textarea
                            value={editingProduct.description}
                            onChange={(e) =>
                              setEditingProduct((x) => ({
                                ...x,
                                description: e.target.value,
                              }))
                            }
                            rows={2}
                          />
                        </td>
                        <td style={{ padding: 8 }}>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {editingProduct.imagePaths.map((path, idx) => (
                              <div key={`${path}-${idx}`} style={{ position: "relative" }}>
                                <img
                                  src={path}
                                  alt={`edit-product-image-${idx + 1}`}
                                  style={{
                                    width: 48,
                                    height: 48,
                                    objectFit: "cover",
                                    borderRadius: 6,
                                    border: "1px solid #e5e7eb",
                                  }}
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    setEditingProduct((prev) => ({
                                      ...prev,
                                      imagePaths: prev.imagePaths.filter((_, i) => i !== idx),
                                    }))
                                  }
                                  style={{
                                    position: "absolute",
                                    top: -8,
                                    right: -8,
                                    borderRadius: "50%",
                                    border: "none",
                                    width: 18,
                                    height: 18,
                                    background: "#dc2626",
                                    color: "white",
                                    cursor: "pointer",
                                    fontSize: 12,
                                  }}
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                          <input
                            type="file"
                            accept="image/*"
                            disabled={
                              editImageUploading ||
                              editingProduct.imagePaths.length >= MAX_IMAGES
                            }
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              await handleAddEditProductImage(file);
                              e.target.value = "";
                            }}
                            style={{ marginTop: 6, maxWidth: 200 }}
                          />
                        </td>
                        <td style={{ padding: 8, textAlign: "center" }}>
                          <input
                            type="checkbox"
                            checked={editingProduct.isActive}
                            onChange={(e) =>
                              setEditingProduct((x) => ({ ...x, isActive: e.target.checked }))
                            }
                          />
                        </td>
                        <td style={{ padding: 8, textAlign: "right", whiteSpace: "nowrap" }}>
                          <button onClick={() => saveProduct(p.id)} style={{ marginRight: 6 }}>
                            Хадгалах
                          </button>
                          <button onClick={() => setEditingProductId(null)}>Болих</button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td style={{ padding: 8 }}>{p.name}</td>
                        <td style={{ padding: 8 }}>{(p as any).category?.name || p.categoryId}</td>
                        <td style={{ padding: 8, textAlign: "right" }}>
                          {Number(p.price).toLocaleString("mn-MN")}
                        </td>
                        <td style={{ padding: 8 }}>{p.description || "-"}</td>
                        <td style={{ padding: 8, textAlign: "center" }}>
                          <div style={{ display: "flex", justifyContent: "center", gap: 4 }}>
                            {(Array.isArray(p.imagePaths) ? p.imagePaths : []).slice(0, 2).map((img, idx) => (
                              <img
                                key={`${img}-${idx}`}
                                src={img}
                                alt={`${p.name}-img-${idx + 1}`}
                                style={{
                                  width: 34,
                                  height: 34,
                                  borderRadius: 6,
                                  objectFit: "cover",
                                  border: "1px solid #e5e7eb",
                                }}
                              />
                            ))}
                          </div>
                          <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
                            {(Array.isArray(p.imagePaths) ? p.imagePaths.length : 0)} зураг
                          </div>
                        </td>
                        <td style={{ padding: 8, textAlign: "center" }}>
                          {p.isActive ? "Идэвхтэй" : "Архив"}
                        </td>
                        <td style={{ padding: 8, textAlign: "right", whiteSpace: "nowrap" }}>
                          <button onClick={() => startEditProduct(p)} style={{ marginRight: 6 }}>
                            Засах
                          </button>
                          <button
                            onClick={() => toggleProductArchived(p)}
                            style={{ marginRight: 6 }}
                          >
                            {p.isActive ? "Архив" : "Сэргээх"}
                          </button>
                          <button onClick={() => deleteProduct(p)} style={{ color: "#b91c1c" }}>
                            Устгах
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
                {products.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ padding: 8, color: "#6b7280" }}>
                      Бараа алга.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {prodError && (
            <div style={{ marginTop: 8, color: "#b91c1c", fontSize: 12 }}>{prodError}</div>
          )}
        </section>
      </div>
    </main>
  );
}
