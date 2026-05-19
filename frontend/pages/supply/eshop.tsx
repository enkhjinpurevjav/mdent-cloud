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

function Price({ value }: { value: number }) {
  return <>{Number(value).toLocaleString("mn-MN")} ₮</>;
}

function ProductCarousel({
  images,
  height,
  onClick,
}: {
  images: string[];
  height: number;
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
        style={{
          width: "100%",
          height,
          border: "1px solid #e5e7eb",
          borderRadius: 8,
          background: "#f8fafc",
          cursor: "pointer",
          overflow: "hidden",
          padding: 0,
        }}
      >
        {current ? (
          <img
            src={current}
            alt="product"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#94a3b8",
              fontSize: 12,
            }}
          >
            Зураггүй
          </div>
        )}
      </button>
      {hasImages && (
        <div style={{ display: "flex", justifyContent: "center", gap: 4, marginTop: 6 }}>
          {safeImages.map((_, dotIdx) => (
            <button
              key={dotIdx}
              type="button"
              onClick={() => setIdx(dotIdx)}
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                border: "none",
                cursor: "pointer",
                background: dotIdx === idx ? "#2563eb" : "#cbd5e1",
                padding: 0,
              }}
            />
          ))}
        </div>
      )}
    </div>
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
      if (!res.ok) throw new Error((data && data.error) || "Хэтэвчийн үлдэгдэл ачаалж чадсангүй.");
      setWalletBalance(Number(data?.currentBalance || 0));
    } catch (e: any) {
      setError(e.message || "Хэтэвчийн үлдэгдэл ачаалж чадсангүй.");
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

  const addToCart = (product: SupplyProduct) => {
    setCartItems((prev) => {
      const idx = prev.findIndex((x) => x.product.id === product.id);
      if (idx === -1) return [...prev, { product, qty: 1 }];
      const next = [...prev];
      next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
      return next;
    });
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
      setCheckoutError("Хэтэвчийн дүн буруу байна.");
      return;
    }
    if (!Number.isFinite(transferAmount) || transferAmount < 0) {
      setCheckoutError("Шилжүүлгийн дүн буруу байна.");
      return;
    }
    if (walletAmount > walletBalance) {
      setCheckoutError("Хэтэвчийн дүн үлдэгдлээс их байж болохгүй.");
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
        throw new Error((data && data.error) || "Checkout хийхэд алдаа гарлаа.");
      }
      setWalletBalance(Number(data?.walletBalance || 0));
      setCartItems([]);
      setCheckoutOpen(false);
      setCheckoutSuccess("Checkout амжилттай.");
      setActiveTab("account");
    } catch (e: any) {
      setCheckoutError(e.message || "Checkout хийхэд алдаа гарлаа.");
    } finally {
      setCheckingOut(false);
    }
  };

  if (authLoading) {
    return (
      <main style={{ maxWidth: 1200, margin: "16px auto", padding: 24 }}>Ачааллаж байна...</main>
    );
  }

  if (!canManage) {
    return (
      <main style={{ maxWidth: 1200, margin: "16px auto", padding: 24 }}>
        <h1 style={{ marginTop: 0, fontSize: 22 }}>e-Shop</h1>
        <div style={{ color: "#b91c1c" }}>Хандах эрхгүй.</div>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 1280, margin: "16px auto", padding: 24, fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: 24, margin: "0 0 12px" }}>e-Shop</h1>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {[
          { key: "products", label: "Бүтээгдэхүүн" },
          { key: "cart", label: "Сагс" },
          { key: "account", label: "Миний Аккаунт" },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key as TabKey)}
            style={{
              border: "1px solid #d1d5db",
              borderRadius: 10,
              padding: "8px 14px",
              background: activeTab === tab.key ? "#1d4ed8" : "white",
              color: activeTab === tab.key ? "white" : "#111827",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && (
        <div style={{ marginBottom: 12, color: "#b91c1c", fontSize: 13 }}>
          {error}
        </div>
      )}

      {activeTab === "products" && (
        <section>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
            <button
              type="button"
              onClick={() => setSelectedCategoryId(null)}
              style={{
                borderRadius: 999,
                border: "1px solid #cbd5e1",
                padding: "6px 12px",
                background: selectedCategoryId === null ? "#dbeafe" : "white",
                cursor: "pointer",
              }}
            >
              Сүүлд нэмэгдсэн
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategoryId(cat.id)}
                style={{
                  borderRadius: 999,
                  border: "1px solid #cbd5e1",
                  padding: "6px 12px",
                  background: selectedCategoryId === cat.id ? "#dbeafe" : "white",
                  cursor: "pointer",
                }}
              >
                {cat.name}
              </button>
            ))}
          </div>

          <div style={{ marginBottom: 10, fontSize: 13, color: "#475569" }}>
            {selectedCategoryId ? "Сонгосон ангиллын бараанууд" : "Сүүлд нэмэгдсэн 10 бараа"}
          </div>

          {productsLoading ? (
            <div style={{ color: "#6b7280" }}>Ачааллаж байна...</div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
                gap: 12,
              }}
            >
              {showProducts.map((product) => (
                <div
                  key={product.id}
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 10,
                    background: "white",
                    padding: 10,
                  }}
                >
                  <ProductCarousel
                    images={product.imagePaths}
                    height={126}
                    onClick={() => setPopupProduct(product)}
                  />
                  <button
                    type="button"
                    onClick={() => setPopupProduct(product)}
                    style={{
                      marginTop: 8,
                      border: "none",
                      background: "transparent",
                      textAlign: "left",
                      padding: 0,
                      cursor: "pointer",
                      width: "100%",
                    }}
                  >
                    <div style={{ fontWeight: 600, color: "#0f172a", lineHeight: 1.3 }}>
                      {product.name}
                    </div>
                  </button>
                  <div style={{ marginTop: 4, color: "#1d4ed8", fontWeight: 700 }}>
                    <Price value={product.price} />
                  </div>
                  <button
                    type="button"
                    onClick={() => addToCart(product)}
                    style={{
                      marginTop: 8,
                      width: "100%",
                      border: "none",
                      borderRadius: 8,
                      background: "#16a34a",
                      color: "white",
                      padding: "8px 10px",
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    Захиалах
                  </button>
                </div>
              ))}
              {showProducts.length === 0 && (
                <div style={{ color: "#6b7280", gridColumn: "1 / -1" }}>Бараа алга.</div>
              )}
            </div>
          )}
        </section>
      )}

      {activeTab === "cart" && (
        <section
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 10,
            background: "white",
            padding: 14,
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: 10, fontSize: 18 }}>Сагс</h2>
          {cartItems.length === 0 ? (
            <div style={{ color: "#6b7280" }}>Сагс хоосон байна.</div>
          ) : (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {cartItems.map((item) => (
                  <div
                    key={item.product.id}
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: 8,
                      padding: 10,
                      display: "grid",
                      gridTemplateColumns: "1fr auto auto auto",
                      gap: 10,
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600 }}>{item.product.name}</div>
                      <div style={{ color: "#1d4ed8", fontSize: 13 }}>
                        <Price value={item.product.price} />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => changeQty(item.product.id, item.qty - 1)}
                      style={{ width: 28, height: 28 }}
                    >
                      −
                    </button>
                    <div style={{ minWidth: 24, textAlign: "center", fontWeight: 600 }}>
                      {item.qty}
                    </div>
                    <button
                      type="button"
                      onClick={() => changeQty(item.product.id, item.qty + 1)}
                      style={{ width: 28, height: 28 }}
                    >
                      +
                    </button>
                  </div>
                ))}
              </div>

              <div
                style={{
                  marginTop: 12,
                  paddingTop: 10,
                  borderTop: "1px solid #e5e7eb",
                  display: "flex",
                  justifyContent: "space-between",
                  fontWeight: 700,
                }}
              >
                <span>Нийт дүн</span>
                <span>
                  <Price value={cartTotal} />
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
                <button
                  type="button"
                  onClick={openCheckout}
                  style={{
                    border: "none",
                    borderRadius: 8,
                    background: "#0f766e",
                    color: "white",
                    padding: "8px 14px",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  Check out
                </button>
              </div>
            </>
          )}
          {checkoutSuccess && (
            <div style={{ marginTop: 10, color: "#166534", fontSize: 13 }}>{checkoutSuccess}</div>
          )}
        </section>
      )}

      {activeTab === "account" && (
        <section
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 10,
            background: "white",
            padding: 14,
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: 10, fontSize: 18 }}>Миний Аккаунт</h2>
          <div style={{ display: "grid", gap: 6, fontSize: 14 }}>
            <div>
              <strong>Нэр:</strong> {me?.name || "-"}
            </div>
            <div>
              <strong>Имэйл:</strong> {me?.email || "-"}
            </div>
            <div>
              <strong>Эрх:</strong> {me?.role || "-"}
            </div>
            <div>
              <strong>Хэтэвчийн үлдэгдэл:</strong>{" "}
              {walletLoading ? "Ачааллаж байна..." : <Price value={walletBalance} />}
            </div>
          </div>
        </section>
      )}

      {popupProduct && (
        <div
          onClick={() => setPopupProduct(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.4)",
            zIndex: 80,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(680px, 100%)",
              background: "white",
              borderRadius: 12,
              padding: 14,
              border: "1px solid #e5e7eb",
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 14 }}>
              <ProductCarousel images={popupProduct.imagePaths} height={240} />
              <div>
                <h3 style={{ margin: 0, marginBottom: 8, fontSize: 22 }}>{popupProduct.name}</h3>
                <div style={{ color: "#1d4ed8", fontWeight: 700, marginBottom: 8 }}>
                  <Price value={popupProduct.price} />
                </div>
                <div style={{ fontSize: 14, color: "#334155", marginBottom: 12 }}>
                  {popupProduct.description || "Тайлбар оруулаагүй."}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => addToCart(popupProduct)}
                    style={{
                      border: "none",
                      borderRadius: 8,
                      background: "#16a34a",
                      color: "white",
                      padding: "8px 14px",
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    Захиалах
                  </button>
                  <button
                    type="button"
                    onClick={() => setPopupProduct(null)}
                    style={{ borderRadius: 8, padding: "8px 14px", cursor: "pointer" }}
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
          onClick={() => setCheckoutOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.4)",
            zIndex: 90,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(520px, 100%)",
              background: "white",
              borderRadius: 12,
              padding: 14,
              border: "1px solid #e5e7eb",
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: 10 }}>Checkout confirmation</h3>
            <div style={{ marginBottom: 10, fontSize: 14 }}>
              Нийт дүн: <strong><Price value={cartTotal} /></strong>
            </div>

            <div
              style={{
                display: "grid",
                gap: 10,
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                padding: 10,
              }}
            >
              <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={checkoutUseWallet}
                  onChange={(e) => setCheckoutUseWallet(e.target.checked)}
                />
                <span style={{ minWidth: 90 }}>Хэтэвч</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  disabled={!checkoutUseWallet}
                  value={checkoutWalletInput}
                  onChange={(e) => setCheckoutWalletInput(e.target.value)}
                  style={{ width: 150, padding: "6px 8px", border: "1px solid #d1d5db", borderRadius: 6 }}
                />
                <span style={{ fontSize: 12, color: "#64748b" }}>
                  (үлдэгдэл: <Price value={walletBalance} />)
                </span>
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={checkoutUseTransfer}
                  onChange={(e) => setCheckoutUseTransfer(e.target.checked)}
                />
                <span style={{ minWidth: 90 }}>Шилжүүлэг</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  disabled={!checkoutUseTransfer}
                  value={checkoutTransferInput}
                  onChange={(e) => setCheckoutTransferInput(e.target.value)}
                  style={{ width: 150, padding: "6px 8px", border: "1px solid #d1d5db", borderRadius: 6 }}
                />
              </label>
            </div>

            {checkoutError && (
              <div style={{ marginTop: 8, color: "#b91c1c", fontSize: 12 }}>
                {checkoutError}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
              <button type="button" onClick={() => setCheckoutOpen(false)}>
                Болих
              </button>
              <button
                type="button"
                onClick={submitCheckout}
                disabled={checkingOut}
                style={{
                  border: "none",
                  borderRadius: 8,
                  background: "#0f766e",
                  color: "white",
                  padding: "8px 14px",
                  cursor: checkingOut ? "default" : "pointer",
                  opacity: checkingOut ? 0.7 : 1,
                }}
              >
                {checkingOut ? "Хадгалж байна..." : "Баталгаажуулах"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
