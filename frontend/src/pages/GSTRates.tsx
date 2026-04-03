// frontend/src/pages/GSTRates.tsx
// GST Rate Master — 0%, 5%, 12%, 18%, 28% maintain karo

import { useEffect, useState } from "react";
import { getToken } from "../lib/session";

interface Rate {
  id: string;
  hsn_sac: string;
  description: string | null;
  gst_rate: number;
  effective_from: string;
  effective_to: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export default function GSTRates() {
  const token = getToken();
  const [rates, setRates] = useState<Rate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    hsn_sac: "",
    description: "",
    gst_rate: "",
    notes: "",
  });
  const [editingId, setEditingId] = useState<string | null>(null);

  // HSN search
  const [searchHsn, setSearchHsn] = useState("");
  const [searchRate, setSearchRate] = useState("");

  // Rates fetch karo
  const fetchRates = async () => {
    try {
      setLoading(true);
      setError(null);
      const url = new URL("/api/v1/gst-rates", window.location.origin);
      if (searchHsn) url.searchParams.set("hsn_sac", searchHsn);
      if (searchRate) url.searchParams.set("gst_rate", searchRate);

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error("Rates load nahi ho sake");
      }

      const data = await res.json();
      setRates(data.data.rates);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kuch galat ho gaya");
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchRates();
  }, []);

  // Handle search
  const handleSearch = () => {
    fetchRates();
  };

  // Add/Update rate
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!formData.hsn_sac || !formData.gst_rate) {
      setError("HSN/SAC aur GST rate zaroori hai");
      return;
    }

    const rateValue = parseFloat(formData.gst_rate);
    if (isNaN(rateValue) || rateValue < 0 || rateValue > 100) {
      setError("GST rate 0-100 ke beech hona chahiye");
      return;
    }

    try {
      setLoading(true);

      let res: Response;
      if (editingId) {
        // Update existing
        res = await fetch(`/api/v1/gst-rates/${editingId}`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            description: formData.description || null,
            gst_rate: rateValue,
            notes: formData.notes || null,
          }),
        });
      } else {
        // Create new
        res = await fetch("/api/v1/gst-rates", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            hsn_sac: formData.hsn_sac.toUpperCase(),
            description: formData.description || null,
            gst_rate: rateValue,
            notes: formData.notes || null,
          }),
        });
      }

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || "Rate save nahi ho paya");
      }

      setSuccess(editingId ? "Rate update ho gaya" : "Rate add ho gaya");
      setFormData({ hsn_sac: "", description: "", gst_rate: "", notes: "" });
      setEditingId(null);
      setShowForm(false);
      fetchRates();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kuch galat ho gaya");
    } finally {
      setLoading(false);
    }
  };

  // Delete rate
  const handleDelete = async (id: string) => {
    if (!confirm("Kya ye rate delete karna hai?")) return;

    try {
      setLoading(true);
      const res = await fetch(`/api/v1/gst-rates/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error("Rate delete nahi ho paya");
      }

      setSuccess("Rate delete ho gaya");
      fetchRates();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kuch galat ho gaya");
    } finally {
      setLoading(false);
    }
  };

  // Edit mode enter karo
  const handleEdit = (rate: Rate) => {
    setFormData({
      hsn_sac: rate.hsn_sac,
      description: rate.description || "",
      gst_rate: rate.gst_rate.toString(),
      notes: rate.notes || "",
    });
    setEditingId(rate.id);
    setShowForm(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">GST Rate Master</h1>
          <p className="text-slate-400">HSN/SAC codes ke liye GST rates maintain karo</p>
        </div>

        {/* Error/Success messages */}
        {error && (
          <div className="mb-4 p-4 bg-red-900/20 border border-red-700 rounded-lg text-red-300">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-4 bg-green-900/20 border border-green-700 rounded-lg text-green-300">
            {success}
          </div>
        )}

        {/* Search and Add section */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
          <input
            type="text"
            placeholder="HSN/SAC search karo..."
            value={searchHsn}
            onChange={(e) => setSearchHsn(e.target.value)}
            className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:border-blue-500 outline-none"
          />

          <select
            value={searchRate}
            onChange={(e) => setSearchRate(e.target.value)}
            className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:border-blue-500 outline-none"
          >
            <option value="">Sab rates</option>
            <option value="0">0%</option>
            <option value="5">5%</option>
            <option value="12">12%</option>
            <option value="18">18%</option>
            <option value="28">28%</option>
          </select>

          <button
            onClick={handleSearch}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium disabled:opacity-50"
          >
            Search
          </button>

          <button
            onClick={() => {
              setShowForm(!showForm);
              setEditingId(null);
              setFormData({ hsn_sac: "", description: "", gst_rate: "", notes: "" });
            }}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-medium"
          >
            + Add GST Rate
          </button>
        </div>

        {/* Add/Edit Form */}
        {showForm && (
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 mb-6 backdrop-blur-sm">
            <h2 className="text-xl font-semibold mb-4">
              {editingId ? "Rate Update Karo" : "Naya Rate Add Karo"}
            </h2>

            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-slate-400 mb-2 block">HSN/SAC Code (agar new ho)</label>
                <input
                  type="text"
                  placeholder="eg: 5410"
                  value={formData.hsn_sac}
                  onChange={(e) => setFormData({ ...formData, hsn_sac: e.target.value.toUpperCase() })}
                  disabled={!!editingId}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:border-blue-500 outline-none disabled:opacity-50"
                />
              </div>

              <div>
                <label className="text-sm text-slate-400 mb-2 block">GST Rate (%)</label>
                <input
                  type="number"
                  placeholder="eg: 18"
                  min="0"
                  max="100"
                  step="0.01"
                  value={formData.gst_rate}
                  onChange={(e) => setFormData({ ...formData, gst_rate: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:border-blue-500 outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-sm text-slate-400 mb-2 block">Description</label>
                <input
                  type="text"
                  placeholder="eg: Cotton Fabrics"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:border-blue-500 outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-sm text-slate-400 mb-2 block">Notes</label>
                <textarea
                  placeholder="eg: Effective from..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:border-blue-500 outline-none"
                />
              </div>

              <div className="md:col-span-2 flex gap-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-medium disabled:opacity-50"
                >
                  {editingId ? "Update Karo" : "Add Karo"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingId(null);
                    setFormData({ hsn_sac: "", description: "", gst_rate: "", notes: "" });
                  }}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg font-medium"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Rates Table */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden backdrop-blur-sm">
          {loading && !showForm ? (
            <div className="p-8 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              <p className="mt-4 text-slate-400">Load ho raha hai...</p>
            </div>
          ) : rates.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              Koi rate nahi mila
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700 bg-slate-900/50">
                    <th className="text-left py-3 px-4 text-slate-400">HSN/SAC</th>
                    <th className="text-left py-3 px-4 text-slate-400">Description</th>
                    <th className="text-center py-3 px-4 text-slate-400">GST Rate</th>
                    <th className="text-left py-3 px-4 text-slate-400">Effective From</th>
                    <th className="text-center py-3 px-4 text-slate-400">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rates.map((rate) => (
                    <tr key={rate.id} className="border-b border-slate-700/50 hover:bg-slate-700/20">
                      <td className="py-3 px-4 font-mono text-blue-400 font-semibold">
                        {rate.hsn_sac}
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        {rate.description || "-"}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="bg-slate-700 px-3 py-1 rounded font-semibold">
                          {rate.gst_rate.toFixed(2)}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-400 text-sm">
                        {new Date(rate.effective_from).toLocaleDateString("en-IN")}
                      </td>
                      <td className="py-3 px-4 text-center space-x-2">
                        <button
                          onClick={() => handleEdit(rate)}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs font-medium"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(rate.id)}
                          className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-xs font-medium"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Info box */}
        <div className="mt-6 p-4 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-400 text-sm">
          <strong>💡 Tip:</strong> HSN/SAC codes International Classification of Products (ICP) par based hote hain. 
          Har product category ka ek unique code aur GST rate hota hai.
        </div>
      </div>
    </div>
  );
}
