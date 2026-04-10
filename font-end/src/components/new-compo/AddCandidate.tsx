// components/AddCandidateModal.ui.tsx

import { UseFormReturn } from 'react-hook-form';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Upload, X, FileText, User } from 'lucide-react';

interface CandidateFormData {
  name: string;
  position: string;
}

interface AddCandidateUIProps {
  // Dialog
  open: boolean;
  isEditMode: boolean;
  onClose: () => void;

  // Form
  form: UseFormReturn<CandidateFormData>;
  onSubmit: (data: CandidateFormData) => void;

  // Roles dropdown
  roles: string[];
  rolesLoading: boolean;
  rolesError: string | null;
  selectedPosition: string;
  onPositionChange: (value: string) => void;

  // Resume upload
  resumeFile: File | null;
  dragActive: boolean;
  onDrag: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveResume: () => void;
  onBrowseClick: () => void;
  resumeInputRef: React.RefObject<HTMLInputElement>;
}

export function AddCandidateUI({
  open,
  isEditMode,
  onClose,
  form,
  onSubmit,
  roles,
  rolesLoading,
  rolesError,
  selectedPosition,
  onPositionChange,
  resumeFile,
  dragActive,
  onDrag,
  onDrop,
  onFileChange,
  onRemoveResume,
  onBrowseClick,
  resumeInputRef,
}: AddCandidateUIProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {isEditMode ? 'Edit Candidate' : 'Add New Candidate'}
          </DialogTitle>
          <DialogDescription>
            {isEditMode
              ? 'Update candidate information'
              : 'Add a new candidate to your recruitment pipeline'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

          {/* Personal Information */}
          <div className="space-y-4">
            <h3 className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Personal Information
            </h3>
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
          </div>

          {/* Job Information */}
          <div className="space-y-4">
            <h3>Job Information</h3>
            <div className="space-y-2">
              <Label htmlFor="position">Position Applied For *</Label>
              <Select value={selectedPosition} onValueChange={onPositionChange}>
                <SelectTrigger id="position">
                  <SelectValue placeholder="Select position..." />
                </SelectTrigger>
                <SelectContent>
                  {rolesLoading && (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      Loading roles...
                    </div>
                  )}
                  {!rolesLoading && rolesError && (
                    <div className="px-3 py-2 text-sm text-destructive">
                      {rolesError}
                    </div>
                  )}
                  {!rolesLoading && !rolesError && roles.length === 0 && (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      No roles available
                    </div>
                  )}
                  {!rolesLoading &&
                    roles.map((position) => (
                      <SelectItem key={position} value={position}>
                        {position}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {!selectedPosition && form.formState.isSubmitted && (
                <p className="text-sm text-destructive">Position is required</p>
              )}
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
              onDragEnter={onDrag}
              onDragLeave={onDrag}
              onDragOver={onDrag}
              onDrop={onDrop}
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
                  <Button type="button" variant="ghost" size="sm" onClick={onRemoveResume}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                  <p>Drag and drop a PDF file here, or</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={onBrowseClick}
                  >
                    Browse Files
                  </Button>
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={onFileChange}
                    className="sr-only"
                    ref={resumeInputRef}
                  />
                  <p className="text-xs text-muted-foreground">PDF files only, max 10MB</p>
                </div>
              )}
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting
                ? isEditMode ? 'Updating...' : 'Adding...'
                : isEditMode ? 'Update Candidate' : 'Add Candidate'}
            </Button>
          </div>

        </form>
      </DialogContent>
    </Dialog>
  );
}