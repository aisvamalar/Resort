-- =====================================================
-- RESORT LEDGER - COMPLETE DATABASE SETUP
-- Run this in Supabase Dashboard → SQL Editor
-- Copy and paste the entire script, then click "Run"
-- =====================================================

-- =====================================================
-- 1. PROFILES TABLE (User Information)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name text NOT NULL DEFAULT '',
    email text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_read" ON public.profiles 
    FOR SELECT TO authenticated 
    USING (id = auth.uid());

CREATE POLICY "profiles_update" ON public.profiles 
    FOR UPDATE TO authenticated 
    USING (id = auth.uid()) 
    WITH CHECK (id = auth.uid());

-- Trigger to auto-create profile when user signs up
CREATE OR REPLACE FUNCTION public.create_owner_profile() 
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public 
AS $$ 
BEGIN 
    INSERT INTO public.profiles(id, email, full_name) 
    VALUES(
        NEW.id,
        coalesce(NEW.email, ''),
        coalesce(NEW.raw_user_meta_data->>'full_name', '')
    ); 
    RETURN NEW; 
END; 
$$;

DROP TRIGGER IF EXISTS create_owner_profile ON auth.users;
CREATE TRIGGER create_owner_profile 
    AFTER INSERT ON auth.users 
    FOR EACH ROW 
    EXECUTE FUNCTION public.create_owner_profile();

