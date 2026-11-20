// frontend/src/pages/Admin.tsx
// Admin dashboard — sabhi users, businesses, returns ka overview

import { useEffect, useState } from "react";
import { getToken } from "../lib/session";
import { BASE_URL } from "../lib/api";

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

// navigate prop add kiya — back button ke liye
export default function Admin({ navigate }: { navigate?: (route: any) => void }) {
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
      const res = await fetch(`${BASE_URL}/admin/dashboard`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error("Dashboard load nahi ho saka");
      }

      const data = await res.json();
      const d=data.data;
      setDashboardStats({overview:{totalUsers:d.users?.total ?? 0,recentUsers:d.users?.recent_7d ?? 0,totalBusinesses:d.businesses?.total ?? 0,totalActiveBusinesses:d.businesses?.active ?? 0,recentBusinesses:d.businesses?.recent_7d ?? 0},returns:d.returns,scans:d.scans,usersByPlan:d.users?.by_plan ?? {}});
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
      const res = await fetch(`${BASE_URL}/admin/users?limit=${limit}&page=${Math.floor(offset/limit)+1}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error("Users load nahi ho sake");
      }

      const data = await res.json();
      setUsers(Array.isArray(data.data) ? data.data : []);
      setPagination({
        limit: data.pagination.limit,
        offset: (data.pagination.page - 1) * data.pagination.limit,
        total: data.pagination.total,
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
      const res = await fetch(`${BASE_URL}/admin/businesses?limit=${limit}&page=${Math.floor(offset/limit)+1}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error("Businesses load nahi ho sake");
      }

      const data = await res.json();
      setBusinesses(Array.isArray(data.data) ? data.data : []);
      setPagination({
        limit: data.pagination.limit,
        offset: (data.pagination.page - 1) * data.pagination.limit,
        total: data.pagination.total,
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
      const res = await fetch(`${BASE_URL}/admin/returns?limit=${limit}&page=${Math.floor(offset/limit)+1}${statusParam}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error("Returns load nahi ho sake");
      }

      const data = await res.json();
      setReturns(Array.isArray(data.data) ? data.data : []);
      setPagination({
        limit: data.pagination.limit,
        offset: (data.pagination.page - 1) * data.pagination.limit,
        total: data.pagination.total,
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
    <div className="utility-page min-h-screen bg-zinc-50 text-zinc-900 p-6">
      {/* Header with back button */}
      <div className="max-w-7xl mx-auto mb-8 flex items-center gap-4">
        {navigate && (
          <button
            onClick={() => navigate("dashboard")}
            className="p-2 rounded-none bg-white hover:bg-zinc-100 border border-zinc-200 transition-colors flex-shrink-0"
            aria-label="Back to dashboard"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5"/>
              <path d="m12 5-7 7 7 7"/>
            </svg>
          </button>
        )}
        <div>
          <h1 className="text-3xl font-semibold mb-1">Admin Dashboard</h1>
          <p className="text-zinc-500">Platform ka poora overview dekho</p>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="max-w-7xl mx-auto mb-4 p-4 bg-zinc-50 border border-red-200 rounded-none text-red-700">
          {error}
        </div>
      )}

      {/* Tab navigation */}
      <div className="max-w-7xl mx-auto mb-6 flex gap-2 border-b border-zinc-200">
        {["dashboard", "users", "businesses", "returns"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={`px-4 py-3 font-medium capitalize transition-all ${
              activeTab === tab
                ? "border-b-2 border-zinc-900 text-zinc-700"
                : "text-zinc-500 hover:text-zinc-700"
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
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-900"></div>
            <p className="mt-4 text-zinc-500">Load ho raha hai...</p>
          </div>
        ) : activeTab === "dashboard" ? (
          // Dashboard tab
          <div className="space-y-6">
            {dashboardStats && (
              <>
                {/* Overview cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="bg-white border border-zinc-200 rounded-none p-4 ">
                    <p className="text-zinc-500 text-sm">Total Users</p>
                    <p className="text-3xl font-semibold mt-2">{dashboardStats.overview.totalUsers}</p>
                    <p className="text-xs text-zinc-700 mt-2">
                      +{dashboardStats.overview.recentUsers} last 7 days
                    </p>
                  </div>

                  <div className="bg-white border border-zinc-200 rounded-none p-4 ">
                    <p className="text-zinc-500 text-sm">Total Businesses</p>
                    <p className="text-3xl font-semibold mt-2">{dashboardStats.overview.totalBusinesses}</p>
                    <p className="text-xs text-zinc-700 mt-2">
                      {dashboardStats.overview.totalActiveBusinesses} active
                    </p>
                  </div>

                  <div className="bg-white border border-zinc-200 rounded-none p-4 ">
                    <p className="text-zinc-500 text-sm">Returns Filed</p>
                    <p className="text-3xl font-semibold mt-2">{dashboardStats.returns.filed}</p>
                    <p className="text-xs text-zinc-700 mt-2">
                      {dashboardStats.returns.pending} pending
                    </p>
                  </div>

                  <div className="bg-white border border-zinc-200 rounded-none p-4 ">
                    <p className="text-zinc-500 text-sm">Scans Processed</p>
                    <p className="text-3xl font-semibold mt-2">{dashboardStats.scans.total}</p>
                    <p className="text-xs text-zinc-700 mt-2">
                      {dashboardStats.scans.successful} successful, {dashboardStats.scans.failed} failed
                    </p>
                  </div>
                </div>

                {/* Users by plan */}
                <div className="bg-white border border-zinc-200 rounded-none p-6 ">
                  <h3 className="text-lg font-semibold mb-4">Users by Plan</h3>
                  <div className="space-y-3">
                    {Object.entries(dashboardStats.usersByPlan).map(([plan, count]) => (
                      <div key={plan} className="flex justify-between items-center">
                        <span className="capitalize text-zinc-700">{plan}</span>
                        <span className="font-semibold bg-zinc-100 px-3 py-1 rounded-none text-sm">
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
                  <tr className="border-b border-zinc-200 text-zinc-500">
                    <th className="text-left py-3 px-4">Phone</th>
                    <th className="text-left py-3 px-4">Name</th>
                    <th className="text-left py-3 px-4">Email</th>
                    <th className="text-left py-3 px-4">Plan</th>
                    <th className="text-left py-3 px-4">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b border-zinc-200 hover:bg-zinc-50">
                      <td className="py-3 px-4 font-mono text-zinc-700">{user.phone}</td>
                      <td className="py-3 px-4">{user.name || "-"}</td>
                      <td className="py-3 px-4 text-zinc-500">{user.email || "-"}</td>
                      <td className="py-3 px-4">
                        <span className="bg-zinc-100 px-2 py-1 rounded-none text-xs capitalize">
                          {user.plan}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-zinc-500">
                        {new Date(user.created_at).toLocaleDateString("en-IN")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Pagination */}
            <div className="flex justify-between items-center mt-4">
              <span className="text-zinc-500 text-sm">
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
                  className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 disabled:opacity-50 rounded"
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
                  className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 disabled:opacity-50 rounded"
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
                  <tr className="border-b border-zinc-200 text-zinc-500">
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
                    <tr key={biz.id} className="border-b border-zinc-200 hover:bg-zinc-50">
                      <td className="py-3 px-4 font-mono text-zinc-700">{biz.gstin}</td>
                      <td className="py-3 px-4 font-semibold">{biz.legal_name}</td>
                      <td className="py-3 px-4 text-zinc-500">{biz.owner_name}</td>
                      <td className="py-3 px-4 capitalize text-xs">{biz.plan}</td>
                      <td className="py-3 px-4">{biz.state_code}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-xs px-2 py-1 rounded ${
                            biz.is_active
                              ? "bg-zinc-50 text-zinc-700"
                              : "bg-zinc-50 text-red-700"
                          }`}
                        >
                          {biz.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-zinc-500">
                        {new Date(biz.created_at).toLocaleDateString("en-IN")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Pagination */}
            <div className="flex justify-between items-center mt-4">
              <span className="text-zinc-500 text-sm">
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
                  className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 disabled:opacity-50 rounded"
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
                  className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 disabled:opacity-50 rounded"
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
                  <tr className="border-b border-zinc-200 text-zinc-500">
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
                    <tr key={ret.id} className="border-b border-zinc-200 hover:bg-zinc-50">
                      <td className="py-3 px-4 font-semibold">{ret.return_type}</td>
                      <td className="py-3 px-4">{ret.tax_period}</td>
                      <td className="py-3 px-4">{ret.business_name}</td>
                      <td className="py-3 px-4 text-zinc-500">{ret.owner_name}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-xs px-2 py-1 rounded capitalize ${
                            ret.status === "filed"
                              ? "bg-zinc-50 text-zinc-700"
                              : ret.status === "draft"
                              ? "bg-yellow-900/30 text-yellow-400"
                              : ret.status === "computed"
                              ? "bg-blue-900/30 text-zinc-700"
                              : "bg-zinc-50 text-red-700"
                          }`}
                        >
                          {ret.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-zinc-700">{ret.arn || "-"}</td>
                      <td className="py-3 px-4 text-zinc-500">
                        {ret.filed_at ? new Date(ret.filed_at).toLocaleDateString("en-IN") : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Pagination */}
            <div className="flex justify-between items-center mt-4">
              <span className="text-zinc-500 text-sm">
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
                  className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 disabled:opacity-50 rounded"
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
                  className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 disabled:opacity-50 rounded"
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
