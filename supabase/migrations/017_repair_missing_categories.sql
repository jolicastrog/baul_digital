-- ============================================================================
-- MIGRACIÓN 017: Crear categorías por defecto para usuarios sin ellas
--
-- Contexto: El trigger handle_new_user tenía un bloque BEGIN...EXCEPTION
-- único que agrupaba el INSERT de profiles y el PERFORM create_default_categories.
-- Si create_default_categories fallaba, el rollback del savepoint revertía
-- también el INSERT del perfil. Migration 016 corrigió el trigger, pero
-- los usuarios ya registrados (y reparados por migration 013/014) quedaron
-- sin sus categorías por defecto.
-- ============================================================================

DO $$
DECLARE
  v_rec       RECORD;
  v_creados   INT := 0;
  v_omitidos  INT := 0;
BEGIN
  FOR v_rec IN
    SELECT p.id, p.email
    FROM public.profiles p
    WHERE NOT EXISTS (
      SELECT 1 FROM public.categories c WHERE c.user_id = p.id
    )
  LOOP
    BEGIN
      PERFORM public.create_default_categories(v_rec.id);
      v_creados := v_creados + 1;
      RAISE NOTICE 'Categorías creadas para: %', v_rec.email;
    EXCEPTION WHEN OTHERS THEN
      v_omitidos := v_omitidos + 1;
      RAISE WARNING 'No se pudieron crear categorías para %: [%] %',
        v_rec.email, SQLSTATE, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE '=== Resultado: % usuario(s) con categorías creadas, % omitido(s) ===',
    v_creados, v_omitidos;
END $$;


-- Verificación final: usuarios con sus categorías
SELECT
  p.email,
  COUNT(c.id) AS total_categorias
FROM public.profiles p
LEFT JOIN public.categories c ON c.user_id = p.id
GROUP BY p.email
ORDER BY p.email;
