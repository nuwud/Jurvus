@echo off
cd /d C:\Users\Nuwud\Projects\Jurvus
node --env-file=.env server\index.js >> "%TEMP%\jurvus-service.log" 2>&1
