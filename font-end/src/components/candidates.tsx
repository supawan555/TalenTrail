import { useAuth } from '../context/AuthContext';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api'; // ✅ 1. Import api มาใช้แทน fetch
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Progress } from './ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import {
  Search,
  Filter,
  SortAsc,
  Mail,
  Phone,
  Calendar,
  Plus,
  Users,
  Star
} from 'lucide-react';
import { AddCandidateModal } from './add-candidate-modal';
import { Candidate } from '../lib/mock-data';
import { toast } from 'sonner'; // เพิ่ม Toast เพื่อแจ้งเตือน

// ใช้สำหรับแสดงรูปภาพ (ยังต้องใช้ URL string อยู่)
const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

interface CandidatesProps {
  onCandidateSelect: (candidate: Candidate) => void;
}

export function Candidates({ onCandidateSelect }: CandidatesProps) {
  const { user, loading: authLoading } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [allCandidates, setAllCandidates] = useState<Candidate[]>([]);
  const [stageFilter, setStageFilter] = useState('all');
  const [sortBy, setSortBy] = useState('recent');
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(true);

  // Filter out archived candidates (rejected and drop-off)
  const activeCandidates = allCandidates.filter(c => c.stage !== 'rejected' && c.stage !== 'drop-off');

  // ✅ 2. ใช้ api.get แทน fetch และ Map ข้อมูลวันที่
  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/candidates');

        // Map ข้อมูลจาก Backend (snake_case) ให้เข้ากับ Frontend (camelCase)
        const mappedData = res.data.map((c: any) => ({
          ...c,
          // Backend ส่ง created_at แต่ Frontend ใช้ appliedDate
          appliedDate: c.created_at || c.appliedDate || new Date().toISOString(),
          // ป้องกัน matchScore เป็น null
          matchScore: c.matchScore || 0
        }));

        setAllCandidates(mappedData);
      } catch (err) {
        console.error('Failed to load candidates', err);
        toast.error('Failed to load candidates');
        setAllCandidates([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // ✅ 3. ใช้ api.post แทน fetch
  const handleAddCandidate = async (newCandidate: Candidate) => {
    try {
      const res = await api.post('/candidates', newCandidate);
      const created = res.data;

      // Map ข้อมูลตัวใหม่ด้วย
      const mappedCreated = {
        ...created,
        appliedDate: created.created_at || new Date().toISOString(),
        matchScore: created.matchScore || 0
      };

      setAllCandidates(prev => [mappedCreated, ...prev]);
      // Toast แจ้งเตือนน่าจะอยู่ใน Modal แล้ว หรือใส่ตรงนี้เพิ่มก็ได้
      // toast.success('Candidate added successfully'); 
    } catch (err) {
      console.error('Add candidate failed', err);
      toast.error('Failed to add candidate');
    }
  };

  const filteredCandidates = activeCandidates.filter(candidate => {
    const matchesSearch = (candidate.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (candidate.position?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (candidate.email?.toLowerCase() || '').includes(searchQuery.toLowerCase());
    const matchesStage = stageFilter === 'all' || candidate.stage === stageFilter;
    return matchesSearch && matchesStage;
  });

  const sortedCandidates = [...filteredCandidates].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return (a.name || '').localeCompare(b.name || '');
      case 'match':
        return (b.matchScore || 0) - (a.matchScore || 0);
      case 'recent':
      default:
        // ตรวจสอบวันที่ก่อน parse
        const dateA = a.appliedDate ? new Date(a.appliedDate).getTime() : 0;
        const dateB = b.appliedDate ? new Date(b.appliedDate).getTime() : 0;
        return dateB - dateA;
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
        {user?.role === 'hr-recruiter' && (
          <Button onClick={() => setShowAddModal(true)} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add Candidate
          </Button>
        )}

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

      {/* Loading State */}
      {loading && (
        <div className="text-center py-10">
          <p>Loading candidates...</p>
        </div>
      )}

      {/* Candidates Grid */}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedCandidates.map((candidate) => (
            <Card key={candidate.id} className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader className="pb-3">
                <div className="flex items-center space-x-3">
                  <Avatar className="w-12 h-12">
                    <AvatarImage
                      src={candidate.avatar
                        ? (candidate.avatar.startsWith('http') ? candidate.avatar : `${API_BASE}${candidate.avatar.replace('/uploads/', '/upload-file/')}`)
                        : `${API_BASE}/upload-file/default_avatar.svg`}
                      alt={candidate.name}
                    />
                    <AvatarFallback>{(candidate.name || '?').split(' ').map(n => n[0]).join('')}</AvatarFallback>
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
                    {candidate.phone || 'N/A'}
                  </div>
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Calendar className="w-3 h-3 mr-2" />
                    Applied {candidate.appliedDate ? new Date(candidate.appliedDate).toLocaleDateString() : 'N/A'}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Match Score</span>
                    <div className="flex items-center space-x-1">
                      <Star className="w-3 h-3 text-yellow-500" />
                      <Badge variant="secondary">{candidate.matchScore || 0}%</Badge>
                    </div>
                  </div>
                  <Progress value={candidate.matchScore || 0} className="h-2" />
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
      )}

      {!loading && sortedCandidates.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-4" />
              <h3 className="font-medium">No candidates found</h3>
              <p className="text-sm">Try adding a new candidate or adjusting filters</p>
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