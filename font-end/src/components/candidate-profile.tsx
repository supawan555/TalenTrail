import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Progress } from './ui/progress';
import { ScrollArea } from './ui/scroll-area';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
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
const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ImageWithFallback } from './figma/ImageWithFallback';
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
  // Local copy of candidate that is refreshed from backend
  const [liveCandidate, setLiveCandidate] = useState<Candidate>(candidate);
  const navigate = useNavigate();

  // Normalize resume URL (support relative paths from backend like /uploads/...)
  const resolvedResumeUrl = useMemo(() => {
    const url = (liveCandidate as any)?.resumeUrl as string | undefined;
    if (!url) return undefined;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `${API_BASE}${url.startsWith('/') ? '' : '/'}${url}`;
  }, [liveCandidate]);

  // Normalize avatar URL and provide fallback placeholder
  const resolvedAvatarUrl = useMemo(() => {
    const url = (liveCandidate as any)?.avatar as string | undefined;
    if (!url || url.trim() === '') {
      return `${API_BASE}/upload-file/default_avatar.svg`;
    }
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    // For backend-provided /uploads/... rewrite to /upload-file/... for prefix fallback & placeholder support
    if (url.startsWith('/uploads/')) {
      return `${API_BASE}${url.replace('/uploads/', '/upload-file/')}`;
    }
    // If somehow a /upload-file/ path already
    if (url.startsWith('/upload-file/')) {
      return `${API_BASE}${url}`;
    }
    return `${API_BASE}/${url}`;
  }, [liveCandidate]);

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
        const res = await fetch(`${API_BASE}/candidates/${candidate.id}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const fresh: Candidate = await res.json();
        if (isMounted) setLiveCandidate(fresh);
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
      const res = await fetch(`${API_BASE}/candidates/${liveCandidate.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedCandidate),
      });
      if (!res.ok) throw new Error(`Update failed (${res.status})`);
      const saved: Candidate = await res.json();
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
      const res = await fetch(`${API_BASE}/candidates/${liveCandidate.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`Delete failed (${res.status})`);
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
      const res = await fetch(`${API_BASE}/candidates/${liveCandidate.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: next }),
      });
      if (!res.ok) throw new Error(`Stage update failed (${res.status})`);
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
      const res = await fetch(`${API_BASE}/candidates/${liveCandidate.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Archive failed (${res.status})`);
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
  const formatStageName = (stage: string) => {
    return stage === 'final' ? 'Final Round' : stage.charAt(0).toUpperCase() + stage.slice(1);
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Pipeline
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
            <CardHeader className="text-center">
              <Avatar className="w-24 h-24 mx-auto mb-4">
                <AvatarImage src={resolvedAvatarUrl} alt={liveCandidate.name} />
                <AvatarFallback className="text-lg">
                  {liveCandidate.name.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              <CardTitle>{liveCandidate.name}</CardTitle>
              <CardDescription>{liveCandidate.position}</CardDescription>
              <div className="flex items-center justify-center mt-2">
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
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileText className="w-5 h-5 mr-2" />
                Resume Analysis
              </CardTitle>
              <CardDescription>Extracted details from the uploaded resume</CardDescription>
            </CardHeader>
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
                  {liveCandidate.notes.map((note) => {
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
                    
                    return (
                      <div key={note.id} className="border border-border/40 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-sm">{note.author}</span>
                          <div className="flex items-center space-x-2">
                            <Badge 
                              variant="outline" 
                              className={`text-xs ${getTagColor(note.type)}`}
                            >
                              {note.type}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(note.timestamp).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <p className="text-sm">{note.content}</p>
                      </div>
                    );
                  })}
                  {liveCandidate.notes.length === 0 && (
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