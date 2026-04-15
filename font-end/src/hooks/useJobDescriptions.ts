// hooks/useJobDescriptions.ts

import { useState, useEffect, useMemo } from 'react';
import { JobDescription } from '../lib/mock-data';
import { toast } from 'sonner';

const API_BASE = import.meta.env.VITE_API_URL ?? 'https://talentrail-1.onrender.com';

const DEPARTMENTS = ['Engineering', 'Design', 'Product', 'Marketing', 'Sales', 'Operations'];

export const useJobDescriptions = () => {
  const [jobDescriptions, setJobDescriptions] = useState<JobDescription[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedJob, setSelectedJob] = useState<JobDescription | null>(null);
  const [showHidden, setShowHidden] = useState(false);
  const [togglingJobId, setTogglingJobId] = useState<string | null>(null);

  const [formDepartment, setFormDepartment] = useState('');
  const [formRole, setFormRole] = useState('');
  const [formDescription, setFormDescription] = useState('');

  // ===== load =====
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${API_BASE}/job-descriptions/`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        setJobDescriptions(data);
      } catch {
        toast.error('Failed to load job descriptions');
      }
    };
    load();
  }, []);

  // ===== computed =====
  const uniqueRoles = useMemo(
    () => Array.from(new Set(jobDescriptions.map(j => j.role))).sort(),
    [jobDescriptions]
  );

  const filteredJobs = useMemo(() => {
    return jobDescriptions.filter(job => {
      const isHidden = job.isHidden ?? false;

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
  }, [jobDescriptions, searchQuery, departmentFilter, roleFilter, showHidden]);

  // ===== actions =====
  const handleAddJob = async () => {
    if (!formDepartment || !formRole.trim() || !formDescription.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/job-descriptions/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ department: formDepartment, role: formRole, description: formDescription, isHidden: false }),
      });
      const created = await res.json();
      setJobDescriptions(prev => [created, ...prev]);
      resetForm();
      setShowAddDialog(false);
    } catch {
      toast.error('Failed to create job');
    }
  };

  const handleEditJob = async () => {
    if (!selectedJob) return;

    try {
      const res = await fetch(`${API_BASE}/job-descriptions/${selectedJob.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          department: formDepartment,
          role: formRole,
          description: formDescription,
          isHidden: selectedJob.isHidden ?? false,
        }),
      });
      const updated = await res.json();
      setJobDescriptions(prev => prev.map(j => j.id === updated.id ? updated : j));
      resetForm();
      setShowEditDialog(false);
    } catch {
      toast.error('Failed to update job');
    }
  };

  const handleDeleteJob = async () => {
    if (!selectedJob) return;

    try {
      await fetch(`${API_BASE}/job-descriptions/${selectedJob.id}`, { method: 'DELETE' });
      setJobDescriptions(prev => prev.filter(j => j.id !== selectedJob.id));
      setShowDeleteDialog(false);
    } catch {
      toast.error('Failed to delete job');
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

  const handleToggleVisibility = async (job: JobDescription) => {
    const nextHidden = !(job.isHidden ?? false);
    setTogglingJobId(job.id);

    try {
      const res = await fetch(`${API_BASE}/job-descriptions/${job.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...job, isHidden: nextHidden }),
      });
      const updated = await res.json();
      setJobDescriptions(prev => prev.map(j => j.id === updated.id ? updated : j));
    } finally {
      setTogglingJobId(null);
    }
  };

  const resetForm = () => {
    setFormDepartment('');
    setFormRole('');
    setFormDescription('');
    setSelectedJob(null);
  };

  const truncateText = (text: string, maxLength = 100) =>
    text.length <= maxLength ? text : text.slice(0, maxLength) + '...';

  return {
    DEPARTMENTS,

    jobDescriptions,
    searchQuery,
    setSearchQuery,
    departmentFilter,
    setDepartmentFilter,
    roleFilter,
    setRoleFilter,

    showAddDialog,
    setShowAddDialog,
    showEditDialog,
    setShowEditDialog,
    showDeleteDialog,
    setShowDeleteDialog,

    selectedJob,
    showHidden,
    setShowHidden,
    togglingJobId,

    formDepartment,
    setFormDepartment,
    formRole,
    setFormRole,
    formDescription,
    setFormDescription,

    uniqueRoles,
    filteredJobs,

    handleAddJob,
    handleEditJob,
    handleDeleteJob,
    openAddDialog,
    openEditDialog,
    openDeleteDialog,
    handleToggleVisibility,

    truncateText,
  };
};