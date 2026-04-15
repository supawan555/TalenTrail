// components/Candidates.ui.tsx

import { Link } from 'react-router-dom';
import { Candidate } from '../../lib/mock-data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Progress } from '../ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Search, Filter, SortAsc, Mail, Phone, Calendar, Plus, Users, Star } from 'lucide-react';
import { AddCandidateModal } from '../add-candidate-modal';

interface CandidatesUIProps {
  // Auth
  canAddCandidate: boolean;

  // State
  loading: boolean;
  candidates: Candidate[];
  searchQuery: string;
  stageFilter: string;
  sortBy: string;

  // Modal
  showAddModal: boolean;
  onOpenAddModal: () => void;
  onCloseAddModal: () => void;

  // Handlers
  onSearchChange: (value: string) => void;
  onStageFilterChange: (value: string) => void;
  onSortByChange: (value: string) => void;
  onCandidateSelect: (candidate: Candidate) => void;
  onAddCandidate: (candidate: Candidate) => void;

  // Helpers
  getStageColor: (stage: string) => string;
}

export function CandidatesUI({
  canAddCandidate,
  loading,
  candidates,
  searchQuery,
  stageFilter,
  sortBy,
  showAddModal,
  onOpenAddModal,
  onCloseAddModal,
  onSearchChange,
  onStageFilterChange,
  onSortByChange,
  onCandidateSelect,
  onAddCandidate,
  getStageColor,
}: CandidatesUIProps) {
  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">All Candidates</h2>
          <p className="text-muted-foreground">Manage and track all candidate applications</p>
        </div>
        {canAddCandidate && (
          <Button onClick={onOpenAddModal} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add Candidate
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search candidates..."
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={stageFilter} onValueChange={onStageFilterChange}>
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
            <Select value={sortBy} onValueChange={onSortByChange}>
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

      {/* Loading */}
      {loading && (
        <div className="text-center py-10">
          <p>Loading candidates...</p>
        </div>
      )}

      {/* Grid */}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {candidates.map((candidate) => (
            <Card key={candidate.id} className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader className="pb-3">
                <div className="space-y-1">
                  <Link
                    to={`/candidate/${candidate.id}`}
                    onClick={() => onCandidateSelect(candidate)}
                    className="no-underline"
                  >
                    <CardTitle className="text-lg hover:underline">{candidate.name}</CardTitle>
                  </Link>
                  <CardDescription className="text-sm text-muted-foreground">
                    {candidate.position}
                  </CardDescription>
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
                    Applied {candidate.appliedDate
                      ? new Date(candidate.appliedDate).toLocaleDateString()
                      : 'N/A'}
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

      {/* Empty State */}
      {!loading && candidates.length === 0 && (
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

      {/* Add Modal */}
      <AddCandidateModal
        open={showAddModal}
        onClose={onCloseAddModal}
        onAdd={onAddCandidate}
      />

    </div>
  );
}