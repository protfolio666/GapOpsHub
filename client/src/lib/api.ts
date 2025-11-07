import { apiRequest } from "./queryClient";
import type { User, Gap, Comment, Sop, FormTemplate, FormField } from "@shared/schema";

// ==================== AUTH API ====================

export const authApi = {
  login: async (email: string, password: string) => {
    const response = await apiRequest("POST", "/api/auth/login", { email, password });
    return response as { user: User };
  },

  logout: async () => {
    await apiRequest("POST", "/api/auth/logout");
  },

  getMe: async () => {
    const response = await apiRequest("GET", "/api/auth/me");
    return response as { user: User };
  },
};

// ==================== USER API ====================

export const userApi = {
  getAll: async () => {
    const response = await apiRequest("GET", "/api/users");
    return response as { users: User[] };
  },

  getByRole: async (role: string) => {
    const response = await apiRequest("GET", `/api/users/role/${role}`);
    return response as { users: User[] };
  },
};

// ==================== GAP API ====================

export const gapApi = {
  getAll: async (filters?: { status?: string; reporterId?: number; assignedToId?: number }) => {
    const params = new URLSearchParams();
    if (filters?.status) params.append("status", filters.status);
    if (filters?.reporterId) params.append("reporterId", filters.reporterId.toString());
    if (filters?.assignedToId) params.append("assignedToId", filters.assignedToId.toString());
    
    const url = `/api/gaps${params.toString() ? `?${params.toString()}` : ""}`;
    const response = await apiRequest("GET", url);
    return response as { gaps: Gap[] };
  },

  getById: async (id: number) => {
    const response = await apiRequest("GET", `/api/gaps/${id}`);
    return response as { gap: Gap; reporter: User; assignee: User | null };
  },

  create: async (gap: {
    title: string;
    description: string;
    department?: string;
    priority?: string;
    severity?: string;
    attachments?: string[];
  }) => {
    const response = await apiRequest("POST", "/api/gaps", gap);
    return response as { gap: Gap };
  },

  update: async (id: number, updates: Partial<Gap>) => {
    const response = await apiRequest("PATCH", `/api/gaps/${id}`, updates);
    return response as { gap: Gap };
  },

  assign: async (id: number, data: {
    assignedToId: number;
    tatDeadline?: string;
    notes?: string;
  }) => {
    const response = await apiRequest("POST", `/api/gaps/${id}/assign`, data);
    return response as { gap: Gap };
  },

  resolve: async (id: number, resolutionSummary: string) => {
    const response = await apiRequest("POST", `/api/gaps/${id}/resolve`, { resolutionSummary });
    return response as { gap: Gap };
  },

  reopen: async (id: number) => {
    const response = await apiRequest("POST", `/api/gaps/${id}/reopen`);
    return response as { gap: Gap };
  },

  getSimilar: async (id: number) => {
    const response = await apiRequest("GET", `/api/gaps/${id}/similar`);
    return response as { similarGaps: Array<{ gapId: number; similarGapId: number; similarityScore: number; gap: Gap }> };
  },
};

// ==================== COMMENT API ====================

export const commentApi = {
  getByGap: async (gapId: number) => {
    const response = await apiRequest("GET", `/api/gaps/${gapId}/comments`);
    return response as { comments: Array<Comment & { author: User }> };
  },

  create: async (gapId: number, content: string, attachments?: string[]) => {
    const response = await apiRequest("POST", `/api/gaps/${gapId}/comments`, {
      content,
      attachments: attachments || [],
    });
    return response as { comment: Comment & { author: User } };
  },
};

// ==================== SOP API ====================

export const sopApi = {
  getAll: async (filters?: { department?: string; active?: boolean }) => {
    const params = new URLSearchParams();
    if (filters?.department) params.append("department", filters.department);
    if (filters?.active !== undefined) params.append("active", filters.active.toString());
    
    const url = `/api/sops${params.toString() ? `?${params.toString()}` : ""}`;
    const response = await apiRequest("GET", url);
    return response as { sops: Sop[] };
  },

  getById: async (id: number) => {
    const response = await apiRequest("GET", `/api/sops/${id}`);
    return response as { sop: Sop };
  },

  create: async (sop: {
    title: string;
    description?: string;
    content: string;
    category?: string;
    department?: string;
    version?: string;
  }) => {
    const response = await apiRequest("POST", "/api/sops", sop);
    return response as { sop: Sop };
  },

  update: async (id: number, updates: Partial<Sop>) => {
    const response = await apiRequest("PATCH", `/api/sops/${id}`, updates);
    return response as { sop: Sop };
  },
};

// ==================== FORM TEMPLATE API ====================

export const formTemplateApi = {
  getAll: async (activeOnly = false) => {
    const url = activeOnly ? "/api/form-templates?active=true" : "/api/form-templates";
    const response = await apiRequest("GET", url);
    return response as { templates: FormTemplate[] };
  },

  getById: async (id: number) => {
    const response = await apiRequest("GET", `/api/form-templates/${id}`);
    return response as { template: FormTemplate; fields: FormField[] };
  },

  create: async (data: {
    name: string;
    description?: string;
    department?: string;
    fields: Array<{
      type: string;
      label: string;
      required: boolean;
      options?: string[];
    }>;
  }) => {
    const response = await apiRequest("POST", "/api/form-templates", data);
    return response as { template: FormTemplate; fields: FormField[] };
  },
};

// ==================== TAT EXTENSION API ====================

export const tatExtensionApi = {
  getPending: async () => {
    const response = await apiRequest("GET", "/api/tat-extensions/pending");
    return response as { extensions: Array<any> };
  },

  create: async (gapId: number, data: { reason: string; requestedDeadline: string }) => {
    const response = await apiRequest("POST", `/api/gaps/${gapId}/tat-extensions`, data);
    return response as { extension: any };
  },

  update: async (id: number, status: "Approved" | "Rejected") => {
    const response = await apiRequest("PATCH", `/api/tat-extensions/${id}`, { status });
    return response as { extension: any };
  },
};

// ==================== DASHBOARD API ====================

export const dashboardApi = {
  getMetrics: async () => {
    const response = await apiRequest("GET", "/api/dashboard/metrics");
    return response as { metrics: any };
  },
};
