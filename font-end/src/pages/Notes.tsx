import { useAuth } from '../context/AuthContext';
import { NotesUI } from '../components/new-compo/Notes';
import { useNotes } from '../hooks/useNotes';

interface NoteOut {
  id: string;
  author: string;
  content: string;
  timestamp: string;
  type: string;
  candidate_id: string;
}

type NoteWithCandidate = NoteOut & {
  candidateName?: string;
  candidatePosition?: string;
  candidateAvatar?: string;
};

interface CandidateLite {
  id: string;
  name: string;
  position?: string;
}

export function Notes() {
  const { user } = useAuth();
  const {
    searchQuery,
    setSearchQuery,
    typeFilter,
    setTypeFilter,
    newNote,
    setNewNote,
    selectedCandidate,
    setSelectedCandidate,
    noteTag,
    setNoteTag,
    customTag,
    setCustomTag,
    showCustomInput,
    setShowCustomInput,
    candidateInputValue,
    setCandidateInputValue,
    candidateDropdownOpen,
    setCandidateDropdownOpen,
    notePendingDelete,
    setNotePendingDelete,
    deleteDialogOpen,
    setDeleteDialogOpen,
    deletingNoteId,
    setDeletingNoteId,
    deleteError,
    setDeleteError,
    filteredNotes,
    candidateSuggestions,
    finalTag,
    handleAddNote,
    handleConfirmDelete,
  } = useNotes();

  const handleCandidateInputChange = (value: string) => {
    setCandidateInputValue(value);
    if (selectedCandidate) {
      setSelectedCandidate('');
    }
    setCandidateDropdownOpen(true);
  };

  const handleCandidatePick = (candidate: CandidateLite) => {
    setSelectedCandidate(candidate.id);
    setCandidateInputValue(candidate.name);
    setCandidateDropdownOpen(false);
  };

  const handleTagChange = (value: string) => {
    if (value === 'other') {
      setShowCustomInput(true);
      setNoteTag('');
      return;
    }
    setShowCustomInput(false);
    setNoteTag(value);
    setCustomTag('');
  };

  const handleCustomTagChange = (value: string) => {
    setCustomTag(value);
    setNoteTag(value);
  };

  const canDeleteNote = (note: NoteWithCandidate) => {
    if (!user) return false;
    const normalizedRole = (user.role || '').toLowerCase();
    const isAdmin = normalizedRole === 'admin';
    const normalizedAuthor = (note.author || '').toLowerCase();
    const normalizedEmail = (user.email || '').toLowerCase();
    const isOwner = normalizedAuthor !== '' && normalizedAuthor === normalizedEmail;
    return isAdmin || isOwner;
  };

  const openDeleteDialog = (note: NoteWithCandidate) => {
    setNotePendingDelete(note);
    setDeleteDialogOpen(true);
    setDeleteError(null);
  };

  const handleDeleteDialogChange = (open: boolean) => {
    if (deletingNoteId) return;
    setDeleteDialogOpen(open);
    if (!open) {
      setNotePendingDelete(null);
      setDeleteError(null);
    }
  };

  return (
    <NotesUI
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      typeFilter={typeFilter}
      onTypeFilterChange={setTypeFilter}
      newNote={newNote}
      onNewNoteChange={setNewNote}
      noteTag={noteTag}
      showCustomInput={showCustomInput}
      customTag={customTag}
      onCustomTagChange={handleCustomTagChange}
      onTagChange={handleTagChange}
      finalTag={finalTag}
      candidateInputValue={candidateInputValue}
      onCandidateInputChange={handleCandidateInputChange}
      candidateDropdownOpen={candidateDropdownOpen}
      onCandidateDropdownOpen={() => setCandidateDropdownOpen(true)}
      onCandidateDropdownClose={() => setCandidateDropdownOpen(false)}
      candidateSuggestions={candidateSuggestions as CandidateLite[]}
      selectedCandidate={selectedCandidate}
      onCandidatePick={handleCandidatePick}
      filteredNotes={filteredNotes as any}
      canDeleteNote={canDeleteNote as any}
      onOpenDeleteDialog={openDeleteDialog as any}
      deleteDialogOpen={deleteDialogOpen}
      onDeleteDialogChange={handleDeleteDialogChange}
      deleteError={deleteError}
      deletingNoteId={deletingNoteId}
      onConfirmDelete={handleConfirmDelete}
      onAddNote={handleAddNote}
    />
  );
}
