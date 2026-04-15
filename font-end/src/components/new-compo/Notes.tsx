// components/Notes.ui.tsx

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { ScrollArea } from '../ui/scroll-area';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '../ui/alert-dialog';
import { MessageSquare, Plus, Search, Filter, Calendar, User, Trash2 } from 'lucide-react';

const DEFAULT_TAGS = [
  'Awaiting Feedback',
  'Need Approval',
  'Rejected',
  'Drop-off',
  'Approved',
];

const getTypeColor = (type: string) => {
  switch (type) {
    case 'Awaiting Feedback': return 'bg-yellow-50 text-yellow-700 border-yellow-200';
    case 'Need Approval':     return 'bg-orange-50 text-orange-700 border-orange-200';
    case 'Rejected':          return 'bg-red-50 text-red-700 border-red-200';
    case 'Withdrawn':         return 'bg-gray-50 text-gray-700 border-gray-200';
    case 'Approved':          return 'bg-green-50 text-green-700 border-green-200';
    default:                  return 'bg-blue-50 text-blue-700 border-blue-200';
  }
};

interface CandidateLite {
  id: string;
  name: string;
  position?: string;
}

interface NoteWithCandidate {
  id: string;
  author: string;
  content: string;
  timestamp: string;
  type: string;
  candidate_id: string;
  candidateName?: string;
  candidatePosition?: string;
}

interface NotesUIProps {
  // Filters
  searchQuery: string;
  onSearchChange: (value: string) => void;
  typeFilter: string;
  onTypeFilterChange: (value: string) => void;

  // New note form
  newNote: string;
  onNewNoteChange: (value: string) => void;
  noteTag: string;
  showCustomInput: boolean;
  customTag: string;
  onCustomTagChange: (value: string) => void;
  onTagChange: (value: string) => void;
  finalTag: string;

  // Candidate search
  candidateInputValue: string;
  onCandidateInputChange: (value: string) => void;
  candidateDropdownOpen: boolean;
  onCandidateDropdownOpen: () => void;
  onCandidateDropdownClose: () => void;
  candidateSuggestions: CandidateLite[];
  selectedCandidate: string;
  onCandidatePick: (candidate: CandidateLite) => void;

  // Notes list
  filteredNotes: NoteWithCandidate[];
  canDeleteNote: (note: NoteWithCandidate) => boolean;
  onOpenDeleteDialog: (note: NoteWithCandidate) => void;

  // Delete dialog
  deleteDialogOpen: boolean;
  onDeleteDialogChange: (open: boolean) => void;
  deleteError: string | null;
  deletingNoteId: string | null;
  onConfirmDelete: () => void;

  // Actions
  onAddNote: () => void;
}

