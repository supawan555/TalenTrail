// hooks/useArchivedCandidates.ts

import { useEffect, useMemo, useState } from 'react'
import { Candidate } from '../lib/mock-data'
import api from '../lib/api'
import { toast } from 'sonner'

export const useArchivedCandidates = (
  candidates: Candidate[],
  onRestore: (id: string) => void
) => {

  const [searchQuery, setSearchQuery] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('All')
  const [roleFilter, setRoleFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')

  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)

  const [showRestoreDialog, setShowRestoreDialog] = useState(false)
  const [candidateToRestore, setCandidateToRestore] = useState<Candidate | null>(null)

  const [remoteCandidates, setRemoteCandidates] = useState<Candidate[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // LOAD
  useEffect(() => {
    let cancelled = false

    const loadCandidates = async () => {
      if (candidates && candidates.length > 0) return

      setLoading(true)
      setError(null)

      try {
        const res = await api.get('/candidates/')
        const data = res.data as any[]

        if (cancelled) return

        const normalized: Candidate[] = (data || []).map((c: any) => ({
          id: c.id ?? c._id ?? String(Date.now()),
          name: c.name ?? 'Unknown',
          email: c.email ?? '',
          phone: c.phone ?? '',
          position: c.position ?? c.role ?? '',
          department: c.department ?? 'Engineering',
          experience: c.experience ?? 'mid',
          location: c.location ?? '',
          matchScore: c.matchScore ?? 0,
          stage: c.stage ?? 'applied',
          appliedDate: c.appliedDate ?? c.created_at ?? new Date().toISOString(),
          skills: c.skills ?? [],
          salary: c.salary ?? '',
          availability: c.availability ?? '',
          resumeUrl: c.resume_url ?? '',
          resumeAnalysis: c.resumeAnalysis ?? null,
          notes: c.notes ?? [],
          archiveReason: c.archiveReason ?? '',
          archivedDate: c.archivedDate ?? null,
        }))

        setRemoteCandidates(normalized)

      } catch (err) {
        console.error(err)
        setError('Failed to load archived candidates')
      } finally {
        setLoading(false)
      }
    }

    loadCandidates()
    return () => { cancelled = true }

  }, [candidates])

  // DATA SOURCE
  const sourceCandidates = useMemo(() => {
    return (candidates?.length > 0) ? candidates : remoteCandidates
  }, [candidates, remoteCandidates])

  // ARCHIVED
  const archivedCandidates = sourceCandidates.filter(c =>
    c.stage === 'rejected' || c.stage === 'drop-off' || c.stage === 'archived'
  )

  // ROLES
  const uniqueRoles = Array.from(
    new Set(archivedCandidates.map(c => c.position))
  ).sort()

  // FILTER
  const filteredCandidates = archivedCandidates.filter(c => {
    const q = searchQuery.toLowerCase()

    const matchesSearch =
      c.name.toLowerCase().includes(q) ||
      c.position.toLowerCase().includes(q) ||
      (c.archiveReason?.toLowerCase().includes(q) || false)

    const matchesDepartment =
      departmentFilter === 'All' || c.department === departmentFilter

    const matchesRole =
      roleFilter === 'All' || c.position === roleFilter

    const matchesStatus =
      statusFilter === 'All' ||
      (statusFilter === 'Rejected' && c.stage === 'rejected') ||
      (statusFilter === 'Drop-off' && c.stage === 'drop-off') ||
      (statusFilter === 'Hired' && c.stage === 'archived')

    return matchesSearch && matchesDepartment && matchesRole && matchesStatus
  })

  // HANDLERS

  const handleViewCandidate = (candidate: Candidate) => {
    setSelectedCandidate(candidate)
    setShowDetailsModal(true)
  }

  const handleRestoreClick = (candidate: Candidate) => {
    setCandidateToRestore(candidate)
    setShowRestoreDialog(true)
  }

  const handleConfirmRestore = async () => {
    if (!candidateToRestore) return

    try {
      await api.put(`/candidates/${candidateToRestore.id}`, {
        stage: 'applied',
        archiveReason: '',
        archivedDate: null,
      })

      setRemoteCandidates(prev =>
        prev.map(c =>
          c.id === candidateToRestore.id
            ? { ...c, stage: 'applied', archiveReason: '', archivedDate: undefined }
            : c
        )
      )

      onRestore(candidateToRestore.id)
      toast.success(`${candidateToRestore.name} restored`)

    } catch {
      toast.error('Restore failed')
    } finally {
      setShowRestoreDialog(false)
      setCandidateToRestore(null)
    }
  }

  return {
    // state
    searchQuery,
    setSearchQuery,
    departmentFilter,
    setDepartmentFilter,
    roleFilter,
    setRoleFilter,
    statusFilter,
    setStatusFilter,

    selectedCandidate,
    setSelectedCandidate,
    showDetailsModal,
    setShowDetailsModal,

    showRestoreDialog,
    setShowRestoreDialog,
    candidateToRestore,

    loading,
    error,

    uniqueRoles,
    filteredCandidates,

    handleViewCandidate,
    handleRestoreClick,
    handleConfirmRestore
  }
}