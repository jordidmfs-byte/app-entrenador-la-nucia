@echo off
title Servidor La Nucia FS - Panel Entrenador
echo Iniciando aplicacion y enlace para compartir...
start /B node server.js
cloudflared.exe tunnel --url http://localhost:3050
