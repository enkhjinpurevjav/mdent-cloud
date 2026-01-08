import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";

type PaymentMethod = {
  id: number;
  key: string;
  label: string;
  isActive: boolean;
  sortOrder: number;
};

type PaymentProvider = {
  id: number;
  methodKey: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
  note?: string | null;
};

export default function PaymentSettingsPage() {
  const router = useRouter();

  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [providers, setProviders] = useState<PaymentProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // For editing
  const [editingMethod, setEditingMethod] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState("");

  // For adding provider
  const [addingProvider, setAddingProvider] = useState(false);
  const [newProviderMethodKey, setNewProviderMethodKey] = useState("");
  const [newProviderName, setNewProviderName] = useState("");
  const [newProviderNote, setNewProviderNote] = useState("");

  // For editing provider
  const [editingProvider, setEditingProvider] = useState<number | null>(null);
  const [editProviderName, setEditProviderName] = useState("");
  const [editProviderNote, setEditProviderNote] = useState("");

  const [activeTab, setActiveTab] = useState<string>(""); // methodKey for provider tabs

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [methodsRes, providersRes] = await Promise.all([
        fetch("/api/admin/payment-methods"),
        fetch("/api/admin/payment-providers"),
      ]);

      const methodsData = await methodsRes.json();
      const providersData = await providersRes.json();

      if (!methodsRes.ok || !methodsData) {
        throw new Error(methodsData?.error || "Failed to load payment methods");
      }
      if (!providersRes.ok || !providersData) {
        throw new Error(providersData?.error || "Failed to load payment providers");
      }

      setMethods(methodsData.methods || []);
      setProviders(providersData.providers || []);

      // Set default tab to first method with providers (TRANSFER, INSURANCE, APPLICATION)
      const providerMethods = ["TRANSFER", "INSURANCE", "APPLICATION"];
      const firstWithProviders = (methodsData.methods || []).find((m: PaymentMethod) =>
        providerMethods.includes(m.key)
      );
      if (firstWithProviders) {
        setActiveTab(firstWithProviders.key);
      }
    } catch (err: any) {
      console.error("Failed to load payment settings:", err);
      setError(err.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleMethodActive = async (method: PaymentMethod) => {
    try {
      const res = await fetch(`/api/admin/payment-methods/${method.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !method.isActive }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update method");
      }

      await loadData();
      setSuccess("Payment method updated successfully");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to update method");
    }
  };

  const handleSaveMethodLabel = async (methodId: number) => {
    if (!editLabel.trim()) {
      setError("Label cannot be empty");
      return;
    }

    try {
      const res = await fetch(`/api/admin/payment-methods/${methodId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: editLabel.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update label");
      }

      await loadData();
      setEditingMethod(null);
      setSuccess("Label updated successfully");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to update label");
    }
  };

  const handleToggleProviderActive = async (provider: PaymentProvider) => {
    try {
      const res = await fetch(`/api/admin/payment-providers/${provider.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !provider.isActive }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update provider");
      }

      await loadData();
      setSuccess("Provider updated successfully");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to update provider");
    }
  };

  const handleAddProvider = async () => {
    if (!newProviderMethodKey || !newProviderName.trim()) {
      setError("Method and name are required");
      return;
    }

    try {
      const res = await fetch("/api/admin/payment-providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          methodKey: newProviderMethodKey,
          name: newProviderName.trim(),
          note: newProviderNote.trim() || null,
          isActive: true,
          sortOrder: 0,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create provider");
      }

      await loadData();
      setAddingProvider(false);
      setNewProviderMethodKey("");
      setNewProviderName("");
      setNewProviderNote("");
      setSuccess("Provider added successfully");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to create provider");
    }
  };

  const handleSaveProviderEdit = async (providerId: number) => {
    if (!editProviderName.trim()) {
      setError("Provider name cannot be empty");
      return;
    }

    try {
      const res = await fetch(`/api/admin/payment-providers/${providerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editProviderName.trim(),
          note: editProviderNote.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update provider");
      }

      await loadData();
      setEditingProvider(null);
      setSuccess("Provider updated successfully");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to update provider");
    }
  };

  const handleDeleteProvider = async (provider: PaymentProvider) => {
    if (!confirm(`Delete provider "${provider.name}"?`)) return;

    try {
      const res = await fetch(`/api/admin/payment-providers/${provider.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete provider");
      }

      await loadData();
      setSuccess("Provider deleted successfully");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to delete provider");
    }
  };

  const providersByMethod = React.useMemo(() => {
    const map = new Map<string, PaymentProvider[]>();
    for (const p of providers) {
      if (!map.has(p.methodKey)) {
        map.set(p.methodKey, []);
      }
      map.get(p.methodKey)!.push(p);
    }
    return map;
  }, [providers]);

  const methodsWithProviders = methods.filter((m) =>
    ["TRANSFER", "INSURANCE", "APPLICATION"].includes(m.key)
  );

  if (loading) {
    return (
      <main style={{ maxWidth: 1200, margin: "40px auto", padding: 24 }}>
        <p>Loading...</p>
      </main>
    );
  }

  return (
    <main
      style={{
        maxWidth: 1200,
        margin: "40px auto",
        padding: 24,
        fontFamily: "sans-serif",
      }}
    >
      <h1 style={{ fontSize: 24, marginBottom: 16 }}>Төлбөрийн тохиргоо</h1>

      {error && (
        <div
          style={{
            padding: 12,
            marginBottom: 16,
            background: "#fef2f2",
            border: "1px solid #fca5a5",
            borderRadius: 8,
            color: "#b91c1c",
          }}
        >
          {error}
        </div>
      )}

      {success && (
        <div
          style={{
            padding: 12,
            marginBottom: 16,
            background: "#f0fdf4",
            border: "1px solid #86efac",
            borderRadius: 8,
            color: "#15803d",
          }}
        >
          {success}
        </div>
      )}

      {/* Payment Methods Section */}
      <section
        style={{
          marginBottom: 32,
          padding: 24,
          background: "#ffffff",
          borderRadius: 8,
          border: "1px solid #e5e7eb",
        }}
      >
        <h2 style={{ fontSize: 18, marginBottom: 16 }}>Payment Methods</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {methods.map((method) => (
            <div
              key={method.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: 12,
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                background: method.isActive ? "#ffffff" : "#f9fafb",
              }}
            >
              <input
                type="checkbox"
                checked={method.isActive}
                onChange={() => handleToggleMethodActive(method)}
                style={{ width: 18, height: 18 }}
              />

              <div style={{ flex: 1 }}>
                {editingMethod === method.id ? (
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      type="text"
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      style={{
                        flex: 1,
                        padding: "6px 8px",
                        fontSize: 14,
                        border: "1px solid #d1d5db",
                        borderRadius: 6,
                      }}
                    />
                    <button
                      onClick={() => handleSaveMethodLabel(method.id)}
                      style={{
                        padding: "6px 12px",
                        fontSize: 13,
                        border: "1px solid #2563eb",
                        borderRadius: 6,
                        background: "#eff6ff",
                        color: "#2563eb",
                        cursor: "pointer",
                      }}
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingMethod(null)}
                      style={{
                        padding: "6px 12px",
                        fontSize: 13,
                        border: "1px solid #d1d5db",
                        borderRadius: 6,
                        background: "#ffffff",
                        cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <strong style={{ fontSize: 14 }}>{method.label}</strong>
                    <span
                      style={{
                        fontSize: 12,
                        color: "#6b7280",
                        fontFamily: "monospace",
                      }}
                    >
                      ({method.key})
                    </span>
                    <button
                      onClick={() => {
                        setEditingMethod(method.id);
                        setEditLabel(method.label);
                      }}
                      style={{
                        marginLeft: 8,
                        padding: "4px 8px",
                        fontSize: 12,
                        border: "1px solid #d1d5db",
                        borderRadius: 4,
                        background: "#ffffff",
                        cursor: "pointer",
                      }}
                    >
                      Edit
                    </button>
                  </div>
                )}
              </div>

              <div
                style={{
                  padding: "4px 8px",
                  fontSize: 12,
                  borderRadius: 4,
                  background: method.isActive ? "#d1fae5" : "#fee2e2",
                  color: method.isActive ? "#065f46" : "#991b1b",
                }}
              >
                {method.isActive ? "Active" : "Inactive"}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Payment Providers Section */}
      <section
        style={{
          padding: 24,
          background: "#ffffff",
          borderRadius: 8,
          border: "1px solid #e5e7eb",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <h2 style={{ fontSize: 18, margin: 0 }}>Payment Providers</h2>
          <button
            onClick={() => setAddingProvider(true)}
            style={{
              padding: "8px 16px",
              fontSize: 14,
              border: "1px solid #16a34a",
              borderRadius: 6,
              background: "#f0fdf4",
              color: "#15803d",
              cursor: "pointer",
            }}
          >
            + Add Provider
          </button>
        </div>

        {/* Add Provider Modal */}
        {addingProvider && (
          <div
            style={{
              marginBottom: 16,
              padding: 16,
              background: "#f9fafb",
              borderRadius: 8,
              border: "1px solid #e5e7eb",
            }}
          >
            <h3 style={{ fontSize: 16, marginBottom: 12 }}>Add New Provider</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>
                  Payment Method
                </label>
                <select
                  value={newProviderMethodKey}
                  onChange={(e) => setNewProviderMethodKey(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "6px 8px",
                    fontSize: 14,
                    border: "1px solid #d1d5db",
                    borderRadius: 6,
                  }}
                >
                  <option value="">Select method...</option>
                  {methodsWithProviders.map((m) => (
                    <option key={m.key} value={m.key}>
                      {m.label} ({m.key})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>
                  Provider Name
                </label>
                <input
                  type="text"
                  value={newProviderName}
                  onChange={(e) => setNewProviderName(e.target.value)}
                  placeholder="e.g. Хаан банк"
                  style={{
                    width: "100%",
                    padding: "6px 8px",
                    fontSize: 14,
                    border: "1px solid #d1d5db",
                    borderRadius: 6,
                  }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>
                  Note (optional)
                </label>
                <input
                  type="text"
                  value={newProviderNote}
                  onChange={(e) => setNewProviderNote(e.target.value)}
                  placeholder="Optional note"
                  style={{
                    width: "100%",
                    padding: "6px 8px",
                    fontSize: 14,
                    border: "1px solid #d1d5db",
                    borderRadius: 6,
                  }}
                />
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button
                  onClick={() => {
                    setAddingProvider(false);
                    setNewProviderMethodKey("");
                    setNewProviderName("");
                    setNewProviderNote("");
                  }}
                  style={{
                    padding: "6px 12px",
                    fontSize: 13,
                    border: "1px solid #d1d5db",
                    borderRadius: 6,
                    background: "#ffffff",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddProvider}
                  style={{
                    padding: "6px 12px",
                    fontSize: 13,
                    border: "1px solid #16a34a",
                    borderRadius: 6,
                    background: "#f0fdf4",
                    color: "#15803d",
                    cursor: "pointer",
                  }}
                >
                  Add Provider
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tabs for provider methods */}
        <div style={{ borderBottom: "1px solid #e5e7eb", marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 8 }}>
            {methodsWithProviders.map((method) => (
              <button
                key={method.key}
                onClick={() => setActiveTab(method.key)}
                style={{
                  padding: "8px 16px",
                  fontSize: 14,
                  border: "none",
                  borderBottom:
                    activeTab === method.key ? "2px solid #2563eb" : "2px solid transparent",
                  background: "transparent",
                  color: activeTab === method.key ? "#2563eb" : "#6b7280",
                  cursor: "pointer",
                  fontWeight: activeTab === method.key ? 600 : 400,
                }}
              >
                {method.label}
              </button>
            ))}
          </div>
        </div>

        {/* Provider List for Active Tab */}
        {activeTab && (
          <div>
            {(providersByMethod.get(activeTab) || []).length === 0 ? (
              <p style={{ fontSize: 14, color: "#6b7280" }}>No providers configured yet.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {(providersByMethod.get(activeTab) || []).map((provider) => (
                  <div
                    key={provider.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: 12,
                      borderRadius: 8,
                      border: "1px solid #e5e7eb",
                      background: provider.isActive ? "#ffffff" : "#f9fafb",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={provider.isActive}
                      onChange={() => handleToggleProviderActive(provider)}
                      style={{ width: 18, height: 18 }}
                    />

                    <div style={{ flex: 1 }}>
                      {editingProvider === provider.id ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          <input
                            type="text"
                            value={editProviderName}
                            onChange={(e) => setEditProviderName(e.target.value)}
                            placeholder="Provider name"
                            style={{
                              padding: "6px 8px",
                              fontSize: 14,
                              border: "1px solid #d1d5db",
                              borderRadius: 6,
                            }}
                          />
                          <input
                            type="text"
                            value={editProviderNote}
                            onChange={(e) => setEditProviderNote(e.target.value)}
                            placeholder="Note (optional)"
                            style={{
                              padding: "6px 8px",
                              fontSize: 14,
                              border: "1px solid #d1d5db",
                              borderRadius: 6,
                            }}
                          />
                          <div style={{ display: "flex", gap: 8 }}>
                            <button
                              onClick={() => handleSaveProviderEdit(provider.id)}
                              style={{
                                padding: "6px 12px",
                                fontSize: 13,
                                border: "1px solid #2563eb",
                                borderRadius: 6,
                                background: "#eff6ff",
                                color: "#2563eb",
                                cursor: "pointer",
                              }}
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingProvider(null)}
                              style={{
                                padding: "6px 12px",
                                fontSize: 13,
                                border: "1px solid #d1d5db",
                                borderRadius: 6,
                                background: "#ffffff",
                                cursor: "pointer",
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <strong style={{ fontSize: 14 }}>{provider.name}</strong>
                            <div style={{ display: "flex", gap: 4 }}>
                              <button
                                onClick={() => {
                                  setEditingProvider(provider.id);
                                  setEditProviderName(provider.name);
                                  setEditProviderNote(provider.note || "");
                                }}
                                style={{
                                  padding: "4px 8px",
                                  fontSize: 12,
                                  border: "1px solid #d1d5db",
                                  borderRadius: 4,
                                  background: "#ffffff",
                                  cursor: "pointer",
                                }}
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteProvider(provider)}
                                style={{
                                  padding: "4px 8px",
                                  fontSize: 12,
                                  border: "1px solid #dc2626",
                                  borderRadius: 4,
                                  background: "#fef2f2",
                                  color: "#b91c1c",
                                  cursor: "pointer",
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                          {provider.note && (
                            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                              Note: {provider.note}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div
                      style={{
                        padding: "4px 8px",
                        fontSize: 12,
                        borderRadius: 4,
                        background: provider.isActive ? "#d1fae5" : "#fee2e2",
                        color: provider.isActive ? "#065f46" : "#991b1b",
                      }}
                    >
                      {provider.isActive ? "Active" : "Inactive"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
