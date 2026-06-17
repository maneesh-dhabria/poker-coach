@echo off
REM comments-open.bat — Windows launcher for the comments viewer.
REM Precheck node, reuse live serve.js via .pmos-serve.pid, else spawn fresh.
REM FR-40, FR-43, NFR-09.
setlocal enabledelayedexpansion
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo comments-open: node not found - install Node ^>=18 ^(https://nodejs.org^) 1>&2
  exit /b 127
)
set "PID_FILE=.pmos-serve.pid"
set "PORT="
if exist "%PID_FILE%" (
  for /f "usebackq delims=" %%P in (`node -e "try{process.stdout.write(String(JSON.parse(require('fs').readFileSync('.pmos-serve.pid','utf8')).pid))}catch(e){}"`) do set "PID=%%P"
  if defined PID (
    tasklist /FI "PID eq !PID!" 2>nul | findstr /R "!PID!" >nul
    if not errorlevel 1 (
      for /f "usebackq delims=" %%Q in (`node -e "try{process.stdout.write(String(JSON.parse(require('fs').readFileSync('.pmos-serve.pid','utf8')).port))}catch(e){}"`) do set "PORT=%%Q"
      echo comments-open: reusing serve.js at port !PORT! 1>&2
    ) else ( del /f /q "%PID_FILE%" )
  )
)
if not defined PORT (
  start /b "" node assets\serve.js --port=0 --pid-file=%PID_FILE% --idle=300 >nul 2>&1
  for /l %%i in (1,1,15) do ( if exist "%PID_FILE%" goto :gotpid
    ping -n 1 -w 200 127.0.0.1 >nul )
  :gotpid
  for /f "usebackq delims=" %%Q in (`node -e "try{process.stdout.write(String(JSON.parse(require('fs').readFileSync('.pmos-serve.pid','utf8')).port))}catch(e){}"`) do set "PORT=%%Q"
)
set "FILE=%~1"
if "%FILE%"=="" ( for /f "delims=" %%F in ('dir /b *.html 2^>nul') do ( set "FILE=%%F" & goto :gotfile ) )
:gotfile
echo comments-open: opening http://127.0.0.1:%PORT%/%FILE% 1>&2
start "" "http://127.0.0.1:%PORT%/%FILE%"
