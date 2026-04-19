-- ============================================================================
-- MIGRACIÓN 027: Mover documentos entre categorías
--
-- Objetivo:
--   Permitir mover documentos entre categorías del mismo usuario, con
--   protección de integridad referencial cross-user.
--
-- Cambios:
--   1. Trigger validate_category_ownership — BEFORE INSERT OR UPDATE en documents:
--      impide asignar una categoría que no pertenezca al mismo usuario.
--   2. Función move_document_to_category — mueve un documento individual.
--   3. Función move_category_documents — mueve todos los docs de una categoría.
-- ============================================================================


-- ── 1. Trigger validate_category_ownership ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.validate_category_ownership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.category_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.categories
      WHERE id = NEW.category_id AND user_id = NEW.user_id
    ) THEN
      RAISE EXCEPTION 'CATEGORY_OWNERSHIP_VIOLATION: La categoría no pertenece al usuario del documento.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_category_ownership ON public.documents;

CREATE TRIGGER trg_validate_category_ownership
  BEFORE INSERT OR UPDATE OF category_id ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.validate_category_ownership();


-- ── 2. Función move_document_to_category ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.move_document_to_category(
  p_document_id    UUID,
  p_user_id        UUID,
  p_new_category_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.documents WHERE id = p_document_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'DOCUMENT_NOT_FOUND: Documento no encontrado o acceso denegado.';
  END IF;

  IF p_new_category_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.categories WHERE id = p_new_category_id AND user_id = p_user_id
    ) THEN
      RAISE EXCEPTION 'CATEGORY_OWNERSHIP_VIOLATION: La categoría destino no pertenece al usuario.';
    END IF;
  END IF;

  UPDATE public.documents
  SET category_id = p_new_category_id, updated_at = NOW()
  WHERE id = p_document_id AND user_id = p_user_id;

  INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, details)
  VALUES (
    p_user_id, 'DOCUMENT_MOVED', 'document', p_document_id,
    jsonb_build_object(
      'document_id',     p_document_id,
      'new_category_id', p_new_category_id
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.move_document_to_category FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.move_document_to_category TO service_role;


-- ── 3. Función move_category_documents ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.move_category_documents(
  p_from_category_id UUID,
  p_to_category_id   UUID,
  p_user_id          UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.categories WHERE id = p_from_category_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'CATEGORY_NOT_FOUND: Categoría origen no encontrada.';
  END IF;

  IF p_to_category_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.categories WHERE id = p_to_category_id AND user_id = p_user_id
    ) THEN
      RAISE EXCEPTION 'CATEGORY_OWNERSHIP_VIOLATION: La categoría destino no pertenece al usuario.';
    END IF;
  END IF;

  UPDATE public.documents
  SET category_id = p_to_category_id, updated_at = NOW()
  WHERE category_id = p_from_category_id AND user_id = p_user_id;

  INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, details)
  VALUES (
    p_user_id, 'CATEGORY_DOCUMENTS_MOVED', 'category', p_from_category_id,
    jsonb_build_object(
      'from_category_id', p_from_category_id,
      'to_category_id',   p_to_category_id,
      'moved_count',      (SELECT COUNT(*) FROM public.documents
                           WHERE category_id = p_to_category_id AND user_id = p_user_id)
    )
  );

  RETURN (SELECT COUNT(*)::integer FROM public.documents
          WHERE category_id = p_to_category_id AND user_id = p_user_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.move_category_documents FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.move_category_documents TO service_role;


-- ── 4. Verificación ──────────────────────────────────────────────────────────
SELECT 'Migración 027 aplicada correctamente' AS resultado;
