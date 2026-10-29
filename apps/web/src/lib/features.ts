// Feature flags, fixed at build time (infra/deploy.sh). Off unless the build says "true".
// The dry-spell scenario (prototype): additive, off the demo path; flag it off if it misbehaves.
export const SCENARIO_ENABLED = import.meta.env.VITE_FEATURE_SCENARIO === 'true'
