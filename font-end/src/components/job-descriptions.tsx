import { useAuth } from '../context/AuthContext';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from './ui/alert-dialog';
import { Plus, Search, Edit, Trash2, Briefcase } from 'lucide-react';
import { JobDescription } from '../lib/mock-data';
// API base (can be overridden with Vite env VITE_API_URL)
const API_BASE = import.meta.env.VITE_API_URL ?? 'https://talentrail-1.onrender.com';
import { toast } from 'sonner';

const DEPARTMENTS = ['Engineering', 'Design', 'Product', 'Marketing', 'Sales', 'Operations'];

export function JobDescriptions() {
    const { user, loading } = useAuth();

  // Role-based UI Guard (Hiring Manager only)
  if (loading) return null;

  if (!user || !['hiring-manager','ADMIN'].includes(user.role)) {
    return null; 
  }
  const [jobDescriptions, setJobDescriptions] = useState<JobDescription[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedJob, setSelectedJob] = useState<JobDescription | null>(null);
  const [showHidden, setShowHidden] = useState(false);

  
  // Form states
  const [formDepartment, setFormDepartment] = useState('');
  const [formRole, setFormRole] = useState('');
  const [formDescription, setFormDescription] = useState('');

  // Get unique roles from job descriptions
  const uniqueRoles = Array.from(new Set(jobDescriptions.map(jd => jd.role))).sort();

  // Load job descriptions from backend on mount
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${API_BASE}/job-descriptions/`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: JobDescription[] = await res.json();
        setJobDescriptions(data);
      } catch (err) {
        console.error('Failed to load job descriptions', err);
        // keep UI usable with empty list and show toast
        try { toast.error('Failed to load job descriptions from server'); } catch {}
      }
    };
    load();
  }, []);

  // Filter job descriptions
const filteredJobs = jobDescriptions.filter(job => {
  const isHidden = job.isHidden ?? false;

  // แยก Active / Hidden
  if (showHidden) {
    if (!isHidden) return false;
  } else {
    if (isHidden) return false;
  }

  const matchesSearch =
    job.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
    job.description.toLowerCase().includes(searchQuery.toLowerCase());

  const matchesDepartment =
    departmentFilter === 'all' || job.department === departmentFilter;

  const matchesRole =
    roleFilter === 'all' || job.role === roleFilter;

  return matchesSearch && matchesDepartment && matchesRole;
});


  const handleAddJob = async () => {
    if (!formDepartment || !formRole.trim() || !formDescription.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    const payload = {
      department: formDepartment,
      role: formRole,
      description: formDescription,
    };

    try {
      const res = await fetch(`${API_BASE}/job-descriptions/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Failed to create (${res.status})`);
      const created: JobDescription = await res.json();
      setJobDescriptions(prev => [created, ...prev]);
      resetForm();
      setShowAddDialog(false);
      toast.success('Job description created successfully!');
    } catch (err) {
      console.error('Create job failed', err);
      toast.error('Failed to create job description');
    }
  };

  const handleEditJob = async () => {
    if (!selectedJob || !formDepartment || !formRole.trim() || !formDescription.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    const payload = {
      department: formDepartment,
      role: formRole,
      description: formDescription,
    };

    try {
      const res = await fetch(`${API_BASE}/job-descriptions/${selectedJob.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Update failed (${res.status})`);
      const updated: JobDescription = await res.json();
      setJobDescriptions(prev => prev.map(j => j.id === updated.id ? updated : j));
      resetForm();
      setShowEditDialog(false);
      toast.success('Job description updated successfully!');
    } catch (err) {
      console.error('Update job failed', err);
      toast.error('Failed to update job description');
    }
  };

  const handleDeleteJob = async () => {
    if (!selectedJob) return;
    try {
      const res = await fetch(`${API_BASE}/job-descriptions/${selectedJob.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error(`Delete failed (${res.status})`);
      setJobDescriptions(prev => prev.filter(job => job.id !== selectedJob.id));
      setSelectedJob(null);
      setShowDeleteDialog(false);
      toast.success('Job description deleted successfully!');
    } catch (err) {
      console.error('Delete job failed', err);
      toast.error('Failed to delete job description');
    }
  };

  const openAddDialog = () => {
    resetForm();
    setShowAddDialog(true);
  };

  const openEditDialog = (job: JobDescription) => {
    setSelectedJob(job);
    setFormDepartment(job.department);
    setFormRole(job.role);
    setFormDescription(job.description);
    setShowEditDialog(true);
  };

  const openDeleteDialog = (job: JobDescription) => {
    setSelectedJob(job);
    setShowDeleteDialog(true);
  };

  const resetForm = () => {
    setFormDepartment('');
    setFormRole('');
    setFormDescription('');
    setSelectedJob(null);
  };

  const truncateText = (text: string, maxLength: number = 100) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Job Descriptions</h2>
          <p className="text-muted-foreground">Manage job descriptions for open positions</p>
        </div>
        <Button onClick={openAddDialog}>
          <Plus className="w-4 h-4 mr-2" />
          Add Job Description
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div className="md:col-span-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search by role or description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Department Filter */}
            <div>
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by Department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {DEPARTMENTS.map((dept) => (
                    <SelectItem key={dept} value={dept}>
                      {dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Role Filter */}
            <div>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {uniqueRoles.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Job Descriptions Table */}
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

  <Button
    variant="outline"
    size="sm"
    onClick={() => setShowHidden(prev => !prev)}
  >
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
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(job)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setJobDescriptions(prev =>
                                prev.map(j =>
                                  j.id === job.id
                                    ? { ...j, isHidden: !j.isHidden }
                                    : j
                                )
                              );
                            }}
                          >
                            {job.isHidden ? 'Unhide' : 'Hide'}
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openDeleteDialog(job)}
                          >
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

      {/* Add Job Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Job Description</DialogTitle>
            <DialogDescription>
              Create a new job description for an open position
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="add-department">Department</Label>
              <Select value={formDepartment} onValueChange={setFormDepartment}>
                <SelectTrigger id="add-department">
                  <SelectValue placeholder="Select department..." />
                </SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.map((dept) => (
                    <SelectItem key={dept} value={dept}>
                      {dept}
                    </SelectItem>
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
                onChange={(e) => setFormRole(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-description">Description (Skills & Requirements)</Label>
              <Textarea
                id="add-description"
                placeholder="Describe the role, required skills, qualifications, and responsibilities..."
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                className="min-h-[200px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddJob}>Create Job Description</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Job Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Job Description</DialogTitle>
            <DialogDescription>
              Update the job description details
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-department">Department</Label>
              <Select value={formDepartment} onValueChange={setFormDepartment}>
                <SelectTrigger id="edit-department">
                  <SelectValue placeholder="Select department..." />
                </SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.map((dept) => (
                    <SelectItem key={dept} value={dept}>
                      {dept}
                    </SelectItem>
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
                onChange={(e) => setFormRole(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description (Skills & Requirements)</Label>
              <Textarea
                id="edit-description"
                placeholder="Describe the role, required skills, qualifications, and responsibilities..."
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                className="min-h-[200px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditJob}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Job Description</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the job description for "{selectedJob?.role}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteJob}
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