export function NotesUI({
  searchQuery,
  onSearchChange,
  typeFilter,
  onTypeFilterChange,
  newNote,
  onNewNoteChange,
  noteTag,
  showCustomInput,
  customTag,
  onCustomTagChange,
  onTagChange,
  finalTag,
  candidateInputValue,
  onCandidateInputChange,
  candidateDropdownOpen,
  onCandidateDropdownOpen,
  onCandidateDropdownClose,
  candidateSuggestions,
  selectedCandidate,
  onCandidatePick,
  filteredNotes,
  canDeleteNote,
  onOpenDeleteDialog,
  deleteDialogOpen,
  onDeleteDialogChange,
  deleteError,
  deletingNoteId,
  onConfirmDelete,
  onAddNote,
}: NotesUIProps) {
  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Collaboration Notes</h2>
          <p className="text-muted-foreground">All notes and feedback from the recruitment process</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Add Note Panel */}
        <div className="lg:col-span-1">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Plus className="w-5 h-5 mr-2" />
                Add New Note
              </CardTitle>
              <CardDescription>Create a new note for a candidate</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">

              {/* Candidate search */}
              <div>
                <label className="text-sm font-medium mb-2 block">Candidate</label>
                <div className="relative">
                  <Input
                    placeholder="Search candidate..."
                    value={candidateInputValue}
                    onChange={(e) => onCandidateInputChange(e.target.value)}
                    onFocus={onCandidateDropdownOpen}
                    onBlur={() => setTimeout(onCandidateDropdownClose, 120)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const [first] = candidateSuggestions;
                        if (first) onCandidatePick(first);
                      }
                      if (e.key === 'Escape') {
                        onCandidateDropdownClose();
                        (e.target as HTMLInputElement).blur();
                      }
                    }}
                    aria-autocomplete="list"
                    aria-expanded={candidateDropdownOpen}
                  />
                  {candidateDropdownOpen && (
                    <div className="absolute z-20 mt-1 w-full rounded-md border border-border/60 bg-popover shadow-lg max-h-64 overflow-y-auto">
                      {candidateSuggestions.length > 0 ? (
                        candidateSuggestions.map((candidate) => (
                          <button
                            type="button"
                            key={candidate.id}
                            className={`w-full px-3 py-2 text-left text-sm hover:bg-muted focus:bg-muted ${selectedCandidate === candidate.id ? 'bg-muted/70' : ''}`}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => onCandidatePick(candidate)}
                          >
                            <div className="flex flex-col">
                              <span className="font-medium">{candidate.name}</span>
                              {candidate.position && (
                                <span className="text-xs text-muted-foreground">{candidate.position}</span>
                              )}
                            </div>
                          </button>
                        ))
                      ) : (
                        <div className="px-3 py-2 text-sm text-muted-foreground">
                          No candidates found.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Tag select */}
              <div>
                <label className="text-sm font-medium mb-2 block">Note Tag</label>
                <Select
                  value={showCustomInput ? 'other' : noteTag}
                  onValueChange={onTagChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a tag..." />
                  </SelectTrigger>
                  <SelectContent>
                    {DEFAULT_TAGS.map((tag) => (
                      <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                    ))}
                    <SelectItem value="other">Other (Custom Tag)</SelectItem>
                  </SelectContent>
                </Select>
                {showCustomInput && (
                  <div className="mt-2">
                    <Input
                      placeholder="Enter custom tag..."
                      value={customTag}
                      onChange={(e) => onCustomTagChange(e.target.value)}
                      maxLength={30}
                    />
                    <p className="text-xs text-muted-foreground mt-1">Max 30 characters</p>
                  </div>
                )}
              </div>

              {/* Note content */}
              <div>
                <label className="text-sm font-medium mb-2 block">Note</label>
                <Textarea
                  placeholder="Write your note here..."
                  value={newNote}
                  onChange={(e) => onNewNoteChange(e.target.value)}
                  className="min-h-[120px]"
                />
              </div>

              <Button
                onClick={onAddNote}
                disabled={!newNote.trim() || !selectedCandidate || !finalTag.trim()}
                className="w-full"
              >
                Add Note
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Notes List */}
        <div className="lg:col-span-2 space-y-4">

          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input
                      placeholder="Search notes..."
                      value={searchQuery}
                      onChange={(e) => onSearchChange(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Select value={typeFilter} onValueChange={onTypeFilterChange}>
                  <SelectTrigger className="w-52">
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Tags</SelectItem>
                    {DEFAULT_TAGS.map((tag) => (
                      <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Notes Feed */}
          <ScrollArea className="h-[600px]">
            <div className="space-y-4">
              {filteredNotes.map((note) => (
                <Card key={note.id} className="hover:shadow-sm transition-shadow">
                  <CardContent className="pt-6">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h4 className="font-medium">{note.candidateName}</h4>
                          <p className="text-sm text-muted-foreground">{note.candidatePosition}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge className={getTypeColor(note.type)}>{note.type}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(note.timestamp).toLocaleDateString()}
                          </span>
                          {canDeleteNote(note) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => onOpenDeleteDialog(note)}
                              aria-label="Delete note"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                      <p className="text-sm leading-relaxed">{note.content}</p>
                      <div className="flex items-center justify-between pt-2 border-t border-border/40">
                        <div className="flex items-center text-xs text-muted-foreground">
                          <User className="w-3 h-3 mr-1" />
                          By {note.author}
                        </div>
                        <div className="flex items-center text-xs text-muted-foreground">
                          <Calendar className="w-3 h-3 mr-1" />
                          {new Date(note.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {filteredNotes.length === 0 && (
                <Card>
                  <CardContent className="py-12 text-center">
                    <div className="text-muted-foreground">
                      <MessageSquare className="w-12 h-12 mx-auto mb-4" />
                      <h3 className="font-medium">No notes found</h3>
                      <p className="text-sm">Try adjusting your search criteria or add a new note</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={onDeleteDialogChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete note?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this note? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <p className="text-sm text-destructive">{deleteError}</p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!deletingNoteId}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onConfirmDelete}
              disabled={!!deletingNoteId}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingNoteId ? 'Deleting...' : 'Delete Note'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}