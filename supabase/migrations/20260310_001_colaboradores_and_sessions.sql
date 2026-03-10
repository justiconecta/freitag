-- Migration: Colaboradores + Sessions (Login Freitag)
-- Objetivo: Integrar autenticação externa Freitag com controle de sessão

-- ============================================================
-- 1. TABELA: colaboradores
-- Vínculo entre o ID do colaborador na Freitag e o Supabase Auth
-- ============================================================

CREATE TABLE IF NOT EXISTS colaboradores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  freitag_id TEXT NOT NULL UNIQUE,
  login TEXT NOT NULL UNIQUE,
  supabase_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  nome TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  primeiro_acesso_at TIMESTAMPTZ,
  ultimo_acesso_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_colaboradores_freitag_id ON colaboradores (freitag_id);
CREATE INDEX IF NOT EXISTS idx_colaboradores_login ON colaboradores (login);
CREATE INDEX IF NOT EXISTS idx_colaboradores_supabase_user ON colaboradores (supabase_user_id);

COMMENT ON TABLE colaboradores IS 'Mapeamento entre colaboradores Freitag e usuários Supabase Auth';
COMMENT ON COLUMN colaboradores.freitag_id IS 'ID retornado pela API Freitag em /integracao/justconecta/login.php';
COMMENT ON COLUMN colaboradores.login IS 'Username usado para autenticação na API Freitag';

-- ============================================================
-- 2. TABELA: sessions
-- Controle de sessão: login, logout, duração
-- ============================================================

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id UUID NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
  login_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  logout_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  ip_address TEXT,
  user_agent TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_colaborador ON sessions (colaborador_id);
CREATE INDEX IF NOT EXISTS idx_sessions_active ON sessions (active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_sessions_login_at ON sessions (login_at DESC);

COMMENT ON TABLE sessions IS 'Registro de sessões de acesso — rastreia tempo logado por colaborador';
COMMENT ON COLUMN sessions.duration_seconds IS 'Calculado automaticamente no logout: logout_at - login_at';

-- ============================================================
-- 3. TABELA: access_logs
-- Log de cada tentativa de login (sucesso ou falha)
-- ============================================================

CREATE TABLE IF NOT EXISTS access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id UUID REFERENCES colaboradores(id),
  freitag_id TEXT,
  login TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_access_logs_colaborador ON access_logs (colaborador_id);
CREATE INDEX IF NOT EXISTS idx_access_logs_created ON access_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_logs_success ON access_logs (success);

COMMENT ON TABLE access_logs IS 'Auditoria de tentativas de login — sucesso e falha';

-- ============================================================
-- 4. FUNÇÃO: encerrar sessão
-- Calcula duração automaticamente
-- ============================================================

CREATE OR REPLACE FUNCTION close_session(p_session_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE sessions
  SET
    logout_at = NOW(),
    active = false,
    duration_seconds = EXTRACT(EPOCH FROM (NOW() - login_at))::INTEGER
  WHERE id = p_session_id AND active = true;
END;
$$;

COMMENT ON FUNCTION close_session IS 'Encerra sessão ativa e calcula duração em segundos';

-- ============================================================
-- 5. TRIGGER: updated_at em colaboradores
-- ============================================================

CREATE OR REPLACE FUNCTION update_colaboradores_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_colaboradores_updated_at
  BEFORE UPDATE ON colaboradores
  FOR EACH ROW EXECUTE FUNCTION update_colaboradores_updated_at();

-- ============================================================
-- 6. RLS: access_logs e sessions (somente admin via service role)
-- ============================================================

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE colaboradores ENABLE ROW LEVEL SECURITY;

-- Colaboradores podem ver seu próprio registro
CREATE POLICY "Colaboradores can view own record"
  ON colaboradores FOR SELECT
  USING (supabase_user_id = auth.uid());

-- Sessions: colaborador pode ver suas próprias sessões
CREATE POLICY "Colaboradores can view own sessions"
  ON sessions FOR SELECT
  USING (
    colaborador_id IN (
      SELECT id FROM colaboradores WHERE supabase_user_id = auth.uid()
    )
  );

-- Access logs: somente service role (admin) pode acessar
-- Nenhuma policy para anon/authenticated = bloqueado por RLS
-- Acesso via service role key (bypassa RLS)
