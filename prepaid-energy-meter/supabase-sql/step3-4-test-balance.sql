-- STEP 3 / SQL 4 (optional): give meter-001 a test balance of 500 INR.
-- Why: process_reading takes money off the balance and may cut the relay at
-- the minimum balance. With balance 0 you would see that straight away.
-- This is a direct test-only edit (it skips the ledger). Real recharges come in Step 4.

update public.meters set balance = 500.00 where device_id = 'meter-001';
