import { Candidate } from '../lib/mock-data';
import { ArchivedCandidatesUI } from '../components/new-compo/ArchivedCandidates';
import { useArchivedCandidates } from '../hooks/useArchivedCandidates';

export default function ArchivedCandidatesPage({
  candidates,
  onRestore,
}: {
  candidates: Candidate[];
  onRestore: (id: string) => void;
}) {
  const {
    searchQuery,
    setSearchQuery,
    departmentFilter,
    setDepartmentFilter,
    roleFilter,
    setRoleFilter,
    statusFilter,
    setStatusFilter,
    selectedCandidate,
    setSelectedCandidate,
    showDetailsModal,
    setShowDetailsModal,
    showRestoreDialog,
    setShowRestoreDialog,
    candidateToRestore,
    uniqueRoles,
    filteredCandidates,
    handleViewCandidate,
    handleRestoreClick,
    handleConfirmRestore,
  } = useArchivedCandidates(candidates, onRestore);

  return (
    <ArchivedCandidatesUI
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      departmentFilter={departmentFilter}
      onDepartmentChange={setDepartmentFilter}
      roleFilter={roleFilter}
      onRoleChange={setRoleFilter}
      statusFilter={statusFilter}
      onStatusChange={setStatusFilter}
      uniqueRoles={uniqueRoles}
      filteredCandidates={filteredCandidates as Candidate[]}
      selectedCandidate={selectedCandidate as Candidate | null}
      showDetailsModal={showDetailsModal}
      onCloseDetailsModal={() => setShowDetailsModal(false)}
      showRestoreDialog={showRestoreDialog}
      onCloseRestoreDialog={() => setShowRestoreDialog(false)}
      candidateToRestore={candidateToRestore as Candidate | null}
      onConfirmRestore={handleConfirmRestore}
      onViewCandidate={handleViewCandidate}
      onRestoreClick={handleRestoreClick}
    />
  );
}
