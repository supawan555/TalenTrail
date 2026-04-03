// hooks/useNotes.ts

import { useState, useEffect, useMemo } from 'react';
import api from '../lib/api';
import { toast } from 'sonner';

export const useNotes = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [newNote, setNewNote] = useState('');
    const [selectedCandidate, setSelectedCandidate] = useState('');
    const [noteTag, setNoteTag] = useState('');
    const [customTag, setCustomTag] = useState('');
    const [showCustomInput, setShowCustomInput] = useState(false);
    const [candidates, setCandidates] = useState<any[]>([]);
    const [candidateInputValue, setCandidateInputValue] = useState('');
    const [candidateDropdownOpen, setCandidateDropdownOpen] = useState(false);
    const [allNotes, setAllNotes] = useState<any[]>([]);
    const [notePendingDelete, setNotePendingDelete] = useState<any | null>(null);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    // ===== load =====
    useEffect(() => {
        let ignore = false;

        const load = async () => {
            try {
                const [candRes, notesRes] = await Promise.all([
                    api.get('/candidates'),
                    api.get('/notes'),
                ]);

                if (!ignore) {
                    const candList = Array.isArray(candRes.data) ? candRes.data : [];
                    setCandidates(candList);

                    const notes = Array.isArray(notesRes.data) ? notesRes.data : [];

                    const notesWithCand = notes.map((n) => {
                        const cand = candList.find(c => c.id === n.candidate_id);
                        return {
                            ...n,
                            candidateName: cand?.name,
                            candidatePosition: cand?.position,
                        };
                    });

                    setAllNotes(notesWithCand);
                }
            } catch {
                console.error('load failed');
            }
        };

        load();
        return () => { ignore = true; };
    }, []);

    // ===== computed =====
    const filteredNotes = useMemo(() => {
        return allNotes.filter(note => {
            const matchesSearch =
                note.content.toLowerCase().includes(searchQuery.toLowerCase());

            const matchesType =
                typeFilter === 'all' || note.type === typeFilter;

            return matchesSearch && matchesType;
        });
    }, [allNotes, searchQuery, typeFilter]);

    const candidateSuggestions = useMemo(() => {
        const term = candidateInputValue.toLowerCase();
        return candidates.filter(c =>
            c.name.toLowerCase().includes(term)
        );
    }, [candidates, candidateInputValue]);

    const finalTag = showCustomInput ? customTag : noteTag;

    // ===== actions =====
    const handleAddNote = async () => {
        if (!newNote.trim() || !selectedCandidate || !finalTag.trim()) return;

        try {
            const res = await api.post('/notes', null, {
                params: {
                    candidate_id: selectedCandidate,
                    content: newNote,
                    type: finalTag
                }
            });

            setAllNotes(prev => [res.data, ...prev]);
            setNewNote('');
        } catch {
            toast.error('add note failed');
        }
    };

    const handleConfirmDelete = async () => {
        if (!notePendingDelete) return;
        setDeletingNoteId(notePendingDelete.id);
        setDeleteError(null);
        try {
            await api.delete(`/notes/${notePendingDelete.id}`);
            setAllNotes(prev => prev.filter(n => n.id !== notePendingDelete.id));
            toast.success('Note deleted successfully');
            setDeleteDialogOpen(false);
            setNotePendingDelete(null);
        } catch (error) {
            const message = (error as any)?.response?.data?.detail || (error as any)?.response?.data?.message || 'Failed to delete note';
            setDeleteError(message);
            toast.error(message);
        } finally {
            setDeletingNoteId(null);
        }
    };

    return {
        // state
        searchQuery,
        setSearchQuery,
        typeFilter,
        setTypeFilter,
        newNote,
        setNewNote,
        selectedCandidate,
        setSelectedCandidate,
        noteTag,
        setNoteTag,
        customTag,
        setCustomTag,
        showCustomInput,
        setShowCustomInput,
        candidates,
        candidateInputValue,
        setCandidateInputValue,
        candidateDropdownOpen,
        setCandidateDropdownOpen,
        allNotes,
        setAllNotes,
        notePendingDelete,
        setNotePendingDelete,
        deleteDialogOpen,
        setDeleteDialogOpen,
        deletingNoteId,
        setDeletingNoteId,
        deleteError,
        setDeleteError,

        // computed
        filteredNotes,
        candidateSuggestions,
        finalTag,

        // actions
        handleAddNote,
        handleConfirmDelete
    };
};