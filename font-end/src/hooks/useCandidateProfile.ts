// hooks/useCandidateProfile.ts

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../lib/api'
import { Candidate } from '../lib/mock-data'

const API_BASE = import.meta.env.VITE_API_URL ?? 'https://talentrail-1.onrender.com'

export const useCandidateProfile = (
    candidate: Candidate,
    callbacks: {
        onEdit?: (c: Candidate) => void
        onDelete?: (id: string) => void
        onNextStage?: (id: string) => void
        onReject?: (id: string, reason: string) => void
        onDropOff?: (id: string, reason: string) => void
    }
) => {
    const navigate = useNavigate()

    // STATE
    const [liveCandidate, setLiveCandidate] = useState<Candidate>(candidate)

    const [showEditModal, setShowEditModal] = useState(false)
    const [showDeleteDialog, setShowDeleteDialog] = useState(false)
    const [showNextStageDialog, setShowNextStageDialog] = useState(false)
    const [showArchiveDialog, setShowArchiveDialog] = useState(false)

    const [archiveType, setArchiveType] = useState<'reject' | 'drop-off'>('reject')
    const [archiveReason, setArchiveReason] = useState('')

    const [startDateInput, setStartDateInput] = useState('')
    const [isSavingStartDate, setIsSavingStartDate] = useState(false)

    // MEMO
    const notes = useMemo<any[]>(() => {
        const raw = (liveCandidate as any)?.notes
        return Array.isArray(raw) ? raw : []
    }, [liveCandidate])

    const resolvedResumeUrl = useMemo(() => {
        const url = (liveCandidate as any)?.resumeUrl
        if (!url) return undefined
        if (url.startsWith('http')) return url
        return `${API_BASE}${url.startsWith('/') ? '' : '/'}${url}`
    }, [liveCandidate])

    // HELPERS

    const normalizeNoteType = (value: unknown): string => {
        if (!value || typeof value !== 'string') return 'Note'
        const lower = value.toLowerCase()

        if (lower.includes('feedback')) return 'Awaiting Feedback'
        if (lower.includes('approval')) return 'Need Approval'
        if (lower.includes('reject')) return 'Rejected'
        if (lower.includes('drop')) return 'Withdrawn'
        if (lower.includes('approve')) return 'Approved'

        return value
    }

    const getNextStage = (): Candidate['stage'] | null => {
        const stages: Candidate['stage'][] = ['applied', 'screening', 'interview', 'final', 'hired']
        const index = stages.indexOf(liveCandidate.stage)

        if (index >= 0 && index < stages.length - 1) {
            return stages[index + 1]
        }

        return null
    }

    const nextStage = getNextStage()

    const canEditStartDate =
        liveCandidate.stage === 'hired' || liveCandidate.stage === 'archived'

    // FETCH
    useEffect(() => {
        const fetch = async () => {
            try {
                const res = await api.get(`/candidates/${candidate.id}`)
                setLiveCandidate(res.data)
            } catch {
                console.warn('Failed to refresh candidate')
            }
        }
        fetch()
    }, [candidate.id])

    // HANDLERS

    const handleEdit = async (updated: Candidate) => {
        try {
            const res = await api.put(`/candidates/${liveCandidate.id}`, updated)
            setLiveCandidate(res.data)
            callbacks.onEdit?.(res.data)
        } finally {
            setShowEditModal(false)
        }
    }

    const handleDelete = async () => {
        try {
            await api.delete(`/candidates/${liveCandidate.id}`)
            callbacks.onDelete?.(liveCandidate.id)
            navigate('/candidates')
        } finally {
            setShowDeleteDialog(false)
        }
    }

    const handleNextStage = async () => {
        if (!nextStage) return

        await api.put(`/candidates/${liveCandidate.id}`, {
            stage: nextStage
        })

        setLiveCandidate(prev => ({ ...prev, stage: nextStage }))
        callbacks.onNextStage?.(liveCandidate.id)

        setShowNextStageDialog(false)
    }

    const handleArchive = async () => {
        if (!archiveReason.trim()) return

        const stage = archiveType === 'reject' ? 'rejected' : 'drop-off'

        await api.put(`/candidates/${liveCandidate.id}`, {
            stage,
            archiveReason
        })

        setLiveCandidate(prev => ({ ...prev, stage }))

        if (archiveType === 'reject') {
            callbacks.onReject?.(liveCandidate.id, archiveReason)
        } else {
            callbacks.onDropOff?.(liveCandidate.id, archiveReason)
        }

        setShowArchiveDialog(false)
        setArchiveReason('')
    }

    const handleSaveStartDate = async () => {
        if (!startDateInput) return

        setIsSavingStartDate(true)

        try {
            const res = await api.put(`/candidates/${liveCandidate.id}`, {
                availableStartDate: startDateInput
            })
            setLiveCandidate(res.data)
        } finally {
            setIsSavingStartDate(false)
        }
    }

    return {
        // state
        liveCandidate,
        notes,
        resolvedResumeUrl,
        navigate,

        showEditModal,
        setShowEditModal,
        showDeleteDialog,
        setShowDeleteDialog,
        showNextStageDialog,
        setShowNextStageDialog,
        showArchiveDialog,
        setShowArchiveDialog,

        archiveType,
        setArchiveType,
        archiveReason,
        setArchiveReason,

        startDateInput,
        setStartDateInput,
        isSavingStartDate,

        nextStage,
        canEditStartDate,

        // handlers
        handleEdit,
        handleDelete,
        handleNextStage,
        handleArchive,
        handleSaveStartDate,

        normalizeNoteType,
    }
}