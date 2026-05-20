import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";

type TabKey = "products" | "cart" | "account";

type SupplyCategory = {
  id: number;
  name: string;
  isActive: boolean;
};

type SupplyProduct = {
  id: number;
  categoryId: number;
  name: string;
  code: string | null;
  price: number;
  description: string | null;
  imagePaths: string[];
  isActive: boolean;
  createdAt: string;
  category?: SupplyCategory;
};

type CartItem = {
  product: SupplyProduct;
  qty: number;
};

type SupplyOrderHistory = {
  id: number;
  totalAmount: number;
  walletAmount: number;
  transferAmount: number;
  status: string;
  createdAt: string;
  items: Array<{
    id: number;
    productId: number;
    qty: number;
    unitPrice: number;
    lineTotal: number;
    product?: {
      id: number;
      name: string;
    };
  }>;
};

function Price({ value }: { value: number }) {
  return <>{Number(value).toLocaleString("mn-MN")} ₮</>;
}

function formatDateTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("mn-MN");
}

function ProductCarousel({
  images,
  heightClassName,
  onClick,
}: {
  images: string[];
  heightClassName: string;
  onClick?: () => void;
}) {
  const safeImages = Array.isArray(images) && images.length > 0 ? images : [];
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    setIdx(0);
  }, [safeImages.length]);

  const hasImages = safeImages.length > 0;
  const current = hasImages ? safeImages[idx % safeImages.length] : null;

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          if (hasImages) {
            setIdx((prev) => (prev + 1) % safeImages.length);
          }
          onClick?.();
        }}
        className={`w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-50 ${heightClassName}`}
      >
        {current ? (
          <img src={current} alt="product" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
            Зураггүй
          </div>
        )}
      </button>
      {hasImages && (
        <div className="mt-2 flex justify-center gap-1">
          {safeImages.map((_, dotIdx) => (
            <button
              key={dotIdx}
              type="button"
              onClick={() => setIdx(dotIdx)}
              className={`h-2 w-2 rounded-full ${
                dotIdx === idx ? "bg-blue-600" : "bg-slate-300"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AddingSpinner() {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
      Нэмж байна...
    </span>
  );
}

export default function SupplyEshopPage() {
  const { me, loading: authLoading } = useAuth();
  const canManage = me?.role === "admin" || me?.role === "super_admin";

  const [activeTab, setActiveTab] = useState<TabKey>("products");
  const [categories, setCategories] = useState<SupplyCategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);

  const [latestProducts, setLatestProducts] = useState<SupplyProduct[]>([]);
  const [latestLoading, setLatestLoading] = useState(false);

  const [categoryProducts, setCategoryProducts] = useState<SupplyProduct[]>([]);
  const [categoryLoading, setCategoryLoading] = useState(false);

  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [popupProduct, setPopupProduct] = useState<SupplyProduct | null>(null);
  const [error, setError] = useState("");
  const [walletBalance, setWalletBalance] = useState(0);
  const [walletLoading, setWalletLoading] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutUseWallet, setCheckoutUseWallet] = useState(true);
  const [checkoutUseTransfer, setCheckoutUseTransfer] = useState(true);
  const [checkoutWalletInput, setCheckoutWalletInput] = useState("0");
  const [checkoutTransferInput, setCheckoutTransferInput] = useState("0");
  const [checkoutError, setCheckoutError] = useState("");
  const [checkoutSuccess, setCheckoutSuccess] = useState("");
  const [checkingOut, setCheckingOut] = useState(false);
  const [addingProductIds, setAddingProductIds] = useState<number[]>([]);
  const [addedProductIds, setAddedProductIds] = useState<number[]>([]);
  const [creditPopupOpen, setCreditPopupOpen] = useState(false);
  const [creditRequestMessage, setCreditRequestMessage] = useState("");
  const [orderHistoryOpen, setOrderHistoryOpen] = useState(false);
  const [orderHistoryLoading, setOrderHistoryLoading] = useState(false);
  const [orderHistoryError, setOrderHistoryError] = useState("");
  const [orderHistory, setOrderHistory] = useState<SupplyOrderHistory[]>([]);

  const loadCategories = async () => {
    try {
      const res = await fetch("/api/supply/categories");
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error((data && data.error) || "Ангилал ачаалж чадсангүй.");
      setCategories(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e.message || "Ангилал ачаалж чадсангүй.");
      setCategories([]);
    }
  };

  const loadLatestProducts = async () => {
    setLatestLoading(true);
    try {
      const params = new URLSearchParams({
        onlyActive: "true",
        sort: "newest",
        limit: "10",
      });
      const res = await fetch(`/api/supply/products?${params.toString()}`);
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error((data && data.error) || "Бараа ачаалж чадсангүй.");
      setLatestProducts(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e.message || "Бараа ачаалж чадсангүй.");
      setLatestProducts([]);
    } finally {
      setLatestLoading(false);
    }
  };

  const loadWallet = async () => {
    setWalletLoading(true);
    try {
      const res = await fetch("/api/supply/wallet");
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error((data && data.error) || "Кредит ачаалж чадсангүй.");
      setWalletBalance(Number(data?.currentBalance || 0));
    } catch (e: any) {
      setError(e.message || "Кредит ачаалж чадсангүй.");
      setWalletBalance(0);
    } finally {
      setWalletLoading(false);
    }
  };

  const loadCategoryProducts = async (categoryId: number) => {
    setCategoryLoading(true);
    try {
      const params = new URLSearchParams({
        onlyActive: "true",
        categoryId: String(categoryId),
      });
      const res = await fetch(`/api/supply/products?${params.toString()}`);
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error((data && data.error) || "Ангиллын бараа ачаалж чадсангүй.");
      setCategoryProducts(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e.message || "Ангиллын бараа ачаалж чадсангүй.");
      setCategoryProducts([]);
    } finally {
      setCategoryLoading(false);
    }
  };

  const loadOrderHistory = async () => {
    setOrderHistoryLoading(true);
    setOrderHistoryError("");
    try {
      const res = await fetch("/api/supply/orders?limit=30");
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error((data && data.error) || "Захиалгын түүх ачаалж чадсангүй.");
      }
      setOrderHistory(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setOrderHistory([]);
      setOrderHistoryError(e.message || "Захиалгын түүх ачаалж чадсангүй.");
    } finally {
      setOrderHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (!canManage) return;
    void Promise.all([loadCategories(), loadLatestProducts(), loadWallet()]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage]);

  useEffect(() => {
    if (!canManage) return;
    if (!selectedCategoryId) {
      setCategoryProducts([]);
      return;
    }
    void loadCategoryProducts(selectedCategoryId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategoryId, canManage]);

  useEffect(() => {
    if (!canManage) return;
    if (activeTab !== "account") return;
    void loadOrderHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, canManage]);

  const addToCart = (product: SupplyProduct) => {
    setCartItems((prev) => {
      const idx = prev.findIndex((x) => x.product.id === product.id);
      if (idx === -1) return [...prev, { product, qty: 1 }];
      const next = [...prev];
      next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
      return next;
    });
  };

  const addToCartWithFeedback = (product: SupplyProduct) => {
    const productId = product.id;
    if (addingProductIds.includes(productId)) return;
    if (addedProductIds.includes(productId)) {
      setActiveTab("cart");
      return;
    }

    setAddingProductIds((prev) => [...prev, productId]);
    window.setTimeout(() => {
      addToCart(product);
      setAddingProductIds((prev) => prev.filter((id) => id !== productId));
      setAddedProductIds((prev) => (prev.includes(productId) ? prev : [...prev, productId]));
    }, 320);
  };

  const changeQty = (productId: number, nextQty: number) => {
    if (nextQty <= 0) {
      setCartItems((prev) => prev.filter((x) => x.product.id !== productId));
      return;
    }
    setCartItems((prev) =>
      prev.map((x) => (x.product.id === productId ? { ...x, qty: nextQty } : x))
    );
  };

  const cartTotal = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.product.price * item.qty, 0),
    [cartItems]
  );

  const showProducts = selectedCategoryId ? categoryProducts : latestProducts;
  const productsLoading = selectedCategoryId ? categoryLoading : latestLoading;

  const openCheckout = () => {
    const walletPart = Math.min(walletBalance, cartTotal);
    const transferPart = Number((cartTotal - walletPart).toFixed(2));
    setCheckoutUseWallet(walletPart > 0);
    setCheckoutUseTransfer(true);
    setCheckoutWalletInput(walletPart.toFixed(2));
    setCheckoutTransferInput(transferPart.toFixed(2));
    setCheckoutError("");
    setCheckoutSuccess("");
    setCheckoutOpen(true);
  };

  const submitCheckout = async () => {
    const walletRaw = Number(checkoutWalletInput || "0");
    const transferRaw = Number(checkoutTransferInput || "0");
    const walletAmount = checkoutUseWallet ? walletRaw : 0;
    const transferAmount = checkoutUseTransfer ? transferRaw : 0;

    if (!checkoutUseWallet && !checkoutUseTransfer) {
      setCheckoutError("Ядаж нэг төлбөрийн хэлбэр сонгоно уу.");
      return;
    }
    if (!Number.isFinite(walletAmount) || walletAmount < 0) {
      setCheckoutError("Кредитийн дүн буруу байна.");
      return;
    }
    if (!Number.isFinite(transferAmount) || transferAmount < 0) {
      setCheckoutError("Шилжүүлгийн дүн буруу байна.");
      return;
    }
    if (walletAmount > walletBalance) {
      setCheckoutError("Кредитийн дүн үлдэгдлээс их байж болохгүй.");
      return;
    }
    const paymentTotal = Number((walletAmount + transferAmount).toFixed(2));
    if (Math.abs(paymentTotal - cartTotal) >= 0.01) {
      setCheckoutError("Төлбөрийн нийлбэр сагсны нийт дүнтэй тэнцүү байх ёстой.");
      return;
    }

    setCheckingOut(true);
    setCheckoutError("");
    try {
      const res = await fetch("/api/supply/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cartItems.map((item) => ({
            productId: item.product.id,
            qty: item.qty,
          })),
          walletAmount,
          transferAmount,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error((data && data.error) || "Захиалга үүсгэх үед алдаа гарлаа.");
      }
      setWalletBalance(Number(data?.walletBalance || 0));
      setCartItems([]);
      setCheckoutOpen(false);
      setCheckoutSuccess("Захиалга амжилттай үүслээ.");
      setActiveTab("account");
      setAddedProductIds([]);
    } catch (e: any) {
      setCheckoutError(e.message || "Захиалга үүсгэх үед алдаа гарлаа.");
    } finally {
      setCheckingOut(false);
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
        <h1 className="mb-3 text-2xl font-semibold">e-Shop</h1>
        <div className="text-sm text-red-700">Хандах эрхгүй.</div>
      </main>
    );
  }

  return (
    <main className="mx-auto my-4 max-w-[1320px] p-6">
      <h1 className="mb-4 text-2xl font-semibold text-slate-900">e-Shop</h1>

      <div className="mb-4 flex flex-wrap gap-2">
        {[
          { key: "products", label: "Бүтээгдэхүүн" },
          { key: "cart", label: "Сагс" },
          { key: "account", label: "Миний Аккаунт" },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key as TabKey)}
            className={`rounded-lg border px-4 py-2 text-sm font-semibold ${
              activeTab === tab.key
                ? "border-blue-700 bg-blue-700 text-white"
                : "border-slate-300 bg-white text-slate-800"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && <div className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {activeTab === "products" && (
        <section>
          <div className="mb-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelectedCategoryId(null)}
              className={`rounded-full border px-3 py-1.5 text-sm ${
                selectedCategoryId === null
                  ? "border-blue-300 bg-blue-50 text-blue-700"
                  : "border-slate-300 bg-white text-slate-700"
              }`}
            >
              Сүүлд нэмэгдсэн
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategoryId(cat.id)}
                className={`rounded-full border px-3 py-1.5 text-sm ${
                  selectedCategoryId === cat.id
                    ? "border-blue-300 bg-blue-50 text-blue-700"
                    : "border-slate-300 bg-white text-slate-700"
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          <div className="mb-3 text-sm text-slate-600">
            {selectedCategoryId ? "Сонгосон ангиллын бараанууд" : "Сүүлд нэмэгдсэн 10 бараа"}
          </div>

          {productsLoading ? (
            <div className="text-sm text-slate-600">Ачааллаж байна...</div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
              {showProducts.map((product) => (
                <div key={product.id} className="rounded-xl border border-slate-200 bg-white p-3">
                  <ProductCarousel
                    images={product.imagePaths}
                    heightClassName="h-36"
                    onClick={() => setPopupProduct(product)}
                  />
                  <button
                    type="button"
                    onClick={() => setPopupProduct(product)}
                    className="mt-2 w-full text-left text-sm font-semibold text-slate-900"
                  >
                    {product.name}
                  </button>
                  <div className="mt-1 text-sm font-bold text-blue-700">
                    <Price value={product.price} />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (addedProductIds.includes(product.id)) {
                        setActiveTab("cart");
                        return;
                      }
                      addToCartWithFeedback(product);
                    }}
                    className="mt-2 inline-flex w-full items-center justify-center rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700"
                  >
                    {addingProductIds.includes(product.id) ? (
                      <AddingSpinner />
                    ) : addedProductIds.includes(product.id) ? (
                      "Сагс руу очих"
                    ) : (
                      "Захиалах"
                    )}
                  </button>
                </div>
              ))}
              {showProducts.length === 0 && (
                <div className="col-span-full rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
                  Бараа алга.
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {activeTab === "cart" && (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-lg font-semibold">Сагс</h2>
          {cartItems.length === 0 ? (
            <div className="text-sm text-slate-600">Сагс хоосон байна.</div>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                {cartItems.map((item) => (
                  <div
                    key={item.product.id}
                    className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 rounded-lg border border-slate-200 p-3"
                  >
                    <div>
                      <div className="text-sm font-semibold">{item.product.name}</div>
                      <div className="text-xs font-semibold text-blue-700">
                        <Price value={item.product.price} />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => changeQty(item.product.id, item.qty - 1)}
                      className="h-8 w-8 rounded border border-slate-300 text-sm"
                    >
                      −
                    </button>
                    <div className="min-w-6 text-center text-sm font-semibold">{item.qty}</div>
                    <button
                      type="button"
                      onClick={() => changeQty(item.product.id, item.qty + 1)}
                      className="h-8 w-8 rounded border border-slate-300 text-sm"
                    >
                      +
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-3 text-sm font-bold">
                <span>Нийт дүн</span>
                <span>
                  <Price value={cartTotal} />
                </span>
              </div>

              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={openCheckout}
                  className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
                >
                  Захиалга үүсгэх
                </button>
              </div>
            </>
          )}
          {checkoutSuccess && (
            <div className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
              {checkoutSuccess}
            </div>
          )}
        </section>
      )}

      {activeTab === "account" && (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-lg font-semibold">Миний Аккаунт</h2>
          <div className="grid gap-1 text-sm text-slate-700">
            <div>
              <span className="font-semibold">Нэр:</span> {me?.name || "-"}
            </div>
            <div>
              <span className="font-semibold">Имэйл:</span> {me?.email || "-"}
            </div>
            <div>
              <span className="font-semibold">Эрх:</span> {me?.role || "-"}
            </div>
            <div>
              <span className="font-semibold">Кредит:</span>{" "}
              {walletLoading ? "Ачааллаж байна..." : <Price value={walletBalance} />}
            </div>
          </div>

          <div className="mt-3 grid justify-items-start gap-2">
            <button
              type="button"
              onClick={() => {
                setCreditRequestMessage("");
                setCreditPopupOpen(true);
              }}
              className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Кредит нэмэх
            </button>

            <button
              type="button"
              onClick={() => {
                setOrderHistoryOpen(true);
                void loadOrderHistory();
              }}
              className="text-sm font-semibold text-blue-700 underline"
            >
              Захиалгын түүх
            </button>

            {creditRequestMessage && (
              <div className="text-xs text-emerald-700">{creditRequestMessage}</div>
            )}
          </div>
        </section>
      )}

      {popupProduct && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/45 p-4"
          onClick={() => setPopupProduct(null)}
        >
          <div
            className="w-full max-w-3xl rounded-xl border border-slate-200 bg-white p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="grid gap-4 md:grid-cols-[260px_1fr]">
              <ProductCarousel images={popupProduct.imagePaths} heightClassName="h-60" />
              <div>
                <h3 className="mb-2 text-2xl font-semibold">{popupProduct.name}</h3>
                <div className="mb-2 text-lg font-bold text-blue-700">
                  <Price value={popupProduct.price} />
                </div>
                <div className="mb-3 text-sm text-slate-700">
                  {popupProduct.description || "Тайлбар оруулаагүй."}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (addedProductIds.includes(popupProduct.id)) {
                        setPopupProduct(null);
                        setActiveTab("cart");
                        return;
                      }
                      addToCartWithFeedback(popupProduct);
                    }}
                    className="inline-flex items-center justify-center rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
                  >
                    {addingProductIds.includes(popupProduct.id) ? (
                      <AddingSpinner />
                    ) : addedProductIds.includes(popupProduct.id) ? (
                      "Сагс руу очих"
                    ) : (
                      "Захиалах"
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPopupProduct(null)}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm"
                  >
                    Хаах
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {checkoutOpen && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/45 p-4"
          onClick={() => setCheckoutOpen(false)}
        >
          <div
            className="w-full max-w-xl rounded-xl border border-slate-200 bg-white p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-2 text-lg font-semibold">Захиалга баталгаажуулах</h3>
            <div className="mb-3 text-sm">
              Нийт дүн:{" "}
              <span className="font-bold">
                <Price value={cartTotal} />
              </span>
            </div>

            <div className="grid gap-2 rounded-lg border border-slate-200 p-3">
              <label className="flex flex-wrap items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={checkoutUseWallet}
                  onChange={(e) => setCheckoutUseWallet(e.target.checked)}
                />
                <span className="min-w-20">Кредит</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  disabled={!checkoutUseWallet}
                  value={checkoutWalletInput}
                  onChange={(e) => setCheckoutWalletInput(e.target.value)}
                  className="w-36 rounded border border-slate-300 px-2 py-1.5 text-sm"
                />
                <span className="text-xs text-slate-500">
                  (үлдэгдэл: <Price value={walletBalance} />)
                </span>
              </label>

              <label className="flex flex-wrap items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={checkoutUseTransfer}
                  onChange={(e) => setCheckoutUseTransfer(e.target.checked)}
                />
                <span className="min-w-20">Шилжүүлэг</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  disabled={!checkoutUseTransfer}
                  value={checkoutTransferInput}
                  onChange={(e) => setCheckoutTransferInput(e.target.value)}
                  className="w-36 rounded border border-slate-300 px-2 py-1.5 text-sm"
                />
              </label>
            </div>

            {checkoutError && (
              <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                {checkoutError}
              </div>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCheckoutOpen(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm"
              >
                Болих
              </button>
              <button
                type="button"
                onClick={submitCheckout}
                disabled={checkingOut}
                className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-70"
              >
                {checkingOut ? "Хадгалж байна..." : "Баталгаажуулах"}
              </button>
            </div>
          </div>
        </div>
      )}

      {creditPopupOpen && (
        <div
          className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-900/45 p-4"
          onClick={() => setCreditPopupOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-2 text-lg font-semibold">Кредит нэмэх</h3>
            <p className="mb-3 text-sm text-slate-700">Кредит нэмэх хүсэлт илгээх үү?</p>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCreditPopupOpen(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm"
              >
                Болих
              </button>
              <button
                type="button"
                onClick={() => {
                  setCreditRequestMessage("Хүсэлт амжилттай илгээгдлээ.");
                  setCreditPopupOpen(false);
                }}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Хүсэлт илгээх
              </button>
            </div>
          </div>
        </div>
      )}

      {orderHistoryOpen && (
        <div
          className="fixed inset-0 z-[96] flex items-center justify-center bg-slate-900/45 p-4"
          onClick={() => setOrderHistoryOpen(false)}
        >
          <div
            className="max-h-[85vh] w-full max-w-4xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-lg font-semibold">Захиалгын түүх</h3>
              <button
                type="button"
                onClick={() => setOrderHistoryOpen(false)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
              >
                Хаах
              </button>
            </div>

            {orderHistoryLoading ? (
              <div className="text-sm text-slate-600">Ачааллаж байна...</div>
            ) : orderHistoryError ? (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                {orderHistoryError}
              </div>
            ) : orderHistory.length === 0 ? (
              <div className="text-sm text-slate-600">Захиалгын түүх хоосон байна.</div>
            ) : (
              <div className="grid gap-3">
                {orderHistory.map((order) => (
                  <div key={order.id} className="rounded-lg border border-slate-200 p-3">
                    <div className="mb-2 flex flex-wrap justify-between gap-2 text-sm">
                      <span className="font-semibold">#{order.id}</span>
                      <span>{formatDateTime(order.createdAt)}</span>
                      <span>Төлөв: {order.status}</span>
                      <span className="font-semibold">
                        Нийт: <Price value={order.totalAmount} />
                      </span>
                    </div>
                    <div className="mb-2 text-xs text-slate-600">
                      Кредит: <Price value={order.walletAmount} />, Шилжүүлэг:{" "}
                      <Price value={order.transferAmount} />
                    </div>
                    <div className="grid gap-1">
                      {order.items.map((item) => (
                        <div key={item.id} className="text-xs text-slate-700">
                          • {item.product?.name || `Product #${item.productId}`} — {item.qty} x{" "}
                          <Price value={item.unitPrice} /> = <Price value={item.lineTotal} />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
