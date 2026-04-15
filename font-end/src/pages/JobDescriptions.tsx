import { JobDescriptionsUI } from '../components/new-compo/JobDescriptions';
import { useJobDescriptions } from '../hooks/useJobDescriptions';

export default function JobDescriptions() {
  const {
    DEPARTMENTS,
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
  } = useJobDescriptions();

  return (
    <JobDescriptionsUI
      departments={DEPARTMENTS}
      uniqueRoles={uniqueRoles}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      departmentFilter={departmentFilter}
      onDepartmentFilterChange={setDepartmentFilter}
      roleFilter={roleFilter}
      onRoleFilterChange={setRoleFilter}
      filteredJobs={filteredJobs}
      showHidden={showHidden}
      onToggleShowHidden={() => setShowHidden((prev) => !prev)}
      togglingJobId={togglingJobId}
      showAddDialog={showAddDialog}
      onCloseAddDialog={() => setShowAddDialog(false)}
      showEditDialog={showEditDialog}
      onCloseEditDialog={() => setShowEditDialog(false)}
      showDeleteDialog={showDeleteDialog}
      onCloseDeleteDialog={() => setShowDeleteDialog(false)}
      selectedJob={selectedJob}
      formDepartment={formDepartment}
      onFormDepartmentChange={setFormDepartment}
      formRole={formRole}
      onFormRoleChange={setFormRole}
      formDescription={formDescription}
      onFormDescriptionChange={setFormDescription}
      onOpenAddDialog={openAddDialog}
      onOpenEditDialog={openEditDialog}
      onOpenDeleteDialog={openDeleteDialog}
      onConfirmAdd={handleAddJob}
      onConfirmEdit={handleEditJob}
      onConfirmDelete={handleDeleteJob}
      onToggleVisibility={handleToggleVisibility}
      truncateText={truncateText}
    />
  );
}
