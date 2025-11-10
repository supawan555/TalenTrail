import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Progress } from './ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { 
  Search, 
  Filter, 
  SortAsc, 
  Mail, 
  Phone, 
  Star,
  Calendar,
  Plus,
  Users
} from 'lucide-react';
import { AddCandidateModal } from './add-candidate-modal';
import { Candidate } from '../lib/mock-data';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

interface CandidatesProps {
  onCandidateSelect: (candidate: Candidate) => void;
}

export function Candidates({ onCandidateSelect }: CandidatesProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [allCandidates, setAllCandidates] = useState<Candidate[]>([]);
  const [stageFilter, setStageFilter] = useState('all');
  const [sortBy, setSortBy] = useState('recent');
  const [showAddModal, setShowAddModal] = useState(false);

  // Filter out archived candidates (rejected and drop-off)
  const activeCandidates = allCandidates.filter(c => c.stage !== 'rejected' && c.stage !== 'drop-off');

  // Load candidates from backend on mount
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${API_BASE}/candidates/`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: Candidate[] = await res.json();
        setAllCandidates(data);
      } catch (err) {
        console.error('Failed to load candidates', err);
        // fallback to empty list
        setAllCandidates([]);
      }
    };
    load();
  }, []);

  const handleAddCandidate = async (newCandidate: Candidate) => {
    try {
      const res = await fetch(`${API_BASE}/candidates/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCandidate),
      });
      if (!res.ok) throw new Error(`Create failed (${res.status})`);
      const created: Candidate = await res.json();
      setAllCandidates(prev => [created, ...prev]);
    } catch (err) {
      console.error('Add candidate failed', err);
      // still call local handler to update UI if desired; for now we just log
    }
  };

  const filteredCandidates = activeCandidates.filter(candidate => {
    const matchesSearch = candidate.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         candidate.position.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         candidate.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStage = stageFilter === 'all' || candidate.stage === stageFilter;
    return matchesSearch && matchesStage;
  });

  const sortedCandidates = [...filteredCandidates].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.name.localeCompare(b.name);
      case 'match':
        return b.matchScore - a.matchScore;
      case 'recent':
      default:
        return new Date(b.appliedDate).getTime() - new Date(a.appliedDate).getTime();
    }
  });

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'hired': return 'bg-green-100 text-green-800';
      case 'interview': return 'bg-purple-100 text-purple-800';
      case 'final': return 'bg-orange-100 text-orange-800';
      case 'screening': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-blue-100 text-blue-800';
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">All Candidates</h2>
          <p className="text-muted-foreground">Manage and track all candidate applications</p>
        </div>
        <Button onClick={() => setShowAddModal(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Add Candidate
        </Button>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
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
            <Select value={stageFilter} onValueChange={setStageFilter}>
              <SelectTrigger className="w-40">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stages</SelectItem>
                <SelectItem value="applied">Applied</SelectItem>
                <SelectItem value="screening">Screening</SelectItem>
                <SelectItem value="interview">Interview</SelectItem>
                <SelectItem value="final">Final Round</SelectItem>
                <SelectItem value="hired">Hired</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-40">
                <SortAsc className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Most Recent</SelectItem>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="match">Match Score</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Candidates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sortedCandidates.map((candidate) => (
          <Card key={candidate.id} className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="pb-3">
              <div className="flex items-center space-x-3">
                <Avatar className="w-12 h-12">
                  <AvatarImage
                    src={candidate.avatar
                      ? `${API_BASE}${candidate.avatar.replace('/uploads/','/upload-file/')}`
                      : `${API_BASE}/upload-file/default_avatar.svg`}
                    alt={candidate.name}
                  />
                  <AvatarFallback>{candidate.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                </Avatar>
                <div>
                  <Link to={`/candidate/${candidate.id}`} onClick={() => onCandidateSelect(candidate)} className="no-underline">
                    <CardTitle className="text-lg hover:underline">{candidate.name}</CardTitle>
                  </Link>
                  <CardDescription>{candidate.position}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center text-sm text-muted-foreground">
                  <Mail className="w-3 h-3 mr-2" />
                  {candidate.email}
                </div>
                <div className="flex items-center text-sm text-muted-foreground">
                  <Phone className="w-3 h-3 mr-2" />
                  {candidate.phone}
                </div>
                <div className="flex items-center text-sm text-muted-foreground">
                  <Calendar className="w-3 h-3 mr-2" />
                  Applied {new Date(candidate.appliedDate).toLocaleDateString()}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Match Score</span>
                  <div className="flex items-center space-x-1">
                    <Star className="w-3 h-3 text-yellow-500" />
                    <Badge variant="secondary">{candidate.matchScore}%</Badge>
                  </div>
                </div>
                <Progress value={candidate.matchScore} className="h-2" />
              </div>

              <div className="flex items-center justify-between">
                <Badge className={`capitalize ${getStageColor(candidate.stage)}`}>
                  {candidate.stage}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {sortedCandidates.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-4" />
              <h3 className="font-medium">No candidates found</h3>
              <p className="text-sm">Try adjusting your search criteria or filters</p>
            </div>
          </CardContent>
        </Card>
      )}

      <AddCandidateModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddCandidate}
      />
    </div>
  );
}