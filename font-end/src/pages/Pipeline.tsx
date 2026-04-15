import { useAuth } from '../context/AuthContext';
import { usePipeline } from '../hooks/usePipeline';
import { Candidate } from '../lib/mock-data';
import { PipelineUI } from '../components/new-compo/Pipeline';

interface PipelineProps {
  onCandidateSelect: (candidate: Candidate) => void;
  candidates?: Candidate[];
}

export function Pipeline({ onCandidateSelect, candidates: propCandidates }: PipelineProps) {
  const { user, loading } = useAuth();
  const {
    searchQuery,
    setSearchQuery,
    departmentFilter,
    setDepartmentFilter,
    positionFilter,
    setPositionFilter,
    expandedStage,
    setExpandedStage,
    positionOptions,
    filteredCandidates,
    filteredStages,
    stageDurationData,
  } = usePipeline(propCandidates);

  return (
    <PipelineUI
      user={user}
      loading={loading}
      onCandidateSelect={onCandidateSelect}
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
      departmentFilter={departmentFilter}
      setDepartmentFilter={setDepartmentFilter}
      positionFilter={positionFilter}
      setPositionFilter={setPositionFilter}
      expandedStage={expandedStage}
      setExpandedStage={setExpandedStage}
      positionOptions={positionOptions}
      filteredCandidates={filteredCandidates}
      filteredStages={filteredStages}
      stageDurationData={stageDurationData}
    />
  );
}
