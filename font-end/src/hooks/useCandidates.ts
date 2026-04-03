// hooks/useCandidates.ts

import { useState, useEffect } from 'react'
import api from '../lib/api'
import { toast } from 'sonner'
import { Candidate } from '../lib/mock-data'

export const useCandidates = () => {
  // STATE
  const [searchQuery, setSearchQuery] = useState('')
  const [allCandidates, setAllCandidates] = useState<Candidate[]>([])
  const [stageFilter, setStageFilter] = useState('all')
  const [sortBy, setSortBy] = useState('recent')
  const [loading, setLoading] = useState(true)

  // API (load data)
  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/candidates')

        const mappedData = res.data.map((c: any) => ({
          ...c,
          appliedDate: c.created_at || c.appliedDate || new Date().toISOString(),
          matchScore: c.matchScore || 0
        }))

        setAllCandidates(mappedData)
      } catch (err) {
        console.error(err)
        toast.error('Failed to load candidates')
        setAllCandidates([])
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  // add candidate
  const addCandidate = async (newCandidate: Candidate) => {
    try {
      const res = await api.post('/candidates', newCandidate)

      const mapped = {
        ...res.data,
        appliedDate: res.data.created_at || new Date().toISOString(),
        matchScore: res.data.matchScore || 0
      }

      setAllCandidates(prev => [mapped, ...prev])
    } catch (err) {
      console.error(err)
      toast.error('Failed to add candidate')
    }
  }

  // LOGIC

  const activeCandidates = allCandidates.filter(c =>
    c.stage !== 'rejected' &&
    c.stage !== 'drop-off' &&
    c.stage !== 'archived'
  )

  const filteredCandidates = activeCandidates.filter(candidate => {
    const q = searchQuery.toLowerCase()

    const matchesBasic =
      (candidate.name?.toLowerCase() || '').includes(q) ||
      (candidate.position?.toLowerCase() || '').includes(q) ||
      (candidate.email?.toLowerCase() || '').includes(q)

    const detectedSkills: string[] =
      (candidate as any)?.resumeAnalysis?.skills ?? []

    const matchesSkills = detectedSkills.some(skill =>
      skill.toLowerCase().includes(q)
    )

    const matchesStage =
      stageFilter === 'all' || candidate.stage === stageFilter

    return (matchesBasic || matchesSkills) && matchesStage
  })

  const sortedCandidates = [...filteredCandidates].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return (a.name || '').localeCompare(b.name || '')
      case 'match':
        return (b.matchScore || 0) - (a.matchScore || 0)
      default:
        return new Date(b.appliedDate).getTime() - new Date(a.appliedDate).getTime()
    }
  })

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'hired': return 'bg-green-100 text-green-800'
      case 'interview': return 'bg-purple-100 text-purple-800'
      case 'final': return 'bg-orange-100 text-orange-800'
      case 'screening': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-blue-100 text-blue-800'
    }
  }

  return {
    loading,
    candidates: sortedCandidates,

    searchQuery,
    setSearchQuery,

    stageFilter,
    setStageFilter,

    sortBy,
    setSortBy,

    addCandidate,
    getStageColor
  }
}