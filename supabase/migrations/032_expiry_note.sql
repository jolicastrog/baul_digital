-- Nota de vencimiento: campo libre para recordatorios asociados a la fecha de caducidad
-- Solo visible/editable para usuarios premium y enterprise (restricción aplicada en app)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS expiry_note TEXT;
