import React, { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";

type Category = {
  id: number;
  name: string;
  isActive: boolean;
  _count?: { products: number };
};

type ProductRow = {
  id: number;
  categoryId: number;
  name: string;
  code: string | null;
  price: number;
  description: string | null;
  imagePaths: string[];
  isActive: boolean;
  category?: Category;
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
  const [walletAmountInput, setWalletAmountInput] = useState("");
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletSaving, setWalletSaving] = useState(false);
  const [walletMessage, setWalletMessage] = useState("");

  const loadCategories = async () => {
    setCatLoading(true);
    setCatError("");
    try {
      const res = await fetch("/api/supply/categories?includeInactive=true");
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
    setProdLoading(true);
    setProdError("");
    try {
      const params = new URLSearchParams();
      if (categoryFilterId) params.set("categoryId", categoryFilterId);
      if (productQuery.trim()) params.set("q", productQuery.trim());
      if (!showArchivedProducts) params.set("onlyActive", "true");

      const res = await fetch(`/api/supply/products?${params.toString()}`);
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

  const loadWallet = async () => {
    setWalletLoading(true);
    setWalletMessage("");
    try {
      const res = await fetch("/api/supply/wallet");
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error((data && data.error) || "Кредит ачаалж чадсангүй.");
      }
      setWalletAmountInput(String(Number(data?.currentBalance || 0)));
    } catch (e: any) {
      setWalletMessage(e.message || "Кредит ачаалж чадсангүй.");
    } finally {
      setWalletLoading(false);
    }
  };

  useEffect(() => {
    void loadCategories();
    void loadProducts();
    void loadWallet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showArchivedProducts, categoryFilterId]);

  const createCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) return;

    try {
      const res = await fetch("/api/supply/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
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
      const res = await fetch(`/api/supply/categories/${id}`, {
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
      const res = await fetch(`/api/supply/categories/${category.id}/archive`, {
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
      const res = await fetch(`/api/supply/categories/${category.id}`, {
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
      const res = await fetch("/api/supply/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
      await loadCategories();
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
      const res = await fetch(`/api/supply/products/${id}`, {
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
      await loadCategories();
    } catch (e: any) {
      setProdError(e.message || "Бараа засахад алдаа гарлаа.");
    }
  };

  const toggleProductArchived = async (product: ProductRow) => {
    try {
      const res = await fetch(`/api/supply/products/${product.id}/archive`, {
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
      const res = await fetch(`/api/supply/products/${product.id}`, {
        method: "DELETE",
      });
      if (res.status === 204) {
        if (editingProductId === product.id) {
          setEditingProductId(null);
        }
        await loadProducts();
        await loadCategories();
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

  const saveWalletBalance = async () => {
    const amount = Number(walletAmountInput);
    if (!Number.isFinite(amount) || amount < 0) {
      setWalletMessage("Үлдэгдэл 0 эсвэл түүнээс дээш тоо байна.");
      return;
    }
    setWalletSaving(true);
    setWalletMessage("");
    try {
      const res = await fetch("/api/supply/wallet", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error((data && data.error) || "Кредит хадгалах үед алдаа гарлаа.");
      }
      setWalletAmountInput(String(Number(data?.currentBalance || 0)));
      setWalletMessage("Амжилттай хадгаллаа.");
    } catch (e: any) {
      setWalletMessage(e.message || "Кредит хадгалах үед алдаа гарлаа.");
    } finally {
      setWalletSaving(false);
    }
  };

  if (authLoading) {
    return (
      <main className="mx-auto my-4 max-w-7xl p-6">
        <div className="text-sm text-slate-600">Ачааллаж байна...</div>
      </main>
    );
  }

  if (!canManage) {
    return (
      <main className="mx-auto my-4 max-w-7xl p-6">
        <h1 className="mb-3 text-2xl font-semibold">Хангамж - Бусад</h1>
        <div className="text-sm text-red-700">Хандах эрхгүй.</div>
      </main>
    );
  }

  const visibleCategories = showArchivedCategories
    ? categories
    : categories.filter((c) => c.isActive);

  return (
    <main className="mx-auto my-4 max-w-[1320px] p-6">
      <h1 className="mb-2 text-2xl font-semibold">Хангамж - Бусад</h1>
      <p className="mb-4 text-sm text-slate-600">
        Нэгдсэн ангилал, барааны мастер бүртгэл (салбар хамааралгүй).
      </p>

      <div className="grid gap-3 xl:grid-cols-[360px_1fr]">
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Ангилал</h2>
            <label className="inline-flex items-center gap-1 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={showArchivedCategories}
                onChange={(e) => setShowArchivedCategories(e.target.checked)}
              />
              Архивтай нь
            </label>
          </div>

          <div className="mb-3 flex gap-2">
            <input
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="Ангиллын нэр"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={createCategory}
              className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Нэмэх
            </button>
          </div>

          {catLoading ? (
            <div className="text-sm text-slate-600">Уншиж байна...</div>
          ) : (
            <div className="space-y-2">
              {visibleCategories.map((c) => (
                <div key={c.id} className="rounded-lg border border-slate-200 p-2">
                  {editingCategoryId === c.id ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        value={editingCategoryName}
                        onChange={(e) => setEditingCategoryName(e.target.value)}
                        className="min-w-[180px] flex-1 rounded border border-slate-300 px-2 py-1.5 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => saveCategory(c.id)}
                        className="rounded border border-slate-300 px-2 py-1.5 text-xs"
                      >
                        Хадгалах
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingCategoryId(null)}
                        className="rounded border border-slate-300 px-2 py-1.5 text-xs"
                      >
                        Болих
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCategoryFilterId(String(c.id))}
                        className={`min-w-[180px] flex-1 rounded-lg border px-2 py-1.5 text-left text-sm ${
                          categoryFilterId === String(c.id)
                            ? "border-blue-300 bg-blue-50 text-blue-700"
                            : "border-slate-300 bg-white text-slate-800"
                        }`}
                      >
                        {c.name}
                        <span className="ml-1 text-xs text-slate-500">
                          ({c._count?.products ?? 0})
                        </span>
                        {!c.isActive && (
                          <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700">
                            архив
                          </span>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCategoryId(c.id);
                          setEditingCategoryName(c.name);
                        }}
                        className="rounded border border-slate-300 px-2 py-1.5 text-xs"
                      >
                        Засах
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleCategoryArchived(c)}
                        className="rounded border border-slate-300 px-2 py-1.5 text-xs"
                      >
                        {c.isActive ? "Архив" : "Сэргээх"}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteCategory(c)}
                        className="rounded border border-red-300 px-2 py-1.5 text-xs text-red-700"
                      >
                        Устгах
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {visibleCategories.length === 0 && (
                <div className="text-sm text-slate-600">Ангилал алга.</div>
              )}
            </div>
          )}

          {catError && <div className="mt-3 text-xs text-red-700">{catError}</div>}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Бараа</h2>
            <label className="inline-flex items-center gap-1 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={showArchivedProducts}
                onChange={(e) => setShowArchivedProducts(e.target.checked)}
              />
              Архивтай нь
            </label>
          </div>

          <div className="mb-3 flex flex-wrap gap-2">
            <select
              value={categoryFilterId}
              onChange={(e) => setCategoryFilterId(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
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
              className="min-w-[180px] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />

            <button
              type="button"
              onClick={loadProducts}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              Хайх
            </button>
          </div>

          <div className="mb-3 rounded-xl border border-slate-200 p-3">
            <div className="mb-2 text-sm font-semibold">Бараа нэмэх</div>
            <div className="grid gap-2 md:grid-cols-[170px_1fr_130px_110px]">
              <select
                value={newProduct.categoryId}
                onChange={(e) => setNewProduct((p) => ({ ...p, categoryId: e.target.value }))}
                className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
              >
                <option value="">Ангилал (заавал)</option>
                {categories
                  .filter((c) => c.isActive)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
              <input
                value={newProduct.name}
                onChange={(e) => setNewProduct((p) => ({ ...p, name: e.target.value }))}
                placeholder="Нэр"
                className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
              />
              <input
                value={newProduct.code}
                onChange={(e) => setNewProduct((p) => ({ ...p, code: e.target.value }))}
                placeholder="Код"
                className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
              />
              <input
                value={newProduct.price}
                onChange={(e) => setNewProduct((p) => ({ ...p, price: e.target.value }))}
                placeholder="Үнэ"
                className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
              />
            </div>

            <div className="mt-2 grid gap-2 md:grid-cols-[1fr_auto]">
              <textarea
                value={newProduct.description}
                onChange={(e) => setNewProduct((p) => ({ ...p, description: e.target.value }))}
                placeholder="Тайлбар"
                rows={2}
                className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
              />
              <button
                type="button"
                onClick={createProduct}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
              >
                Хадгалах
              </button>
            </div>

            <div className="mt-2 text-xs text-slate-600">
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
              className="mt-1 text-xs"
            />

            <div className="mt-2 flex flex-wrap gap-2">
              {newProduct.imagePaths.map((path, idx) => (
                <div key={`${path}-${idx}`} className="relative">
                  <img
                    src={path}
                    alt={`new-product-image-${idx + 1}`}
                    className="h-16 w-16 rounded border border-slate-200 object-cover"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setNewProduct((prev) => ({
                        ...prev,
                        imagePaths: prev.imagePaths.filter((_, i) => i !== idx),
                      }))
                    }
                    className="absolute -right-2 -top-2 h-5 w-5 rounded-full bg-red-600 text-xs text-white"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="mb-3 rounded-xl border border-slate-200 p-3">
            <div className="mb-2 text-sm font-semibold">Кредит (absolute balance)</div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="number"
                min={0}
                value={walletAmountInput}
                onChange={(e) => setWalletAmountInput(e.target.value)}
                placeholder="Ж: 100000"
                className="w-52 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={saveWalletBalance}
                disabled={walletLoading || walletSaving}
                className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-70"
              >
                {walletSaving ? "Хадгалж байна..." : "Хадгалах"}
              </button>
            </div>
            {walletMessage && (
              <div
                className={`mt-2 text-xs ${
                  walletMessage.includes("Амжилттай") ? "text-emerald-700" : "text-red-700"
                }`}
              >
                {walletMessage}
              </div>
            )}
          </div>

          {prodLoading ? (
            <div className="text-sm text-slate-600">Уншиж байна...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left">
                    <th className="px-2 py-2">Нэр</th>
                    <th className="px-2 py-2">Ангилал</th>
                    <th className="px-2 py-2 text-right">Үнэ</th>
                    <th className="px-2 py-2">Тайлбар</th>
                    <th className="px-2 py-2 text-center">Зураг</th>
                    <th className="px-2 py-2 text-center">Төлөв</th>
                    <th className="px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id} className="border-b border-slate-100 align-top">
                      {editingProductId === p.id ? (
                        <>
                          <td className="px-2 py-2">
                            <input
                              value={editingProduct.name}
                              onChange={(e) =>
                                setEditingProduct((x) => ({ ...x, name: e.target.value }))
                              }
                              className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <select
                              value={editingProduct.categoryId}
                              onChange={(e) =>
                                setEditingProduct((x) => ({ ...x, categoryId: e.target.value }))
                              }
                              className="rounded border border-slate-300 px-2 py-1.5 text-sm"
                            >
                              {categories
                                .filter((c) => c.isActive)
                                .map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.name}
                                  </option>
                                ))}
                            </select>
                          </td>
                          <td className="px-2 py-2 text-right">
                            <input
                              value={editingProduct.price}
                              onChange={(e) =>
                                setEditingProduct((x) => ({ ...x, price: e.target.value }))
                              }
                              className="w-24 rounded border border-slate-300 px-2 py-1.5 text-sm text-right"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <textarea
                              value={editingProduct.description}
                              onChange={(e) =>
                                setEditingProduct((x) => ({
                                  ...x,
                                  description: e.target.value,
                                }))
                              }
                              rows={2}
                              className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <div className="flex flex-wrap justify-center gap-1">
                              {editingProduct.imagePaths.map((path, idx) => (
                                <div key={`${path}-${idx}`} className="relative">
                                  <img
                                    src={path}
                                    alt={`edit-product-image-${idx + 1}`}
                                    className="h-12 w-12 rounded border border-slate-200 object-cover"
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setEditingProduct((prev) => ({
                                        ...prev,
                                        imagePaths: prev.imagePaths.filter((_, i) => i !== idx),
                                      }))
                                    }
                                    className="absolute -right-2 -top-2 h-4 w-4 rounded-full bg-red-600 text-[10px] text-white"
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
                              className="mt-1 max-w-[180px] text-xs"
                            />
                          </td>
                          <td className="px-2 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={editingProduct.isActive}
                              onChange={(e) =>
                                setEditingProduct((x) => ({ ...x, isActive: e.target.checked }))
                              }
                            />
                          </td>
                          <td className="whitespace-nowrap px-2 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => saveProduct(p.id)}
                              className="mr-1 rounded border border-slate-300 px-2 py-1 text-xs"
                            >
                              Хадгалах
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingProductId(null)}
                              className="rounded border border-slate-300 px-2 py-1 text-xs"
                            >
                              Болих
                            </button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-2 py-2">{p.name}</td>
                          <td className="px-2 py-2">{p.category?.name || p.categoryId}</td>
                          <td className="px-2 py-2 text-right">
                            {Number(p.price).toLocaleString("mn-MN")}
                          </td>
                          <td className="px-2 py-2">{p.description || "-"}</td>
                          <td className="px-2 py-2">
                            <div className="flex justify-center gap-1">
                              {(Array.isArray(p.imagePaths) ? p.imagePaths : [])
                                .slice(0, 2)
                                .map((img, idx) => (
                                  <img
                                    key={`${img}-${idx}`}
                                    src={img}
                                    alt={`${p.name}-img-${idx + 1}`}
                                    className="h-8 w-8 rounded border border-slate-200 object-cover"
                                  />
                                ))}
                            </div>
                            <div className="mt-0.5 text-center text-[10px] text-slate-500">
                              {(Array.isArray(p.imagePaths) ? p.imagePaths.length : 0)} зураг
                            </div>
                          </td>
                          <td className="px-2 py-2 text-center">
                            {p.isActive ? (
                              <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
                                Идэвхтэй
                              </span>
                            ) : (
                              <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
                                Архив
                              </span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-2 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => startEditProduct(p)}
                              className="mr-1 rounded border border-slate-300 px-2 py-1 text-xs"
                            >
                              Засах
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleProductArchived(p)}
                              className="mr-1 rounded border border-slate-300 px-2 py-1 text-xs"
                            >
                              {p.isActive ? "Архив" : "Сэргээх"}
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteProduct(p)}
                              className="rounded border border-red-300 px-2 py-1 text-xs text-red-700"
                            >
                              Устгах
                            </button>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}

                  {products.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-2 py-3 text-sm text-slate-600">
                        Бараа алга.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {prodError && <div className="mt-3 text-xs text-red-700">{prodError}</div>}
        </section>
      </div>
    </main>
  );
}
