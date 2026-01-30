import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from './ui/alert-dialog';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Archive, Search, Eye, RotateCcw, Mail, Phone, Calendar, Briefcase } from 'lucide-react';
import { Candidate } from '../lib/mock-data';
import { toast } from 'sonner';
import api from '../lib/api';

const API_BASE = import.meta.env.VITE_API_URL ?? 'https://talentrail-1.onrender.com';

interface ArchivedCandidatesProps {
  candidates: Candidate[];
  onRestore: (candidateId: string) => void;
}

const DEPARTMENTS = ['All', 'Engineering', 'Design', 'Product', 'Marketing', 'Data Science', 'Operations'];
const STATUSES = ['All', 'Rejected', 'Drop-off', 'Hired'];

export function ArchivedCandidates({ candidates, onRestore }: ArchivedCandidatesProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('All');
  const [roleFilter, setRoleFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [candidateToRestore, setCandidateToRestore] = useState<Candidate | null>(null);
  const [remoteCandidates, setRemoteCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load candidates from backend if not provided via props
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (candidates && candidates.length > 0) return; // use provided list
      setLoading(true);
      setError(null);
      try {
        const res = await api.get('/candidates/');
        const data = res.data as any[];
        if (cancelled) return;
        const normalized: Candidate[] = (data || []).map((c: any) => ({
          id: c.id ?? c._id ?? String(Date.now()),
          name: c.name ?? 'Unknown',
          email: c.email ?? 'candidate@example.com',
          phone: c.phone ?? '+1 234 567 8900',
          avatar: c.avatar ?? '',
          position: c.position ?? (c.role ?? 'Unknown'),
          department: c.department ?? 'Engineering',
          experience: c.experience ?? 'mid',
          location: c.location ?? 'Remote',
          matchScore: typeof c.matchScore === 'number' ? c.matchScore : 0,
          stage: c.stage ?? 'applied',
          appliedDate: c.appliedDate ?? c.created_at ?? new Date().toISOString(),
          skills: Array.isArray(c.skills) ? c.skills : [],
          salary: c.salary ?? '',
          availability: c.availability ?? '',
          resumeUrl: c.resume_url ?? c.resumeUrl ?? '',
          resumeAnalysis: c.resumeAnalysis ?? null,
          notes: Array.isArray(c.notes) ? c.notes : [],
          archiveReason: c.archiveReason ?? '',
          archivedDate: c.archivedDate ?? c.archived_date ?? null,
        }));
        setRemoteCandidates(normalized);
      } catch (err) {
        console.error('Failed to load candidates', err);
        setError('Failed to load archived candidates');
      } finally {
        setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [candidates]);

  // Choose data source: props or remote
  const sourceCandidates = useMemo(() => {
    return (candidates && candidates.length > 0) ? candidates : remoteCandidates;
  }, [candidates, remoteCandidates]);

  // Filter archived candidates (rejected, drop-off, or archived)
  // 'archived' stage includes hired candidates auto-archived after 7 days
  const archivedCandidates = sourceCandidates.filter(c => 
    c.stage === 'rejected' || c.stage === 'drop-off' || c.stage === 'archived'
  );

  // Get unique roles from archived candidates
  const uniqueRoles = Array.from(new Set(archivedCandidates.map(c => c.position))).sort();

  // Apply filters
  const filteredCandidates = archivedCandidates.filter(candidate => {
    const matchesSearch = 
      candidate.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      candidate.position.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (candidate.archiveReason?.toLowerCase().includes(searchQuery.toLowerCase()) || false);
    const matchesDepartment = departmentFilter === 'All' || candidate.department === departmentFilter;
    const matchesRole = roleFilter === 'All' || candidate.position === roleFilter;
    
    // Status filter logic:
    // - 'Rejected': stage === 'rejected'
    // - 'Drop-off': stage === 'drop-off'
    // - 'Hired': stage === 'archived' (auto-archived hired candidates)
    const matchesStatus = 
      statusFilter === 'All' || 
      (statusFilter === 'Rejected' && candidate.stage === 'rejected') ||
      (statusFilter === 'Drop-off' && candidate.stage === 'drop-off') ||
      (statusFilter === 'Hired' && candidate.stage === 'archived');
    
    return matchesSearch && matchesDepartment && matchesRole && matchesStatus;
  });

  const handleViewCandidate = (candidate: Candidate) => {
    setSelectedCandidate(candidate);
    setShowDetailsModal(true);
  };

  const handleRestoreClick = (candidate: Candidate) => {
    setCandidateToRestore(candidate);
    setShowRestoreDialog(true);
  };

  const handleConfirmRestore = () => {
    const restore = async () => {
      if (!candidateToRestore) return;
      try {
        // Move back to applied and clear archive metadata
        await api.put(`/candidates/${candidateToRestore.id}`, {
          stage: 'applied',
          archiveReason: '',
          archivedDate: null,
        });
        // Update local state if using remote source
        setRemoteCandidates(prev => prev.map(c => (
          c.id === candidateToRestore.id ? { ...c, stage: 'applied', archiveReason: '', archivedDate: undefined } : c
        )));
        onRestore(candidateToRestore.id);
        toast.success(`${candidateToRestore.name} has been restored to the pipeline`);
      } catch (err) {
        console.error('Restore candidate failed', err);
        toast.error('Failed to restore candidate');
      } finally {
        setShowRestoreDialog(false);
        setCandidateToRestore(null);
      }
    };
    restore();
  };

  const getStatusBadge = (stage: string) => {
    if (stage === 'rejected') {
      return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Rejected</Badge>;
    }
    if (stage === 'archived') {
      return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Hired</Badge>;
    }
    return <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">Drop-off</Badge>;
  };

  const getMatchScoreColor = (score: number) => {
    if (score >= 85) return 'text-green-600';
    if (score >= 70) return 'text-blue-600';
    return 'text-orange-600';
  };

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
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Archived Candidates</h2>
          <p className="text-muted-foreground">View and manage rejected, dropped-off, or hired candidates (auto-archived after 7 days)</p>
        </div>
        <div className="flex items-center space-x-2">
          <Archive className="w-5 h-5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {filteredCandidates.length} archived candidate{filteredCandidates.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="md:col-span-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search candidates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Department Filter */}
            <div>
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.map((dept) => (
                    <SelectItem key={dept} value={dept}>
                      {dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Role Filter */}
            <div>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Roles</SelectItem>
                  {uniqueRoles.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status Filter */}
            <div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Archived Candidates Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Archive className="w-5 h-5 mr-2" />
            Archived Candidates
          </CardTitle>
          <CardDescription>
            {filteredCandidates.length} candidate{filteredCandidates.length !== 1 ? 's' : ''} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Candidate Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date Archived</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead className="text-center">Match Score</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCandidates.length > 0 ? (
                  filteredCandidates.map((candidate) => (
                    <TableRow key={candidate.id}>
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <Avatar className="w-9 h-9">
                            <AvatarImage
                              src={(() => {
                                if (!candidate.avatar || candidate.avatar.trim() === '') {
                                  return `${API_BASE}/upload-file/default_avatar.svg`;
                                }
                                if (candidate.avatar.startsWith('http://') || candidate.avatar.startsWith('https://')) {
                                  return candidate.avatar;
                                }
                                const path = candidate.avatar.startsWith('/uploads/')
                                  ? candidate.avatar.replace('/uploads/', '/upload-file/')
                                  : candidate.avatar;
                                return `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
                              })()}
                              alt={candidate.name}
                            />
                            <AvatarFallback>
                              {candidate.name.split(' ').map(n => n[0]).join('')}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{candidate.name}</div>
                            <div className="text-xs text-muted-foreground">{candidate.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{candidate.position}</TableCell>
                      <TableCell>{candidate.department}</TableCell>
                      <TableCell>{getStatusBadge(candidate.stage)}</TableCell>
                      <TableCell className="text-sm">
                        {candidate.archivedDate ? new Date(candidate.archivedDate).toLocaleDateString() : 'N/A'}
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <div className="text-sm text-muted-foreground truncate">
                          {candidate.archiveReason || 'No reason provided'}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={`font-medium ${getMatchScoreColor(candidate.matchScore)}`}>
                          {candidate.matchScore}%
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewCandidate(candidate)}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            View
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRestoreClick(candidate)}
                          >
                            <RotateCcw className="w-4 h-4 mr-1" />
                            Restore
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No archived candidates found. Try adjusting your filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Candidate Details Modal */}
      <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Candidate Details</DialogTitle>
            <DialogDescription>
              View complete information about this archived candidate
            </DialogDescription>
          </DialogHeader>
          
          {selectedCandidate && (
            <div className="space-y-6">
              {/* Candidate Header */}
              <div className="flex items-start space-x-4">
                <Avatar className="w-20 h-20">
                  <AvatarImage src={selectedCandidate.avatar} alt={selectedCandidate.name} />
                  <AvatarFallback>
                    {selectedCandidate.name.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold">{selectedCandidate.name}</h3>
                  <p className="text-muted-foreground">{selectedCandidate.position}</p>
                  <div className="flex items-center space-x-3 mt-2">
                    {getStatusBadge(selectedCandidate.stage)}
                    <span className={`font-medium ${getMatchScoreColor(selectedCandidate.matchScore)}`}>
                      {selectedCandidate.matchScore}% Match
                    </span>
                  </div>
                </div>
              </div>

              {/* Archive Information */}
              <Card className="bg-muted/50">
                <CardContent className="pt-6">
                  <div className="space-y-2">
                    <h4 className="font-medium">Archive Information</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Date Archived:</span>
                        <p>{selectedCandidate.archivedDate ? new Date(selectedCandidate.archivedDate).toLocaleDateString() : 'N/A'}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Status:</span>
                        <p>{selectedCandidate.stage === 'rejected' ? 'Rejected' : 'Drop-off'}</p>
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-sm">Reason:</span>
                      <p className="mt-1">{selectedCandidate.archiveReason || 'No reason provided'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Contact Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <h4 className="font-medium">Contact Information</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center space-x-2">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      <span>{selectedCandidate.email}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <span>{selectedCandidate.phone}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-medium">Job Details</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center space-x-2">
                      <Briefcase className="w-4 h-4 text-muted-foreground" />
                      <span>{selectedCandidate.department}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span>Applied: {new Date(selectedCandidate.appliedDate).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Skills */}
              <div className="space-y-3">
                <h4 className="font-medium">Skills</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedCandidate.skills.map((skill, index) => (
                    <Badge key={index} variant="secondary">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Notes & Feedback */}
              <div className="space-y-3">
                <h4 className="font-medium">Notes & Feedback</h4>
                <ScrollArea className="h-64 rounded-md border">
                  <div className="p-4 space-y-4">
                    {selectedCandidate.notes.length > 0 ? (
                      selectedCandidate.notes.map((note) => (
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
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        No notes available for this candidate.
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-2 pt-4 border-t">
                <Button variant="outline" onClick={() => setShowDetailsModal(false)}>
                  Close
                </Button>
                <Button onClick={() => {
                  setShowDetailsModal(false);
                  handleRestoreClick(selectedCandidate);
                }}>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Restore Candidate
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Restore Confirmation Dialog */}
      <AlertDialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore Candidate</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to restore "{candidateToRestore?.name}"? This will move them back to the "Applied" stage in the recruitment pipeline.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmRestore}>
              Restore Candidate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
