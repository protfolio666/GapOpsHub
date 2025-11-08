import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, Filter, X } from "lucide-react";
import { format } from "date-fns";
import type { User, FormTemplate } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

interface GapWithRelations {
  id: number;
  gapId: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  severity?: string;
  department?: string;
  reporterId?: number;
  assignedToId?: number;
  formTemplateId?: number;
  createdAt?: string;
  updatedAt?: string;
  resolvedAt?: string;
  closedAt?: string;
  tatDeadline?: string;
  reporter?: User;
  assignee?: User;
  template?: FormTemplate;
}

interface ReportFilters {
  dateFrom?: string;
  dateTo?: string;
  templateIds?: number[];
  statuses?: string[];
  departments?: string[];
  userIds?: number[];
  roles?: string[];
  employeeIds?: string[];
  emails?: string[];
}

export default function ReportsPage() {
  const { toast } = useToast();
  const [filters, setFilters] = useState<ReportFilters>({});
  const [selectedTemplateForExport, setSelectedTemplateForExport] = useState<number | undefined>();

  // Fetch all users for filter dropdowns
  const { data: allUsers } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  // Fetch all templates for filter dropdowns
  const { data: templates } = useQuery<FormTemplate[]>({
    queryKey: ["/api/form-templates"],
  });

  // Fetch filtered gaps
  const { data: reportData, isLoading, refetch } = useQuery<{ gaps: GapWithRelations[]; total: number }>({
    queryKey: ["/api/reports/gaps", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      
      if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.append('dateTo', filters.dateTo);
      if (filters.templateIds?.length) params.append('templateIds', filters.templateIds.join(','));
      if (filters.statuses?.length) params.append('statuses', filters.statuses.join(','));
      if (filters.departments?.length) params.append('departments', filters.departments.join(','));
      if (filters.userIds?.length) params.append('userIds', filters.userIds.join(','));
      if (filters.roles?.length) params.append('roles', filters.roles.join(','));
      if (filters.employeeIds?.length) params.append('employeeIds', filters.employeeIds.join(','));
      if (filters.emails?.length) params.append('emails', filters.emails.join(','));

      const response = await fetch(`/api/reports/gaps?${params.toString()}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch reports');
      }

      return response.json();
    },
    enabled: false, // Only fetch when user clicks "Apply Filters"
  });

  const gaps = reportData?.gaps || [];

  const handleApplyFilters = () => {
    refetch();
  };

  const handleClearFilters = () => {
    setFilters({});
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      
      if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.append('dateTo', filters.dateTo);
      if (filters.templateIds?.length) params.append('templateIds', filters.templateIds.join(','));
      if (filters.statuses?.length) params.append('statuses', filters.statuses.join(','));
      if (filters.departments?.length) params.append('departments', filters.departments.join(','));
      if (filters.userIds?.length) params.append('userIds', filters.userIds.join(','));
      if (filters.roles?.length) params.append('roles', filters.roles.join(','));
      if (filters.employeeIds?.length) params.append('employeeIds', filters.employeeIds.join(','));
      if (filters.emails?.length) params.append('emails', filters.emails.join(','));
      if (selectedTemplateForExport) params.append('templateId', selectedTemplateForExport.toString());

      const response = await fetch(`/api/reports/export?${params.toString()}`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `GapOps_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Export successful",
        description: "Your report has been downloaded",
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        variant: "destructive",
        title: "Export failed",
        description: "Failed to export report. Please try again.",
      });
    }
  };

  const getStatusBadgeVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "Closed": return "default";
      case "Resolved": return "secondary";
      case "InProgress": return "default";
      case "Assigned": return "secondary";
      case "NeedsReview": return "destructive";
      default: return "outline";
    }
  };

  const getPriorityBadgeVariant = (priority: string): "default" | "secondary" | "destructive" => {
    switch (priority) {
      case "High": return "destructive";
      case "Medium": return "default";
      case "Low": return "secondary";
      default: return "secondary";
    }
  };

  return (
    <div className="h-full overflow-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">Reports</h1>
          <p className="text-muted-foreground mt-1">Generate and export gap reports with custom filters</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Date Range */}
            <div className="space-y-2">
              <Label htmlFor="dateFrom">Date From</Label>
              <Input
                id="dateFrom"
                type="date"
                value={filters.dateFrom || ''}
                onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                data-testid="input-date-from"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dateTo">Date To</Label>
              <Input
                id="dateTo"
                type="date"
                value={filters.dateTo || ''}
                onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                data-testid="input-date-to"
              />
            </div>

            {/* Template Filter */}
            <div className="space-y-2">
              <Label htmlFor="template">Template</Label>
              <Select
                value={filters.templateIds?.[0]?.toString() || ''}
                onValueChange={(value) => setFilters({ ...filters, templateIds: value ? [Number(value)] : [] })}
              >
                <SelectTrigger id="template" data-testid="select-template">
                  <SelectValue placeholder="All Templates" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Templates</SelectItem>
                  {templates?.map((t) => (
                    <SelectItem key={t.id} value={t.id.toString()}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status Filter */}
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={filters.statuses?.[0] || ''}
                onValueChange={(value) => setFilters({ ...filters, statuses: value ? [value] : [] })}
              >
                <SelectTrigger id="status" data-testid="select-status">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Statuses</SelectItem>
                  <SelectItem value="PendingAI">Pending AI</SelectItem>
                  <SelectItem value="NeedsReview">Needs Review</SelectItem>
                  <SelectItem value="Assigned">Assigned</SelectItem>
                  <SelectItem value="InProgress">In Progress</SelectItem>
                  <SelectItem value="Resolved">Resolved</SelectItem>
                  <SelectItem value="Closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Department Filter */}
            <div className="space-y-2">
              <Label htmlFor="department">Department</Label>
              <Input
                id="department"
                placeholder="e.g., IT, HR, Finance"
                value={filters.departments?.[0] || ''}
                onChange={(e) => setFilters({ ...filters, departments: e.target.value ? [e.target.value] : [] })}
                data-testid="input-department"
              />
            </div>

            {/* Role Filter */}
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select
                value={filters.roles?.[0] || ''}
                onValueChange={(value) => setFilters({ ...filters, roles: value ? [value] : [] })}
              >
                <SelectTrigger id="role" data-testid="select-role">
                  <SelectValue placeholder="All Roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Roles</SelectItem>
                  <SelectItem value="Admin">Admin</SelectItem>
                  <SelectItem value="Management">Management</SelectItem>
                  <SelectItem value="POC">POC</SelectItem>
                  <SelectItem value="QA/Ops">QA/Ops</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Employee ID Filter */}
            <div className="space-y-2">
              <Label htmlFor="employeeId">Employee ID</Label>
              <Input
                id="employeeId"
                placeholder="e.g., EMP001"
                value={filters.employeeIds?.[0] || ''}
                onChange={(e) => setFilters({ ...filters, employeeIds: e.target.value ? [e.target.value] : [] })}
                data-testid="input-employee-id"
              />
            </div>

            {/* Email Filter */}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                value={filters.emails?.[0] || ''}
                onChange={(e) => setFilters({ ...filters, emails: e.target.value ? [e.target.value] : [] })}
                data-testid="input-email"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleApplyFilters} data-testid="button-apply-filters">
              <Filter className="w-4 h-4 mr-2" />
              Apply Filters
            </Button>
            <Button variant="outline" onClick={handleClearFilters} data-testid="button-clear-filters">
              <X className="w-4 h-4 mr-2" />
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      {reportData && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Report Results</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {reportData.total} gap{reportData.total !== 1 ? 's' : ''} found
                </p>
              </div>
              <div className="flex gap-2 items-center">
                <Select
                  value={selectedTemplateForExport?.toString() || ''}
                  onValueChange={(value) => setSelectedTemplateForExport(value ? Number(value) : undefined)}
                >
                  <SelectTrigger className="w-[200px]" data-testid="select-export-template">
                    <SelectValue placeholder="Export Format" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Standard Export</SelectItem>
                    {templates?.map((t) => (
                      <SelectItem key={t.id} value={t.id.toString()}>
                        {t.name} Format
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={handleExport} disabled={gaps.length === 0} data-testid="button-export">
                  <Download className="w-4 h-4 mr-2" />
                  Export to Excel
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground">Loading...</div>
            ) : gaps.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">No gaps found matching your filters</div>
            ) : (
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Gap ID</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Reporter</TableHead>
                      <TableHead>Assignee</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {gaps.map((gap) => (
                      <TableRow key={gap.id} data-testid={`row-gap-${gap.id}`}>
                        <TableCell className="font-mono text-sm">{gap.gapId}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{gap.title}</TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(gap.status)}>
                            {gap.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getPriorityBadgeVariant(gap.priority)}>
                            {gap.priority}
                          </Badge>
                        </TableCell>
                        <TableCell>{gap.reporter?.name || 'Unknown'}</TableCell>
                        <TableCell>{gap.assignee?.name || 'Unassigned'}</TableCell>
                        <TableCell>{gap.department || 'N/A'}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {gap.createdAt ? format(new Date(gap.createdAt), 'MMM d, yyyy') : 'N/A'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
