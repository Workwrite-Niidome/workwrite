-- Fix: Letters that were paid (paymentId exists) but stuck with moderationStatus='pending'
-- should be 'approved' since payment completion = delivery approved.
UPDATE "Letter" SET "moderationStatus" = 'approved' WHERE "paymentId" IS NOT NULL AND "moderationStatus" = 'pending';
