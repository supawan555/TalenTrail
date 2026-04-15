import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCandidates } from '../hooks/useCandidates';
import { CandidatesUI } from '../components/new-compo/Candidates';

interface CandidatesProps {
  onCandidateSelect: (candidate: any) => void;
}

export function Candidates({ onCandidateSelect }: CandidatesProps) {
  const { user } = useAuth();
  const {
    candidates,
    loading,
    searchQuery,
    setSearchQuery,
    stageFilter,
    setStageFilter,
    sortBy,
    setSortBy,
    addCandidate,
    getStageColor,
  } = useCandidates();

  const [showAddModal, setShowAddModal] = useState(false);

  return (
    <CandidatesUI
      canAddCandidate={user?.role === 'hr-recruiter' || user?.role === 'ADMIN'}
      loading={loading}
      candidates={candidates}
      searchQuery={searchQuery}
      stageFilter={stageFilter}
      sortBy={sortBy}
      showAddModal={showAddModal}
      onOpenAddModal={() => setShowAddModal(true)}
      onCloseAddModal={() => setShowAddModal(false)}
      onSearchChange={setSearchQuery}
      onStageFilterChange={setStageFilter}
      onSortByChange={setSortBy}
      onCandidateSelect={onCandidateSelect}
      onAddCandidate={addCandidate}
      getStageColor={getStageColor}
    />
  );
}
