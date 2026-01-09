import { useAuth } from '../context/AuthContext';
import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';
import { 
  Upload, 
  X, 
  FileText, 
  User, 
  Image
} from 'lucide-react';

// Roles will be loaded from backend job descriptions to stay consistent with DB

interface AddCandidateModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (candidate: any) => void;
  candidate?: any; // For editing existing candidate
}

interface CandidateFormData {
  name: string;
  position: string;
}

export function AddCandidateModal({ open, onClose, onAdd, candidate }: AddCandidateModalProps) {
  const { user, loading } = useAuth(); 

  // Role-based UI Guard
  if (loading) return null;

  if (user?.role !== 'hr-recruiter') {
    return null; // Role อื่น ห้ามใช้ Add Candidate
  }
  const [roles, setRoles] = useState<string[]>([]);
  const [rolesLoading, setRolesLoading] = useState<boolean>(false);
  const [rolesError, setRolesError] = useState<string | null>(null);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [profilePicture, setProfilePicture] = useState<File | null>(null);
  const [profilePicturePreview, setProfilePicturePreview] = useState<string | null>(candidate?.avatar || null);
  const [dragActive, setDragActive] = useState(false);
  const [imageDragActive, setImageDragActive] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState(candidate?.position || '');
  const pictureInputRef = useRef<HTMLInputElement | null>(null);
  const resumeInputRef = useRef<HTMLInputElement | null>(null);

  const isEditMode = !!candidate;

  const form = useForm<CandidateFormData>({
    defaultValues: {
      name: candidate?.name || '',
      position: candidate?.position || '',
    }
  });

  // Reset form when candidate changes (for edit mode)
  useEffect(() => {
    if (candidate) {
      form.reset({
        name: candidate.name,
        position: candidate.position
      });
      setProfilePicturePreview(candidate.avatar);
      setSelectedPosition(candidate.position);
    }
  }, [candidate, form]);

  // Load roles from backend job descriptions so dropdown stays consistent with DB
  useEffect(() => {
    const loadRoles = async () => {
      setRolesLoading(true);
      setRolesError(null);
      try {
        const res = await fetch(`${API_BASE}/job-descriptions/`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: Array<{ role?: string }> = await res.json();
        const unique = Array.from(
          new Set(
            (data || [])
              .map(d => (d.role || '').trim())
              .filter(r => r.length > 0)
          )
        ).sort((a, b) => a.localeCompare(b));
        setRoles(unique);
        // If a candidate has an existing role not in DB list, preserve it in dropdown
        if (selectedPosition && unique.indexOf(selectedPosition) === -1) {
          setRoles(prev => [selectedPosition, ...prev]);
        }
      } catch (err: any) {
        console.error('Failed to load roles', err);
        setRolesError('Failed to load roles');
        // fallback: leave roles empty; user can still select after we show message
      } finally {
        setRolesLoading(false);
      }
    };
    loadRoles();
  }, [selectedPosition]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type === "application/pdf" || file.name.toLowerCase().endsWith('.pdf')) {
        setResumeFile(file);
      } else {
        toast.error('Please upload a PDF file');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type === "application/pdf" || file.name.toLowerCase().endsWith('.pdf')) {
        setResumeFile(file);
      } else {
        toast.error('Please upload a PDF file');
      }
    }
  };

  const handleImageDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setImageDragActive(true);
    } else if (e.type === "dragleave") {
      setImageDragActive(false);
    }
  };

  const handleImageDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setImageDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        setProfilePicture(file);
        setProfilePicturePreview(URL.createObjectURL(file));
      } else {
        toast.error('Please upload an image file');
      }
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type.startsWith('image/')) {
        setProfilePicture(file);
        setProfilePicturePreview(URL.createObjectURL(file));
      } else {
        toast.error('Please upload an image file');
      }
    }
  };

  const onSubmit = async (data: CandidateFormData) => {
    if (!selectedPosition) {
      toast.error('Please select a position');
      return;
    }

  // Upload files (profile picture and resume) if present
  let uploadedAvatarUrl = profilePicturePreview || candidate?.avatar || null;
  let uploadedResumeUrl = candidate?.resumeUrl || null;
  let uploadedResumeAnalysis: any = null;

  try {
      if (profilePicture) {
        const fd = new FormData();
        fd.append('file', profilePicture, profilePicture.name);
        const res = await fetch(`${API_BASE}/upload/profile-picture`, {
          method: 'POST',
          body: fd,
        });
        if (!res.ok) throw new Error(`Avatar upload failed (${res.status})`);
        const json = await res.json();
        uploadedAvatarUrl = json.url;
      }

      if (resumeFile) {
        const fd2 = new FormData();
        fd2.append('file', resumeFile, resumeFile.name);
        const res2 = await fetch(`${API_BASE}/upload/resume`, {
          method: 'POST',
          body: fd2,
        });
        if (!res2.ok) throw new Error(`Resume upload failed (${res2.status})`);
        const json2 = await res2.json();
        uploadedResumeUrl = json2.url;
        uploadedResumeAnalysis = json2.analysis ?? null;
      }
    } catch (err) {
      console.error('File upload error', err);
      toast.error('Failed to upload files. Please try again.');
      return;
    }

    // Determine department based on position
    const getDepartmentFromPosition = (position: string) => {
      const engineeringRoles = ['Software Engineer', 'Software Developer', 'Full Stack Developer', 'Backend Developer', 'Frontend Developer', 'DevOps Engineer', 'Cloud Engineer', 'QA Engineer', 'Test Automation Engineer', 'iOS Mobile App Developer', 'Android Mobile App Developer', 'Python Developer', 'Data Engineer', 'Network Engineer', 'Cloud Architect', 'Systems Engineer', 'Java Developer', '.NET Developer', 'Web Developer', 'Software Tester (SDET)', 'Solutions Architect', 'Fintech Engineer', 'Blockchain Developer', 'Robotics Engineer', 'Javascript Developer', 'AR/VR Developer', 'IoT Engineer', 'Ethical Hacker', 'Site Reliability Engineer (SRE)', 'Game Developer'];
      const dataRoles = ['Data Scientist', 'Machine Learning Engineer', 'AI Engineer', 'Data Analyst', 'Business Intelligence Analyst', 'Big Data Specialist', 'AI Prompt Engineer'];
      const designRoles = ['UI Designer', 'UX Designer', 'Product Designer', 'Graphic Designer', 'Vibe Coder'];
      const productRoles = ['Product Manager', 'Project Manager', 'Business Analyst'];
      const marketingRoles = ['Marketing Specialist', 'Digital Marketing Specialist', 'SEO Specialist', 'Content Writer', 'Copywriter', 'Market Research Analyst'];
      const securityRoles = ['Cybersecurity Analyst'];
      const opsRoles = ['Operations Manager', 'Sales Executive', 'Technical Writer'];

      if (engineeringRoles.includes(position)) return 'Engineering';
      if (dataRoles.includes(position)) return 'Data Science';
      if (designRoles.includes(position)) return 'Design';
      if (productRoles.includes(position)) return 'Product';
      if (marketingRoles.includes(position)) return 'Marketing';
      if (securityRoles.includes(position)) return 'Security';
      if (opsRoles.includes(position)) return 'Operations';
      return 'Engineering';
    };
    
    const candidateData = {
      id: candidate?.id || Date.now().toString(),
      name: data.name,
      email: candidate?.email || 'candidate@example.com', // Default email
      phone: candidate?.phone || '+1 234 567 8900', // Default phone
      avatar: uploadedAvatarUrl || profilePicturePreview || candidate?.avatar || `https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face`,
      position: selectedPosition,
      department: candidate?.department || getDepartmentFromPosition(selectedPosition),
      location: candidate?.location || 'Remote', // Default location
      matchScore: candidate?.matchScore || Math.floor(Math.random() * 30) + 70, // Random score between 70-100
      stage: candidate?.stage || ('applied' as const),
      appliedDate: candidate?.appliedDate || new Date().toISOString().split('T')[0],
      skills: candidate?.skills || ['JavaScript', 'React', 'TypeScript'], // Default skills
      salary: candidate?.salary || '$80,000 - $100,000', // Default salary
      availability: candidate?.availability || 'Immediate', // Default availability
      resumeUrl: uploadedResumeUrl || (resumeFile ? URL.createObjectURL(resumeFile) : candidate?.resumeUrl),
      resumeAnalysis: uploadedResumeAnalysis || candidate?.resumeAnalysis || null,
      notes: candidate?.notes || []
    };

    onAdd(candidateData);
    toast.success(isEditMode ? 'Candidate updated successfully!' : 'Candidate added successfully!');
    handleClose();
  };

  const handleClose = () => {
    form.reset();
    setResumeFile(null);
    setProfilePicture(null);
    setProfilePicturePreview(null);
    setSelectedPosition('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {isEditMode ? 'Edit Candidate' : 'Add New Candidate'}
          </DialogTitle>
          <DialogDescription>
            {isEditMode ? 'Update candidate information' : 'Add a new candidate to your recruitment pipeline'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Personal Information */}
          <div className="space-y-4">
            <h3 className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Personal Information
            </h3>
            
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name *</Label>
                <Input
                  id="name"
                  {...form.register('name', { required: 'Name is required' })}
                  placeholder="Enter full name"
                />
                {form.formState.errors.name && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.name.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="profilePicture">Profile Picture</Label>
                <div
                  className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                    imageDragActive 
                      ? 'border-primary bg-primary/5' 
                      : 'border-muted-foreground/25 hover:border-primary/50'
                  }`}
                  onDragEnter={handleImageDrag}
                  onDragLeave={handleImageDrag}
                  onDragOver={handleImageDrag}
                  onDrop={handleImageDrop}
                >
                  {profilePicturePreview ? (
                    <div className="flex flex-col items-center space-y-2">
                      <img 
                        src={profilePicturePreview} 
                        alt="Profile preview" 
                        className="w-24 h-24 rounded-full object-cover"
                      />
                      <p className="text-sm">{profilePicture?.name}</p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setProfilePicture(null);
                          setProfilePicturePreview(null);
                        }}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Image className="h-8 w-8 mx-auto text-muted-foreground" />
                      <div>
                        <p>Drag and drop an image here, or</p>
                        <label>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="mt-2"
                            onClick={() => pictureInputRef.current?.click()}
                          >
                            Browse Files
                          </Button>
                          <input
                            id="profile-picture-upload"
                            type="file"
                            accept="image/*"
                            onChange={handleImageChange}
                            className="sr-only"
                            ref={pictureInputRef}
                          />
                        </label>
                      </div>
                      <p className="text-xs text-muted-foreground">PNG, JPG, GIF up to 5MB</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Job Information */}
          <div className="space-y-4">
            <h3>Job Information</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="position">Position Applied For *</Label>
                <Select 
                  value={selectedPosition} 
                  onValueChange={(value: string) => {
                    setSelectedPosition(value);
                    form.setValue('position', value);
                  }}
                >
                  <SelectTrigger id="position">
                    <SelectValue placeholder="Select position..." />
                  </SelectTrigger>
                  <SelectContent>
                    {rolesLoading && (
                      <div className="px-3 py-2 text-sm text-muted-foreground">Loading roles...</div>
                    )}
                    {!rolesLoading && rolesError && (
                      <div className="px-3 py-2 text-sm text-destructive">{rolesError}</div>
                    )}
                    {!rolesLoading && !rolesError && roles.length === 0 && (
                      <div className="px-3 py-2 text-sm text-muted-foreground">No roles available</div>
                    )}
                    {!rolesLoading && roles.map((position: string) => (
                      <SelectItem key={position} value={position}>
                        {position}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!selectedPosition && form.formState.isSubmitted && (
                  <p className="text-sm text-destructive">
                    Position is required
                  </p>
                )}
              </div>

              
            </div>
          </div>

          {/* Resume Upload */}
          <div className="space-y-4">
            <h3 className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Resume Upload
            </h3>
            
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                dragActive 
                  ? 'border-primary bg-primary/5' 
                  : 'border-muted-foreground/25 hover:border-primary/50'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              {resumeFile ? (
                <div className="flex items-center justify-center space-x-2">
                  <FileText className="h-8 w-8 text-primary" />
                  <div>
                    <p className="font-medium">{resumeFile.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(resumeFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setResumeFile(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                  <div>
                    <p>Drag and drop a PDF file here, or</p>
                    <label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={() => resumeInputRef.current?.click()}
                      >
                        Browse Files
                      </Button>
                          <input
                            id="resume-upload"
                            type="file"
                            accept="application/pdf,.pdf"
                            onChange={handleFileChange}
                            className="sr-only"
                            ref={resumeInputRef}
                          />
                    </label>
                  </div>
                  <p className="text-xs text-muted-foreground">PDF files only, max 10MB</p>
                </div>
              )}
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting 
                ? (isEditMode ? 'Updating...' : 'Adding...') 
                : (isEditMode ? 'Update Candidate' : 'Add Candidate')
              }
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

