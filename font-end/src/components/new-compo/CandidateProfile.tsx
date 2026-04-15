// components/CandidateProfile.ui.tsx

import { Candidate } from '../../lib/mock-data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { ScrollArea } from '../ui/scroll-area';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '../ui/alert-dialog';
import {
  Mail, Phone, Calendar, FileText, Star, MessageSquare,
  ArrowLeft, Download, Edit, Trash2, ArrowRight, XCircle,
} from 'lucide-react';
import { AddCandidateModal } from '../add-candidate-modal';

const getTagColor = (type: string) => {
  switch (type) {
    case 'Awaiting Feedback': return 'bg-yellow-50 text-yellow-700 border-yellow-200';
    case 'Need Approval':     return 'bg-orange-50 text-orange-700 border-orange-200';
    case 'Rejected':          return 'bg-red-50 text-red-700 border-red-200';
    case 'Withdrawn':         return 'bg-gray-50 text-gray-700 border-gray-200';
    case 'Approved':          return 'bg-green-50 text-green-700 border-green-200';
    default:                  return 'bg-blue-50 text-blue-700 border-blue-200';
  }
};

const formatStageName = (stage: string) =>
  stage === 'final' ? 'Final Round' : stage.charAt(0).toUpperCase() + stage.slice(1);

interface CandidateProfileUIProps {
  // Data
  liveCandidate: Candidate;
  notes: any[];
  resolvedResumeUrl: string | undefined;
  nextStage: Candidate['stage'] | null;
  canEditStartDate: boolean;

  // Dialog visibility
  showEditModal: boolean;
  showDeleteDialog: boolean;
  showNextStageDialog: boolean;
  showArchiveDialog: boolean;

  // Archive state
  archiveType: 'reject' | 'drop-off';
  archiveReason: string;
  onArchiveReasonChange: (value: string) => void;

  // Start date
  startDateInput: string;
  onStartDateChange: (value: string) => void;
  isSavingStartDate: boolean;

  // Actions
  onBack: () => void;
  onOpenEditModal: () => void;
  onOpenDeleteDialog: () => void;
  onOpenNextStageDialog: () => void;
  onArchiveSelect: (value: string) => void;

  onCloseEditModal: () => void;
  onCloseDeleteDialog: () => void;
  onCloseNextStageDialog: () => void;
  onCloseArchiveDialog: () => void;

  onConfirmEdit: (updated: Candidate) => void;
  onConfirmDelete: () => void;
  onConfirmNextStage: () => void;
  onConfirmArchive: () => void;

  onSaveStartDate: () => void;

  normalizeNoteType: (value: unknown) => string;
}

