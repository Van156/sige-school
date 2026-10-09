-- Hand-written. Closes the race of schedule_slot_check_teacher_sync (R3-002): the trigger read the
-- offering's teacher without locking it, so a slot insert with a null teacher could interleave
-- with the offering's null -> teacher update and both committed, leaving a slot without the
-- offering's teacher.
-- The offering row is now locked FOR KEY SHARE before its teacher is read. teacher_person_id is
-- part of a unique key (offering_organizationId_id_teacherPersonId_unique), so changing it takes
-- the row's FOR UPDATE lock, which conflicts with FOR KEY SHARE; non-key updates (hours) do not.
-- FOR SHARE would add nothing here and would needlessly block those. The two transactions then
-- serialise: either the insert waits for the update, re-reads the committed teacher and is
-- rejected, or the update waits for the insert to commit and its AFTER trigger fills the slot.
CREATE OR REPLACE FUNCTION "schedule_slot_check_teacher_sync"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
	offering_teacher text;
BEGIN
	IF NEW."teacher_person_id" IS NULL THEN
		SELECT o."teacher_person_id" INTO offering_teacher FROM "offering" o
		WHERE o."organization_id" = NEW."organization_id" AND o."id" = NEW."offering_id"
		FOR KEY SHARE;
		IF offering_teacher IS NOT NULL THEN
			RAISE EXCEPTION 'schedule_slot teacher must match the offering teacher'
				USING ERRCODE = '23514', CONSTRAINT = 'schedule_slot_teacher_sync_check', TABLE = 'schedule_slot';
		END IF;
	END IF;
	RETURN NEW;
END;
$$;
