@echo off
title Enlace Publico La Nucia FS - Panel Entrenador
color 0C
echo ==============================================================================
echo     LA NUCIA FUTBOL SALA - ENLACE PUBLICO COMPARTIBLE EN VIVO
echo ==============================================================================
echo.
echo Conectando tunel seguro a Internet...
echo Podras compartir este enlace con cualquier persona por WhatsApp o correo.
echo Funcionara en directo en su movil, tablet u ordenador.
echo.
echo (Manten esta ventana abierta mientras quieras que puedan verlo)
echo.
ssh -o StrictHostKeyChecking=no -R 80:localhost:3050 nokey@localhost.run
pause