export function CandidateProfileUI({
  liveCandidate,
  notes,
  resolvedResumeUrl,
  nextStage,
  canEditStartDate,

  showEditModal,
  showDeleteDialog,
  showNextStageDialog,
  showArchiveDialog,

  archiveType,
  archiveReason,
  onArchiveReasonChange,

  startDateInput,
  onStartDateChange,
  isSavingStartDate,

  onBack,
  onOpenEditModal,
  onOpenDeleteDialog,
  onOpenNextStageDialog,
  onArchiveSelect,

  onCloseEditModal,
  onCloseDeleteDialog,
  onCloseNextStageDialog,
  onCloseArchiveDialog,

  onConfirmEdit,
  onConfirmDelete,
  onConfirmNextStage,
  onConfirmArchive,

  onSaveStartDate,

  normalizeNoteType,
}: CandidateProfileUIProps) {
  return (
    <div className="p-6">

      {/* Top Bar */}
      <div className="mb-6 flex items-center justify-between">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Candidates
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onOpenEditModal}>
            <Edit className="w-4 h-4 mr-2" />
            Edit
          </Button>
          <Button variant="outline" onClick={onOpenDeleteDialog}>
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </Button>
          {liveCandidate.stage !== 'rejected' &&
           liveCandidate.stage !== 'hired' &&
           liveCandidate.stage !== 'drop-off' && (
            <Select onValueChange={onArchiveSelect}>
              <SelectTrigger className="w-[140px] border-red-200 text-red-600 hover:bg-red-50">
                <SelectValue placeholder="Archive" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="reject">Reject</SelectItem>
                <SelectItem value="drop-off">Drop-off</SelectItem>
              </SelectContent>
            </Select>
          )}
          {nextStage && (
            <Button onClick={onOpenNextStageDialog}>
              <ArrowRight className="w-4 h-4 mr-2" />
              Next Stage
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left Column */}
        <div className="lg:col-span-1 space-y-6">

          {/* Basic Info */}
          <Card>
            <CardHeader className="text-center space-y-3">
              <div>
                <CardTitle>{liveCandidate.name}</CardTitle>
                <CardDescription>{liveCandidate.position}</CardDescription>
              </div>
              <div className="flex items-center justify-center">
                <Badge
                  variant={liveCandidate.stage === 'hired' ? 'default' : 'secondary'}
                  className={`capitalize ${
                    liveCandidate.stage === 'hired'      ? 'bg-green-100 text-green-800' :
                    liveCandidate.stage === 'interview'  ? 'bg-purple-100 text-purple-800' :
                    liveCandidate.stage === 'final'      ? 'bg-orange-100 text-orange-800' :
                    liveCandidate.stage === 'screening'  ? 'bg-yellow-100 text-yellow-800' :
                                                           'bg-blue-100 text-blue-800'
                  }`}
                >
                  {liveCandidate.stage}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center text-sm">
                <Mail className="w-4 h-4 mr-3 text-muted-foreground" />
                {liveCandidate.email}
              </div>
              <div className="flex items-center text-sm">
                <Phone className="w-4 h-4 mr-3 text-muted-foreground" />
                {liveCandidate.phone}
              </div>
              <div className="flex items-center text-sm">
                <Calendar className="w-4 h-4 mr-3 text-muted-foreground" />
                Applied {new Date(liveCandidate.appliedDate).toLocaleDateString()}
              </div>
            </CardContent>
          </Card>

          {/* Match Score */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Star className="w-5 h-5 mr-2 text-yellow-500" />
                Match Score
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600 mb-2">
                  {liveCandidate.matchScore}%
                </div>
                <Progress value={liveCandidate.matchScore} className="mb-4" />
                <p className="text-sm text-muted-foreground">Excellent match for this position</p>
              </div>
            </CardContent>
          </Card>

          {/* Time to Join */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Calendar className="w-5 h-5 mr-2" />
                Time to Join
              </CardTitle>
              <CardDescription>
                {canEditStartDate
                  ? 'Record confirmed start date'
                  : 'Unlocks after the candidate is marked as Hired or Archived'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {canEditStartDate ? (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="start-date-input">Available start date</Label>
                    <Input
                      id="start-date-input"
                      type="date"
                      value={startDateInput}
                      onChange={(e) => onStartDateChange(e.target.value)}
                      className="mt-2"
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      onClick={onSaveStartDate}
                      disabled={!startDateInput || isSavingStartDate}
                    >
                      {isSavingStartDate ? 'Saving...' : 'Save Date'}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center space-x-3 rounded-lg border border-dashed border-muted p-4 text-sm text-muted-foreground">
                  <XCircle className="h-5 w-5 text-muted-foreground" />
                  <p>Start date will be available once this candidate is hired or archived.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-2 space-y-6">

          {/* Resume */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center">
                  <FileText className="w-5 h-5 mr-2" />
                  Resume
                </CardTitle>
                <Button variant="outline" size="sm" asChild>
                  <a href={resolvedResumeUrl} target="_blank" rel="noreferrer">
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </a>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {resolvedResumeUrl ? (
                <div className="border border-border/40 rounded-lg overflow-hidden">
                  <iframe
                    src={`${resolvedResumeUrl}#toolbar=1&navpanes=0&scrollbar=1`}
                    title="Resume PDF"
                    className="w-full"
                    style={{ height: '75vh' }}
                  />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No resume uploaded.</p>
              )}
            </CardContent>
          </Card>

          {/* Resume Analysis */}
          <Card>
            <CardContent className="space-y-4">
              {(() => {
                const ra: any = (liveCandidate as any).resumeAnalysis;
                const hasAny =
                  ra && (Array.isArray(ra.skills) ? ra.skills.length > 0 : false) ||
                  ra?.experience_years ||
                  ra?.text_snippet;
                if (!hasAny) {
                  return (
                    <p className="text-sm text-muted-foreground">
                      No analysis available for this candidate.
                    </p>
                  );
                }
                return (
                  <div className="space-y-4">
                    {Array.isArray(ra?.skills) && ra.skills.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2">Detected Skills</h4>
                        <div className="flex flex-wrap gap-2">
                          {ra.skills.map((s: string) => (
                            <Badge key={s} variant="secondary">{s}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {ra?.experience_years && (
                      <div className="text-sm">
                        <span className="font-medium">Experience:</span> {ra.experience_years} years
                      </div>
                    )}
                    {ra?.text_snippet && (
                      <div className="text-sm">
                        <h4 className="font-medium mb-1">Snippet</h4>
                        <p className="text-muted-foreground whitespace-pre-wrap">{ra.text_snippet}</p>
                      </div>
                    )}
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <MessageSquare className="w-5 h-5 mr-2" />
                Notes & Feedback
              </CardTitle>
              <CardDescription>Collaboration notes from the interview process</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                <div className="space-y-4 pr-4">
                  {notes.length > 0 ? notes.map((note, idx) => {
                    const typeLabel = normalizeNoteType(note.type ?? note.tag ?? note.category);
                    const key = note.id ?? note._id ?? `${typeLabel}-${note.timestamp ?? idx}`;
                    const ts = note.timestamp ?? note.created_at ?? note.createdAt;
                    return (
                      <div key={key} className="border border-border/40 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-sm">{note.author ?? 'Anonymous'}</span>
                          <div className="flex items-center space-x-2">
                            <Badge variant="outline" className={`text-xs ${getTagColor(typeLabel)}`}>
                              {typeLabel}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {ts ? new Date(ts).toLocaleDateString() : ''}
                            </span>
                          </div>
                        </div>
                        <p className="text-sm">{note.content ?? note.text ?? ''}</p>
                      </div>
                    );
                  }) : (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No notes available for this candidate.
                    </p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit Modal */}
      <AddCandidateModal
        open={showEditModal}
        onClose={onCloseEditModal}
        onAdd={onConfirmEdit}
        candidate={liveCandidate}
      />

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={onCloseDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Candidate</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {liveCandidate.name}? This action cannot be undone.
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

      {/* Next Stage Dialog */}
      <AlertDialog open={showNextStageDialog} onOpenChange={onCloseNextStageDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move to Next Stage</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to move {liveCandidate.name} from{' '}
              {formatStageName(liveCandidate.stage)} to{' '}
              {nextStage ? formatStageName(nextStage) : ''}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirmNextStage}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Archive Dialog */}
      <AlertDialog open={showArchiveDialog} onOpenChange={onCloseArchiveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {archiveType === 'reject' ? 'Reject Candidate' : 'Mark as Drop-off'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {archiveType === 'reject'
                ? `Are you sure you want to reject ${liveCandidate.name}? This will move them to Archived Candidates.`
                : `Are you sure you want to mark ${liveCandidate.name} as drop-off? This will move them to Archived Candidates.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="archive-reason">Reason *</Label>
            <Textarea
              id="archive-reason"
              placeholder="Please provide a reason for archiving this candidate..."
              value={archiveReason}
              onChange={(e) => onArchiveReasonChange(e.target.value)}
              className="mt-2 min-h-[100px]"
            />
            {archiveReason.trim() === '' && (
              <p className="text-sm text-muted-foreground mt-2">
                A reason is required to archive the candidate.
              </p>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => onArchiveReasonChange('')}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onConfirmArchive}
              disabled={!archiveReason.trim()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
            >
              {archiveType === 'reject' ? 'Reject Candidate' : 'Mark as Drop-off'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}