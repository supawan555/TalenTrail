// hooks/useAddCandidate.ts

import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'

const API_BASE = import.meta.env.VITE_API_URL ?? 'https://talentrail-1.onrender.com'

export const useAddCandidate = (candidate: any) => {
    const [roles, setRoles] = useState<string[]>([])
    const [rolesLoading, setRolesLoading] = useState(false)
    const [rolesError, setRolesError] = useState<string | null>(null)

    const [resumeFile, setResumeFile] = useState<File | null>(null)
    const [dragActive, setDragActive] = useState(false)

    const [selectedPosition, setSelectedPosition] = useState(candidate?.position || '')

    const resumeInputRef = useRef<HTMLInputElement | null>(null)

    const isEditMode = !!candidate

    // LOAD ROLES
    useEffect(() => {
        const loadRoles = async () => {
            setRolesLoading(true)
            setRolesError(null)

            try {
                const res = await fetch(`${API_BASE}/job-descriptions/`)
                if (!res.ok) throw new Error()

                const data: Array<{ role?: string; isHidden?: boolean }> = await res.json()

                const visibleRoles = data
                    .filter((item: { isHidden?: boolean }) => !item?.isHidden)
                    .map((d: { role?: string }) => (d.role || '').trim())
                    .filter((r: string) => r.length > 0)

                let unique = Array.from(new Set(visibleRoles)).sort((a, b) =>
                    a.localeCompare(b)
                )

                if (selectedPosition && !unique.includes(selectedPosition)) {
                    unique = [selectedPosition, ...unique]
                }

                setRoles(unique)
            } catch {
                setRolesError('Failed to load roles')
            } finally {
                setRolesLoading(false)
            }
        }

        loadRoles()
    }, [selectedPosition])

    // DRAG
    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()

        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true)
        } else {
            setDragActive(false)
        }
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setDragActive(false)

        const file = e.dataTransfer.files?.[0]
        if (!file) return

        if (file.type === 'application/pdf') {
            setResumeFile(file)
        } else {
            toast.error('PDF only')
        }
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        if (file.type === 'application/pdf') {
            setResumeFile(file)
        } else {
            toast.error('PDF only')
        }
    }

    // LOGIC
    const getDepartmentFromPosition = (position: string) => {
        if (position.includes('Engineer')) return 'Engineering'
        if (position.includes('Data')) return 'Data Science'
        if (position.includes('Design')) return 'Design'
        return 'Engineering'
    }

    // SUBMIT
    const handleSubmit = async (data: any, onAdd: any, onClose: any) => {
        let uploadedResumeUrl = candidate?.resumeUrl || null

        try {
            if (resumeFile) {
                const fd = new FormData()
                fd.append('file', resumeFile)

                const res = await fetch(`${API_BASE}/upload/resume`, {
                    method: 'POST',
                    body: fd
                })

                const json = await res.json()
                uploadedResumeUrl = json.url
            }
        } catch {
            toast.error('Upload failed')
            return
        }

        const candidateData = {
            name: data.name,
            position: selectedPosition,
            resumeUrl: uploadedResumeUrl,
            department: getDepartmentFromPosition(selectedPosition)
        }

        onAdd(candidateData)
        onClose()
    }

    const handleClose = (formReset: () => void, onClose: any) => {
        formReset()
        setResumeFile(null)
        setSelectedPosition('')
        onClose()
    }

    return {
        roles,
        rolesLoading,
        rolesError,

        resumeFile,
        setResumeFile,
        dragActive,
        selectedPosition,

        setSelectedPosition,

        handleDrag,
        handleDrop,
        handleFileChange,

        handleSubmit,
        handleClose,

        resumeInputRef,
        isEditMode
    }
}