// components/JobDescriptions.ui.tsx

import { JobDescription } from '../../lib/mock-data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { Plus, Search, Edit, Trash2, Briefcase } from 'lucide-react';

interface JobDescriptionsUIProps {
  // Constants
  departments: string[];
  uniqueRoles: string[];

  // Filters
  searchQuery: string;
  onSearchChange: (value: string) => void;
  departmentFilter: string;
  onDepartmentFilterChange: (value: string) => void;
  roleFilter: string;
  onRoleFilterChange: (value: string) => void;

  // Table
  filteredJobs: JobDescription[];
  showHidden: boolean;
  onToggleShowHidden: () => void;
  togglingJobId: string | null;

  // Dialogs visibility
  showAddDialog: boolean;
  onCloseAddDialog: () => void;
  showEditDialog: boolean;
  onCloseEditDialog: () => void;
  showDeleteDialog: boolean;
  onCloseDeleteDialog: () => void;

  // Selected job
  selectedJob: JobDescription | null;

  // Form state
  formDepartment: string;
  onFormDepartmentChange: (value: string) => void;
  formRole: string;
  onFormRoleChange: (value: string) => void;
  formDescription: string;
  onFormDescriptionChange: (value: string) => void;

  // Actions
  onOpenAddDialog: () => void;
  onOpenEditDialog: (job: JobDescription) => void;
  onOpenDeleteDialog: (job: JobDescription) => void;
  onConfirmAdd: () => void;
  onConfirmEdit: () => void;
  onConfirmDelete: () => void;
  onToggleVisibility: (job: JobDescription) => void;

  // Helpers
  truncateText: (text: string, maxLength?: number) => string;
}

export function JobDescriptionsUI({
  departments,
  uniqueRoles,
  searchQuery,
  onSearchChange,
  departmentFilter,
  onDepartmentFilterChange,
  roleFilter,
  onRoleFilterChange,
  filteredJobs,
  showHidden,
  onToggleShowHidden,
  togglingJobId,
  showAddDialog,
  onCloseAddDialog,
  showEditDialog,
  onCloseEditDialog,
  showDeleteDialog,
  onCloseDeleteDialog,
  selectedJob,
  formDepartment,
  onFormDepartmentChange,
  formRole,
  onFormRoleChange,
  formDescription,
  onFormDescriptionChange,
  onOpenAddDialog,
  onOpenEditDialog,
  onOpenDeleteDialog,
  onConfirmAdd,
  onConfirmEdit,
  onConfirmDelete,
  onToggleVisibility,
  truncateText,
}: JobDescriptionsUIProps) {
  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Job Descriptions</h2>
          <p className="text-muted-foreground">Manage job descriptions for open positions</p>
        </div>
        <Button onClick={onOpenAddDialog}>
          <Plus className="w-4 h-4 mr-2" />
          Add Job Description
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search by role or description..."
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <Select value={departmentFilter} onValueChange={onDepartmentFilterChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by Department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Select value={roleFilter} onValueChange={onRoleFilterChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {uniqueRoles.map((role) => (
                    <SelectItem key={role} value={role}>{role}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center">
              <Briefcase className="w-5 h-5 mr-2" />
              {showHidden ? 'Hidden Job Listings' : 'Job Listings'}
            </CardTitle>
            <CardDescription>
              {filteredJobs.length} job description{filteredJobs.length !== 1 ? 's' : ''} found
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={onToggleShowHidden}>
            {showHidden ? 'View Active Jobs' : 'View Hidden Jobs'}
          </Button>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[150px]">Department</TableHead>
                  <TableHead className="w-[200px]">Role</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-[100px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredJobs.length > 0 ? (
                  filteredJobs.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell className="font-medium">{job.department}</TableCell>
                      <TableCell>{job.role}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {truncateText(job.description, 120)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <Button variant="ghost" size="sm" onClick={() => onOpenEditDialog(job)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={togglingJobId === job.id}
                            onClick={() => onToggleVisibility(job)}
                          >
                            {togglingJobId === job.id
                              ? 'Saving...'
                              : job.isHidden ? 'Unhide' : 'Hide'}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => onOpenDeleteDialog(job)}>
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      No job descriptions found. Try adjusting your filters or add a new one.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add Dialog */}
      <Dialog open={showAddDialog} onOpenChange={onCloseAddDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Job Description</DialogTitle>
            <DialogDescription>Create a new job description for an open position</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="add-department">Department</Label>
              <Select value={formDepartment} onValueChange={onFormDepartmentChange}>
                <SelectTrigger id="add-department">
                  <SelectValue placeholder="Select department..." />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-role">Role</Label>
              <Input
                id="add-role"
                placeholder="e.g., Senior Frontend Developer"
                value={formRole}
                onChange={(e) => onFormRoleChange(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-description">Description (Skills & Requirements)</Label>
              <Textarea
                id="add-description"
                placeholder="Describe the role, required skills, qualifications, and responsibilities..."
                value={formDescription}
                onChange={(e) => onFormDescriptionChange(e.target.value)}
                className="min-h-[200px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onCloseAddDialog}>Cancel</Button>
            <Button onClick={onConfirmAdd}>Create Job Description</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={onCloseEditDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden break-words">
          <DialogHeader>
            <DialogTitle>Edit Job Description</DialogTitle>
            <DialogDescription>Update the job description details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-department">Department</Label>
              <Select value={formDepartment} onValueChange={onFormDepartmentChange}>
                <SelectTrigger id="edit-department">
                  <SelectValue placeholder="Select department..." />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-role">Role</Label>
              <Input
                id="edit-role"
                placeholder="e.g., Senior Frontend Developer"
                value={formRole}
                onChange={(e) => onFormRoleChange(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description (Skills & Requirements)</Label>
              <Textarea
                id="edit-description"
                placeholder="Describe the role, required skills, qualifications, and responsibilities..."
                value={formDescription}
                onChange={(e) => onFormDescriptionChange(e.target.value)}
                className="min-h-[200px] max-h-[300px] w-full overflow-y-auto overflow-x-hidden resize-none break-all whitespace-pre-wrap"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onCloseEditDialog}>Cancel</Button>
            <Button onClick={onConfirmEdit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={onCloseDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Job Description</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the job description for "{selectedJob?.role}"?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}