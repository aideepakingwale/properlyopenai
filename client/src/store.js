import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAppStore = create(
  persist(
    (set) => ({
      child: null,
      story: null,
      session: null,
      lastRewards: null,
      feedback: null,
      setChild: (child) => set({ child }),
      setStory: (story) => set({ story }),
      setSession: (session) => set({ session }),
      setLastRewards: (lastRewards) => set({ lastRewards }),
      setFeedback: (feedback) => set({ feedback }),
      clearSession: () => set({ story: null, session: null, feedback: null }),
    }),
    {
      name: 'properly-app',
      // Keep active reading session so refresh does not lose sentences
      partialize: (s) => ({ child: s.child, story: s.story, session: s.session }),
    },
  ),
);
