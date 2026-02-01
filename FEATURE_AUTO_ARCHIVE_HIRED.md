# Auto-Archive Hired Candidates Feature

## Overview
This feature automatically moves candidates with 'Hired' status to the Archived section after they have been in the hired state for 7 days. This helps keep the recruitment pipeline clean and focused on active hiring activities.

## Implementation Details

### Backend

#### 1. Background Service (`app/services/auto_archive_hired.py`)
- **Function**: `auto_archive_hired_candidates()`
  - Runs daily via a background task
  - Finds candidates who have been hired for more than 7 days
  - Moves them to 'archived' stage while preserving their 'hired' status
  - Updates state history to track the transition
  - Adds archive reason: "Auto-archived after 7 days in hired status"

- **Configuration**:
  - `HIRED_ARCHIVE_DAYS = 7` - Number of days before auto-archiving

#### 2. Startup Registration (`app/main.py`)
- Registers the auto-archive background task on application startup
- Runs immediately on startup, then repeats every 24 hours

#### 3. Candidate Update Logic (`app/routers/candidates.py`)
- Enhanced to handle 'archived' stage properly
- Preserves existing status when moving to archived (allows hired status to be retained)
- Sets `archived_date` when manually or automatically archived

### Frontend

#### 1. Pipeline View (`font-end/src/components/pipeline.tsx`)
- Filters out candidates with `stage === 'archived'`
- Only shows active candidates in the pipeline
- Hired candidates automatically disappear from pipeline after 7 days

#### 2. Archived Candidates View (`font-end/src/components/archived-candidates.tsx`)
- Updated to display three types of archived candidates:
  - **Rejected**: Manually rejected candidates
  - **Drop-off**: Candidates who dropped out of the process
  - **Hired**: Candidates who were hired and auto-archived after 7 days

- Added "Hired" status filter option
- Updated status badge display to show green "Hired" badge for archived hired candidates
- Updated description to clarify hired candidates are auto-archived after 7 days

#### 3. Candidates List View (`font-end/src/components/candidates.tsx`)
- Filters out archived candidates to show only active ones

#### 4. Type Definitions (`font-end/src/lib/mock-data.ts`)
- Added 'archived' to the Candidate stage type definition

## How It Works

### Day 0: Candidate Gets Hired
1. HR/Recruiter moves candidate to "Hired" stage in pipeline
2. Backend sets:
   - `stage = "hired"`
   - `current_state = "hired"`
   - `status = "hired"`
   - `hired_at = <current timestamp>`

### Days 1-6: Visible in Pipeline
- Candidate remains visible in the "Hired" column of the pipeline
- No automatic actions taken

### Day 7+: Auto-Archive
1. Background task runs (every 24 hours)
2. Detects candidates where `hired_at` is older than 7 days
3. For each matching candidate:
   - Sets `stage = "archived"`
   - Sets `current_state = "archived"`
   - **Preserves** `status = "hired"` (important!)
   - Sets `archived_date = <current timestamp>`
   - Sets `archiveReason = "Auto-archived after 7 days in hired status"`
   - Updates state_history to close hired state and add archived state

### After Auto-Archive
- Candidate no longer appears in Pipeline view
- Candidate appears in Archived Candidates view with "Hired" status badge (green)
- Can be filtered using the "Hired" status filter
- Archive reason shows automatic archiving message

## Manual Operations

### Viewing Archived Hired Candidates
1. Navigate to "Archived Candidates" page
2. Use the Status filter and select "Hired"
3. All auto-archived hired candidates will be displayed

### Restoring a Hired Candidate
If a hired candidate needs to be brought back to the active pipeline:
1. Find them in Archived Candidates
2. Click "Restore" button
3. They will move back to "Applied" stage
4. Archive metadata is cleared
5. Can be moved back to "Hired" if needed

## Technical Notes

### Database Fields
- `stage`: Current pipeline stage (applied/screening/interview/final/hired/rejected/drop-off/archived)
- `current_state`: Mirrors stage, used for state tracking
- `status`: Business status (active/hired/inactive)
- `hired_at`: Timestamp when candidate was hired
- `archived_date`: Timestamp when candidate was archived
- `archiveReason`: Reason for archiving (manual or automatic)
- `state_history`: Array of state transitions with timestamps

### Key Design Decisions
1. **Preserved Status**: When auto-archiving hired candidates, we preserve `status = "hired"` to differentiate them from rejected/dropped candidates
2. **7-Day Window**: Chosen to give sufficient time for onboarding activities while keeping pipeline clean
3. **Daily Check**: Background task runs every 24 hours to balance resource usage with timely archiving
4. **Immediate Startup Run**: Ensures no candidates are missed if the server was down during their 7-day window

## Configuration

To change the auto-archive period, modify `HIRED_ARCHIVE_DAYS` in:
```python
# BackEnd/app/services/auto_archive_hired.py
HIRED_ARCHIVE_DAYS = 7  # Change this value as needed
```

Restart the backend server for changes to take effect.

## Analytics and Counters

### Hired Candidates Count
The system counts **all hired candidates** in analytics and metrics, including:
- Active candidates currently in the "Hired" stage
- Archived candidates who were hired and auto-archived after 7 days

This ensures accurate tracking of hiring performance over time.

### Implementation Details

**Backend** ([app/routers/dashboard.py](BackEnd/app/routers/dashboard.py)):
- `hired_this_month`: Counts all candidates with `hired_at` timestamp in current month, regardless of current stage
- `avg_time_to_hire`: Calculates average days from `applied_at` to `hired_at` for all hired candidates
- `applicationsByMonth`: Aggregates hires by month based on `hired_at` field

**Frontend** ([font-end/src/components/dashboard.tsx](font-end/src/components/dashboard.tsx)):
- Counts candidates with `stage='hired'` OR `(stage='archived' AND status='hired')`
- Displays total hired count in dashboard metrics

**Pipeline View** ([font-end/src/components/pipeline.tsx](font-end/src/components/pipeline.tsx)):
- "Hired" stage badge shows count of both active hired and archived hired candidates
- Provides accurate view of total hires while keeping pipeline clean

## Monitoring

Check server logs for auto-archive activity:
```
[Auto-Archive] Background task registered - will check every 24 hours
[Auto-Archive] Successfully archived 3 hired candidate(s) older than 7 days
[Auto-Archive] No hired candidates to archive (older than 7 days)
```

## Testing

To test the auto-archive feature:
1. Create a test candidate and mark as "Hired"
2. Manually update the `hired_at` field in MongoDB to 8 days ago:
   ```javascript
   db.candidates.updateOne(
     { _id: ObjectId("...") },
     { $set: { hired_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) } }
   )
   ```
3. Restart the backend server (triggers immediate check)
4. Verify candidate is moved to archived with status="hired"
5. Check frontend to confirm candidate appears in Archived Candidates with "Hired" badge
