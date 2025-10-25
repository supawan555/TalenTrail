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
import { useState } from 'react';
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

  const handleEdit = (updatedCandidate: Candidate) => {
    onEdit?.(updatedCandidate);
    setShowEditModal(false);
  };

  const handleDelete = () => {
    onDelete?.(candidate.id);
    setShowDeleteDialog(false);
  };

  const handleNextStage = () => {
    onNextStage?.(candidate.id);
    setShowNextStageDialog(false);
  };

  const handleArchiveSelect = (value: string) => {
    if (value === 'reject' || value === 'drop-off') {
      setArchiveType(value);
      setArchiveReason('');
      setShowArchiveDialog(true);
    }
  };

  const handleArchive = () => {
    if (!archiveReason.trim()) {
      return;
    }

    if (archiveType === 'reject') {
      onReject?.(candidate.id, archiveReason);
    } else {
      onDropOff?.(candidate.id, archiveReason);
    }
    
    setShowArchiveDialog(false);
    setArchiveReason('');
  };

  const getNextStage = (): string | null => {
    const stageOrder = ['applied', 'screening', 'interview', 'final', 'hired'];
    const currentIndex = stageOrder.indexOf(candidate.stage);
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
          {candidate.stage !== 'rejected' && candidate.stage !== 'hired' && candidate.stage !== 'drop-off' && (
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
                <AvatarImage src={candidate.avatar} alt={candidate.name} />
                <AvatarFallback className="text-lg">
                  {candidate.name.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              <CardTitle>{candidate.name}</CardTitle>
              <CardDescription>{candidate.position}</CardDescription>
              <div className="flex items-center justify-center mt-2">
                <Badge 
                  variant={candidate.stage === 'hired' ? 'default' : 'secondary'}
                  className={`capitalize ${
                    candidate.stage === 'hired' ? 'bg-green-100 text-green-800' :
                    candidate.stage === 'interview' ? 'bg-purple-100 text-purple-800' :
                    candidate.stage === 'final' ? 'bg-orange-100 text-orange-800' :
                    candidate.stage === 'screening' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-blue-100 text-blue-800'
                  }`}
                >
                  {candidate.stage}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center text-sm">
                <Mail className="w-4 h-4 mr-3 text-muted-foreground" />
                {candidate.email}
              </div>
              <div className="flex items-center text-sm">
                <Phone className="w-4 h-4 mr-3 text-muted-foreground" />
                {candidate.phone}
              </div>
              <div className="flex items-center text-sm">
                <Calendar className="w-4 h-4 mr-3 text-muted-foreground" />
                Applied {new Date(candidate.appliedDate).toLocaleDateString()}
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
                  {candidate.matchScore}%
                </div>
                <Progress value={candidate.matchScore} className="mb-4" />
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
                  Resume Preview
                </CardTitle>
                <Button variant="outline" size="sm">
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="border border-border/40 rounded-lg p-6 bg-muted/20">
                <div className="aspect-[8.5/11] bg-white rounded shadow-sm p-8">
                  <div className="space-y-6">
                    {/* Resume Header */}
                    <div className="text-center border-b pb-4">
                      <h2 className="text-2xl font-bold">{candidate.name}</h2>
                      <p className="text-lg text-muted-foreground">{candidate.position}</p>
                      <div className="flex justify-center items-center space-x-4 mt-2">
                        <span className="text-sm">{candidate.email}</span>
                        <span className="text-sm">{candidate.phone}</span>
                      </div>
                    </div>

                    {/* Experience */}
                    <div>
                      <h3 className="font-semibold mb-3">Professional Experience</h3>
                      <div className="space-y-4">
                        <div>
                          <h4 className="font-medium">Senior Frontend Developer</h4>
                          <p className="text-sm text-muted-foreground">TechCorp Inc. • 2020 - Present</p>
                          <ul className="text-sm mt-2 space-y-1 list-disc list-inside">
                            <li>Led development of React-based web applications</li>
                            <li>Collaborated with design team on UI/UX improvements</li>
                            <li>Mentored junior developers and conducted code reviews</li>
                          </ul>
                        </div>
                        <div>
                          <h4 className="font-medium">Frontend Developer</h4>
                          <p className="text-sm text-muted-foreground">StartupXYZ • 2018 - 2020</p>
                          <ul className="text-sm mt-2 space-y-1 list-disc list-inside">
                            <li>Built responsive web applications using modern frameworks</li>
                            <li>Optimized application performance and accessibility</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
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
                  {candidate.notes.map((note) => {
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
                  {candidate.notes.length === 0 && (
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
        candidate={candidate}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Candidate</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {candidate.name}? This action cannot be undone.
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
              Are you sure you want to move {candidate.name} from {formatStageName(candidate.stage)} to {nextStage ? formatStageName(nextStage) : ''}?
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
                ? `Are you sure you want to reject ${candidate.name}? This will move them to Archived Candidates.`
                : `Are you sure you want to mark ${candidate.name} as drop-off? This will move them to Archived Candidates.`
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