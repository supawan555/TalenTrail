import { useAuth } from '../context/AuthContext';

import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Mail, Phone, Calendar, Search } from 'lucide-react';
import { pipelineStages, Candidate } from '../lib/mock-data';

import api from '../lib/api';

interface PipelineProps {
  onCandidateSelect: (candidate: Candidate) => void;
  candidates?: Candidate[];
}

export function Pipeline({ onCandidateSelect, candidates: propCandidates }: PipelineProps) {
    const { user, loading } = useAuth();

  if (loading) return null;

  if (!user || !['hr-recruiter','ADMIN'].includes(user.role)) {
    return null; 
  }

  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [allCandidates, setAllCandidates] = useState<Candidate[]>(propCandidates || []);

  // Load candidates from backend when not provided via props
  useEffect(() => {
    if (propCandidates && propCandidates.length > 0) {
      setAllCandidates(propCandidates);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const res = await api.get('/candidates/');
        const data = res.data;
        if (cancelled) return;
        // Normalize backend payload to Candidate type
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
          notes: Array.isArray(c.notes) ? c.notes : []
        }));
        setAllCandidates(normalized);
      } catch (err) {
        console.error('Failed to load candidates', err);
        setAllCandidates([]);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [propCandidates]);
  
  // Filter out archived candidates (rejected, drop-off, and archived)
  // This includes hired candidates that have been auto-archived after 7 days
  const activeCandidates = allCandidates.filter(c => 
    c.stage !== 'rejected' && c.stage !== 'drop-off' && c.stage !== 'archived'
  );

  // Filter candidates based on search and department
  const filteredCandidates = useMemo(() => {
    return activeCandidates.filter(candidate => {
      const matchesSearch = searchQuery === '' || 
        candidate.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        candidate.position.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesDepartment = departmentFilter === 'all' || 
        candidate.department === departmentFilter;
      
      return matchesSearch && matchesDepartment;
    });
  }, [activeCandidates, searchQuery, departmentFilter]);

  // Create filtered pipeline stages
  const filteredStages = useMemo(() => {
    return pipelineStages.map(stage => {
      let stageCandidates = filteredCandidates.filter(c => c.stage === stage.id);
      
      // For 'hired' stage, also include archived candidates with status='hired'
      // to show total hired count (both active and auto-archived)
      if (stage.id === 'hired') {
        const archivedHired = allCandidates.filter(c => 
          c.stage === 'archived' && 
          (c as any).status === 'hired' &&
          // Apply same search and department filters
          (searchQuery === '' || 
            c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.position.toLowerCase().includes(searchQuery.toLowerCase())) &&
          (departmentFilter === 'all' || c.department === departmentFilter)
        );
        stageCandidates = [...stageCandidates, ...archivedHired];
      }
      
      return {
        ...stage,
        candidates: stageCandidates
      };
    });
  }, [filteredCandidates, allCandidates, searchQuery, departmentFilter]);

  const CandidateCard = ({ candidate }: { candidate: Candidate }) => (
    <Card className="mb-3 cursor-pointer hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="mb-3">
          <div className="min-w-0">
            <Link
              to={`/candidate/${candidate.id}`}
              onClick={() => onCandidateSelect(candidate)}
              className="font-medium text-sm hover:underline truncate block"
              title={candidate.name}
            >
              {candidate.name}
            </Link>
            <p className="text-xs text-muted-foreground truncate" title={candidate.position}>
              {candidate.position}
            </p>
          </div>
        </div>
        
        <div className="space-y-2 mb-3">
          <div className="flex items-center text-xs text-muted-foreground min-w-0">
            <Mail className="w-3 h-3 mr-1 shrink-0" />
            <span className="truncate" title={candidate.email}>{candidate.email}</span>
          </div>
          <div className="flex items-center text-xs text-muted-foreground min-w-0">
            <Phone className="w-3 h-3 mr-1 shrink-0" />
            <span className="truncate" title={candidate.phone}>{candidate.phone}</span>
          </div>
          <div className="flex items-center text-xs text-muted-foreground">
            <Calendar className="w-3 h-3 mr-1" />
            Applied {new Date(candidate.appliedDate).toLocaleDateString()}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs">Match Score</span>
            <Badge variant="secondary" className="text-xs">{candidate.matchScore}%</Badge>
          </div>
          <Progress value={candidate.matchScore} className="h-1" />
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold mb-2">Recruitment Pipeline</h2>
        <p className="text-muted-foreground">Track candidates through the hiring process</p>
      </div>

      {/* Search and Filter Controls */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            type="text"
            placeholder="Search by name or position..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Filter by department" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            <SelectItem value="Engineering">Engineering</SelectItem>
            <SelectItem value="Design">Design</SelectItem>
            <SelectItem value="Product">Product</SelectItem>
            <SelectItem value="Marketing">Marketing</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {filteredStages.map((stage) => (
          <div key={stage.id} className="min-h-[600px]">
            <Card className={`${stage.color} border-2 border-dashed h-full`}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center justify-between">
                  {stage.name}
                  <Badge variant="secondary" className="ml-2">
                    {stage.candidates.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  {stage.candidates.map((candidate) => (
                    <CandidateCard key={candidate.id} candidate={candidate} />
                  ))}
                </div>
                {stage.candidates.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <p className="text-sm">No candidates in this stage</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}