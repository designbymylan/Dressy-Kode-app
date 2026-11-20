#!/usr/bin/env bash
# Essaie la migration des notifications push (supabase/tests/dessin_a_refaire.test.sql)
# sur une base PostgreSQL jetable : il faut PostgreSQL 15+ installé (psql, initdb).
#   bash tools/test-dessin-a-refaire.sh
set -euo pipefail
cd "$(dirname "$0")/.."
BIN=$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -n 1 || true)
[ -n "$BIN" ] || { echo "PostgreSQL introuvable (initdb)."; exit 1; }
D=$(mktemp -d /var/tmp/dk-dessin.XXXXXX)
chmod 755 "$D"
RUN=(); [ "$(id -u)" = 0 ] && { id postgres >/dev/null 2>&1 || { echo "Lance ce script sans être root, ou crée l'utilisateur postgres."; exit 1; }; chown postgres "$D"; RUN=(su postgres -c); }
sh_() { if [ ${#RUN[@]} -gt 0 ]; then "${RUN[@]}" "$1"; else bash -c "$1"; fi; }
trap 'sh_ "$BIN/pg_ctl -D $D/data -m immediate stop >/dev/null 2>&1" || true; rm -rf "$D"' EXIT
sh_ "$BIN/initdb -D $D/data -A trust >/dev/null && $BIN/pg_ctl -D $D/data -o '-p 5446 -k $D' -l $D/log -w start >/dev/null"
P=(psql -h "$D" -p 5446 -U postgres -v ON_ERROR_STOP=1 -q)
"${P[@]}" -c "create database t" >/dev/null
"${P[@]}" -d t -f supabase/tests/notifications_push.stub.sql
"${P[@]}" -d t -f supabase/migrations/20261118190717_notifications_push.sql
"${P[@]}" -d t -f supabase/tests/dessin_a_refaire.stub.sql
"${P[@]}" -d t -f supabase/tests/dessin_a_refaire.prelude.sql
"${P[@]}" -d t -f supabase/migrations/20261120120000_dessin_a_refaire.sql
"${P[@]}" -d t -f supabase/tests/dessin_a_refaire.test.sql 2>&1 | grep -E "NOTICE|ERROR|ECHEC" | sed 's/^psql:[^ ]* NOTICE:  //; s/^NOTICE:  //'
echo "tout est bon"
