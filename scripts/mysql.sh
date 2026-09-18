#!/usr/bin/env bash
# Manage the local MySQL 8.4 instance for the Biblioteka project.
# Runs as a plain user process: no Docker, no root, no systemd.
set -euo pipefail

ROOT="${MYSQL_HOME:-$HOME/.local/mysql-biblioteka}"
BASE="$ROOT/server"          # extracted MySQL distribution
DATA="$ROOT/data"            # datadir
CONF="$ROOT/my.cnf"
SOCK="$ROOT/mysql.sock"
PIDF="$ROOT/mysql.pid"
LOG="$DATA/error.log"
PORT="${MYSQL_PORT:-3306}"

die() { echo "ERROR: $*" >&2; exit 1; }

MYSQL_VERSION="${MYSQL_VERSION:-8.4.9}"
TARBALL="mysql-${MYSQL_VERSION}-linux-glibc2.28-x86_64-minimal.tar.xz"
URL="https://cdn.mysql.com/Downloads/MySQL-8.4/$TARBALL"

if [ "${1:-}" != "install" ] && [ "${1:-}" != "init" ]; then
  [ -x "$BASE/bin/mysqld" ] || die "MySQL not found at $BASE. Run: ./scripts/mysql.sh install"
fi

is_running() { [ -f "$PIDF" ] && kill -0 "$(cat "$PIDF")" 2>/dev/null; }

cmd_start() {
  if is_running; then echo "Already running (pid $(cat "$PIDF")) on port $PORT."; return 0; fi
  [ -d "$DATA/mysql" ] || die "Datadir not initialized. Run: ./scripts/mysql.sh init"
  echo "Starting mysqld on 127.0.0.1:$PORT ..."
  "$BASE/bin/mysqld" --defaults-file="$CONF" --daemonize
  for i in $(seq 1 60); do
    if "$BASE/bin/mysqladmin" --socket="$SOCK" -uroot ping >/dev/null 2>&1; then
      echo "Ready. Version: $("$BASE/bin/mysqld" --version | awk '{print $3}')"
      return 0
    fi
    sleep 1
  done
  die "Did not become ready in 60s. See $LOG"
}

cmd_stop() {
  if ! is_running; then echo "Not running."; return 0; fi
  echo "Stopping (pid $(cat "$PIDF")) ..."
  "$BASE/bin/mysqladmin" --socket="$SOCK" -uroot shutdown || kill "$(cat "$PIDF")"
  for i in $(seq 1 30); do is_running || { echo "Stopped."; return 0; }; sleep 1; done
  die "Did not stop in 30s."
}

cmd_status() {
  if is_running; then
    echo "RUNNING  pid=$(cat "$PIDF")  port=$PORT  socket=$SOCK"
    "$BASE/bin/mysql" --socket="$SOCK" -uroot -N -B -e \
      "SELECT CONCAT('version=', @@version), CONCAT('charset=', @@character_set_database), CONCAT('collation=', @@collation_database);" 2>/dev/null \
      | tr '\t' '\n' | sed 's/^/         /'
  else
    echo "STOPPED"
  fi
}

# One-time: download and unpack MySQL 8.4 into $BASE. No root required.
cmd_install() {
  if [ -x "$BASE/bin/mysqld" ]; then
    echo "Already installed: $("$BASE/bin/mysqld" --version | awk '{print $3}')"; return 0
  fi
  mkdir -p "$ROOT" "$BASE"
  echo "Downloading MySQL $MYSQL_VERSION (~77 MB) ..."
  curl -sSL --max-time 900 -o "$ROOT/$TARBALL" "$URL" || die "Download failed."
  echo "Unpacking ..."
  tar -xJf "$ROOT/$TARBALL" -C "$BASE" --strip-components=1 || die "Unpack failed."
  rm -f "$ROOT/$TARBALL"
  echo "Installed: $("$BASE/bin/mysqld" --version | awk '{print $3}')"
  echo "Next: ./scripts/mysql.sh init"
}

# One-time: write my.cnf and initialize the datadir.
cmd_init() {
  [ -x "$BASE/bin/mysqld" ] || die "Run ./scripts/mysql.sh install first."
  [ -d "$DATA/mysql" ] && { echo "Datadir already initialized at $DATA."; return 0; }
  mkdir -p "$DATA"
  if [ ! -f "$CONF" ]; then
    cat > "$CONF" <<CNF
[mysqld]
basedir         = $BASE
datadir         = $DATA
socket          = $SOCK
pid-file        = $PIDF
log-error       = $LOG
port            = $PORT
bind-address    = 127.0.0.1

# Cyrillic support - see CLAUDE.md section 7, pitfall 4
character-set-server = utf8mb4
collation-server     = utf8mb4_0900_ai_ci

innodb_buffer_pool_size = 128M
mysqlx = OFF

[client]
socket = $SOCK
port   = $PORT
CNF
    echo "Wrote $CONF"
  fi
  echo "Initializing datadir (this takes ~30s) ..."
  "$BASE/bin/mysqld" --defaults-file="$CONF" --initialize-insecure || die "Init failed. See $LOG"
  echo "Initialized. Next: ./scripts/mysql.sh start"
}

cmd_cli()  { exec "$BASE/bin/mysql" --socket="$SOCK" -uroot biblioteka "$@"; }
cmd_logs() { tail -f "$LOG"; }

case "${1:-}" in
  install) cmd_install ;;
  init)    cmd_init ;;
  start)  cmd_start ;;
  stop)   cmd_stop ;;
  restart) cmd_stop; cmd_start ;;
  status) cmd_status ;;
  cli)    shift; cmd_cli "$@" ;;
  logs)   cmd_logs ;;
  *) echo "usage: $0 {install|init|start|stop|restart|status|cli|logs}"; exit 1 ;;
esac
