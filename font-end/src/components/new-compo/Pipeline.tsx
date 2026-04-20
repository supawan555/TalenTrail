import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Mail, Phone, Calendar, Search } from 'lucide-react';
import { Candidate } from '../../lib/mock-data';

import { CandidatePieChart } from '../analytics/CandidatePieChart';
import { StageDurationBarChart } from '../analytics/StageDurationBarChart';

const toValidDate = (value?: string | null): Date | null => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getCurrentStageEnteredDate = (candidate: Candidate): Date | null => {
  const currentStage = (candidate.stage ?? '').toLowerCase();

  // Prefer explicit history for the current stage when available.
  if (Array.isArray(candidate.stageHistory) && currentStage) {
    const historyEntry = [...candidate.stageHistory]
      .reverse()
      .find((entry) => (entry?.stage ?? '').toLowerCase() === currentStage);

    const historyDate = toValidDate(historyEntry?.enteredAt ?? null);
    if (historyDate) return historyDate;
  }

  // Fallback to stage-specific timestamps from API.
  const stageDateMap: Record<string, string | undefined> = {
    applied: candidate.appliedAt ?? candidate.appliedDate,
    screening: candidate.screeningAt,
    interview: candidate.interviewAt,
    final: candidate.finalAt,
    hired: candidate.hiredAt,
    rejected: candidate.rejectedAt,
    'drop-off': candidate.droppedAt,
    archived: candidate.archivedDate
  };

  const stageDate = toValidDate(stageDateMap[currentStage]);
  if (stageDate) return stageDate;

  return toValidDate(candidate.appliedAt ?? candidate.appliedDate);
};

// กำหนด Props ทั้งหมดที่ UI ต้องการ (รวมถึงค่าที่เคยมาจาก Hook)
export interface PipelineUIProps {
  user: any; // กำหนด Type ให้ตรงกับ User ของคุณ
  loading: boolean;
  onCandidateSelect: (candidate: Candidate) => void;
  
  // Props ที่ส่งมาจาก usePipeline Hook
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  departmentFilter: string;
  setDepartmentFilter: (filter: string) => void;
  positionFilter: string;
  setPositionFilter: (filter: string) => void;
  expandedStage: string | null;
  setExpandedStage: (stageId: string | null) => void;
  positionOptions: string[];
  departmentOptions: string[];
  filteredCandidates: Candidate[];
  filteredStages: any[];
  stageDurationData: any[];
}

export function PipelineUI({
  user,
  loading,
  onCandidateSelect,
  searchQuery,
  setSearchQuery,
  departmentFilter,
  setDepartmentFilter,
  positionFilter,
  setPositionFilter,
  expandedStage,
  setExpandedStage,
  positionOptions,
  departmentOptions,
  filteredCandidates,
  filteredStages,
  stageDurationData
}: PipelineUIProps) {
  
  // ตรวจสอบสิทธิ์การเข้าถึงจาก Props แทน
  if (loading) return null;
  if (!user || !['hr-recruiter', 'ADMIN'].includes(user.role)) {
    return null;
  }

  const CandidateCard = ({ candidate }: { candidate: Candidate }) => {
    const enteredDate = getCurrentStageEnteredDate(candidate);

    return (
    <Card className="w-full h-full hover:shadow-md transition-all duration-200">
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
            <span className="truncate" title={candidate.email || 'N/A'}>{candidate.email || 'N/A'}</span>
          </div>
          <div className="flex items-center text-xs text-muted-foreground min-w-0">
            <Phone className="w-3 h-3 mr-1 shrink-0" />
            <span className="truncate" title={candidate.phone || 'N/A'}>{candidate.phone || 'N/A'}</span>
          </div>
          <div className="flex items-center text-xs text-muted-foreground">
            <Calendar className="w-3 h-3 mr-1" />
            Entered {enteredDate ? enteredDate.toLocaleDateString() : 'N/A'}
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
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold mb-2">Recruitment Pipeline</h2>
        <p className="text-muted-foreground">Track candidates through the hiring process</p>
      </div>

      <div className="mb-6 flex flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full lg:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            type="text"
            placeholder="Search by name or position..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Filters */}
        <div className="flex w-full flex-col gap-4 sm:flex-row lg:w-auto">
          <Select value={positionFilter} onValueChange={setPositionFilter}>
            <SelectTrigger className="min-w-[180px]">
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
            <SelectTrigger className="min-w-[180px]">
              <SelectValue placeholder="Filter by department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {departmentOptions.map((department) => (
                <SelectItem key={department} value={department}>
                  {department}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Candidate Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            <div className="h-[240px] w-full">
              <CandidatePieChart data={filteredCandidates} height={240} />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Average Time Between Stages
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            <div className="h-[240px] w-full">
              <StageDurationBarChart data={stageDurationData} height={240} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div
        className={`
          grid gap-4
          ${expandedStage
            ? 'grid-cols-1'
            : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5'}
        `}
      >
        {filteredStages.map((stage) => {
          const isExpanded = expandedStage === stage.id;

          if (expandedStage && !isExpanded) return null;

          return (
            <div
              key={stage.id}
              className={`
                min-h-[600px]
                transition-all duration-300
                ${isExpanded ? 'col-span-full' : ''}
              `}
            >
              <Card
                onClick={() =>
                  setExpandedStage(expandedStage === stage.id ? null : stage.id)
                }
                className={`${stage.color} border-2 border-dashed h-full cursor-pointer`}
              >
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center justify-between">
                    {stage.name}
                    <Badge variant="secondary" className="ml-2">
                      {stage.candidates.length}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div
                    className={
                      expandedStage === stage.id
                        ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
                        : "space-y-3"
                    }
                  >
                    {(isExpanded
                      ? stage.candidates
                      : stage.candidates.slice(0, 7)
                    ).map((candidate: Candidate) => (
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
          );
        })}
      </div>
    </div>
  );
}