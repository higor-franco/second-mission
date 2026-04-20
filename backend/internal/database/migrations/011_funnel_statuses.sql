-- 011_funnel_statuses.sql
-- Extend the veteran_applications status enum with two new stages used by
-- the employer-facing hiring funnel: proposal_sent (offer extended) and
-- contract_signed (contract signed, awaiting start).
--
-- Full progression is now:
--   matched -> interested -> introduced -> interviewing
--     -> proposal_sent -> contract_signed -> placed
--
-- The employer funnel groups these into 5 UX buckets:
--   Match     = matched + interested
--   Interview = introduced + interviewing
--   Proposal  = proposal_sent
--   Contract  = contract_signed
--   End       = placed
--
-- The veteran-side UX keeps seeing interested/introduced/interviewing/placed;
-- the two new stages are driven by the employer side only.

-- Drop the old CHECK constraint and re-add it with the expanded set.
-- Name pattern is Postgres's default: <table>_<column>_check.
ALTER TABLE veteran_applications
    DROP CONSTRAINT IF EXISTS veteran_applications_status_check;

ALTER TABLE veteran_applications
    ADD CONSTRAINT veteran_applications_status_check
    CHECK (status IN (
        'matched',
        'interested',
        'introduced',
        'interviewing',
        'proposal_sent',
        'contract_signed',
        'placed'
    ));
