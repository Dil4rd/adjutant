// Sample roadmap used only by the tests.
//
// The app itself ships with no predefined projects — a fresh browser starts
// empty — so this lives here rather than in src/, where it would be dead
// weight in the bundle. The content is deliberately generic: no real project,
// person, vendor or client appears in this repository.

import { normalizeTask } from '../src/lib/roadmap/model'
import type { Task } from '../src/lib/roadmap/types'

/**
 * Eight stages in four pairs: each delivery stage shadowed by an oversight
 * stage owned by the other side. Shapes every case the tests need — both
 * ownership values, two intensities, multi-week spans, and a month boundary.
 */
export function sampleTasks(): Task[] {
  return [
    { id: 'sample-01a', project: 'Example Programme', stage: 'Stage 1: Baseline & Testing', executor: 'Core Team',
      startDate: '2026-10-19', endDate: '2026-10-28', status: 'intensive', isMyTeam: true, color: '#8b5cf6',
      comments: 'Establish the baseline, run internal testing, and scope the wider pilot group.' },
    { id: 'sample-01b', project: 'Example Programme', stage: 'Stage 1: Policy & Testing Support', executor: 'Partner Team',
      startDate: '2026-10-19', endDate: '2026-10-28', status: 'intensive', isMyTeam: false, color: '#64748b',
      comments: 'Answer technical queries, draft policies, and assist with testing.' },
    { id: 'sample-02a', project: 'Example Programme', stage: 'Stage 2: Wider Pilot', executor: 'Partner Team',
      startDate: '2026-10-29', endDate: '2026-11-30', status: 'intensive', isMyTeam: false, color: '#64748b',
      comments: 'Validate the baseline across a wider group and define the next cohort.' },
    { id: 'sample-02b', project: 'Example Programme', stage: 'Stage 2: Pilot Oversight', executor: 'Core Team',
      startDate: '2026-10-29', endDate: '2026-11-30', status: 'background', isMyTeam: true, color: '#8b5cf6',
      comments: 'Low-intensity support and coordination during the wider pilot.' },
    { id: 'sample-03a', project: 'Example Programme', stage: 'Stage 3: Cohort Onboarding', executor: 'Partner Team',
      startDate: '2026-12-14', endDate: '2027-01-08', status: 'intensive', isMyTeam: false, color: '#64748b',
      comments: 'Onboard the pilot cohort and define the full rollout groups.' },
    { id: 'sample-03b', project: 'Example Programme', stage: 'Stage 3: Escalation Support', executor: 'Core Team',
      startDate: '2026-12-14', endDate: '2027-01-08', status: 'background', isMyTeam: true, color: '#8b5cf6',
      comments: 'Low-intensity technical guidance and escalation cover for the cohort.' },
    { id: 'sample-04a', project: 'Example Programme', stage: 'Stage 4: Full Rollout', executor: 'Partner Team',
      startDate: '2027-01-11', endDate: '2027-02-26', status: 'intensive', isMyTeam: false, color: '#64748b',
      comments: 'Execute the rollout in phased deployment waves.' },
    { id: 'sample-04b', project: 'Example Programme', stage: 'Stage 4: Rollout Support', executor: 'Core Team',
      startDate: '2027-01-11', endDate: '2027-02-26', status: 'background', isMyTeam: true, color: '#8b5cf6',
      comments: 'Low-intensity steering and issue escalation during the rollout.' },
  ].map((t) => normalizeTask(t))
}

/** A single record in the canonical interchange shape. */
export const SAMPLE_RECORD: Task = {
  id: 'sample-01a',
  project: 'Example Programme',
  stage: 'Stage 1: Baseline & Testing',
  executor: 'Core Team',
  startDate: '2026-10-19',
  endDate: '2026-10-28',
  status: 'intensive',
  isMyTeam: true,
  color: '#8b5cf6',
  comments: 'Establish the baseline, run internal testing, and scope the wider pilot group.',
}
