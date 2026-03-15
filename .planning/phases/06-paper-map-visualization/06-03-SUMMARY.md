---
phase: 06-paper-map-visualization
plan: 03
status: completed
commit: feat(06-03): add filtering, export, and reading list management
requirements_met: [PMAP-05, PMAP-09, PMAP-10]
---

# Plan 06-03 Summary: Filtering, Export, and Reading List Management

## What was built

### Backend: Reading List CRUD

- **ReadingList model** (`backend/app/models/reading_list.py`): SQLAlchemy model with `id`, `user_id`, `name`, `description`, `paper_ids` (JSON array), timestamps. Indexed on `user_id`.
- **Schemas** (`backend/app/schemas/reading_list.py`): Pydantic schemas for Create, Update, Response, AddPaper, RemovePaper operations.
- **Router** (`backend/app/routers/reading_lists.py`): 7 endpoints with ownership verification:
  - `POST /api/reading-lists` -- create list
  - `GET /api/reading-lists` -- list user's lists (paginated)
  - `GET /api/reading-lists/{id}` -- get single list
  - `PUT /api/reading-lists/{id}` -- update list
  - `DELETE /api/reading-lists/{id}` -- delete list
  - `POST /api/reading-lists/{id}/papers` -- add paper (deduplicates)
  - `DELETE /api/reading-lists/{id}/papers/{paper_id}` -- remove paper
- **Migration** (`backend/alembic/versions/008_create_reading_lists_table.py`): Creates `reading_lists` table with user_id index.
- All mutations use immutable patterns (new list objects, never in-place mutation).

### Frontend: Filter Bar

- **FilterBar** (`apps/web/src/components/paper-map/shared/FilterBar.tsx`): Horizontal bar with:
  - Year range inputs (from/to number fields, clear button)
  - Quality threshold slider (0-100%)
  - Method type multi-select (pill buttons derived from node data)
- Reads/writes Zustand store via `usePaperMapStore.setFilters`
- Changes propagate instantly to all views via `useFilteredData` hook

### Frontend: Export Menu

- **ExportMenu** (`apps/web/src/components/paper-map/shared/ExportMenu.tsx`): Dropdown with three options:
  - **JSON**: Full graph data (nodes + edges) as timestamped JSON file
  - **CSV**: Paper metadata table (paper_id, title, year, citations, quality, cluster)
  - **PNG**: Screenshot via `html-to-image` `toPng` on graph container ref
- All export functions are pure (read data, produce output, trigger download)

### Frontend: Reading List Drawer

- **ReadingListDrawer** (`apps/web/src/components/paper-map/shared/ReadingListDrawer.tsx`): Slide-out panel (right side, 320px) with:
  - List of user's reading lists with paper counts
  - Inline "New List" creation form
  - "Add to list" button when a paper is selected
  - Expandable paper lists with remove buttons
- **useReadingLists** hook (`apps/web/src/components/paper-map/hooks/useReadingLists.ts`): Encapsulates all API calls with auto-refresh on mutation.

### Integration

- **MapView** updated with FilterBar above tabs, ExportMenu + reading list toggle in toolbar, ReadingListDrawer overlay.
- **i18n** messages added for both zh-CN and en locales (filter, export, readingList namespaces).

## Files created

| File | Lines | Purpose |
|------|-------|---------|
| `backend/app/models/reading_list.py` | 41 | SQLAlchemy model |
| `backend/app/schemas/reading_list.py` | 47 | Pydantic schemas |
| `backend/app/routers/reading_lists.py` | 221 | CRUD + paper endpoints |
| `backend/alembic/versions/008_create_reading_lists_table.py` | 42 | Migration |
| `apps/web/src/components/paper-map/shared/FilterBar.tsx` | 162 | Filter controls |
| `apps/web/src/components/paper-map/shared/ExportMenu.tsx` | 172 | Export dropdown |
| `apps/web/src/components/paper-map/shared/ReadingListDrawer.tsx` | 253 | Reading list management |
| `apps/web/src/components/paper-map/hooks/useReadingLists.ts` | 161 | API hook |

## Files modified

| File | Change |
|------|--------|
| `apps/web/src/components/paper-map/MapView.tsx` | Integrated FilterBar, ExportMenu, ReadingListDrawer |
| `apps/web/messages/zh-CN.json` | Added filter/export/readingList keys |
| `apps/web/messages/en.json` | Added filter/export/readingList keys |
| `backend/app/main.py` | Registered reading_lists_router |
| `backend/app/models/__init__.py` | Added ReadingList import |

## Verification

- Backend imports verified: `from app.models.reading_list import ReadingList` succeeds
- All 13 files committed successfully
- TypeScript compilation not verified due to tooling access (recommend running `cd apps/web && npx tsc --noEmit`)

## Key patterns

- **Zustand store drives filtering**: FilterBar writes to store, useFilteredData reads from store, all views consume filtered data
- **Immutable CRUD**: Backend reading list mutations create new list objects, frontend hook triggers full re-fetch
- **Pure export functions**: No side effects on app state, just data transformation and download
- **Ownership-gated endpoints**: All reading list endpoints verify `user_id` match, return 404 for non-owners
