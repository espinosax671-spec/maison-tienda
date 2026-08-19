-- ============================================================
-- SUPER ADMIN — MAISON
-- Panel global: lista TODAS las tiendas y permite
-- activar/desactivar (bloquear) cada una.
-- Ejecutar en Supabase → SQL Editor (rol postgres). Idempotente.
-- ============================================================

-- 1) Tabla de super admins ------------------------------------
CREATE TABLE IF NOT EXISTS public.admins (
  auth_user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  creado_en    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

-- 2) Funciones helper (security definer) ----------------------
CREATE OR REPLACE FUNCTION public.es_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admins WHERE auth_user_id = auth.uid()
  );
$$;

-- 3) RPC: listar todas las tiendas con su dueño ---------------
CREATE OR REPLACE FUNCTION public.obtener_tiendas()
RETURNS TABLE (
  id uuid,
  name text,
  slug text,
  active boolean,
  created_at timestamptz,
  owner_name text,
  owner_email text
)
LANGUAGE sql SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id,
    s.name,
    s.slug,
    s.active,
    s.created_at,
    p.full_name AS owner_name,
    u.email     AS owner_email
  FROM public.stores s
  LEFT JOIN public.staff_users su
    ON su.store_id = s.id
   AND su.role IN ('dueño', 'administrador')
  LEFT JOIN public.profiles p ON p.id = su.id
  LEFT JOIN auth.users u ON u.id = su.id
  ORDER BY s.created_at DESC;
$$;

-- 4) RPC: activar/desactivar una tienda -----------------------
CREATE OR REPLACE FUNCTION public.cambiar_estado_tienda(p_store_id uuid, p_active boolean)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.es_admin() THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  UPDATE public.stores
     SET active = p_active
   WHERE id = p_store_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tienda no encontrada';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.es_admin() FROM public;
GRANT EXECUTE ON FUNCTION public.es_admin() TO authenticated;

REVOKE ALL ON FUNCTION public.obtener_tiendas() FROM public;
GRANT EXECUTE ON FUNCTION public.obtener_tiendas() TO authenticated;

REVOKE ALL ON FUNCTION public.cambiar_estado_tienda(uuid, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.cambiar_estado_tienda(uuid, boolean) TO authenticated;

-- ============================================================
-- 5) REGISTRO DE TU CUENTA COMO SUPER ADMIN
-- PRIMERO averigua tu UID ejecutando:
--   SELECT id, email FROM auth.users;
-- Luego reemplaza el UUID de abajo por el tuyo.
-- ============================================================
INSERT INTO public.admins (auth_user_id)
VALUES ('REEMPLAZA_CON_TU_UUID')
ON CONFLICT (auth_user_id) DO NOTHING;

-- 6) Verificación ---------------------------------------------
SELECT proname AS funcion
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname IN ('es_admin','obtener_tiendas','cambiar_estado_tienda')
ORDER BY proname;
