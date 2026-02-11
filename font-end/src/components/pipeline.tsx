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

import { CandidatePieChart } from './analytics/CandidatePieChart';
import { StageDurationBarChart } from './analytics/StageDurationBarChart';
import { calculateAverageStageDuration } from '../utils/pipelineAnalytics';

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
  const [positionFilter, setPositionFilter] = useState('all');
  const [allCandidates, setAllCandidates] = useState<Candidate[]>(propCandidates || []);

  const toIsoString = (value?: string | null | Date): string | undefined => {
    if (!value) return undefined;
    try {
      const date = value instanceof Date ? value : new Date(value);
      if (Number.isNaN(date.getTime())) {
        return undefined;
      }
      return date.toISOString();
    } catch {
      return undefined;
    }
  };

  const normalizeStageHistory = (history: any): Candidate['stageHistory'] => {
    if (!Array.isArray(history)) {
      return [];
    }
    return history
      .map((entry) => {
        const stage = entry?.stage ?? entry?.state;
        const enteredAt = toIsoString(entry?.entered_at ?? entry?.enteredAt);
        const exited = toIsoString(entry?.exited_at ?? entry?.exitedAt);
        if (!stage || !enteredAt) {
          return null;
        }
        return {
          stage,
          enteredAt,
          exitedAt: exited ?? null
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
  };

  // Load candidates from backend when not provided via props
  useEffect(() => {
    if (Array.isArray(propCandidates)) {
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
        const normalized: Candidate[] = (data || []).map((c: any) => {
          const appliedIso = toIsoString(c.applied_at ?? c.appliedAt ?? c.appliedDate ?? c.created_at) ?? new Date().toISOString();
          return {
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
            stage: c.stage ?? c.current_state ?? 'applied',
            appliedDate: appliedIso,
            appliedAt: appliedIso,
            screeningAt: toIsoString(c.screening_at ?? c.screeningAt),
            interviewAt: toIsoString(c.interview_at ?? c.interviewAt),
            finalAt: toIsoString(c.final_at ?? c.finalAt),
            hiredAt: toIsoString(c.hired_at ?? c.hiredAt),
            rejectedAt: toIsoString(c.rejected_at ?? c.rejectedAt),
            droppedAt: toIsoString(c.dropped_at ?? c.dropoff_at ?? c.droppedAt),
            archivedDate: toIsoString(c.archived_date ?? c.archivedDate),
            skills: Array.isArray(c.skills) ? c.skills : [],
            salary: c.salary ?? '',
            availability: c.availability ?? '',
            resumeUrl: c.resume_url ?? c.resumeUrl ?? '',
            resumeAnalysis: c.resumeAnalysis ?? null,
            notes: Array.isArray(c.notes) ? c.notes : [],
            stageHistory: normalizeStageHistory(c.stageHistory ?? c.state_history)
          };
        });
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

  const positionOptions = useMemo(() => {
    const unique = new Set<string>();
    activeCandidates.forEach((candidate) => {
      if (candidate.position) {
        unique.add(candidate.position);
      }
    });
    return Array.from(unique).sort();
  }, [activeCandidates]);

  // Filter candidates based on search, department, and position
  const filteredCandidates = useMemo(() => {
    return activeCandidates.filter(candidate => {
      const matchesSearch = searchQuery === '' || 
        candidate.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        candidate.position.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesDepartment = departmentFilter === 'all' || 
        candidate.department === departmentFilter;

      const matchesPosition = positionFilter === 'all' ||
        candidate.position === positionFilter;
      
      return matchesSearch && matchesDepartment && matchesPosition;
    });
  }, [activeCandidates, searchQuery, departmentFilter, positionFilter]);

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
          (departmentFilter === 'all' || c.department === departmentFilter) &&
          (positionFilter === 'all' || c.position === positionFilter)
        );
        stageCandidates = [...stageCandidates, ...archivedHired];
      }
      
      return {
        ...stage,
        candidates: stageCandidates
      };
    });
  }, [filteredCandidates, allCandidates, searchQuery, departmentFilter, positionFilter]);

  const stageDurationData = useMemo(() => {
    return calculateAverageStageDuration(filteredCandidates);
  }, [filteredCandidates]);

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
      <div className="mb-6 grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <div className="relative flex-1 min-w-[250px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            type="text"
            placeholder="Search by name or position..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex w-full flex-wrap items-center gap-4 md:w-auto md:flex-nowrap md:justify-end">
          <Select value={positionFilter} onValueChange={setPositionFilter}>
            <SelectTrigger className="min-w-[180px] flex-1 sm:flex-none">
              <SelectValue placeholder="Filter by position" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Positions</SelectItem>
              {positionOptions.map((position) => (
                <SelectItem key={position} value={position}>
                  {position}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
            <SelectTrigger className="min-w-[180px] flex-1 sm:flex-none">
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
      </div>

      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader className="pb-0">
            <CardTitle className="text-base font-medium">Candidate Distribution</CardTitle>
          </CardHeader>
          <CardContent className="p-6 pt-4">
            <div className="h-[350px] w-full">
              <CandidatePieChart data={filteredCandidates} height={350} />
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="pb-0">
            <CardTitle className="text-base font-medium">Average Time Between Stages</CardTitle>
          </CardHeader>
          <CardContent className="p-6 pt-4">
            <div className="h-[320px] w-full">
              <StageDurationBarChart data={stageDurationData} height={320} />
            </div>
          </CardContent>
        </Card>
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