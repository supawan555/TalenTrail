import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { ScrollArea } from './ui/scroll-area';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { 
  Mail, 
  Phone, 
  Calendar, 
  FileText, 
  Star, 
  MessageSquare, 
  ArrowLeft,
  Download,
  Edit,
  Trash2,
  ArrowRight,
  XCircle
} from 'lucide-react';
import { Candidate } from '../lib/mock-data';
const API_BASE = import.meta.env.VITE_API_URL ?? 'https://talentrail-1.onrender.com';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AddCandidateModal } from './add-candidate-modal';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import api from '../lib/api';

interface CandidateProfileProps {
  candidate: Candidate;
  onBack: () => void;
  onEdit?: (candidate: Candidate) => void;
  onDelete?: (candidateId: string) => void;
  onNextStage?: (candidateId: string) => void;
  onReject?: (candidateId: string, reason: string) => void;
  onDropOff?: (candidateId: string, reason: string) => void;
}

export function CandidateProfile({ candidate, onBack, onEdit, onDelete, onNextStage, onReject, onDropOff }: CandidateProfileProps) {
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showNextStageDialog, setShowNextStageDialog] = useState(false);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [archiveType, setArchiveType] = useState<'reject' | 'drop-off'>('reject');
  const [archiveReason, setArchiveReason] = useState('');
  const [startDateInput, setStartDateInput] = useState('');
  const [isSavingStartDate, setIsSavingStartDate] = useState(false);
  // Local copy of candidate that is refreshed from backend
  const [liveCandidate, setLiveCandidate] = useState<Candidate>(candidate);
  const navigate = useNavigate();

  // Ensure notes are always an array for safe rendering
  const notes = useMemo<any[]>(() => {
    const raw = (liveCandidate as any)?.notes;
    return Array.isArray(raw) ? raw : [];
  }, [liveCandidate]);

  // Normalize note type/tag from backend into display label
  const normalizeNoteType = (value: unknown): string => {
    if (!value || typeof value !== 'string') return 'Note';
    const t = value.trim();
    const lower = t.toLowerCase();
    switch (lower) {
      case 'awaiting feedback':
      case 'waiting':
      case 'feedback':
        return 'Awaiting Feedback';
      case 'need approval':
      case 'approval':
      case 'needs approval':
        return 'Need Approval';
      case 'rejected':
        return 'Rejected';
      case 'withdrawn':
      case 'drop-off':
      case 'dropped':
        return 'Withdrawn';
      case 'approved':
      case 'hire-approved':
        return 'Approved';
      default:
        return t.charAt(0).toUpperCase() + t.slice(1);
    }
  };

  // Normalize resume URL (support relative paths from backend like /uploads/...)
  const resolvedResumeUrl = useMemo(() => {
    const url = (liveCandidate as any)?.resumeUrl as string | undefined;
    if (!url) return undefined;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `${API_BASE}${url.startsWith('/') ? '' : '/'}${url}`;
  }, [liveCandidate]);

  // Normalize backend payload to frontend Candidate shape
  const normalizeCandidate = (raw: any): Candidate => {
    const toISO = (value: unknown): string | undefined => {
      if (!value) return undefined;
      try {
        const parsed = value instanceof Date ? value : new Date(value as string);
        if (Number.isNaN(parsed.getTime())) return undefined;
        return parsed.toISOString();
      } catch {
        return undefined;
      }
    };

    const appliedSource = raw?.applied_at ?? raw?.appliedAt ?? raw?.appliedDate ?? raw?.created_at ?? new Date().toISOString();
    const appliedIso = toISO(appliedSource) ?? new Date().toISOString();
    const appliedDate = appliedIso.split('T')[0];
    const stage = (raw?.stage ?? raw?.current_state ?? 'applied') as Candidate['stage'];
    const matchScore = typeof raw?.matchScore === 'number'
      ? raw.matchScore
      : (typeof raw?.resumeAnalysis?.match?.score === 'number' ? Math.round(raw.resumeAnalysis.match.score) : 0);

    const historyRaw = raw?.state_history ?? raw?.stage_history ?? [];
    const stageHistory = Array.isArray(historyRaw)
      ? historyRaw
          .map((entry: any) => ({
            stage: entry?.state ?? entry?.stage ?? '',
            enteredAt: toISO(entry?.entered_at ?? entry?.enteredAt),
            exitedAt: toISO(entry?.exited_at ?? entry?.exitedAt) ?? null,
          }))
          .filter((entry) => entry.stage)
      : [];

    const base: any = {
      id: raw?.id ?? raw?._id ?? (candidate?.id ?? crypto.randomUUID()),
      name: raw?.name ?? '',
      email: raw?.email ?? '',
      phone: raw?.phone ?? '',
      avatar: raw?.avatar ?? undefined,
      position: raw?.position ?? raw?.role ?? '',
      department: raw?.department ?? '',
      experience: raw?.experience ?? '',
      location: raw?.location ?? '',
      matchScore,
      stage,
      appliedDate,
      resumeUrl: raw?.resume_url ?? raw?.resumeUrl ?? undefined,
      archivedDate: raw?.archivedDate ?? raw?.archived_date ?? undefined,
      archiveReason: raw?.archiveReason ?? raw?.archive_reason ?? undefined,
      resumeAnalysis: raw?.resumeAnalysis ?? raw?.resume_analysis ?? null,
      skills: Array.isArray(raw?.skills) ? raw.skills : [],
      notes: Array.isArray(raw?.notes) ? raw.notes : [],
      salary: raw?.salary ?? '',
      availability: raw?.availability ?? '',
      availableStartDate: raw?.availableStartDate ?? raw?.available_start_date ?? '',
      appliedAt: appliedIso,
      screeningAt: toISO(raw?.screening_at ?? raw?.screeningAt),
      interviewAt: toISO(raw?.interview_at ?? raw?.interviewAt),
      finalAt: toISO(raw?.final_at ?? raw?.finalAt),
      hiredAt: toISO(raw?.hired_at ?? raw?.hiredAt),
      rejectedAt: toISO(raw?.rejected_at ?? raw?.rejectedAt),
      droppedAt: toISO(raw?.dropped_at ?? raw?.droppedAt),
      stageHistory,
    };
    if (raw?.resumeAnalysis) {
      base.resumeAnalysis = raw.resumeAnalysis;
    }
    return base as Candidate;
  };

  // Fetch latest candidate details from backend when profile opens
  useEffect(() => {
    // Always start at the top when opening profile
    try {
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    } catch {
      // Fallback for older browsers
      window.scrollTo(0, 0);
    }

    let isMounted = true;
    const fetchCandidate = async () => {
      try {
        const res = await api.get(`/candidates/${candidate.id}`);
        const fresh = normalizeCandidate(res.data);
        if (isMounted) setLiveCandidate(fresh as Candidate);
      } catch (e) {
        // Keep using the provided candidate on failure
        console.warn('Failed to refresh candidate from backend:', e);
      }
    };
    fetchCandidate();
    return () => { isMounted = false; };
  }, [candidate.id]);

  const handleEdit = async (updatedCandidate: Candidate) => {
    try {
      const res = await api.put(`/candidates/${liveCandidate.id}`, updatedCandidate);
      const saved = normalizeCandidate(res.data) as Candidate;
      setLiveCandidate(saved);
      onEdit?.(saved);
    } catch (err) {
      console.error('Update candidate failed', err);
    } finally {
      setShowEditModal(false);
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/candidates/${liveCandidate.id}`);
      onDelete?.(liveCandidate.id);
      // Ensure navigation even if parent doesn't handle it
      navigate('/candidates', { replace: true });
    } catch (err) {
      console.error('Delete candidate failed', err);
    } finally {
      setShowDeleteDialog(false);
    }
  };

  const handleNextStage = async () => {
    const stageOrder = ['applied', 'screening', 'interview', 'final', 'hired'] as const;
    const currentIndex = stageOrder.indexOf(liveCandidate.stage as typeof stageOrder[number]);
    const next = currentIndex >= 0 && currentIndex < stageOrder.length - 1 ? stageOrder[currentIndex + 1] : null;
    if (!next) { setShowNextStageDialog(false); return; }
    try {
      await api.put(`/candidates/${liveCandidate.id}`, { stage: next });
      setLiveCandidate(prev => ({ ...prev, stage: next } as Candidate));
      onNextStage?.(liveCandidate.id);
    } catch (err) {
      console.error('Move to next stage failed', err);
    } finally {
      setShowNextStageDialog(false);
    }
  };

  const handleArchiveSelect = (value: string) => {
    if (value === 'reject' || value === 'drop-off') {
      setArchiveType(value);
      setArchiveReason('');
      setShowArchiveDialog(true);
    }
  };

  const handleArchive = async () => {
    if (!archiveReason.trim()) {
      return;
    }
    const newStage = archiveType === 'reject' ? 'rejected' : 'drop-off';
    try {
      const payload = { stage: newStage, archiveReason, archivedDate: new Date().toISOString().split('T')[0] };
      await api.put(`/candidates/${liveCandidate.id}`, payload);
      setLiveCandidate(prev => ({ ...prev, stage: newStage } as Candidate));
      if (archiveType === 'reject') {
        onReject?.(liveCandidate.id, archiveReason);
      } else {
        onDropOff?.(liveCandidate.id, archiveReason);
      }
    } catch (err) {
      console.error('Archive candidate failed', err);
    } finally {
      setShowArchiveDialog(false);
      setArchiveReason('');
    }
  };

  const getNextStage = (): string | null => {
    const stageOrder = ['applied', 'screening', 'interview', 'final', 'hired'];
    const currentIndex = stageOrder.indexOf(liveCandidate.stage);
    if (currentIndex >= 0 && currentIndex < stageOrder.length - 1) {
      return stageOrder[currentIndex + 1];
    }
    return null;
  };

  const nextStage = getNextStage();
  const canEditStartDate = liveCandidate.stage === 'hired' || liveCandidate.stage === 'archived';
  const formatStageName = (stage: string) => {
    return stage === 'final' ? 'Final Round' : stage.charAt(0).toUpperCase() + stage.slice(1);
  };

  const extractStartDate = () => {
    const raw = liveCandidate.availableStartDate ?? (liveCandidate as any)?.available_start_date;
    if (!raw) return '';
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return '';
    return parsed.toISOString().split('T')[0];
  };

  useEffect(() => {
    setStartDateInput(extractStartDate());
  }, [liveCandidate]);

  const handleSaveStartDate = async () => {
    if (!startDateInput || !canEditStartDate) return;
    setIsSavingStartDate(true);
    try {
      const payload = {
        availableStartDate: startDateInput,
      };
      const res = await api.put(`/candidates/${liveCandidate.id}`, payload);
      const normalized = normalizeCandidate(res.data) as Candidate;
      const ensured = normalized.availableStartDate
        ? normalized
        : ({ ...normalized, availableStartDate: startDateInput } as Candidate);
      setLiveCandidate(ensured);
    } catch (err) {
      console.error('Failed to save start date', err);
    } finally {
      setIsSavingStartDate(false);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate('/candidates')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Candidates
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowEditModal(true)}>
            <Edit className="w-4 h-4 mr-2" />
            Edit
          </Button>
          <Button variant="outline" onClick={() => setShowDeleteDialog(true)}>
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </Button>
          {liveCandidate.stage !== 'rejected' && liveCandidate.stage !== 'hired' && liveCandidate.stage !== 'drop-off' && (
            <Select onValueChange={handleArchiveSelect}>
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
            <Button onClick={() => setShowNextStageDialog(true)}>
              <ArrowRight className="w-4 h-4 mr-2" />
              Next Stage
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Profile Info */}
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
                    liveCandidate.stage === 'hired' ? 'bg-green-100 text-green-800' :
                    liveCandidate.stage === 'interview' ? 'bg-purple-100 text-purple-800' :
                    liveCandidate.stage === 'final' ? 'bg-orange-100 text-orange-800' :
                    liveCandidate.stage === 'screening' ? 'bg-yellow-100 text-yellow-800' :
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
                <p className="text-sm text-muted-foreground">
                  Excellent match for this position
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Time to Join / Available Start Date */}
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
                      onChange={(e) => setStartDateInput(e.target.value)}
                      className="mt-2"
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      onClick={handleSaveStartDate}
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

        {/* Right Column - Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Resume Preview */}
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

          {/* Resume Analysis (from ML) */}
          <Card>
            
            <CardContent className="space-y-4">
              {(() => {
                const ra: any = (liveCandidate as any).resumeAnalysis;
                const hasAny = ra && (Array.isArray(ra.skills) ? ra.skills.length > 0 : false) || ra?.experience_years || ra?.text_snippet;
                if (!hasAny) {
                  return (
                    <p className="text-sm text-muted-foreground">No analysis available for this candidate.</p>
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

          {/* Notes & Collaboration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <MessageSquare className="w-5 h-5 mr-2" />
                Notes & Feedback
              </CardTitle>
              <CardDescription>
                Collaboration notes from the interview process
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                <div className="space-y-4 pr-4">
                  {notes.map((note, idx) => {
                    const typeLabel = normalizeNoteType(note.type ?? note.tag ?? note.category);
                    const getTagColor = (type: string) => {
                      switch (type) {
                        case 'Awaiting Feedback': return 'bg-yellow-50 text-yellow-700 border-yellow-200';
                        case 'Need Approval': return 'bg-orange-50 text-orange-700 border-orange-200';
                        case 'Rejected': return 'bg-red-50 text-red-700 border-red-200';
                        case 'Withdrawn': return 'bg-gray-50 text-gray-700 border-gray-200';
                        case 'Approved': return 'bg-green-50 text-green-700 border-green-200';
                        default: return 'bg-blue-50 text-blue-700 border-blue-200';
                      }
                    };

                    const key = note.id ?? note._id ?? `${typeLabel}-${note.timestamp ?? idx}`;
                    const ts = note.timestamp ?? note.created_at ?? note.createdAt;
                    const content = note.content ?? note.text ?? '';
                    const author = note.author ?? 'Anonymous';

                    return (
                      <div key={key} className="border border-border/40 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-sm">{author}</span>
                          <div className="flex items-center space-x-2">
                            <Badge
                              variant="outline"
                              className={`text-xs ${getTagColor(typeLabel)}`}
                            >
                              {typeLabel}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {ts ? new Date(ts).toLocaleDateString() : ''}
                            </span>
                          </div>
                        </div>
                        <p className="text-sm">{content}</p>
                      </div>
                    );
                  })}
                  {notes.length === 0 && (
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
        onClose={() => setShowEditModal(false)}
        onAdd={handleEdit}
        candidate={liveCandidate}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Candidate</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {liveCandidate.name}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Next Stage Confirmation Dialog */}
      <AlertDialog open={showNextStageDialog} onOpenChange={setShowNextStageDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move to Next Stage</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to move {liveCandidate.name} from {formatStageName(liveCandidate.stage)} to {nextStage ? formatStageName(nextStage) : ''}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleNextStage}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Archive Confirmation Dialog */}
      <AlertDialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {archiveType === 'reject' ? 'Reject Candidate' : 'Mark as Drop-off'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {archiveType === 'reject' 
                ? `Are you sure you want to reject ${liveCandidate.name}? This will move them to Archived Candidates.`
                : `Are you sure you want to mark ${liveCandidate.name} as drop-off? This will move them to Archived Candidates.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="archive-reason">Reason *</Label>
            <Textarea
              id="archive-reason"
              placeholder="Please provide a reason for archiving this candidate..."
              value={archiveReason}
              onChange={(e) => setArchiveReason(e.target.value)}
              className="mt-2 min-h-[100px]"
            />
            {archiveReason.trim() === '' && (
              <p className="text-sm text-muted-foreground mt-2">
                A reason is required to archive the candidate.
              </p>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setArchiveReason('')}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleArchive}
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