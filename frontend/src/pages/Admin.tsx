// frontend/src/pages/Admin.tsx
// Admin dashboard — sabhi users, businesses, returns ka overview

import { useEffect, useState } from "react";
import { getToken } from "../lib/session";

interface DashboardStats {
  overview: {
    totalUsers: number;
    totalBusinesses: number;
    totalActiveBusinesses: number;
    recentUsers: number;
    recentBusinesses: number;
  };
  returns: {
    filed: number;
    pending: number;
  };
  scans: {
    total: number;
    successful: number;
    failed: number;
  };
  usersByPlan: Record<string, number>;
}

interface User {
  id: string;
  phone: string;
  email: string;
  name: string;
  plan: string;
  created_at: string;
}

interface Business {
  id: string;
  gstin: string;
  legal_name: string;
  trade_name: string;
  state_code: string;
  is_active: boolean;
  business_type: string;
  owner_name: string;
  phone: string;
  plan: string;
  created_at: string;
}

interface Return {
  id: string;
  return_type: string;
  tax_period: string;
  status: string;
  filed_at: string | null;
  arn: string | null;
  created_at: string;
  business_name: string;
  gstin: string;
  phone: string;
  owner_name: string;
}

export default function Admin() {
  const token = getToken();
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [returns, setReturns] = useState<Return[]>([]);
  const [activeTab, setActiveTab] = useState<"dashboard" | "users" | "businesses" | "returns">("dashboard");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({ limit: 20, offset: 0, total: 0 });

  // Dashboard data fetch karo
  const fetchDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/v1/admin/dashboard", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error("Dashboard load nahi ho saka");
      }

      const data = await res.json();
      setDashboardStats(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kuch galat ho gaya");
    } finally {
      setLoading(false);
    }
  };

  // Users fetch karo
  const fetchUsers = async (limit = 20, offset = 0) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/v1/admin/users?limit=${limit}&offset=${offset}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error("Users load nahi ho sake");
      }

      const data = await res.json();
      setUsers(data.data.users);
      setPagination({
        limit: data.data.pagination.limit,
        offset: data.data.pagination.offset,
        total: data.data.pagination.total,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kuch galat ho gaya");
    } finally {
      setLoading(false);
    }
  };

  // Businesses fetch karo
  const fetchBusinesses = async (limit = 20, offset = 0) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/v1/admin/businesses?limit=${limit}&offset=${offset}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error("Businesses load nahi ho sake");
      }

      const data = await res.json();
      setBusinesses(data.data.businesses);
      setPagination({
        limit: data.data.pagination.limit,
        offset: data.data.pagination.offset,
        total: data.data.pagination.total,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kuch galat ho gaya");
    } finally {
      setLoading(false);
    }
  };

  // Returns fetch karo
  const fetchReturns = async (limit = 20, offset = 0, status = "") => {
    try {
      setLoading(true);
      setError(null);
      const statusParam = status ? `&status=${status}` : "";
      const res = await fetch(`/api/v1/admin/returns?limit=${limit}&offset=${offset}${statusParam}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error("Returns load nahi ho sake");
      }

      const data = await res.json();
      setReturns(data.data.returns);
      setPagination({
        limit: data.data.pagination.limit,
        offset: data.data.pagination.offset,
        total: data.data.pagination.total,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kuch galat ho gaya");
    } finally {
      setLoading(false);
    }
  };

  // Tab change hone par data fetch karo
  useEffect(() => {
    if (activeTab === "dashboard") {
      fetchDashboard();
    } else if (activeTab === "users") {
      fetchUsers(20, 0);
    } else if (activeTab === "businesses") {
      fetchBusinesses(20, 0);
    } else if (activeTab === "returns") {
      fetchReturns(20, 0);
    }
  }, [activeTab]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <h1 className="text-4xl font-bold mb-2">Admin Dashboard</h1>
        <p className="text-slate-400">Platform ka poora overview dekho</p>
      </div>

      {/* Error message */}
      {error && (
        <div className="max-w-7xl mx-auto mb-4 p-4 bg-red-900/20 border border-red-700 rounded-lg text-red-300">
          {error}
        </div>
      )}

      {/* Tab navigation */}
      <div className="max-w-7xl mx-auto mb-6 flex gap-2 border-b border-slate-700">
        {["dashboard", "users", "businesses", "returns"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={`px-4 py-3 font-medium capitalize transition-all ${
              activeTab === tab
                ? "border-b-2 border-blue-500 text-blue-400"
                : "text-slate-400 hover:text-slate-300"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto">
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <p className="mt-4 text-slate-400">Load ho raha hai...</p>
          </div>
        ) : activeTab === "dashboard" ? (
          // Dashboard tab
          <div className="space-y-6">
            {dashboardStats && (
              <>
                {/* Overview cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 backdrop-blur-sm">
                    <p className="text-slate-400 text-sm">Total Users</p>
                    <p className="text-3xl font-bold mt-2">{dashboardStats.overview.totalUsers}</p>
                    <p className="text-xs text-green-400 mt-2">
                      +{dashboardStats.overview.recentUsers} last 7 days
                    </p>
                  </div>

                  <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 backdrop-blur-sm">
                    <p className="text-slate-400 text-sm">Total Businesses</p>
                    <p className="text-3xl font-bold mt-2">{dashboardStats.overview.totalBusinesses}</p>
                    <p className="text-xs text-blue-400 mt-2">
                      {dashboardStats.overview.totalActiveBusinesses} active
                    </p>
                  </div>

                  <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 backdrop-blur-sm">
                    <p className="text-slate-400 text-sm">Returns Filed</p>
                    <p className="text-3xl font-bold mt-2">{dashboardStats.returns.filed}</p>
                    <p className="text-xs text-amber-400 mt-2">
                      {dashboardStats.returns.pending} pending
                    </p>
                  </div>

                  <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 backdrop-blur-sm">
                    <p className="text-slate-400 text-sm">Scans Processed</p>
                    <p className="text-3xl font-bold mt-2">{dashboardStats.scans.total}</p>
                    <p className="text-xs text-green-400 mt-2">
                      {dashboardStats.scans.successful} successful, {dashboardStats.scans.failed} failed
                    </p>
                  </div>
                </div>

                {/* Users by plan */}
                <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 backdrop-blur-sm">
                  <h3 className="text-lg font-semibold mb-4">Users by Plan</h3>
                  <div className="space-y-3">
                    {Object.entries(dashboardStats.usersByPlan).map(([plan, count]) => (
                      <div key={plan} className="flex justify-between items-center">
                        <span className="capitalize text-slate-300">{plan}</span>
                        <span className="font-semibold bg-slate-700/50 px-3 py-1 rounded text-sm">
                          {count}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        ) : activeTab === "users" ? (
          // Users tab
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700 text-slate-400">
                    <th className="text-left py-3 px-4">Phone</th>
                    <th className="text-left py-3 px-4">Name</th>
                    <th className="text-left py-3 px-4">Email</th>
                    <th className="text-left py-3 px-4">Plan</th>
                    <th className="text-left py-3 px-4">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b border-slate-700/50 hover:bg-slate-700/20">
                      <td className="py-3 px-4 font-mono text-blue-400">{user.phone}</td>
                      <td className="py-3 px-4">{user.name || "-"}</td>
                      <td className="py-3 px-4 text-slate-400">{user.email || "-"}</td>
                      <td className="py-3 px-4">
                        <span className="bg-slate-700 px-2 py-1 rounded text-xs capitalize">
                          {user.plan}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-400">
                        {new Date(user.created_at).toLocaleDateString("en-IN")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Pagination */}
            <div className="flex justify-between items-center mt-4">
              <span className="text-slate-400 text-sm">
                {pagination.offset + 1} - {Math.min(pagination.offset + pagination.limit, pagination.total)} of{" "}
                {pagination.total}
              </span>
              <div className="space-x-2">
                <button
                  onClick={() => {
                    if (pagination.offset >= pagination.limit) {
                      fetchUsers(pagination.limit, pagination.offset - pagination.limit);
                    }
                  }}
                  disabled={pagination.offset === 0}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded"
                >
                  Previous
                </button>
                <button
                  onClick={() => {
                    if (pagination.offset + pagination.limit < pagination.total) {
                      fetchUsers(pagination.limit, pagination.offset + pagination.limit);
                    }
                  }}
                  disabled={pagination.offset + pagination.limit >= pagination.total}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        ) : activeTab === "businesses" ? (
          // Businesses tab
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700 text-slate-400">
                    <th className="text-left py-3 px-4">GSTIN</th>
                    <th className="text-left py-3 px-4">Business Name</th>
                    <th className="text-left py-3 px-4">Owner</th>
                    <th className="text-left py-3 px-4">Plan</th>
                    <th className="text-left py-3 px-4">State</th>
                    <th className="text-left py-3 px-4">Status</th>
                    <th className="text-left py-3 px-4">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {businesses.map((biz) => (
                    <tr key={biz.id} className="border-b border-slate-700/50 hover:bg-slate-700/20">
                      <td className="py-3 px-4 font-mono text-blue-400">{biz.gstin}</td>
                      <td className="py-3 px-4 font-semibold">{biz.legal_name}</td>
                      <td className="py-3 px-4 text-slate-400">{biz.owner_name}</td>
                      <td className="py-3 px-4 capitalize text-xs">{biz.plan}</td>
                      <td className="py-3 px-4">{biz.state_code}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-xs px-2 py-1 rounded ${
                            biz.is_active
                              ? "bg-green-900/30 text-green-400"
                              : "bg-red-900/30 text-red-400"
                          }`}
                        >
                          {biz.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-400">
                        {new Date(biz.created_at).toLocaleDateString("en-IN")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Pagination */}
            <div className="flex justify-between items-center mt-4">
              <span className="text-slate-400 text-sm">
                {pagination.offset + 1} - {Math.min(pagination.offset + pagination.limit, pagination.total)} of{" "}
                {pagination.total}
              </span>
              <div className="space-x-2">
                <button
                  onClick={() => {
                    if (pagination.offset >= pagination.limit) {
                      fetchBusinesses(pagination.limit, pagination.offset - pagination.limit);
                    }
                  }}
                  disabled={pagination.offset === 0}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded"
                >
                  Previous
                </button>
                <button
                  onClick={() => {
                    if (pagination.offset + pagination.limit < pagination.total) {
                      fetchBusinesses(pagination.limit, pagination.offset + pagination.limit);
                    }
                  }}
                  disabled={pagination.offset + pagination.limit >= pagination.total}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        ) : (
          // Returns tab
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700 text-slate-400">
                    <th className="text-left py-3 px-4">Return Type</th>
                    <th className="text-left py-3 px-4">Tax Period</th>
                    <th className="text-left py-3 px-4">Business</th>
                    <th className="text-left py-3 px-4">Owner</th>
                    <th className="text-left py-3 px-4">Status</th>
                    <th className="text-left py-3 px-4">ARN</th>
                    <th className="text-left py-3 px-4">Filed Date</th>
                  </tr>
                </thead>
                <tbody>
                  {returns.map((ret) => (
                    <tr key={ret.id} className="border-b border-slate-700/50 hover:bg-slate-700/20">
                      <td className="py-3 px-4 font-semibold">{ret.return_type}</td>
                      <td className="py-3 px-4">{ret.tax_period}</td>
                      <td className="py-3 px-4">{ret.business_name}</td>
                      <td className="py-3 px-4 text-slate-400">{ret.owner_name}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-xs px-2 py-1 rounded capitalize ${
                            ret.status === "filed"
                              ? "bg-green-900/30 text-green-400"
                              : ret.status === "draft"
                              ? "bg-yellow-900/30 text-yellow-400"
                              : ret.status === "computed"
                              ? "bg-blue-900/30 text-blue-400"
                              : "bg-red-900/30 text-red-400"
                          }`}
                        >
                          {ret.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-blue-400">{ret.arn || "-"}</td>
                      <td className="py-3 px-4 text-slate-400">
                        {ret.filed_at ? new Date(ret.filed_at).toLocaleDateString("en-IN") : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Pagination */}
            <div className="flex justify-between items-center mt-4">
              <span className="text-slate-400 text-sm">
                {pagination.offset + 1} - {Math.min(pagination.offset + pagination.limit, pagination.total)} of{" "}
                {pagination.total}
              </span>
              <div className="space-x-2">
                <button
                  onClick={() => {
                    if (pagination.offset >= pagination.limit) {
                      fetchReturns(pagination.limit, pagination.offset - pagination.limit);
                    }
                  }}
                  disabled={pagination.offset === 0}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded"
                >
                  Previous
                </button>
                <button
                  onClick={() => {
                    if (pagination.offset + pagination.limit < pagination.total) {
                      fetchReturns(pagination.limit, pagination.offset + pagination.limit);
                    }
                  }}
                  disabled={pagination.offset + pagination.limit >= pagination.total}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