-- =====================================================
-- 2. RESORTS TABLE (Resort Information)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.resorts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id uuid NOT NULL DEFAULT auth.uid(),
    resort_name text NOT NULL DEFAULT 'My Resort',
    contact_number text NOT NULL DEFAULT '',
    logo_url text NOT NULL DEFAULT '',
    currency text NOT NULL DEFAULT 'INR',
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(owner_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.resorts TO authenticated;
GRANT ALL ON public.resorts TO service_role;
ALTER TABLE public.resorts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "resort_owner" ON public.resorts 
    FOR ALL TO authenticated 
    USING (owner_id = auth.uid()) 
    WITH CHECK (owner_id = auth.uid());

-- Helper function to check resort ownership
CREATE OR REPLACE FUNCTION public.owns_resort(r uuid) 
RETURNS boolean 
LANGUAGE sql 
STABLE 
SECURITY DEFINER 
SET search_path = public 
AS $$ 
    SELECT EXISTS(
        SELECT 1 FROM public.resorts 
        WHERE id = r AND owner_id = auth.uid()
    ); 
$$;

-- =====================================================
-- 3. ROOMS TABLE (Room Inventory)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.rooms (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    resort_id uuid NOT NULL REFERENCES public.resorts(id) ON DELETE CASCADE,
    room_number text NOT NULL,
    room_name text NOT NULL DEFAULT '',
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(resort_id, room_number)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rooms TO authenticated;
GRANT ALL ON public.rooms TO service_role;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "room_owner" ON public.rooms 
    FOR ALL TO authenticated 
    USING (public.owns_resort(resort_id)) 
    WITH CHECK (public.owns_resort(resort_id));

-- =====================================================
-- 4. RESERVATIONS TABLE (Booking Records)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.reservations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    resort_id uuid NOT NULL REFERENCES public.resorts(id) ON DELETE CASCADE,
    booking_date date NOT NULL DEFAULT current_date,
    guest_name text NOT NULL,
    booking_type text NOT NULL CHECK(booking_type IN ('Single Room', 'Group Room')),
    booking_source text NOT NULL CHECK(booking_source IN ('OTA', 'Website', 'Walk-in')),
    ota_platform text NOT NULL DEFAULT '',
    ota_commission_type text NOT NULL DEFAULT 'Amount',
    ota_commission_value numeric(12,2) NOT NULL DEFAULT 0 CHECK(ota_commission_value >= 0),
    ota_notes text NOT NULL DEFAULT '',
    ota_payment_status text NOT NULL DEFAULT 'Pending',
    room_rent numeric(12,2) NOT NULL CHECK(room_rent >= 0),
    advance_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK(advance_amount >= 0),
    payment_method text NOT NULL DEFAULT 'Cash' CHECK(payment_method IN ('Cash', 'UPI', 'Bank')),
    check_in_date date NOT NULL,
    check_out_date date NOT NULL,
    status text NOT NULL DEFAULT 'Reserved' CHECK(status IN ('Reserved', 'Checked In', 'Checked Out', 'Cancelled')),
    notes text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CHECK(check_out_date > check_in_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reservations TO authenticated;
GRANT ALL ON public.reservations TO service_role;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reservation_owner" ON public.reservations 
    FOR ALL TO authenticated 
    USING (public.owns_resort(resort_id)) 
    WITH CHECK (public.owns_resort(resort_id));

DROP INDEX IF EXISTS reservations_dates;
CREATE INDEX reservations_dates ON public.reservations(resort_id, booking_date, check_in_date);

-- =====================================================
-- 5. RESERVATION_ROOMS TABLE (Links Reservations to Rooms)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.reservation_rooms (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_id uuid NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
    room_id uuid NOT NULL REFERENCES public.rooms(id),
    UNIQUE(reservation_id, room_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reservation_rooms TO authenticated;
GRANT ALL ON public.reservation_rooms TO service_role;
ALTER TABLE public.reservation_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reservation_room_owner" ON public.reservation_rooms 
    FOR ALL TO authenticated 
    USING (
        EXISTS(
            SELECT 1 FROM public.reservations r 
            WHERE r.id = reservation_id 
            AND public.owns_resort(r.resort_id)
        )
    ) 
    WITH CHECK (
        EXISTS(
            SELECT 1 FROM public.reservations r 
            JOIN public.rooms rm ON rm.resort_id = r.resort_id 
            WHERE r.id = reservation_id 
            AND rm.id = room_id 
            AND public.owns_resort(r.resort_id)
        )
    );

-- =====================================================
-- 6. PAYMENTS TABLE (Payment Transactions)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    resort_id uuid NOT NULL REFERENCES public.resorts(id) ON DELETE CASCADE,
    reservation_id uuid NOT NULL REFERENCES public.reservations(id) ON DELETE RESTRICT,
    payment_date date NOT NULL,
    amount numeric(12,2) NOT NULL CHECK(amount > 0),
    payment_method text NOT NULL CHECK(payment_method IN ('Cash', 'UPI', 'Bank')),
    payment_type text NOT NULL CHECK(payment_type IN ('Advance', 'Balance', 'Other')),
    notes text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_owner" ON public.payments 
    FOR ALL TO authenticated 
    USING (public.owns_resort(resort_id)) 
    WITH CHECK (
        public.owns_resort(resort_id) 
        AND EXISTS(
            SELECT 1 FROM public.reservations r 
            WHERE r.id = reservation_id 
            AND r.resort_id = payments.resort_id
        )
    );

DROP INDEX IF EXISTS payments_dates;
CREATE INDEX payments_dates ON public.payments(resort_id, payment_date);

-- =====================================================
-- 7. EXPENSES TABLE (Expense Records)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.expenses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    resort_id uuid NOT NULL REFERENCES public.resorts(id) ON DELETE CASCADE,
    expense_date date NOT NULL,
    expense_name text NOT NULL,
    category text NOT NULL,
    amount numeric(12,2) NOT NULL CHECK(amount > 0),
    payment_method text NOT NULL CHECK(payment_method IN ('Cash', 'UPI', 'Bank')),
    notes text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expense_owner" ON public.expenses 
    FOR ALL TO authenticated 
    USING (public.owns_resort(resort_id)) 
    WITH CHECK (public.owns_resort(resort_id));

DROP INDEX IF EXISTS expense_dates;
CREATE INDEX expense_dates ON public.expenses(resort_id, expense_date);

-- =====================================================
-- 8. CASH_CLOSINGS TABLE (Daily Cash Reconciliation)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.cash_closings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    resort_id uuid NOT NULL REFERENCES public.resorts(id) ON DELETE CASCADE,
    closing_date date NOT NULL,
    opening_cash numeric(12,2) NOT NULL DEFAULT 0 CHECK(opening_cash >= 0),
    cash_received numeric(12,2) NOT NULL DEFAULT 0,
    cash_expenses numeric(12,2) NOT NULL DEFAULT 0,
    expected_closing_cash numeric(12,2) NOT NULL DEFAULT 0,
    actual_closing_cash numeric(12,2) NOT NULL CHECK(actual_closing_cash >= 0),
    difference numeric(12,2) NOT NULL DEFAULT 0,
    notes text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(resort_id, closing_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cash_closings TO authenticated;
GRANT ALL ON public.cash_closings TO service_role;
ALTER TABLE public.cash_closings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "closing_owner" ON public.cash_closings 
    FOR ALL TO authenticated 
    USING (public.owns_resort(resort_id)) 
    WITH CHECK (public.owns_resort(resort_id));

-- Trigger to auto-calculate cash closing values
CREATE OR REPLACE FUNCTION public.calculate_closing() 
RETURNS trigger 
LANGUAGE plpgsql 
SET search_path = public 
AS $$ 
BEGIN 
    -- Calculate cash received from payments
    SELECT coalesce(sum(amount), 0) INTO NEW.cash_received 
    FROM public.payments 
    WHERE resort_id = NEW.resort_id 
    AND payment_date = NEW.closing_date 
    AND payment_method = 'Cash';
    
    -- Calculate cash expenses
    SELECT coalesce(sum(amount), 0) INTO NEW.cash_expenses 
    FROM public.expenses 
    WHERE resort_id = NEW.resort_id 
    AND expense_date = NEW.closing_date 
    AND payment_method = 'Cash';
    
    -- Calculate expected closing cash
    NEW.expected_closing_cash = NEW.opening_cash + NEW.cash_received - NEW.cash_expenses;
    
    -- Calculate difference
    NEW.difference = NEW.actual_closing_cash - NEW.expected_closing_cash;
    
    RETURN NEW; 
END; 
$$;

DROP TRIGGER IF EXISTS calculate_closing ON public.cash_closings;
CREATE TRIGGER calculate_closing 
    BEFORE INSERT OR UPDATE ON public.cash_closings 
    FOR EACH ROW 
    EXECUTE FUNCTION public.calculate_closing();

-- =====================================================
-- 9. DAILY_EXPENSE_NOTES TABLE (Daily Expense Notepad)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.daily_expense_notes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    resort_id uuid NOT NULL REFERENCES public.resorts(id) ON DELETE CASCADE,
    note_date date NOT NULL,
    content text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(resort_id, note_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_expense_notes TO authenticated;
GRANT ALL ON public.daily_expense_notes TO service_role;
ALTER TABLE public.daily_expense_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expense_notes_owner" ON public.daily_expense_notes 
    FOR ALL TO authenticated 
    USING (public.owns_resort(resort_id)) 
    WITH CHECK (public.owns_resort(resort_id));

-- =====================================================
-- 10. SAVE RESERVATION FUNCTION (Complex Booking Logic)
-- =====================================================
CREATE OR REPLACE FUNCTION public.save_reservation(
    payload jsonb, 
    room_ids uuid[], 
    record_id uuid DEFAULT NULL
) 
RETURNS uuid 
LANGUAGE plpgsql 
SECURITY INVOKER 
SET search_path = public 
AS $$ 
DECLARE 
    rid uuid; 
    resort uuid; 
    advance numeric; 
BEGIN 
    resort = (payload->>'resort_id')::uuid;
    
    -- Check if user owns the resort
    IF NOT public.owns_resort(resort) THEN 
        RAISE EXCEPTION 'Not permitted'; 
    END IF;
    
    -- Validate room selection
    IF array_length(room_ids, 1) IS NULL THEN 
        RAISE EXCEPTION 'Select at least one room'; 
    END IF;
    
    IF payload->>'booking_type' = 'Single Room' AND array_length(room_ids, 1) <> 1 THEN 
        RAISE EXCEPTION 'Single bookings require one room'; 
    END IF;
    
    -- Validate rooms belong to the resort
    IF EXISTS(
        SELECT 1 FROM unnest(room_ids) x 
        WHERE NOT EXISTS(
            SELECT 1 FROM public.rooms rm 
            WHERE rm.id = x AND rm.resort_id = resort
        )
    ) THEN 
        RAISE EXCEPTION 'Invalid room'; 
    END IF;
    
    advance = coalesce((payload->>'advance_amount')::numeric, 0);
    
    -- Create new reservation
    IF record_id IS NULL THEN 
        INSERT INTO public.reservations(
            resort_id, booking_date, guest_name, booking_type, booking_source,
            ota_platform, ota_commission_type, ota_commission_value, ota_notes, ota_payment_status,
            room_rent, advance_amount, payment_method, check_in_date, check_out_date, status, notes
        ) VALUES(
            resort,
            (payload->>'booking_date')::date,
            payload->>'guest_name',
            payload->>'booking_type',
            payload->>'booking_source',
            coalesce(payload->>'ota_platform', ''),
            coalesce(payload->>'ota_commission_type', 'Amount'),
            coalesce((payload->>'ota_commission_value')::numeric, 0),
            coalesce(payload->>'ota_notes', ''),
            coalesce(payload->>'ota_payment_status', 'Pending'),
            (payload->>'room_rent')::numeric,
            advance,
            payload->>'payment_method',
            (payload->>'check_in_date')::date,
            (payload->>'check_out_date')::date,
            payload->>'status',
            coalesce(payload->>'notes', '')
        ) RETURNING id INTO rid;
        
        -- Create advance payment if any
        IF advance > 0 THEN 
            INSERT INTO public.payments(
                resort_id, reservation_id, payment_date, amount, payment_method, payment_type
            ) VALUES(
                resort, rid, (payload->>'booking_date')::date, advance, payload->>'payment_method', 'Advance'
            ); 
        END IF;
        
    -- Update existing reservation
    ELSE 
        UPDATE public.reservations SET 
            booking_date = (payload->>'booking_date')::date,
            guest_name = payload->>'guest_name',
            booking_type = payload->>'booking_type',
            booking_source = payload->>'booking_source',
            ota_platform = coalesce(payload->>'ota_platform', ''),
            ota_commission_type = coalesce(payload->>'ota_commission_type', 'Amount'),
            ota_commission_value = coalesce((payload->>'ota_commission_value')::numeric, 0),
            ota_notes = coalesce(payload->>'ota_notes', ''),
            ota_payment_status = coalesce(payload->>'ota_payment_status', 'Pending'),
            room_rent = (payload->>'room_rent')::numeric,
            payment_method = payload->>'payment_method',
            check_in_date = (payload->>'check_in_date')::date,
            check_out_date = (payload->>'check_out_date')::date,
            status = payload->>'status',
            notes = coalesce(payload->>'notes', ''),
            updated_at = now() 
        WHERE id = record_id AND resort_id = resort 
        RETURNING id INTO rid;
        
        IF rid IS NULL THEN 
            RAISE EXCEPTION 'Reservation not found'; 
        END IF;
        
        -- Remove old room links
        DELETE FROM public.reservation_rooms WHERE reservation_id = rid;
    END IF;
    
    -- Link rooms to reservation
    INSERT INTO public.reservation_rooms(reservation_id, room_id) 
    SELECT rid, x FROM unnest(room_ids) x;
    
    RETURN rid; 
END; 
$$;

REVOKE ALL ON FUNCTION public.save_reservation(jsonb, uuid[], uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_reservation(jsonb, uuid[], uuid) TO authenticated;

-- =====================================================
-- 11. STORAGE BUCKET FOR RESORT LOGOS
-- =====================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('resort-logos', 'resort-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for resort logos
DO $$ 
BEGIN
    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Users can upload their own logos" ON storage.objects;
    DROP POLICY IF EXISTS "Users can update their own logos" ON storage.objects;
    DROP POLICY IF EXISTS "Users can delete their own logos" ON storage.objects;
    DROP POLICY IF EXISTS "Anyone can view logos" ON storage.objects;
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Users can upload their own logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'resort-logos');

CREATE POLICY "Users can update their own logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'resort-logos');

CREATE POLICY "Users can delete their own logos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'resort-logos');

CREATE POLICY "Anyone can view logos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'resort-logos');

-- =====================================================
-- SETUP COMPLETE!
-- =====================================================
-- Your database is now ready to use.
-- 
-- Next steps:
-- 1. Go to your app and sign up for a new account
-- 2. Your profile will be auto-created
-- 3. Start adding rooms, reservations, payments, and expenses
-- 4. All data is real and stored in Supabase!
-- 
-- To verify setup:
-- - Check Table Editor to see all 9 tables
-- - Check Authentication → Users after signing up
-- - Check Storage to see resort-logos bucket
-- =====================================================
