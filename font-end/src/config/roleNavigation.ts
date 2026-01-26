// src/config/roleNavigation.ts
export const ROLE_NAVIGATION = {
  'hr-recruiter': [
    '/dashboard',
    '/archived-candidates',
    '/candidates',
    '/pipeline',
    '/notes',
    '/settings',
  ],
  'hiring-manager': [
    '/dashboard',
    '/candidates',
    '/notes',
    '/archived-candidates',
    '/job-descriptions',
    '/settings',
  ],
  'management': [
    '/dashboard',
    '/archived-candidates',
    '/candidates',
    '/analytics',
    '/settings',
  ],
  'ADMIN': [
    '/dashboard',
    '/archived-candidates',
    '/candidates',
    '/job-descriptions',
    '/pipeline',
    '/notes',
    '/analytics',
    '/settings',
  ],
} as const;
