import { useState, useEffect } from 'react';

const STORAGE_KEY = 'queryHistory';
const MAX_HISTORY_ITEMS = 25;

const useQueryHistory = () => {
    const [history, setHistory] = useState([]);

    // Load history from localStorage on mount
    useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                setHistory(Array.isArray(parsed) ? parsed : []);
            }
        } catch (error) {
            console.error('Failed to load query history:', error);
            setHistory([]);
        }
    }, []);

    // Save history to localStorage whenever it changes
    const saveToStorage = (newHistory) => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(newHistory));
        } catch (error) {
            console.error('Failed to save query history:', error);
        }
    };

    // Add a query to history (with deduplication)
    const addQuery = (query, limit = 10000) => {
        if (!query || query.trim() === '') return;

        const trimmedQuery = query.trim();

        setHistory(prevHistory => {
            // Remove duplicate if exists (same query text)
            const filtered = prevHistory.filter(item => item.query !== trimmedQuery);

            // Create new entry
            const newEntry = {
                id: Date.now(),
                query: trimmedQuery,
                executedAt: Date.now(),
                limit
            };

            // Add to front and limit to MAX_HISTORY_ITEMS
            const newHistory = [newEntry, ...filtered].slice(0, MAX_HISTORY_ITEMS);

            saveToStorage(newHistory);
            return newHistory;
        });
    };

    // Clear all history
    const clearHistory = () => {
        setHistory([]);
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch (error) {
            console.error('Failed to clear query history:', error);
        }
    };

    // Remove a single query by id
    const removeQuery = (id) => {
        setHistory(prevHistory => {
            const newHistory = prevHistory.filter(item => item.id !== id);
            saveToStorage(newHistory);
            return newHistory;
        });
    };

    return {
        history,
        addQuery,
        clearHistory,
        removeQuery
    };
};

export default useQueryHistory;
