import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Separator } from './ui/separator';
import { ScrollArea } from './ui/scroll-area';
import { 
  MessageSquare, 
  Plus, 
  Search, 
  Filter, 
  Calendar,
  User,
  Tag
} from 'lucide-react';
import { mockCandidates, Note } from '../lib/mock-data';

const DEFAULT_TAGS = [
  "Awaiting Feedback",
  "Need Approval",
  "Rejected",
  "Withdrawn",
  "Approved"
];

// Collect all notes from all candidates (exclude archived)
const activeCandidates = mockCandidates.filter(c => c.stage !== 'rejected' && c.stage !== 'drop-off');
const allNotes = activeCandidates.flatMap(candidate => 
  candidate.notes.map(note => ({
    ...note,
    candidateName: candidate.name,
    candidateId: candidate.id,
    candidatePosition: candidate.position,
    candidateAvatar: candidate.avatar
  }))
);

export function Notes() {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [newNote, setNewNote] = useState('');
  const [selectedCandidate, setSelectedCandidate] = useState('');
  const [noteTag, setNoteTag] = useState('');
  const [customTag, setCustomTag] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  const filteredNotes = allNotes.filter(note => {
    const matchesSearch = note.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         note.candidateName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'all' || note.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const handleAddNote = () => {
    if (newNote.trim() && selectedCandidate) {
      // In a real app, this would create a new note
      setNewNote('');
      setSelectedCandidate('');
      setNoteTag('');
      setCustomTag('');
      setShowCustomInput(false);
    }
  };

  const handleTagChange = (value: string) => {
    if (value === 'other') {
      setShowCustomInput(true);
      setNoteTag('');
    } else {
      setShowCustomInput(false);
      setNoteTag(value);
      setCustomTag('');
    }
  };

  const handleCustomTagChange = (value: string) => {
    setCustomTag(value);
    setNoteTag(value);
  };

  // Determine the final tag to use
  const finalTag = showCustomInput ? customTag : noteTag;

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'Awaiting Feedback': return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'Need Approval': return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'Rejected': return 'bg-red-50 text-red-700 border-red-200';
      case 'Withdrawn': return 'bg-gray-50 text-gray-700 border-gray-200';
      case 'Approved': return 'bg-green-50 text-green-700 border-green-200';
      default: return 'bg-blue-50 text-blue-700 border-blue-200'; // For custom tags
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Collaboration Notes</h2>
          <p className="text-muted-foreground">All notes and feedback from the recruitment process</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Add New Note */}
        <div className="lg:col-span-1">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Plus className="w-5 h-5 mr-2" />
                Add New Note
              </CardTitle>
              <CardDescription>Create a new note for a candidate</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Candidate</label>
                <Select value={selectedCandidate} onValueChange={setSelectedCandidate}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select candidate..." />
                  </SelectTrigger>
                  <SelectContent>
                    {mockCandidates.map((candidate) => (
                      <SelectItem key={candidate.id} value={candidate.id}>
                        <div className="flex items-center space-x-2">
                          <Avatar className="w-6 h-6">
                            <AvatarImage src={candidate.avatar} alt={candidate.name} />
                            <AvatarFallback className="text-xs">
                              {candidate.name.split(' ').map(n => n[0]).join('')}
                            </AvatarFallback>
                          </Avatar>
                          <span>{candidate.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Note Tag</label>
                <Select 
                  value={showCustomInput ? 'other' : noteTag} 
                  onValueChange={handleTagChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a tag..." />
                  </SelectTrigger>
                  <SelectContent>
                    {DEFAULT_TAGS.map((tag) => (
                      <SelectItem key={tag} value={tag}>
                        {tag}
                      </SelectItem>
                    ))}
                    <SelectItem value="other">Other (Custom Tag)</SelectItem>
                  </SelectContent>
                </Select>
                
                {showCustomInput && (
                  <div className="mt-2">
                    <Input
                      placeholder="Enter custom tag..."
                      value={customTag}
                      onChange={(e) => handleCustomTagChange(e.target.value)}
                      maxLength={30}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Max 30 characters
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Note</label>
                <Textarea
                  placeholder="Write your note here..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  className="min-h-[120px]"
                />
              </div>

              <Button 
                onClick={handleAddNote} 
                disabled={!newNote.trim() || !selectedCandidate || !finalTag.trim()}
                className="w-full"
              >
                Add Note
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Notes List */}
        <div className="lg:col-span-2 space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input
                      placeholder="Search notes..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-52">
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Tags</SelectItem>
                    {DEFAULT_TAGS.map((tag) => (
                      <SelectItem key={tag} value={tag}>
                        {tag}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Notes Feed */}
          <ScrollArea className="h-[600px]">
            <div className="space-y-4">
              {filteredNotes.map((note) => (
                <Card key={note.id} className="hover:shadow-sm transition-shadow">
                  <CardContent className="pt-6">
                    <div className="flex items-start space-x-4">
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={note.candidateAvatar} alt={note.candidateName} />
                        <AvatarFallback>
                          {note.candidateName.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium">{note.candidateName}</h4>
                            <p className="text-sm text-muted-foreground">{note.candidatePosition}</p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge className={getTypeColor(note.type)}>
                              {note.type}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(note.timestamp).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        
                        <p className="text-sm leading-relaxed">{note.content}</p>
                        
                        <div className="flex items-center justify-between pt-2 border-t border-border/40">
                          <div className="flex items-center text-xs text-muted-foreground">
                            <User className="w-3 h-3 mr-1" />
                            By {note.author}
                          </div>
                          <div className="flex items-center text-xs text-muted-foreground">
                            <Calendar className="w-3 h-3 mr-1" />
                            {new Date(note.timestamp).toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {filteredNotes.length === 0 && (
                <Card>
                  <CardContent className="py-12 text-center">
                    <div className="text-muted-foreground">
                      <MessageSquare className="w-12 h-12 mx-auto mb-4" />
                      <h3 className="font-medium">No notes found</h3>
                      <p className="text-sm">Try adjusting your search criteria or add a new note</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}