-- =====================================================
-- FIX FOR DAILY EXPENSE NOTEPAD
-- Run this in Supabase SQL Editor if you already created the database
-- =====================================================

-- Drop the old table if it exists with wrong structure
DROP TABLE IF EXISTS public.daily_expense_notes CASCADE;

-- Create the correct table structure
CREATE TABLE public.daily_expense_notes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    resort_id uuid NOT NULL REFERENCES public.resorts(id) ON DELETE CASCADE,
    note_date date NOT NULL,
    description text NOT NULL,
    amount numeric(12,2) NOT NULL CHECK(amount > 0),
    category text NOT NULL,
    payment_method text NOT NULL DEFAULT 'Cash' CHECK(payment_method IN ('Cash', 'UPI', 'Bank')),
    notes text NOT NULL DEFAULT '',
    converted_expense_id uuid REFERENCES public.expenses(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX daily_expense_notes_date ON public.daily_expense_notes(resort_id, note_date);
CREATE INDEX daily_expense_notes_converted ON public.daily_expense_notes(converted_expense_id) WHERE converted_expense_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_expense_notes TO authenticated;
GRANT ALL ON public.daily_expense_notes TO service_role;
ALTER TABLE public.daily_expense_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expense_notes_owner" ON public.daily_expense_notes 
    FOR ALL TO authenticated 
    USING (public.owns_resort(resort_id)) 
    WITH CHECK (public.owns_resort(resort_id));

-- Create the convert_expense_note function (simplified - uses payment method from note)
CREATE OR REPLACE FUNCTION public.convert_expense_note(
    note_id uuid,
    method text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    expense_id uuid;
    note_record RECORD;
BEGIN
    -- Get the note and verify ownership
    SELECT * INTO note_record
    FROM public.daily_expense_notes
    WHERE id = note_id
    AND converted_expense_id IS NULL;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Note not found or already converted';
    END IF;
    
    IF NOT public.owns_resort(note_record.resort_id) THEN
        RAISE EXCEPTION 'Not permitted';
    END IF;
    
    -- Check if already converted (race condition check)
    IF note_record.converted_expense_id IS NOT NULL THEN
        RETURN note_record.converted_expense_id;
    END IF;
    
    -- Create expense from note (using payment_method from note, not the method parameter)
    INSERT INTO public.expenses(
        resort_id,
        expense_date,
        expense_name,
        category,
        amount,
        payment_method,
        notes
    ) VALUES (
        note_record.resort_id,
        note_record.note_date,
        note_record.description,
        note_record.category,
        note_record.amount,
        note_record.payment_method,
        note_record.notes
    ) RETURNING id INTO expense_id;
    
    -- Mark note as converted
    UPDATE public.daily_expense_notes
    SET converted_expense_id = expense_id,
        updated_at = now()
    WHERE id = note_id
    AND converted_expense_id IS NULL;
    
    RETURN expense_id;
END;
$$;

REVOKE ALL ON FUNCTION public.convert_expense_note(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.convert_expense_note(uuid, text) TO authenticated;

-- =====================================================
-- DONE! Daily Expense Notepad should now work
-- =====================================================
