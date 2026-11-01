#!/usr/bin/env bash
# Teste la logique SQL des générations (supabase/tests/quotas_generation.test.sql)
# sur une base PostgreSQL jetable : il faut PostgreSQL 15+ installé (psql, initdb).
#   bash tools/test-quotas.sh
set -euo pipefail
cd "$(dirname "$0")/.."
BIN=$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -n 1 || true)
[ -n "$BIN" ] || { echo "PostgreSQL introuvable (initdb)."; exit 1; }
D=$(mktemp -d /var/tmp/dk-quotas.XXXXXX)
chmod 755 "$D"
RUN=(); [ "$(id -u)" = 0 ] && { id postgres >/dev/null 2>&1 || { echo "Lance ce script sans être root, ou crée l'utilisateur postgres."; exit 1; }; chown postgres "$D"; RUN=(su postgres -c); }
sh_() { if [ ${#RUN[@]} -gt 0 ]; then "${RUN[@]}" "$1"; else bash -c "$1"; fi; }
trap 'sh_ "$BIN/pg_ctl -D $D/data -m immediate stop >/dev/null 2>&1" || true; rm -rf "$D"' EXIT
sh_ "$BIN/initdb -D $D/data -A trust >/dev/null && $BIN/pg_ctl -D $D/data -o '-p 5445 -k $D' -l $D/log -w start >/dev/null"
P=(psql -h "$D" -p 5445 -U postgres -v ON_ERROR_STOP=1 -q)
"${P[@]}" -c "create database t" >/dev/null
"${P[@]}" -d t -f supabase/tests/quotas_generation.stub.sql
"${P[@]}" -d t -c "create trigger garments_plan_limit before insert on public.garments for each row execute function public.garments_plan_limit(); create trigger ai_jobs_plan_limit before insert on public.ai_jobs for each row execute function public.ai_jobs_plan_limit();"
"${P[@]}" -d t -f supabase/migrations/20261101165217_quotas_generation.sql
"${P[@]}" -d t -f supabase/migrations/20261101173035_compte_createur.sql
"${P[@]}" -d t -f supabase/tests/quotas_generation.test.sql 2>&1 | grep -E "NOTICE|ERROR|ECHEC" | sed 's/^psql:[^ ]* NOTICE:  //; s/^NOTICE:  //'
echo "tout est bon"
