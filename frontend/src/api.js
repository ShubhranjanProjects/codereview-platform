const BASE = "/api";

function getToken() {
  return localStorage.getItem("cr_token");
}

async function request(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = data.error || data.errors?.[0]?.msg || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

export const api = {
  // Auth
  login:    (body)       => request("/auth/login",  { method: "POST", body: JSON.stringify(body) }),
  register: (body)       => request("/auth/register", { method: "POST", body: JSON.stringify(body) }),
  me:       ()           => request("/auth/me"),

  // Employees
  getEmployees:   ()     => request("/employees"),
  getEmployee:    (id)   => request(`/employees/${id}`),
  getEmpStats:    (id)   => request(`/employees/${id}/stats`),
  updateEmployee: (id,b) => request(`/employees/${id}`, { method: "PATCH", body: JSON.stringify(b) }),

  // Reviews
  getReviews:  (params = {}) => request("/reviews?" + new URLSearchParams(params)),
  getReview:   (id)          => request(`/reviews/${id}`),
  analyzeCode: (body)        => request("/reviews/analyze", { method: "POST", body: JSON.stringify(body) }),
  deleteReview: (id)         => request(`/reviews/${id}`, { method: "DELETE" }),

  // Analytics
  getDashboard:   () => request("/analytics/dashboard"),
  getLeaderboard: () => request("/analytics/leaderboard"),
};
