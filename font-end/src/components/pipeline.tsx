import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Progress } from './ui/progress';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Mail, Phone, Calendar, Search } from 'lucide-react';
import { pipelineStages, Candidate } from '../lib/mock-data';

interface PipelineProps {
  onCandidateSelect: (candidate: Candidate) => void;
  candidates?: Candidate[];
}

export function Pipeline({ onCandidateSelect, candidates: propCandidates }: PipelineProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');

  // Use provided candidates or empty array
  const allCandidates = propCandidates || [];
  
  // Filter out archived candidates (rejected and drop-off)
  const activeCandidates = allCandidates.filter(c => c.stage !== 'rejected' && c.stage !== 'drop-off');

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
    return pipelineStages.map(stage => ({
      ...stage,
      candidates: filteredCandidates.filter(c => c.stage === stage.id)
    }));
  }, [filteredCandidates]);

  const CandidateCard = ({ candidate }: { candidate: Candidate }) => (
    <Card className="mb-3 cursor-pointer hover:shadow-md transition-shadow" onClick={() => onCandidateSelect(candidate)}>
      <CardContent className="p-4">
        <div className="flex items-center space-x-3 mb-3">
          <Avatar className="w-10 h-10">
            <AvatarImage src={candidate.avatar} alt={candidate.name} />
            <AvatarFallback>{candidate.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
          </Avatar>
          <div>
            <h4 className="font-medium text-sm">{candidate.name}</h4>
            <p className="text-xs text-muted-foreground">{candidate.position}</p>
          </div>
        </div>
        
        <div className="space-y-2 mb-3">
          <div className="flex items-center text-xs text-muted-foreground">
            <Mail className="w-3 h-3 mr-1" />
            {candidate.email}
          </div>
          <div className="flex items-center text-xs text-muted-foreground">
            <Phone className="w-3 h-3 mr-1" />
            {candidate.phone}
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