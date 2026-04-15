import { CandidateProfileUI } from '../components/new-compo/CandidateProfile';
import { useCandidateProfile } from '../hooks/useCandidateProfile';

interface CandidateProfileProps {
  candidate: any;
  onEdit?: (c: any) => void;
  onDelete?: (id: string) => void;
  onNextStage?: (id: string) => void;
  onReject?: (id: string, reason: string) => void;
  onDropOff?: (id: string, reason: string) => void;
}

export function CandidateProfile({
  candidate,
  onEdit,
  onDelete,
  onNextStage,
  onReject,
  onDropOff,
}: CandidateProfileProps) {
  const {
    liveCandidate,
    notes,
    resolvedResumeUrl,
    showEditModal,
    setShowEditModal,
    showDeleteDialog,
    setShowDeleteDialog,
    showNextStageDialog,
    setShowNextStageDialog,
    showArchiveDialog,
    setShowArchiveDialog,
    archiveType,
    archiveReason,
    setArchiveReason,
    startDateInput,
    setStartDateInput,
    isSavingStartDate,
    nextStage,
    canEditStartDate,
    navigate,
    handleEdit,
    handleDelete,
    handleNextStage,
    handleArchive,
    handleSaveStartDate,
    normalizeNoteType,
  } = useCandidateProfile(candidate, {
    onEdit,
    onDelete,
    onNextStage,
    onReject,
    onDropOff,
  });

  return (
    <CandidateProfileUI
      liveCandidate={liveCandidate}
      notes={notes}
      resolvedResumeUrl={resolvedResumeUrl}
      nextStage={nextStage}
      canEditStartDate={canEditStartDate}
      showEditModal={showEditModal}
      showDeleteDialog={showDeleteDialog}
      showNextStageDialog={showNextStageDialog}
      showArchiveDialog={showArchiveDialog}
      archiveType={archiveType}
      archiveReason={archiveReason}
      onArchiveReasonChange={setArchiveReason}
      startDateInput={startDateInput}
      onStartDateChange={setStartDateInput}
      isSavingStartDate={isSavingStartDate}
      onBack={() => navigate('/candidates')}
      onOpenEditModal={() => setShowEditModal(true)}
      onOpenDeleteDialog={() => setShowDeleteDialog(true)}
      onOpenNextStageDialog={() => setShowNextStageDialog(true)}
      onArchiveSelect={handleArchive}
      onCloseEditModal={() => setShowEditModal(false)}
      onCloseDeleteDialog={() => setShowDeleteDialog(false)}
      onCloseNextStageDialog={() => setShowNextStageDialog(false)}
      onCloseArchiveDialog={() => setShowArchiveDialog(false)}
      onConfirmEdit={handleEdit}
      onConfirmDelete={handleDelete}
      onConfirmNextStage={handleNextStage}
      onConfirmArchive={handleArchive}
      onSaveStartDate={handleSaveStartDate}
      normalizeNoteType={normalizeNoteType}
    />
  );
}
